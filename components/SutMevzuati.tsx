import React, { useState, useEffect, useRef, useCallback } from 'react';
import mammoth from 'mammoth';
import { uploadFinansalFile, getFinansalFileMetadata, downloadFinansalFile, deleteFinansalFile } from '../src/services/finansalStorage';

const SutMevzuati: React.FC = () => {
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const scrollToTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const slugify = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[çÇ]/g, 'c')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[ıİ]/g, 'i')
      .replace(/[öÖ]/g, 'o')
      .replace(/[şŞ]/g, 's')
      .replace(/[üÜ]/g, 'u')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const processHtml = (html: string): string => {
    // Üstü çizili metinleri kaldır
    html = html.replace(/<s\b[^>]*>[\s\S]*?<\/s>/gi, '');
    html = html.replace(/<del\b[^>]*>[\s\S]*?<\/del>/gi, '');

    // Boş paragrafları temizle
    html = html.replace(/<p>\s*<\/p>/gi, '');

    // Başlık etiketlerine ID ata (h1, h2, h3, h4, h5, h6)
    const headingIdMap = new Map<string, number>();
    html = html.replace(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi, (match, tag, attrs, content) => {
      const textContent = content.replace(/<[^>]+>/g, '').trim();
      let slug = slugify(textContent);
      if (!slug) return match;

      // Aynı slug varsa sayı ekle
      const count = headingIdMap.get(slug) || 0;
      headingIdMap.set(slug, count + 1);
      if (count > 0) slug = `${slug}-${count}`;

      return `<${tag}${attrs} id="${slug}">${content}</${tag}>`;
    });

    // Kalın paragrafları da başlık olarak ID'le (SUT'ta "1.4 - Sağlık hizmeti sunucuları" gibi)
    html = html.replace(/<p([^>]*)><strong>([\s\S]*?)<\/strong><\/p>/gi, (match, attrs, content) => {
      const textContent = content.replace(/<[^>]+>/g, '').trim();
      // Numara ile başlayan kalın metinleri başlık olarak işaretle
      if (/^\d/.test(textContent)) {
        let slug = slugify(textContent);
        if (!slug) return match;
        const count = headingIdMap.get(slug) || 0;
        headingIdMap.set(slug, count + 1);
        if (count > 0) slug = `${slug}-${count}`;
        return `<p${attrs} id="${slug}"><strong>${content}</strong></p>`;
      }
      return match;
    });

    // İçindekiler linklerini sayfa içi anchor'lara dönüştür
    // Mammoth bazen bookmark linkler üretiyor, bunları da yakalayalım
    html = html.replace(/<a\b[^>]*href="[^"]*"[^>]*>([\s\S]*?)<\/a>/gi, (match, linkText) => {
      const cleanText = linkText.replace(/<[^>]+>/g, '').trim();
      // Sayfa numaralarını kaldır (linkText sonundaki sayılar)
      const withoutPageNum = cleanText.replace(/\s*\d+\s*$/, '').trim();
      if (!withoutPageNum) return cleanText || match;

      const slug = slugify(withoutPageNum);
      if (!slug) return cleanText;

      return `<a href="#${slug}" class="sut-toc-link">${linkText}</a>`;
    });

    return html;
  };

  // ArrayBuffer → HTML dönüşüm fonksiyonu
  const parseDocx = useCallback(async (arrayBuffer: ArrayBuffer): Promise<string | null> => {
    try {
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        { styleMap: ["strike => s"] }
      );
      return processHtml(result.value);
    } catch (error) {
      console.error('Word dosyası parse hatası:', error);
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Firebase'den mevcut dosyayı yükle
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await getFinansalFileMetadata('sutMevzuati', 'sut');
        if (!meta?.storagePath) { setInitialLoading(false); return; }

        const ab = await downloadFinansalFile(meta.storagePath);
        if (ab && !cancelled) {
          const html = await parseDocx(ab);
          if (html && !cancelled) {
            setHtmlContent(html);
            setFileName(meta.fileName);
          }
        }
      } catch (err) {
        console.error('[SUT] Firebase yükleme hatası:', err);
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [parseDocx]);

  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a.sut-toc-link') as HTMLAnchorElement | null;

    if (anchor) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href && href.startsWith('#')) {
        const targetId = href.slice(1);
        const targetEl = contentRef.current?.querySelector(`#${CSS.escape(targetId)}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Hedef elementi kısa süreliğine vurgula
          targetEl.classList.add('sut-highlight');
          setTimeout(() => targetEl.classList.remove('sut-highlight'), 2000);
        }
      }
    }
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const html = await parseDocx(arrayBuffer);
        if (html) {
          setHtmlContent(html);
          // Firebase'e arka planda yükle
          uploadFinansalFile('sutMevzuati', 'sut', file).catch(err =>
            console.error('[SUT] Firebase yükleme hatası:', err)
          );
        }
      } catch (error) {
        console.error('Word dosyası okuma hatası:', error);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  if (initialLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>SUT Mevzuatı</h1>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Veriler yükleniyor...</p>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div ref={topRef} />
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>SUT Mevzuatı</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Sağlık Uygulama Tebliği mevzuat dosyası</p>
          </div>
        </div>
      </div>

      {/* Highlight animation style */}
      <style>{`
        .sut-highlight {
          animation: sutHighlight 2s ease-out;
        }
        @keyframes sutHighlight {
          0% { background-color: rgba(6, 182, 212, 0.3); }
          100% { background-color: transparent; }
        }
        .sut-toc-link {
          cursor: pointer;
        }
        .sut-toc-link:hover {
          color: #22d3ee !important;
        }
        .sut-content p { color: var(--text-2); }
        .sut-content h1,
        .sut-content h2,
        .sut-content h3,
        .sut-content h4 { color: var(--text-1); }
        .sut-content strong { color: var(--text-1); }
        .sut-content li { color: var(--text-2); }
        .sut-content th { background: var(--surface-1); color: var(--text-2); border-color: var(--border-2); }
        .sut-content td { color: var(--text-2); border-color: var(--border-2); }
        .sut-content sup { color: var(--text-3); }
      `}</style>

      {/* Word Yükleme / İçerik */}
      {!htmlContent ? (
        <div className="space-y-4">
          <label className={`backdrop-blur-xl rounded-2xl border p-12 cursor-pointer hover:border-cyan-500/50 transition-all group flex flex-col items-center justify-center ${loading ? 'opacity-50 pointer-events-none' : ''}`} style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
            <div className="w-16 h-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-cyan-500/20 transition-colors">
              {loading ? (
                <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin"></div>
              ) : (
                <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </div>
            <h3 className="text-lg font-semibold group-hover:text-cyan-300 transition-colors mb-1" style={{ color: 'var(--text-1)' }}>
              {loading ? 'Dosya İşleniyor...' : 'SUT Word Dosyasını Yükleyin'}
            </h3>
            <p className="text-sm text-center max-w-md" style={{ color: 'var(--text-3)' }}>
              .docx formatında SUT mevzuat dosyasını yükleyin. Üzeri çizilmiş (güncellenmiş) maddeler otomatik olarak kaldırılacaktır.
            </p>
            <input type="file" className="hidden" accept=".docx" onChange={handleUpload} />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Üst Bar */}
          <div className="backdrop-blur-xl rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>SUT Mevzuatı</h3>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>{fileName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <label className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors border" style={{ background: 'var(--surface-2)', color: 'var(--text-2)', borderColor: 'var(--border-2)' }}>
                Değiştir
                <input type="file" className="hidden" accept=".docx" onChange={handleUpload} />
              </label>
              <button onClick={() => { setHtmlContent(null); setFileName(''); deleteFinansalFile('sutMevzuati', 'sut').catch(err => console.error('[SUT] silme hatası:', err)); }} className="bg-rose-500/10 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-rose-500/20 transition-colors border border-rose-500/20">
                Temizle
              </button>
            </div>
          </div>

          {/* İçerik */}
          <div className="backdrop-blur-xl rounded-2xl border p-6 sm:p-8" style={{ background: 'var(--surface-1)', borderColor: 'var(--border-2)' }}>
            <div
              ref={contentRef}
              onClick={handleContentClick}
              className="sut-content prose prose-sm max-w-none
                [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2
                [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:scroll-mt-4
                [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:scroll-mt-4
                [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:scroll-mt-4
                [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mb-2 [&_h4]:mt-3 [&_h4]:scroll-mt-4
                [&_strong]:font-bold
                [&_em]:italic
                [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3
                [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3
                [&_li]:text-sm [&_li]:mb-1
                [&_table]:w-full [&_table]:border-collapse [&_table]:mb-4
                [&_th]:text-xs [&_th]:font-bold [&_th]:px-3 [&_th]:py-2 [&_th]:border [&_th]:text-left
                [&_td]:text-xs [&_td]:px-3 [&_td]:py-2 [&_td]:border
                [&_a]:text-cyan-400 [&_a]:underline
                [&_sup]:text-xs
                [&_[id]]:scroll-mt-4
              "
              style={{ color: 'var(--text-2)' }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </div>
      )}

      {/* Yukarı Dön Butonu */}
      {htmlContent && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 w-12 h-12 bg-cyan-500 hover:bg-cyan-400 text-white rounded-full shadow-lg shadow-cyan-500/30 flex items-center justify-center transition-all hover:scale-110 z-[9999]"
          title="En yukarı dön"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SutMevzuati;
