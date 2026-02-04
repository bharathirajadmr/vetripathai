import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { TRANSLATIONS } from '../constants';
import { Language, GlobalSettings } from '../types';
import { API_URL } from '../constants';

interface SubscriptionPageProps {
    lang: Language;
}

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ lang }) => {
    const { currentUser, upgradeSubscription, activateWithCode } = useAuth();
    const t = TRANSLATIONS[lang];
    const [loading, setLoading] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [settings, setSettings] = useState<GlobalSettings | null>(null);
    const [activationCode, setActivationCode] = useState('');
    const [activationError, setActivationError] = useState('');
    const [activationSuccess, setActivationSuccess] = useState('');

    // Promo Code State
    const [promoInput, setPromoInput] = useState('');
    const [discount, setDiscount] = useState(0);
    const [promoError, setPromoError] = useState('');
    const [promoSuccess, setPromoSuccess] = useState('');

    // Checkout State
    const [showCheckout, setShowCheckout] = useState<{ name: string; price: number; rawPrice: number; originalPrice: string } | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch(`${API_URL}/api/admin/settings`);
                const data = await res.json();
                if (data.success) {
                    setSettings(data.data);
                }
            } catch (error) {
                console.error("Settings fetch failed", error);
            } finally {
                setSettingsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleApplyPromo = () => {
        if (!settings) return;
        const code = promoInput.trim().toUpperCase();
        if (settings.promoCodes[code]) {
            setDiscount(settings.promoCodes[code]);
            setPromoSuccess(t.promoApplied);
            setPromoError('');
        } else {
            setDiscount(0);
            setPromoError(t.invalidPromo);
            setPromoSuccess('');
        }
    };

    const handleConfirmUpgrade = async () => {
        if (!showCheckout) return;
        setLoading(true);
        // Simulate payment delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        await upgradeSubscription(showCheckout.name);
        setLoading(false);
        setShowCheckout(null);
    };

    const handleActivateWithCode = async () => {
        if (!activationCode) return;
        setLoading(true);
        setActivationError('');
        setActivationSuccess('');
        try {
            await activateWithCode(activationCode);
            setActivationSuccess(t.codeSuccess);
            setActivationCode('');
        } catch (err: any) {
            setActivationError(t.invalidCode);
        } finally {
            setLoading(false);
        }
    };

    if (settingsLoading) return <div className="p-20 text-center font-black animate-pulse uppercase tracking-widest text-sky-900">Loading Plans...</div>;
    if (!settings) return null;

    const plans = settings.rateCard;

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            {/* Checkout Modal */}
            {showCheckout && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-sky-900/60 backdrop-blur-md" onClick={() => setShowCheckout(null)}></div>
                    <div className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl relative z-10 animate-in zoom-in duration-300">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-sky-50 text-sky-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-inner">💳</div>
                            <h3 className="text-2xl font-black text-sky-900">{t.checkoutTitle}</h3>
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">{showCheckout.name} Plan</p>
                        </div>

                        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 mb-8">
                            <div className="flex justify-between text-sm font-bold text-gray-500">
                                <span>Original Price</span>
                                <span>{showCheckout.originalPrice}</span>
                            </div>
                            {discount > 0 && (
                                <div className="flex justify-between text-sm font-black text-green-600">
                                    <span>Discount ({discount}%)</span>
                                    <span>-₹{Math.floor((showCheckout.rawPrice * discount) / 100)}</span>
                                </div>
                            )}
                            <div className="pt-4 border-t border-gray-200 flex justify-between items-baseline">
                                <span className="font-black text-sky-900">Total Amount</span>
                                <span className="text-2xl font-black text-sky-600">₹{showCheckout.price}</span>
                            </div>
                        </div>

                        {showCheckout.rawPrice > 0 && (
                            <div className="mb-8 space-y-4">
                                <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Pay via UPI ID</span>
                                        <span className="text-sm font-black text-sky-900">{settings.upiId}</span>
                                    </div>
                                    <button
                                        onClick={() => navigator.clipboard.writeText(settings.upiId)}
                                        className="text-[10px] font-black text-sky-600 uppercase bg-white px-2 py-1 rounded-lg border border-sky-200"
                                    >
                                        Copy
                                    </button>
                                </div>
                                <p className="text-[9px] font-medium text-gray-400 leading-relaxed whitespace-pre-line">
                                    {t.manualPaymentInstructions}
                                </p>
                            </div>
                        )}

                        <div className="space-y-3">
                            <a
                                href={`https://wa.me/919999999999?text=${encodeURIComponent(
                                    `Hi, I have paid ₹${showCheckout.price} for the ${showCheckout.name} plan. My email is ${currentUser?.email}. Please activate my Pro access.`
                                )}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg shadow-green-200 hover:bg-green-700 transition-all active:scale-95 flex items-center justify-center space-x-3"
                            >
                                <span className="text-lg">📱</span>
                                <span>{t.sendWhatsApp}</span>
                            </a>
                            {/* Hidden for manual flow, but keeping structure for future */}
                            {/* <button
                                onClick={handleConfirmUpgrade}
                                disabled={loading}
                                className="w-full py-4 bg-sky-600 text-white rounded-2xl font-black shadow-lg shadow-sky-200 hover:bg-sky-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {loading ? 'Processing Securely...' : t.completePayment}
                            </button> */}
                            <button
                                onClick={() => setShowCheckout(null)}
                                className="w-full py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                            >
                                Cancel Transaction
                            </button>
                        </div>

                        <div className="mt-6 flex items-center justify-center space-x-2 text-[8px] font-black text-gray-400 uppercase tracking-tighter">
                            <span>🔒 SSL ENCRYPTED</span>
                            <span>•</span>
                            <span>PCI DSS COMPLIANT</span>
                        </div>
                    </div>
                </div>
            )}

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

            {/* Promo Code Section */}
            <div className="max-w-md mx-auto">
                <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-2">
                    <input
                        type="text"
                        placeholder={t.promoCode}
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        className="flex-1 bg-transparent px-4 py-2 text-sm font-bold outline-none uppercase"
                    />
                    <button
                        onClick={handleApplyPromo}
                        className="bg-sky-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-sky-700 transition-all"
                    >
                        {t.apply}
                    </button>
                </div>
                {promoError && <p className="mt-2 text-center text-[10px] font-black text-red-500 uppercase">{promoError}</p>}
                {promoSuccess && <p className="mt-2 text-center text-[10px] font-black text-green-600 uppercase">{promoSuccess}</p>}
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {plans.map((plan) => {
                    const finalPrice = plan.rawPrice > 0 ? Math.floor(plan.rawPrice * (1 - discount / 100)) : 0;

                    return (
                        <div key={plan.name} className={`relative p-8 rounded-3xl border border-gray-100 flex flex-col ${plan.color} transition-all hover:scale-[1.02]`}>
                            {plan.popular && (
                                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg z-10">
                                    Most Popular
                                </span>
                            )}
                            <div className="mb-8">
                                <h3 className="text-xl font-black mb-2 uppercase tracking-tight">{plan.name}</h3>
                                <div className="flex items-baseline">
                                    <span className={`text-4xl font-black tracking-tighter ${discount > 0 && plan.rawPrice > 0 ? 'text-green-400' : ''}`}>
                                        ₹{finalPrice}
                                    </span>
                                    <span className="text-sm font-bold opacity-70 ml-1">{plan.period}</span>
                                    {discount > 0 && plan.rawPrice > 0 && (
                                        <span className="ml-2 text-xs font-bold line-through opacity-50">{plan.price}</span>
                                    )}
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
                            {plan.rawPrice === 0 ? (
                                <div className="w-full py-4 text-center font-black text-xs uppercase tracking-widest opacity-50 border border-gray-200 rounded-2xl">
                                    Current Access
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowCheckout({ name: plan.name, price: finalPrice, rawPrice: plan.rawPrice, originalPrice: plan.price })}
                                    disabled={loading || currentUser?.subscriptionStatus === 'active'}
                                    className={`w-full py-4 rounded-2xl font-bold transition-all active:scale-[0.98] ${plan.popular
                                        ? 'bg-white text-sky-600 shadow-lg'
                                        : 'bg-sky-600 text-white'
                                        } disabled:opacity-50`}
                                >
                                    {currentUser?.subscriptionStatus === 'active' ? 'Already Subscribed' : 'Upgrade Now'}
                                </button>
                            )}
                        </div>
                    );
                })}
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
                        ? 'Note: This is a professional payment preview. Demo codes available: FIRSTOFFICER, VETRI50.'
                        : 'குறிப்பு: இது ஒரு தொழில்முறை கட்டண முன்னோட்டம். குறியீடுகள்: FIRSTOFFICER, VETRI50.'}
                </p>
            </div>

            {/* Activation Code Section */}
            <div className="bg-sky-50 p-8 rounded-[32px] border border-sky-100 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex-1 space-y-2">
                    <h3 className="text-xl font-black text-sky-900 uppercase tracking-tight">{t.activationCodeLabel}</h3>
                    <p className="text-sm text-sky-600/70 font-medium">
                        {lang === 'en'
                            ? "Received a code on WhatsApp? Enter it here to unlock your Pro status instantly."
                            : "WhatsApp மூலம் குறியீடு பெற்றீர்களா? உங்கள் Pro வசதியை உடனே பெற இங்கே பதிவிடவும்."}
                    </p>
                </div>
                <div className="w-full md:w-auto flex flex-col space-y-2">
                    <div className="bg-white p-2 rounded-2xl border border-sky-200 shadow-sm flex items-center space-x-2">
                        <input
                            type="text"
                            placeholder={t.activationPlaceholder}
                            value={activationCode}
                            onChange={(e) => setActivationCode(e.target.value)}
                            className="w-full md:w-48 bg-transparent px-4 py-2 text-sm font-bold outline-none uppercase"
                        />
                        <button
                            onClick={handleActivateWithCode}
                            disabled={loading || !activationCode}
                            className="bg-sky-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-sky-700 transition-all disabled:opacity-50"
                        >
                            {t.activateButton}
                        </button>
                    </div>
                    {activationError && <p className="text-[10px] font-black text-red-500 uppercase px-2">{activationError}</p>}
                    {activationSuccess && <p className="text-[10px] font-black text-green-600 uppercase px-2">{activationSuccess}</p>}
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPage;
