// Speech Recognition Service - Web Speech API ile Ses Tanıma
import {
  SpeechRecognitionConfig,
  SpeechRecognitionStatus,
  SpeechRecognitionError,
  DEFAULT_SPEECH_RECOGNITION_CONFIG
} from '../../types/voice';

export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private config: SpeechRecognitionConfig;
  private status: SpeechRecognitionStatus = 'idle';
  private onResultCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onErrorCallback: ((error: SpeechRecognitionError) => void) | null = null;
  private onStatusChangeCallback: ((status: SpeechRecognitionStatus) => void) | null = null;
  private onEndCallback: (() => void) | null = null;

  constructor(config: Partial<SpeechRecognitionConfig> = {}) {
    this.config = { ...DEFAULT_SPEECH_RECOGNITION_CONFIG, ...config };
    this.initializeRecognition();
  }

  // Tarayıcı desteğini kontrol et
  public static isSupported(): boolean {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  // Recognition nesnesini başlat
  private initializeRecognition(): void {
    if (!SpeechRecognitionService.isSupported()) {
      console.warn('Web Speech API bu tarayıcıda desteklenmiyor');
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionAPI();

    // Konfigürasyon
    this.recognition.lang = this.config.language;
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.maxAlternatives = this.config.maxAlternatives;

    // Event handlers
    this.recognition.onstart = () => {
      this.setStatus('listening');
      console.log('Ses tanıma başladı');
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += transcript;
          this.onResultCallback?.(transcript, true);
        } else {
          interimTranscript += transcript;
          this.onResultCallback?.(transcript, false);
        }
      }

      console.log('Transcript:', { final: finalTranscript, interim: interimTranscript });
    };

    this.recognition.onerror = (event) => {
      console.error('Ses tanıma hatası:', event.error);
      this.setStatus('error');

      const error: SpeechRecognitionError = {
        code: event.error,
        message: this.getErrorMessage(event.error)
      };

      this.onErrorCallback?.(error);
    };

    this.recognition.onend = () => {
      console.log('Ses tanıma sona erdi');
      if (this.status !== 'error') {
        this.setStatus('idle');
      }
      this.onEndCallback?.();
    };

    this.recognition.onspeechend = () => {
      console.log('Konuşma algılaması sona erdi');
    };

    this.recognition.onnomatch = () => {
      console.log('Ses tanınamadı');
    };
  }

  // Dinlemeyi başlat
  public start(): void {
    if (!this.recognition) {
      console.error('Speech Recognition başlatılamadı');
      return;
    }

    if (this.status === 'listening') {
      console.warn('Zaten dinleniyor');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error('Ses tanıma başlatma hatası:', error);
      // Muhtemelen zaten çalışıyor, durdur ve yeniden başlat
      this.recognition.stop();
      setTimeout(() => {
        this.recognition?.start();
      }, 100);
    }
  }

  // Dinlemeyi durdur
  public stop(): void {
    if (!this.recognition) return;

    try {
      this.recognition.stop();
    } catch (error) {
      console.error('Ses tanıma durdurma hatası:', error);
    }
  }

  // Dinlemeyi iptal et (sonuç beklemeden)
  public abort(): void {
    if (!this.recognition) return;

    try {
      this.recognition.abort();
      this.setStatus('idle');
    } catch (error) {
      console.error('Ses tanıma iptal hatası:', error);
    }
  }

  // Status getter
  public getStatus(): SpeechRecognitionStatus {
    return this.status;
  }

  // Status setter (internal)
  private setStatus(status: SpeechRecognitionStatus): void {
    this.status = status;
    this.onStatusChangeCallback?.(status);
  }

  // Callback setters
  public onResult(callback: (text: string, isFinal: boolean) => void): void {
    this.onResultCallback = callback;
  }

  public onError(callback: (error: SpeechRecognitionError) => void): void {
    this.onErrorCallback = callback;
  }

  public onStatusChange(callback: (status: SpeechRecognitionStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }

  public onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  // Dil değiştir
  public setLanguage(language: string): void {
    this.config.language = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  // Hata mesajı çevirisi
  private getErrorMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      'no-speech': 'Ses algılanamadı. Lütfen tekrar deneyin.',
      'aborted': 'Ses tanıma iptal edildi.',
      'audio-capture': 'Mikrofon erişimi sağlanamadı.',
      'network': 'Ağ hatası. İnternet bağlantınızı kontrol edin.',
      'not-allowed': 'Mikrofon izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.',
      'service-not-allowed': 'Ses tanıma servisi kullanılamıyor.',
      'bad-grammar': 'Dil bilgisi hatası.',
      'language-not-supported': 'Bu dil desteklenmiyor.'
    };

    return messages[errorCode] || `Bilinmeyen hata: ${errorCode}`;
  }

  // Mikrofon izni kontrol et
  public static async checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return result.state as 'granted' | 'denied' | 'prompt';
    } catch {
      // Eski tarayıcılar için fallback
      return 'prompt';
    }
  }

  // Mikrofon izni iste
  public static async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // İzin verildiyse stream'i kapat
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Mikrofon izni alınamadı:', error);
      return false;
    }
  }

  // Temizlik
  public destroy(): void {
    this.abort();
    this.recognition = null;
    this.onResultCallback = null;
    this.onErrorCallback = null;
    this.onStatusChangeCallback = null;
    this.onEndCallback = null;
  }
}

// Singleton instance
let speechRecognitionInstance: SpeechRecognitionService | null = null;

export const getSpeechRecognitionService = (config?: Partial<SpeechRecognitionConfig>): SpeechRecognitionService => {
  if (!speechRecognitionInstance) {
    speechRecognitionInstance = new SpeechRecognitionService(config);
  }
  return speechRecognitionInstance;
};

export const destroySpeechRecognitionService = (): void => {
  if (speechRecognitionInstance) {
    speechRecognitionInstance.destroy();
    speechRecognitionInstance = null;
  }
};
