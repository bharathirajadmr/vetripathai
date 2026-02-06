
import React from 'react';
import { TRANSLATIONS, API_URL } from '../constants';
import { Language, StudyDay, SyllabusItem } from '../types';
import ReadinessDashboard from './ReadinessDashboard';

interface ScheduleViewProps {
    lang: Language;
    schedule: StudyDay[];
    syllabus?: SyllabusItem[];
    onToggleTask: (dayId: string, taskIndex: number, mcqCount: number) => void;
    onMarkHard?: (topic: string) => void;
    hardTopics?: string[];
    onRegenerateSchedule?: () => void;
    loading?: boolean;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ lang, schedule, syllabus = [], onToggleTask, onMarkHard, hardTopics = [], onRegenerateSchedule, loading }) => {
    const t = TRANSLATIONS[lang];
    const [validationModal, setValidationModal] = React.useState<{ dayId: string; taskIdx: number; taskName: string } | null>(null);
    const [quizLoading, setQuizLoading] = React.useState(false);
    const [quizQuestions, setQuizQuestions] = React.useState<any[] | null>(null);
    const [currentQuestion, setCurrentQuestion] = React.useState(0);
    const [answers, setAnswers] = React.useState<string[]>([]);
    const [quizScore, setQuizScore] = React.useState<number | null>(null);
    const [timeLeft, setTimeLeft] = React.useState(30);
    const [isReviewMode, setIsReviewMode] = React.useState(false);
    const [showResults, setShowResults] = React.useState(false);

    // Timer logic
    React.useEffect(() => {
        let timer: any;
        if (validationModal && quizQuestions && !showResults && !isReviewMode && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0 && !showResults && !isReviewMode) {
            handleAnswer('SKIPPED');
        }
        return () => clearInterval(timer);
    }, [timeLeft, validationModal, quizQuestions, showResults, isReviewMode]);

    const startQuiz = async (dayId: string, taskIdx: number, taskName: string, isWeekendTest = false) => {
        setValidationModal({ dayId, taskIdx, taskName });
        setQuizLoading(true);
        setQuizQuestions(null);
        setCurrentQuestion(0);
        setAnswers([]);
        setQuizScore(null);
        setTimeLeft(30);
        setIsReviewMode(false);
        setShowResults(false);

        try {
            let endpoint = '/api/topic-quiz';
            let body: any = { topic: taskName, lang };

            if (isWeekendTest) {
                endpoint = '/api/mock-test';

                // Weekend Test Logic
                const currentDayIdx = schedule.findIndex(d => d.id === dayId);
                const currentDay = schedule[currentDayIdx];
                const dayDate = new Date(currentDay.date);
                const isSunday = dayDate.getDay() === 0;

                let topicsToTest: string[] = [];

                if (isSunday) {
                    // Sunday: All topics from Day 1 to today
                    topicsToTest = schedule
                        .slice(0, currentDayIdx + 1)
                        .flatMap(d => d.tasks)
                        .filter(t => t !== 'Weekly Mock Test' && t !== 'Comprehensive Mock Test');
                } else {
                    // Saturday (or any other partial week test): Last 6 scheduled days
                    const startIdx = Math.max(0, currentDayIdx - 6);
                    topicsToTest = schedule
                        .slice(startIdx, currentDayIdx)
                        .flatMap(d => d.tasks)
                        .filter(t => t !== 'Weekly Mock Test' && t !== 'Comprehensive Mock Test');
                }

                body = {
                    completedTopics: Array.from(new Set(topicsToTest)),
                    lang,
                    subject: isSunday ? 'Comprehensive' : 'Weekly Review'
                };
            }

            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await response.json();
            if (result.success) {
                setQuizQuestions(result.data);
            }
        } catch (error) {
            console.error("Failed to load quiz", error);
        } finally {
            setQuizLoading(false);
        }
    };

    const handleAnswer = (option: string) => {
        const newAnswers = [...answers];
        newAnswers[currentQuestion] = option;
        setAnswers(newAnswers);

        if (currentQuestion < (quizQuestions?.length || 10) - 1) {
            setCurrentQuestion(currentQuestion + 1);
            setTimeLeft(30);
        } else {
            // Calculate Score
            let score = 0;
            quizQuestions?.forEach((q, idx) => {
                if (newAnswers[idx] === q.correctAnswer) score++;
            });
            setQuizScore(score);
            setShowResults(true);
        }
    };

    const handleBack = () => {
        if (currentQuestion > 0) {
            setCurrentQuestion(currentQuestion - 1);
            setTimeLeft(30);
        }
    };

    const handleRetry = () => {
        setCurrentQuestion(0);
        setAnswers([]);
        setQuizScore(null);
        setTimeLeft(30);
        setIsReviewMode(false);
        setShowResults(false);
    };

    const handleConfirmToggle = () => {
        if (validationModal && quizScore !== null) {
            // We pass the score as the "mcqCount" equivalent for the existing logic
            // The existing backend/storage uses mcqCount >= 20 for mastery,
            // so we scale the score (e.g., 10/10 -> 20, 5/10 -> 10)
            onToggleTask(validationModal.dayId, validationModal.taskIdx, quizScore * 2);
            setValidationModal(null);
        }
    };

    return (
        <div className="space-y-8 pb-20">
            {syllabus.length > 0 && <ReadinessDashboard lang={lang} schedule={schedule} syllabus={syllabus} />}

            {/* AI Mastery Validation Modal */}
            {validationModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-sky-900/60 backdrop-blur-md" onClick={() => !quizLoading && setValidationModal(null)}></div>
                    <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl relative z-10 animate-in zoom-in duration-300 overflow-hidden">
                        {quizLoading ? (
                            <div className="py-12 text-center space-y-4">
                                <div className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                                    <div className="absolute inset-0 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin"></div>
                                    <span className="text-3xl">🧩</span>
                                </div>
                                <h3 className="text-xl font-black text-sky-900">Generating Mastery Quiz</h3>
                                <p className="text-gray-500 animate-pulse text-sm">Finding actual exam trends for {validationModal.taskName}...</p>
                            </div>
                        ) : isReviewMode && quizQuestions ? (
                            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                                <h3 className="text-2xl font-black text-sky-900 border-b pb-4">Review Answers</h3>
                                {quizQuestions.map((q, idx) => {
                                    const userIdx = q.options.findIndex((_: any, i: number) => String.fromCharCode(65 + i) === answers[idx]);
                                    const correctIdx = q.options.findIndex((_: any, i: number) => String.fromCharCode(65 + i) === q.correctAnswer);
                                    const userFullAnswer = userIdx !== -1 ? q.options[userIdx] : 'Skipped';
                                    const correctFullAnswer = q.options[correctIdx];

                                    return (
                                        <div key={idx} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-2">
                                            <p className="font-bold text-slate-800 text-sm">{idx + 1}. {q.question}</p>
                                            <div className="flex flex-col space-y-2 text-xs">
                                                <div className={`p-2 rounded-xl border ${answers[idx] === q.correctAnswer ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                                    <span className="font-black uppercase mr-2">Your Answer:</span>
                                                    [{answers[idx] || '?'}] {userFullAnswer}
                                                </div>
                                                <div className="p-2 rounded-xl border bg-sky-50 border-sky-100 text-sky-700">
                                                    <span className="font-black uppercase mr-2">Correct Answer:</span>
                                                    [{q.correctAnswer}] {correctFullAnswer}
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-gray-500 leading-relaxed bg-white p-3 rounded-xl border border-gray-100">
                                                <span className="font-black text-sky-600 mr-1">Explanation:</span> {q.explanation}
                                            </p>
                                        </div>
                                    );
                                })}
                                <button
                                    onClick={() => setIsReviewMode(false)}
                                    className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all mt-4"
                                >
                                    Back to Summary
                                </button>
                            </div>
                        ) : showResults && quizScore !== null ? (
                            <div className="text-center space-y-6">
                                <div className="w-24 h-24 bg-sky-50 rounded-full flex items-center justify-center mx-auto text-5xl">
                                    {quizScore >= (quizQuestions?.length || 10) * 0.9 ? '👑' : quizScore >= (quizQuestions?.length || 10) * 0.7 ? '⭐' : '📖'}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-sky-900">Quiz Completed!</h3>
                                    <p className="text-sky-600 font-bold text-lg mt-1">Score: {quizScore}/{(quizQuestions?.length || 10)}</p>
                                    <div className="mt-4 px-6 py-3 rounded-2xl bg-gray-50 text-sm font-medium text-gray-600 italic">
                                        {quizScore === (quizQuestions?.length || 10) ? "Absolute Mastery! You're ready for the exam." :
                                            quizScore >= (quizQuestions?.length || 10) * 0.8 ? "Excellent! Minor revision might help." :
                                                quizScore >= (quizQuestions?.length || 10) * 0.5 ? "Good start, but focus on the explanations below." :
                                                    "Needs more focus. Study the core concepts again."}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setIsReviewMode(true)}
                                        className="bg-white border-2 border-sky-100 text-sky-600 py-4 rounded-2xl font-bold hover:bg-sky-50 transition-all"
                                    >
                                        Review Answers
                                    </button>
                                    <button
                                        onClick={handleRetry}
                                        className="bg-white border-2 border-sky-100 text-sky-600 py-4 rounded-2xl font-bold hover:bg-sky-50 transition-all"
                                    >
                                        Retry Quiz
                                    </button>
                                </div>
                                <button
                                    onClick={handleConfirmToggle}
                                    className="w-full bg-sky-600 text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-sky-200 hover:bg-sky-700 transition-all active:scale-95"
                                >
                                    Finish & Save Progress
                                </button>
                            </div>
                        ) : quizQuestions ? (
                            <div className="space-y-6">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center space-x-2">
                                        <span className="px-4 py-1.5 bg-sky-100 text-sky-700 text-xs font-black rounded-full uppercase tracking-widest">Question {currentQuestion + 1}/{quizQuestions.length}</span>
                                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${timeLeft <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-amber-100 text-amber-700'}`}>
                                            ⏱️ {timeLeft}s
                                        </span>
                                    </div>
                                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-sky-600 transition-all duration-500" style={{ width: `${((currentQuestion + 1) / quizQuestions.length) * 100}%` }}></div>
                                    </div>
                                </div>
                                <p className="text-xl font-black text-slate-800 leading-tight min-h-[5rem]">
                                    {quizQuestions[currentQuestion].question}
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                    {quizQuestions[currentQuestion].options.map((opt: string, i: number) => {
                                        const label = String.fromCharCode(65 + i); // A, B, C, D
                                        const isSelected = answers[currentQuestion] === label;
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => handleAnswer(label)}
                                                className={`group flex items-center p-4 rounded-2xl border-2 transition-all text-left ${isSelected
                                                        ? 'border-sky-600 bg-sky-50 shadow-md transform scale-[1.02]'
                                                        : 'border-slate-100 hover:border-sky-500 hover:bg-sky-50'
                                                    }`}
                                            >
                                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black mr-4 shrink-0 transition-colors ${isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 group-hover:bg-sky-200 text-slate-500 group-hover:text-sky-700'
                                                    }`}>
                                                    {label}
                                                </span>
                                                <span className={`font-bold leading-tight ${isSelected ? 'text-sky-900' : 'text-slate-700 group-hover:text-sky-900'}`}>
                                                    {opt}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {currentQuestion > 0 && (
                                    <button
                                        onClick={handleBack}
                                        className="w-full py-3 text-sky-600 font-black text-xs uppercase tracking-widest hover:bg-sky-50 rounded-xl transition-all border border-sky-100 border-dashed"
                                    >
                                        ← Previous Question
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <h3 className="text-xl font-black text-red-600">Failed to load quiz.</h3>
                                <button onClick={() => setValidationModal(null)} className="mt-4 text-sky-600 font-bold underline">Close</button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-sky-900">{t.schedule}</h2>
                    <p className="text-gray-500">{lang === 'en' ? 'Stay consistent, stay ahead.' : 'தொடர்ச்சியாக இருங்கள், முன்னிலையில் இருங்கள்.'}</p>
                </div>
                <div className="hidden md:block text-right">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.totalDays}</p>
                    <p className="text-2xl font-black text-sky-600">{schedule.length}</p>
                </div>
            </div>

            <div className="space-y-4">
                {schedule.map((day) => (
                    <div key={day.id} className={`bg-white rounded-2xl border transition-all ${day.isCompleted ? 'border-green-100 bg-green-50/20' : 'border-gray-100'}`}>
                        <div className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center space-x-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${day.type === 'STUDY' ? 'bg-sky-100 text-sky-600' :
                                        day.type === 'REVISION' ? 'bg-purple-100 text-purple-600' :
                                            day.type === 'MOCK_TEST' ? 'bg-orange-100 text-orange-600' :
                                                'bg-green-100 text-green-600'
                                        }`}>
                                        {day.type === 'STUDY' ? '📚' : day.type === 'REVISION' ? '🔄' : day.type === 'MOCK_TEST' ? '📝' : '🏝️'}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">{new Date(day.date).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${day.type === 'STUDY' ? 'text-sky-600' :
                                            day.type === 'REVISION' ? 'text-purple-600' :
                                                day.type === 'MOCK_TEST' ? 'text-orange-600' :
                                                    'text-green-600'
                                            }`}>{day.type}</p>
                                    </div>
                                </div>
                                {day.isCompleted && <span className="text-green-600 font-black text-xs bg-green-100 px-3 py-1 rounded-full">{t.complete}</span>}
                            </div>

                            <div className="space-y-3">
                                {day.tasks.map((task, idx) => {
                                    const isTaskDone = day.completedTasks?.includes(task);
                                    const mcqValue = day.mcqsAttempted?.[task] || 0;
                                    const isHard = hardTopics.includes(task);
                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-gray-100 hover:bg-gray-50/50 transition-all group"
                                        >
                                            <div
                                                onClick={() => {
                                                    if (isTaskDone) {
                                                        onToggleTask(day.id, idx, 0);
                                                    } else {
                                                        startQuiz(day.id, idx, task, day.type === 'MOCK_TEST');
                                                    }
                                                }}
                                                className="flex items-center space-x-3 cursor-pointer flex-1"
                                            >
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isTaskDone ? 'bg-sky-600 border-sky-600' : 'border-gray-300 group-hover:border-sky-400'}`}>
                                                    {isTaskDone && <span className="text-white text-[10px]">✓</span>}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${isTaskDone ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>{task}</span>
                                                    {isTaskDone && mcqValue > 0 && (
                                                        <span className="text-[9px] font-black text-sky-500 uppercase tracking-tighter">
                                                            Mastery Score: {mcqValue / 2}/10 {mcqValue >= 18 ? '✅ Mastery' : '⚠️ Low Validation'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {isTaskDone && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onMarkHard?.(task); }}
                                                    className={`p-1.5 rounded-lg transition-all ${isHard ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'text-gray-300 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-amber-500'}`}
                                                    title={lang === 'en' ? 'Mark as Difficult' : 'கடினமானது என குறிக்கவும்'}
                                                >
                                                    {isHard ? '⭐' : '☆'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {onRegenerateSchedule && (
                <div className="bg-gradient-to-br from-sky-50 to-blue-50 p-8 rounded-3xl border border-sky-100 shadow-sm">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h3 className="text-xl font-black text-sky-900 mb-2">
                                {lang === 'en' ? '🎯 Ready for the Next Challenge?' : '🎯 அடுத்த சவாலுக்கு தயாரா?'}
                            </h3>
                            <p className="text-gray-600 text-sm">
                                {lang === 'en'
                                    ? 'Generate your next 30 days based on your progress'
                                    : 'உங்கள் முன்னேற்றத்தின் அடிப்படையில் அடுத்த 30 நாட்களை உருவாக்குங்கள்'}
                            </p>
                        </div>
                        <button
                            onClick={onRegenerateSchedule}
                            disabled={loading}
                            className="bg-sky-600 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-xl shadow-sky-200 hover:bg-sky-700 transition-all active:scale-[0.98] disabled:opacity-50 whitespace-nowrap flex items-center space-x-2"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    <span>{lang === 'en' ? 'Generating...' : 'உருவாக்குகிறது...'}</span>
                                </>
                            ) : (
                                <>
                                    <span>✨</span>
                                    <span>{lang === 'en' ? 'Generate Next 30 Days' : 'அடுத்த 30 நாட்கள்'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScheduleView;
