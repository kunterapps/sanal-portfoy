import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Pencil, Plus, Trash2, Briefcase } from 'lucide-react';
import { MAX_PORTFOLIO_NAME, PortfolioMeta } from '../utils/portfolios';

export interface PortfolioControls {
  portfolios: PortfolioMeta[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

const NameInput: React.FC<{
  initial: string;
  placeholder: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}> = ({ initial, placeholder, onSubmit, onCancel }) => {
  const [value, setValue] = useState(initial);
  return (
    <form
      className="flex items-center gap-1.5 px-2 py-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value);
      }}
    >
      <input
        autoFocus
        value={value}
        maxLength={MAX_PORTFOLIO_NAME}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onCancel();
          }
        }}
        className="min-w-0 flex-1 h-8 px-2.5 text-base sm:text-sm bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-md text-white outline-none"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="h-8 px-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-md"
      >
        Kaydet
      </button>
    </form>
  );
};

export const PortfolioSwitcher: React.FC<{ controls: PortfolioControls }> = ({ controls }) => {
  const { portfolios, activeId, onSelect, onCreate, onRename, onDelete } = controls;
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = portfolios.find((p) => p.id === activeId) ?? portfolios[0];

  const close = () => {
    setOpen(false);
    setRenamingId(null);
    setCreating(false);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0 max-w-[11rem] sm:max-w-[16rem]">
      <button
        onClick={() => (open ? close() : setOpen(true))}
        title="Portföy seç"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-9 max-w-full px-2.5 text-sm font-semibold text-slate-200 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
      >
        <Briefcase className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
        <span className="truncate">{active.name}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 w-[min(18rem,calc(100vw-2rem))] z-50 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl shadow-black/50 py-1.5"
        >
          <div className="px-3 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Portföyler</div>
          <ul className="max-h-[50vh] overflow-y-auto">
            {portfolios.map((p) =>
              renamingId === p.id ? (
                <li key={p.id}>
                  <NameInput
                    initial={p.name}
                    placeholder="Portföy adı"
                    onSubmit={(name) => {
                      onRename(p.id, name);
                      setRenamingId(null);
                    }}
                    onCancel={() => setRenamingId(null)}
                  />
                </li>
              ) : (
                <li key={p.id} className="group flex items-center gap-1 px-1.5">
                  <button
                    role="menuitemradio"
                    aria-checked={p.id === activeId}
                    onClick={() => {
                      if (p.id !== activeId) onSelect(p.id);
                      close();
                    }}
                    className={`flex-1 min-w-0 flex items-center gap-2 h-9 px-2 rounded-md text-left text-sm transition-colors ${
                      p.id === activeId ? 'text-white font-semibold bg-indigo-500/10' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Check className={`w-4 h-4 shrink-0 ${p.id === activeId ? 'text-indigo-400' : 'invisible'}`} />
                    <span className="truncate">{p.name}</span>
                  </button>
                  <button
                    onClick={() => {
                      setCreating(false);
                      setRenamingId(p.id);
                    }}
                    title="Adını değiştir"
                    className="shrink-0 p-2 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-800 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {portfolios.length > 1 && (
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `"${p.name}" portföyü ve içindeki tüm varlıklar, işlemler ve değer geçmişi silinecek. Emin misiniz?`
                          )
                        ) {
                          onDelete(p.id);
                          close();
                        }
                      }}
                      title="Portföyü sil"
                      className="shrink-0 p-2 rounded-md text-slate-500 hover:text-rose-400 hover:bg-slate-800 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              )
            )}
          </ul>
          <div className="mt-1.5 pt-1.5 border-t border-slate-800">
            {creating ? (
              <NameInput
                initial=""
                placeholder="Yeni portföyün adı"
                onSubmit={(name) => {
                  onCreate(name);
                  close();
                }}
                onCancel={() => setCreating(false)}
              />
            ) : (
              <button
                onClick={() => {
                  setRenamingId(null);
                  setCreating(true);
                }}
                className="mx-1.5 w-[calc(100%-0.75rem)] flex items-center gap-2 h-9 px-2 rounded-md text-sm font-medium text-indigo-300 hover:text-indigo-200 hover:bg-slate-800"
              >
                <Plus className="w-4 h-4" />
                Yeni portföy
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
