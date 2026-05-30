import React from 'react';
import { HeroAnalysis, MetagameHero } from '../../../services/combatData';

interface DashboardIdentityCardProps {
    heroName: string;
    isPortraitLoading: boolean;
    portraitUrl: string | null;
    tags: Array<{ name: string; vibe: string; desc: string; color: string; bg: string }>;
    isSpecialistCapped: boolean;
    // Pre-computed metrics
    winRate: number;
    pickRate: number;
    banRate: number;
    prebanRate: number;
    picks: number;
    pilots: number;
    powerScore: number;
    tier: string;
    tierColor: string;
}

export const DashboardIdentityCard: React.FC<DashboardIdentityCardProps> = React.memo(({
    heroName,
    isPortraitLoading,
    portraitUrl,
    tags,
    isSpecialistCapped,
    winRate,
    pickRate,
    banRate,
    prebanRate,
    picks,
    pilots,
    powerScore,
    tier,
    tierColor
}) => {
    return (
        <div className="dashboard-card identity-card-col">
            <div className="portrait-avatar-wrapper">
                <div className="neon-portrait-container">
                    {isPortraitLoading ? (
                        <div className="portrait-spinner-placeholder">
                            <div className="progress-spinner mini"></div>
                        </div>
                    ) : portraitUrl ? (
                        <img
                            src={portraitUrl}
                            alt={heroName}
                            className="hero-large-portrait"
                        />
                    ) : (
                        <div className="portrait-avatar-placeholder">
                            {heroName.substring(0, 2).toUpperCase()}
                        </div>
                    )}
                </div>
                <h2 className="hero-active-name-under-portrait">{heroName}</h2>

                <div className="hero-meta-tier-container">
                    <div className="meta-tier-badge" style={{
                        borderColor: tierColor,
                        color: tierColor,
                        boxShadow: `0 0 10px ${tierColor}40`,
                        background: `${tierColor}0d`
                    }}>
                        <span className="tier-lbl">META TIER</span>
                        <span className="tier-val">{tier}</span>
                    </div>
                    {isSpecialistCapped && (
                        <span
                            id="specialist-warning-trigger"
                            className="specialist-cap-warning"
                        >
                            ⚠️ Specialist Bias
                        </span>
                    )}
                    <span className="power-score-text">
                        Power Score: <strong>{powerScore.toFixed(1)}</strong>
                    </span>

                    {/* Draft Impact Tags */}
                    <div className="hero-draft-tags-container">
                        {tags.map((tag) => (
                            <div
                                key={tag.name}
                                id={`tag-trigger-${tag.name.replace(/\s+/g, '-')}`}
                                className="draft-impact-tag-badge"
                                style={{
                                    borderColor: `${tag.color}35`,
                                    color: tag.color,
                                    background: tag.bg,
                                    boxShadow: `0 2px 8px ${tag.color}10`,
                                    ['--hover-shadow' as any]: `${tag.color}40`
                                }}
                            >
                                <span className="tag-vibe-pill" style={{ background: `${tag.color}20` }}>{tag.vibe}</span>
                                <span className="tag-name-lbl">{tag.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="hero-primary-combat-stats">
                <div className="unified-winrate-card">
                    <div className="winrate-gauge-section">
                        <svg className="wr-gauge" viewBox="0 0 36 36">
                            <path className="gauge-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            <path
                                className="gauge-indicator"
                                strokeDasharray={`${winRate.toFixed(1)}, 100`}
                                stroke={winRate >= 54 ? '#10b981' : '#00e5ff'}
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                        <div className="gauge-text">
                            <span className="wr-pct">{winRate.toFixed(1)}%</span>
                            <span className="wr-label">Win Rate</span>
                        </div>
                    </div>

                    <div className="unified-quick-metrics">
                        <div className="metric-row">
                            <span>Picks:</span>
                            <strong>{picks.toLocaleString()} matches</strong>
                        </div>
                        <div className="metric-row">
                            <span>Pick Rate:</span>
                            <strong style={{ color: '#00e5ff' }}>{pickRate.toFixed(1)}%</strong>
                        </div>
                        <div className="metric-row">
                            <span>Active pilots:</span>
                            <strong style={{ color: '#38bdf8' }}>{pilots.toLocaleString()} pilots</strong>
                        </div>
                        <div className="metric-row">
                            <span>Ban Rate:</span>
                            <strong style={{ color: '#f43f5e' }}>{banRate.toFixed(1)}%</strong>
                        </div>
                        <div className="metric-row">
                            <span>Preban Rate:</span>
                            <strong style={{ color: '#ffae00' }}>{prebanRate.toFixed(1)}%</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
