import React, { useState, useEffect } from 'react';
import FloatingSidebar from './FloatingSidebar';

interface WelcomeDashboardProps {
  userName?: string;
  onNavigate: (view: string) => void;
  userEmail?: string;
  onLogout: () => void;
  isAdmin?: boolean;
  hasModuleAccess: (module: string) => boolean;
}

const WelcomeDashboard: React.FC<WelcomeDashboardProps> = ({
  userName,
  onNavigate,
  userEmail,
  onLogout,
  isAdmin = false,
  hasModuleAccess
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [isSparkleAnimating, setIsSparkleAnimating] = useState(true);

  // Sparkle animation toggle
  useEffect(() => {
    const interval = setInterval(() => {
      setIsSparkleAnimating(prev => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const actionCards = [
    {
      id: 'data-upload',
      title: 'Veri Yükle',
      subtitle: 'Excel dosyalarından cetvel ve hekim verisi aktarın',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      ),
      gradient: 'from-violet-500/20 to-purple-600/20',
      borderColor: 'border-violet-500/30',
      hoverBorder: 'hover:border-violet-400/60',
      glowColor: 'violet',
      onClick: () => onNavigate('detailed-schedule')
    },
    {
      id: 'dashboard',
      title: 'Dashboard Oluştur',
      subtitle: 'Verimlilik analizi ve görsel raporlar',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      gradient: 'from-cyan-500/20 to-blue-600/20',
      borderColor: 'border-cyan-500/30',
      hoverBorder: 'hover:border-cyan-400/60',
      glowColor: 'cyan',
      onClick: () => onNavigate('efficiency-analysis')
    },
    {
      id: 'report',
      title: 'Rapor Üret',
      subtitle: 'PDF ve Word formatında dışa aktarım',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      gradient: 'from-amber-500/20 to-orange-600/20',
      borderColor: 'border-amber-500/30',
      hoverBorder: 'hover:border-amber-400/60',
      glowColor: 'amber',
      onClick: () => onNavigate('presentation')
    }
  ];

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;

    // AI Chatbot'a yönlendir
    onNavigate('ai-chatbot');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a1a] via-[#0d1025] to-[#0a0a1a] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Radial gradient spot in center */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-radial from-blue-500/5 via-purple-500/3 to-transparent rounded-full blur-3xl" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-12">
        {/* Sparkle Icon */}
        <div className={`mb-8 transition-all duration-1000 ${isSparkleAnimating ? 'scale-110 opacity-100' : 'scale-100 opacity-80'}`}>
          <div className="relative">
            {/* Main sparkle */}
            <svg
              className="w-16 h-16 text-blue-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </svg>

            {/* Glow effect */}
            <div className="absolute inset-0 blur-xl bg-blue-400/30 rounded-full animate-pulse" />

            {/* Small sparkles */}
            <svg
              className="absolute -top-2 -right-2 w-4 h-4 text-cyan-300 animate-ping"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
            </svg>
          </div>
        </div>

        {/* Welcome Text */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-3 tracking-tight">
            <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              MEDİS
            </span>
            <span className="text-slate-300">'e</span>
          </h1>
          <p className="text-slate-400 text-lg font-medium tracking-wide mb-2">
            Hoş Geldiniz
          </p>
          <p className="text-2xl md:text-3xl text-slate-500 font-light">
            Nasıl yardımcı olabilirim?
          </p>
        </div>

        {/* Action Cards */}
        <div className="flex flex-wrap justify-center gap-5 mb-16 max-w-4xl">
          {actionCards.map((card) => (
            <button
              key={card.id}
              onClick={card.onClick}
              className={`
                group relative w-[220px] h-[160px] rounded-2xl
                bg-gradient-to-br ${card.gradient}
                border ${card.borderColor} ${card.hoverBorder}
                backdrop-blur-xl
                transition-all duration-300 ease-out
                hover:scale-105 hover:-translate-y-1
                hover:shadow-2xl hover:shadow-${card.glowColor}-500/20
                overflow-hidden
              `}
            >
              {/* Card glow on hover */}
              <div className={`
                absolute inset-0 opacity-0 group-hover:opacity-100
                transition-opacity duration-500
                bg-gradient-to-br from-white/5 to-transparent
              `} />

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col items-start justify-between p-5">
                <div className="text-slate-300 group-hover:text-white transition-colors duration-300">
                  {card.icon}
                </div>
                <div className="text-left">
                  <h3 className="text-white font-semibold text-lg mb-1 group-hover:text-white transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-slate-400 text-xs leading-relaxed group-hover:text-slate-300 transition-colors">
                    {card.subtitle}
                  </p>
                </div>
              </div>

              {/* Decorative corner */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full" />
            </button>
          ))}
        </div>

        {/* Command Input */}
        <form onSubmit={handleCommandSubmit} className="w-full max-w-2xl">
          <div className="relative group">
            {/* Input glow effect */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative flex items-center bg-[#1a1a2e]/80 backdrop-blur-xl rounded-2xl border border-slate-700/50 group-hover:border-slate-600/50 transition-all duration-300">
              {/* AI Icon */}
              <div className="pl-5 text-slate-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="Ne yapmak istiyorsunuz? (Örn: 'Ocak ayı yeşil alan oranlarını getir')"
                className="flex-1 bg-transparent text-slate-200 placeholder-slate-500 px-4 py-4 outline-none text-sm"
              />

              {/* Submit button */}
              <button
                type="submit"
                className="mr-3 p-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl text-white hover:from-blue-600 hover:to-cyan-600 transition-all duration-300 hover:scale-105 shadow-lg shadow-blue-500/25"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Hint text */}
          <p className="text-center text-slate-600 text-xs mt-3">
            AI asistanı kullanarak hızlıca işlem yapabilirsiniz
          </p>
        </form>

        {/* Quick Stats / Info Section */}
        <div className="mt-16 flex items-center gap-8 text-slate-500 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span>Sistem Aktif</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Güvenli Bağlantı</span>
          </div>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Kurumsal Hesap</span>
          </div>
        </div>
      </div>

      {/* Floating Sidebar */}
      <FloatingSidebar
        currentView="welcome"
        onNavigate={onNavigate}
        userEmail={userEmail}
        onLogout={onLogout}
        isAdmin={isAdmin}
        hasModuleAccess={hasModuleAccess}
      />

      {/* CSS for custom animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .bg-gradient-radial {
          background: radial-gradient(ellipse at center, var(--tw-gradient-stops));
        }
      `}</style>
    </div>
  );
};

export default WelcomeDashboard;
