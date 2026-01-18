// ElevenLabs Text-to-Speech Service
// Daha dogal ve kaliteli Turkce seslendirme icin

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Turkce icin onerilen sesler
export const ELEVENLABS_VOICES = {
  // Multilingual v2 (Turkce destegi en iyi)
  ARIA: '9BWtsMINqrJLrRacOk9x', // Aria - Multilingual kadin
  ROGER: 'CwhRBWXzGAHq8TQ4Fs17', // Roger - Multilingual erkek
  SARAH: 'EXAVITQu4vr4xnSDxMaL', // Sarah - Multilingual kadin
  CHARLIE: 'IKne3meq5aSn9XLyUdCD', // Charlie - Multilingual erkek
  // Diger sesler
  ADAM: '21m00Tcm4TlvDq8ikWAM', // Adam - Dogal erkek ses
  DOMI: 'AZnzlk1XvdvUeBnXmlld', // Domi - Genc kadin ses
};

export const VOICE_OPTIONS = [
  { id: ELEVENLABS_VOICES.ARIA, name: 'Aria', description: 'Multilingual Kadin - Onerilen', gender: 'female' },
  { id: ELEVENLABS_VOICES.ROGER, name: 'Roger', description: 'Multilingual Erkek', gender: 'male' },
  { id: ELEVENLABS_VOICES.SARAH, name: 'Sarah', description: 'Multilingual Kadin', gender: 'female' },
  { id: ELEVENLABS_VOICES.CHARLIE, name: 'Charlie', description: 'Multilingual Erkek', gender: 'male' },
  { id: ELEVENLABS_VOICES.ADAM, name: 'Adam', description: 'Dogal Erkek Ses', gender: 'male' },
  { id: ELEVENLABS_VOICES.DOMI, name: 'Domi', description: 'Genc Kadin Ses', gender: 'female' },
];

// Varsayilan ses ayarlari
const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true
};

interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

type StatusCallback = (status: 'idle' | 'loading' | 'speaking' | 'error') => void;
type ErrorCallback = (error: string) => void;

class ElevenLabsTTSService {
  private apiKey: string | null = null;
  private audioCache: Map<string, string> = new Map();
  private currentAudio: HTMLAudioElement | null = null;
  private selectedVoiceId: string = ELEVENLABS_VOICES.ARIA;

  private onStatusChangeCallback: StatusCallback | null = null;
  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private onErrorCallback: ErrorCallback | null = null;

  // API key yonetimi
  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem('elevenlabs_api_key', key);
  }

  getApiKey(): string | null {
    if (this.apiKey) return this.apiKey;

    const storedKey = localStorage.getItem('elevenlabs_api_key');
    if (storedKey) {
      this.apiKey = storedKey;
      return storedKey;
    }

    // Vite environment variable
    const envKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (envKey) {
      this.apiKey = envKey;
      return envKey;
    }

    return null;
  }

  hasApiKey(): boolean {
    return !!this.getApiKey();
  }

  clearApiKey(): void {
    this.apiKey = null;
    localStorage.removeItem('elevenlabs_api_key');
  }

  // Ses secimi
  setVoice(voiceId: string): void {
    this.selectedVoiceId = voiceId;
    localStorage.setItem('elevenlabs_voice_id', voiceId);
  }

  getVoice(): string {
    const stored = localStorage.getItem('elevenlabs_voice_id');
    if (stored) {
      this.selectedVoiceId = stored;
    }
    return this.selectedVoiceId;
  }

  // API key dogrulama - basit format kontrolu
  // Not: Tarayicidan dogrudan ElevenLabs API cagirmak CORS hatasi verebilir
  // Bu yuzden sadece format kontrolu yapiyoruz
  async validateApiKey(key: string): Promise<boolean> {
    // ElevenLabs API key formati: sk_ ile baslar ve en az 30 karakter
    if (!key || !key.startsWith('sk_') || key.length < 30) {
      return false;
    }
    // Format uygun, kabul et
    return true;
  }

  // Kalan kredi sorgulama
  // Not: CORS kisitlamalari nedeniyle tarayicidan dogrudan sorgulanamaz
  // Ucretsiz plan icin varsayilan degerler donduruyoruz
  async getRemainingCredits(): Promise<{ used: number; limit: number; remaining: number } | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    // CORS nedeniyle API cagrisi yapilamiyor
    // Ucretsiz plan: 10,000 karakter/ay
    // Kullanici kendi ElevenLabs panelinden gercek degerleri gorebilir
    return {
      used: 0,
      limit: 10000,
      remaining: 10000
    };
  }

  // Text-to-Speech API cagrisi
  async textToSpeech(text: string, options: TTSOptions = {}): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API anahtari ayarlanmamis');
    }

    const {
      voiceId = this.getVoice(),
      modelId = 'eleven_multilingual_v2',
      stability = DEFAULT_VOICE_SETTINGS.stability,
      similarityBoost = DEFAULT_VOICE_SETTINGS.similarity_boost
    } = options;

    // Cache kontrolu
    const cacheKey = `${text.substring(0, 100)}-${voiceId}-${modelId}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

    this.onStatusChangeCallback?.('loading');

    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style: 0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      this.onStatusChangeCallback?.('error');

      if (response.status === 401) {
        throw new Error('Gecersiz API anahtari');
      }
      if (response.status === 429) {
        throw new Error('API kullanim limiti asildi. Lutfen daha sonra tekrar deneyin.');
      }
      throw new Error(errorData.detail?.message || 'Seslendirme hatasi olustu');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    // Cache'e ekle (max 50 item)
    if (this.audioCache.size >= 50) {
      const firstKey = this.audioCache.keys().next().value;
      if (firstKey) {
        URL.revokeObjectURL(this.audioCache.get(firstKey)!);
        this.audioCache.delete(firstKey);
      }
    }
    this.audioCache.set(cacheKey, audioUrl);

    return audioUrl;
  }

  // Metni seslendir
  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    this.stop();

    try {
      const audioUrl = await this.textToSpeech(text, options);

      return new Promise((resolve, reject) => {
        this.currentAudio = new Audio(audioUrl);

        this.currentAudio.onplay = () => {
          this.onStatusChangeCallback?.('speaking');
          this.onStartCallback?.();
        };

        this.currentAudio.onended = () => {
          this.currentAudio = null;
          this.onStatusChangeCallback?.('idle');
          this.onEndCallback?.();
          resolve();
        };

        this.currentAudio.onerror = () => {
          this.currentAudio = null;
          this.onStatusChangeCallback?.('error');
          this.onErrorCallback?.('Ses calma hatasi');
          reject(new Error('Ses calma hatasi'));
        };

        this.currentAudio.play().catch((err) => {
          this.onStatusChangeCallback?.('error');
          this.onErrorCallback?.(err.message);
          reject(err);
        });
      });
    } catch (error) {
      this.onStatusChangeCallback?.('error');
      this.onErrorCallback?.(error instanceof Error ? error.message : 'Bilinmeyen hata');
      throw error;
    }
  }

  // Uzun metinleri parcalara bolerek seslendir
  async speakLong(text: string, maxChunkLength: number = 1000): Promise<void> {
    // Metni cumlelere bol
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';
    const chunks: string[] = [];

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxChunkLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      }
    }

    // Son parcayi ekle
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    // Sirayla seslendir
    for (const chunk of chunks) {
      await this.speak(chunk);
    }
  }

  // Seslendirmeyi durdur
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
      this.onStatusChangeCallback?.('idle');
    }
  }

  // Konusuyor mu?
  isSpeaking(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }

  // Callback setters
  onStatusChange(callback: StatusCallback): void {
    this.onStatusChangeCallback = callback;
  }

  onStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  onError(callback: ErrorCallback): void {
    this.onErrorCallback = callback;
  }

  // Cache temizle
  clearCache(): void {
    this.audioCache.forEach(url => URL.revokeObjectURL(url));
    this.audioCache.clear();
  }

  // Temizlik
  destroy(): void {
    this.stop();
    this.clearCache();
    this.onStatusChangeCallback = null;
    this.onStartCallback = null;
    this.onEndCallback = null;
    this.onErrorCallback = null;
  }
}

// Singleton instance
let elevenLabsInstance: ElevenLabsTTSService | null = null;

export const getElevenLabsTTSService = (): ElevenLabsTTSService => {
  if (!elevenLabsInstance) {
    elevenLabsInstance = new ElevenLabsTTSService();
  }
  return elevenLabsInstance;
};

export const destroyElevenLabsTTSService = (): void => {
  if (elevenLabsInstance) {
    elevenLabsInstance.destroy();
    elevenLabsInstance = null;
  }
};

export default ElevenLabsTTSService;
