import React, { useEffect, useState } from 'react';
import { smartFetch } from '../utils/api';
import { Icons } from './Icons';

interface HealthData {
    totalTracks: number;
    missingCovers: number;
    missingLyrics: number;
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
            <div className="skeleton-loading" style={{ padding: '32px' }}>
                <div className="skeleton skeleton-text" style={{ width: '240px', height: '40px', marginBottom: '40px' }}></div>
                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', marginBottom: '32px' }}>
                    <div className="skeleton" style={{ height: '320px', borderRadius: '32px' }}></div>
                    <div className="skeleton" style={{ height: '320px', borderRadius: '32px' }}></div>
                </div>
                <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                     {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '160px', borderRadius: '24px' }}></div>)}
                </div>
            </div>
        </div>
    );

    if (!data) return <div className="empty-state">Failed to load health data</div>;

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'var(--success)';
        if (score >= 70) return 'var(--warning)';
        return 'var(--danger)';
    };

    return (
        <div 
            className="view-section active library-health-view animate-fade-in" 
            style={{ padding: '32px', overflowY: 'auto', height: '100%' }}
        >
            <div className="header-row" style={{ marginBottom: '40px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '16px', 
                            background: 'rgba(var(--accent-rgb), 0.1)', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            border: '1px solid rgba(var(--accent-rgb), 0.2)'
                        }}>
                            <Icons.Security width={28} height={28} color="var(--accent)" />
                        </div>
                        Library Health
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
                        Deep intelligence analysis of your <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{data.totalTracks}</span> local tracks
                    </p>
                </div>
                <button 
                    className="btn secondary hover-scale" 
                    onClick={loadHealth}
                    style={{ height: '44px', padding: '0 24px', borderRadius: '14px', gap: '10px' }}
                >
                    <Icons.Refresh width={16} height={16} /> Refresh Scan
                </button>
            </div>

            <div className="main-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', marginBottom: '32px' }}>
                {/* Health Score Card */}
                <div 
                    className="premium-card health-score-card animate-slide-up"
                    style={{ 
                        background: 'var(--gradient-card)', 
                        backdropFilter: 'blur(24px)',
                        borderRadius: '32px', 
                        padding: '40px', 
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        gap: '40px',
                        alignItems: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    <div className="score-viz" style={{ position: 'relative', flexShrink: 0 }}>
                        <div className="glow-ring" style={{ 
                            position: 'absolute', 
                            inset: '-20px', 
                            background: `radial-gradient(circle, ${getScoreColor(data.healthScore)}15 0%, transparent 70%)`,
                            filter: 'blur(10px)'
                        }} />
                        <div style={{ position: 'relative', width: '180px', height: '180px' }}>
                            <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                                <circle
                                    cx="18" cy="18" r="15.915"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.03)"
                                    strokeWidth="2.5"
                                />
                                <circle
                                    cx="18" cy="18" r="15.915"
                                    fill="none"
                                    stroke={getScoreColor(data.healthScore)}
                                    strokeWidth="2.5"
                                    strokeDasharray={`${data.healthScore}, 100`}
                                    strokeLinecap="round"
                                    className="progress-circle-anim"
                                />
                            </svg>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                <span 
                                    className="animate-scale-in"
                                    style={{ fontSize: '42px', fontWeight: 900, letterSpacing: '-2px', color: 'var(--text-primary)' }}
                                >
                                    {data.healthScore}%
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-secondary)', marginTop: '-4px' }}>Health</span>
                            </div>
                        </div>
                    </div>

                    <div className="score-details">
                        <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
                            {data.healthScore >= 95 ? 'Elite Library Status' : 
                             data.healthScore >= 80 ? 'Optimal Condition' : 
                             data.healthScore >= 60 ? 'Maintenance Required' : 
                             'Critical Recovery Needed'}
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '16px', lineHeight: 1.6, maxWidth: '300px' }}>
                            {data.healthScore >= 90 ? 'Your music collection is perfectly curated with high-quality audio and complete metadata.' : 
                             data.healthScore >= 70 ? 'A few tracks are missing metadata or artwork. Run Auto-Heal to polish your library.' : 
                             'Significant gaps in metadata and audio quality detected. We recommend a full library scan and repair.'}
                        </p>
                        <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>Average Quality</div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent)' }}>{data.avgQuality.toFixed(1)}/27.0</div>
                            </div>
                            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 700 }}>Main Format</div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{data.commonFormat.toUpperCase()}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quality Profile Card */}
                <div 
                    className="premium-card profile-card animate-slide-up"
                    style={{ 
                        background: 'var(--gradient-card)', 
                        backdropFilter: 'blur(24px)',
                        borderRadius: '32px', 
                        padding: '32px', 
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Icons.Waves width={20} height={20} color="var(--accent)" />
                        Audio Quality Profile
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, justifyContent: 'center' }}>
                        <div className="quality-row">
                            <div className="flex-between" style={{ marginBottom: '8px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>Master Quality (Hi-Res)</span>
                                <span style={{ fontWeight: 700, color: '#f59e0b', fontSize: '14px' }}>{data.hiRes} tracks</span>
                            </div>
                            <div className="progress-bar-wrap" style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div 
                                    className="progress-bar-anim"
                                    style={{ width: `${(data.hiRes/data.totalTracks)*100}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', borderRadius: '4px', boxShadow: '0 0 10px rgba(245, 158, 11, 0.3)' }} 
                                />
                            </div>
                        </div>
                        <div className="quality-row">
                            <div className="flex-between" style={{ marginBottom: '8px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>Lossless (CD Quality)</span>
                                <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '14px' }}>{data.totalTracks - data.hiRes - data.lowQuality} tracks</span>
                            </div>
                            <div className="progress-bar-wrap" style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div 
                                    className="progress-bar-anim"
                                    style={{ width: `${((data.totalTracks - data.hiRes - data.lowQuality)/data.totalTracks)*100}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '4px', boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)' }} 
                                />
                            </div>
                        </div>
                        <div className="quality-row">
                            <div className="flex-between" style={{ marginBottom: '8px' }}>
                                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)' }}>Standard (Compressed)</span>
                                <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '14px' }}>{data.lowQuality} tracks</span>
                            </div>
                            <div className="progress-bar-wrap" style={{ height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div 
                                    className="progress-bar-anim"
                                    style={{ width: `${(data.lowQuality/data.totalTracks)*100}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '4px', boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)' }} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="insights-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                <InsightCard 
                    icon={<Icons.Tag width={24} height={24} />} 
                    label="Metadata Integrity" 
                    count={data.missingTags} 
                    subtext="Missing basic tags"
                    color={data.missingTags > 0 ? 'var(--danger)' : 'var(--success)'}
                    delay={0.3}
                />
                <InsightCard 
                    icon={<Icons.Image width={24} height={24} />} 
                    label="Visual Coverage" 
                    count={data.missingCovers} 
                    subtext="Missing album artwork"
                    color={data.missingCovers > 0 ? 'var(--warning)' : 'var(--success)'}
                    delay={0.4}
                />
                <InsightCard
                    icon={<Icons.Mic width={24} height={24} />}
                    label="Lyrics Coverage"
                    count={data.missingLyrics || 0}
                    subtext="Missing embedded lyrics"
                    color={(data.missingLyrics || 0) > 0 ? 'var(--warning)' : 'var(--success)'}
                    delay={0.45}
                />
                <InsightCard 
                    icon={<Icons.Copy width={24} height={24} />} 
                    label="Library Duplication" 
                    count={data.duplicates} 
                    subtext="Duplicate audio files"
                    color={data.duplicates > 0 ? 'var(--danger)' : 'var(--success)'}
                    delay={0.5}
                />
            </div>

            <div 
                className="action-banner-premium animate-slide-up"
                style={{ 
                    position: 'relative',
                    background: 'linear-gradient(135deg, #2dd4bf 0%, #06b6d4 50%, #6366f1 100%)', 
                    borderRadius: '32px', 
                    padding: '48px', 
                    color: 'white', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                    boxShadow: '0 20px 50px rgba(6, 182, 212, 0.3)'
                }}
            >
                <div style={{ 
                    position: 'absolute', 
                    top: '-50%', 
                    right: '-10%', 
                    width: '400px', 
                    height: '400px', 
                    background: 'radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                    pointerEvents: 'none'
                }} />
                
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <h3 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px', letterSpacing: '-0.5px' }}>Auto-Heal Intelligence</h3>
                    <p style={{ opacity: 0.9, fontSize: '17px', maxWidth: '500px', lineHeight: 1.5 }}>
                        Let AI-powered algorithms repair missing metadata, fetch high-quality artwork, and upgrade your audio experience automatically.
                    </p>
                </div>
                
                <button 
                    className="btn hover-scale-bright" 
                    style={{ 
                        background: 'white', 
                        color: '#0f172a', 
                        padding: '16px 36px', 
                        borderRadius: '16px', 
                        fontWeight: 700, 
                        fontSize: '16px',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        position: 'relative',
                        zIndex: 1,
                        cursor: 'pointer'
                    }}
                >
                    <Icons.Settings width={20} height={20} /> Start Auto-Heal
                </button>
            </div>

            <style>{`
                .library-health-view .flex-between { display: flex; align-items: center; justify-content: space-between; }
                .library-health-view::-webkit-scrollbar { width: 6px; }
                .library-health-view::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
                .library-health-view .premium-card { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
                .library-health-view .premium-card:hover { transform: translateY(-4px); border-color: rgba(var(--accent-rgb), 0.4) !important; }
                
                .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
                .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
                .animate-scale-in { animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
                
                .progress-circle-anim {
                    transition: stroke-dasharray 1.5s ease-out 0.2s;
                }
                
                .progress-bar-anim {
                    animation: growWidth 1s ease-out 0.5s forwards;
                    transform-origin: left;
                    width: 0;
                }
                
                .hover-scale { transition: transform 0.2s; }
                .hover-scale:hover { transform: scale(1.05); }
                .hover-scale:active { transform: scale(0.95); }
                
                .hover-scale-bright { transition: all 0.2s; }
                .hover-scale-bright:hover { transform: scale(1.05); box-shadow: 0 0 25px rgba(255,255,255,0.4); }
                .hover-scale-bright:active { transform: scale(0.95); }

                @keyframes growWidth {
                    from { width: 0; }
                    to { width: var(--final-width); }
                }

                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.5); }
                    to { opacity: 1; transform: scale(1); }
                }

                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

interface InsightCardProps {
    icon: React.ReactNode;
    label: string;
    count: number;
    subtext: string;
    color: string;
    delay: number;
}

const InsightCard: React.FC<InsightCardProps> = ({ icon, label, count, subtext, color, delay }) => (
    <div 
        className="insight-card animate-scale-in" 
        style={{ 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid var(--border)', 
            borderRadius: '24px', 
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            transition: 'all 0.3s ease',
            animationDelay: `${delay}s`
        }}
    >
        <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '12px', 
            background: `${color}15`, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: color,
            border: `1px solid ${color}30`
        }}>
            {icon}
        </div>
        <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: '32px', fontWeight: 900, margin: '4px 0', color: 'var(--text-primary)' }}>{count}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', opacity: 0.8 }}>{subtext}</div>
        </div>
        {count > 0 && (
            <div style={{ 
                marginTop: '8px', 
                padding: '8px 12px', 
                borderRadius: '8px', 
                background: `${color}10`, 
                fontSize: '12px', 
                fontWeight: 600, 
                color: color,
                textAlign: 'center'
            }}>
                Requires Attention
            </div>
        )}
    </div>
);
