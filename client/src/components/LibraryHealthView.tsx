import React, { useEffect, useState } from 'react';
import { smartFetch } from '../utils/api';
import { Icons } from './Icons';
import { motion } from 'framer-motion';

interface HealthData {
    totalTracks: number;
    missingCovers: number;
    lowQuality: number;
    hiRes: number;
    duplicates: number;
    missingTags: number;
    healthScore: number;
    avgQuality: number;
    commonFormat: string;
}

export const LibraryHealthView: React.FC = () => {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadHealth();
    }, []);

    const loadHealth = async () => {
        setLoading(true);
        try {
            const res = await smartFetch('/api/library/health');
            if (res && res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="view-section active">
            <div className="skeleton-loading" style={{ padding: '20px' }}>
                <div className="skeleton skeleton-text" style={{ width: '200px', height: '30px', marginBottom: '30px' }}></div>
                <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                     {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '150px', borderRadius: '16px' }}></div>)}
                </div>
            </div>
        </div>
    );

    if (!data) return <div className="empty-state">Failed to load health data</div>;

    const getScoreColor = (score: number) => {
        if (score >= 90) return '#10b981'; // Green
        if (score >= 70) return '#f59e0b'; // Orange
        return '#ef4444'; // Red
    };

    return (
        <div className="view-section active library-health-view" style={{ padding: '20px', overflowY: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: '30px' }}>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Icons.Security width={28} height={28} color={getScoreColor(data.healthScore)} />
                        Library Health Dashboard
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Deep analysis of your local music collection</p>
                </div>
                <button className="btn secondary" onClick={loadHealth}>
                    <Icons.Playlist width={16} height={16} /> Refresh Scan
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {/* Health Score Card */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="health-score-card"
                    style={{ 
                        background: 'var(--bg-card)', 
                        borderRadius: '24px', 
                        padding: '30px', 
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    <div style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '4px', 
                        background: getScoreColor(data.healthScore) 
                    }} />
                    
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>Overall Health Score</span>
                    <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                        <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                            <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke="rgba(255,255,255,0.05)"
                                strokeWidth="3"
                            />
                            <path
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                fill="none"
                                stroke={getScoreColor(data.healthScore)}
                                strokeWidth="3"
                                strokeDasharray={`${data.healthScore}, 100`}
                            />
                        </svg>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 800 }}>
                            {data.healthScore}%
                        </div>
                    </div>
                    <p style={{ marginTop: '20px', color: data.healthScore > 80 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {data.healthScore > 90 ? 'Your library is in excellent shape!' : 
                         data.healthScore > 70 ? 'Your library needs some minor cleanup.' : 
                         'Critical issues detected in your library metadata.'}
                    </p>
                </motion.div>

                {/* Quality Distribution */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '24px', border: '1px solid var(--border)' }}
                >
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Audio Quality Profile</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="health-stat-row">
                            <div className="flex-between">
                                <span>Hi-Res Audio (24-bit+)</span>
                                <span style={{ fontWeight: 700, color: '#f4c430' }}>{data.hiRes} tracks</span>
                            </div>
                            <div className="progress-mini"><div style={{ width: `${(data.hiRes/data.totalTracks)*100}%`, background: '#f4c430' }} /></div>
                        </div>
                        <div className="health-stat-row">
                            <div className="flex-between">
                                <span>CD Quality (16-bit)</span>
                                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{data.totalTracks - data.hiRes - data.lowQuality} tracks</span>
                            </div>
                            <div className="progress-mini"><div style={{ width: `${((data.totalTracks - data.hiRes - data.lowQuality)/data.totalTracks)*100}%`, background: 'var(--accent)' }} /></div>
                        </div>
                        <div className="health-stat-row">
                            <div className="flex-between">
                                <span>Low Quality (MP3/Lossy)</span>
                                <span style={{ fontWeight: 700, color: '#ef4444' }}>{data.lowQuality} tracks</span>
                            </div>
                            <div className="progress-mini"><div style={{ width: `${(data.lowQuality/data.totalTracks)*100}%`, background: '#ef4444' }} /></div>
                        </div>
                    </div>
                    <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Dominant Format: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.commonFormat.toUpperCase()}</span>
                    </div>
                </motion.div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="health-issue-box" style={{ background: data.missingTags > 0 ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
                    <Icons.Tag width={20} height={20} color={data.missingTags > 0 ? '#ef4444' : '#10b981'} />
                    <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0' }}>{data.missingTags}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Missing Metadata</div>
                </div>
                <div className="health-issue-box" style={{ background: data.missingCovers > 0 ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
                    <Icons.Image width={20} height={20} color={data.missingCovers > 0 ? '#f59e0b' : '#10b981'} />
                    <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0' }}>{data.missingCovers}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Missing Artwork</div>
                </div>
                <div className="health-issue-box" style={{ background: data.duplicates > 0 ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
                    <Icons.Copy width={20} height={20} color={data.duplicates > 0 ? '#ef4444' : '#10b981'} />
                    <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0' }}>{data.duplicates}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Duplicate Files</div>
                </div>
            </div>

            <div className="action-banner" style={{ marginTop: '40px', background: 'linear-gradient(90deg, var(--accent) 0%, #6366f1 100%)', borderRadius: '24px', padding: '30px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Optimize Your Library</h3>
                    <p style={{ opacity: 0.9 }}>Run the automated repair tool to fix missing metadata and upgrade low-quality tracks.</p>
                </div>
                <button className="btn" style={{ background: 'white', color: 'black', padding: '12px 24px', borderRadius: '12px', fontWeight: 600 }}>Start Auto-Heal</button>
            </div>

            <style>{`
                .library-health-view .flex-between { display: flex; align-items: center; justify-content: space-between; }
                .library-health-view .progress-mini { height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; margin-top: 8px; }
                .library-health-view .progress-mini div { height: 100%; border-radius: 3px; }
                .library-health-view .health-issue-box svg { margin-bottom: 8px; }
            `}</style>
        </div>
    );
};
