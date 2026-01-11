import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
          </form>

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
