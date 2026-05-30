import React from 'react';
import { useTranslation } from 'react-i18next';
import { HeroAnalysis } from '../../../services/combatData';
import { HeroMiniPortrait } from '../../HeroMiniPortrait';

interface DashboardSynergyBansProps {
    localCombatAnalysis: HeroAnalysis | null;
    fpPartners: any[];
    spPartners: any[];
}

export const DashboardSynergyBans: React.FC<DashboardSynergyBansProps> = React.memo(({
    localCombatAnalysis,
    fpPartners,
    spPartners
}) => {
    const { t } = useTranslation();
    return (
        <>
            {/* Best Pairs & Synergies */}
            <div className="dashboard-card strategy-card">
                <h4 className="strategy-card-title">{t("combat.bestSynergyPartners")}</h4>
                <div className="synergy-grid-unified">
                    <div className="synergy-col-mini">
                        <span className="synergy-heading">{t("combat.fpTopPartners")}</span>
                        {fpPartners.length > 0 ? (
                            <div className="synergy-mini-list">
                                {fpPartners.map((p, idx) => (
                                    <div key={idx} className="synergy-pair-row">
                                        <HeroMiniPortrait heroCode={p.hero} size={24} className="synergy-avatar" />
                                        <div className="synergy-info-block">
                                            <span className="synergy-partner-name">{p.hero_name}</span>
                                            <span className="synergy-partner-details">{p.count} g ({p.win_rate.toFixed(0)}% {t("combat.wr")})</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="strategy-empty-state mini">{t("combat.noFpPartners")}</div>
                        )}
                    </div>

                    <div className="synergy-col-mini">
                        <span className="synergy-heading">{t("combat.spTopPartners")}</span>
                        {spPartners.length > 0 ? (
                            <div className="synergy-mini-list">
                                {spPartners.map((p, idx) => (
                                    <div key={idx} className="synergy-pair-row">
                                        <HeroMiniPortrait heroCode={p.hero} size={24} className="synergy-avatar" />
                                        <div className="synergy-info-block">
                                            <span className="synergy-partner-name">{p.hero_name}</span>
                                            <span className="synergy-partner-details">{p.count} g ({p.win_rate.toFixed(0)}% {t("combat.wr")})</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="strategy-empty-state mini">{t("combat.noSpPartners")}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Banning Analytics */}
            <div className="dashboard-card strategy-card">
                <h4 className="strategy-card-title">{t("combat.banningPrebanPatterns")}</h4>
                <div className="bans-grid-unified">
                    <div className="ban-col-mini">
                        <span className="ban-sub-heading">{t("combat.selfPrebans")}</span>
                        {localCombatAnalysis && localCombatAnalysis.my_prebans.length > 0 ? (
                            localCombatAnalysis.my_prebans.slice(0, 3).map((b: any, idx: number) => (
                                <div key={idx} className="ban-stat-line">
                                    <HeroMiniPortrait heroName={b.hero_name || b.hero} size={14} className="ban-hero-mini-portrait" style={{ marginRight: '6px' }} />
                                    <span className="ban-hero-name truncate">{b.hero_name || b.hero}</span>
                                    <span className="ban-count">{t("combat.picksLabel", { count: b.count })}</span>
                                </div>
                            ))
                        ) : (
                            <div className="strategy-empty-state mini">{t("combat.noData")}</div>
                        )}
                    </div>

                    <div className="ban-col-mini">
                        <span className="ban-sub-heading">{t("combat.enemyPrebans")}</span>
                        {localCombatAnalysis && localCombatAnalysis.enemy_prebans.length > 0 ? (
                            localCombatAnalysis.enemy_prebans.slice(0, 3).map((b: any, idx: number) => (
                                <div key={idx} className="ban-stat-line">
                                    <HeroMiniPortrait heroName={b.hero_name || b.hero} size={14} className="ban-hero-mini-portrait" style={{ marginRight: '6px' }} />
                                    <span className="ban-hero-name truncate">{b.hero_name || b.hero}</span>
                                    <span className="ban-count">{t("combat.bansLabel", { count: b.count })}</span>
                                </div>
                            ))
                        ) : (
                            <div className="strategy-empty-state mini">{t("combat.noData")}</div>
                        )}
                    </div>

                    <div className="ban-col-mini">
                        <span className="ban-sub-heading">{t("combat.targetBans")}</span>
                        {localCombatAnalysis && localCombatAnalysis.pilot_bans.length > 0 ? (
                            localCombatAnalysis.pilot_bans.slice(0, 3).map((b: any, idx: number) => (
                                <div key={idx} className="ban-stat-line">
                                    <HeroMiniPortrait heroName={b.hero_name || b.hero} size={14} className="ban-hero-mini-portrait" style={{ marginRight: '6px' }} />
                                    <span className="ban-hero-name truncate">{b.hero_name || b.hero}</span>
                                    <span className="ban-count">{b.ban_rate}% BR</span>
                                </div>
                            ))
                        ) : (
                            <div className="strategy-empty-state mini">{t("combat.noData")}</div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
});
