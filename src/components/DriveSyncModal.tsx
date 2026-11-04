import React from 'react';
import { X, Cloud, CloudAlert, CloudCheck, CloudOff, RefreshCw, LogOut, HardDrive, Laptop } from 'lucide-react';
import { DriveSync } from '../hooks/useDriveSync';

const formatTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : '';

/** Small header button that shows the sync state; hidden when Google sign-in isn't set up */
export const DriveSyncButton: React.FC<{ sync: DriveSync; onClick: () => void }> = ({ sync, onClick }) => {
  if (sync.status === 'unavailable') return null;
  const { status } = sync;
  const busy = status === 'syncing' || status === 'connecting';
  const problem = status === 'error' || status === 'reauth' || status === 'choice';
  const Icon = status === 'off' ? CloudOff : problem ? CloudAlert : busy ? Cloud : CloudCheck;
  const title =
    status === 'off'
      ? 'Google Drive ile eşitleme kapalı'
      : status === 'synced'
        ? `Google Drive ile eşitlendi${sync.lastSyncAt ? ` (${formatTime(sync.lastSyncAt)})` : ''}`
        : busy
          ? 'Google Drive ile eşitleniyor...'
          : sync.error || 'Google Drive eşitlemesi bekliyor';
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="relative inline-flex items-center justify-center h-9 w-9 shrink-0 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
    >
      <Icon
        className={`w-4 h-4 ${
          status === 'off' ? 'text-slate-500' : problem ? 'text-amber-400' : busy ? 'text-indigo-300 animate-pulse' : 'text-emerald-400'
        }`}
      />
    </button>
  );
};

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  sync: DriveSync;
}

export const DriveSyncModal: React.FC<DriveSyncModalProps> = ({ isOpen, onClose, sync }) => {
  if (!isOpen || sync.status === 'unavailable') return null;
  const { status, choice } = sync;
  const connected = status !== 'off';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="drive-sync-title"
        className="w-full sm:max-w-md max-h-[90dvh] overflow-y-auto bg-[#0f172a] border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 id="drive-sync-title" className="flex items-center gap-2 text-base font-semibold text-white">
            <Cloud className="w-5 h-5 text-indigo-400" />
            Google Drive ile eşitleme
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4 text-sm text-slate-300">
          {!connected && (
            <>
              <p>
                Portföyleriniz Google Drive hesabınıza kaydedilir; bilgisayar, telefon gibi aynı Google hesabıyla bağlandığınız tüm
                cihazlarda aynı veriyi görürsünüz.
              </p>
              <ul className="space-y-1.5 text-slate-400 list-disc pl-5">
                <li>Veriler Drive’ınızdaki gizli uygulama klasöründe durur. Uygulama Drive’daki diğer dosyalarınızı göremez.</li>
                <li>İsteğe bağlıdır: bağlanmasanız da site bugünkü gibi bu tarayıcıda çalışmaya devam eder.</li>
                <li>Bağlantıyı istediğiniz an kesebilirsiniz; bu cihazdaki veriler silinmez.</li>
              </ul>
              {sync.error && <p className="text-amber-300">{sync.error}</p>}
              <button
                onClick={sync.connect}
                className="w-full inline-flex items-center justify-center gap-2 h-11 px-4 font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg"
              >
                <GoogleMark />
                Google ile bağlan
              </button>
            </>
          )}

          {connected && choice && (
            <>
              <p className="text-white font-medium">Drive’da ve bu cihazda farklı portföyler var. Hangisi kullanılsın?</p>
              <p className="text-slate-400">Seçmediğiniz taraftaki veriler silinir. Emin değilseniz önce “Yedekle / Yükle” ile bu cihazın yedeğini alın.</p>
              <button
                onClick={() => {
                  sync.resolveChoice('remote');
                  onClose();
                }}
                className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5"
              >
                <HardDrive className="w-5 h-5 mt-0.5 text-indigo-400 shrink-0" />
                <span>
                  <span className="block font-semibold text-white">Drive’dakini kullan</span>
                  <span className="block text-slate-400">
                    {choice.remotePortfolios} portföy, {choice.remoteAssets} varlık · son kayıt {formatTime(choice.remoteUpdatedAt)}
                  </span>
                </span>
              </button>
              <button
                onClick={() => {
                  sync.resolveChoice('local');
                  onClose();
                }}
                className="w-full text-left flex items-start gap-3 p-3 rounded-xl border border-slate-700 hover:border-indigo-500 hover:bg-indigo-500/5"
              >
                <Laptop className="w-5 h-5 mt-0.5 text-indigo-400 shrink-0" />
                <span>
                  <span className="block font-semibold text-white">Bu cihazdakini Drive’a yükle</span>
                  <span className="block text-slate-400">
                    {choice.localPortfolios} portföy, {choice.localAssets} varlık
                  </span>
                </span>
              </button>
            </>
          )}

          {connected && !choice && (
            <>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
                {status === 'error' || status === 'reauth' ? (
                  <CloudAlert className="w-5 h-5 mt-0.5 text-amber-400 shrink-0" />
                ) : (
                  <CloudCheck className="w-5 h-5 mt-0.5 text-emerald-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-medium text-white truncate">{sync.email || 'Google hesabı'}</div>
                  <div className="text-slate-400">
                    {status === 'syncing' || status === 'connecting'
                      ? 'Eşitleniyor...'
                      : status === 'synced'
                        ? `Eşitlendi${sync.lastSyncAt ? `: ${formatTime(sync.lastSyncAt)}` : ''}`
                        : sync.error}
                  </div>
                </div>
              </div>
              <p className="text-slate-400">
                Tüm portföyler açılışta, sekmeye geri döndüğünüzde ve her değişiklikten birkaç saniye sonra eşitlenir. İki cihazda aynı
                anda değişiklik yapılırsa en son yapılan geçerli olur.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                {status === 'reauth' ? (
                  <button
                    onClick={sync.connect}
                    className="sm:flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-lg"
                  >
                    <GoogleMark />
                    Yeniden bağlan
                  </button>
                ) : (
                  <button
                    onClick={sync.syncNow}
                    disabled={status === 'syncing' || status === 'connecting'}
                    className="sm:flex-1 inline-flex items-center justify-center gap-2 h-10 px-4 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg"
                  >
                    <RefreshCw className={`w-4 h-4 ${status === 'syncing' ? 'animate-spin' : ''}`} />
                    Şimdi eşitle
                  </button>
                )}
                <button
                  onClick={() => {
                    if (window.confirm('Google Drive bağlantısı kesilsin mi? Bu cihazdaki veriler kalır, Drive’daki kopya da silinmez.')) {
                      sync.disconnect();
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 h-10 px-4 font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Bağlantıyı kes
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const GoogleMark = () => (
  <svg viewBox="0 0 48 48" className="w-4 h-4" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
