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
    const [showRankJourney, setShowRankJourney] = React.useState(false);

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
                            const mcqs = day.mcqsAttempted?.[task] || 0;
                            if (mcqs >= 20) {
                                completedSubjectTasks++;
                            } else if (mcqs > 0) {
                                completedSubjectTasks += 0.4; // Partial credit
                            }
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

    const distributionData = [
        { name: 'Study', value: 70 },
        { name: 'Revision', value: 20 },
        { name: 'Mock Tests', value: 10 },
    ];

    // Weighted Marks Calculation
    const calculateWeightedProgress = () => {
        if (!state.schedule || !state.syllabus) return { syllabus: 0, marks: 0, mastery: 0 };

        let totalSyllabusTopics = 0;
        let completedSyllabusTopics = 0;
        let totalMarks = 0;
        let coveredMarks = 0;
        let mastersCount = 0;

        const allTopics = state.syllabus.flatMap(s => s.topics);

        state.schedule.forEach(day => {
            day.tasks.forEach(task => {
                totalSyllabusTopics++;

                // Find topic in syllabus to get its weight
                const taskLower = task.toLowerCase();
                const topicMeta = allTopics.find(t => taskLower.includes(t.name.toLowerCase()));
                const weight = topicMeta?.marksWeight || 5; // Default weight 5

                totalMarks += weight;

                if (day.completedTasks?.includes(task)) {
                    completedSyllabusTopics++;
                    const mcqs = day.mcqsAttempted?.[task] || 0;

                    if (mcqs >= 20) {
                        coveredMarks += weight;
                        mastersCount++;
                    } else if (mcqs > 0) {
                        // Partial credit for some validation
                        coveredMarks += weight * 0.4;
                    }
                }
            });
        });

        return {
            syllabus: totalSyllabusTopics > 0 ? Math.round((completedSyllabusTopics / totalSyllabusTopics) * 100) : 0,
            marks: totalMarks > 0 ? Math.round((coveredMarks / totalMarks) * 100) : 0,
            mastery: mastersCount
        };
    };

    const stats = calculateWeightedProgress();

    // Mentor Insights Logic
    const generateMentorInsights = () => {
        const insights: string[] = [];
        if (stats.marks < stats.syllabus - 10) {
            insights.push(lang === 'en'
                ? "💡 Your 'Syllabus Covered' is high, but 'Marks Covered' is low. Focus on High-Weight topics and validating with 20+ MCQs."
                : "💡 உங்கள் பாடத்திட்ட அளவு அதிகமாக உள்ளது, ஆனால் மதிப்பெண் அளவு குறைவாக உள்ளது. அதிக மதிக்கூடுதல் உள்ள தலைப்புகளில் கவனம் செலுத்துங்கள்.");
        }

        const weakSubj = weakSubjects[0];
        if (weakSubj) {
            insights.push(lang === 'en'
                ? `🎯 Critical: Your performance in ${weakSubj.name} (${weakSubj.percentage}%) is slowing down your growth. Allocate more time here.`
                : `🎯 முக்கியமானது: ${weakSubj.name} பாடத்தில் உங்கள் முன்னேற்றம் (${weakSubj.percentage}%) குறைவாக உள்ளது.`);
        }

        if (stats.mastery < 5) {
            insights.push(lang === 'en'
                ? "🛡️ Mastery Alert: You have few validated topics. Remember, a topic is only yours if you solve 20+ PYQs/MCQs."
                : "🛡️ தேர்ச்சி எச்சரிக்கை: நீங்கள் சில தலைப்புகளையே முழுமையாக முடித்துள்ளீர்கள். 20 வினாக்களுக்கு மேல் பயிற்சி செய்தால் மட்டுமே அது முழுமையடையும்.");
        }

        return insights;
    };

    const mentorInsights = generateMentorInsights();

    // Gamification calculations
    const currentRank = [...RANKS].reverse().find(r => (state.level || 1) >= r.level) || RANKS[0];
    const nextRankIndex = RANKS.findIndex(r => r.level === currentRank.level) + 1;
    const nextRank = RANKS[nextRankIndex] || null;
    const xpProgress = (state.xp || 0) % 100;

    // Get topics for practice question (last few completed or upcoming)
    const relevantTopics = state.schedule?.find(d => !d.isCompleted)?.tasks || [];

    const hasSchedule = !!state.schedule && state.schedule.length > 0;

    if (!hasSchedule) {
        return (
            <div className="space-y-8 pb-10">
                <div className="bg-sky-900 overflow-hidden relative rounded-3xl p-8 md:p-16 shadow-2xl shadow-sky-200 group transition-all duration-500">
                    <div className="absolute top-0 right-0 w-80 h-80 opacity-[0.08] grayscale invert transform translate-x-10 -translate-y-10 group-hover:scale-110 transition-transform duration-700">
                        <img src="/logo.png" alt="" className="w-full h-full object-contain" />
                    </div>

                    <div className="relative z-10 max-w-2xl">
                        <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md p-3 border border-white/20 mb-8">
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain filter drop-shadow-lg" />
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-6">
                            {lang === 'en' ? 'Welcome to Vetri Pathai Pro' : 'வெற்றிப்பாதை ப்ரோவிற்கு உங்களை வரவேற்கிறோம்'}
                        </h2>
                        <p className="text-sky-100 text-lg opacity-80 mb-10 leading-relaxed">
                            {lang === 'en'
                                ? 'Your ultimate companion for competitive exam success. Analyze your syllabus, generate a personalized study plan, and track your progress with AI-driven insights.'
                                : 'போட்டித் தேர்வுகளில் வெற்றி பெற உங்களின் சிறந்த துணை. உங்கள் பாடத்திட்டத்தை ஆய்வு செய்து, உங்களுக்காவே வடிவமைக்கப்பட்ட ஆய்வுத் திட்டத்தைப் பெற்று, AI மூலம் உங்கள் முன்னேற்றத்தைக் கண்காணியுங்கள்.'}
                        </p>
                        <button
                            onClick={onRegenerateSchedule}
                            disabled={loading}
                            className="bg-white text-sky-900 px-10 py-5 rounded-2xl font-black text-xl shadow-xl hover:bg-sky-50 transition-all hover:scale-105 active:scale-95 flex items-center space-x-3"
                        >
                            <span>🚀</span>
                            <span>{lang === 'en' ? 'Generate My First Study Plan' : 'எனது முதல் ஆய்வுத் திட்டத்தை உருவாக்கு'}</span>
                        </button>
                    </div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {[
                        { icon: '📅', title: lang === 'en' ? 'Smart Scheduling' : 'ஸ்மார்ட் அட்டவணை', desc: lang === 'en' ? 'AI-powered study plans tailored to your pace.' : 'உங்கள் வேகத்திற்கு ஏற்ப AI மூலம் வடிவமைக்கப்பட்ட ஆய்வுத் திட்டம்.' },
                        { icon: '📊', title: lang === 'en' ? 'Progress Tracking' : 'முன்னேற்றக் கண்காணிப்பு', desc: lang === 'en' ? 'Visual charts to keep you motivated and on track.' : 'உற்சாகமாகவும் பாதையிலும் இருக்க உதவும் வரைபடங்கள்.' },
                        { icon: '🎙️', title: lang === 'en' ? 'AI Briefing' : 'AI சுருக்கம்', desc: lang === 'en' ? 'Listen to daily summaries of your study goals.' : 'தினசரி ஆய்வு இலக்குகளின் ஆடியோ விளக்கத்தைக் கேளுங்கள்.' }
                    ].map((item, i) => (
                        <div key={i} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                            <span className="text-4xl mb-4 block">{item.icon}</span>
                            <h3 className="font-black text-gray-900 text-xl mb-2">{item.title}</h3>
                            <p className="text-gray-500 text-sm">{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            {/* Rank Journey Modal */}
            {showRankJourney && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-indigo-900/60 backdrop-blur-md" onClick={() => setShowRankJourney(false)}></div>
                    <div className="bg-white rounded-[32px] max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl relative z-10 animate-in slide-in-from-bottom-8 duration-500">
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-20">
                            <div>
                                <h3 className="text-2xl font-black text-indigo-900">{t.rankJourney}</h3>
                                <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">{t.careerPath}</p>
                            </div>
                            <button onClick={() => setShowRankJourney(false)} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                        </div>

                        <div className="p-8 space-y-10">
                            {/* XP Guide */}
                            <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100/50">
                                <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest mb-4 flex items-center">
                                    <span className="mr-2">⚡</span> {t.xpGuideTitle}
                                </h4>
                                <div className="space-y-2 text-sm font-bold text-indigo-900/70">
                                    <div className="flex justify-between"><span>{t.xpGuideTask}</span> <span className="text-indigo-600">+5 XP</span></div>
                                    <div className="flex justify-between items-center">
                                        <span>{t.xpGuideMastery}</span>
                                        <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full">+15 XP</span>
                                    </div>
                                    <div className="flex justify-between"><span>{t.xpGuideDay}</span> <span className="text-indigo-600">+30 XP</span></div>
                                </div>
                            </div>

                            {/* Progression Ladder */}
                            <div className="relative pl-12 space-y-8">
                                <div className="absolute left-5 top-2 bottom-2 w-1 bg-indigo-100 rounded-full"></div>
                                {RANKS.map((rank, i) => {
                                    const isAchieved = (state.level || 1) >= rank.level;
                                    const isCurrent = currentRank.level === rank.level;

                                    return (
                                        <div key={i} className={`relative transition-all duration-500 ${isAchieved ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                                            <div className={`absolute -left-12 w-10 h-10 rounded-xl flex items-center justify-center text-xl z-10 border-4 border-white shadow-lg transition-transform ${isCurrent ? 'bg-indigo-600 scale-125 ring-4 ring-indigo-200' : isAchieved ? 'bg-indigo-200' : 'bg-gray-200'}`}>
                                                {isAchieved ? rank.icon : '🔒'}
                                            </div>
                                            <div className="flex flex-col">
                                                <h4 className={`font-black ${isCurrent ? 'text-indigo-600' : 'text-gray-900'}`}>{rank.name}</h4>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Level {rank.level}</p>
                                                {isCurrent && (
                                                    <div className="mt-2 bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full w-max animate-pulse">
                                                        Current Rank
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {state.motivation && (
                <div className="bg-sky-900 overflow-hidden relative rounded-3xl p-8 md:p-12 shadow-2xl shadow-sky-200 group transition-all duration-500 hover:shadow-sky-300/40">
                    <div className="absolute top-0 right-0 w-64 h-64 translate-x-10 -translate-y-10 opacity-[0.08] grayscale invert transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000">
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
                <div
                    onClick={() => setShowRankJourney(true)}
                    className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-3xl border border-indigo-200 flex flex-col justify-between dark:from-slate-800 dark:to-slate-800 dark:border-slate-700 cursor-pointer group transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-indigo-200/50"
                >
                    <div>
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest">{lang === 'en' ? 'Current Rank' : 'தற்போதைய நிலை'}</p>
                            <span className="text-xl group-hover:rotate-12 transition-transform">{currentRank.icon}</span>
                        </div>
                        <p className="text-2xl font-black text-indigo-900 dark:text-indigo-200">{currentRank.name}</p>
                        <div className="flex items-center space-x-2 mt-1">
                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">Level {state.level || 1}</p>
                            {nextRank && (
                                <span className="text-[8px] bg-indigo-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
                                    Next: {nextRank.name}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="flex justify-between text-[8px] font-black text-indigo-400 uppercase mb-1">
                            <span>XP: {state.xp || 0}</span>
                            <span>Next: {100 - xpProgress} XP</span>
                        </div>
                        <div className="w-full h-1.5 bg-indigo-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${xpProgress}%` }}></div>
                        </div>
                        <p className="text-[8px] text-center text-indigo-400 mt-2 font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Click to view Career Path</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-sky-100 dark:border-slate-700 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="text-4xl">🎯</span>
                    </div>
                    <div>
                        <p className="text-sky-600 dark:text-sky-400 text-[10px] font-black uppercase tracking-widest mb-1">Marks Coverage (Weighted)</p>
                        <p className="text-4xl font-black text-sky-700 dark:text-sky-200">{stats.marks}%</p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                            Evidence-based: {stats.mastery} Topics Mastered
                        </p>
                    </div>
                    <div className="mt-4 space-y-2">
                        <div className="w-full h-2 bg-sky-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-sky-600 rounded-full transition-all duration-1000" style={{ width: `${stats.marks}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center text-[8px] font-black text-gray-400 uppercase">
                            <span>Syllabus: {stats.syllabus}%</span>
                            <span className="text-sky-600 font-black">Goal: 100% Marks</span>
                        </div>
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

            {/* Mentor Insights Widget */}
            {mentorInsights.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 shadow-sm">
                    <h3 className="text-amber-800 font-black text-sm uppercase tracking-widest mb-4 flex items-center">
                        <span className="mr-2">🧑‍🏫</span> AI Mentor Insights
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        {mentorInsights.map((insight, idx) => (
                            <div key={idx} className="bg-white/60 p-4 rounded-2xl text-sm text-gray-700 font-medium leading-relaxed border border-amber-100/50">
                                {insight}
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
