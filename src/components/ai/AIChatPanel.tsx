// AIChatPanel - Ana Chat UI Komponenti (Claude + Voice)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AIMessage, AIChatState, QUICK_COMMANDS, AIQuickCommand } from '../../types/ai';
import { VoiceChatState, VoiceChatStatus } from '../../types/voice';
import {
  initializeClaude,
  sendMessageStream,
  hasApiKey,
  setApiKey
} from '../../services/ai/claudeGateway';
import {
  createChat,
  addMessage,
  getChatMessages,
  getUserChats,
  generateChatTitle,
  archiveChat
} from '../../services/ai/aiChatService';
import { getVoiceChatManager, VoiceChatManager } from '../../services/voice';
import AIChatMessage from './AIChatMessage';
import AIChatInput from './AIChatInput';
import AIQuickCommands from './AIQuickCommands';
import VoiceChatButton from './VoiceChatButton';
import AudioVisualizer, { AudioVisualizerCompact } from './AudioVisualizer';

interface AIChatPanelProps {
  userId: string;
  hospitalId: string;
  currentView?: string;
  selectedFilters?: {
    hospital?: string;
    years?: number[];
    months?: number[];
    branch?: string;
  };
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({
  userId,
  hospitalId,
  currentView,
  selectedFilters
}) => {
  // State
  const [chatState, setChatState] = useState<AIChatState>({
    chatId: null,
    messages: [],
    isLoading: false,
    isTyping: false,
    error: null,
    suggestions: []
  });

  const [voiceState, setVoiceState] = useState<VoiceChatState>({
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
  });

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ id: string; title: string; updatedAt: Date }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [voiceSupport, setVoiceSupport] = useState({ stt: false, tts: false });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const voiceChatRef = useRef<VoiceChatManager | null>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatState.messages, streamingText, scrollToBottom]);

  // Voice Chat Manager setup
  useEffect(() => {
    // Browser desteği kontrol et
    const support = VoiceChatManager.checkSupport();
    setVoiceSupport(support);

    if (support.stt || support.tts) {
      voiceChatRef.current = getVoiceChatManager();

      // Callbacks ayarla
      voiceChatRef.current.setCallbacks({
        onTranscript: (text, isFinal) => {
          setVoiceState(prev => ({
            ...prev,
            transcript: isFinal ? text : prev.transcript,
            interimTranscript: isFinal ? '' : text
          }));
        },
        onSpeakStart: () => {
          setVoiceState(prev => ({
            ...prev,
            isSpeaking: true,
            status: 'speaking'
          }));
        },
        onSpeakEnd: () => {
          setVoiceState(prev => ({
            ...prev,
            isSpeaking: false,
            status: 'idle'
          }));
        },
        onError: (error) => {
          setVoiceState(prev => ({
            ...prev,
            error,
            status: 'error'
          }));
        },
        onStatusChange: (status) => {
          setVoiceState(prev => ({
            ...prev,
            status,
            isListening: status === 'listening',
            isSpeaking: status === 'speaking',
            isProcessing: status === 'processing'
          }));
        }
      });

      // AI mesaj gönderme handler'ı
      voiceChatRef.current.setMessageHandler(async (text) => {
        // Mesajı gönder ve yanıtı al
        const response = await handleSendMessageInternal(text, true);
        return response;
      });
    }

    return () => {
      if (voiceChatRef.current) {
        voiceChatRef.current.destroy();
      }
    };
  }, []);

  // API Key kontrolü
  useEffect(() => {
    const checkConnection = async () => {
      if (hasApiKey()) {
        try {
          initializeClaude();
          setIsConnected(true);
        } catch {
          setIsConnected(false);
          setShowApiKeyModal(true);
        }
      } else {
        setShowApiKeyModal(true);
      }
    };

    checkConnection();
  }, []);

  // Chat history yükle
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const chats = await getUserChats(userId, hospitalId, 10);
        setChatHistory(chats.map(c => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt
        })));
      } catch (error) {
        console.error('Chat geçmişi yüklenemedi:', error);
      }
    };

    if (userId && hospitalId) {
      loadHistory();
    }
  }, [userId, hospitalId]);

  // API Key kaydet
  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;

    try {
      setApiKey(apiKeyInput.trim());
      initializeClaude();
      setIsConnected(true);
      setShowApiKeyModal(false);
      setApiKeyInput('');
      setChatState(prev => ({ ...prev, error: null }));
    } catch (error) {
      setChatState(prev => ({
        ...prev,
        error: 'API key kaydedilemedi.'
      }));
    }
  };

  // Internal mesaj gönderme (voice için de kullanılacak)
  const handleSendMessageInternal = async (message: string, isVoice: boolean = false): Promise<string> => {
    if (!message.trim() || chatState.isLoading) return '';

    // Kullanıcı mesajını ekle
    const userMessage: AIMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      isTyping: true,
      error: null
    }));

    try {
      // Chat ID yoksa oluştur
      let chatId = chatState.chatId;
      if (!chatId) {
        try {
          chatId = await createChat(userId, hospitalId, generateChatTitle(message));
          setChatState(prev => ({ ...prev, chatId }));
        } catch (e) {
          console.warn('Chat oluşturulamadı (Firestore):', e);
          chatId = `local-${Date.now()}`;
        }
      }

      // Firestore'a kullanıcı mesajını kaydet
      try {
        if (!chatId.startsWith('local-')) {
          await addMessage(chatId, {
            role: 'user',
            content: message,
            timestamp: new Date()
          });
        }
      } catch (e) {
        console.warn('Mesaj kaydedilemedi (Firestore):', e);
      }

      // Claude'a gönder (streaming)
      setStreamingText('');

      const response = await sendMessageStream(
        message,
        chatState.messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        (chunk) => {
          setStreamingText(prev => prev + chunk);
        },
        {
          hospitalId,
          currentView,
          selectedFilters
        }
      );

      // Assistant mesajını ekle
      const assistantMessage: AIMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        toolCalls: response.toolResults?.map(tr => ({
          name: tr.toolName,
          arguments: {},
          result: tr.data,
          status: tr.success ? 'success' : 'error',
          error: tr.error
        }))
      };

      // Firestore'a kaydet
      try {
        if (!chatId.startsWith('local-')) {
          await addMessage(chatId, {
            role: 'assistant',
            content: response.response,
            timestamp: new Date(),
            toolCalls: assistantMessage.toolCalls
          });
        }
      } catch (e) {
        console.warn('Assistant mesajı kaydedilemedi (Firestore):', e);
      }

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
        isLoading: false,
        isTyping: false,
        suggestions: response.suggestions || []
      }));

      setStreamingText('');

      return response.response;

    } catch (error) {
      console.error('Mesaj gönderme hatası:', error);
      setChatState(prev => ({
        ...prev,
        isLoading: false,
        isTyping: false,
        error: error instanceof Error ? error.message : 'Mesaj gönderilemedi'
      }));
      setStreamingText('');
      return '';
    }
  };

  // Public mesaj gönderme
  const handleSendMessage = async (message: string) => {
    await handleSendMessageInternal(message, false);
  };

  // Voice kontrolleri
  const handleStartListening = () => {
    if (voiceChatRef.current) {
      voiceChatRef.current.startListening();
    }
  };

  const handleStopListening = () => {
    if (voiceChatRef.current) {
      voiceChatRef.current.stopListening();
    }
  };

  const handleCancelListening = () => {
    if (voiceChatRef.current) {
      voiceChatRef.current.cancelListening();
    }
  };

  const handleStopSpeaking = () => {
    if (voiceChatRef.current) {
      voiceChatRef.current.stopSpeaking();
    }
  };

  const handleToggleMute = () => {
    if (voiceChatRef.current) {
      voiceChatRef.current.toggleMute();
      setVoiceState(prev => ({
        ...prev,
        isMuted: !prev.isMuted
      }));
    }
  };

  // Hazır komut çalıştır
  const handleQuickCommand = (command: AIQuickCommand) => {
    handleSendMessage(command.prompt);
  };

  // Chat geçmişinden yükle
  const handleLoadChat = async (chatId: string) => {
    try {
      const messages = await getChatMessages(chatId);
      setChatState(prev => ({
        ...prev,
        chatId,
        messages,
        error: null
      }));
      setShowHistory(false);
    } catch (error) {
      console.error('Chat yüklenemedi:', error);
    }
  };

  // Yeni chat başlat
  const handleNewChat = () => {
    setChatState({
      chatId: null,
      messages: [],
      isLoading: false,
      isTyping: false,
      error: null,
      suggestions: []
    });
  };

  // Chat sil
  const handleDeleteChat = async (chatId: string) => {
    try {
      await archiveChat(chatId);
      setChatHistory(prev => prev.filter(c => c.id !== chatId));
      if (chatState.chatId === chatId) {
        handleNewChat();
      }
    } catch (error) {
      console.error('Chat silinemedi:', error);
    }
  };

  // Öneri tıkla
  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900">
      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">
              Claude API Key Gerekli
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              AI Asistan'ı kullanmak için Anthropic Claude API key'inizi girin.
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-600 hover:text-emerald-700 ml-1"
              >
                API key al →
              </a>
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {chatState.error && (
              <p className="text-sm text-red-500 mb-4">{chatState.error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleSaveApiKey}
                className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors"
              >
                Kaydet
              </button>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-medium transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center relative">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {/* Voice status indicator */}
            {(voiceState.isListening || voiceState.isSpeaking) && (
              <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${
                voiceState.isListening ? 'bg-red-500 animate-pulse' : 'bg-emerald-400 animate-pulse'
              }`}></span>
            )}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              AI Asistan
              {voiceSupport.stt && voiceSupport.tts && (
                <span className="text-xs font-normal px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                  Sesli
                </span>
              )}
            </h2>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isConnected ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Claude Bağlı
                  {voiceState.isListening && (
                    <>
                      <span className="mx-1">•</span>
                      <AudioVisualizerCompact isActive={true} type="listening" />
                      <span className="text-red-500 ml-1">Dinleniyor</span>
                    </>
                  )}
                  {voiceState.isSpeaking && (
                    <>
                      <span className="mx-1">•</span>
                      <AudioVisualizerCompact isActive={true} type="speaking" />
                      <span className="text-emerald-500 ml-1">Konuşuyor</span>
                    </>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  Bağlantı yok
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Chat History */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Sohbet Geçmişi"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

          {/* New Chat */}
          <button
            onClick={handleNewChat}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Yeni Sohbet"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Ayarlar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat History Dropdown */}
      {showHistory && chatHistory.length > 0 && (
        <div className="absolute top-20 right-6 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-40 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">Sohbet Geçmişi</h4>
          </div>
          {chatHistory.map(chat => (
            <div
              key={chat.id}
              className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0"
              onClick={() => handleLoadChat(chat.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{chat.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {chat.updatedAt.toLocaleDateString('tr-TR')}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteChat(chat.id);
                }}
                className="p-1 text-slate-400 hover:text-red-500 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {chatState.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
              MEDİS AI Asistan
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md mb-6">
              Detaylı cetveller, muayene verileri ve performans analizleri hakkında sorular sorabilirsiniz.
              {voiceSupport.stt && voiceSupport.tts && (
                <span className="block mt-2 text-emerald-600 dark:text-emerald-400">
                  Mikrofon butonuna basılı tutarak sesli soru sorabilirsiniz.
                </span>
              )}
            </p>

            {/* Voice Button (Empty State) */}
            {voiceSupport.stt && voiceSupport.tts && (
              <div className="mb-6">
                <VoiceChatButton
                  status={voiceState.status}
                  isListening={voiceState.isListening}
                  isSpeaking={voiceState.isSpeaking}
                  isMuted={voiceState.isMuted}
                  onStartListening={handleStartListening}
                  onStopListening={handleStopListening}
                  onCancelListening={handleCancelListening}
                  onStopSpeaking={handleStopSpeaking}
                  onToggleMute={handleToggleMute}
                  disabled={!isConnected}
                  size="lg"
                />
              </div>
            )}

            {/* Quick Commands */}
            <AIQuickCommands
              commands={QUICK_COMMANDS}
              onCommandClick={handleQuickCommand}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {chatState.messages.map((message) => (
              <AIChatMessage
                key={message.id}
                message={message}
                onFeedback={(feedback) => {
                  console.log('Feedback:', feedback);
                }}
              />
            ))}

            {/* Voice Transcript (geçici) */}
            {(voiceState.interimTranscript || (voiceState.isListening && voiceState.transcript)) && (
              <div className="flex gap-3 flex-row-reverse">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                </div>
                <div className="flex-1 max-w-[85%] text-right">
                  <div className="inline-block text-left bg-emerald-600/20 dark:bg-emerald-600/30 text-emerald-800 dark:text-emerald-200 rounded-2xl rounded-tr-md px-4 py-3 border border-emerald-300 dark:border-emerald-700">
                    <div className="flex items-center gap-2 text-sm">
                      <AudioVisualizerCompact isActive={true} type="listening" />
                      <span className="italic">
                        {voiceState.interimTranscript || voiceState.transcript || 'Dinleniyor...'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Streaming text */}
            {streamingText && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {streamingText}
                    <span className="inline-block w-2 h-4 bg-emerald-500 ml-1 animate-pulse"></span>
                  </p>
                </div>
              </div>
            )}

            {/* Typing indicator */}
            {chatState.isTyping && !streamingText && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}

            {/* Suggestions */}
            {chatState.suggestions.length > 0 && !chatState.isLoading && (
              <div className="flex flex-wrap gap-2 mt-4">
                {chatState.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-full transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Error Banner */}
      {(chatState.error || voiceState.error) && (
        <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{chatState.error || voiceState.error}</p>
        </div>
      )}

      {/* Input Area with Voice Button */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-end gap-3 px-6 py-4">
          {/* Voice Button (Compact - input yanında) */}
          <VoiceChatButton
            status={voiceState.status}
            isListening={voiceState.isListening}
            isSpeaking={voiceState.isSpeaking}
            isMuted={voiceState.isMuted}
            onStartListening={handleStartListening}
            onStopListening={handleStopListening}
            onCancelListening={handleCancelListening}
            onStopSpeaking={handleStopSpeaking}
            onToggleMute={handleToggleMute}
            disabled={!isConnected || chatState.isLoading || !voiceSupport.stt}
            size="md"
          />

          {/* Text Input */}
          <div className="flex-1">
            <AIChatInput
              onSend={handleSendMessage}
              isLoading={chatState.isLoading}
              disabled={!isConnected}
              placeholder={
                voiceState.isListening
                  ? 'Dinleniyor...'
                  : isConnected
                    ? "Bir soru sorun veya mikrofonu kullanın..."
                    : "API key gerekli"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;
