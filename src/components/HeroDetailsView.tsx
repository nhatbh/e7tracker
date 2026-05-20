import React, { useState, useEffect, useMemo } from 'react';
import { Tooltip } from 'react-tooltip';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import 'react-tooltip/dist/react-tooltip.css';
import { ProcessedBuildData } from '../services/buildAssist';
import { CombatData, HeroAnalysis, MetagameData, MetagameHero } from '../services/combatData';
import { getLegitMatchups } from './HeroMiniPortrait';
import { DashboardIdentityCard } from './DashboardIdentityCard';
import { DashboardDraftPerformance } from './DashboardDraftPerformance';
import { DashboardStatsComparison } from './DashboardStatsComparison';
import { DashboardSynergyBans } from './DashboardSynergyBans';
import { DashboardCounterThreats } from './DashboardCounterThreats';
import { DashboardGearRating } from './DashboardGearRating';
import { DashboardLeaderboard } from './DashboardLeaderboard';
import { DashboardBuildsTable } from './DashboardBuildsTable';
import { DamageCalculatorTab } from './damageCalc/DamageCalculatorTab';
import { DashboardCombatDetails } from './DashboardCombatDetails';
import { SavedBuildProfile } from '../services/damageCalc/profileCalc';
import { SettingsService, AppSettings, DEFAULT_SETTINGS } from '../services/settingsService';
import './HeroDetailsView.css';
import { SavedBuildsTab } from './damageCalc/SavedBuildsTab';
import { CompareTab } from './damageCalc/CompareTab';

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

interface HeroDetailsViewProps {
    heroName: string;
    buildData: ProcessedBuildData | null;
    combatAnalysis: HeroAnalysis | null;
    metagameHero: MetagameHero | null;
    onClose: () => void;
    onHeroChange: (newHeroName: string) => void;
    initialTab?: 'analytics' | 'combat' | 'calculator' | 'saved_builds' | 'compare';
    initialImportedProfile?: SavedBuildProfile | null;
}

export const HeroDetailsView: React.FC<HeroDetailsViewProps> = ({
    heroName,
    buildData: initialBuildData,
    combatAnalysis: initialCombatAnalysis,
    metagameHero: initialMetagameHero,
    onClose,
    initialTab = 'analytics',
    initialImportedProfile = null
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'analytics' | 'combat' | 'calculator' | 'saved_builds' | 'compare'>(initialTab);

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const [isHidingForOCR, setIsHidingForOCR] = useState(false);
    const [importedProfileData, setImportedProfileData] = useState<SavedBuildProfile | null>(initialImportedProfile);

    useEffect(() => {
        if (initialImportedProfile !== undefined) {
            setImportedProfileData(initialImportedProfile);
        }
    }, [initialImportedProfile]);

    const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);

    // Visual Customization Settings
    const [visualSettings, setVisualSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

    useEffect(() => {
        // Load initial settings
        SettingsService.getSettings().then(setVisualSettings).catch(console.error);

        // Listen for live updates
        const unsubscribe = SettingsService.onSettingsChanged((newSettings) => {
            setVisualSettings(newSettings);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    // Portrait and Combat States
    const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
    const [isPortraitLoading, setIsPortraitLoading] = useState(false);
    const [localCombatAnalysis, setLocalCombatAnalysis] = useState<HeroAnalysis | null>(null);
    const [localBuildData, setLocalBuildData] = useState<ProcessedBuildData | null>(null);

    // Deep copy build data independently when the screen turns on / updates
    useEffect(() => {
        if (initialBuildData) {
            setLocalBuildData(JSON.parse(JSON.stringify(initialBuildData)));
        } else {
            setLocalBuildData(null);
        }
    }, [heroName, initialBuildData?.rawBuilds?.[0]?.unitName, initialBuildData?.cachedAt]);

    // Deep copy combat analysis independently when the screen turns on / updates
    useEffect(() => {
        if (initialCombatAnalysis) {
            setLocalCombatAnalysis(JSON.parse(JSON.stringify(initialCombatAnalysis)));
        } else {
            setLocalCombatAnalysis(null);
        }
    }, [heroName, initialCombatAnalysis]);

    const [localMetagameHero, setLocalMetagameHero] = useState<MetagameHero | null>(initialMetagameHero || null);

    // Deep copy metagame data independently when the screen turns on / updates
    useEffect(() => {
        if (initialMetagameHero) {
            setLocalMetagameHero(JSON.parse(JSON.stringify(initialMetagameHero)));
        } else {
            let isMounted = true;
            const fetchMetagame = async () => {
                try {
                    const metaHero = await MetagameData.getHeroMetagame(heroName);
                    if (isMounted) {
                        setLocalMetagameHero(metaHero);
                    }
                } catch (e) {
                    console.error("[HeroDetailsView] Failed to load metagame data:", e);
                }
            };
            fetchMetagame();
            return () => {
                isMounted = false;
            };
        }
    }, [heroName, initialMetagameHero]);

    // Compute draft tags in the parent to support absolute-bottom portal tooltips rendering
    const { tags, isSpecialistCapped } = useMemo(() => {
        const tags: Array<{ name: string; vibe: string; desc: string; color: string; bg: string }> = [];
        if (!localCombatAnalysis && !localMetagameHero) {
            return { tags, isSpecialistCapped: false };
        }

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

        const isSpecialistCapped = pr < 3; // Retain warning flag when pick rate is under 3%
        const prebanRate = Math.max(0, pbrTotal - pr);
        const totalPicks = localCombatAnalysis?.total_appearances || 1;

        const slot1Count = localCombatAnalysis?.draft_position?.["1"]?.count || 0;
        const slot2Count = localCombatAnalysis?.draft_position?.["2"]?.count || 0;
        const slot3Count = localCombatAnalysis?.draft_position?.["3"]?.count || 0;
        const slot4Count = localCombatAnalysis?.draft_position?.["4"]?.count || 0;
        const slot5Count = localCombatAnalysis?.draft_position?.["5"]?.count || 0;

        const slot1Ratio = totalPicks > 0 ? (slot1Count / totalPicks) * 100 : 0;
        const slot2Ratio = totalPicks > 0 ? (slot2Count / totalPicks) * 100 : 0;
        const slot3Ratio = totalPicks > 0 ? (slot3Count / totalPicks) * 100 : 0;

        const slot1WR = localCombatAnalysis?.draft_position?.["1"]?.win_rate || 0;
        const slot2WR = localCombatAnalysis?.draft_position?.["2"]?.win_rate || 0;
        const slot3WR = localCombatAnalysis?.draft_position?.["3"]?.win_rate || 0;
        const slot4WR = localCombatAnalysis?.draft_position?.["4"]?.win_rate || 0;
        const slot5WR = localCombatAnalysis?.draft_position?.["5"]?.win_rate || 0;

        const slot45Count = slot4Count + slot5Count;
        const wrS45 = slot45Count > 0
            ? ((slot4WR * slot4Count) + (slot5WR * slot5Count)) / slot45Count
            : 0;

        const prS12 = totalPicks > 0 ? ((slot1Count + slot2Count) / totalPicks) * 100 : 0;
        const prS45 = totalPicks > 0 ? ((slot4Count + slot5Count) / totalPicks) * 100 : 0;
        const presence = pbrTotal;

        // 1. Highly Contested (Meta Apex Predator)
        if ((slot1Ratio >= 50 && prebanRate > 15) || prebanRate > 40) {
            tags.push({
                name: t("tags.highlyContested.name"),
                vibe: t("tags.highlyContested.vibe"),
                desc: t("tags.highlyContested.desc"),
                color: "#ff007f", // Neon Pink
                bg: "rgba(255, 0, 127, 0.08)"
            });
        }
        // 2. Snowballer (Slot 1 Dictator)
        else if (slot1Ratio >= 30 && slot1WR >= 52 && wrS45 < 49) {
            tags.push({
                name: t("tags.snowballer.name"),
                vibe: t("tags.snowballer.vibe"),
                desc: t("tags.snowballer.desc"),
                color: "#a855f7", // Vibrant Purple
                bg: "rgba(168, 85, 247, 0.08)"
            });
        }
        // 3. The Wingman (Solid Early Foundation)
        else if (prS12 >= 65 && slot2WR >= 50.5) {
            tags.push({
                name: t("tags.wingman.name"),
                vibe: t("tags.wingman.vibe"),
                desc: t("tags.wingman.desc"),
                color: "#3b82f6", // Royal Blue
                bg: "rgba(59, 130, 246, 0.08)"
            });
        }
        // 4. Draft Trap (Overvalued First Pick)
        else if (slot1Ratio >= 40 && slot1WR < 48 && slot1WR < wr) {
            tags.push({
                name: t("tags.draftTrap.name"),
                vibe: t("tags.draftTrap.vibe"),
                desc: t("tags.draftTrap.desc"),
                color: "#ef4444", // Crimson Red
                bg: "rgba(239, 68, 68, 0.08)"
            });
        }
        // 5. Noob Trap (Popular but Weak)
        else if (pr >= 15 && prebanRate < 5 && wr < 47) {
            tags.push({
                name: t("tags.noobTrap.name"),
                vibe: t("tags.noobTrap.vibe"),
                desc: t("tags.noobTrap.desc"),
                color: "#f43f5e", // Rose Red
                bg: "rgba(244, 63, 94, 0.08)"
            });
        }
        // 6. Core Pick (Safe Win Condition)
        else if (slot3Ratio >= 50 && (br - prebanRate) < 10 && slot3WR >= 51) {
            tags.push({
                name: t("tags.corePick.name"),
                vibe: t("tags.corePick.vibe"),
                desc: t("tags.corePick.desc"),
                color: "#10b981", // Emerald Green
                bg: "rgba(16, 185, 129, 0.08)"
            });
        }
        // 7. Troll Pick (Guaranteed Draft Loss)
        else if (slot3Ratio >= 60 && presence < 5 && slot3WR < 45) {
            tags.push({
                name: t("tags.trollPick.name"),
                vibe: t("tags.trollPick.vibe"),
                desc: t("tags.trollPick.desc"),
                color: "#e2e8f0", // Pale Silver
                bg: "rgba(226, 232, 240, 0.08)"
            });
        }
        // 8. Clutcher (Late Draft Terror)
        else if (prS45 >= 45 && (br - prebanRate) >= 20 && wrS45 >= 53) {
            tags.push({
                name: t("tags.clutcher.name"),
                vibe: t("tags.clutcher.vibe"),
                desc: t("tags.clutcher.desc"),
                color: "#ff00e5", // Electric Magenta
                bg: "rgba(255, 0, 229, 0.08)"
            });
        }
        // 9. Pocket Pick (Niche Secret Weapon)
        else if (prS45 >= 60 && pr < 5 && wrS45 > wr) {
            tags.push({
                name: t("tags.pocketPick.name"),
                vibe: t("tags.pocketPick.vibe"),
                desc: t("tags.pocketPick.desc"),
                color: "#ffae00", // Bright Amber
                bg: "rgba(255, 174, 0, 0.08)"
            });
        }
        // 10. Failed Counter (Backfiring Reaction)
        else if (prS45 >= 40 && wrS45 < 48 && wrS45 < wr) {
            tags.push({
                name: t("tags.failedCounter.name"),
                vibe: t("tags.failedCounter.vibe"),
                desc: t("tags.failedCounter.desc"),
                color: "#f97316", // Bright Orange
                bg: "rgba(249, 115, 22, 0.08)"
            });
        }
        // 11. The Decoy (Irrational Fear Ban)
        else if (presence >= 25 && wr <= 48.5) {
            tags.push({
                name: t("tags.decoy.name"),
                vibe: t("tags.decoy.vibe"),
                desc: t("tags.decoy.desc"),
                color: "#f43f5e", // Rose Red
                bg: "rgba(244, 63, 94, 0.08)"
            });
        }
        // 12. Hidden Gem (Forgotten but Broken)
        else if (presence < 8 && pr >= 1.5 && wr >= 54.5) {
            tags.push({
                name: t("tags.hiddenGem.name"),
                vibe: t("tags.hiddenGem.vibe"),
                desc: t("tags.hiddenGem.desc"),
                color: "#00e5ff", // Electric Cyan
                bg: "rgba(0, 229, 255, 0.08)"
            });
        }
        // 13. Flex Pick (Unpredictable Safe Choice)
        else if (pr >= 10 && slot1Ratio >= 15 && slot1Ratio <= 45 && slot2Ratio >= 15 && slot2Ratio <= 45 && slot3Ratio >= 15 && slot3Ratio <= 45 && wr >= 49) {
            tags.push({
                name: t("tags.flexPick.name"),
                vibe: t("tags.flexPick.vibe"),
                desc: t("tags.flexPick.desc"),
                color: "#38bdf8", // Sky Blue
                bg: "rgba(56, 189, 248, 0.08)"
            });
        }
        // 14. Dead Meta (Statistically Useless)
        else if (presence < 4 && presence > 0 && (br - prebanRate) < 2 && wr < 47) {
            tags.push({
                name: t("tags.deadMeta.name"),
                vibe: t("tags.deadMeta.vibe"),
                desc: t("tags.deadMeta.desc"),
                color: "#64748b", // Muted Slate
                bg: "rgba(100, 116, 139, 0.08)"
            });
        }

        // Fallback Default
        if (tags.length === 0) {
            tags.push({
                name: t("tags.standardDraft.name"),
                vibe: t("tags.standardDraft.vibe"),
                desc: t("tags.standardDraft.desc"),
                color: "#94a3b8", // Cool Gray
                bg: "rgba(148, 163, 184, 0.08)"
            });
        }

        return { tags, isSpecialistCapped };
    }, [localCombatAnalysis, localMetagameHero, t]);





    // Listen to ESC key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Fetch/Stash Hero Portrait using rust command to bypass CORS and save locally
    useEffect(() => {
        let isMounted = true;
        const fetchStashedPortrait = async () => {
            let targetCode = "";

            if (localCombatAnalysis && localCombatAnalysis.hero_code) {
                targetCode = localCombatAnalysis.hero_code;
            } else {
                const meta = CombatData.getMetadata();
                const matched = meta?.hero_list.find((h: any) => h.hero_name.toLowerCase() === heroName.toLowerCase());
                if (matched) {
                    targetCode = matched.hero;
                }
            }

            if (!targetCode) {
                setPortraitUrl(null);
                return;
            }

            setIsPortraitLoading(true);
            try {
                const base64Data = await invoke<string>("get_or_download_portrait", { heroCode: targetCode });
                if (isMounted) {
                    setPortraitUrl(base64Data);
                }
            } catch (e) {
                console.error("[HeroDetailsView] Failed to fetch stashed portrait:", e);
                if (isMounted) setPortraitUrl(null);
            } finally {
                if (isMounted) setIsPortraitLoading(false);
            }
        };

        fetchStashedPortrait();
        return () => {
            isMounted = false;
        };
    }, [heroName, localCombatAnalysis]);







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
        return rawBuilds.map(b => b.gs || 0).filter(score => score > 0);
    }, [rawBuilds]);

    const binnedChartData = useMemo(() => {
        const bins = {
            "<320": 0,
            "320-340": 0,
            "340-360": 0,
            "360-380": 0,
            "380-400": 0,
            "400+": 0
        };
        gsList.forEach(score => {
            if (score < 320) bins["<320"]++;
            else if (score < 340) bins["320-340"]++;
            else if (score < 360) bins["340-360"]++;
            else if (score < 380) bins["360-380"]++;
            else if (score < 400) bins["380-400"]++;
            else bins["400+"]++;
        });
        return Object.entries(bins).map(([range, count]) => ({
            range,
            Builds: count
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

    const containerStyle = {
        background: `radial-gradient(circle at 50% 0%, rgba(11, 22, 54, ${visualSettings.opacityHeroDetails}) 0%, rgba(3, 6, 16, ${Math.min(1.0, visualSettings.opacityHeroDetails * 1.2)}) 100%)`,
        backdropFilter: visualSettings.blurEnabledHeroDetails ? 'blur(30px)' : 'none',
        WebkitBackdropFilter: visualSettings.blurEnabledHeroDetails ? 'blur(30px)' : 'none',
        transition: 'opacity 0.25s ease',
        ...(isHidingForOCR ? { opacity: 0, pointerEvents: 'none' as const } : {})
    };

    return (
        <div
            className="hero-details-container unified-dashboard"
            style={containerStyle}
        >
            {/* Minimalist absolute close button */}
            <button className="absolute-close-btn" onClick={onClose} aria-label="Close">✕</button>

            {/* Minimalist Tab Switcher */}
            <div className="hero-details-tabs-header">
                <button
                    className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    <span className="tab-label">{t('heroDetails.tabAnalytics', 'Builds & Analytics')}</span>
                </button>
                <button
                    className={`tab-btn ${activeTab === 'combat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('combat')}
                >
                    <span className="tab-label">{t('heroDetails.tabCombat', 'Combat Breakdown')}</span>
                </button>
                <button
                    className={`tab-btn ${activeTab === 'calculator' ? 'active' : ''}`}
                    onClick={() => setActiveTab('calculator')}
                >
                    <span className="tab-label">{t('heroDetails.tabCalculator', 'Damage Calculator')}</span>
                </button>
                <button
                    className={`tab-btn ${activeTab === 'saved_builds' ? 'active' : ''}`}
                    onClick={() => setActiveTab('saved_builds')}
                >
                    <span className="tab-label">{t('heroDetails.tabSavedBuilds', 'Saved Builds')}</span>
                </button>
                <button
                    className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
                    onClick={() => setActiveTab('compare')}
                >
                    <span className="tab-label">{t('heroDetails.tabCompare', 'Compare Builds')}</span>
                </button>
            </div>

            {activeTab === 'analytics' ? (
                /* ── 2. Scrollable Workspace Area ── */
                <div className="dashboard-scrollable-content">

                    {/* ── TIER 1: HIGH PRIORITY VISUAL SHINY SECTION ── */}
                    <div className="unified-top-row">
                        {/* Column 1: Identity & Win Rate Gauge */}
                        {ENABLE_IDENTITY_CARD ? (
                            <DashboardIdentityCard
                                heroName={heroName}
                                localCombatAnalysis={localCombatAnalysis}
                                localMetagameHero={localMetagameHero}
                                isPortraitLoading={isPortraitLoading}
                                portraitUrl={portraitUrl}
                                tags={tags}
                                isSpecialistCapped={isSpecialistCapped}
                            />
                        ) : (
                            <div className="dashboard-card identity-card-col" style={{ opacity: 0.3 }}>
                                [Identity Card Disabled]
                            </div>
                        )}

                        {/* Column 2: Draft Slot Performance */}
                        {ENABLE_DRAFT_PERFORMANCE ? (
                            <DashboardDraftPerformance
                                localCombatAnalysis={localCombatAnalysis}
                                localMetagameHero={localMetagameHero}
                                heroName={heroName}
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
                    <div className="unified-mid-row">
                        {/* Left Column: Comps, Synergies, Bans */}
                        <div className="mid-col strategy-left-col">


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
                        <div className="mid-col strategy-right-col">
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
            ) : activeTab === 'combat' ? (
                <div className="dashboard-scrollable-content">
                    <DashboardCombatDetails
                        localCombatAnalysis={localCombatAnalysis}
                        heroName={heroName}
                    />
                </div>
            ) : activeTab === 'calculator' ? (
                <DamageCalculatorTab
                    heroName={heroName}
                    buildData={localBuildData}
                    isHidingForOCR={isHidingForOCR}
                    setIsHidingForOCR={setIsHidingForOCR}
                    importedProfileData={importedProfileData}
                    onClearImportedProfile={() => setImportedProfileData(null)}
                />
            ) : activeTab === 'compare' ? (
                <div className="dashboard-scrollable-content">
                    <CompareTab
                        heroName={heroName}
                        selectedCompareIds={selectedCompareIds}
                        setSelectedCompareIds={setSelectedCompareIds}
                        onBackToSavedBuilds={() => setActiveTab('saved_builds')}
                    />
                </div>
            ) : (
                <SavedBuildsTab
                    heroName={heroName}
                    onLoadIntoCalculator={(profile) => {
                        setImportedProfileData(profile);
                        setActiveTab('calculator');
                    }}
                    selectedCompareIds={selectedCompareIds}
                    setSelectedCompareIds={setSelectedCompareIds}
                    onStartComparison={() => setActiveTab('compare')}
                />
            )}

            {/* Flat Tooltips Siblings */}
            {isSpecialistCapped && (
                <Tooltip
                    anchorSelect="#specialist-warning-trigger"
                    place="bottom"
                    className="portal-floating-tooltip"
                    style={{ borderColor: '#ffae0080', zIndex: 999999999 }}
                >
                    <div className="tooltip-vibe-header" style={{ color: '#ffae00' }}>
                        {t("tags.specialistWarning.vibe")}
                    </div>
                    <div className="tooltip-tag-name">
                        {t("tags.specialistWarning.name")}
                    </div>
                    <div className="tooltip-tag-desc">
                        {t("tags.specialistWarning.desc")}
                    </div>
                </Tooltip>
            )}

            {tags.map((tag) => (
                <Tooltip
                    key={`tooltip-portal-${tag.name}`}
                    anchorSelect={`#tag-trigger-${tag.name.replace(/\s+/g, '-')}`}
                    place="bottom"
                    className="portal-floating-tooltip"
                    style={{ borderColor: `${tag.color}80`, zIndex: 999999999 }}
                >
                    <div className="tooltip-vibe-header" style={{ color: tag.color }}>
                        {tag.vibe}
                    </div>
                    <div className="tooltip-tag-name">
                        {tag.name}
                    </div>
                    <div className="tooltip-tag-desc">
                        {tag.desc}
                    </div>
                </Tooltip>
            ))}
        </div>
    );
};
