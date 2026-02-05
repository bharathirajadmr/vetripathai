
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { GlobalSettings, AdminStats, User } from '../types';
import { API_URL } from '../constants';

const AdminPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [settings, setSettings] = useState<GlobalSettings | null>(null);
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saveLoading, setSaveLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'promo' | 'syllabus'>('overview');
    const [upiInput, setUpiInput] = useState('');
    const [newSyllabusId, setNewSyllabusId] = useState('');
    const [newSyllabusContent, setNewSyllabusContent] = useState('');
    const [genStatus, setGenStatus] = useState<any>(null);

    const checkStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/generation-status`);
            const data = await res.json();
            if (data.success) setGenStatus(data.data);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(() => {
            if (genStatus?.isProcessing) checkStatus();
        }, 5000);
        return () => clearInterval(interval);
    }, [genStatus?.isProcessing]);

    useEffect(() => {
        const fetchData = async () => {
            setError(null);
            try {
                const settingsRes = await fetch(`${API_URL}/api/admin/settings`);
                if (!settingsRes.ok) throw new Error(`Settings Fetch: ${settingsRes.status}`);
                const settingsData = await settingsRes.json();
                if (settingsData.success) {
                    setSettings(settingsData.data);
                    setUpiInput(settingsData.data.upiId);
                } else {
                    throw new Error(settingsData.error || "Failed to load settings");
                }

                const subsRes = await fetch(`${API_URL}/api/admin/subscribers`);
                if (!subsRes.ok) throw new Error(`Subscriber Fetch: ${subsRes.status}`);
                const subsData = await subsRes.json();
                if (subsData.success) {
                    const users: User[] = subsData.data;
                    setStats({
                        totalUsers: users.length,
                        activePro: users.filter(u => u.subscriptionStatus === 'active').length,
                        trials: users.filter(u => u.subscriptionStatus === 'trial').length,
                        recentUsers: users.slice(-5).reverse()
                    });
                } else {
                    throw new Error(subsData.error || "Failed to load subscribers");
                }
            } catch (error: any) {
                console.error("Admin fetch error:", error);
                setError(error.message || "Connection to command center lost.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleSaveSettings = async (updatedSettings: GlobalSettings) => {
        setSaveLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedSettings)
            });
            const data = await res.json();
            if (data.success) {
                setSettings(updatedSettings);
                alert("Settings saved successfully!");
            }
        } catch (error) {
            alert("Failed to save settings");
        } finally {
            setSaveLoading(false);
        }
    };

    const handleUpdateUpi = () => {
        if (!settings) return;
        handleSaveSettings({ ...settings, upiId: upiInput });
    };

    const handleAddPromo = () => {
        const code = prompt("Enter Promo Code (e.g. SAVE20):");
        const discount = prompt("Enter Discount Percentage (e.g. 20):");
        if (code && discount && settings) {
            const updatedPromo = { ...settings.promoCodes, [code.toUpperCase()]: parseInt(discount) };
            handleSaveSettings({ ...settings, promoCodes: updatedPromo });
        }
    };

    const handleDeletePromo = (code: string) => {
        if (!settings || !confirm(`Delete promo code ${code}?`)) return;
        const updatedPromo = { ...settings.promoCodes };
        delete updatedPromo[code];
        handleSaveSettings({ ...settings, promoCodes: updatedPromo });
    };

    const handleUploadSyllabus = async () => {
        if (!newSyllabusId || !newSyllabusContent) return;
        setSaveLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/upload-syllabus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: newSyllabusId, content: newSyllabusContent })
            });
            if ((await res.json()).success) {
                alert("Syllabus uploaded!");
                setNewSyllabusId('');
                setNewSyllabusContent('');
            }
        } catch (error) {
            alert("Failed to upload syllabus");
        } finally {
            setSaveLoading(false);
        }
    };

    if (currentUser?.email !== 'admin@vetripathai.pro') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white p-12 rounded-[40px] shadow-2xl shadow-sky-100 text-center space-y-6 border border-gray-100">
                    <div className="text-7xl">🔒</div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Restricted Area</h1>
                    <p className="text-gray-500 font-medium leading-relaxed">
                        This Command Center is reserved for the Chief Secretary. <br />
                        Current Session: <span className="text-sky-600 font-bold">{currentUser?.email || 'Guest'}</span>
                    </p>
                    <div className="pt-6">
                        <a
                            href="#/dashboard"
                            className="inline-block px-8 py-4 bg-sky-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-sky-700 transition-all shadow-lg shadow-sky-200 active:scale-95"
                        >
                            Back to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center space-y-6">
            <div className="w-16 h-16 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
            <p className="font-black text-sky-900 uppercase tracking-[0.2em] animate-pulse">Establishing Secure Connection...</p>
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center space-y-6">
            <div className="text-6xl">📡</div>
            <h2 className="text-2xl font-black text-gray-900 uppercase">Command Center Offline</h2>
            <p className="text-red-500 font-bold max-w-sm">{error}</p>
            <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 text-xs text-amber-700 font-bold max-w-md leading-relaxed">
                <span className="text-amber-900 uppercase block mb-1">PRO-TIP: RESTART REQUIRED</span>
                Please restart your backend server (node index.js) to apply the new administrative protocols.
            </div>
            <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black transition-all"
            >
                Retry Connection
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Admin Top Nav */}
            <nav className="bg-white border-b border-gray-100 px-8 py-4 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">🏛️</span>
                        <span className="font-black text-gray-900 tracking-tighter text-xl">VP HQ</span>
                    </div>
                    <a href="#/dashboard" className="text-xs font-black text-gray-400 uppercase tracking-widest hover:text-sky-600 transition-colors">
                        ← Exit HQ
                    </a>
                </div>
            </nav>

            <div className="max-w-6xl mx-auto space-y-8 p-8 pb-20">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Admin Dashboard</h1>
                        <p className="text-gray-500 font-bold text-xs uppercase tracking-widest">Command Center / {activeTab}</p>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-2xl">
                        {(['overview', 'settings', 'promo', 'syllabus'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-white text-sky-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </header>

                {activeTab === 'overview' && stats && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
                                <span className="text-3xl mb-4 block">👥</span>
                                <h3 className="text-gray-400 text-xs font-black uppercase tracking-widest">Total Aspirants</h3>
                                <p className="text-4xl font-black text-gray-900 mt-1">{stats.totalUsers}</p>
                            </div>
                            <div className="bg-sky-50 p-8 rounded-[32px] border border-sky-100 shadow-sm">
                                <span className="text-3xl mb-4 block">⭐</span>
                                <h3 className="text-sky-900/40 text-xs font-black uppercase tracking-widest">Active Pro</h3>
                                <p className="text-4xl font-black text-sky-600 mt-1">{stats.activePro}</p>
                            </div>
                            <div className="bg-amber-50 p-8 rounded-[32px] border border-amber-100 shadow-sm">
                                <span className="text-3xl mb-4 block">⏳</span>
                                <h3 className="text-amber-900/40 text-xs font-black uppercase tracking-widest">Free Trials</h3>
                                <p className="text-4xl font-black text-amber-600 mt-1">{stats.trials}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                            <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                                <h3 className="font-black text-gray-900 uppercase tracking-tight">Recent Onboarding</h3>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {stats.recentUsers.map(user => (
                                    <div key={user.email} className="p-6 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-gray-900">{user.fullName}</p>
                                            <div className="flex gap-2">
                                                <p className="text-xs text-gray-400 font-medium">{user.email}</p>
                                                <span className="text-xs text-gray-300">•</span>
                                                <p className="text-xs text-gray-400 font-medium">{user.mobile}</p>
                                            </div>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.subscriptionStatus === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                                            }`}>
                                            {user.subscriptionStatus}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'settings' && settings && (
                    <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-8">
                        <div className="space-y-4">
                            <h3 className="font-black text-gray-900 uppercase tracking-tight">Payment Gatekeeper (UPI)</h3>
                            <div className="flex gap-4">
                                <input
                                    type="text"
                                    value={upiInput}
                                    onChange={(e) => setUpiInput(e.target.value)}
                                    className="flex-1 bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100 font-bold outline-none focus:border-sky-500 transition-all text-sky-900"
                                    placeholder="Enter UPI ID (e.g. name@upi)"
                                />
                                <button
                                    onClick={handleUpdateUpi}
                                    disabled={saveLoading}
                                    className="px-8 py-4 bg-sky-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-sky-700 disabled:opacity-50 transition-all"
                                >
                                    {saveLoading ? "Saving..." : "Update UPI"}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 pt-8 border-t border-gray-50">
                            <h3 className="font-black text-gray-900 uppercase tracking-tight">Rate Card (Pricing)</h3>
                            <div className="grid gap-4">
                                {settings.rateCard.map((plan, idx) => (
                                    <div key={plan.name} className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100">
                                        <div>
                                            <p className="font-black text-gray-900">{plan.name}</p>
                                            <p className="text-xs text-gray-400 font-bold uppercase">{plan.price} {plan.period}</p>
                                        </div>
                                        <div className="flex gap-4">
                                            <input
                                                type="number"
                                                defaultValue={plan.rawPrice}
                                                onBlur={(e) => {
                                                    const newRaw = parseInt(e.target.value);
                                                    const updated = [...settings.rateCard];
                                                    updated[idx] = { ...updated[idx], rawPrice: newRaw, price: `₹${newRaw}` };
                                                    handleSaveSettings({ ...settings, rateCard: updated });
                                                }}
                                                className="w-24 bg-white px-4 py-2 rounded-xl border border-gray-200 font-black text-right outline-none"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'promo' && settings && (
                    <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                            <h3 className="font-black text-gray-900 uppercase tracking-tight">Active Promo Codes</h3>
                            <button
                                onClick={handleAddPromo}
                                className="text-xs font-black text-sky-600 uppercase tracking-widest hover:text-sky-800"
                            >
                                + Add New Code
                            </button>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {Object.entries(settings.promoCodes).map(([code, discount]) => (
                                <div key={code} className="p-6 flex justify-between items-center">
                                    <div>
                                        <span className="px-3 py-1 bg-sky-100 text-sky-700 rounded-lg text-xs font-black mr-4">{code}</span>
                                        <span className="text-sm font-black text-green-600">{discount}% OFF</span>
                                    </div>
                                    <button
                                        onClick={() => handleDeletePromo(code)}
                                        className="text-xs font-bold text-red-400 hover:text-red-600"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'syllabus' && (
                    <div className="space-y-8">
                        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
                            <h3 className="font-black text-gray-900 uppercase tracking-tight">Add Exam Syllabus</h3>
                            <div className="space-y-4">
                                <input
                                    type="text"
                                    placeholder="Syllabus ID (e.g. tnpsc-group-2)"
                                    value={newSyllabusId}
                                    onChange={(e) => setNewSyllabusId(e.target.value)}
                                    className="w-full bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100 font-bold outline-none"
                                />
                                <textarea
                                    placeholder="Paste full syllabus text content here..."
                                    rows={10}
                                    value={newSyllabusContent}
                                    onChange={(e) => setNewSyllabusContent(e.target.value)}
                                    className="w-full bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100 font-bold outline-none resize-none"
                                ></textarea>
                                <button
                                    onClick={handleUploadSyllabus}
                                    disabled={saveLoading || !newSyllabusId || !newSyllabusContent}
                                    className="w-full py-4 bg-sky-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black disabled:opacity-50 transition-all font-outfit"
                                >
                                    {saveLoading ? "Uploading..." : "Publish Syllabus"}
                                </button>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-black text-gray-900 uppercase tracking-tight">AI Question Bank Factory</h3>
                                {genStatus?.isProcessing && (
                                    <span className="flex items-center text-[10px] font-black text-sky-600 bg-sky-50 px-3 py-1 rounded-full animate-pulse uppercase tracking-widest">
                                        ⚡ Processing: {genStatus.currentTopic}
                                    </span>
                                )}
                            </div>

                            <p className="text-gray-500 text-xs font-medium leading-relaxed">
                                Enter a published Syllabus ID to automatically generate a complete question bank.
                                <span className="text-amber-600 font-bold ml-1">Note: Generation happens slowly (1 topic/15s) to stay within API limits.</span>
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Target Syllabus ID"
                                        className="w-full bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100 font-bold outline-none"
                                        id="genSyllabusId"
                                    />
                                    <button
                                        onClick={async () => {
                                            const id = (document.getElementById('genSyllabusId') as HTMLInputElement).value;
                                            if (!id) return alert("Enter Syllabus ID");
                                            setSaveLoading(true);
                                            try {
                                                const res = await fetch(`${API_URL}/api/admin/start-generation`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ id })
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                    alert("Generation started in background!");
                                                    checkStatus();
                                                } else {
                                                    alert(data.error);
                                                }
                                            } catch (e) {
                                                alert("Connection failed");
                                            } finally {
                                                setSaveLoading(false);
                                            }
                                        }}
                                        disabled={saveLoading || genStatus?.isProcessing}
                                        className="w-full py-4 bg-sky-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-sky-700 disabled:opacity-50 transition-all shadow-lg shadow-sky-100"
                                    >
                                        {genStatus?.isProcessing ? "Factory Running..." : "Start Question Generation"}
                                    </button>
                                </div>

                                {genStatus && (
                                    <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 flex flex-col justify-center">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] font-black text-gray-400 uppercase">Progress Status</span>
                                            <span className="text-[10px] font-black text-sky-600 uppercase">{genStatus.completed}/{genStatus.total} Topics Done</span>
                                        </div>
                                        <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                                            <div
                                                className="bg-sky-500 h-full transition-all duration-1000"
                                                style={{ width: `${(genStatus.completed / genStatus.total) * 100 || 0}%` }}
                                            ></div>
                                        </div>
                                        <div className="mt-4 text-[10px] font-bold text-gray-500">
                                            {genStatus.isProcessing ? "Queue active. Auto-saving results..." : "Queue standing by."}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
