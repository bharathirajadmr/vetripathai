
import React from 'react';
import { TRANSLATIONS } from '../constants';
import { Language, StudyDay } from '../types';

interface ScheduleViewProps {
    lang: Language;
    schedule: StudyDay[];
    onToggleTask: (dayId: string, taskIndex: number) => void;
    onMarkHard?: (topic: string) => void;
    hardTopics?: string[];
    onRegenerateSchedule?: () => void;
    loading?: boolean;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ lang, schedule, onToggleTask, onMarkHard, hardTopics = [], onRegenerateSchedule, loading }) => {
    const t = TRANSLATIONS[lang];

    // Group by month/week or just list
    return (
        <div className="space-y-8">
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
                                    const isHard = hardTopics.includes(task);
                                    return (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-3 rounded-xl border border-transparent hover:border-gray-100 hover:bg-gray-50/50 transition-all group"
                                        >
                                            <div
                                                onClick={() => onToggleTask(day.id, idx)}
                                                className="flex items-center space-x-3 cursor-pointer flex-1"
                                            >
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isTaskDone ? 'bg-sky-600 border-sky-600' : 'border-gray-300 group-hover:border-sky-400'}`}>
                                                    {isTaskDone && <span className="text-white text-[10px]">✓</span>}
                                                </div>
                                                <span className={`text-sm font-medium ${isTaskDone ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>{task}</span>
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
