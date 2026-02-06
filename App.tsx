
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppState, Language, UserConfig, SyllabusItem } from './types.ts';
import { loadState, saveState } from './services/storage.ts';
import Layout from './components/Layout.tsx';
import { TRANSLATIONS, BADGE_DEFINITIONS } from './constants.ts';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import Login from './pages/Login.tsx';
import Signup from './pages/Signup.tsx';
import Dashboard from './components/Dashboard.tsx';
import ScheduleView from './components/ScheduleView.tsx';
import SetupView from './components/SetupView.tsx';
import SyllabusView from './components/SyllabusView.tsx';
import HistoryView from './components/HistoryView.tsx';
import SubscriptionPage from './pages/Subscription.tsx';
import AdminPage from './pages/Admin.tsx';
import AboutPage from './pages/About.tsx';
import ContactPage from './pages/Contact.tsx';
import { getMotivationalQuote, generateSchedule, fetchWeeklyCurrentAffairs } from './services/gemini.ts';

const MainApp: React.FC = () => {
  const { currentUser } = useAuth();
  const [state, setState] = useState<AppState>(loadState(currentUser?.email));
  const [loading, setLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lang, setLang] = useState<Language>(state.user?.language || 'en');
  const [theme, setTheme] = useState<'light' | 'dark'>(state.user?.theme || 'light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (state.user) {
      const updatedState = {
        ...state,
        user: { ...state.user, theme: newTheme }
      };
      setState(updatedState);
      saveState(updatedState, currentUser?.email);
    }
  };

  // Load state when user changes
  useEffect(() => {
    const loadInitialState = async () => {
      if (currentUser?.email) {
        console.log(`[Sync] Attempting to sync state for ${currentUser.email}`);
        const { syncStateFromBackend } = await import('./services/storage.ts');
        const backendState = await syncStateFromBackend(currentUser.email);

        // Only use backend state if it's not empty and contains at least a user or syllabus
        if (backendState && (backendState.user || backendState.syllabus || (backendState.schedule && backendState.schedule.length > 0))) {
          console.log("[Sync] Applying state from backend");
          setState(backendState);
          setLang(backendState.user?.language || 'en');
          setTheme(backendState.user?.theme || 'light');
          setIsHydrated(true);
          return;
        } else {
          console.log("[Sync] Backend state empty or invalid, falling back to local storage");
        }
      }
      const loadedState = loadState(currentUser?.email);
      setState(loadedState);
      setLang(loadedState.user?.language || 'en');
      setTheme(loadedState.user?.theme || 'light');
      setIsHydrated(true);
    };

    loadInitialState();
  }, [currentUser]);

  // Fetch motivation if missing
  useEffect(() => {
    if (!state.motivation) {
      getMotivationalQuote(lang).then(quote => {
        setState(prev => ({ ...prev, motivation: quote }));
      }).catch(err => console.error("Motivation fetch failed", err));
    }

    // Auto-fetch Current Affairs on load
    if (!state.currentAffairs || state.currentAffairs.length === 0) {
      handleFetchCA();
    }
  }, [lang]);

  // Save state when state or user changes
  useEffect(() => {
    if (isHydrated) {
      saveState(state, currentUser?.email, currentUser || undefined);
    }
  }, [state, currentUser, isHydrated]);

  const handleFetchCA = async () => {
    setLoading(true);
    try {
      const news = await fetchWeeklyCurrentAffairs(lang);
      setState(prev => ({ ...prev, currentAffairs: news }));
    } catch (error) {
      console.error("Fetch failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = (config: UserConfig, syllabus: SyllabusItem[], schedule: any[]) => {
    // Ensure unique IDs
    const processedSchedule = (schedule || []).map(day => ({
      ...day,
      id: day.id.includes('day-') && day.id.length < 10 ? `day-${day.date}` : day.id
    }));

    setState(prev => ({
      ...prev,
      user: config,
      syllabus: syllabus,
      schedule: processedSchedule,
      setupMode: undefined
    }));
    setLang(config.language);
    setTheme(config.theme || 'light');
    setActiveTab('schedule'); // Switch to schedule after generation

    // Calculate total days for correct extension and messaging
    const start = config.startDate ? new Date(config.startDate) : new Date();
    const end = config.endDate ? new Date(config.endDate) : new Date();
    const totalDaysRequested = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Show success message
    setTimeout(() => {
      const msg = totalDaysRequested > 15
        ? (config.language === 'en'
          ? '🎉 Your initial 15-day plan is ready! We are generating the rest of the plan in the background.'
          : '🎉 உங்கள் முதல் 15 நாள் திட்டம் தயார்! மீதமுள்ள நாட்களுக்கான திட்டம் பின்னணியில் உருவாக்கப்படுகிறது.')
        : (config.language === 'en'
          ? '🎉 Your study plan is ready!'
          : '🎉 உங்கள் ஆய்வுத் திட்டம் தயார்!');
      alert(msg);
    }, 500);

    // Background extension: If we only got 15 days and more are needed
    if (processedSchedule.length === 15 && totalDaysRequested > 15) {
      const remainingDays = totalDaysRequested - 15;
      const daysToGenerate = Math.min(15, remainingDays);
      const lastDay = processedSchedule[14];

      const completedTopics = syllabus.flatMap(s => s.topics.map(t => t.name)).filter(t =>
        processedSchedule.some(d => d.tasks.some(task => task.toLowerCase().includes(t.toLowerCase())))
      );

      generateSchedule(syllabus, { ...config, daysToGenerate } as any, state.questionPapersContent, {
        completedTopics,
        missedTopics: [],
        hardTopics: state.hardTopics || [],
        lastGeneratedDate: lastDay.date
      }).then(extendedDays => {
        setState(prev => {
          if (!prev.schedule) return prev;
          // Avoid duplicates
          const existingDates = new Set(prev.schedule.map(d => d.date));
          const newDays = extendedDays.filter(d => !existingDates.has(d.date)).map(day => ({
            ...day,
            id: day.id.includes('day-') && day.id.length < 10 ? `day-${day.date}` : day.id
          }));

          const newState = {
            ...prev,
            schedule: [...prev.schedule, ...newDays]
          };
          saveState(newState, currentUser?.email);
          return newState;
        });
      }).catch(err => console.error("Background extension failed", err));
    }
  };

  const handleToggleTask = (dayId: string, taskIndex: number, mcqCount: number = 0) => {
    setState(prev => {
      if (!prev.schedule) return prev;

      let xpGain = 0;
      let earnedBadges = [...(prev.badges || [])];
      const nextSchedule = prev.schedule.map((day, idx) => {
        if (day.id === dayId) {
          const task = day.tasks[taskIndex];
          const completedTasks = day.completedTasks || [];
          const isDone = completedTasks.includes(task);

          const nextCompleted = isDone
            ? completedTasks.filter(t => t !== task)
            : [...completedTasks, task];

          const nextMcqs = { ...(day.mcqsAttempted || {}) };
          if (isDone) {
            delete nextMcqs[task];
          } else {
            nextMcqs[task] = mcqCount;
          }

          // ADAPTIVE: If score is low (< 5/10 which is mcqCount < 10), 
          // inject "Deep Revision" for the next day's study day.
          if (!isDone && mcqCount > 0 && mcqCount < 10) {
            // Find next study day
            for (let i = idx + 1; i < prev.schedule!.length; i++) {
              const nextDay = prev.schedule![i];
              if (nextDay.type === 'STUDY' || nextDay.type === 'REVISION') {
                const revisionTask = `[Adaptive] Deep Revision: ${task}`;
                // Ensure we don't add the same revision task multiple times
                if (!nextDay.tasks.includes(revisionTask)) {
                  // Create a new day object to maintain immutability
                  prev.schedule![i] = {
                    ...nextDay,
                    tasks: [...nextDay.tasks, revisionTask]
                  };
                }
                break;
              }
            }
          }

          const dayFullyCompleted = nextCompleted.length === day.tasks.length;
          return {
            ...day,
            completedTasks: nextCompleted,
            mcqsAttempted: nextMcqs,
            isCompleted: dayFullyCompleted
          };
        }
        return day;
      });

      const newXp = (prev.xp || 0) + xpGain;
      const newLevel = Math.floor(newXp / 100) + 1;

      const newState = {
        ...prev,
        schedule: [...nextSchedule], // Ensure new array reference
        xp: newXp,
        level: newLevel,
        badges: earnedBadges
      };
      saveState(newState, currentUser?.email);
      return newState;
    });
  };

  const handleMarkHard = (topic: string) => {
    setState(prev => {
      const isHard = (prev.hardTopics || []).includes(topic);
      const nextHard = isHard
        ? prev.hardTopics.filter(t => t !== topic)
        : [...(prev.hardTopics || []), topic];

      const newState = { ...prev, hardTopics: nextHard };
      saveState(newState, currentUser?.email);
      return newState;
    });
  };

  const handleOpenSetup = () => {
    setState(prev => ({ ...prev, setupMode: 'ai' }));
  };

  const handleContinueSchedule = async () => {
    if (!state.user || !state.syllabus) return;

    setLoading(true);
    try {
      // Extract progress
      const completedTopics: string[] = [];
      const missedTopics: string[] = [];
      let lastDate = '';

      state.schedule?.forEach(day => {
        if (day.date > lastDate) lastDate = day.date;
        day.tasks.forEach(task => {
          if (day.completedTasks?.includes(task)) completedTopics.push(task);
          else if (new Date(day.date) < new Date()) missedTopics.push(task);
        });
      });

      const nextSchedule = await generateSchedule(
        state.syllabus,
        state.user,
        '',
        { completedTopics, missedTopics, hardTopics: state.hardTopics || [], lastGeneratedDate: lastDate }
      );

      // Ensure unique IDs
      const processed = nextSchedule.map(day => ({
        ...day,
        id: day.id.includes('day-') && day.id.length < 10 ? `day-${day.date}` : day.id
      }));

      setState(prev => ({
        ...prev,
        schedule: [...(prev.schedule || []), ...processed]
      }));
    } catch (error) {
      console.error("Quick continue failed", error);
      alert(lang === 'en' ? 'Failed to continue. Try the full regeneration.' : 'தொடர முடியவில்லை. முழுமையாக மீண்டும் உருவாக்கவும்.');
    } finally {
      setLoading(false);
    }
  };

  // Proactive check: If schedule ends within 5 days, and not already loading
  useEffect(() => {
    if (!state.schedule || state.schedule.length === 0 || loading) return;

    const lastDay = state.schedule[state.schedule.length - 1];
    const lastDate = new Date(lastDay.date);
    const today = new Date();
    const diffDays = Math.ceil((lastDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 5 && diffDays >= 0) {
      // We could show a specific notification or just rely on the button in ScheduleView
      console.log(`[Proactive] Schedule ends in ${diffDays} days. Offering quick continue...`);
    }
  }, [state.schedule, loading]);

  const t = TRANSLATIONS[lang];


  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      lang={lang}
      setLang={(l) => {
        setLang(l);
        setState(s => s.user ? { ...s, user: { ...s.user, language: l } } : s);
      }}
      streak={state.streak}
      theme={theme}
      toggleTheme={toggleTheme}
      hasSchedule={!!state.schedule && state.schedule.length > 0}
    >
      <div className="space-y-6">
        {state.setupMode === 'ai' ? (
          <SetupView
            lang={lang}
            onComplete={handleSetupComplete}
            initialConfig={state.user}
            initialSyllabus={state.syllabus}
          />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                lang={lang}
                state={state}
                onRegenerateSchedule={handleOpenSetup}
                loading={loading}
                onUpdateState={(ns) => { setState(ns); saveState(ns, currentUser?.email); }}
              />
            )}

            {activeTab === 'schedule' && (
              <ScheduleView
                lang={lang}
                schedule={state.schedule || []}
                syllabus={state.syllabus || []}
                onToggleTask={handleToggleTask}
                onMarkHard={handleMarkHard}
                hardTopics={state.hardTopics}
                onRegenerateSchedule={handleContinueSchedule}
                loading={loading}
              />
            )}

            {activeTab === 'syllabus' && (
              <SyllabusView
                lang={lang}
                syllabus={state.syllabus || []}
              />
            )}

            {activeTab === 'subscription' && <SubscriptionPage lang={lang} />}
            {activeTab === 'about' && <AboutPage lang={lang} />}
            {activeTab === 'contact' && <ContactPage lang={lang} />}

            {activeTab === 'history' && (
              <HistoryView
                lang={lang}
                state={state}
              />
            )}

            {activeTab === 'currentAffairs' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900">{t.currentAffairs}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-gray-500 text-sm">{t.weeklyCA}</p>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-full uppercase tracking-tighter">Live Updates</span>
                      <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-[10px] font-black rounded-full uppercase tracking-tighter">Last 7 Days</span>
                    </div>
                  </div>
                  <button
                    onClick={handleFetchCA}
                    disabled={loading}
                    className="bg-sky-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-sky-700 disabled:opacity-50 transition-all shadow-lg shadow-sky-200 flex items-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        {t.searchingWeb.split('...')[0]}
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        <span>{t.fetchLatest}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {state.currentAffairs && state.currentAffairs.length > 0 ? (
                    state.currentAffairs.map(ca => (
                      <div key={ca.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center space-x-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${ca.category === 'STATE' ? 'bg-purple-100 text-purple-700' :
                              ca.category === 'NATIONAL' ? 'bg-blue-100 text-blue-700' :
                                ca.category === 'ECONOMY' ? 'bg-green-100 text-green-700' :
                                  ca.category === 'SCIENCE' ? 'bg-amber-100 text-amber-700' :
                                    'bg-gray-100 text-gray-700'
                              }`}>
                              {ca.category}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-[8px] font-black tracking-widest uppercase border ${ca.relevance === 'High' ? 'bg-red-50 text-red-600 border-red-100' :
                              ca.relevance === 'Medium' ? 'bg-sky-50 text-sky-600 border-sky-100' :
                                'bg-gray-50 text-gray-500 border-gray-100'
                              }`}>
                              {ca.relevance}
                            </span>
                          </div>
                          <span className="text-xs font-medium text-gray-400">{ca.date}</span>
                        </div>
                        <h3 className="font-bold text-gray-900 text-lg mb-3 leading-snug group-hover:text-sky-600 transition-colors">
                          {ca.title}
                        </h3>
                        <p className="text-sm text-gray-600 leading-relaxed mb-4 line-clamp-3">
                          {ca.summary}
                        </p>
                        {ca.sources && ca.sources.length > 0 && (
                          <div className="pt-4 border-t border-gray-50 flex flex-wrap gap-3">
                            {ca.sources.map((s, i) => (
                              <a
                                key={i}
                                href={s.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs font-bold text-sky-600 hover:text-sky-800 flex items-center bg-sky-50 px-2 py-1 rounded"
                              >
                                <span className="mr-1">🔗</span>
                                {s.title}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="md:col-span-2 py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                      <div className="text-4xl mb-4">📰</div>
                      <h3 className="text-lg font-bold text-gray-400">{t.noResults}</h3>
                      <p className="text-sm text-gray-400">{t.fetchLatest} to see news.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!['dashboard', 'schedule', 'currentAffairs', 'syllabus', 'subscription', 'history'].includes(activeTab) && (
              <div className="py-20 text-center">
                <div className="text-4xl mb-4">🚧</div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {t[activeTab as keyof typeof t] || activeTab}
                </h2>
                <p className="text-gray-500 mt-2">This section is currently being tailored for you.</p>
                <button
                  onClick={() => setState(s => ({ ...s, setupMode: 'ai' }))}
                  className="mt-6 text-sky-600 font-bold hover:underline"
                >
                  {t.setup}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<MainApp />} />
            <Route path="/subscription" element={<MainApp />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
