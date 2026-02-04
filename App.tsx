
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
import { getMotivationalQuote, generateSchedule, fetchWeeklyCurrentAffairs } from './services/gemini.ts';

const MainApp: React.FC = () => {
  const { currentUser } = useAuth();
  const [state, setState] = useState<AppState>(loadState(currentUser?.email));
  const [loading, setLoading] = useState(false);
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
        const { syncStateFromBackend } = await import('./services/storage.ts');
        const backendState = await syncStateFromBackend(currentUser.email);
        if (backendState) {
          setState(backendState);
          setLang(backendState.user?.language || 'en');
          setTheme(backendState.user?.theme || 'light');
          return;
        }
      }
      const loadedState = loadState(currentUser?.email);
      setState(loadedState);
      setLang(loadedState.user?.language || 'en');
      setTheme(loadedState.user?.theme || 'light');
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
  }, [lang]);

  // Save state when state or user changes
  useEffect(() => {
    saveState(state, currentUser?.email);
  }, [state, currentUser]);

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
    setState(prev => ({
      ...prev,
      user: config,
      syllabus: syllabus,
      schedule: schedule,
      setupMode: undefined
    }));
    setLang(config.language);
    setTheme(config.theme || 'light');
    setActiveTab('dashboard');
  };

  const handleToggleTask = (dayId: string, taskIndex: number) => {
    setState(prev => {
      if (!prev.schedule) return prev;

      let xpGain = 0;
      let earnedBadges = [...(prev.badges || [])];
      const nextSchedule = prev.schedule.map(day => {
        if (day.id === dayId) {
          const task = day.tasks[taskIndex];
          const completedTasks = day.completedTasks || [];
          const isDone = completedTasks.includes(task);
          const nextCompleted = isDone
            ? completedTasks.filter(t => t !== task)
            : [...completedTasks, task];

          if (!isDone) {
            xpGain += 10;
            // Check for 'first_step' badge
            if (!earnedBadges.find(b => b.id === 'first_step')) {
              const def = BADGE_DEFINITIONS.find(b => b.id === 'first_step');
              if (def) earnedBadges.push({ ...def, unlockedDate: new Date().toISOString() });
            }
          }

          const dayFullyCompleted = nextCompleted.length === day.tasks.length;
          if (dayFullyCompleted && !day.isCompleted) {
            xpGain += 50; // Bonus for finishing a day
            // Check for 'perfectionist' badge
            if (!earnedBadges.find(b => b.id === 'perfectionist')) {
              const def = BADGE_DEFINITIONS.find(b => b.id === 'perfectionist');
              if (def) earnedBadges.push({ ...def, unlockedDate: new Date().toISOString() });
            }
          }

          return {
            ...day,
            completedTasks: nextCompleted,
            isCompleted: dayFullyCompleted
          };
        }
        return day;
      });

      const newXp = (prev.xp || 0) + xpGain;
      const newLevel = Math.floor(newXp / 100) + 1;

      const newState = {
        ...prev,
        schedule: nextSchedule,
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

  const handleRegenerateSchedule = async () => {
    if (!state.syllabus || !state.user) return;

    setLoading(true);
    try {
      // Extract completed and missed topics from current schedule
      const completedTopics: string[] = [];
      const missedTopics: string[] = [];
      let lastDate = '';

      state.schedule?.forEach(day => {
        if (day.date > lastDate) lastDate = day.date;

        day.tasks.forEach((task, idx) => {
          const isCompleted = day.completedTasks?.includes(task);
          if (isCompleted) {
            completedTopics.push(task);
          } else if (new Date(day.date) < new Date()) {
            // Past date but not completed = missed
            missedTopics.push(task);
          }
        });
      });

      const progressData = {
        completedTopics,
        missedTopics,
        hardTopics: state.hardTopics || [],
        lastGeneratedDate: lastDate
      };

      const newSchedule = await generateSchedule(
        state.syllabus,
        state.user,
        '', // questionPapersContent
        progressData
      );

      // Append new schedule to existing
      setState(prev => ({
        ...prev,
        schedule: [...(prev.schedule || []), ...newSchedule]
      }));
    } catch (error) {
      console.error('Failed to regenerate schedule', error);
      alert(lang === 'en' ? 'Failed to generate next period. Please try again.' : 'அடுத்த காலத்தை உருவாக்க முடியவில்லை.');
    } finally {
      setLoading(false);
    }
  };

  const t = TRANSLATIONS[lang];

  // If no schedule and not in setup, or if user explicitly wants setup
  const showSetup = !state.schedule || state.setupMode === 'ai';

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
    >
      <div className="space-y-6">
        {showSetup ? (
          <SetupView lang={lang} onComplete={handleSetupComplete} />
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                lang={lang}
                state={state}
                onRegenerateSchedule={handleRegenerateSchedule}
                loading={loading}
              />
            )}

            {activeTab === 'schedule' && (
              <ScheduleView
                lang={lang}
                schedule={state.schedule || []}
                onToggleTask={handleToggleTask}
                onMarkHard={handleMarkHard}
                hardTopics={state.hardTopics}
                onRegenerateSchedule={handleRegenerateSchedule}
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
                    <p className="text-gray-500 text-sm">{t.weeklyCA}</p>
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
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase ${ca.category === 'STATE' ? 'bg-purple-100 text-purple-700' :
                            ca.category === 'NATIONAL' ? 'bg-blue-100 text-blue-700' :
                              ca.category === 'ECONOMY' ? 'bg-green-100 text-green-700' :
                                ca.category === 'SCIENCE' ? 'bg-amber-100 text-amber-700' :
                                  'bg-gray-100 text-gray-700'
                            }`}>
                            {ca.category}
                          </span>
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
};

export default App;
