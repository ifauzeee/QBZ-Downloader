import { useEffect, useMemo, useState } from 'react';
import { smartFetch } from '../utils/api';
import { Icons } from './Icons';

type OnboardingStep = {
    id: 'app_id' | 'app_secret' | 'token' | 'user_id';
    completed: boolean;
};

type OnboardingResponse = {
    configured: boolean;
    steps: OnboardingStep[];
};

type WizardStep = 'welcome' | 'api' | 'auth' | 'storage' | 'finish';

interface DesktopSetupGateProps {
    onContinue: () => void;
}


export function DesktopSetupGate({ onContinue }: DesktopSetupGateProps) {
    const [wizardStep, setWizardStep] = useState<WizardStep>('welcome');
    const [steps, setSteps] = useState<OnboardingStep[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [verifiedAccount, setVerifiedAccount] = useState<any>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [showToken, setShowToken] = useState(false);

    const [form, setForm] = useState({
        appId: '',
        appSecret: '',
        token: '',
        userId: '',
        downloadsPath: ''
    });

    const loadStatus = async () => {
        setLoading(true);
        try {
            const res = await smartFetch('/api/onboarding');
            if (!res) return;
            const data = (await res.json()) as OnboardingResponse;
            if (data.configured) {
                onContinue();
                return;
            }
            setSteps(data.steps || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadStatus();
    }, []);

    const remoteCompletion = useMemo(() => {
        const map: Record<string, boolean> = {};
        steps.forEach(s => map[s.id] = s.completed);
        return map;
    }, [steps]);

    const handleSave = async (isFinal = false) => {
        setError('');
        setSaving(true);
        try {
            const payload: any = {};
            if (form.appId) payload.app_id = form.appId;
            if (form.appSecret) payload.app_secret = form.appSecret;
            if (form.token) payload.token = form.token;
            if (form.userId) payload.user_id = form.userId;
            if (form.downloadsPath) payload.downloads_path = form.downloadsPath;

            const res = await smartFetch('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res) {
                setSaving(false);
                return false;
            }
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'Failed to save settings');
                setSaving(false);
                return false;
            }

            // Refresh status
            const statusRes = await smartFetch('/api/onboarding');
            if (statusRes && statusRes.ok) {
                const statusData = await statusRes.json();
                setSteps(statusData.steps || []);
                if (isFinal && statusData.configured) {
                    onContinue();
                }
            }
            setSaving(false);
            return true;
        } catch (e) {
            setError('Connection error');
            setSaving(false);
            return false;
        }
    };

    const handleVerify = async () => {
        setVerifying(true);
        setVerifiedAccount(null);
        setError('');

        const saved = await handleSave(false);
        if (!saved) {
            setVerifying(false);
            return;
        }

        try {
            const res = await smartFetch('/api/login', { method: 'POST' });
            if (!res) {
                setVerifying(false);
                return;
            }
            const data = await res.json();
            if (res.ok && data.success) {
                setVerifiedAccount(data.user);
            } else {
                setError(data.error || 'Verification failed');
            }
        } catch (e) {
            setError('Verification failed');
        } finally {
            setVerifying(false);
        }
    };

    const nextStep = async () => {
        if (wizardStep === 'api') {
            if (!remoteCompletion.app_id && !form.appId) return setError('App ID is required');
            if (!remoteCompletion.app_secret && !form.appSecret) return setError('App Secret is required');
            const ok = await handleSave();
            if (ok) setWizardStep('auth');
        } else if (wizardStep === 'auth') {
            if (!remoteCompletion.token && !form.token) return setError('Token is required');
            if (!remoteCompletion.user_id && !form.userId) return setError('User ID is required');
            const ok = await handleSave();
            if (ok) setWizardStep('storage');
        } else if (wizardStep === 'storage') {
            if (!form.downloadsPath) return setError('Download path is required');
            const ok = await handleSave();
            if (ok) setWizardStep('finish');
        }
    };

    if (loading) return (
        <section className="desktop-onboarding-screen">
            <div className="desktop-onboarding-loading">
                <div className="desktop-onboarding-spinner" />
                <p>Initializing setup...</p>
            </div>
        </section>
    );

    const stepOrder: WizardStep[] = ['welcome', 'api', 'auth', 'storage', 'finish'];
    const currentIdx = stepOrder.indexOf(wizardStep);

    return (
        <section className="desktop-onboarding-screen">
            <div className="onboarding-v2-container">
                {/* Background Decoration */}
                <div className="onboarding-bg-glow" />
                
                <div className="onboarding-v2-shell">
                    {/* Header / Progress */}
                    {wizardStep !== 'welcome' && (
                        <div className="onboarding-v2-header">
                            <div className="onboarding-v2-steps">
                                {['API', 'Auth', 'Storage', 'Verify'].map((label, idx) => (
                                    <div key={label} className={`step-dot-wrap ${idx + 1 <= currentIdx ? 'done' : idx === currentIdx - 1 ? 'active' : ''}`}>
                                        <div className="step-dot" />
                                        <span>{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="wizard-content-wrap">
                        {wizardStep === 'welcome' && (
                            <div className="onboarding-v2-card welcome animate-slide-up">
                                <div className="welcome-hero-icon">
                                    <Icons.Library size={64} />
                                </div>
                                <h1>QBZ Downloader</h1>
                                <p className="subtitle">High-Fidelity Audio Experience</p>
                                <p className="description">
                                    Welcome to the most advanced music downloader for Qobuz. 
                                    Let's get you set up with your credentials and preferences.
                                </p>
                                <button className="btn primary hero" onClick={() => setWizardStep('api')}>
                                    Start Setup
                                    <Icons.ArrowRight size={18} />
                                </button>
                                <div className="welcome-footer">
                                    <span>Version 5.2.0 Stable</span>
                                </div>
                            </div>
                        )}

                        {wizardStep === 'api' && (
                            <div className="onboarding-v2-card animate-slide-right">
                                <div className="card-header">
                                    <Icons.Resolve size={32} color="var(--accent)" />
                                    <h2>API Credentials</h2>
                                    <p>Enter your Qobuz Application credentials.</p>
                                </div>

                                <div className="onboarding-v2-form">
                                    <div className="form-item">
                                        <label>App ID</label>
                                        <input 
                                            type="text" 
                                            value={form.appId} 
                                            placeholder={remoteCompletion.app_id ? "••••••••" : "Enter App ID..."}
                                            onChange={e => setForm({...form, appId: e.target.value})}
                                        />
                                    </div>
                                    <div className="form-item">
                                        <label>App Secret</label>
                                        <div className="input-with-action">
                                            <input 
                                                type={showSecret ? "text" : "password"} 
                                                value={form.appSecret} 
                                                placeholder={remoteCompletion.app_secret ? "••••••••••••••••" : "Enter Secret..."}
                                                onChange={e => setForm({...form, appSecret: e.target.value})}
                                            />
                                            <button onClick={() => setShowSecret(!showSecret)}>
                                                {showSecret ? <Icons.Search size={16} /> : <Icons.Search size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    {error && <div className="onboarding-error-msg">{error}</div>}
                                </div>

                                <div className="card-footer">
                                    <button className="btn secondary" onClick={() => setWizardStep('welcome')}>Back</button>
                                    <button className="btn primary" onClick={nextStep} disabled={saving}>
                                        {saving ? 'Saving...' : 'Next'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {wizardStep === 'auth' && (
                            <div className="onboarding-v2-card animate-slide-right">
                                <div className="card-header">
                                    <Icons.Batch size={32} color="var(--accent)" />
                                    <h2>User Session</h2>
                                    <p>Your unique authentication token and user ID.</p>
                                </div>

                                <div className="onboarding-v2-form">
                                    <div className="form-item">
                                        <label>Auth Token</label>
                                        <div className="input-with-action">
                                            <input 
                                                type={showToken ? "text" : "password"} 
                                                value={form.token} 
                                                placeholder={remoteCompletion.token ? "••••••••••••••••" : "Enter Token..."}
                                                onChange={e => setForm({...form, token: e.target.value})}
                                            />
                                            <button onClick={() => setShowToken(!showToken)}>
                                                {showToken ? <Icons.Search size={16} /> : <Icons.Search size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="form-item">
                                        <label>User ID</label>
                                        <input 
                                            type="text" 
                                            value={form.userId} 
                                            placeholder={remoteCompletion.user_id ? "••••••••" : "Enter User ID..."}
                                            onChange={e => setForm({...form, userId: e.target.value})}
                                        />
                                    </div>
                                    {error && <div className="onboarding-error-msg">{error}</div>}
                                </div>

                                <div className="card-footer">
                                    <button className="btn secondary" onClick={() => setWizardStep('api')}>Back</button>
                                    <button className="btn primary" onClick={nextStep} disabled={saving}>
                                        {saving ? 'Saving...' : 'Next'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {wizardStep === 'storage' && (
                            <div className="onboarding-v2-card animate-slide-right">
                                <div className="card-header">
                                    <Icons.Download size={32} color="var(--accent)" />
                                    <h2>Library Storage</h2>
                                    <p>Where should we save your high-res music?</p>
                                </div>

                                <div className="onboarding-v2-form">
                                    <div className="form-item">
                                        <label>Download Location</label>
                                        <div className="input-with-action">
                                            <input 
                                                type="text" 
                                                value={form.downloadsPath} 
                                                placeholder="Select folder..."
                                                readOnly
                                            />
                                            {window.qbzDesktop && (
                                                <button className="browse-btn" onClick={async () => {
                                                    const path = await window.qbzDesktop?.app.selectFolder(form.downloadsPath);
                                                    if (path) setForm({...form, downloadsPath: path});
                                                }}>
                                                    Browse
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="hint">Your music will be organized using metadata templates.</p>
                                    {error && <div className="onboarding-error-msg">{error}</div>}
                                </div>

                                <div className="card-footer">
                                    <button className="btn secondary" onClick={() => setWizardStep('auth')}>Back</button>
                                    <button className="btn primary" onClick={nextStep} disabled={saving}>
                                        {saving ? 'Saving...' : 'Next'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {wizardStep === 'finish' && (
                            <div className="onboarding-v2-card finish animate-slide-right">
                                <div className="card-header">
                                    <div className="finish-check">
                                        <Icons.Check size={40} />
                                    </div>
                                    <h2>Almost Ready!</h2>
                                    <p>Let's verify your account before we dive in.</p>
                                </div>

                                <div className="onboarding-v2-form">
                                    {verifiedAccount ? (
                                        <div className="account-preview animate-scale-in">
                                            <img src={verifiedAccount.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=qbz"} alt="Avatar" />
                                            <div className="account-info">
                                                <strong>{verifiedAccount.email}</strong>
                                                <span>{verifiedAccount.country_code} • {verifiedAccount.subscription?.offer || 'Standard'}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="verify-placeholder">
                                            <p>All credentials saved. Click below to verify.</p>
                                        </div>
                                    )}
                                    {error && <div className="onboarding-error-msg">{error}</div>}
                                </div>

                                <div className="card-footer centered">
                                    {!verifiedAccount ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                                            {(!remoteCompletion.app_id || !remoteCompletion.app_secret || !remoteCompletion.token || !remoteCompletion.user_id) && (
                                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                                                    Go back and complete all required fields before verifying.
                                                </p>
                                            )}
                                            <button
                                                className="btn primary hero"
                                                onClick={handleVerify}
                                                disabled={verifying || !remoteCompletion.app_id || !remoteCompletion.app_secret || !remoteCompletion.token || !remoteCompletion.user_id}
                                            >
                                                {verifying ? 'Verifying...' : 'Verify & Launch'}
                                            </button>
                                        </div>
                                    ) : (
                                        <button className="btn primary hero success" onClick={() => handleSave(true)}>
                                            Enter Dashboard
                                            <Icons.ArrowRight size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .onboarding-v2-container {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    z-index: 1;
                }

                .onboarding-bg-glow {
                    display: none;
                }

                .onboarding-v2-shell {
                    width: min(720px, 92vw);
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                .onboarding-v2-header {
                    display: flex;
                    justify-content: center;
                }

                .onboarding-v2-steps {
                    display: flex;
                    gap: 40px;
                }

                .step-dot-wrap {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    opacity: 0.3;
                    transition: all 0.4s ease;
                }

                .step-dot-wrap.active { opacity: 1; transform: scale(1.1); }
                .step-dot-wrap.done { opacity: 1; }

                .step-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #fff;
                    box-shadow: 0 0 10px rgba(255,255,255,0.3);
                }

                .step-dot-wrap.active .step-dot {
                    background: var(--accent);
                    box-shadow: 0 0 15px var(--accent-glow);
                }

                .step-dot-wrap.done .step-dot {
                    background: var(--success);
                }

                .step-dot-wrap span {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .onboarding-v2-card {
                    background: rgba(10, 10, 10, 0.4);
                    backdrop-filter: blur(40px);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 40px;
                    padding: 56px;
                    box-shadow: 0 50px 100px rgba(0,0,0,0.8);
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                }

                .onboarding-v2-card.welcome {
                    text-align: center;
                    align-items: center;
                }

                .welcome-hero-icon {
                    width: 120px;
                    height: 120px;
                    border-radius: 35% 65% 70% 30% / 30% 40% 60% 70%;
                    background: var(--gradient-primary);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 8px;
                    animation: blob 10s infinite linear;
                    color: #000;
                }

                @keyframes blob {
                    0% { border-radius: 35% 65% 70% 30% / 30% 40% 60% 70%; }
                    33% { border-radius: 50% 50% 30% 70% / 50% 60% 40% 50%; }
                    66% { border-radius: 70% 30% 50% 50% / 30% 30% 70% 70%; }
                    100% { border-radius: 35% 65% 70% 30% / 30% 40% 60% 70%; }
                }

                .onboarding-v2-card h1 {
                    font-size: 48px;
                    font-weight: 900;
                    letter-spacing: -2px;
                    margin: 0;
                }

                .onboarding-v2-card .subtitle {
                    font-size: 14px;
                    font-weight: 700;
                    color: var(--accent);
                    text-transform: uppercase;
                    letter-spacing: 3px;
                    margin: -16px 0 0;
                }

                .onboarding-v2-card .description {
                    color: var(--text-secondary);
                    font-size: 16px;
                    line-height: 1.6;
                    max-width: 32ch;
                }

                .welcome-footer {
                    margin-top: 16px;
                    font-size: 11px;
                    opacity: 0.4;
                    font-weight: 600;
                }

                .card-header h2 {
                    font-size: 32px;
                    font-weight: 800;
                    margin: 12px 0 4px;
                }

                .card-header p {
                    color: var(--text-secondary);
                    margin: 0;
                }

                .onboarding-v2-form {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .form-item {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .form-item label {
                    font-size: 12px;
                    font-weight: 700;
                    color: var(--text-secondary);
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    padding-left: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .form-item input {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 18px;
                    height: 56px;
                    padding: 0 20px;
                    color: #fff;
                    font-size: 16px;
                    transition: all 0.3s ease;
                }

                .form-item input:focus {
                    background: rgba(255,255,255,0.08);
                    border-color: var(--accent);
                    box-shadow: 0 0 25px var(--accent-glow);
                }

                .input-with-action {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    gap: 8px;
                }

                .input-with-action button {
                    height: 56px;
                    min-width: 56px;
                    border-radius: 18px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(255,255,255,0.04);
                    color: #fff;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .input-with-action button:hover {
                    background: rgba(255,255,255,0.1);
                    border-color: rgba(255,255,255,0.2);
                }

                .browse-btn {
                    padding: 0 20px !important;
                    font-size: 14px;
                    font-weight: 700;
                }

                .card-footer {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 8px;
                }

                .card-footer.centered {
                    justify-content: center;
                }

                .hint {
                    font-size: 12px;
                    color: var(--text-secondary);
                    margin: -8px 0 0;
                    padding-left: 4px;
                }

                .onboarding-error-msg {
                    padding: 12px 16px;
                    border-radius: 14px;
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #fca5a5;
                    font-size: 13px;
                    font-weight: 600;
                }

                .finish-check {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: var(--success);
                    color: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 8px;
                    box-shadow: 0 0 30px rgba(34, 197, 94, 0.3);
                }

                .verify-placeholder {
                    padding: 40px;
                    text-align: center;
                    border: 2px dashed rgba(255,255,255,0.1);
                    border-radius: 24px;
                    color: var(--text-secondary);
                }

                .account-preview {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 20px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 24px;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .account-preview img {
                    width: 56px;
                    height: 56px;
                    border-radius: 16px;
                    background: var(--accent);
                }

                .account-info {
                    display: flex;
                    flex-direction: column;
                }

                .account-info strong {
                    font-size: 16px;
                }

                .account-info span {
                    font-size: 12px;
                    color: var(--text-secondary);
                }

                .btn.hero.success {
                    background: var(--success);
                    color: #fff;
                    border: none;
                }

                .btn.hero.success:hover {
                    box-shadow: 0 0 30px rgba(34, 197, 94, 0.4);
                    transform: translateY(-2px);
                }

                .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
                .animate-slide-right { animation: slideRight 0.4s ease-out forwards; }
                .animate-scale-in { animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

                @keyframes slideRight {
                    from { opacity: 0; transform: translateX(-20px); }
                    to { opacity: 1; transform: translateX(0); }
                }

                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </section>
    );
}

