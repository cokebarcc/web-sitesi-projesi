// Voice Chat Type Definitions

// ==================== Speech Recognition Types ====================

export interface SpeechRecognitionConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

export interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export type SpeechRecognitionStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'error';

export interface SpeechRecognitionError {
  code: string;
  message: string;
}

// ==================== Speech Synthesis Types ====================

export interface SpeechSynthesisConfig {
  voice: string | null;
  rate: number;  // 0.1 - 10
  pitch: number; // 0 - 2
  volume: number; // 0 - 1
  language: string;
}

export type SpeechSynthesisStatus =
  | 'idle'
  | 'speaking'
  | 'paused'
  | 'error';

export interface VoiceOption {
  name: string;
  lang: string;
  default: boolean;
  localService: boolean;
  voiceURI: string;
}

// ==================== Voice Chat Types ====================

export type VoiceChatMode = 'push-to-talk' | 'voice-activity-detection';

export type VoiceChatStatus =
  | 'idle'           // Beklemede
  | 'listening'      // Kullanıcıyı dinliyor
  | 'processing'     // AI yanıt hazırlıyor
  | 'speaking'       // AI konuşuyor
  | 'error';         // Hata durumu

export interface VoiceChatState {
  status: VoiceChatStatus;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  mode: VoiceChatMode;
  isMuted: boolean;
  volume: number;
}

export interface VoiceChatCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onSpeakStart: () => void;
  onSpeakEnd: () => void;
  onError: (error: string) => void;
  onStatusChange: (status: VoiceChatStatus) => void;
}

// ==================== Audio Visualizer Types ====================

export interface AudioVisualizerConfig {
  fftSize: number;
  smoothingTimeConstant: number;
  minDecibels: number;
  maxDecibels: number;
}

export interface AudioLevel {
  volume: number;      // 0-1 arası ses seviyesi
  frequency: number[];  // Frekans verileri (visualizer için)
  isSpeaking: boolean; // Ses algılandı mı
}

// ==================== Browser API Type Declarations ====================

// Web Speech API için TypeScript declarations
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }

  class SpeechRecognition extends EventTarget {
    continuous: boolean;
    grammars: SpeechGrammarList;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;

    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null;

    abort(): void;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: SpeechRecognitionErrorCode;
    message: string;
  }

  type SpeechRecognitionErrorCode =
    | 'no-speech'
    | 'aborted'
    | 'audio-capture'
    | 'network'
    | 'not-allowed'
    | 'service-not-allowed'
    | 'bad-grammar'
    | 'language-not-supported';

  interface SpeechRecognitionEvent extends Event {
    resultIndex: number;
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    isFinal: boolean;
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
  }

  interface SpeechGrammarList {
    length: number;
    item(index: number): SpeechGrammar;
    addFromString(string: string, weight?: number): void;
    addFromURI(src: string, weight?: number): void;
    [index: number]: SpeechGrammar;
  }

  interface SpeechGrammar {
    src: string;
    weight: number;
  }
}

// ==================== Default Values ====================

export const DEFAULT_SPEECH_RECOGNITION_CONFIG: SpeechRecognitionConfig = {
  language: 'tr-TR',
  continuous: false,
  interimResults: true,
  maxAlternatives: 1
};

export const DEFAULT_SPEECH_SYNTHESIS_CONFIG: SpeechSynthesisConfig = {
  voice: null,
  rate: 0.9,  // Biraz yavaş - daha doğal
  pitch: 1.0,
  volume: 1.0,
  language: 'tr-TR'
};

export const DEFAULT_VOICE_CHAT_STATE: VoiceChatState = {
  status: 'idle',
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  transcript: '',
  interimTranscript: '',
  error: null,
  mode: 'push-to-talk',
  isMuted: false,
  volume: 1.0
};

export const DEFAULT_AUDIO_VISUALIZER_CONFIG: AudioVisualizerConfig = {
  fftSize: 256,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10
};
