import React from 'react';
import { HeroAnalysis, MetagameHero } from '../services/combatData';

interface DashboardIdentityCardProps {
    heroName: string;
    localCombatAnalysis: HeroAnalysis | null;
    localMetagameHero?: MetagameHero | null;
    isPortraitLoading: boolean;
    portraitUrl: string | null;
    tags: Array<{ name: string; vibe: string; desc: string; color: string; bg: string }>;
    isSpecialistCapped: boolean;
}

export const DashboardIdentityCard: React.FC<DashboardIdentityCardProps> = React.memo(({
    heroName,
    localCombatAnalysis,
    localMetagameHero,
    isPortraitLoading,
    portraitUrl,
    tags,
    isSpecialistCapped
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
                {(localCombatAnalysis || localMetagameHero) && (() => {
                    const wr = localMetagameHero?.win_rate !== undefined 
                        ? localMetagameHero.win_rate 
                        : (localCombatAnalysis?.win_rate || 0);

                    const pr = localMetagameHero?.pick_rate !== undefined 
                        ? localMetagameHero.pick_rate 
                        : (localCombatAnalysis ? (localCombatAnalysis.total_appearances / (localCombatAnalysis.total_matches || 1)) * 100 : 0);

                    const br = localMetagameHero?.ban_rate !== undefined 
                        ? localMetagameHero.ban_rate 
                        : (localCombatAnalysis 
                            ? ((localCombatAnalysis as any).ban_rate !== undefined 
                                ? (localCombatAnalysis as any).ban_rate 
                                : (localCombatAnalysis as any).ban_count !== undefined 
                                    ? ((localCombatAnalysis as any).ban_count / (localCombatAnalysis.total_matches || 1)) * 100 
                                    : (pr * 0.6))
                            : 0);

                    const pbrTotal = localMetagameHero?.pick_ban_rate !== undefined 
                        ? localMetagameHero.pick_ban_rate 
                        : (pr + br);

                    const score = ((wr - 50) * 10) + pbrTotal + (br * 0.5);
                    
                    let tier = 'C';
                    
                    if (score > 150) {
                        tier = 'OP';
                    } else if (score >= 80) {
                        tier = 'S';
                    } else if (score >= 30) {
                        tier = 'A';
                    } else if (score >= 0) {
                        tier = 'B';
                    } else {
                        tier = 'C';
                    }
                    
                    let tierColor = '#94a3b8';
                    if (tier === 'OP') tierColor = '#ff007f';
                    else if (tier === 'S') tierColor = '#ffae00';
                    else if (tier === 'A') tierColor = '#10b981';
                    else if (tier === 'B') tierColor = '#38bdf8';
                    
                    return (
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
                                Power Score: <strong>{score.toFixed(1)}</strong>
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
                    );
                })()}
            </div>

            <div className="hero-primary-combat-stats">
                {(localCombatAnalysis || localMetagameHero) ? (() => {
                    const wr = localMetagameHero?.win_rate !== undefined 
                        ? localMetagameHero.win_rate 
                        : (localCombatAnalysis?.win_rate || 0);

                    const pr = localMetagameHero?.pick_rate !== undefined 
                        ? localMetagameHero.pick_rate 
                        : (localCombatAnalysis ? (localCombatAnalysis.total_appearances / (localCombatAnalysis.total_matches || 1)) * 100 : 0);

                    const br = localMetagameHero?.ban_rate !== undefined 
                        ? localMetagameHero.ban_rate 
                        : (localCombatAnalysis 
                            ? ((localCombatAnalysis as any).ban_rate !== undefined 
                                ? (localCombatAnalysis as any).ban_rate 
                                : (localCombatAnalysis as any).ban_count !== undefined 
                                    ? ((localCombatAnalysis as any).ban_count / (localCombatAnalysis.total_matches || 1)) * 100 
                                    : (pr * 0.6))
                            : 0);

                    const pbrTotal = localMetagameHero?.pick_ban_rate !== undefined 
                        ? localMetagameHero.pick_ban_rate 
                        : (pr + br);

                    const prebanRate = localMetagameHero?.pick_ban_rate !== undefined 
                        ? (pbrTotal - pr) 
                        : (localCombatAnalysis 
                            ? ((localCombatAnalysis as any).preban_rate !== undefined
                                ? (localCombatAnalysis as any).preban_rate
                                : (localCombatAnalysis as any).preban_count !== undefined
                                    ? ((localCombatAnalysis as any).preban_count / (localCombatAnalysis.total_matches || 1)) * 100
                                    : (br * 0.7))
                            : 0);

                    const picks = localMetagameHero?.played !== undefined 
                        ? localMetagameHero.played 
                        : (localCombatAnalysis?.total_appearances || 0);

                    const pilots = localMetagameHero?.players_using !== undefined
                        ? localMetagameHero.players_using
                        : (localCombatAnalysis?.players || 0);

                    return (
                        <div className="unified-winrate-card">
                            <div className="winrate-gauge-section">
                                <svg className="wr-gauge" viewBox="0 0 36 36">
                                    <path className="gauge-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                    <path
                                        className="gauge-indicator"
                                        strokeDasharray={`${wr.toFixed(1)}, 100`}
                                        stroke={wr >= 54 ? '#10b981' : '#00e5ff'}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <div className="gauge-text">
                                    <span className="wr-pct">{wr.toFixed(1)}%</span>
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
                                    <strong style={{ color: '#00e5ff' }}>{pr.toFixed(1)}%</strong>
                                </div>
                                <div className="metric-row">
                                    <span>Active pilots:</span>
                                    <strong style={{ color: '#38bdf8' }}>{pilots.toLocaleString()} pilots</strong>
                                </div>
                                <div className="metric-row">
                                    <span>Ban Rate:</span>
                                    <strong style={{ color: '#f43f5e' }}>{br.toFixed(1)}%</strong>
                                </div>
                                <div className="metric-row">
                                    <span>Preban Rate:</span>
                                    <strong style={{ color: '#ffae00' }}>{prebanRate.toFixed(1)}%</strong>
                                </div>
                            </div>
                        </div>
                    );
                })() : (
                    <div className="unified-winrate-card empty">
                        <div className="winrate-gauge-section">
                            <svg className="wr-gauge" viewBox="0 0 36 36">
                                <path className="gauge-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                            </svg>
                            <div className="gauge-text">
                                <span className="wr-pct">-</span>
                                <span className="wr-label">Win Rate</span>
                            </div>
                        </div>
                        <div className="unified-quick-metrics">
                            <div className="metric-row">
                                <span>Picks:</span>
                                <strong>-</strong>
                            </div>
                            <div className="metric-row">
                                <span>Pick Rate:</span>
                                <strong>-</strong>
                            </div>
                            <div className="metric-row">
                                <span>Active pilots:</span>
                                <strong>-</strong>
                            </div>
                            <div className="metric-row">
                                <span>Ban Rate:</span>
                                <strong>-</strong>
                            </div>
                            <div className="metric-row">
                                <span>Preban Rate:</span>
                                <strong>-</strong>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});
