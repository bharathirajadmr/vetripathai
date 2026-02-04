import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { TRANSLATIONS } from '../constants';
import { Language } from '../types';

interface SubscriptionPageProps {
    lang: Language;
}

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ lang }) => {
    const { currentUser, upgradeSubscription } = useAuth();
    const t = TRANSLATIONS[lang];
    const [loading, setLoading] = useState(false);

    const handleUpgrade = async () => {
        setLoading(true);
        // Simulate payment delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        await upgradeSubscription();
        setLoading(false);
    };

    const plans = [
        {
            name: 'Silver',
            price: '₹199',
            period: '/month',
            features: ['Basic Study Plan', 'Weekly Practice Questions', 'Ad-free Experience'],
            color: 'bg-slate-100 text-slate-700',
            popular: false
        },
        {
            name: 'Gold Pro',
            price: '₹999',
            period: '/year',
            features: ['AI Syllabus Analysis', 'Unlimited Mock Tests', 'Early Access to Updates'],
            color: 'bg-sky-600 text-white shadow-xl shadow-sky-200',
            popular: true
        },
        {
            name: 'Free Trial',
            price: '₹0',
            period: '/7 days',
            features: ['Trial Study Plan', '1 Mock Test', 'Content Extraction'],
            color: 'bg-gray-50 text-gray-500',
            popular: false
        }
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <div className="text-center space-y-4">
                <h2 className="text-4xl font-black text-sky-900 tracking-tight">
                    {lang === 'en' ? 'Unlock Your Pro Potential' : 'உங்கள் திறமையை மேம்படுத்துங்கள்'}
                </h2>
                <p className="text-gray-500 max-w-2xl mx-auto font-medium">
                    {lang === 'en'
                        ? 'Choose the plan that fits your preparation journey. Invest in your success today.'
                        : 'உங்கள் தயாரிப்புப் பயணத்திற்கு ஏற்ற திட்டத்தைத் தேர்ந்தெடுக்கவும். இன்று உங்கள் வெற்றிக்காக முதலீடு செய்யுங்கள்.'}
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {plans.map((plan) => (
                    <div key={plan.name} className={`relative p-8 rounded-3xl border border-gray-100 flex flex-col ${plan.color} transition-all hover:scale-[1.02]`}>
                        {plan.popular && (
                            <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                                Most Popular
                            </span>
                        )}
                        <div className="mb-8">
                            <h3 className="text-xl font-black mb-2 uppercase tracking-tight">{plan.name}</h3>
                            <div className="flex items-baseline">
                                <span className="text-4xl font-black tracking-tighter">{plan.price}</span>
                                <span className="text-sm font-bold opacity-70 ml-1">{plan.period}</span>
                            </div>
                        </div>
                        <ul className="space-y-4 mb-10 flex-1">
                            {plan.features.map(f => (
                                <li key={f} className="flex items-center space-x-3 text-sm font-medium">
                                    <span className="text-lg">✨</span>
                                    <span>{f}</span>
                                </li>
                            ))}
                        </ul>
                        {plan.name === 'Free Trial' ? (
                            <div className="w-full py-4 text-center font-black text-xs uppercase tracking-widest opacity-50">
                                Current/Basic Access
                            </div>
                        ) : (
                            <button
                                onClick={handleUpgrade}
                                disabled={loading || currentUser?.subscriptionStatus === 'active'}
                                className={`w-full py-4 rounded-2xl font-bold transition-all active:scale-[0.98] ${plan.popular
                                    ? 'bg-white text-sky-600 shadow-lg'
                                    : 'bg-sky-600 text-white'
                                    } disabled:opacity-50`}
                            >
                                {loading ? 'Processing...' : (currentUser?.subscriptionStatus === 'active' ? 'Already Subscribed' : 'Upgrade Now')}
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-1">Your Status</h4>
                    <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${currentUser?.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                            }`}>
                            {currentUser?.subscriptionStatus}
                        </span>
                        <p className="text-lg font-black text-sky-900">
                            {lang === 'en' ? 'Expires on' : 'முடிகிறது'}: {new Date(currentUser?.subscriptionExpiry || '').toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <p className="text-[10px] text-gray-400 font-bold max-w-xs text-center md:text-right leading-relaxed">
                    {lang === 'en'
                        ? 'Note: This is a simulated billing page. No real transactions will occur.'
                        : 'குறிப்பு: இது ஒரு மாதிரியான கட்டணப் பக்கம். உண்மையான பரிவர்த்தனைகள் எதுவும் நடக்காது.'}
                </p>
            </div>
        </div>
    );
};

export default SubscriptionPage;
