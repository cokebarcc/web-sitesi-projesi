// Speech Synthesis Service - Web Speech API ile Ses Sentezi
import {
  SpeechSynthesisConfig,
  SpeechSynthesisStatus,
  VoiceOption,
  DEFAULT_SPEECH_SYNTHESIS_CONFIG
} from '../../types/voice';

export class SpeechSynthesisService {
  private synth: SpeechSynthesis;
  private config: SpeechSynthesisConfig;
  private status: SpeechSynthesisStatus = 'idle';
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  private onStartCallback: (() => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private onErrorCallback: ((error: string) => void) | null = null;
  private onStatusChangeCallback: ((status: SpeechSynthesisStatus) => void) | null = null;
  private onWordBoundaryCallback: ((word: string, charIndex: number) => void) | null = null;

  constructor(config: Partial<SpeechSynthesisConfig> = {}) {
    this.synth = window.speechSynthesis;
    this.config = { ...DEFAULT_SPEECH_SYNTHESIS_CONFIG, ...config };
    this.loadVoices();
  }

  // Tarayıcı desteğini kontrol et
  public static isSupported(): boolean {
    return 'speechSynthesis' in window;
  }

  // Sesleri yükle
  private loadVoices(): void {
    const loadVoiceList = () => {
      this.availableVoices = this.synth.getVoices();
      console.log(`${this.availableVoices.length} ses yüklendi`);

      // Türkçe ses bul
      this.selectTurkishVoice();
    };

    // Chrome'da voiceschanged event'i gerekli
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoiceList;
    }

    // Hemen de yüklemeyi dene
    loadVoiceList();
  }

  // Türkçe sesi seç
  private selectTurkishVoice(): void {
    // Öncelik sırası: tr-TR > tr > Türkçe içeren herhangi bir ses
    const turkishVoices = this.availableVoices.filter(
      voice => voice.lang.startsWith('tr')
    );

    if (turkishVoices.length > 0) {
      // Google veya Microsoft sesleri tercih et (daha doğal)
      const preferredVoice = turkishVoices.find(
        voice =>
          voice.name.toLowerCase().includes('google') ||
          voice.name.toLowerCase().includes('microsoft')
      );

      this.selectedVoice = preferredVoice || turkishVoices[0];
      console.log('Seçilen Türkçe ses:', this.selectedVoice.name);
    } else {
      console.warn('Türkçe ses bulunamadı, varsayılan ses kullanılacak');
      // Varsayılan sesi kullan
      if (this.availableVoices.length > 0) {
        this.selectedVoice = this.availableVoices[0];
      }
    }
  }

  // Mevcut sesleri listele
  public getAvailableVoices(): VoiceOption[] {
    return this.availableVoices.map(voice => ({
      name: voice.name,
      lang: voice.lang,
      default: voice.default,
      localService: voice.localService,
      voiceURI: voice.voiceURI
    }));
  }

  // Türkçe sesleri listele
  public getTurkishVoices(): VoiceOption[] {
    return this.getAvailableVoices().filter(voice => voice.lang.startsWith('tr'));
  }

  // Ses seç
  public setVoice(voiceURI: string): boolean {
    const voice = this.availableVoices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      this.selectedVoice = voice;
      console.log('Ses değiştirildi:', voice.name);
      return true;
    }
    return false;
  }

  // Metni seslendir
  public speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!text.trim()) {
        resolve();
        return;
      }

      // Önceki seslendirmeyi durdur
      this.stop();

      // Utterance oluştur
      const utterance = new SpeechSynthesisUtterance(text);

      // Konfigürasyon
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.lang = this.config.language;
      utterance.rate = this.config.rate;
      utterance.pitch = this.config.pitch;
      utterance.volume = this.config.volume;

      this.currentUtterance = utterance;

      // Event handlers
      utterance.onstart = () => {
        this.setStatus('speaking');
        this.onStartCallback?.();
      };

      utterance.onend = () => {
        this.setStatus('idle');
        this.currentUtterance = null;
        this.onEndCallback?.();
        resolve();
      };

      utterance.onerror = (event) => {
        // 'interrupted' hatası normal durdurma durumunda oluşabilir
        if (event.error !== 'interrupted') {
          console.error('Ses sentezi hatası:', event.error);
          this.setStatus('error');
          this.onErrorCallback?.(event.error);
          reject(new Error(event.error));
        } else {
          this.setStatus('idle');
          resolve();
        }
        this.currentUtterance = null;
      };

      utterance.onpause = () => {
        this.setStatus('paused');
      };

      utterance.onresume = () => {
        this.setStatus('speaking');
      };

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const word = text.substring(event.charIndex, event.charIndex + (event.charLength || 0));
          this.onWordBoundaryCallback?.(word, event.charIndex);
        }
      };

      // Seslendirmeyi başlat
      this.synth.speak(utterance);
    });
  }

  // Uzun metinleri parçalara bölerek seslendir
  public async speakLong(text: string, maxChunkLength: number = 200): Promise<void> {
    // Metni cümlelere böl
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    let currentChunk = '';

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxChunkLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) {
          await this.speak(currentChunk.trim());
        }
        currentChunk = sentence;
      }
    }

    // Son parçayı seslendir
    if (currentChunk.trim()) {
      await this.speak(currentChunk.trim());
    }
  }

  // Seslendirmeyi durdur
  public stop(): void {
    if (this.synth.speaking || this.synth.pending) {
      this.synth.cancel();
      this.setStatus('idle');
      this.currentUtterance = null;
    }
  }

  // Seslendirmeyi duraklat
  public pause(): void {
    if (this.synth.speaking && !this.synth.paused) {
      this.synth.pause();
      this.setStatus('paused');
    }
  }

  // Seslendirmeyi devam ettir
  public resume(): void {
    if (this.synth.paused) {
      this.synth.resume();
      this.setStatus('speaking');
    }
  }

  // Status getter
  public getStatus(): SpeechSynthesisStatus {
    return this.status;
  }

  // Konuşuyor mu?
  public isSpeaking(): boolean {
    return this.synth.speaking;
  }

  // Duraklatılmış mı?
  public isPaused(): boolean {
    return this.synth.paused;
  }

  // Bekleyen var mı?
  public isPending(): boolean {
    return this.synth.pending;
  }

  // Status setter (internal)
  private setStatus(status: SpeechSynthesisStatus): void {
    this.status = status;
    this.onStatusChangeCallback?.(status);
  }

  // Callback setters
  public onStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  public onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  public onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  public onStatusChange(callback: (status: SpeechSynthesisStatus) => void): void {
    this.onStatusChangeCallback = callback;
  }

  public onWordBoundary(callback: (word: string, charIndex: number) => void): void {
    this.onWordBoundaryCallback = callback;
  }

  // Hız ayarla (0.1 - 10)
  public setRate(rate: number): void {
    this.config.rate = Math.max(0.1, Math.min(10, rate));
  }

  // Ses tonu ayarla (0 - 2)
  public setPitch(pitch: number): void {
    this.config.pitch = Math.max(0, Math.min(2, pitch));
  }

  // Ses seviyesi ayarla (0 - 1)
  public setVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));
  }

  // Temizlik
  public destroy(): void {
    this.stop();
    this.onStartCallback = null;
    this.onEndCallback = null;
    this.onErrorCallback = null;
    this.onStatusChangeCallback = null;
    this.onWordBoundaryCallback = null;
  }
}

// Singleton instance
let speechSynthesisInstance: SpeechSynthesisService | null = null;

export const getSpeechSynthesisService = (config?: Partial<SpeechSynthesisConfig>): SpeechSynthesisService => {
  if (!speechSynthesisInstance) {
    speechSynthesisInstance = new SpeechSynthesisService(config);
  }
  return speechSynthesisInstance;
};

export const destroySpeechSynthesisService = (): void => {
  if (speechSynthesisInstance) {
    speechSynthesisInstance.destroy();
    speechSynthesisInstance = null;
  }
};
