import { useEffect, useMemo, useState } from 'react';
import { smartFetch } from '../utils/api';

type OnboardingStep = {
    id: 'app_id' | 'app_secret' | 'token' | 'user_id';
    completed: boolean;
};

type OnboardingResponse = {
    configured: boolean;
    steps: OnboardingStep[];
};

type SetupStage = 'intro' | 'setup';
type ChecklistId = OnboardingStep['id'] | 'downloads_path';

interface DesktopSetupGateProps {
    onContinue: () => void;
}

const BASE_STEPS: OnboardingStep[] = [
    { id: 'app_id', completed: false },
    { id: 'app_secret', completed: false },
    { id: 'token', completed: false },
    { id: 'user_id', completed: false }
];

const STEP_LABELS: Record<ChecklistId, string> = {
    app_id: 'Qobuz App ID',
    app_secret: 'Qobuz App Secret',
    token: 'User Auth Token',
    user_id: 'Qobuz User ID',
    downloads_path: 'Download Path'
};

export function DesktopSetupGate({ onContinue }: DesktopSetupGateProps) {
    const [stage, setStage] = useState<SetupStage>('intro');
    const [steps, setSteps] = useState<OnboardingStep[]>(BASE_STEPS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [verifiedAccount, setVerifiedAccount] = useState('');
    const [showSecret, setShowSecret] = useState(false);
    const [showToken, setShowToken] = useState(false);

    const [form, setForm] = useState({
        appId: '',
        appSecret: '',
        token: '',
        userId: '',
        downloadsPath: './downloads'
    });

    const remoteCompletion = useMemo(() => {
        const map: Record<OnboardingStep['id'], boolean> = {
            app_id: false,
            app_secret: false,
            token: false,
            user_id: false
        };

        for (const step of steps) {
            map[step.id] = Boolean(step.completed);
        }

        return map;
    }, [steps]);

    const checklist = useMemo(
        () => [
            {
                id: 'app_id' as const,
                completed: remoteCompletion.app_id || Boolean(form.appId.trim())
            },
            {
                id: 'app_secret' as const,
                completed: remoteCompletion.app_secret || Boolean(form.appSecret.trim())
            },
            {
                id: 'token' as const,
                completed: remoteCompletion.token || Boolean(form.token.trim())
            },
            {
                id: 'user_id' as const,
                completed: remoteCompletion.user_id || Boolean(form.userId.trim())
            },
            {
                id: 'downloads_path' as const,
                completed: Boolean(form.downloadsPath.trim())
            }
        ],
        [form.appId, form.appSecret, form.downloadsPath, form.token, form.userId, remoteCompletion]
    );

    const completion = useMemo(() => {
        const done = checklist.filter((item) => item.completed).length;
        return Math.round((done / checklist.length) * 100);
    }, [checklist]);

    const loadStatus = async () => {
        setLoading(true);
        try {
            const res = await smartFetch('/api/onboarding');
            if (!res) {
                setError('Cannot reach local service. Please check your connection.');
                return;
            }

            const data = (await res.json()) as OnboardingResponse;
            if (!res.ok) {
                setError('Failed to load onboarding status.');
                return;
            }

            if (data.configured) {
                onContinue();
                return;
            }

            setSteps(data.steps?.length ? data.steps : BASE_STEPS);
            setError('');
        } catch (e) {
            console.error(e);
            setError('Unexpected error while checking setup status.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadStatus();
    }, []);

    const validateMissingFields = () => {
        const missing: string[] = [];

        if (!remoteCompletion.app_id && !form.appId.trim()) missing.push(STEP_LABELS.app_id);
        if (!remoteCompletion.app_secret && !form.appSecret.trim())
            missing.push(STEP_LABELS.app_secret);
        if (!remoteCompletion.token && !form.token.trim()) missing.push(STEP_LABELS.token);
        if (!remoteCompletion.user_id && !form.userId.trim()) missing.push(STEP_LABELS.user_id);
        if (!form.downloadsPath.trim()) missing.push(STEP_LABELS.downloads_path);

        if (missing.length > 0) {
            setError(`Please complete: ${missing.join(', ')}`);
            return false;
        }

        return true;
    };

    const saveCredentials = async (continueAfterSave: boolean): Promise<boolean> => {
        setError('');
        setMessage('');

        if (!validateMissingFields()) {
            return false;
        }

        const payload: Record<string, string> = {};

        if (form.appId.trim()) payload.app_id = form.appId.trim();
        if (form.appSecret.trim()) payload.app_secret = form.appSecret.trim();
        if (form.token.trim()) payload.token = form.token.trim();
        if (form.userId.trim()) payload.user_id = form.userId.trim();
        if (form.downloadsPath.trim()) payload.downloads_path = form.downloadsPath.trim();

        setSaving(true);
        try {
            const res = await smartFetch('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res) {
                setError('Failed to connect to local API.');
                return false;
            }

            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.error || 'Failed to save credentials.');
                return false;
            }

            setMessage('Credentials and path saved locally.');

            const checkRes = await smartFetch('/api/onboarding');
            if (checkRes && checkRes.ok) {
                const checkData = (await checkRes.json()) as OnboardingResponse;
                if (checkData.steps?.length) {
                    setSteps(checkData.steps);
                }

                if (continueAfterSave) {
                    if (checkData.configured) {
                        onContinue();
                    } else {
                        setError('Credentials are still incomplete. Please review required fields.');
                        return false;
                    }
                }
            }

            return true;
        } catch (e) {
            console.error(e);
            setError('Unexpected error while saving credentials.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleSaveAndContinue = async () => {
        await saveCredentials(true);
    };

    const handleVerify = async () => {
        setVerifying(true);
        setVerifiedAccount('');
        setError('');
        setMessage('');

        const saved = await saveCredentials(false);
        if (!saved) {
            setVerifying(false);
            return;
        }

        try {
            const res = await smartFetch('/api/login', { method: 'POST' });
            if (!res) {
                setError('Cannot verify now. Local API is not reachable.');
                return;
            }

            const data = await res.json();
            if (res.ok && data.success) {
                const account = data.user?.email || data.user?.id || 'Account verified';
                setVerifiedAccount(account);
                setMessage('Connection verified successfully.');
            } else {
                setError(data.error || 'Verification failed. Please check your credentials.');
            }
        } catch (e) {
            console.error(e);
            setError('Unexpected error during verification.');
        } finally {
            setVerifying(false);
        }
    };

    if (loading) {
        return (
            <section className="desktop-onboarding-screen">
                <div className="desktop-onboarding-loading">
                    <div className="desktop-onboarding-spinner" />
                    <p>Preparing setup workspace...</p>
                </div>
            </section>
        );
    }

    if (stage === 'intro') {
        return (
            <section className="desktop-onboarding-screen">
                <div className="desktop-onboarding-intro">
                    <article className="onboarding-intro-main">
                        <p className="onboarding-intro-badge">Desktop Onboarding</p>
                        <h1>Welcome to QBZ Downloader Desktop</h1>
                        <p className="onboarding-intro-copy">
                            Complete a quick setup so your app can download in Hi-Res, keep metadata
                            clean, and store everything locally.
                        </p>
                        <div className="onboarding-intro-actions">
                            <button
                                type="button"
                                className="btn primary"
                                onClick={() => setStage('setup')}
                            >
                                Continue Setup
                            </button>
                            <a
                                className="desktop-onboarding-github hero"
                                href="https://github.com/ifauzeee/QBZ-Downloader"
                                target="_blank"
                                rel="noreferrer noopener"
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.02c-3.22.7-3.9-1.56-3.9-1.56-.52-1.35-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.56-2.57-.3-5.28-1.3-5.28-5.76 0-1.27.45-2.3 1.2-3.1-.12-.3-.52-1.5.12-3.1 0 0 .98-.32 3.2 1.18a11.1 11.1 0 0 1 5.84 0c2.2-1.5 3.19-1.18 3.19-1.18.64 1.6.24 2.8.12 3.1.74.8 1.2 1.83 1.2 3.1 0 4.47-2.72 5.46-5.31 5.75.41.36.79 1.07.79 2.17v3.22c0 .31.2.67.8.56A11.5 11.5 0 0 0 12 .5z" />
                                </svg>
                                <span>github.com/ifauzeee/QBZ-Downloader</span>
                            </a>
                        </div>
                    </article>

                    <aside className="onboarding-intro-side">
                        <p className="desktop-onboarding-project-title">What You Will Configure</p>
                        <ul className="onboarding-feature-list">
                            <li className="onboarding-feature-item">Qobuz App ID & App Secret</li>
                            <li className="onboarding-feature-item">User Auth Token & User ID</li>
                            <li className="onboarding-feature-item">Download destination path</li>
                            <li className="onboarding-feature-item">Connection validation before start</li>
                        </ul>
                    </aside>
                </div>
            </section>
        );
    }

    return (
        <section className="desktop-onboarding-screen">
            <div className="desktop-onboarding-shell">
                <aside className="desktop-onboarding-panel">
                    <p className="desktop-onboarding-eyebrow">Step 2 of 2 - Credential Setup</p>
                    <h1>Connect Qobuz and choose your download destination.</h1>
                    <p className="desktop-onboarding-copy">
                        This setup runs only once for each local app data directory. You can always
                        update values later from Settings.
                    </p>

                    <div className="desktop-onboarding-progress">
                        <div className="desktop-onboarding-progress-label">
                            <span>Setup Progress</span>
                            <strong>{completion}%</strong>
                        </div>
                        <div className="desktop-onboarding-progress-track">
                            <span style={{ width: `${completion}%` }} />
                        </div>
                    </div>

                    <ul className="desktop-onboarding-steps">
                        {checklist.map((item) => (
                            <li key={item.id} className={item.completed ? 'done' : 'todo'}>
                                <span className="state-dot" />
                                <span>{STEP_LABELS[item.id]}</span>
                            </li>
                        ))}
                    </ul>
                </aside>

                <div className="desktop-onboarding-form-wrap">
                    <div className="desktop-onboarding-form">
                        <div className="onboarding-form-header">
                            <h2 className="onboarding-form-title">Qobuz Account Setup</h2>
                            <p className="onboarding-form-copy">
                                Paste your credentials below, set where downloads are stored, then
                                continue to dashboard.
                            </p>
                        </div>

                        <div className="onboarding-form-group">
                            <label>Qobuz App ID</label>
                            <input
                                type="text"
                                value={form.appId}
                                placeholder={
                                    remoteCompletion.app_id
                                        ? 'Already configured (optional to update)'
                                        : 'Required'
                                }
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, appId: e.target.value }))
                                }
                            />
                        </div>

                        <div className="onboarding-form-group">
                            <label>Qobuz App Secret</label>
                            <div className="onboarding-input-with-action">
                                <input
                                    type={showSecret ? 'text' : 'password'}
                                    value={form.appSecret}
                                    placeholder={
                                        remoteCompletion.app_secret
                                            ? 'Already configured (optional to update)'
                                            : 'Required'
                                    }
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, appSecret: e.target.value }))
                                    }
                                />
                                <button
                                    type="button"
                                    className="toggle-input-btn"
                                    onClick={() => setShowSecret((value) => !value)}
                                >
                                    {showSecret ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        <div className="onboarding-form-group">
                            <label>User Auth Token</label>
                            <div className="onboarding-input-with-action">
                                <input
                                    type={showToken ? 'text' : 'password'}
                                    value={form.token}
                                    placeholder={
                                        remoteCompletion.token
                                            ? 'Already configured (optional to update)'
                                            : 'Required'
                                    }
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, token: e.target.value }))
                                    }
                                />
                                <button
                                    type="button"
                                    className="toggle-input-btn"
                                    onClick={() => setShowToken((value) => !value)}
                                >
                                    {showToken ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        <div className="onboarding-form-group">
                            <label>Qobuz User ID</label>
                            <input
                                type="text"
                                value={form.userId}
                                placeholder={
                                    remoteCompletion.user_id
                                        ? 'Already configured (optional to update)'
                                        : 'Required'
                                }
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, userId: e.target.value }))
                                }
                            />
                        </div>

                        <div className="onboarding-form-group">
                            <label>Download Path</label>
                            <input
                                type="text"
                                value={form.downloadsPath}
                                placeholder="Example: D:\\Music\\Qobuz"
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, downloadsPath: e.target.value }))
                                }
                            />
                            <p className="onboarding-form-note">
                                Use full path if you want to save downloads outside app folder.
                            </p>
                        </div>

                        {error && <p className="onboarding-error">{error}</p>}
                        {message && <p className="onboarding-success">{message}</p>}
                        {verifiedAccount && (
                            <p className="onboarding-verified">Verified account: {verifiedAccount}</p>
                        )}

                        <div className="onboarding-actions">
                            <button
                                type="button"
                                className="btn secondary"
                                onClick={() => setStage('intro')}
                                disabled={saving || verifying}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                className="btn secondary"
                                onClick={handleVerify}
                                disabled={saving || verifying}
                            >
                                {verifying ? 'Verifying...' : 'Verify Connection'}
                            </button>
                            <button
                                type="button"
                                className="btn primary"
                                onClick={handleSaveAndContinue}
                                disabled={saving || verifying}
                            >
                                {saving ? 'Saving...' : 'Save & Continue to Dashboard'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
