
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
        examDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'),
        startDate: new Date().toLocaleDateString('en-CA'),
        endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA'),
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
    const [step, setStep] = useState<'config' | 'review'>('config');
    const [extractedSyllabus, setExtractedSyllabus] = useState<SyllabusItem[]>([]);

    const today = new Date().toLocaleDateString('en-CA');

    const handleReviewSyllabus = async () => {
        if (config.startDate < today) {
            alert(lang === 'en' ? 'From Date cannot be in the past.' : 'தொடங்கும் தேதி கடந்த காலத்தில் இருக்கக்கூடாது.');
            return;
        }

        if (config.endDate < config.startDate) {
            alert(lang === 'en' ? 'To Date cannot be earlier than From Date.' : 'முடியும் தேதி தொடங்கும் தேதிக்கு முன்னதாக இருக்கக்கூடாது.');
            return;
        }

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

            setExtractedSyllabus(syllabus);
            setStep('review');
        } catch (error: any) {
            console.error("Syllabus extraction failed", error);
            alert((lang === 'en' ? 'Failed to process syllabus: ' : 'பாடத்திட்டத்தைச் செயல்படுத்த முடியவில்லை: ') + error.message);
        } finally {
            setLoading(false);
            setLoadingStatus('');
        }
    };

    const handleFinalGenerate = async () => {
        setLoading(true);
        try {
            setLoadingStatus(lang === 'en' ? 'Generating your personalized plan...' : 'உங்கள் தனிப்பயன் திட்டத்தை உருவாக்குகிறது...');

            let papersText = "";
            if (papersFile) {
                papersText = await extractTextFromPDF(papersFile);
            }

            const startDate = config.startDate ? new Date(config.startDate) : new Date();
            const endDate = config.endDate ? new Date(config.endDate) : new Date();
            const totalDaysRequested = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            const totalTopics = extractedSyllabus.reduce((acc, item) => acc + (item.topics?.length || 0), 0);

            if (totalTopics / totalDaysRequested > 5) {
                const proceed = window.confirm(lang === 'en'
                    ? `Warning: Your syllabus has ${totalTopics} topics for ${totalDaysRequested} days (~${Math.round(totalTopics / totalDaysRequested)} per day). This might be too fast. Proceed anyway?`
                    : `எச்சரிக்கை: ${totalDaysRequested} நாட்களுக்கு ${totalTopics} தலைப்புகள் உள்ளன (ஒரு நாளைக்கு ~${Math.round(totalTopics / totalDaysRequested)}). இது மிகவும் விரைவாக இருக்கலாம். தொடரலாமா?`);
                if (!proceed) {
                    setLoading(false);
                    setLoadingStatus('');
                    return;
                }
            }

            const daysToGenerate = Math.min(15, totalDaysRequested);
            const schedule = await generateSchedule(extractedSyllabus, { ...config, daysToGenerate } as any, papersText);

            onComplete(config, extractedSyllabus, schedule);
        } catch (error: any) {
            console.error("Plan generation failed", error);
            alert((lang === 'en' ? 'Plan generation failed: ' : 'திட்டத்தை உருவாக்க முடியவில்லை: ') + error.message);
        } finally {
            setLoading(false);
            setLoadingStatus('');
        }
    };

    const moveSubject = (index: number, direction: 'up' | 'down') => {
        const newSyllabus = [...extractedSyllabus];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex >= 0 && targetIndex < newSyllabus.length) {
            [newSyllabus[index], newSyllabus[targetIndex]] = [newSyllabus[targetIndex], newSyllabus[index]];
            setExtractedSyllabus(newSyllabus);
        }
    };

    const shuffleSyllabus = () => {
        const newSyllabus = [...extractedSyllabus].sort(() => Math.random() - 0.5);
        setExtractedSyllabus(newSyllabus);
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

    if (step === 'config') {
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
                                min={today}
                                onChange={(e) => setConfig({ ...config, examDate: e.target.value, endDate: e.target.value })}
                                className="w-full bg-gray-50 border-0 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium mb-4"
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{lang === 'en' ? 'From Date' : 'தொடங்கும் தேதி'}</label>
                                    <input
                                        type="date"
                                        value={config.startDate}
                                        min={today}
                                        onChange={(e) => {
                                            const newStart = e.target.value;
                                            setConfig(prev => ({
                                                ...prev,
                                                startDate: newStart,
                                                endDate: prev.endDate < newStart ? newStart : prev.endDate
                                            }));
                                        }}
                                        className="w-full bg-gray-50 border-0 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-sky-500 transition-all font-medium text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{lang === 'en' ? 'To Date' : 'முடியும் தேதி'}</label>
                                    <input
                                        type="date"
                                        value={config.endDate}
                                        min={config.startDate}
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
                            onClick={handleReviewSyllabus}
                            disabled={
                                syllabusMode === 'preset' ? !selectedExamId :
                                    syllabusMode === 'file' ? !syllabusFile :
                                        syllabusMode === 'current' ? !initialSyllabus : !syllabusText.trim()
                            }
                            className="w-full bg-sky-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-sky-200 hover:bg-sky-700 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {lang === 'en' ? 'Review Syllabus' : 'பாடத்திட்டத்தை சரிபார்க்கவும்'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-20 fade-in">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-sky-900 mb-2">{(t as any).reviewSubjects}</h2>
                    <p className="text-gray-500 text-sm">{(t as any).reorderDesc}</p>
                </div>
                <button
                    onClick={shuffleSyllabus}
                    className="flex items-center space-x-2 px-6 py-3 bg-sky-50 text-sky-600 rounded-xl font-bold hover:bg-sky-100 transition-all active:scale-95"
                >
                    <span>🔀</span>
                    <span>{(t as any).shuffle}</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {extractedSyllabus.map((item, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between group hover:border-sky-200 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center font-black text-xs">
                                {idx + 1}
                            </span>
                            <div className="flex space-x-1">
                                <button
                                    onClick={() => moveSubject(idx, 'up')}
                                    disabled={idx === 0}
                                    className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-30 transition-all flex items-center justify-center"
                                >
                                    ↑
                                </button>
                                <button
                                    onClick={() => moveSubject(idx, 'down')}
                                    disabled={idx === extractedSyllabus.length - 1}
                                    className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-30 transition-all flex items-center justify-center"
                                >
                                    ↓
                                </button>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h4 className="font-bold text-sky-900 leading-tight mb-1">{item.subject}</h4>
                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">{item.topics?.length || 0} Topics</p>
                        </div>

                        <div className="flex items-center gap-1 p-1 bg-gray-50 rounded-lg">
                            {(['Easy', 'Medium', 'Hard'] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => {
                                        const next = [...extractedSyllabus];
                                        next[idx] = { ...next[idx], priority: p };
                                        setExtractedSyllabus(next);
                                    }}
                                    className={`flex-1 text-[9px] font-black py-1.5 rounded-md transition-all uppercase tracking-wider ${item.priority === p
                                            ? p === 'Hard' ? 'bg-red-500 text-white' : p === 'Medium' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
                                            : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                >
                                    {(t as any)[`priority${p}`]}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex flex-col md:flex-row gap-4 pt-4">
                <button
                    onClick={() => setStep('config')}
                    className="flex-1 bg-white border-2 border-slate-100 text-slate-500 py-4 rounded-2xl font-black text-lg hover:bg-slate-50 transition-all"
                >
                    {lang === 'en' ? 'Back to Config' : 'திரும்பிச் செல்'}
                </button>
                <button
                    onClick={handleFinalGenerate}
                    className="flex-[2] bg-sky-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-sky-200 hover:bg-sky-700 transition-all active:scale-[0.98]"
                >
                    {(t as any).confirmOrder}
                </button>
            </div>
        </div>
    );
};

export default SetupView;
