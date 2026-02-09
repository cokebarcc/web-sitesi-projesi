import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '../firebase';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess();
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Kullanıcı bulunamadı.');
      } else if (err.code === 'auth/wrong-password') {
        setError('Hatalı şifre.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Geçersiz e-posta adresi.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Geçersiz kullanıcı adı veya şifre.');
      } else {
        setError('Giriş yapılamadı. Lütfen tekrar deneyin.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Lütfen e-posta adresinizi girin.');
      return;
    }

    setIsLoading(true);

    try {
      // Önce Firebase Auth'da bu e-posta ile kayıtlı kullanıcı var mı kontrol et
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.length === 0) {
        setError('Bu e-posta adresi ile kayıtlı bir kullanıcı bulunmamaktadır.');
        setIsLoading(false);
        return;
      }

      await sendPasswordResetEmail(auth, email);
      setSuccess('Şifre sıfırlama linki e-posta adresinize gönderildi!');
      setTimeout(() => {
        setShowForgotPassword(false);
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Bu e-posta adresi ile kayıtlı bir kullanıcı bulunmamaktadır.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Geçersiz e-posta adresi.');
      } else {
        setError('Şifre sıfırlama linki gönderilemedi. Lütfen tekrar deneyin.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #020405 0%, #040810 50%, #060d18 100%)' }}>
      {/* EKG Rhythm Animation - Centered */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none">
        <svg className="absolute w-[80%] h-16 opacity-[0.06]" viewBox="0 0 800 50" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="ekgGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="20%" stopColor="#5b9cff" />
              <stop offset="50%" stopColor="#5b9cff" />
              <stop offset="80%" stopColor="#5b9cff" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <path
            d="M0,25 L60,25 L70,25 L75,10 L80,40 L85,3 L90,47 L95,25 L105,25 L180,25 L190,25 L195,10 L200,40 L205,3 L210,47 L215,25 L225,25 L300,25 L310,25 L315,10 L320,40 L325,3 L330,47 L335,25 L345,25 L420,25 L430,25 L435,10 L440,40 L445,3 L450,47 L455,25 L465,25 L540,25 L550,25 L555,10 L560,40 L565,3 L570,47 L575,25 L585,25 L660,25 L670,25 L675,10 L680,40 L685,3 L690,47 L695,25 L705,25 L800,25"
            fill="none"
            stroke="url(#ekgGradient)"
            strokeWidth="1.5"
            className="ekg-line"
          />
        </svg>
      </div>

      {/* Aurora Gradient Glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Left teal glow */}
        <div
          className="absolute -left-40 top-1/4 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(91, 156, 255, 0.15) 0%, rgba(91, 156, 255, 0.05) 40%, transparent 70%)',
            filter: 'blur(60px)'
          }}
        />
        {/* Right blue glow */}
        <div
          className="absolute -right-40 top-1/3 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 60%)',
            filter: 'blur(80px)'
          }}
        />
        {/* Bottom subtle glow */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px]"
          style={{
            background: 'radial-gradient(ellipse, rgba(91, 156, 255, 0.05) 0%, transparent 70%)',
            filter: 'blur(40px)'
          }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

        {/* LEFT HERO SECTION */}
        <div className="lg:w-[55%] flex flex-col justify-center px-8 lg:px-16 xl:px-24 py-12 lg:py-0">
          {/* Radar circles decoration */}
          <div className="absolute left-0 bottom-0 w-[400px] h-[400px] pointer-events-none opacity-20">
            <svg viewBox="0 0 400 400" className="w-full h-full">
              <circle cx="50" cy="350" r="80" fill="none" stroke="rgba(91, 156, 255, 0.3)" strokeWidth="1" />
              <circle cx="50" cy="350" r="140" fill="none" stroke="rgba(91, 156, 255, 0.2)" strokeWidth="1" />
              <circle cx="50" cy="350" r="200" fill="none" stroke="rgba(91, 156, 255, 0.1)" strokeWidth="1" />
              <circle cx="50" cy="350" r="260" fill="none" stroke="rgba(91, 156, 255, 0.05)" strokeWidth="1" />
            </svg>
          </div>

          {/* Code decoration - bottom left */}
          <div className="absolute left-8 bottom-8 text-[10px] font-mono text-white/10 leading-relaxed hidden lg:block">
            <div>// AI-Powered Healthcare Analytics</div>
            <div>const medis = new HealthAI();</div>
            <div>await medis.analyze(data);</div>
          </div>

          {/* Hero Content */}
          <div className="relative max-w-xl">
            {/* Icon Badge with Rotating Squares */}
            <div className="mb-8">
              <div className="relative w-20 h-20 flex items-center justify-center">
                {/* Rotating square frames */}
                <div
                  className="absolute w-20 h-20 rounded-xl border border-[#5b9cff]/40"
                  style={{ animation: 'rotateSquare1 8s linear infinite' }}
                />
                <div
                  className="absolute w-[72px] h-[72px] rounded-xl border border-[#5b9cff]/30"
                  style={{ animation: 'rotateSquare2 6s linear infinite reverse' }}
                />
                <div
                  className="absolute w-16 h-16 rounded-lg border border-[#5b9cff]/20"
                  style={{ animation: 'rotateSquare1 10s linear infinite' }}
                />

                {/* Main icon container */}
                <div
                  className="relative w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(91, 156, 255, 0.15) 0%, rgba(91, 156, 255, 0.05) 100%)',
                    border: '1px solid rgba(91, 156, 255, 0.3)',
                    boxShadow: '0 0 30px rgba(91, 156, 255, 0.2), inset 0 1px 0 rgba(255,255,255,0.05)'
                  }}
                >
                  <svg className="w-7 h-7 text-[#5b9cff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Main Title */}
            <h1 className="text-5xl lg:text-6xl font-black text-white tracking-tight mb-4">
              MEDİS
            </h1>

            {/* Subtitle */}
            <h2 className="text-xl lg:text-2xl font-semibold mb-8">
              <span className="text-[#5b9cff]">Yapay Zekâ Destekli</span>
              <br />
              <span className="text-[#38bdf8]">Sağlık Analiz Platformu</span>
            </h2>

            {/* Feature Pills */}
            <div className="flex flex-wrap gap-3">
              {['Yapay Zekâ Analizi', 'Sesli Asistan', 'Akıllı Raporlar'].map((feature, i) => (
                <div
                  key={i}
                  className="px-4 py-2 rounded-full text-sm font-medium text-[#5b9cff] border border-[#5b9cff]/30 bg-[#5b9cff]/5 hover:bg-[#5b9cff]/10 hover:border-[#5b9cff]/50 transition-all duration-300 cursor-default"
                  style={{ boxShadow: 'inset 0 1px 0 rgba(91, 156, 255, 0.1)' }}
                >
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT LOGIN SECTION */}
        <div className="lg:w-[45%] flex flex-col justify-center items-center px-6 lg:px-12 py-12 lg:py-0">
          {/* Glass Card */}
          <div
            className="w-full max-w-md rounded-3xl p-8 lg:p-10 relative"
            style={{
              background: 'rgba(10, 20, 35, 0.55)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 100px rgba(91, 156, 255, 0.05)'
            }}
          >
            {/* Card Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Hoş Geldiniz</h2>
              <p className="text-[#9AA8B5] text-sm">Devam etmek için giriş yapın</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Field */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8B5] mb-2 tracking-[0.1em] uppercase">
                  E-posta Adresi
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl text-white placeholder-[#5A6A7A] outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(7, 17, 28, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '1px solid rgba(91, 156, 255, 0.4)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(91, 156, 255, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid rgba(255, 255, 255, 0.06)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="ornek@saglik.gov.tr"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8B5] mb-2 tracking-[0.1em] uppercase">
                  Şifre
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl text-white placeholder-[#5A6A7A] outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(7, 17, 28, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '1px solid rgba(91, 156, 255, 0.4)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(91, 156, 255, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid rgba(255, 255, 255, 0.06)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <p className="text-sm text-emerald-400">{success}</p>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                style={{
                  background: 'linear-gradient(135deg, #5b9cff 0%, #38bdf8 100%)',
                  boxShadow: '0 10px 40px -10px rgba(91, 156, 255, 0.5)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 15px 50px -10px rgba(91, 156, 255, 0.6)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, #6ba8ff 0%, #4dc9f6 100%)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 10px 40px -10px rgba(91, 156, 255, 0.5)';
                  e.currentTarget.style.background = 'linear-gradient(135deg, #5b9cff 0%, #38bdf8 100%)';
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Giriş Yapılıyor...
                    </>
                  ) : (
                    <>
                      Giriş Yap
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
              </button>

              {/* Forgot Password Link */}
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-center text-[#9AA8B5] hover:text-[#5b9cff] text-sm font-medium transition-colors py-2"
              >
                Şifremi Unuttum
              </button>
            </form>

            {/* Secure Login Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-[10px] text-[#5A6A7A] font-medium tracking-[0.15em] uppercase">Güvenli Giriş</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            {/* SSL Badge */}
            <div className="flex items-center justify-center gap-2 text-[#5A6A7A]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-xs">256-bit SSL ile korunmaktadır</span>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 text-center">
            <p className="text-[#5A6A7A] text-xs mb-2">
              T.C. Sağlık Bakanlığı - Şanlıurfa İl Sağlık Müdürlüğü
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-500 text-xs font-medium">Sistem Aktif</span>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(5, 7, 11, 0.9)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowForgotPassword(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-8 relative"
            style={{
              background: 'rgba(10, 20, 35, 0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold text-white mb-2">Şifremi Unuttum</h2>
            <p className="text-[#9AA8B5] text-sm mb-6">
              E-posta adresinizi girin, şifre sıfırlama linki gönderelim.
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[#9AA8B5] mb-2 tracking-[0.1em] uppercase">
                  E-posta Adresi
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-xl text-white placeholder-[#5A6A7A] outline-none transition-all duration-200"
                  style={{
                    background: 'rgba(7, 17, 28, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                  onFocus={(e) => {
                    e.target.style.border = '1px solid rgba(91, 156, 255, 0.4)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(91, 156, 255, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.border = '1px solid rgba(255, 255, 255, 0.06)';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="ornek@saglik.gov.tr"
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {success && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <p className="text-sm text-emerald-400">{success}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="flex-1 py-3 rounded-xl font-medium text-[#9AA8B5] transition-all hover:bg-white/5"
                  style={{ border: '1px solid rgba(255, 255, 255, 0.1)' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 rounded-xl font-medium text-white transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #5b9cff 0%, #38bdf8 100%)' }}
                >
                  {isLoading ? 'Gönderiliyor...' : 'Gönder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* CSS Animations */}
      <style>{`
        @keyframes rotateSquare1 {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes rotateSquare2 {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        .ekg-line {
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
          animation: ekgDraw 4s ease-in-out infinite;
        }
        .ekg-line-2 {
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
          animation: ekgDraw 5s ease-in-out infinite;
          animation-delay: 2s;
        }
        @keyframes ekgDraw {
          0% {
            stroke-dashoffset: 1400;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -1400;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;
