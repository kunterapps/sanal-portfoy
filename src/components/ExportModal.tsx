import React, { useRef, useState } from 'react';
import { X, Download, Upload, CheckCircle2 } from 'lucide-react';
import { PortfolioAsset, ExchangeRates, PortfolioSnapshot } from '../types/portfolio';
import { parsePortfolioBackup } from '../utils/importValidation';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: PortfolioAsset[];
  rates: ExchangeRates;
  snapshots: PortfolioSnapshot[];
  onImportAssets: (imported: PortfolioAsset[], snapshots: PortfolioSnapshot[]) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  assets,
  rates,
  snapshots,
  onImportAssets,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  // JSON Export
  const handleExportJson = () => {
    const dataToExport = {
      app: 'PersonalPortfolioTracker',
      exportDate: new Date().toISOString(),
      assetsCount: assets.length,
      rates,
      assets,
      snapshots,
    };
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfoy-yedek-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // JSON Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const { assets: validAssets, snapshots: importedSnapshots, errors } = parsePortfolioBackup(JSON.parse(content));

        if (validAssets.length === 0) {
          setImportStatus(`Hata: Yüklenecek geçerli varlık bulunamadı. ${errors.slice(0, 3).join('; ')}`);
          return;
        }

        if (
          assets.length > 0 &&
          !window.confirm(
            `Mevcut ${assets.length} varlığınız silinip yedekteki ${validAssets.length} varlık yüklenecek. Devam edilsin mi?`
          )
        ) {
          return;
        }

        onImportAssets(validAssets, importedSnapshots);
        const skipped = errors.length > 0 ? ` (${errors.length} kayıt atlandı: ${errors.slice(0, 3).join('; ')})` : '';
        setImportStatus(`${validAssets.length} adet varlık başarıyla yüklendi!${skipped}`);
        setTimeout(
          () => {
            setImportStatus(null);
            onClose();
          },
          errors.length > 0 ? 4000 : 1500
        );
      } catch (err) {
        setImportStatus('Hata: Dosya geçerli bir portföy yedeği değil.');
      } finally {
        // Allow re-selecting the same file
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Veri Yedekleme & Dışa Aktarma</h3>
            <p className="text-xs text-slate-400 mt-0.5">Portföyünüzü JSON olarak yedekleyin veya yedekten geri yükleyin</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Message */}
        {importStatus && (
          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/50 text-indigo-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{importStatus}</span>
          </div>
        )}

        {/* JSON Backup & Restore */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* JSON Export */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>JSON Portföy Yedeği</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Tüm varlıklarınızı, maliyetlerinizi ve notlarınızı güvenli JSON formatında indirin.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportJson}
              className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
            >
              JSON İndir
            </button>
          </div>

          {/* JSON Import */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-sky-400" />
                <span>JSON Yedeği Yükle</span>
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Daha önce aldığınız bir JSON yedeğini yükleyerek portföyünüzü geri getirin.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full mt-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
            >
              Yedek Dosyası Seç
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
