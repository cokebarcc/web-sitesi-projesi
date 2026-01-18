// Voice Chat Manager - STT + TTS + AI Entegrasyonu
// ElevenLabs ve Web Speech API destegi
import {
  VoiceChatState,
  VoiceChatStatus,
  VoiceChatMode,
  VoiceChatCallbacks,
  DEFAULT_VOICE_CHAT_STATE
} from '../../types/voice';
import { SpeechRecognitionService, getSpeechRecognitionService } from './speechRecognition';
import { SpeechSynthesisService, getSpeechSynthesisService } from './speechSynthesis';
import { getElevenLabsTTSService, VOICE_OPTIONS } from './elevenLabsTTS';

export type TTSProvider = 'browser' | 'elevenlabs';

export class VoiceChatManager {
  private stt: SpeechRecognitionService;
  private tts: SpeechSynthesisService;
  private elevenLabsTTS = getElevenLabsTTSService();
  private ttsProvider: TTSProvider = 'browser';
  private state: VoiceChatState;
  private callbacks: Partial<VoiceChatCallbacks> = {};

  // AI mesaj gönderme callback'i (dışarıdan set edilecek)
  private onSendMessage: ((text: string) => Promise<string>) | null = null;

  constructor() {
    this.state = { ...DEFAULT_VOICE_CHAT_STATE };
    this.stt = getSpeechRecognitionService();
    this.tts = getSpeechSynthesisService();

    // ElevenLabs API key varsa onu kullan
    if (this.elevenLabsTTS.hasApiKey()) {
      this.ttsProvider = 'elevenlabs';
    }

    this.setupCallbacks();
  }

  // Callback'leri ayarla
  private setupCallbacks(): void {
    // STT sonuç callback'i
    this.stt.onResult((text, isFinal) => {
      if (isFinal) {
        this.state.transcript = text;
        this.state.interimTranscript = '';
        this.callbacks.onTranscript?.(text, true);
      } else {
        this.state.interimTranscript = text;
        this.callbacks.onTranscript?.(text, false);
      }
    });

    // STT hata callback'i
    this.stt.onError((error) => {
      this.state.error = error.message;
      this.setStatus('error');
      this.callbacks.onError?.(error.message);
    });

    // STT bitiş callback'i
    this.stt.onEnd(() => {
      this.state.isListening = false;

      // Eğer transcript varsa AI'ya gönder
      if (this.state.transcript && this.state.status !== 'error') {
        this.processTranscript(this.state.transcript);
      }
    });

    // TTS başlangıç callback'i
    this.tts.onStart(() => {
      this.state.isSpeaking = true;
      this.setStatus('speaking');
      this.callbacks.onSpeakStart?.();
    });

    // TTS bitiş callback'i
    this.tts.onEnd(() => {
      this.state.isSpeaking = false;
      if (this.state.status === 'speaking') {
        this.setStatus('idle');
      }
      this.callbacks.onSpeakEnd?.();
    });

    // TTS hata callback'i
    this.tts.onError((error) => {
      this.state.isSpeaking = false;
      this.state.error = error;
      this.setStatus('error');
      this.callbacks.onError?.(error);
    });
  }

  // Transcript'i işle ve AI'ya gönder
  private async processTranscript(text: string): Promise<void> {
    if (!this.onSendMessage) {
      console.warn('onSendMessage callback set edilmedi');
      return;
    }

    this.setStatus('processing');
    this.state.isProcessing = true;

    try {
      const response = await this.onSendMessage(text);
      this.state.isProcessing = false;

      // AI yanıtını seslendir
      if (response && !this.state.isMuted) {
        await this.speak(response);
      } else {
        this.setStatus('idle');
      }
    } catch (error) {
      this.state.isProcessing = false;
      this.state.error = error instanceof Error ? error.message : 'AI yanıt hatası';
      this.setStatus('error');
      this.callbacks.onError?.(this.state.error);
    }
  }

  // Dinlemeyi başlat
  public startListening(): void {
    if (!SpeechRecognitionService.isSupported()) {
      this.state.error = 'Ses tanıma bu tarayıcıda desteklenmiyor';
      this.callbacks.onError?.(this.state.error);
      return;
    }

    // Eğer AI konuşuyorsa durdur
    if (this.state.isSpeaking) {
      this.stopSpeaking();
    }

    this.state.transcript = '';
    this.state.interimTranscript = '';
    this.state.error = null;
    this.state.isListening = true;
    this.setStatus('listening');

    this.stt.start();
  }

  // Dinlemeyi durdur
  public stopListening(): void {
    this.state.isListening = false;
    this.stt.stop();
  }

  // Dinlemeyi iptal et
  public cancelListening(): void {
    this.state.isListening = false;
    this.state.transcript = '';
    this.state.interimTranscript = '';
    this.stt.abort();
    this.setStatus('idle');
  }

  // Metni seslendir
  public async speak(text: string): Promise<void> {
    if (this.state.isMuted) {
      console.log('Ses kapali, seslendirme atlaniyor');
      return;
    }

    // ElevenLabs kullan
    if (this.ttsProvider === 'elevenlabs' && this.elevenLabsTTS.hasApiKey()) {
      try {
        this.state.isSpeaking = true;
        this.setStatus('speaking');
        this.callbacks.onSpeakStart?.();

        await this.elevenLabsTTS.speakLong(text);

        this.state.isSpeaking = false;
        this.setStatus('idle');
        this.callbacks.onSpeakEnd?.();
      } catch (error) {
        console.error('ElevenLabs TTS hatasi:', error);
        this.state.isSpeaking = false;
        this.state.error = error instanceof Error ? error.message : 'TTS hatasi';
        this.setStatus('error');
        this.callbacks.onError?.(this.state.error);
      }
      return;
    }

    // Browser TTS kullan (fallback)
    if (!SpeechSynthesisService.isSupported()) {
      console.warn('Ses sentezi bu tarayicida desteklenmiyor');
      return;
    }

    await this.tts.speakLong(text);
  }

  // Konusmay\u0131 durdur
  public stopSpeaking(): void {
    if (this.ttsProvider === 'elevenlabs') {
      this.elevenLabsTTS.stop();
    } else {
      this.tts.stop();
    }
    this.state.isSpeaking = false;
  }

  // TTS provider ayarla
  public setTTSProvider(provider: TTSProvider): void {
    this.ttsProvider = provider;
    localStorage.setItem('tts_provider', provider);
  }

  // TTS provider al
  public getTTSProvider(): TTSProvider {
    const stored = localStorage.getItem('tts_provider') as TTSProvider;
    if (stored) {
      this.ttsProvider = stored;
    }
    return this.ttsProvider;
  }

  // ElevenLabs API key ayarla
  public setElevenLabsApiKey(key: string): void {
    this.elevenLabsTTS.setApiKey(key);
    this.ttsProvider = 'elevenlabs';
    localStorage.setItem('tts_provider', 'elevenlabs');
  }

  // ElevenLabs API key var mi?
  public hasElevenLabsApiKey(): boolean {
    return this.elevenLabsTTS.hasApiKey();
  }

  // ElevenLabs API key dogrula
  public async validateElevenLabsApiKey(key: string): Promise<boolean> {
    return this.elevenLabsTTS.validateApiKey(key);
  }

  // ElevenLabs API key temizle
  public clearElevenLabsApiKey(): void {
    this.elevenLabsTTS.clearApiKey();
    this.ttsProvider = 'browser';
    localStorage.setItem('tts_provider', 'browser');
  }

  // ElevenLabs ses secimi
  public setElevenLabsVoice(voiceId: string): void {
    this.elevenLabsTTS.setVoice(voiceId);
  }

  // ElevenLabs ses listesi
  public getElevenLabsVoices() {
    return VOICE_OPTIONS;
  }

  // ElevenLabs kalan kredi
  public async getElevenLabsCredits() {
    return this.elevenLabsTTS.getRemainingCredits();
  }

  // Konuşmayı duraklat
  public pauseSpeaking(): void {
    this.tts.pause();
  }

  // Konuşmaya devam et
  public resumeSpeaking(): void {
    this.tts.resume();
  }

  // Modu değiştir
  public setMode(mode: VoiceChatMode): void {
    this.state.mode = mode;
  }

  // Sesi aç/kapa
  public toggleMute(): void {
    this.state.isMuted = !this.state.isMuted;
    if (this.state.isMuted && this.state.isSpeaking) {
      this.stopSpeaking();
    }
  }

  // Sesi kapat
  public mute(): void {
    this.state.isMuted = true;
    if (this.state.isSpeaking) {
      this.stopSpeaking();
    }
  }

  // Sesi aç
  public unmute(): void {
    this.state.isMuted = false;
  }

  // Ses seviyesi ayarla
  public setVolume(volume: number): void {
    this.state.volume = Math.max(0, Math.min(1, volume));
    this.tts.setVolume(this.state.volume);
  }

  // Konuşma hızı ayarla
  public setSpeechRate(rate: number): void {
    this.tts.setRate(rate);
  }

  // Status setter
  private setStatus(status: VoiceChatStatus): void {
    this.state.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  // State getter
  public getState(): VoiceChatState {
    return { ...this.state };
  }

  // AI mesaj gönderme callback'ini set et
  public setMessageHandler(handler: (text: string) => Promise<string>): void {
    this.onSendMessage = handler;
  }

  // Callback setters
  public setCallbacks(callbacks: Partial<VoiceChatCallbacks>): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public onTranscript(callback: (text: string, isFinal: boolean) => void): void {
    this.callbacks.onTranscript = callback;
  }

  public onSpeakStart(callback: () => void): void {
    this.callbacks.onSpeakStart = callback;
  }

  public onSpeakEnd(callback: () => void): void {
    this.callbacks.onSpeakEnd = callback;
  }

  public onError(callback: (error: string) => void): void {
    this.callbacks.onError = callback;
  }

  public onStatusChange(callback: (status: VoiceChatStatus) => void): void {
    this.callbacks.onStatusChange = callback;
  }

  // Mevcut sesleri al
  public getAvailableVoices() {
    return this.tts.getAvailableVoices();
  }

  // Türkçe sesleri al
  public getTurkishVoices() {
    return this.tts.getTurkishVoices();
  }

  // Ses seç
  public setVoice(voiceURI: string): boolean {
    return this.tts.setVoice(voiceURI);
  }

  // Browser desteği kontrol et
  public static checkSupport(): { stt: boolean; tts: boolean } {
    return {
      stt: SpeechRecognitionService.isSupported(),
      tts: SpeechSynthesisService.isSupported()
    };
  }

  // Mikrofon izni kontrol et
  public static async checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
    return SpeechRecognitionService.checkMicrophonePermission();
  }

  // Mikrofon izni iste
  public static async requestMicrophonePermission(): Promise<boolean> {
    return SpeechRecognitionService.requestMicrophonePermission();
  }

  // Her şeyi durdur
  public stop(): void {
    this.cancelListening();
    this.stopSpeaking();
    this.state = { ...DEFAULT_VOICE_CHAT_STATE };
  }

  // Temizlik
  public destroy(): void {
    this.stop();
    this.callbacks = {};
    this.onSendMessage = null;
  }
}

// Singleton instance
let voiceChatInstance: VoiceChatManager | null = null;

export const getVoiceChatManager = (): VoiceChatManager => {
  if (!voiceChatInstance) {
    voiceChatInstance = new VoiceChatManager();
  }
  return voiceChatInstance;
};

export const destroyVoiceChatManager = (): void => {
  if (voiceChatInstance) {
    voiceChatInstance.destroy();
    voiceChatInstance = null;
  }
};
