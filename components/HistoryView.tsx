import React from 'react';
import { Language, AppState } from '../types';
import { TRANSLATIONS } from '../constants';

interface HistoryViewProps {
    lang: Language;
    state: AppState;
}

const HistoryView: React.FC<HistoryViewProps> = ({ lang, state }) => {
    const t = TRANSLATIONS[lang];

    // Extract all completed tasks with their dates
    const activityLog = (state.schedule || [])
        .filter(day => day.completedTasks && day.completedTasks.length > 0)
        .flatMap(day =>
            day.completedTasks!.map(task => ({
                task,
                date: day.date,
                isHard: state.hardTopics?.includes(task),
                score: day.mcqsAttempted?.[task]
            }))
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-3xl font-black text-orange-600 dark:text-orange-400 tracking-tight mb-2">
                        {lang === 'en' ? 'Your Study Journey' : 'உங்கள் படிப்பு பயணம்'}
                    </h2>
                    <p className="text-gray-500 dark:text-slate-400 font-medium">
                        {lang === 'en' ? 'Tracking your consistency and growth.' : 'உங்கள் தொடர்ச்சி மற்றும் வளர்ச்சியை கண்காணித்தல்.'}
                    </p>
                </div>

                <div className="flex gap-4">
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm text-center min-w-[100px]">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">XP</p>
                        <p className="text-xl font-black text-sky-600">{state.xp || 0}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm text-center min-w-[100px]">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rank</p>
                        <p className="text-xl font-black text-amber-500">{state.level || 1}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm text-center min-w-[100px]">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Best Streak</p>
                        <p className="text-xl font-black text-orange-500">{state.longestStreak || state.streak || 0}</p>
                    </div>
                </div>
            </div>

            {/* Achievement Board */}
            <section>
                <div className="flex items-center space-x-3 mb-6">
                    <span className="text-2xl">🏆</span>
                    <h3 className="text-xl font-black text-orange-600 dark:text-orange-400 uppercase tracking-tight">
                        {lang === 'en' ? 'Achievement Board' : 'சாதனை பலகை'}
                    </h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {state.badges && state.badges.length > 0 ? (
                        state.badges.map(badge => (
                            <div
                                key={badge.id}
                                className="bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col items-center text-center group hover:scale-105 transition-all duration-300"
                            >
                                <div className="w-16 h-16 bg-sky-100 dark:bg-sky-900/30 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:rotate-12 transition-transform shadow-inner">
                                    {badge.icon}
                                </div>
                                <h4 className="font-black text-gray-900 dark:text-white text-sm mb-1">{badge.name}</h4>
                                <p className="text-[10px] text-gray-500 dark:text-slate-400 leading-tight mb-3">
                                    {badge.description}
                                </p>
                                {badge.unlockedDate && (
                                    <p className="text-[9px] font-bold text-sky-600/60 dark:text-sky-400/60 uppercase">
                                        {new Date(badge.unlockedDate).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full py-12 text-center bg-gray-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-slate-800">
                            <p className="text-gray-400 font-medium">
                                {lang === 'en' ? 'Complete tasks to earn your first badge!' : 'முதல் பேட்ஜைப் பெற பணிகளை முடிக்கவும்!'}
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Activity Timeline */}
            <section>
                <div className="flex items-center space-x-3 mb-6">
                    <span className="text-2xl">📜</span>
                    <h3 className="text-xl font-black text-orange-600 dark:text-orange-400 uppercase tracking-tight">
                        {lang === 'en' ? 'Activity Timeline' : 'செயல்பாட்டு காலவரிசை'}
                    </h3>
                </div>

                <div className="relative space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100 dark:before:bg-slate-800">
                    {activityLog.length > 0 ? (
                        activityLog.map((log, idx) => (
                            <div key={idx} className="relative pl-10 group">
                                <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-4 border-sky-500 dark:border-sky-600 z-10 group-hover:scale-125 transition-transform" />
                                <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm hover:border-sky-100 dark:hover:border-sky-900/50 transition-all">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="text-[10px] font-black text-sky-600/60 dark:text-sky-400/60 uppercase tracking-widest">
                                            {new Date(log.date).toLocaleDateString()}
                                        </p>
                                        {log.isHard && (
                                            <span className="text-amber-500 text-xs">⭐</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{log.task}</p>
                                        {log.score !== undefined && (
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${log.score >= 18 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {log.score / 2}/10
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="pl-10 text-gray-400 italic py-4">
                            {lang === 'en' ? 'No activities recorded yet.' : 'இன்னும் செயல்பாடுகள் எதுவும் பதிவு செய்யப்படவில்லை.'}
                        </div>
                    )}
                </div>
            </section>
            {/* Bookmarked Explanations */}
            {state.bookmarks && state.bookmarks.length > 0 && (
                <section className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
                    <div className="flex items-center space-x-3 mb-6">
                        <span className="text-2xl">🔖</span>
                        <h3 className="text-xl font-black text-amber-600 dark:text-amber-400 uppercase tracking-tight">
                            {lang === 'en' ? 'Saved Explanations' : 'சேமிக்கப்பட்ட விளக்கங்கள்'}
                        </h3>
                    </div>

                    <div className="grid gap-4">
                        {state.bookmarks.map((b, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-amber-100 dark:border-amber-900/30 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-full uppercase tracking-widest">
                                        {b.topic}
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-bold">
                                        {new Date(b.savedAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="font-black text-gray-900 dark:text-white mb-4 leading-tight">
                                    {b.question}
                                </p>
                                <div className="p-4 bg-sky-50 dark:bg-sky-900/20 rounded-2xl border border-sky-100 dark:border-sky-800">
                                    <p className="text-xs text-sky-800 dark:text-sky-300 leading-relaxed">
                                        <span className="font-black mr-2">🎯 Insight:</span>
                                        {b.explanation}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default HistoryView;
