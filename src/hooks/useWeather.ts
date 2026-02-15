import { useState, useEffect } from 'react';

interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
}

// WMO Weather interpretation codes → icon, label, bg image, gradient overlay
export interface WeatherVisual {
  icon: string;
  label: string;
  bg: string;      // unsplash/pexels URL for background
  gradient: string; // overlay gradient for readability
}

export function getWeatherInfo(code: number, isDay: boolean): WeatherVisual {
  if (code === 0) return isDay
    ? { icon: '☀️', label: 'Açık', bg: 'https://images.unsplash.com/photo-1622278647429-71bc97f904a8?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(251,191,36,0.3) 0%, rgba(245,158,11,0.15) 40%, rgba(0,0,0,0.4) 100%)' }
    : { icon: '🌙', label: 'Açık', bg: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(30,58,138,0.5) 0%, rgba(15,23,42,0.7) 100%)' };
  if (code <= 3) return isDay
    ? { icon: '⛅', label: 'Parçalı bulutlu', bg: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(56,189,248,0.2) 0%, rgba(100,116,139,0.3) 40%, rgba(0,0,0,0.45) 100%)' }
    : { icon: '☁️', label: 'Parçalı bulutlu', bg: 'https://images.unsplash.com/photo-1505322022379-7c3aeb8100b0?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.8) 100%)' };
  if (code <= 48) return { icon: '🌫️', label: 'Sisli', bg: 'https://images.unsplash.com/photo-1487621167305-5d248087c724?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(148,163,184,0.4) 0%, rgba(71,85,105,0.5) 40%, rgba(0,0,0,0.5) 100%)' };
  if (code <= 57) return { icon: '🌦️', label: 'Çisenti', bg: 'https://images.unsplash.com/photo-1515694346937-94d85e39d29e?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(100,116,139,0.4) 0%, rgba(51,65,85,0.5) 40%, rgba(0,0,0,0.5) 100%)' };
  if (code <= 67) return { icon: '🌧️', label: 'Yağmurlu', bg: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(30,58,138,0.4) 40%, rgba(0,0,0,0.55) 100%)' };
  if (code <= 77) return { icon: '❄️', label: 'Karlı', bg: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(224,242,254,0.3) 0%, rgba(148,163,184,0.3) 40%, rgba(0,0,0,0.4) 100%)' };
  if (code <= 82) return { icon: '🌧️', label: 'Sağanak', bg: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(30,64,175,0.4) 0%, rgba(15,23,42,0.6) 100%)' };
  if (code <= 86) return { icon: '🌨️', label: 'Kar yağışlı', bg: 'https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(203,213,225,0.3) 0%, rgba(71,85,105,0.5) 100%)' };
  if (code <= 99) return { icon: '⛈️', label: 'Gök gürültülü', bg: 'https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(51,65,85,0.5) 0%, rgba(15,23,42,0.7) 100%)' };
  return { icon: '☁️', label: 'Bulutlu', bg: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?w=600&q=80&auto=format&fit=crop', gradient: 'linear-gradient(135deg, rgba(100,116,139,0.4) 0%, rgba(0,0,0,0.5) 100%)' };
}

// Şanlıurfa koordinatları
const SANLIURFA_LAT = 37.1674;
const SANLIURFA_LNG = 38.7955;

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${SANLIURFA_LAT}&longitude=${SANLIURFA_LNG}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,is_day`;
        const res = await fetch(url);
        const data = await res.json();
        const c = data.current;
        setWeather({
          temperature: Math.round(c.temperature_2m),
          apparentTemperature: Math.round(c.apparent_temperature),
          humidity: c.relative_humidity_2m,
          windSpeed: Math.round(c.wind_speed_10m),
          weatherCode: c.weather_code,
          isDay: c.is_day === 1,
        });
      } catch (err) {
        console.error('Hava durumu alınamadı:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    // 15 dakikada bir güncelle
    const interval = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { weather, loading };
}
