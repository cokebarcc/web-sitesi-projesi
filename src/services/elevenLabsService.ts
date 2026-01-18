// ElevenLabs Text-to-Speech Service
// Doğal Türkçe seslendirme için

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Türkçe için önerilen sesler
export const TURKISH_VOICES = {
  // Multilingual v2 (Türkçe desteği en iyi)
  ARIA: '9BWtsMINqrJLrRacOk9x', // Aria - Multilingual kadın
  ROGER: 'CwhRBWXzGAHq8TQ4Fs17', // Roger - Multilingual erkek
  // Diğer sesler
  ADAM: '21m00Tcm4TlvDq8ikWAM', // Adam - Doğal erkek ses
  DOMI: 'AZnzlk1XvdvUeBnXmlld', // Domi - Genç kadın ses
};

// Varsayılan ses ayarları
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

class ElevenLabsService {
  private apiKey: string | null = null;
  private audioCache: Map<string, string> = new Map();
  private currentAudio: HTMLAudioElement | null = null;

  setApiKey(key: string) {
    this.apiKey = key;
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

  saveApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('elevenlabs_api_key', key);
  }

  clearApiKey() {
    this.apiKey = null;
    localStorage.removeItem('elevenlabs_api_key');
  }

  async textToSpeech(text: string, options: TTSOptions = {}): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('ElevenLabs API anahtarı ayarlanmamış');
    }

    const {
      voiceId = TURKISH_VOICES.ARIA,
      modelId = 'eleven_multilingual_v2',
      stability = DEFAULT_VOICE_SETTINGS.stability,
      similarityBoost = DEFAULT_VOICE_SETTINGS.similarity_boost
    } = options;

    // Cache kontrolü
    const cacheKey = `${text}-${voiceId}-${modelId}`;
    if (this.audioCache.has(cacheKey)) {
      return this.audioCache.get(cacheKey)!;
    }

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
      if (response.status === 401) {
        throw new Error('Geçersiz API anahtarı');
      }
      if (response.status === 429) {
        throw new Error('API kullanım limiti aşıldı. Lütfen daha sonra tekrar deneyin.');
      }
      throw new Error(errorData.detail?.message || 'Seslendirme hatası oluştu');
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    this.audioCache.set(cacheKey, audioUrl);

    return audioUrl;
  }

  async speak(text: string, options: TTSOptions = {}): Promise<void> {
    this.stop();

    const audioUrl = await this.textToSpeech(text, options);

    return new Promise((resolve, reject) => {
      this.currentAudio = new Audio(audioUrl);

      this.currentAudio.onended = () => {
        this.currentAudio = null;
        resolve();
      };

      this.currentAudio.onerror = () => {
        this.currentAudio = null;
        reject(new Error('Ses çalma hatası'));
      };

      this.currentAudio.play().catch(reject);
    });
  }

  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  isPlaying(): boolean {
    return this.currentAudio !== null && !this.currentAudio.paused;
  }

  async validateApiKey(key: string): Promise<boolean> {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/user`, {
        headers: { 'xi-api-key': key }
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async getRemainingCredits(): Promise<{ character_count: number; character_limit: number } | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/user/subscription`, {
        headers: { 'xi-api-key': apiKey }
      });

      if (!response.ok) return null;

      const data = await response.json();
      return {
        character_count: data.character_count || 0,
        character_limit: data.character_limit || 0
      };
    } catch {
      return null;
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
export default elevenLabsService;
