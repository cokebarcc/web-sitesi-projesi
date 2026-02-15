import { useState, useEffect } from 'react';

export interface NewsItem {
  title: string;
  link: string;
  image?: string;
}

const NEWS_URL = 'https://sanliurfaism.saglik.gov.tr/TR-228694/basinda-biz.html';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

export function useNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch(CORS_PROXY + encodeURIComponent(NEWS_URL));
        const html = await res.text();

        // DOM parser ile haber elementlerini çıkar
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const items: NewsItem[] = [];
        // Sayfadaki haber linkleri — h5 içeren a etiketleri
        const links = doc.querySelectorAll('a');
        links.forEach((a) => {
          const h5 = a.querySelector('h5');
          if (!h5) return;
          const title = h5.textContent?.trim();
          if (!title) return;

          const href = a.getAttribute('href') || '';
          const fullLink = href.startsWith('http')
            ? href
            : `https://sanliurfaism.saglik.gov.tr${href.startsWith('/') ? '' : '/'}${href}`;

          const img = a.querySelector('img');
          let image: string | undefined;
          if (img) {
            const src = img.getAttribute('src') || '';
            image = src.startsWith('http')
              ? src
              : `https://sanliurfaism.saglik.gov.tr${src.startsWith('/') ? '' : '/'}${src}`;
          }

          items.push({ title, link: fullLink, image });
        });

        setNews(items.slice(0, 8));
      } catch (err) {
        console.error('Haberler alınamadı:', err);
        // Fallback statik haberler
        setNews([
          { title: "Şanlıurfa'da Sağlık Yöneticileri Değerlendirme Toplantısında Bir Araya Geldi", link: NEWS_URL },
          { title: "Şanlıurfa'da Bir İlk: Omuzdan Girilerek Kalp Kapakçığı Değiştirildi!", link: NEWS_URL },
          { title: "30 Yıllık Bağımlılığa Ücretsiz Elveda", link: NEWS_URL },
          { title: "12 Yıl Yatalak Kalan Hasta Doğru Tanı ve Tedaviyle Yeniden Yürümeye Başladı", link: NEWS_URL },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    // 30 dakikada bir güncelle
    const interval = setInterval(fetchNews, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { news, loading };
}
