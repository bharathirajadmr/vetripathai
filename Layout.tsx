
import React from 'react';
import { TRANSLATIONS } from './constants';
import { Language } from './types';
import { useAuth } from './context/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  streak: number;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, lang, setLang, streak }) => {
  const t = TRANSLATIONS[lang];
  const { currentUser, logout } = useAuth();

  const NavItem = ({ id, label, icon }: { id: string; label: string; icon: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
        activeTab === id ? 'bg-sky-600 text-white shadow-md' : 'text-gray-600 hover:bg-sky-50'
      }`}
    >
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );

  const maskEmail = (email?: string) => {
    if (!email) return '';
    const [name, domain] = email.split('@');
    return `${name.slice(0, 2)}***@${domain}`;
  };

  return (
    <div className="min-h-screen bg-sky-50/30 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-50 px-4 md:px-8 py-3 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="bg-sky-600 w-8 h-8 flex items-center justify-center rounded-lg text-white font-black">V</div>
            <h1 className="text-lg font-black text-sky-900 tracking-tight">VetriPathai</h1>
          </div>
          <div className="hidden md:flex ml-4 bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-[10px] font-bold items-center space-x-1 border border-orange-200">
            <span>🔥</span>
            <span>{streak} {t.days}</span>
          </div>
        </div>

        <nav className="flex space-x-1 bg-gray-50 p-1 rounded-xl border border-gray-100 overflow-x-auto no-scrollbar max-w-full">
          <NavItem id="dashboard" label={t.dashboard} icon="📊" />
          <NavItem id="schedule" label={t.schedule} icon="📅" />
          <NavItem id="syllabus" label={t.syllabus} icon="📖" />
          <NavItem id="currentAffairs" label={t.currentAffairs} icon="📰" />
          <NavItem id="history" label={t.history} icon="📜" />
        </nav>

        <div className="flex items-center space-x-3">
          <div className="hidden lg:flex flex-col items-end mr-2">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{currentUser?.fullName}</p>
            <p className="text-[10px] text-sky-600 font-bold">{maskEmail(currentUser?.email)}</p>
          </div>
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value as Language)}
            className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs font-medium outline-none focus:ring-2 focus:ring-sky-500"
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
      </header>

      {currentUser?.subscriptionStatus === 'trial' && (
        <div className="bg-sky-600 text-white py-2 text-center text-xs font-bold tracking-tight">
          🚀 {t.trialMessage} {lang === 'en' ? 'Expires' : 'முடிகிறது'}: {new Date(currentUser.subscriptionExpiry).toLocaleDateString()}
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
