import React, { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// PDF.js worker setup - local import via Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfViewerProps {
  onBack?: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ onBack }) => {
  const [pdfText, setPdfText] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState('');

  const parsePdf = useCallback(async (file: File) => {
    setLoading(true);
    setError('');
    setPdfText('');
    setFileName(file.name);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPageCount(pdf.numPages);

      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += `\n--- Sayfa ${i} ---\n${pageText}\n`;
      }

      setPdfText(fullText);
    } catch (err: any) {
      setError(`PDF okunamadı: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      parsePdf(file);
    } else if (file) {
      setError('Lütfen PDF dosyası seçin.');
    }
    e.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      parsePdf(file);
    } else {
      setError('Lütfen PDF dosyası sürükleyin.');
    }
  }, [parsePdf]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-white">PDF Yükle ve Oku</h1>
          <p className="text-sm text-slate-400">PDF dosyasını yükleyin, metin içeriği otomatik olarak çıkarılacaktır</p>
        </div>
      </div>

      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl p-8 text-center transition-colors cursor-pointer mb-6"
        onClick={() => document.getElementById('pdf-file-input')?.click()}
      >
        <svg className="w-12 h-12 mx-auto mb-3 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-white font-medium mb-1">PDF dosyasını sürükleyin veya tıklayın</p>
        <p className="text-xs text-slate-500">Sadece .pdf dosyaları kabul edilir</p>
        <input
          id="pdf-file-input"
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg mb-6">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-blue-300 text-sm">PDF okunuyor...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg mb-6">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Result */}
      {pdfText && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-white font-medium">{fileName}</span>
              <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">{pageCount} sayfa</span>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(pdfText)}
              className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            >
              Metni Kopyala
            </button>
          </div>
          <pre className="bg-[#0a0f1a] border border-slate-700 rounded-xl p-4 text-xs text-slate-300 overflow-auto max-h-[70vh] whitespace-pre-wrap leading-relaxed font-mono">
            {pdfText}
          </pre>
        </div>
      )}
    </div>
  );
};

export default PdfViewer;
