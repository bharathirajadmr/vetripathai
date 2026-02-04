import React from 'react';
import { SyllabusItem, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface SyllabusViewProps {
    syllabus: SyllabusItem[];
    lang: Language;
}

const SyllabusView: React.FC<SyllabusViewProps> = ({ syllabus, lang }) => {
    const t = TRANSLATIONS[lang];

    if (!syllabus || syllabus.length === 0) {
        return (
            <div className="py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                <div className="text-4xl mb-4">📖</div>
                <h3 className="text-lg font-bold text-gray-400">{t.noResults}</h3>
                <p className="text-sm text-gray-400">{lang === 'en' ? 'No syllabus data found. Please set up your plan again.' : 'பாடத்திட்ட விவரங்கள் எதுவும் இல்லை. தயவுசெய்து மீண்டும் திட்டத்தை அமைக்கவும்.'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-10">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 bg-gradient-to-br from-white to-sky-50/50">
                <h2 className="text-3xl font-black text-sky-900 mb-2">{t.syllabus}</h2>
                <p className="text-gray-500">{lang === 'en' ? 'Breakdown of your exam syllabus.' : 'உங்கள் தேர்வு பாடத்திட்டத்தின் விவரங்கள்.'}</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {syllabus.map((item, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                        <div className="flex items-center space-x-3 mb-6">
                            <span className="w-10 h-10 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center font-black text-lg">
                                {idx + 1}
                            </span>
                            <h3 className="text-xl font-black text-sky-900 leading-tight">{item.subject}</h3>
                        </div>

                        <div className="space-y-6">
                            {item.topics.map((topic, tIdx) => (
                                <div key={tIdx} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-gray-800 text-sm">{topic.name}</h4>
                                        {topic.difficulty && (
                                            <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                                                Level {topic.difficulty}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {topic.subtopics.map((sub, sIdx) => (
                                            <span key={sIdx} className="bg-white px-2 py-1 rounded-md text-[10px] text-gray-500 font-medium border border-gray-100">
                                                {sub}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SyllabusView;
