import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [lang, setLang] = useState<Language>('en');
  const { login, logoutReason } = useAuth();
  const navigate = useNavigate();
  const t = TRANSLATIONS[lang];

  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (forgotPassword) {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1500));
      setResetSent(true);
      setLoading(false);
      return;
    }
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-sky-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-sky-100">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="VetriPathai" className="h-10 w-auto rounded-lg shadow-sm" />
            <h1 className="text-2xl font-black text-sky-900 tracking-tight">VetriPathai</h1>
          </div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded-lg"
          >
            <option value="en">EN</option>
            <option value="ta">தமிழ்</option>
          </select>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-2">{forgotPassword ? (lang === 'en' ? 'Reset Password' : 'கடவுச்சொல்லை மீட்டமை') : t.login}</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {forgotPassword
            ? (lang === 'en' ? 'Enter your email to receive a reset link.' : 'மீட்டமைப்பு இணைப்பைப் பெற உங்கள் மின்னஞ்சலை உள்ளிடவும்.')
            : (lang === 'en' ? 'Welcome back, future officer.' : 'மீண்டும் வருக, வருங்கால அதிகாரியே.')}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl animate-pulse">
            {error}
          </div>
        )}

        {resetSent && (
          <div className="mb-4 p-4 bg-green-50 border border-green-100 text-green-700 text-xs font-bold rounded-xl whitespace-pre-wrap">
            {lang === 'en'
              ? '✅ Reset link sent! Please check your email inbox and spam folder.'
              : '✅ மீட்டமைப்பு இணைப்பு அனுப்பப்பட்டது! உங்கள் மின்னஞ்சல் பெட்டியைச் சரிபார்க்கவும்.'}
          </div>
        )}

        {logoutReason && !error && !forgotPassword && (
          <div className="mb-4 p-3 bg-orange-50 border border-orange-100 text-orange-600 text-xs font-bold rounded-xl">
            {logoutReason === 'expiry' ? t.sessionExpired : t.deviceConflict}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{t.email}</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
              placeholder="name@example.com"
            />
          </div>

          {!forgotPassword && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">{t.password}</label>
                <button
                  type="button"
                  onClick={() => setForgotPassword(true)}
                  className="text-[10px] font-bold text-sky-600 hover:underline"
                >
                  {lang === 'en' ? 'Forgot Password?' : 'கடவுச்சொல் மறந்துவிட்டதா?'}
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
                placeholder="••••••••"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-700 active:scale-[0.98] transition-all mt-4 disabled:opacity-50"
          >
            {loading ? '...' : (forgotPassword ? (lang === 'en' ? 'Send Reset Link' : 'இணைப்பை அனுப்பு') : t.login)}
          </button>

          {forgotPassword && (
            <button
              type="button"
              onClick={() => {
                setForgotPassword(false);
                setResetSent(false);
              }}
              className="w-full text-center text-xs font-bold text-gray-400 hover:text-sky-600 mt-2"
            >
              {lang === 'en' ? '← Back to Login' : '← உள்நுழைவுக்கு திரும்பவும்'}
            </button>
          )}
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            {t.noAccount} {' '}
            <Link to="/signup" className="text-sky-600 font-bold hover:underline">
              {t.signup}
            </Link>
          </p>
        </div>
      </div>

      <p className="mt-8 text-[10px] text-gray-400 text-center max-w-xs leading-relaxed">
        {lang === 'en'
          ? 'Disclaimer: AI-generated content. For verification, use official TNPSC textbooks.'
          : 'பொறுப்புத் துறப்பு: AI-ஆல் உருவாக்கப்பட்ட உள்ளடக்கம். சரிபார்க்க, அதிகாரப்பூர்வ TNPSC பாடப்புத்தகங்களைப் பயன்படுத்தவும்.'}
      </p>
    </div>
  );
};

export default Login;
