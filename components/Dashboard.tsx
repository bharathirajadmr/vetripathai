import React from 'react';
import { TRANSLATIONS, RANKS } from '../constants';
import { fetchDailySummary } from '../services/gemini';
import { Language, AppState } from '../types';
import { CompletionChart, CircularChart } from './Charts';
import PracticeQuestion from './PracticeQuestion';

interface DashboardProps {
    lang: Language;
    state: AppState;
    onRegenerateSchedule?: () => void;
    loading?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ lang, state, onRegenerateSchedule, loading }) => {
    const t = TRANSLATIONS[lang];
    const [summaryLoading, setSummaryLoading] = React.useState(false);

    const handlePlaySummary = async () => {
        if (!state.schedule) return;

        const today = new Date().toISOString().split('T')[0];
        const todaysTasks = state.schedule.find(d => d.date >= today)?.tasks || [];

        if (todaysTasks.length === 0) return;

        setSummaryLoading(true);
        try {
            const summary = await fetchDailySummary(todaysTasks, lang);

            // Text to Speech
            const utterance = new SpeechSynthesisUtterance(summary);
            utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
            utterance.rate = 0.9; // Slightly slower for clarity
            utterance.pitch = 1;

            // Try to find a better voice if available
            const voices = window.speechSynthesis.getVoices();
            if (lang === 'en') {
                const premiumVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Premium'));
                if (premiumVoice) utterance.voice = premiumVoice;
            }

            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.error('Audio summary failed', error);
        } finally {
            setSummaryLoading(false);
        }
    };

    // Calculate stats
    const totalTasks = state.schedule?.reduce((acc, day) => acc + day.tasks.length, 0) || 0;
    const completedTasks = state.schedule?.reduce((acc, day) => acc + (day.completedTasks?.length || 0), 0) || 0;
    const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Mock data for charts (would be real in a full implementation)
    // Calculate Real Subject Progress
    const calculateSubjectProgress = () => {
        if (!state.schedule || !state.syllabus) return [];

        return state.syllabus.map(subj => {
            const allSubjTopics = subj.topics.map(t => t.name.toLowerCase());

            let totalSubjectTasks = 0;
            let completedSubjectTasks = 0;

            state.schedule?.forEach(day => {
                day.tasks.forEach(task => {
                    const taskLower = task.toLowerCase();
                    // Match task to subject if topic name is inside task string
                    const isTaskForSubject = allSubjTopics.some(topicName => taskLower.includes(topicName));

                    if (isTaskForSubject) {
                        totalSubjectTasks++;
                        if (day.completedTasks?.includes(task)) {
                            completedSubjectTasks++;
                        }
                    }
                });
            });

            const percentage = totalSubjectTasks > 0 ? Math.round((completedSubjectTasks / totalSubjectTasks) * 100) : 0;
            return { name: subj.subject, percentage, total: totalSubjectTasks };
        });
    };

    const subjectProgress = calculateSubjectProgress();
    const weakSubjects = subjectProgress
        .filter(s => s.total > 0 && s.percentage < 50)
        .sort((a, b) => a.percentage - b.percentage);

    const consistencyData = [
        { date: 'Mon', hours: 4 },
        { date: 'Tue', hours: 3 },
        { date: 'Wed', hours: 5 },
        { date: 'Thu', hours: 2 },
        { date: 'Fri', hours: 4 },
        { date: 'Sat', hours: 6 },
        { date: 'Sun', hours: 1 },
    ];

    const distributionData = [
        { name: 'Study', value: 70 },
        { name: 'Revision', value: 20 },
        { name: 'Mock Tests', value: 10 },
    ];

    // Gamification calculations
    const currentRank = [...RANKS].reverse().find(r => (state.level || 1) >= r.level) || RANKS[0];
    const xpProgress = (state.xp || 0) % 100;

    // Get topics for practice question (last few completed or upcoming)
    const relevantTopics = state.schedule?.find(d => !d.isCompleted)?.tasks || [];

    return (
        <div className="space-y-8 pb-10">
            {state.motivation && (
                <div className="bg-sky-900 overflow-hidden relative rounded-3xl p-8 md:p-12 shadow-2xl shadow-sky-200 group transition-all duration-500 hover:shadow-sky-300/40">
                    <div className="absolute -top-12 -right-12 w-64 h-64 opacity-[0.07] grayscale invert transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000">
                        <img src="/logo.png" alt="" className="w-full h-full object-contain" />
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center space-y-6 md:space-y-0">
                        <div className="max-w-2xl flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-8">
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-white/10 backdrop-blur-md p-4 border border-white/20 shadow-2xl group-hover:scale-105 transition-transform flex items-center justify-center">
                                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain filter drop-shadow-lg" />
                            </div>
                            <div className="text-center md:text-left">
                                <p className="text-sky-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4">{t.dailyQuote}</p>
                                <h2 className="text-2xl md:text-4xl font-black text-white leading-tight italic">
                                    "{state.motivation}"
                                </h2>
                            </div>
                        </div>
                        <button
                            onClick={handlePlaySummary}
                            disabled={summaryLoading}
                            className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-6 py-4 rounded-2xl flex items-center space-x-3 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 group self-center md:self-auto"
                        >
                            <span className="text-2xl group-hover:animate-pulse">{summaryLoading ? '⏳' : '🎙️'}</span>
                            <div className="text-left">
                                <p className="text-[8px] font-black uppercase tracking-widest opacity-60">AI Audio</p>
                                <p className="text-sm font-black whitespace-nowrap">{lang === 'en' ? 'Listen to Briefing' : 'ஆடியோ விளக்கம்'} </p>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-3xl border border-indigo-200 flex flex-col justify-between dark:from-slate-800 dark:to-slate-800 dark:border-slate-700">
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest">{lang === 'en' ? 'Current Rank' : 'தற்போதைய நிலை'}</p>
                            <span className="text-xl">{currentRank.icon}</span>
                        </div>
                        <p className="text-2xl font-black text-indigo-900 dark:text-indigo-200">{currentRank.name}</p>
                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1">Level {state.level || 1}</p>
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between text-[8px] font-black text-indigo-400 uppercase mb-1">
                            <span>XP: {state.xp || 0}</span>
                            <span>Next Level: {100 - xpProgress} XP</span>
                        </div>
                        <div className="w-full h-1.5 bg-indigo-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${xpProgress}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="bg-sky-50 dark:bg-slate-800 p-6 rounded-3xl border border-sky-100 dark:border-slate-700 flex flex-col justify-between">
                    <div>
                        <p className="text-sky-600 dark:text-sky-400 text-[10px] font-black uppercase tracking-widest mb-1">{t.progress}</p>
                        <p className="text-4xl font-black text-sky-700 dark:text-sky-200">{progressPercent}%</p>
                    </div>
                    <div className="mt-4 w-full h-1.5 bg-sky-200/50 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-600 rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>

                <div className="bg-emerald-50 dark:bg-slate-800 p-6 rounded-3xl border border-emerald-100 dark:border-slate-700 flex flex-col justify-between">
                    <div>
                        <p className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">{lang === 'en' ? 'Badges' : 'பதக்கங்கள்'}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {(state.badges || []).length > 0 ? (
                                state.badges.slice(0, 4).map(b => (
                                    <span key={b.id} title={b.name} className="text-2xl" role="img" aria-label={b.name}>{b.icon}</span>
                                ))
                            ) : (
                                <p className="text-xs text-emerald-600/50 font-bold">{lang === 'en' ? 'No badges yet' : 'பதக்கங்கள் இல்லை'}</p>
                            )}
                            {(state.badges || []).length > 4 && (
                                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-1 rounded-lg">+{state.badges.length - 4}</span>
                            )}
                        </div>
                    </div>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-60 font-bold mt-4">
                        {(state.badges || []).length === 0 ? 'Complete tasks to earn badges!' : 'Keep going for the next one!'}
                    </p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                <CompletionChart data={subjectProgress} type="bar" title={t.subjectWise} />
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-800">
                    <h3 className="text-xl font-black text-gray-800 dark:text-gray-200 mb-6 flex items-center">
                        <span className="w-1 h-6 bg-red-500 rounded-full mr-3" />
                        {lang === 'en' ? 'Subjects Needing Attention' : 'கவனம் தேவைப்படும் பாடங்கள்'}
                    </h3>
                    <div className="space-y-4">
                        {weakSubjects.length > 0 ? (
                            weakSubjects.slice(0, 3).map(s => (
                                <div key={s.name} className="flex flex-col space-y-2">
                                    <div className="flex justify-between items-center text-sm font-bold">
                                        <span className="text-gray-700 dark:text-gray-300">{s.name}</span>
                                        <span className="text-red-500">{s.percentage}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-400 rounded-full transition-all duration-1000"
                                            style={{ width: `${s.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-10 text-center text-gray-400 font-medium">
                                {lang === 'en' ? 'Great job! No weak subjects found.' : 'சிறப்பு! பலவீனமான பாடங்கள் எதுவும் இல்லை.'}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                <CircularChart data={distributionData} type="bar" title={lang === 'en' ? 'Time Distribution' : 'நேர ஒதுக்கீடு'} />
                <div className="bg-sky-600 p-8 rounded-3xl text-white flex flex-col justify-center items-center text-center space-y-4 shadow-xl shadow-sky-200">
                    <h3 className="text-xl font-black">{lang === 'en' ? 'Need a new plan?' : 'புதிய திட்டம் வேண்டுமா?'}</h3>
                    <p className="text-sky-100 text-sm opacity-80">{lang === 'en' ? 'Adjust your schedule based on your current progress.' : 'உங்கள் தற்போதைய முன்னேற்றத்தின் அடிப்படையில் அட்டவணையை மாற்றியமைக்கவும்.'}</p>
                    <button
                        onClick={onRegenerateSchedule}
                        disabled={loading}
                        className="bg-white text-sky-600 px-8 py-3 rounded-2xl font-black hover:bg-sky-50 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {loading ? '...' : (lang === 'en' ? 'Regenerate Schedule' : 'அட்டவணையை மீண்டும் உருவாக்கு')}
                    </button>
                </div>
            </div>

            <PracticeQuestion
                lang={lang}
                topics={relevantTopics}
                questionPapers={state.questionPapersContent}
            />
        </div>
    );
};

export default Dashboard;
