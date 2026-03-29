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

interface DesktopSetupGateProps {
    onContinue: () => void;
}

const STEP_LABELS: Record<OnboardingStep['id'], string> = {
    app_id: 'Qobuz App ID',
    app_secret: 'Qobuz App Secret',
    token: 'User Auth Token',
    user_id: 'Qobuz User ID'
};

export function DesktopSetupGate({ onContinue }: DesktopSetupGateProps) {
    const [steps, setSteps] = useState<OnboardingStep[]>([
        { id: 'app_id', completed: false },
        { id: 'app_secret', completed: false },
        { id: 'token', completed: false },
        { id: 'user_id', completed: false }
    ]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [message, setMessage] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [verifiedAccount, setVerifiedAccount] = useState<string>('');
    const [showSecret, setShowSecret] = useState(false);
    const [showToken, setShowToken] = useState(false);

    const [form, setForm] = useState({
        appId: '',
        appSecret: '',
        token: '',
        userId: ''
    });

    const missingStepIds = useMemo(
        () => steps.filter((step) => !step.completed).map((step) => step.id),
        [steps]
    );

    const completion = useMemo(
        () => Math.round((steps.filter((step) => step.completed).length / steps.length) * 100),
        [steps]
    );

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

            setSteps(data.steps || []);
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
        const requiredByStep: Array<{ stepId: OnboardingStep['id']; field: keyof typeof form }> = [
            { stepId: 'app_id', field: 'appId' },
            { stepId: 'app_secret', field: 'appSecret' },
            { stepId: 'token', field: 'token' },
            { stepId: 'user_id', field: 'userId' }
        ];

        const missing: string[] = [];
        for (const item of requiredByStep) {
            if (!missingStepIds.includes(item.stepId)) continue;
            if (!form[item.field].trim()) {
                missing.push(STEP_LABELS[item.stepId]);
            }
        }

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

        if (Object.keys(payload).length === 0) {
            setError('No new credentials to save.');
            return false;
        }

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

            setMessage('Credentials saved locally.');
            await loadStatus();

            if (continueAfterSave) {
                const checkRes = await smartFetch('/api/onboarding');
                if (checkRes && checkRes.ok) {
                    const checkData = (await checkRes.json()) as OnboardingResponse;
                    if (checkData.configured) {
                        onContinue();
                    } else {
                        setError('Credentials are still incomplete. Please review all required fields.');
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

    return (
        <section className="desktop-onboarding-screen">
            <div className="desktop-onboarding-shell">
                <aside className="desktop-onboarding-panel">
                    <p className="desktop-onboarding-eyebrow">Desktop First-Time Setup</p>
                    <h1>Connect your Qobuz credentials to unlock the full dashboard.</h1>
                    <p className="desktop-onboarding-copy">
                        Credentials are stored locally in your app database. Nothing is pushed to
                        this repository.
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
                        {steps.map((step) => (
                            <li key={step.id} className={step.completed ? 'done' : 'todo'}>
                                <span className="state-dot" />
                                <span>{STEP_LABELS[step.id]}</span>
                            </li>
                        ))}
                    </ul>
                </aside>

                <div className="desktop-onboarding-form-wrap">
                    <div className="desktop-onboarding-form">
                        <div className="onboarding-form-group">
                            <label>Qobuz App ID</label>
                            <input
                                type="text"
                                value={form.appId}
                                placeholder={
                                    steps.find((s) => s.id === 'app_id')?.completed
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
                                        steps.find((s) => s.id === 'app_secret')?.completed
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
                                    onClick={() => setShowSecret((v) => !v)}
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
                                        steps.find((s) => s.id === 'token')?.completed
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
                                    onClick={() => setShowToken((v) => !v)}
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
                                    steps.find((s) => s.id === 'user_id')?.completed
                                        ? 'Already configured (optional to update)'
                                        : 'Required'
                                }
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, userId: e.target.value }))
                                }
                            />
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
                                {saving ? 'Saving...' : 'Save & Continue'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
