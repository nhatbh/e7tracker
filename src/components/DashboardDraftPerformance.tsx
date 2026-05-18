import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HeroAnalysis, MetagameHero } from '../services/combatData';
import { HeroMiniPortrait } from './HeroMiniPortrait';

interface DashboardDraftPerformanceProps {
    localCombatAnalysis: HeroAnalysis | null;
    localMetagameHero?: MetagameHero | null;
    heroName: string;
}

export const DashboardDraftPerformance: React.FC<DashboardDraftPerformanceProps> = React.memo(({
    localCombatAnalysis,
    localMetagameHero,
    heroName
}) => {
    const { t } = useTranslation();
    // Process Draft Slot Metrics
    const slotMetrics = useMemo(() => {
        if (!localCombatAnalysis || !localCombatAnalysis.draft_position) return [];
        const total = localCombatAnalysis.total_appearances || 1;
        
        // Ensure slots 1 to 5 are processed
        return ["1", "2", "3", "4", "5"].map(pos => {
            const data = localCombatAnalysis.draft_position[pos] || { count: 0, win_rate: 0 };
            return {
                pos,
                pickShare: Math.round((data.count / total) * 100),
                winRate: Math.round(data.win_rate)
            };
        });
    }, [localCombatAnalysis]);

    // Aggregate and Process Best Synergies (Duos)
    const synergies = useMemo(() => {
        if (!localCombatAnalysis) return [];
        
        const map = new Map<string, { heroName: string; count: number; wins: number }>();
        
        const addPairs = (pairs: any[]) => {
            if (!pairs) return;
            pairs.forEach(pair => {
                const name = pair.hero_name || pair.hero;
                if (!name || name.toLowerCase() === heroName.toLowerCase()) return;
                
                const games = pair.count || 0;
                const wr = pair.win_rate || 0;
                const wins = Math.round(games * (wr / 100));
                
                if (map.has(name)) {
                    const existing = map.get(name)!;
                    existing.count += games;
                    existing.wins += wins;
                } else {
                    map.set(name, { heroName: name, count: games, wins });
                }
            });
        };
        
        addPairs(localCombatAnalysis.best_pairs_fp);
        addPairs(localCombatAnalysis.best_pairs_sp);
        
        const soloWinRate = localMetagameHero?.win_rate !== undefined 
            ? localMetagameHero.win_rate 
            : (localCombatAnalysis.win_rate || 0);

        const totalAppearances = localMetagameHero?.played !== undefined 
            ? localMetagameHero.played 
            : (localCombatAnalysis.total_appearances || 1);
        
        return Array.from(map.values())
            .map(item => {
                const duoWinRate = item.count > 0 ? (item.wins / item.count) * 100 : 0;
                const duoPickRate = (item.count / totalAppearances) * 100;
                const synergyDelta = duoWinRate - soloWinRate;
                const synergyScore = (synergyDelta * 10) + duoPickRate;
                
                return {
                    heroName: item.heroName,
                    count: item.count,
                    winRate: duoWinRate,
                    synergyDelta,
                    synergyScore
                };
            })
            .filter(item => item.count >= 50)
            .sort((a, b) => b.synergyScore - a.synergyScore)
            .slice(0, 5);
    }, [localCombatAnalysis, localMetagameHero, heroName]);

    return (
        <div className="dashboard-column charts-combat-col">
            {/* Left Sub-Column: Draft Performance & Best Synergies */}
            <div className="combat-col-left-subcol">
                {/* 1. Custom Progress Bars for Draft Slot Performance */}
                <div className="dashboard-card compact-chart-card">
                    <h4 className="chart-heading">{t("combat.draftPerformance")}</h4>
                    <div className="draft-slots-list">
                        {slotMetrics.length > 0 ? (
                            slotMetrics.map(({ pos, pickShare, winRate }) => (
                                <div className="draft-slot-row" key={pos}>
                                    <span className="draft-slot-label">{t("combat.slotNumber", { pos })}</span>
                                    <div className="draft-progress-container">
                                        <div className="draft-progress-track" title={`${pickShare}% ${t("combat.pick")} Share / ${winRate}% ${t("combat.winRate")}`}>
                                            {/* Pick Share bar (blue background track segment) */}
                                            {pickShare > 0 ? (
                                                <div className="draft-pick-bar" style={{ width: `${pickShare}%` }}>
                                                    {/* Win Rate bar (glowing green nested inside) */}
                                                    {winRate > 0 && (
                                                        <div className="draft-win-bar" style={{ width: `${winRate}%` }}></div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="draft-empty-bar"></div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="draft-slot-metrics">
                                        <span className="draft-pick-lbl">{pickShare}% {t("combat.pick")}</span>
                                        <span className="draft-win-lbl" style={{ color: winRate >= 50 ? '#10b981' : '#38bdf8' }}>
                                            {winRate}% {t("combat.wr")}
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="chart-placeholder">{t("combat.noPickPositionStats")}</div>
                        )}
                    </div>
                </div>

                {/* 3. Best Synergies (Duo Trends) */}
                <div className="dashboard-card compact-synergy-card">
                    <h4 className="chart-heading">{t("combat.bestPairs")}</h4>
                    <div className="compact-synergy-list">
                        {synergies.length > 0 ? (
                            synergies.map(({ heroName: name, count, winRate, synergyDelta }, idx) => (
                                <div key={idx} className="compact-synergy-row">
                                    <div className="synergy-hero-info">
                                        <HeroMiniPortrait
                                            heroName={name}
                                            size={24}
                                            className="compact-squad-avatar"
                                        />
                                        <span className="synergy-hero-name">{name}</span>
                                    </div>
                                    <div className="compact-squad-stats">
                                        <span className="compact-squad-delta" style={{
                                            color: synergyDelta >= 0 ? '#10b981' : '#f43f5e',
                                            background: synergyDelta >= 0 ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
                                            border: synergyDelta >= 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(244, 63, 94, 0.2)',
                                            fontSize: '0.66rem',
                                            padding: '1px 5px',
                                            borderRadius: '4px',
                                            fontWeight: 700
                                        }}>
                                            {synergyDelta >= 0 ? `+${synergyDelta.toFixed(1)}%` : `${synergyDelta.toFixed(1)}%`}
                                        </span>
                                        <span className="compact-squad-wr" style={{ color: '#00e5ff', background: 'rgba(0, 229, 255, 0.08)', border: '1px solid rgba(0, 229, 255, 0.2)' }}>{Math.round(winRate)}% {t("combat.wr")}</span>
                                        <span className="compact-squad-games">{count} g</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="partners-empty-state">{t("combat.noDuoTrends")}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Sub-Column: Popular Squad Compositions (Top 5 Comps) */}
            <div className="dashboard-card compact-squad-comps-card">
                <h4 className="chart-heading">{t("combat.squadCompositions")}</h4>
                <div className="compact-squad-list">
                    {localCombatAnalysis && localCombatAnalysis.top_comps && localCombatAnalysis.top_comps.length > 0 ? (
                        localCombatAnalysis.top_comps.slice(0, 9).map((comp: any, idx: number) => (
                            <div key={idx} className="compact-squad-row">
                                <span className="compact-squad-rank">#{idx + 1}</span>
                                <div className="compact-squad-avatars">
                                    {[heroName, ...comp.hero_names].slice(0, 4).map((name: string, mIdx: number) => (
                                        <div key={mIdx} className="compact-avatar-wrapper" title={name}>
                                            <HeroMiniPortrait
                                                heroName={name}
                                                size={24}
                                                className={`compact-squad-avatar ${name.toLowerCase() === heroName.toLowerCase() ? 'active-hero-border' : ''}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <div className="compact-squad-stats">
                                    <span className="compact-squad-wr">{comp.win_rate.toFixed(1)}% {t("combat.wr")}</span>
                                    <span className="compact-squad-games">{comp.count} g</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="partners-empty-state">{t("combat.noSquadRecords")}</div>
                    )}
                </div>
            </div>
        </div>
    );
});
