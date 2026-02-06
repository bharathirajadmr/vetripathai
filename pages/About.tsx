import React from 'react';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';

interface AboutPageProps {
    lang: Language;
}

const AboutPage: React.FC<AboutPageProps> = ({ lang }) => {
    const t = TRANSLATIONS[lang] as any;

    const features = [
        { image: '/ai-strategy.png', title: t.featureAI, desc: t.featureAIDesc, color: 'bg-sky-50' },
        { image: '/mastery.png', title: t.featureMastery, desc: t.featureMasteryDesc, color: 'bg-emerald-50' },
        { image: '/current-affairs.png', title: t.featureCA, desc: t.featureCADesc, color: 'bg-amber-50' },
        { image: '/ranking.png', title: t.featureGamification, desc: t.featureGamificationDesc, color: 'bg-indigo-50' }
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-16 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Hero Section */}
            <section className="text-center space-y-6 pt-10">
                <div className="inline-block px-4 py-1.5 bg-sky-100 text-sky-700 text-[10px] font-black uppercase tracking-[0.2em] rounded-full mb-4">
                    The Future of Preparation
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">
                    {t.aboutTagline}
                </h1>
                <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
                    {t.aboutDesc}
                </p>
                <div className="pt-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-sky-400 to-indigo-600 rounded-[2rem] mx-auto shadow-2xl shadow-sky-200 flex items-center justify-center text-4xl transform rotate-12 transition-transform hover:rotate-0 duration-500">
                        🚀
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="grid md:grid-cols-2 gap-8">
                {features.map((f, i) => (
                    <div key={i} className="group p-8 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-sky-100/50 transition-all duration-500 hover:-translate-y-2">
                        <div className={`w-28 h-28 ${f.color} rounded-3xl flex items-center justify-center mb-8 shadow-inner overflow-hidden group-hover:scale-105 transition-transform`}>
                            <img
                                src={f.image}
                                alt={f.title}
                                className="w-full h-full object-contain p-2"
                                onError={(e) => {
                                    // Fallback to a placeholder or icon if image not found
                                    (e.target as any).src = 'https://placehold.co/200x200/f8fafc/cbd5e1?text=Loading...';
                                }}
                            />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 mb-3">{f.title}</h3>
                        <p className="text-slate-500 font-medium leading-relaxed text-sm">
                            {f.desc}
                        </p>
                    </div>
                ))}
            </section>

            {/* Mission Statement */}
            <section className="bg-sky-900 rounded-[3rem] p-12 text-center text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-x-10 -translate-y-10 blur-3xl" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-400/10 rounded-full translate-x-10 translate-y-10 blur-3xl" />

                <h2 className="text-3xl font-black mb-6 relative z-10">Our Mission</h2>
                <p className="text-lg text-sky-100/80 font-medium max-w-lg mx-auto relative z-10 leading-relaxed">
                    We are dedicated to leveling the playing field for every aspirant. By using the power of AI, we make world-class mentorship accessible to everyone, helping you turn your dreams into reality.
                </p>
                <div className="mt-8 flex justify-center space-x-4 relative z-10">
                    <span className="text-2xl">✨</span>
                    <span className="text-2xl">🏛️</span>
                    <span className="text-2xl">💎</span>
                </div>
            </section>

            {/* Final CTA/Inspiration */}
            <section className="text-center space-y-4">
                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Your journey begins here</p>
                <h3 className="text-2xl font-black text-slate-900">Believe in yourself. We're with you every step.</h3>
            </section>
        </div>
    );
};

export default AboutPage;
