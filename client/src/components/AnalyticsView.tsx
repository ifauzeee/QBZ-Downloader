import React, { useEffect, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
    Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { smartFetch } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './Icons';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Filler,
    Legend
);

interface AnalyticsData {
    summary: {
        totalTracks: number;
        totalDuration: string;
        totalArtists: number;
        totalSize: string;
        downloadsToday: number;
        downloadsThisWeek: number;
        downloadsThisMonth: number;
        averageDaily?: number;
    };
    insights: string[];
    qualityDistribution: { label: string; quality: number; percentage: number }[];
    genreBreakdown: { genre: string; count: number; percentage: number }[];
    topArtists: { name: string; trackCount: number; imageUrl?: string }[];
    trends: { daily: { period: string; downloads: number }[] };
}

export const AnalyticsView: React.FC = () => {
    const { t } = useLanguage();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await smartFetch('/api/analytics/dashboard');
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

    if (loading && !data) return (
        <div id="view-statistics" className="view-section active">
            <div className="analytics-header">
                <div className="skeleton skeleton-text" style={{ width: '200px', height: '24px' }}></div>
            </div>

            <div className="analytics-summary-grid">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="stat-card large" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                        <div className="skeleton skeleton-circle" style={{ width: '32px', height: '32px', marginBottom: '12px' }}></div>
                        <div className="skeleton skeleton-text short"></div>
                        <div className="skeleton skeleton-text" style={{ height: '32px', width: '60%' }}></div>
                    </div>
                ))}
            </div>

            <div className="quick-stats-row">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="quick-stat-item">
                        <div className="skeleton skeleton-text short"></div>
                        <div className="skeleton skeleton-text" style={{ height: '28px', width: '40%' }}></div>
                    </div>
                ))}
            </div>

            <div className="analytics-charts-grid">
                <div className="chart-card full-width">
                    <div className="skeleton skeleton-text medium" style={{ marginBottom: '20px' }}></div>
                    <div className="skeleton" style={{ height: '300px', width: '100%' }}></div>
                </div>
            </div>
        </div>
    );
    if (!data) return <div id="view-statistics" className="view-section active"><div className="empty-state"><p>{t('msg_no_results')}</p></div></div>;

    const last30Days = Array.from({ length: 30 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (29 - i));
        return d.toISOString().split('T')[0];
    });

    const trendsMap = new Map(data.trends?.daily?.map((t: any) => [t.period, t.downloads]) || []);

    const chartLabels = last30Days.map(date => {
        const parts = date.split('-');
        return `${parts[1]}/${parts[2]}`;
    });

    const chartValues = last30Days.map(date => trendsMap.get(date) || 0);

    const chartData = {
        labels: chartLabels,
        datasets: [
            {
                label: 'Downloads',
                data: chartValues,
                fill: true,
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: '#6366f1',
                tension: 0.3,
                pointBackgroundColor: '#6366f1',
                borderWidth: 2,
                pointRadius: chartValues.length > 20 ? 2 : 4,
                pointHoverRadius: 6
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: { precision: 0 }
            },
            x: {
                grid: { display: false }
            }
        }
    };

    return (
        <div id="view-statistics" className="view-section active">
            <div className="analytics-header">
                <h3>📊 {t('title_analytics')}</h3>
                <button className="btn secondary" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icons.Playlist width={14} height={14} /> Refresh
                </button>
            </div>

            <div className="analytics-summary-grid">
                <div className="stat-card large gradient-purple">
                    <div className="stat-icon">🎵</div>
                    <div className="stat-details">
                        <h3>Total Tracks</h3>
                        <div className="number">{data.summary.totalTracks}</div>
                    </div>
                </div>
                <div className="stat-card large gradient-blue">
                    <div className="stat-icon">⏱️</div>
                    <div className="stat-details">
                        <h3>Total Duration</h3>
                        <div className="number">{data.summary.totalDuration}</div>
                    </div>
                </div>
                <div className="stat-card large gradient-green">
                    <div className="stat-icon">🎤</div>
                    <div className="stat-details">
                        <h3>Unique Artists</h3>
                        <div className="number">{data.summary.totalArtists}</div>
                    </div>
                </div>
                <div className="stat-card large gradient-orange">
                    <div className="stat-icon">💾</div>
                    <div className="stat-details">
                        <h3>{t('label_total_size')}</h3>
                        <div className="number">{data.summary.totalSize}</div>
                    </div>
                </div>
            </div>

            <div className="quick-stats-row">
                <div className="quick-stat-item">
                    <span className="quick-stat-label">Today</span>
                    <span className="quick-stat-value">{data.summary.downloadsToday}</span>
                </div>
                <div className="quick-stat-item">
                    <span className="quick-stat-label">This Week</span>
                    <span className="quick-stat-value">{data.summary.downloadsThisWeek}</span>
                </div>
                <div className="quick-stat-item">
                    <span className="quick-stat-label">This Month</span>
                    <span className="quick-stat-value">{data.summary.downloadsThisMonth}</span>
                </div>
                <div className="quick-stat-item">
                    <span className="quick-stat-label">{t('label_daily_avg')}</span>
                    <span className="quick-stat-value">{data.summary.averageDaily || Math.round(data.summary.downloadsThisMonth / 30 * 10) / 10 || 0}</span>
                </div>
            </div>

            <div className="analytics-section">
                <h3>🌟 Top Artists</h3>
                <div className="artist-list-container">
                    {data.topArtists?.slice(0, 5).map((a, i) => (
                        <div key={i} className="artist-list-row" style={{ padding: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.9em', width: '20px' }}>#{i + 1}</span>
                                {a.imageUrl ? (
                                    <img
                                        src={a.imageUrl}
                                        alt={a.name}
                                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            ((e.target as HTMLImageElement).nextSibling as HTMLElement).style.display = 'flex';
                                        }}
                                    />
                                ) : (
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                                        {a.name.charAt(0)}
                                    </div>
                                )}
                                <span style={{ fontWeight: 500 }}>{a.name}</span>
                            </div>
                            <div className="artist-count-badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8em' }}>{a.trackCount} tracks</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="analytics-charts-grid">
                <div className="chart-card full-width">
                    <h3>📈 Download Trends (Last 30 Days)</h3>
                    <div className="chart-container" style={{ height: '300px' }}>
                        <Line options={chartOptions} data={chartData} />
                    </div>
                </div>
                <div className="chart-card">
                    <h3>🎧 Quality Distribution</h3>
                    <div className="quality-bars">
                        {data.qualityDistribution?.map((q, i) => (
                            <div key={i} className="quality-bar-item">
                                <div className="quality-bar-label">{q.label}</div>
                                <div className="quality-bar-track">
                                    <div className={`quality-bar-fill q${q.quality}`} style={{ width: `${q.percentage}%` }}>{q.percentage}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="chart-card">
                    <h3>🎸 Genre Breakdown</h3>
                    <div className="genre-list">
                        {data.genreBreakdown?.slice(0, 5).map((g, i) => (
                            <div key={i} className="genre-item">
                                <span className="genre-name">{g.genre}</span>
                                <span className="genre-count">{g.count} tracks ({g.percentage}%)</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="insights-section">
                <h4>💡 Insights & Recommendations</h4>
                <div className="insights-list">
                    {data.insights && data.insights.length > 0 ? (
                        data.insights.map((insight, i) => <div key={i} className="insight-item">{insight}</div>)
                    ) : (
                        <div className="insight-item">No insights available yet.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
