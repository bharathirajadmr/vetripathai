
import React, { useState } from 'react';
import { TRANSLATIONS, API_URL } from '../constants';
import { Language, UserConfig, SyllabusItem } from '../types';
import { EXAMS } from '../constants/exams';
import { extractTextFromPDF } from '../services/pdf';
import { extractSyllabus, generateSchedule } from '../services/gemini';

interface SetupViewProps {
    lang: Language;
    onComplete: (config: UserConfig, syllabus: SyllabusItem[], schedule: any[]) => void;
    initialConfig?: UserConfig | null;
    initialSyllabus?: SyllabusItem[] | null;
}

const SetupView: React.FC<SetupViewProps> = ({ lang, onComplete, initialConfig, initialSyllabus }) => {
    const t = TRANSLATIONS[lang];
    const [loading, setLoading] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState('');
    const [config, setConfig] = useState<UserConfig>(initialConfig || {
        examName: 'TNPSC Group 1',
        examDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        studyHoursPerDay: 4,
        language: lang,
        preferredMethods: ['General AI Strategy']
    });
    const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
    const [syllabusText, setSyllabusText] = useState('');
    const [syllabusMode, setSyllabusMode] = useState<'preset' | 'file' | 'text' | 'current'>(initialSyllabus ? 'current' : 'preset');
    const [selectedExamId, setSelectedExamId] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [papersFile, setPapersFile] = useState<File | null>(null);

    const handleGenerate = async () => {
        if (syllabusMode === 'file' && !syllabusFile) {
            alert(lang === 'en' ? 'Please upload a syllabus PDF.' : 'தயவுசெய்து பாடத்திட்டத்தை பதிவேற்றவும்.');
            return;
        }

        if (syllabusMode === 'text' && !syllabusText.trim()) {
            alert(lang === 'en' ? 'Please paste your syllabus text.' : 'தயவுசெய்து பாடத்திட்ட உரையை ஒட்டவும்.');
            return;
        }

        if (syllabusMode === 'preset' && !selectedExamId) {
            alert(lang === 'en' ? 'Please select an exam from the library.' : 'தயவுசெய்து நூலகத்திலிருந்து ஒரு தேர்வைத் தேர்ந்தெடுக்கவும்.');
            return;
        }

        setLoading(true);
        try {
            let syllabus: SyllabusItem[] = [];
            let papersText = "";

            if (syllabusMode === 'current' && initialSyllabus) {
                syllabus = initialSyllabus;
            } else {
                setLoadingStatus(t.extracting || 'Extracting content...');

                let finalSyllabusText = "";
                if (syllabusMode === 'file' && syllabusFile) {
                    finalSyllabusText = await extractTextFromPDF(syllabusFile);
                } else if (syllabusMode === 'text') {
                    finalSyllabusText = syllabusText;
                } else if (syllabusMode === 'preset') {
                    const response = await fetch(`${API_URL}/api/syllabus/${selectedExamId}`);
                    const result = await response.json();
                    if (result.success) {
                        finalSyllabusText = result.data;
                    } else {
                        throw new Error(result.error || "Failed to load syllabus");
                    }
                }

                setLoadingStatus(lang === 'en' ? 'AI is analyzing syllabus...' : 'AI பாடத்திட்டத்தை ஆய்வு செய்கிறது...');
                syllabus = await extractSyllabus(finalSyllabusText, lang);
            }

            if (papersFile) {
                papersText = await extractTextFromPDF(papersFile);
            }

            setLoadingStatus(lang === 'en' ? 'Generating your personalized plan...' : 'உங்கள் தனிப்பயன் திட்டத்தை உருவாக்குகிறது...');

            // For regeneration, we might want to pass progress data. 
            // But if the user wants to "ask from beginning", they might want to overwrite.
            // Let's check if they have a schedule and provide that as context.
            const schedule = await generateSchedule(syllabus, config, papersText);

            onComplete(config, syllabus, schedule);
        } catch (error: any) {
            console.error("Plan generation failed", error);
            const msg = lang === 'en'
                ? `Plan generation failed: ${error.message}`
                : `திட்டத்தை உருவாக்க முடியவில்லை: ${error.message}`;
            alert(msg);
        } finally {
            setLoading(false);
            setLoadingStatus('');
        }
    };

    const methods = [
        { id: 'General AI Strategy', label: t.methodGeneral, desc: t.descGeneral },
        { id: 'Active Recall', label: t.methodActiveRecall, desc: t.descActiveRecall },
        { id: 'Spaced Repetition', label: t.methodSpacedRepetition, desc: t.descSpacedRepetition },
        { id: 'Interleaved Study', label: t.methodInterleaved, desc: t.descInterleaved },
        { id: 'Pomodoro', label: t.methodPomodoro, desc: t.descPomodoro },
    ];

    const filteredExams = EXAMS.filter(e =>
        e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <div className="text-6xl mb-6">🚀</div>
                <h2 className="text-2xl font-black text-sky-900 mb-2">{t.searchingWeb.split('...')[0]}</h2>
                <p className="text-gray-500 font-medium">{loadingStatus}</p>
                <div className="mt-8 w-64 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-600 animate-progress origin-left"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 bg-gradient-to-br from-white to-sky-50/50">
                <h2 className="text-3xl font-black text-sky-900 mb-2">{t.setup}</h2>
                <p className="text-gray-500">{lang === 'en' ? 'Let\'s tailor your winning strategy.' : 'உங்கள் வெற்றி வியூகத்தை அமைப்போம்.'}</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-4">{t.examDate}</label>
                        <input
                            type="date"
                            value={config.examDate}
                            onChange={(e) => setConfig({ ...config, examDate: e.target.value, endDate: e.target.value })}
                            className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium mb-4"
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{lang === 'en' ? 'From Date' : 'தொடங்கும் தேதி'}</label>
                                <input
                                    type="date"
                                    value={config.startDate}
                                    onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
                                    className="w-full bg-gray-50 border-0 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{lang === 'en' ? 'To Date' : 'முடியும் தேதி'}</label>
                                <input
                                    type="date"
                                    value={config.endDate}
                                    onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                                    className="w-full bg-gray-50 border-0 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium text-sm"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-2">{t.studyHours}</label>
                        <div className="flex items-center space-x-4">
                            <input
                                type="range" min="1" max="12"
                                value={config.studyHoursPerDay}
                                onChange={(e) => setConfig({ ...config, studyHoursPerDay: parseInt(e.target.value) })}
                                className="flex-1 accent-sky-600"
                            />
                            <span className="text-2xl font-black text-sky-900 w-12">{config.studyHoursPerDay}h</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <label className="block text-sm font-black text-gray-700 uppercase tracking-wider">{t.syllabus}</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg gap-1">
                                {initialSyllabus && (
                                    <button
                                        onClick={() => setSyllabusMode('current')}
                                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${syllabusMode === 'current' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        CURRENT
                                    </button>
                                )}
                                <button
                                    onClick={() => setSyllabusMode('preset')}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${syllabusMode === 'preset' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    LIBRARY
                                </button>
                                <button
                                    onClick={() => setSyllabusMode('file')}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${syllabusMode === 'file' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    PDF
                                </button>
                                <button
                                    onClick={() => setSyllabusMode('text')}
                                    className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${syllabusMode === 'text' ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    TEXT
                                </button>
                            </div>
                        </div>

                        {syllabusMode === 'current' ? (
                            <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 text-center">
                                <span className="text-2xl mb-2 block">📋</span>
                                <p className="text-xs font-bold text-sky-700">Using currently active syllabus</p>
                                <p className="text-[10px] text-sky-500 mt-1">Found {initialSyllabus?.length} subjects from your previous plan.</p>
                            </div>
                        ) : syllabusMode === 'preset' ? (
                            <div className="space-y-4">
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                                    <input
                                        type="text"
                                        placeholder={t.searchExam}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-gray-50 border-0 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500 transition-all"
                                    />
                                </div>
                                <div className="max-h-[220px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {filteredExams.length > 0 ? filteredExams.map(exam => (
                                        <button
                                            key={exam.id}
                                            onClick={() => {
                                                setSelectedExamId(exam.id);
                                                setConfig({ ...config, examName: exam.name });
                                            }}
                                            className={`w-full p-4 rounded-xl border text-left transition-all group ${selectedExamId === exam.id ? 'border-sky-600 bg-sky-50 ring-1 ring-sky-600' : 'border-gray-100 hover:border-sky-200 hover:bg-white hover:shadow-md'}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className={`text-sm font-bold transition-colors ${selectedExamId === exam.id ? 'text-sky-900' : 'text-gray-700 group-hover:text-sky-900'}`}>{exam.name}</p>
                                                    <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-black">{exam.category}</p>
                                                </div>
                                                {selectedExamId === exam.id && <span className="text-sky-600 text-lg">✓</span>}
                                            </div>
                                        </button>
                                    )) : (
                                        <div className="text-center py-10">
                                            <p className="text-gray-400 text-sm font-medium">{t.noResults}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : syllabusMode === 'file' ? (
                            <div className="relative">
                                <input
                                    type="file" accept=".pdf"
                                    onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                />
                                <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-all ${syllabusFile ? 'border-sky-500 bg-sky-50' : 'border-gray-200 hover:border-sky-300'}`}>
                                    <span className="text-2xl mb-2 block">{syllabusFile ? '✅' : '📄'}</span>
                                    <p className="text-xs font-bold text-gray-500">{syllabusFile ? syllabusFile.name : (lang === 'en' ? 'Click or drag PDF' : 'பதிவேற்ற கிளிக் செய்யவும்')}</p>
                                </div>
                            </div>
                        ) : (
                            <textarea
                                value={syllabusText}
                                onChange={(e) => setSyllabusText(e.target.value)}
                                placeholder={t.uploadSyllabusText}
                                className="w-full h-32 bg-gray-50 border-0 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium text-sm resize-none"
                            />
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <label className="block text-sm font-black text-gray-700 uppercase tracking-wider mb-4">{t.studyMethods}</label>
                        <div className="space-y-3">
                            {methods.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => {
                                        const current = config.preferredMethods || [];
                                        const next = current.includes(m.id)
                                            ? current.filter(id => id !== m.id)
                                            : [...current, m.id];
                                        setConfig({ ...config, preferredMethods: next });
                                    }}
                                    className={`w-full p-3 rounded-xl border text-left transition-all ${config.preferredMethods?.includes(m.id)
                                        ? 'border-sky-600 bg-sky-50 shadow-sm'
                                        : 'border-gray-100 hover:border-sky-200'
                                        }`}
                                >
                                    <p className="text-sm font-black text-sky-900">{m.label}</p>
                                    <p className="text-[10px] text-gray-500 leading-tight mt-1">{m.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={
                            syllabusMode === 'preset' ? !selectedExamId :
                                syllabusMode === 'file' ? !syllabusFile : !syllabusText.trim()
                        }
                        className="w-full bg-sky-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-sky-200 hover:bg-sky-700 transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                        {t.generatePlan}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SetupView;
