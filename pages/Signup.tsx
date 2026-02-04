import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';

const Signup: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [lang, setLang] = useState<Language>('en');
  const { signup } = useAuth();
  const navigate = useNavigate();
  const t = TRANSLATIONS[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await signup(formData);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

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

        <h2 className="text-xl font-bold text-gray-800 mb-2">{t.signup}</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {lang === 'en' ? 'Start your 7-day free trial today.' : 'இன்று உங்கள் 7 நாள் இலவச சோதனையைத் தொடங்குங்கள்.'}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{t.fullName}</label>
            <input
              name="fullName"
              type="text"
              required
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
              placeholder="Arun Kumar"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{t.email}</label>
            <input
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
              placeholder="arun@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{t.mobile}</label>
            <input
              name="mobile"
              type="tel"
              required
              value={formData.mobile}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
              placeholder="9876543210"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{t.password}</label>
            <input
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-sky-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-sky-200 hover:bg-sky-700 active:scale-[0.98] transition-all mt-4"
          >
            {t.signup}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            {t.haveAccount} {' '}
            <Link to="/login" className="text-sky-600 font-bold hover:underline">
              {t.login}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
