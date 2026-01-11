
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppointmentData, HBYSData } from '../types';

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
      <div className="bg-white p-8 rounded-t-[48px] border-x border-t border-slate-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">AI Danışman Paneli</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Organizasyon ve Performans Analizi</p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2">
           <div className={`w-2 h-2 rounded-full ${appointmentData.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
             {appointmentData.length > 0 ? `${appointmentData.length} Kayıt Bağlı` : 'Veri Yok'}
           </span>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 bg-white border-x border-slate-100 overflow-y-auto p-8 custom-scrollbar space-y-6"
      >
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}
          >
            <div className={`max-w-[80%] flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-6 rounded-[32px] shadow-sm text-sm leading-relaxed ${
                msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-100' 
                : 'bg-slate-50 text-slate-700 rounded-bl-none border border-slate-100'
              }`}>
                {msg.text}
              </div>
              <span className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-tighter">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-50 p-6 rounded-[32px] rounded-bl-none border border-slate-100">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-8 rounded-b-[48px] border-x border-b border-slate-100 shadow-xl">
        <form onSubmit={handleSend} className="relative flex items-center gap-4">
          <input 
            type="text"
            className="flex-1 bg-slate-50 border border-slate-100 rounded-[28px] px-8 py-5 text-sm font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:text-slate-400"
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
        <p className="text-[10px] text-center text-slate-300 mt-4 font-bold uppercase tracking-[0.2em]">Yapay zeka tüm yanıtlarını cetvellerdeki gerçek verilere dayandırır.</p>
      </div>
    </div>
  );
};

export default ChatBot;
