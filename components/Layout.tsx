
import React from 'react';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  streak: number;
  theme?: 'light' | 'dark';
  toggleTheme: () => void;
  hasSchedule?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, lang, setLang, streak, theme = 'light', toggleTheme, hasSchedule = false }) => {
  const t = TRANSLATIONS[lang];
  const { currentUser, logout } = useAuth();

  const NavItem = ({ id, label, icon, restricted }: { id: string; label: string; icon: string; restricted?: boolean }) => {
    const isDisabled = restricted && !hasSchedule;
    return (
      <button
        onClick={() => !isDisabled && setActiveTab(id)}
        disabled={isDisabled}
        title={isDisabled ? (lang === 'en' ? 'Unlocked after plan generation' : 'திட்ட உருவாக்கத்திற்கு பின் திறக்கப்படும்') : ''}
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${activeTab === id
          ? 'bg-sky-600 text-white shadow-lg shadow-sky-200 dark:shadow-none'
          : isDisabled
            ? 'opacity-40 cursor-not-allowed grayscale'
            : 'text-slate-700 dark:text-gray-300 hover:bg-sky-100 dark:hover:bg-slate-700 hover:text-sky-700 dark:hover:text-sky-400'
          }`}
      >
        <span>{icon}</span>
        <span className="font-medium whitespace-nowrap">{label}</span>
      </button>
    );
  };

  const maskEmail = (email?: string) => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `***@${domain}`;
    return `${name.slice(0, 2)}***@${domain}`;
  };

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'dark bg-slate-950 text-gray-100' : 'bg-sky-50/30 text-gray-900'}`}>
      <header className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 sticky top-0 z-50 px-4 md:px-8 py-3 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 shadow-sm transition-colors">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <img src="/logo.png" alt="Vetri Pathai" className="h-10 md:h-12 w-auto rounded-xl shadow-md transition-all group-hover:scale-110 group-hover:rotate-3" />
            <h1 className="text-xl font-black text-sky-900 dark:text-sky-400 tracking-tight">Vetri Pathai Pro</h1>
          </div>
          <div className="hidden md:flex ml-4 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full text-[10px] font-bold items-center space-x-1 border border-orange-200 dark:border-orange-800">
            <span>🔥</span>
            <span>{streak} {t.days}</span>
          </div>
        </div>

        <nav className="flex space-x-1 bg-gray-50 dark:bg-slate-800 p-1 rounded-xl border border-gray-100 dark:border-slate-700 overflow-x-auto no-scrollbar max-w-full">
          <NavItem id="dashboard" label={t.dashboard} icon="📊" />
          <NavItem id="schedule" label={t.schedule} icon="📅" restricted />
          <NavItem id="syllabus" label={t.syllabus} icon="📖" restricted />
          <NavItem id="currentAffairs" label={t.currentAffairs} icon="📰" />
          <NavItem id="subscription" label={lang === 'en' ? 'Subscription' : 'சந்தா'} icon="💳" />
          <NavItem id="history" label={t.history} icon="📜" restricted />
        </nav>

        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex flex-col items-end mr-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{currentUser?.fullName}</p>
            <p className="text-[10px] text-sky-600 font-bold">{maskEmail(currentUser?.email)}</p>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-all"
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Language)}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 dark:text-gray-100 rounded-lg px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="en">EN</option>
            <option value="ta">தமிழ்</option>
          </select>
          <button
            onClick={() => logout()}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
            title={t.logout}
          >
            🚪
          </button>
        </div>
      </header >

      {currentUser?.subscriptionStatus === 'trial' && (
        <div className="bg-sky-600 text-white py-2 text-center text-xs font-bold tracking-tight">
          🚀 {t.trialMessage} {lang === 'en' ? 'Expires' : 'முடிகிறது'}: {new Date(currentUser.subscriptionExpiry).toLocaleDateString()}
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t dark:border-slate-800 py-8 px-4 text-center mt-auto transition-colors">
        <div className="max-w-7xl mx-auto">
          <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            © {new Date().getFullYear()} Vetri Pathai Pro. Beyond Preparation.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">
            <span className="flex items-center">
              Designed & Developed by <span className="text-sky-600 dark:text-sky-400 ml-2">Mr. Bharathi Raja</span>
            </span>
            <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-slate-800" />
            <span className="flex items-center">
              Conceptualized by <span className="text-sky-600 dark:text-sky-400 ml-2">Mrs. Aruna</span>
            </span>
          </div>
        </div>
      </footer>
    </div >
  );
};

export default Layout;
