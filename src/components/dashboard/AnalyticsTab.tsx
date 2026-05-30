import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardIdentityCard } from './analytics/DashboardIdentityCard';
import { DashboardDraftPerformance } from '../DashboardDraftPerformance';
import { DashboardStatsComparison } from './analytics/DashboardStatsComparison';
import { DashboardSynergyBans } from './analytics/DashboardSynergyBans';
import { DashboardCounterThreats } from './analytics/DashboardCounterThreats';
import { DashboardGearRating } from './analytics/DashboardGearRating';
import { DashboardLeaderboard } from './analytics/DashboardLeaderboard';
import { DashboardBuildsTable } from './analytics/DashboardBuildsTable';
import { HeroAnalysis } from '../../domain/models/CombatAnalytics';
import { MetagameHero } from '../../domain/models/MetagameData';
import { ProcessedBuildData } from '../../domain/models/BuildProfile';
import { TierListHeroData } from '../../domain/models/TierList';
import { getLegitMatchups } from './utils';
import { calculateTier } from './utils';
import '../HeroDetailsView.css';

// ── SELECTIVE COMPONENT DEBUGS (Set to false to disable and isolate lag) ──
const ENABLE_IDENTITY_CARD = true;
const ENABLE_DRAFT_PERFORMANCE = true;
const ENABLE_STATS_COMPARISON = true;
const ENABLE_SYNERGY_BANS = true;
const ENABLE_COUNTER_THREATS = true;
const ENABLE_GEAR_RATING = true;
const ENABLE_LEADERBOARD = false;
const ENABLE_BUILDS_TABLE = true;

// ── Shared Dashboard Constants ──
const STAT_MAX = {
    hp: 25000,
    atk: 5000,
    def: 2500,
    spd: 310,
    chc: 100,
    chd: 350,
    eff: 200,
    efr: 250
};

interface AnalyticsTabProps {
    heroName: string;
    localCombatAnalysis: HeroAnalysis | null;
    localMetagameHero: MetagameHero | null;
    portraitUrl: string | null;
    isPortraitLoading: boolean;
    tags: Array<{ name: string; vibe: string; desc: string; color: string; bg: string }>;
    isSpecialistCapped: boolean;
    localBuildData: ProcessedBuildData | null;
    heroTierInfo: TierListHeroData | null;
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = React.memo(({
    heroName,
    localCombatAnalysis,
    localMetagameHero,
    portraitUrl,
    isPortraitLoading,
    tags,
    isSpecialistCapped,
    localBuildData,
    heroTierInfo
}) => {
    const { t } = useTranslation();

    const radarData = useMemo(() => {
        const avg = localBuildData?.averageStats;
        const pro = localBuildData?.proStats?.averageStats;
        return avg ? [
            { stat: t('chart.statHealth'), Average: (Number(avg.hp || 0) / STAT_MAX.hp) * 100, fullAvg: avg.hp, Pro: pro ? (Number(pro.hp || 0) / STAT_MAX.hp) * 100 : 0, fullPro: pro?.hp },
            { stat: t('chart.statAttack'), Average: (Number(avg.atk || 0) / STAT_MAX.atk) * 100, fullAvg: avg.atk, Pro: pro ? (Number(pro.atk || 0) / STAT_MAX.atk) * 100 : 0, fullPro: pro?.atk },
            { stat: t('chart.statDefense'), Average: (Number(avg.def || 0) / STAT_MAX.def) * 100, fullAvg: avg.def, Pro: pro ? (Number(pro.def || 0) / STAT_MAX.def) * 100 : 0, fullPro: pro?.def },
            { stat: t('chart.statSpeed'), Average: (Number(avg.spd || 0) / STAT_MAX.spd) * 100, fullAvg: avg.spd, Pro: pro ? (Number(pro.spd || 0) / STAT_MAX.spd) * 100 : 0, fullPro: pro?.spd },
            { stat: t('chart.statCritPct'), Average: (Number(avg.chc || 0) / STAT_MAX.chc) * 100, fullAvg: avg.chc, Pro: pro ? (Number(pro.chc || 0) / STAT_MAX.chc) * 100 : 0, fullPro: pro?.chc },
            { stat: t('chart.statCritDmg'), Average: (Number(avg.chd || 0) / STAT_MAX.chd) * 100, fullAvg: avg.chd, Pro: pro ? (Number(pro.chd || 0) / STAT_MAX.chd) * 100 : 0, fullPro: pro?.chd },
            { stat: t('chart.statEffect'), Average: (Number(avg.eff || 0) / STAT_MAX.eff) * 100, fullAvg: avg.eff, Pro: pro ? (Number(pro.eff || 0) / STAT_MAX.eff) * 100 : 0, fullPro: pro?.eff },
            { stat: t('chart.statResist'), Average: (Number(avg.efr || 0) / STAT_MAX.efr) * 100, fullAvg: avg.efr, Pro: pro ? (Number(pro.efr || 0) / STAT_MAX.efr) * 100 : 0, fullPro: pro?.efr }
        ] : [];
    }, [localBuildData, t]);

    const fpPartners = useMemo(() => {
        return localCombatAnalysis ? getLegitMatchups(localCombatAnalysis.best_pairs_fp).slice(0, 3) : [];
    }, [localCombatAnalysis]);

    const spPartners = useMemo(() => {
        return localCombatAnalysis ? getLegitMatchups(localCombatAnalysis.best_pairs_sp).slice(0, 3) : [];
    }, [localCombatAnalysis]);

    const strongCounters = useMemo(() => {
        return localCombatAnalysis ? getLegitMatchups(localCombatAnalysis.counters_strong).slice(0, 3) : [];
    }, [localCombatAnalysis]);

    const weakCounters = useMemo(() => {
        return localCombatAnalysis ? getLegitMatchups(localCombatAnalysis.counters_weak).slice(0, 3) : [];
    }, [localCombatAnalysis]);

    const rawBuilds = localBuildData?.rawBuilds || [];

    const gsList = useMemo(() => {
        return rawBuilds.map((b: any) => b.gs || 0).filter((score: number) => score > 0);
    }, [rawBuilds]);

    const binnedChartData = useMemo(() => {
        if (gsList.length === 0) return [];

        const min = Math.min(...gsList);
        const max = Math.max(...gsList);

        // If all values are identical, create a span around them
        let start = Math.floor(min);
        let end = Math.ceil(max);

        if (start === end) {
            start = Math.max(0, start - 15);
            end = end + 15;
        }

        const binCount = 6;
        const rangeSpan = end - start;
        const rawStep = rangeSpan / binCount;
        // Round step to nearest integer for clean labels
        const step = Math.max(1, Math.round(rawStep));

        const bins: { range: string; minVal: number; maxVal: number; count: number }[] = [];

        // Create dynamic bins
        for (let i = 0; i < binCount; i++) {
            const bMin = start + i * step;
            const bMax = i === binCount - 1 ? end : start + (i + 1) * step;

            let label: string;
            if (i === 0) {
                label = `<${Math.round(bMax)}`;
            } else if (i === binCount - 1) {
                label = `≥${Math.round(bMin)}`;
            } else {
                label = `${Math.round(bMin)}-${Math.round(bMax)}`;
            }

            bins.push({
                range: label,
                minVal: bMin,
                maxVal: bMax,
                count: 0
            });
        }

        // Distribute scores into bins
        gsList.forEach((score: number) => {
            for (let i = 0; i < binCount; i++) {
                const bin = bins[i];
                if (i === binCount - 1) {
                    // Last bin includes everything >= minVal
                    if (score >= bin.minVal) {
                        bin.count++;
                        break;
                    }
                } else {
                    // Other bins: minVal <= score < maxVal
                    if (score >= bin.minVal && score < bin.maxVal) {
                        bin.count++;
                        break;
                    }
                }
            }
        });

        return bins.map(b => ({
            range: b.range,
            Builds: b.count
        }));
    }, [gsList]);

    const sortedSets = useMemo(() => {
        return localBuildData?.setStats
            ? [...localBuildData.setStats].sort((a: any, b: any) => b.percent - a.percent)
            : [];
    }, [localBuildData]);

    const mainSet = sortedSets[0];
    const offSet = sortedSets[1];

    const sortedArts = useMemo(() => {
        return localBuildData?.rawBuilds
            ? Object.entries(
                localBuildData.rawBuilds.reduce((acc: Record<string, number>, b: any) => {
                    if (b.artifactCode) {
                        acc[b.artifactCode] = (acc[b.artifactCode] || 0) + 1;
                    }
                    return acc;
                }, {})
            ).sort((a: any, b: any) => b[1] - a[1])
            : [];
    }, [localBuildData]);

    // ── Identity Card Metrics ──
    const identityMetrics = useMemo(() => {
        if (heroTierInfo) {
            return {
                wr: heroTierInfo.winRate,
                pr: heroTierInfo.pickRate,
                br: heroTierInfo.banRate,
                prebanRate: heroTierInfo.prebanRate,
                score: heroTierInfo.score,
                tier: heroTierInfo.tier,
                tierColor: heroTierInfo.tierColor,
                picks: localMetagameHero?.played || localCombatAnalysis?.total_appearances || 0,
                pilots: localMetagameHero?.players_using || localCombatAnalysis?.players || 0
            };
        }

        return {
            wr: 0, pr: 0, br: 0, prebanRate: 0,
            score: 0, tier: 'C' as const, tierColor: '#94a3b8',
            picks: 0, pilots: 0
        };
    }, [heroTierInfo, localMetagameHero, localCombatAnalysis]);

    // ── Draft Slot Metrics ──
    const slotMetrics = useMemo(() => {
        if (!localCombatAnalysis || !localCombatAnalysis.draft_position) return [];
        const total = localCombatAnalysis.total_appearances || 1;

        return ["1", "2", "3", "4", "5"].map(pos => {
            const data = localCombatAnalysis.draft_position[pos] || { count: 0, win_rate: 0 };
            return {
                pos,
                pickShare: Math.round((data.count / total) * 100),
                winRate: Math.round(data.win_rate)
            };
        });
    }, [localCombatAnalysis]);

    // ── Synergies (Best Pairs) ──
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
        <div className="dashboard-scrollable-content">
            {/* ── TIER 1: HIGH PRIORITY VISUAL SHINY SECTION ── */}
            <div className="unified-top-row">
                {/* Column 1: Identity & Win Rate Gauge */}
                {ENABLE_IDENTITY_CARD ? (
                    <DashboardIdentityCard
                        heroName={heroName}
                        isPortraitLoading={isPortraitLoading}
                        portraitUrl={portraitUrl}
                        tags={tags}
                        isSpecialistCapped={isSpecialistCapped}
                        winRate={identityMetrics.wr}
                        pickRate={identityMetrics.pr}
                        banRate={identityMetrics.br}
                        prebanRate={identityMetrics.prebanRate}
                        picks={identityMetrics.picks}
                        pilots={identityMetrics.pilots}
                        powerScore={identityMetrics.score}
                        tier={identityMetrics.tier}
                        tierColor={identityMetrics.tierColor}
                    />
                ) : (
                    <div className="dashboard-card identity-card-col" style={{ opacity: 0.3 }}>
                        [Identity Card Disabled]
                    </div>
                )}

                {/* Column 2: Draft Slot Performance */}
                {ENABLE_DRAFT_PERFORMANCE ? (
                    <DashboardDraftPerformance
                        heroName={heroName}
                        slotMetrics={slotMetrics}
                        synergies={synergies}
                        topComps={localCombatAnalysis?.top_comps || null}
                    />
                ) : (
                    <div className="dashboard-column charts-combat-col" style={{ opacity: 0.3 }}>
                        [Draft Performance Disabled]
                    </div>
                )}

                {/* Column 3: Stats Radar & Comparison */}
                {ENABLE_STATS_COMPARISON ? (
                    <DashboardStatsComparison
                        radarData={radarData}
                        avg={localBuildData?.averageStats}
                        pro={localBuildData?.proStats?.averageStats}
                        setStats={localBuildData?.setStats || []}
                        proSetStats={localBuildData?.proStats?.setStats || []}
                    />
                ) : (
                    <div className="dashboard-column charts-radar-col" style={{ opacity: 0.3 }}>
                        [Stats Comparison Disabled]
                    </div>
                )}
            </div>

            {/* ── TIER 2: DETAILED STRATEGY & COACHING SECTION ── */}
            <div className="unified-middle-row">
                {/* Left Column: Comps, Synergies, Bans */}
                <div className="middle-panel-half strategy-left-col">

                    {ENABLE_SYNERGY_BANS ? (
                        <DashboardSynergyBans
                            localCombatAnalysis={localCombatAnalysis}
                            fpPartners={fpPartners}
                            spPartners={spPartners}
                        />
                    ) : (
                        <div className="dashboard-card strategy-card" style={{ opacity: 0.3 }}>
                            [Synergy & Bans Disabled]
                        </div>
                    )}
                </div>

                {/* Right Column: Counters, Gear Score, Leaderboard */}
                <div className="middle-panel-half strategy-right-col">
                    {ENABLE_COUNTER_THREATS ? (
                        <DashboardCounterThreats
                            localCombatAnalysis={localCombatAnalysis}
                            strongCounters={strongCounters}
                            weakCounters={weakCounters}
                        />
                    ) : (
                        <div className="dashboard-card strategy-card" style={{ opacity: 0.3 }}>
                            [Counter Threats Disabled]
                        </div>
                    )}

                    {ENABLE_GEAR_RATING ? (
                        <DashboardGearRating
                            gsList={gsList}
                            binnedChartData={binnedChartData}
                            mainSet={mainSet}
                            offSet={offSet}
                            sortedArts={sortedArts}
                        />
                    ) : (
                        <div className="dashboard-card strategy-card rating-distribution-card" style={{ opacity: 0.3 }}>
                            [Gear Rating Disabled]
                        </div>
                    )}

                    {ENABLE_LEADERBOARD ? (
                        <DashboardLeaderboard
                            localCombatAnalysis={localCombatAnalysis}
                        />
                    ) : (
                        <div className="dashboard-card strategy-card leaderboard-card-wrap" style={{ opacity: 0.3 }}>
                            [Leaderboard Disabled]
                        </div>
                    )}
                </div>
            </div>

            {/* ── TIER 3: TECHNICAL SPECIFICATIONS & RAW BUILDS TABLE ── */}
            <div className="unified-bottom-row table-full-width">
                {ENABLE_BUILDS_TABLE ? (
                    <DashboardBuildsTable
                        localBuildData={localBuildData}
                    />
                ) : (
                    <div className="dashboard-card details-bottom-table-panel" style={{ opacity: 0.3 }}>
                        [Builds Table Disabled]
                    </div>
                )}
            </div>
        </div>
    );
});
