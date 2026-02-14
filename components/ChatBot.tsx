
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppointmentData, HBYSData } from '../types';
import elevenLabsService, { TURKISH_VOICES } from '../services/elevenLabsService';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

interface ChatBotProps {
  appointmentData: AppointmentData[];
  hbysData: HBYSData[];
}

const ChatBot: React.FC<ChatBotProps> = ({ appointmentData, hbysData }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'model',
      text: "Merhaba! AI danışman özelliği şu anda devre dışı bırakılmıştır. Lütfen manuel veri analizi modüllerini kullanın.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatRef = useRef<any>(null);

  // TTS State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(TURKISH_VOICES.ARIA);

  // API key kontrolü
  useEffect(() => {
    const key = elevenLabsService.getApiKey();
    setHasApiKey(!!key);
  }, []);

  // Mesajı seslendir
  const handleSpeak = async (text: string, index: number) => {
    if (!hasApiKey) {
      setShowApiKeyModal(true);
      return;
    }

    if (isSpeaking && speakingMessageIndex === index) {
      elevenLabsService.stop();
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
      return;
    }

    elevenLabsService.stop();
    setIsSpeaking(true);
    setSpeakingMessageIndex(index);

    try {
      await elevenLabsService.speak(text, { voiceId: selectedVoice });
    } catch (error: any) {
      console.error('TTS Error:', error);
      alert(error.message || 'Seslendirme hatası oluştu');
    } finally {
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
    }
  };

  // API key kaydet
  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;

    const isValid = await elevenLabsService.validateApiKey(apiKeyInput.trim());
    if (isValid) {
      elevenLabsService.saveApiKey(apiKeyInput.trim());
      setHasApiKey(true);
      setShowApiKeyModal(false);
      setApiKeyInput('');
    } else {
      alert('Geçersiz API anahtarı. Lütfen kontrol edin.');
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // AI için detaylı organizasyonel ve operasyonel veri bağlamı
  const dataContextSummary = useMemo(() => {
    if (appointmentData.length === 0) return "Sistemde henüz yüklenmiş bir cetvel verisi bulunmamaktadır.";

    const branches = Array.from(new Set(appointmentData.map(a => a.specialty)));

    let summary = `HASTANE ORGANİZASYON VE PERFORMANS VERİLERİ:\n\n`;

    summary += `1. BRANŞ VE HEKİM YAPISI:\n`;
    branches.forEach(branch => {
      const branchDocs = Array.from(new Set(
        appointmentData.filter(a => a.specialty === branch).map(a => a.doctorName)
      ));
      summary += `- ${branch}: ${branchDocs.length} Hekim (İsimler: ${branchDocs.join(", ")})\n`;
    });

    summary += `\n2. PERFORMANS VE KAPASİTE ÖZETİ (HEKİM BAZLI):\n`;
    const uniqueDocs = Array.from(new Set(appointmentData.map(a => a.doctorName)));

    uniqueDocs.forEach(name => {
      const docAppts = appointmentData.filter(a => a.doctorName === name);
      const docHbys = hbysData.find(h => h.doctorName === name);
      const specialty = docAppts[0]?.specialty;

      const normalize = (val: any) => (val ? String(val).toLowerCase() : '');

      const pDays = docAppts.filter(a => normalize(a.actionType).includes('muayene') || normalize(a.actionType).includes('poliklinik')).reduce((a, b) => a + (b.daysCount || 0), 0);
      const sDays = docAppts.filter(a => normalize(a.actionType).includes('ameliyat')).reduce((a, b) => a + (b.daysCount || 0), 0);
      const plannedCapacity = docAppts.reduce((a, b) => a + (b.totalSlots || 0), 0);

      const actualExams = docHbys?.totalExams || 0;
      const actualSurgeries = docHbys?.surgeryABC || 0;

      summary += `- ${name} (${specialty}): Planlanan ${pDays}G Poli (${plannedCapacity} Kapasite), ${sDays}G Ameliyat. Gerçekleşen: ${actualExams} muayene, ${actualSurgeries} vaka.\n`;
    });

    return summary;
  }, [appointmentData, hbysData]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      // AI functionality has been disabled
      const modelText = "AI özelliği şu anda devre dışı bırakıldı. Lütfen manuel olarak veri analizlerini kullanın.";

      setMessages(prev => [...prev, {
        role: 'model',
        text: modelText,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: "Bağlantı sırasında bir hata oluştu. Lütfen tekrar deneyin.",
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto h-[calc(100vh-250px)] flex flex-col animate-in fade-in duration-700">
      <div className="bg-white p-8 rounded-t-[48px] border-x border-t shadow-sm flex items-center justify-between" style={{ borderColor: 'var(--border-2)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>AI Danışman Paneli</h2>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Organizasyon ve Performans Analizi</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => setShowApiKeyModal(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
              hasApiKey
                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                : ''
            }`}
            style={!hasApiKey ? { background: 'var(--surface-3)', color: 'var(--text-3)' } : undefined}
            title="Ses Ayarları"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider">
              {hasApiKey ? 'Ses Aktif' : 'Ses Ayarla'}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${appointmentData.length > 0 ? 'bg-emerald-500 animate-pulse' : ''}`} style={appointmentData.length === 0 ? { background: 'var(--border-2)' } : undefined}></div>
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
              {appointmentData.length > 0 ? `${appointmentData.length} Kayıt Bağlı` : 'Veri Yok'}
            </span>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 bg-white border-x overflow-y-auto p-8 custom-scrollbar space-y-6"
        style={{ borderColor: 'var(--border-2)' }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
          >
            <div className={`max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`p-6 rounded-[32px] shadow-sm text-sm leading-relaxed ${
                  msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-100'
                  : 'rounded-bl-none border'
                }`}
                style={msg.role !== 'user' ? { background: 'var(--surface-3)', color: 'var(--text-2)', borderColor: 'var(--border-2)' } : undefined}
              >
                {msg.text}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] font-bold uppercase tracking-tighter" style={{ color: 'var(--text-3)' }}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.role === 'model' && (
                  <button
                    onClick={() => handleSpeak(msg.text, idx)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isSpeaking && speakingMessageIndex === idx
                        ? 'bg-indigo-100 text-indigo-600'
                        : ''
                    }`}
                    style={!(isSpeaking && speakingMessageIndex === idx) ? { color: 'var(--text-3)' } : undefined}
                    title={isSpeaking && speakingMessageIndex === idx ? 'Durdur' : 'Seslendir'}
                  >
                    {isSpeaking && speakingMessageIndex === idx ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="p-6 rounded-[32px] rounded-bl-none border" style={{ background: 'var(--surface-3)', borderColor: 'var(--border-2)' }}>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'var(--border-2)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce delay-100" style={{ background: 'var(--border-2)' }}></div>
                <div className="w-2 h-2 rounded-full animate-bounce delay-200" style={{ background: 'var(--border-2)' }}></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-b-[48px] border-x border-b shadow-xl" style={{ borderColor: 'var(--border-2)' }}>
        <form onSubmit={handleSend} className="relative flex items-center gap-4">
          <input
            type="text"
            className="flex-1 border rounded-[28px] px-8 py-5 text-sm font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
            style={{ background: 'var(--surface-3)', borderColor: 'var(--border-2)', color: 'var(--text-1)' }}
            placeholder="Örn: 'Üroloji branşında hangi hekimler var?' veya 'En verimli cerrah kim?'"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
        <p className="text-[10px] text-center mt-4 font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--text-2)' }}>Yapay zeka tüm yanıtlarını cetvellerdeki gerçek verilere dayandırır.</p>
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-black" style={{ color: 'var(--text-1)' }}>Doğal Ses Ayarları</h3>
                <p className="text-sm" style={{ color: 'var(--text-3)' }}>ElevenLabs API anahtarı gerekli</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>API Anahtarı</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk_..."
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all"
                  style={{ borderColor: 'var(--border-2)' }}
                />
              </div>

              <div className="rounded-xl p-4" style={{ background: 'var(--surface-3)' }}>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  <strong>ElevenLabs</strong> ücretsiz hesap ile aylık 10.000 karakter seslendirme hakkı sunar.
                  <a
                    href="https://elevenlabs.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 font-bold ml-1 hover:underline"
                  >
                    Hesap oluştur →
                  </a>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold mb-2 uppercase tracking-wider" style={{ color: 'var(--text-2)' }}>Ses Seçimi</label>
                <select
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all bg-white"
                  style={{ borderColor: 'var(--border-2)' }}
                >
                  <option value={TURKISH_VOICES.ARIA}>Aria (Multilingual Kadın - Önerilen)</option>
                  <option value={TURKISH_VOICES.ROGER}>Roger (Multilingual Erkek)</option>
                  <option value={TURKISH_VOICES.ADAM}>Adam (Doğal Erkek)</option>
                  <option value={TURKISH_VOICES.DOMI}>Domi (Genç Kadın)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowApiKeyModal(false);
                  setApiKeyInput('');
                }}
                className="flex-1 px-6 py-3 rounded-xl border font-bold transition-all"
                style={{ borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
              >
                İptal
              </button>
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className="flex-1 px-6 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Kaydet
              </button>
            </div>

            {hasApiKey && (
              <button
                onClick={() => {
                  elevenLabsService.clearApiKey();
                  setHasApiKey(false);
                }}
                className="w-full mt-3 text-xs text-rose-500 font-bold hover:text-rose-600 transition-colors"
              >
                Mevcut API Anahtarını Kaldır
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBot;
