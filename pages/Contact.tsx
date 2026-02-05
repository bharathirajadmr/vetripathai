import React, { useState } from 'react';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';

interface ContactPageProps {
    lang: Language;
}

const ContactPage: React.FC<ContactPageProps> = ({ lang }) => {
    const t = TRANSLATIONS[lang] as any;
    const [formState, setFormState] = useState({ name: '', message: '' });
    const [sent, setSent] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Here we could hit a backend endpoint /api/contact
        console.log("Contact form submitted:", formState);
        setSent(true);
        setTimeout(() => {
            setSent(false);
            setFormState({ name: '', message: '' });
        }, 5000);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-12 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Header */}
            <header className="text-center space-y-4">
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">{t.contactTitle}</h1>
                <p className="text-slate-500 font-medium max-w-lg mx-auto leading-relaxed">
                    {t.contactDesc}
                </p>
            </header>

            <div className="grid md:grid-cols-2 gap-12 items-start">
                {/* Contact Details */}
                <div className="space-y-8">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                                📱
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.connectWhatsApp}</p>
                                <p className="text-lg font-black text-slate-900">+91 91599 88998</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                                📧
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.emailUs}</p>
                                <p className="text-lg font-black text-slate-900">support@vetripathai.pro</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center text-2xl shadow-inner">
                                🏛️
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Office</p>
                                <p className="text-lg font-black text-slate-900">{t.officeLocation}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-sky-900 rounded-[2.5rem] p-8 text-white space-y-4 shadow-xl shadow-sky-100">
                        <h4 className="text-xl font-black">Officer Support</h4>
                        <p className="text-sky-100/70 text-sm font-medium leading-relaxed">
                            Our team is available from 9 AM to 7 PM for immediate assistance. We prioritize our Pro members for 24/7 technical help.
                        </p>
                        <a
                            href="https://wa.me/919159988998"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white text-sky-900 px-6 py-3 rounded-xl font-black text-sm inline-block hover:bg-sky-50 transition-all active:scale-95"
                        >
                            Quick Help on WhatsApp
                        </a>
                    </div>
                </div>

                {/* Contact Form */}
                <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-xl shadow-sky-50 space-y-6">
                    <h3 className="text-2xl font-black text-slate-900 mb-6">Drop a Message</h3>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.nameLabel}</label>
                            <input
                                type="text"
                                required
                                value={formState.name}
                                onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl outline-none focus:border-sky-500 focus:bg-white transition-all font-bold text-slate-700"
                                placeholder="E.g. Bharathi Raja"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{t.messageLabel}</label>
                            <textarea
                                required
                                rows={5}
                                value={formState.message}
                                onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl outline-none focus:border-sky-500 focus:bg-white transition-all font-bold text-slate-700 resize-none"
                                placeholder="How can we help you today?"
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            disabled={sent}
                            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-lg transition-all shadow-xl active:scale-95 ${sent ? 'bg-emerald-500 text-white' : 'bg-sky-600 text-white hover:bg-sky-700 shadow-sky-100'}`}
                        >
                            {sent ? '✅ Message Sent!' : t.sendMessage}
                        </button>
                    </form>
                    <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-tighter">
                        We typically respond within 2-4 business hours.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ContactPage;
