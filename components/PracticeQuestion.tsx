
import React, { useState } from 'react';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';
import { generateDailyQuestion } from '../services/gemini';

interface PracticeQuestionProps {
    lang: Language;
    topics: string[];
    questionPapers: string;
}

const PracticeQuestion: React.FC<PracticeQuestionProps> = ({ lang, topics, questionPapers }) => {
    const t = TRANSLATIONS[lang];
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState<{ question: string; explanation: string }[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [showExplanation, setShowExplanation] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const qs = await generateDailyQuestion(topics, questionPapers, lang);
            setQuestions(Array.isArray(qs) ? qs : [qs]);
            setCurrentIndex(0);
            setUserAnswer('');
            setShowExplanation(false);
        } catch (error) {
            console.error("Failed to generate questions", error);
        } finally {
            setLoading(false);
        }
    };

    const currentQuestion = questions[currentIndex];

    return (
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 bg-gradient-to-br from-white to-sky-50/30">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-black text-sky-900">{t.practiceTitle}</h3>
                    <p className="text-gray-500 text-sm">{t.practiceHint}</p>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={loading || topics.length === 0}
                    className="bg-sky-100 text-sky-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-sky-200 transition-all disabled:opacity-50"
                >
                    {loading ? '⏳...' : t.generateQuestion}
                </button>
            </div>

            {currentQuestion ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-4 py-2 rounded-lg">
                        <span>Question {currentIndex + 1} of {questions.length}</span>
                        {currentIndex > 0 && (
                            <button onClick={() => { setCurrentIndex(i => i - 1); setShowExplanation(false); setUserAnswer(''); }} className="text-sky-600 hover:underline">Previous</button>
                        )}
                    </div>

                    <div className="p-5 bg-white rounded-2xl border border-sky-100 shadow-sm">
                        <p className="text-gray-800 font-bold leading-relaxed">{currentQuestion.question}</p>
                    </div>

                    {!showExplanation ? (
                        <div className="space-y-4">
                            <textarea
                                value={userAnswer}
                                onChange={(e) => setUserAnswer(e.target.value)}
                                placeholder={t.yourAnswer}
                                className="w-full bg-gray-50 border-0 rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-sky-500 font-medium text-sm transition-all"
                                rows={3}
                            />
                            <button
                                onClick={() => setShowExplanation(true)}
                                disabled={!userAnswer.trim()}
                                className="w-full bg-sky-600 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-sky-700 transition-all shadow-lg shadow-sky-100 disabled:opacity-50"
                            >
                                {t.submitAnswer}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in zoom-in-95 duration-300">
                            <div className="p-5 bg-green-50 rounded-2xl border border-green-100">
                                <h4 className="text-green-700 font-black text-xs uppercase tracking-widest mb-2">{t.explanation}</h4>
                                <p className="text-green-800 text-sm leading-relaxed">{currentQuestion.explanation}</p>
                            </div>

                            {currentIndex < questions.length - 1 ? (
                                <button
                                    onClick={() => {
                                        setCurrentIndex(i => i + 1);
                                        setShowExplanation(false);
                                        setUserAnswer('');
                                    }}
                                    className="w-full bg-sky-600 text-white py-3 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-sky-700 transition-all shadow-lg shadow-sky-100"
                                >
                                    {lang === 'en' ? 'Next Question' : 'அடுத்த கேள்வி'}
                                </button>
                            ) : (
                                <button
                                    onClick={handleGenerate}
                                    className="text-sky-600 font-black text-xs uppercase tracking-widest hover:underline"
                                >
                                    {lang === 'en' ? 'Finish & Generate More' : 'முடிக்கவும் & மேலும் உருவாக்கவும்'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                    <p className="text-gray-400 text-sm font-medium">
                        {topics.length === 0
                            ? (lang === 'en' ? 'Complete some tasks to unlock practice questions!' : 'பயிற்சி வினாக்களுக்கு சில பணிகளை முடிக்கவும்!')
                            : (lang === 'en' ? 'Click generate to start your daily practice.' : 'உங்கள் தினசரி பயிற்சியைத் தொடங்கவும்.')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default PracticeQuestion;
