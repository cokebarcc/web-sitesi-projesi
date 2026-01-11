import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
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
      await sendPasswordResetEmail(auth, email);
      setSuccess('Şifre sıfırlama linki e-posta adresinize gönderildi!');
      setTimeout(() => {
        setShowForgotPassword(false);
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı.');
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-[48px] shadow-2xl p-10 animate-in zoom-in-95 duration-500">
          {/* Logo & Title */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center font-black text-3xl text-white shadow-lg mx-auto mb-4">
              M
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
              MHRS Analiz
            </h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-2">
              Yönetim Paneli
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 ring-blue-500 transition-all"
                placeholder="ornek@saglik.gov.tr"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 ring-blue-500 transition-all"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 animate-in slide-in-from-top-2">
                <p className="text-sm font-bold text-rose-600 text-center">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 animate-in slide-in-from-top-2">
                <p className="text-sm font-bold text-emerald-600 text-center">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Giriş Yapılıyor...
                </div>
              ) : (
                'Giriş Yap'
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="w-full text-slate-500 hover:text-blue-600 text-sm font-bold transition-colors"
            >
              Şifremi Unuttum
            </button>
          </form>

          {/* Forgot Password Modal */}
          {showForgotPassword && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setShowForgotPassword(false)}>
              <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl p-8 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Şifremi Unuttum</h2>
                <p className="text-sm font-bold text-slate-500 mb-6">
                  E-posta adresinizi girin, şifre sıfırlama linki gönderelim.
                </p>

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                      E-posta
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 ring-blue-500 transition-all"
                      placeholder="ornek@saglik.gov.tr"
                      required
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                      <p className="text-sm font-bold text-rose-600 text-center">{error}</p>
                    </div>
                  )}

                  {success && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                      <p className="text-sm font-bold text-emerald-600 text-center">{success}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="flex-1 bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Gönderiliyor...
                        </div>
                      ) : (
                        'Gönder'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">
              T.C. Sağlık Bakanlığı
            </p>
            <p className="text-xs font-bold text-slate-300 uppercase tracking-tight mt-1">
              Şanlıurfa İl Sağlık Müdürlüğü
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
