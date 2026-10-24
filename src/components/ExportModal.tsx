import React, { useRef, useState } from 'react';
import { X, Download, Upload, FileCode, CheckCircle2, Copy } from 'lucide-react';
import { PortfolioAsset, ExchangeRates } from '../types/portfolio';
import { triggerDownloadStandaloneHtml } from '../utils/standaloneHtmlGenerator';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets: PortfolioAsset[];
  rates: ExchangeRates;
  onImportAssets: (imported: PortfolioAsset[]) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  assets,
  rates,
  onImportAssets,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // JSON Export
  const handleExportJson = () => {
    const dataToExport = {
      app: 'PersonalPortfolioTracker',
      exportDate: new Date().toISOString(),
      assetsCount: assets.length,
      rates,
      assets,
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
        const parsed = JSON.parse(content);
        let validAssets: PortfolioAsset[] = [];

        if (Array.isArray(parsed)) {
          validAssets = parsed;
        } else if (parsed && Array.isArray(parsed.assets)) {
          validAssets = parsed.assets;
        } else {
          throw new Error('Geçersiz dosya formatı');
        }

        if (validAssets.length >= 0) {
          onImportAssets(validAssets);
          setImportStatus(`${validAssets.length} adet varlık başarıyla yüklendi!`);
          setTimeout(() => {
            setImportStatus(null);
            onClose();
          }, 1500);
        }
      } catch (err) {
        setImportStatus('Hata: Dosya geçerli bir portföy yedeği değil.');
      }
    };
    reader.readAsText(file);
  };

  const gitHubPagesSteps = `1. GitHub'da yeni bir public repository oluşturun (örn: "portfoyum").
2. İndirdiğiniz "index.html" dosyasını ana dizine yükleyin (commit).
3. Repository > Settings > Pages menüsüne gidin.
4. "Branch: main" ve "/ (root)" seçip "Save" butonuna tıklayın.
5. 60 saniye içinde uygulamanız "kullaniciadi.github.io/portfoyum" adresinde canlıya geçecektir!`;

  const copySteps = () => {
    navigator.clipboard.writeText(gitHubPagesSteps);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-6 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Veri Yedekleme & Dışa Aktarma</h3>
            <p className="text-xs text-slate-400 mt-0.5">Portföyünüzü yedekleyin veya GitHub Pages için indirin</p>
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

        {/* 1. Standalone Single File HTML Export for GitHub Pages */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">GitHub Pages İçin Tek Dosya HTML</h4>
              <p className="text-[11px] text-slate-400">
                Tailwind CSS, Vue.js ve Chart.js CDN içeren tamamen bağımsız tek parça index.html
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => triggerDownloadStandaloneHtml(assets, rates)}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Tek Parça HTML Olarak İndir (index.html)</span>
          </button>
        </div>

        {/* 2. JSON Backup & Restore */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* JSON Export */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Download className="w-4 h-4 text-emerald-400" />
                <span>JSON Portföy Yedeği</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-1">
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
              <p className="text-[11px] text-slate-400 mt-1">
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

        {/* 3. GitHub Pages Deployment Instructions Accordion */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">GitHub Pages Kurulum Adımları</span>
            <button
              type="button"
              onClick={copySteps}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <Copy className="w-3 h-3" />
              <span>{copied ? 'Kopyalandı!' : 'Kopyala'}</span>
            </button>
          </div>
          <pre className="text-[11px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-900">
            {gitHubPagesSteps}
          </pre>
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
