
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

const formatExpiryDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = date.getDate();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return `${day}-${monthNames[date.getMonth()]}-${date.getFullYear()}`;
};

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

  const [installPrompt, setInstallPrompt] = React.useState<any>(null);

  React.useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const [showNudge, setShowNudge] = React.useState(false);

  React.useEffect(() => {
    // Show nudge if it's after 7 PM and user is on trial/pending
    const checkNudge = () => {
      const hour = new Date().getHours();
      if (hour >= 19 && currentUser?.subscriptionStatus !== 'expired') {
        setShowNudge(true);
      }
    };
    checkNudge();
    const interval = setInterval(checkNudge, 30 * 60 * 1000); // Check every 30 mins
    return () => clearInterval(interval);
  }, [currentUser]);

  const requestNotifications = () => {
    if ('Notification' in window) {
      Notification.requestPermission();
    }
    setShowNudge(false);
  };

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'dark bg-[#070b14] text-gray-100' : 'bg-sky-50/30 text-gray-900'}`}>
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 sticky top-0 z-50 px-4 md:px-8 py-3 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 shadow-sm transition-colors">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <img src="/logo.png" alt="Vetri Pathai" className="h-10 md:h-12 w-auto rounded-xl shadow-md transition-all group-hover:scale-110 group-hover:rotate-3" />
            <h1 className="text-xl font-black text-sky-900 dark:text-sky-400 tracking-tight">Vetri Pathai</h1>
          </div>
          <div className="hidden md:flex ml-4 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1 rounded-full text-[10px] font-bold items-center space-x-1 border border-orange-200 dark:border-orange-800">
            <span>🔥</span>
            <span>{streak} {t.days}</span>
          </div>
        </div>

        <nav className="hidden md:flex space-x-1 bg-gray-50 dark:bg-slate-800 p-1 rounded-xl border border-gray-100 dark:border-slate-700 overflow-x-auto no-scrollbar max-w-full">
          <NavItem id="dashboard" label={t.dashboard} icon="📊" />
          <NavItem id="schedule" label={t.schedule} icon="📅" restricted />
          <NavItem id="syllabus" label={t.syllabus} icon="📖" restricted />
          <NavItem id="currentAffairs" label={t.currentAffairs} icon="📰" />
          <NavItem id="subscription" label={lang === 'en' ? 'Subscription' : 'சந்தா'} icon="💳" />
          <NavItem id="history" label={t.history} icon="📜" restricted />
        </nav>

        <div className="flex items-center space-x-3">
          {installPrompt && (
            <button
              onClick={handleInstallClick}
              className="hidden lg:flex items-center space-x-2 px-3 py-1.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-sky-600 hover:text-white transition-all animate-bounce"
            >
              <span>📥</span>
              <span>Install App</span>
            </button>
          )}

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
            onClick={() => {
              const msg = lang === 'en' ? 'Are you sure you want to logout?' : 'நீங்கள் வெளியேற விரும்புகிறீர்களா?';
              if (window.confirm(msg)) logout();
            }}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all text-2xl flex items-center justify-center w-10 h-10"
            title={t.logout}
          >
            🚪
          </button>
        </div>
      </header >

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 z-[60] flex items-center justify-around px-2 py-2 safe-bottom">
        {[
          { id: 'dashboard', label: t.dashboard, icon: '📊' },
          { id: 'schedule', label: t.schedule, icon: '📅', restricted: true },
          { id: 'currentAffairs', label: 'News', icon: '📰' },
          { id: 'syllabus', label: 'Book', icon: '📖', restricted: true },
          { id: 'subscription', label: 'Pro', icon: '💳' },
        ].map(item => {
          const isDisabled = item.restricted && !hasSchedule;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setActiveTab(item.id)}
              disabled={isDisabled}
              className={`flex flex-col items-center space-y-1 py-1 flex-1 transition-all ${isActive ? 'text-sky-600' : isDisabled ? 'opacity-30' : 'text-gray-400'}`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-black uppercase tracking-tighter">{item.label.split(' ')[0]}</span>
              {isActive && <div className="w-1 h-1 bg-sky-600 rounded-full mt-1" />}
            </button>
          );
        })}
      </nav>

      {showNudge && (
        <div className="bg-indigo-600 text-white py-3 px-4 flex justify-between items-center animate-in slide-in-from-top duration-500">
          <p className="text-xs font-bold">
            ⚡ {lang === 'en' ? 'Officer, finish your remaining tasks to stay on track!' : 'அதிகாரியே, உங்கள் இலக்குகளை முடிக்க இன்று இன்னும் சில வேலைகள் உள்ளன!'}
          </p>
          <div className="flex space-x-3">
            <button onClick={requestNotifications} className="bg-white text-indigo-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">Remind Me</button>
            <button onClick={() => setShowNudge(false)} className="opacity-60 text-xs">✕</button>
          </div>
        </div>
      )}

      {currentUser?.subscriptionStatus === 'trial' && (
        <div className="bg-sky-600 text-white py-2 text-center text-xs font-bold tracking-tight">
          🚀 {t.trialMessage} {lang === 'en' ? 'Expires' : 'முடிகிறது'}: {formatExpiryDate(currentUser.subscriptionExpiry)}
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {children}
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t dark:border-slate-800 py-8 px-4 text-center mt-auto transition-colors">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 mb-6">
            <div className="flex items-center space-x-4 md:space-x-6">
              <button
                onClick={() => setActiveTab('about')}
                className={`text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'about' ? 'text-sky-600' : 'text-gray-400 hover:text-sky-600'}`}
              >
                {t.about}
              </button>
              <button
                onClick={() => setActiveTab('contact')}
                className={`text-[10px] font-black uppercase tracking-widest transition-colors ${activeTab === 'contact' ? 'text-sky-600' : 'text-gray-400 hover:text-sky-600'}`}
              >
                {t.contact}
              </button>
            </div>

            <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-slate-800" />

            <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Designed & Developed by <span className="text-sky-600 dark:text-sky-400">Mr. Bharathi Raja</span>
              </span>
              <span className="hidden md:block w-1 h-1 rounded-full bg-gray-200 dark:bg-slate-800" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Conceptualized by <span className="text-sky-600 dark:text-sky-400">Mrs. Aruna Bharathi Raja</span>
              </span>
            </div>
          </div>
          <p className="text-gray-400 dark:text-gray-500 text-[10px] font-bold uppercase tracking-[0.2em]">
            © {new Date().getFullYear()} Vetri Pathai. Beyond Preparation.
          </p>
        </div>
      </footer>
    </div >
  );
};

export default Layout;
