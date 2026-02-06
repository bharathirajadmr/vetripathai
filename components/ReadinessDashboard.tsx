
import React from 'react';
import { StudyDay, SyllabusItem, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface ReadinessDashboardProps {
    lang: Language;
    schedule: StudyDay[];
    syllabus: SyllabusItem[];
}

const ReadinessDashboard: React.FC<ReadinessDashboardProps> = ({ lang, schedule, syllabus }) => {
    const t = TRANSLATIONS[lang];

    const calculateReadiness = () => {
        if (!schedule || !syllabus) return [];

        return syllabus.map(subj => {
            const allSubjTopics = subj.topics.map(t => t.name.toLowerCase());

            let totalSubjectTasks = 0;
            let completedSubjectTasks = 0;
            let totalScore = 0;
            let scoredTasks = 0;

            schedule.forEach(day => {
                day.tasks.forEach(task => {
                    const taskLower = task.toLowerCase();
                    // Basic heuristic: check if task name contains any topic name
                    const matches = allSubjTopics.some(topic => taskLower.includes(topic));

                    if (matches) {
                        totalSubjectTasks++;
                        if (day.completedTasks?.includes(task)) {
                            completedSubjectTasks++;

                            const score = day.mcqsAttempted?.[task];
                            if (score !== undefined && score > 0) {
                                // Scale mcqCount (0-20) to 0-100%
                                totalScore += (score / 20) * 100;
                                scoredTasks++;
                            }
                        }
                    }
                });
            });

            const coverage = totalSubjectTasks > 0 ? (completedSubjectTasks / totalSubjectTasks) * 100 : 0;
            const avgQuizScore = scoredTasks > 0 ? totalScore / scoredTasks : 0;

            // % Readiness = (% Subject Coverage * 0.7) + (Avg Quiz Score % * 0.3)
            const readiness = (coverage * 0.7) + (avgQuizScore * 0.3);

            return {
                name: subj.subject,
                coverage,
                avgQuizScore,
                readiness,
                priority: subj.priority || 'Medium'
            };
        });
    };

    const stats = calculateReadiness();

    return (
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-sky-900 flex items-center gap-2">
                    <span className="text-2xl">🎯</span>
                    {lang === 'en' ? 'Subject Readiness' : 'பாட வாரியான தயார் நிலை'}
                </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map((stat, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-3 hover:border-sky-200 transition-all">
                        <div className="flex justify-between items-start">
                            <h4 className="font-bold text-sky-900 text-sm">{stat.name}</h4>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${stat.priority === 'Hard' ? 'bg-red-100 text-red-600' :
                                    stat.priority === 'Medium' ? 'bg-amber-100 text-amber-600' :
                                        'bg-emerald-100 text-emerald-600'
                                }`}>
                                {stat.priority}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-gray-500">
                                <span>Readiness Score</span>
                                <span className="text-sky-600 font-black">{Math.round(stat.readiness)}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-1000 ${stat.readiness > 75 ? 'bg-emerald-500' :
                                            stat.readiness > 40 ? 'bg-sky-500' :
                                                'bg-amber-500'
                                        }`}
                                    style={{ width: `${stat.readiness}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex gap-4 text-[9px] font-bold text-gray-400">
                            <div>Coverage: <span className="text-gray-600">{Math.round(stat.coverage)}%</span></div>
                            <div>Quiz Avg: <span className="text-gray-600">{Math.round(stat.avgQuizScore)}%</span></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReadinessDashboard;
