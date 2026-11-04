/**
 * Optional Google Drive sync of all portfolios. Off until the user signs in
 * with Google; the app works exactly the same without it (localStorage only).
 *
 * When on, it syncs on start, when the tab comes back into view, when the
 * connection returns, and a few seconds after each local change. See
 * decideSync for who wins when both sides changed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AuthExpiredError,
  DriveFileMeta,
  downloadSyncFile,
  exchangeGoogleCode,
  fetchGoogleClientId,
  findSyncFile,
  refreshGoogleToken,
  revokeGoogleToken,
  startGoogleSignIn,
  takeSignInRedirect,
  uploadSyncFile,
} from '../services/googleDrive';
import {
  SyncDocument,
  buildSyncDocument,
  contentHash,
  countAssets,
  decideSync,
  parseSyncDocument,
  readLocalPortfolios,
  writeLocalPortfolios,
} from '../utils/syncDocument';

const STATE_KEY = 'my_personal_portfolio_drive';
const PUSH_DELAY_MS = 3000;

interface StoredSyncState {
  refreshToken: string;
  email: string | null;
  fileId: string | null;
  lastRemoteModified: string | null;
  lastSyncedHash: string | null;
  dirtySince: string | null;
  lastSyncAt: string | null;
}

export type DriveSyncStatus =
  | 'unavailable' // Google sign-in isn't set up on the server
  | 'off'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'reauth' // signed out by Google; needs a new sign-in
  | 'choice'; // first sync, both sides have different data

export interface DriveChoice {
  remotePortfolios: number;
  remoteAssets: number;
  remoteUpdatedAt: string;
  localPortfolios: number;
  localAssets: number;
}

export interface DriveSync {
  status: DriveSyncStatus;
  email: string | null;
  lastSyncAt: string | null;
  error: string | null;
  choice: DriveChoice | null;
  connect: () => void;
  disconnect: () => Promise<void>;
  syncNow: () => void;
  resolveChoice: (keep: 'remote' | 'local') => void;
  /** Call after any local change to portfolio data */
  notifyChange: () => void;
}

function loadState(): StoredSyncState | null {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
    if (s && typeof s.refreshToken === 'string' && s.refreshToken) return s;
  } catch {}
  return null;
}

function saveState(s: StoredSyncState | null) {
  try {
    if (s) localStorage.setItem(STATE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STATE_KEY);
  } catch {}
}

const errorText = (err: unknown) =>
  !navigator.onLine
    ? 'İnternet bağlantısı yok, bağlantı gelince eşitlenecek.'
    : err instanceof Error
      ? err.message
      : 'Eşitleme başarısız oldu.';

export function useDriveSync(onRemoteApplied: () => void): DriveSync {
  const [status, setStatus] = useState<DriveSyncStatus>(() => (loadState() ? 'syncing' : 'off'));
  const [email, setEmail] = useState<string | null>(() => loadState()?.email ?? null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => loadState()?.lastSyncAt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<DriveChoice | null>(null);

  const stateRef = useRef<StoredSyncState | null>(loadState());
  const tokenRef = useRef<{ token: string; expiresAt: number } | null>(null);
  const clientIdRef = useRef<string | null>(null);
  const runningRef = useRef(false);
  const rerunRef = useRef(false);
  /** Nothing local counts as an edit until the first sync of this page load is done (startup refreshes aren't edits) */
  const settledRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChoiceRef = useRef<{ doc: SyncDocument; file: DriveFileMeta } | null>(null);
  const onRemoteAppliedRef = useRef(onRemoteApplied);
  onRemoteAppliedRef.current = onRemoteApplied;

  const update = useCallback((patch: Partial<StoredSyncState>) => {
    if (!stateRef.current) return;
    stateRef.current = { ...stateRef.current, ...patch };
    saveState(stateRef.current);
  }, []);

  const getToken = useCallback(async () => {
    const cached = tokenRef.current;
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const s = stateRef.current;
    if (!s) throw new AuthExpiredError('Bağlı değil');
    const t = await refreshGoogleToken(s.refreshToken);
    tokenRef.current = { token: t.accessToken, expiresAt: Date.now() + t.expiresIn * 1000 };
    if (t.refreshToken && t.refreshToken !== s.refreshToken) update({ refreshToken: t.refreshToken });
    return t.accessToken;
  }, [update]);

  const markSynced = useCallback(
    (file: DriveFileMeta, hash: string) => {
      const now = new Date().toISOString();
      update({ fileId: file.id, lastRemoteModified: file.modifiedTime, lastSyncedHash: hash, dirtySince: null, lastSyncAt: now });
      setLastSyncAt(now);
      setError(null);
      setStatus('synced');
    },
    [update]
  );

  const push = useCallback(
    async (token: string, fileId: string | null) => {
      const portfolios = readLocalPortfolios();
      const file = await uploadSyncFile(token, fileId, buildSyncDocument(portfolios));
      markSynced(file, contentHash(portfolios));
    },
    [markSynced]
  );

  const adopt = useCallback(
    (doc: SyncDocument, file: DriveFileMeta) => {
      writeLocalPortfolios(doc.portfolios);
      markSynced(file, contentHash(readLocalPortfolios()));
      onRemoteAppliedRef.current();
    },
    [markSynced]
  );

  const runSync = useCallback(async () => {
    if (!stateRef.current || pendingChoiceRef.current) return;
    if (runningRef.current) {
      rerunRef.current = true;
      return;
    }
    runningRef.current = true;
    setStatus('syncing');
    try {
      do {
        rerunRef.current = false;
        const s = stateRef.current;
        if (!s) break;
        const token = await getToken();
        const file = await findSyncFile(token);
        const local = readLocalPortfolios();
        const localHash = contentHash(local);
        const firstSync = !s.lastRemoteModified;
        const remoteChanged = !!file && file.modifiedTime !== s.lastRemoteModified;

        const needRemote = !!file && (remoteChanged || firstSync);
        const doc = needRemote && file ? parseSyncDocument(await downloadSyncFile(token, file.id)) : null;
        // An unreadable Drive file is treated as missing and overwritten
        const usableFile = file && !(needRemote && !doc) ? file : null;
        const action = decideSync({
          remoteModified: usableFile?.modifiedTime ?? null,
          lastRemoteModified: s.lastRemoteModified,
          localHash,
          lastSyncedHash: s.lastSyncedHash,
          dirtySince: s.dirtySince,
          remote: doc ? { updatedAt: doc.updatedAt, hash: contentHash(doc.portfolios), empty: countAssets(doc.portfolios) === 0 } : null,
          localEmpty: countAssets(local) === 0,
        });

        if (action === 'push') {
          await push(token, file?.id ?? null);
        } else if (action === 'adopt' && doc && file) {
          adopt(doc, file);
        } else if (action === 'ask' && doc && file) {
          pendingChoiceRef.current = { doc, file };
          setChoice({
            remotePortfolios: doc.portfolios.length,
            remoteAssets: countAssets(doc.portfolios),
            remoteUpdatedAt: doc.updatedAt,
            localPortfolios: local.length,
            localAssets: countAssets(local),
          });
          setStatus('choice');
          break;
        } else if (file) {
          // Nothing new on either side, or the same content on both: just remember where we are
          markSynced(file, localHash);
        }
      } while (rerunRef.current);
      settledRef.current = true;
    } catch (err) {
      if (err instanceof AuthExpiredError) {
        tokenRef.current = null;
        setStatus('reauth');
        setError('Google bağlantısının süresi doldu. Eşitlemeye devam etmek için yeniden bağlanın.');
      } else {
        setStatus('error');
        setError(errorText(err));
      }
    } finally {
      runningRef.current = false;
    }
  }, [adopt, getToken, markSynced, push]);

  // Start: finish a sign-in that just came back from Google, or sync an existing connection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const clientId = await fetchGoogleClientId();
      if (cancelled) return;
      clientIdRef.current = clientId;
      const redirect = takeSignInRedirect();
      if (redirect && 'code' in redirect) {
        setStatus('connecting');
        try {
          const t = await exchangeGoogleCode(redirect.code);
          if (!t.refreshToken) throw new Error('Google kalıcı erişim vermedi, lütfen tekrar deneyin.');
          tokenRef.current = { token: t.accessToken, expiresAt: Date.now() + t.expiresIn * 1000 };
          const fresh: StoredSyncState = {
            refreshToken: t.refreshToken,
            email: t.email ?? null,
            // A new sign-in starts over, even on a browser that was connected before
            fileId: null,
            lastRemoteModified: null,
            lastSyncedHash: null,
            dirtySince: null,
            lastSyncAt: null,
          };
          stateRef.current = fresh;
          saveState(fresh);
          setEmail(fresh.email);
        } catch (err) {
          setStatus(stateRef.current ? 'error' : clientId ? 'off' : 'unavailable');
          setError(err instanceof Error ? err.message : 'Google girişi başarısız oldu.');
          return;
        }
      } else if (redirect && 'error' in redirect && redirect.error !== 'access_denied') {
        setError('Google girişi tamamlanamadı, lütfen tekrar deneyin.');
      }
      if (stateRef.current) runSync();
      else setStatus(clientId ? 'off' : 'unavailable');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catch up when the tab comes back or the connection returns
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && stateRef.current) runSync();
    };
    const onOnline = () => stateRef.current && runSync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [runSync]);

  const notifyChange = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;
    if (!settledRef.current) {
      // A startup refresh landed while the first sync runs: include it, without counting it as an edit
      if (runningRef.current) rerunRef.current = true;
      return;
    }
    if (!s.dirtySince && contentHash(readLocalPortfolios()) !== s.lastSyncedHash) {
      update({ dirtySince: new Date().toISOString() });
    }
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => runSync(), PUSH_DELAY_MS);
  }, [runSync, update]);

  // Don't lose an edit made just before closing the tab: sync when the page is hidden
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && pushTimerRef.current) {
        clearTimeout(pushTimerRef.current);
        pushTimerRef.current = null;
        runSync();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [runSync]);

  const connect = useCallback(() => {
    if (clientIdRef.current) startGoogleSignIn(clientIdRef.current);
  }, []);

  const disconnect = useCallback(async () => {
    const s = stateRef.current;
    stateRef.current = null;
    saveState(null);
    tokenRef.current = null;
    pendingChoiceRef.current = null;
    settledRef.current = false;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    setChoice(null);
    setEmail(null);
    setLastSyncAt(null);
    setError(null);
    setStatus(clientIdRef.current ? 'off' : 'unavailable');
    if (s) await revokeGoogleToken(s.refreshToken);
  }, []);

  const resolveChoice = useCallback(
    async (keep: 'remote' | 'local') => {
      const pending = pendingChoiceRef.current;
      if (!pending) return;
      pendingChoiceRef.current = null;
      setChoice(null);
      setStatus('syncing');
      try {
        if (keep === 'remote') adopt(pending.doc, pending.file);
        else await push(await getToken(), pending.file.id);
        settledRef.current = true;
      } catch (err) {
        setStatus(err instanceof AuthExpiredError ? 'reauth' : 'error');
        setError(errorText(err));
      }
    },
    [adopt, getToken, push]
  );

  return {
    status,
    email,
    lastSyncAt,
    error,
    choice,
    connect,
    disconnect,
    syncNow: runSync,
    resolveChoice,
    notifyChange,
  };
}
