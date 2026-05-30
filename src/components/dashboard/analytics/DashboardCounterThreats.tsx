import React from 'react';
import { useTranslation } from 'react-i18next';
import { HeroAnalysis } from '../../../services/combatData';
import { HeroMiniPortrait } from '../../HeroMiniPortrait';
import { getLegitMatchups } from '../utils';

interface DashboardCounterThreatsProps {
    localCombatAnalysis: HeroAnalysis | null;
    strongCounters: any[];
    weakCounters: any[];
}

export const DashboardCounterThreats: React.FC<DashboardCounterThreatsProps> = React.memo(({
    localCombatAnalysis,
    strongCounters,
    weakCounters
}) => {
    const { t } = useTranslation();
    return (
        <>
            {/* Opponent Position Counter Threats */}
            <div className="dashboard-card strategy-card">
                <h4 className="strategy-card-title">{t("combat.opponentPositionThreats")}</h4>
                <div className="opponent-position-threats-grid">
                    {localCombatAnalysis && localCombatAnalysis.opp_winning_positions && Object.keys(localCombatAnalysis.opp_winning_positions).length > 0 ? (
                        Object.entries(localCombatAnalysis.opp_winning_positions).slice(0, 3).map(([posKey, threats]: any) => {
                            const legitThreats = getLegitMatchups(threats).slice(0, 2);
                            if (legitThreats.length === 0) return null;
                            return (
                                <div key={posKey} className="threat-slot-card">
                                    <span className="threat-slot-badge">{t("combat.counterSlot", { pos: posKey })}</span>
                                    <div className="threat-slot-item-list">
                                        {legitThreats.map((thr: any, oIdx: number) => (
                                            <div key={oIdx} className="threat-item-mini-row">
                                                <HeroMiniPortrait heroName={thr.hero_name} size={14} className="threat-hero-mini-portrait" style={{ marginRight: '6px' }} />
                                                <span className="threat-item-name truncate">{thr.hero_name}</span>
                                                <span className="threat-item-wr" style={{ color: '#f43f5e' }}>{thr.pct.toFixed(0)}% {t("combat.wr")}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="strategy-empty-state">{t("combat.noPositionalCounters")}</div>
                    )}
                </div>
            </div>

            {/* Core Counters Breakdown (Strong vs Weak) */}
            <div className="dashboard-card strategy-card">
                <h4 className="strategy-card-title">{t("combat.coreCountersBreakdown")}</h4>
                <div className="synergy-grid-unified">
                    <div className="synergy-col-mini">
                        <span className="synergy-heading text-strong">{t("combat.strongAgainst")}</span>
                        {strongCounters.length > 0 ? (
                            <div className="synergy-mini-list">
                                {strongCounters.map((c, idx) => (
                                    <div key={idx} className="counter-row-condensed">
                                        <HeroMiniPortrait heroName={c.hero_name} size={14} className="counter-hero-mini-portrait" style={{ marginRight: '6px' }} />
                                        <span className="counter-name truncate">{c.hero_name}</span>
                                        <span className="counter-wr wr-high">{c.win_rate.toFixed(0)}% {t("combat.wr")}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="strategy-empty-state mini">{t("combat.noData")}</div>
                        )}
                    </div>

                    <div className="synergy-col-mini">
                        <span className="synergy-heading text-weak">{t("combat.weakAgainst")}</span>
                        {weakCounters.length > 0 ? (
                            <div className="synergy-mini-list">
                                {weakCounters.map((c, idx) => (
                                    <div key={idx} className="counter-row-condensed">
                                        <HeroMiniPortrait heroName={c.hero_name} size={14} className="counter-hero-mini-portrait" style={{ marginRight: '6px' }} />
                                        <span className="counter-name truncate">{c.hero_name}</span>
                                        <span className="counter-wr wr-low">{c.win_rate.toFixed(0)}% {t("combat.wr")}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="strategy-empty-state mini">{t("combat.noData")}</div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
});
