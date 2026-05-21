import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { getSetIconUrl } from '../../../services/setAssets';
import { SettingsService, AppSettings, DEFAULT_SETTINGS } from '../../../services/settingsService';
import './BuildStatsOverlay.css';
import { BuildStats, HeroAnalysis, MetagameHero, ProcessedBuildData, ActiveBuildSource } from '../../../domain/models';

interface BuildStatsOverlayProps {
    buildData: ProcessedBuildData;
    activeSource: ActiveBuildSource;
    combatAnalysis?: HeroAnalysis | null;
    metagameHero?: MetagameHero | null;
}

// Normalization maximums for radar chart scaling
const STAT_MAX: BuildStats = {
    hp: 40000,
    atk: 8000,
    def: 5000,
    spd: 350,
    chc: 100,
    chd: 350,
    eff: 300,
    efr: 300
};

export const BuildStatsOverlay: React.FC<BuildStatsOverlayProps> = ({
    buildData: initialBuildData,
    activeSource,
    combatAnalysis = null,
    metagameHero = null
}) => {
    const { t } = useTranslation();
    const [localBuildData, setLocalBuildData] = useState<ProcessedBuildData | null>(null);
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

    // Deep copy build data independently when the screen turns on / updates
    useEffect(() => {
        if (initialBuildData) {
            setLocalBuildData(JSON.parse(JSON.stringify(initialBuildData)));
        } else {
            setLocalBuildData(null);
        }
    }, [initialBuildData?.rawBuilds?.[0]?.unitName, initialBuildData?.cachedAt]);

    const combatStats = useMemo(() => {
        if (!combatAnalysis && !metagameHero) return null;

        const wr = metagameHero?.win_rate !== undefined
            ? metagameHero.win_rate
            : (combatAnalysis?.win_rate || 0);

        const pr = metagameHero?.pick_rate !== undefined
            ? metagameHero.pick_rate
            : (combatAnalysis ? (combatAnalysis.total_appearances / (combatAnalysis.total_matches || 1)) * 100 : 0);

        const br = metagameHero?.ban_rate !== undefined
            ? metagameHero.ban_rate
            : (combatAnalysis
                ? ((combatAnalysis as any).ban_rate !== undefined
                    ? (combatAnalysis as any).ban_rate
                    : (combatAnalysis as any).ban_count !== undefined
                        ? ((combatAnalysis as any).ban_count / (combatAnalysis.total_matches || 1)) * 100
                        : (pr * 0.6))
                : 0);

        const pbrTotal = metagameHero?.pick_ban_rate !== undefined
            ? metagameHero.pick_ban_rate
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

        return {
            winRate: wr,
            pickRate: pr,
            banRate: br,
            tier,
            tierColor
        };
    }, [combatAnalysis, metagameHero, t]);

    if (!localBuildData) {
        return null; // Return null if independent copy is not prepared yet
    }

    const usePro = activeSource.startsWith('pro') && !!localBuildData.proStats;
    const statsSource = usePro ? localBuildData.proStats! : localBuildData;
    const { averageStats, setStats } = statsSource;

    const cachedDateStr = localBuildData.cachedAt
        ? new Date(localBuildData.cachedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : null;

    // Prepare data for Radar Chart
    const data = [
        {
            stat: t('chart.statHealth'),
            Average: (averageStats.hp / STAT_MAX.hp) * 100,
            fullAvg: averageStats.hp,
            Set1: setStats[0] ? (setStats[0].stats.hp / STAT_MAX.hp) * 100 : 0,
            fullSet1: setStats[0]?.stats.hp,
            Set2: setStats[1] ? (setStats[1].stats.hp / STAT_MAX.hp) * 100 : 0,
            fullSet2: setStats[1]?.stats.hp,
            Set3: setStats[2] ? (setStats[2].stats.hp / STAT_MAX.hp) * 100 : 0,
            fullSet3: setStats[2]?.stats.hp
        },
        {
            stat: t('chart.statAttack'),
            Average: (averageStats.atk / STAT_MAX.atk) * 100,
            fullAvg: averageStats.atk,
            Set1: setStats[0] ? (setStats[0].stats.atk / STAT_MAX.atk) * 100 : 0,
            fullSet1: setStats[0]?.stats.atk,
            Set2: setStats[1] ? (setStats[1].stats.atk / STAT_MAX.atk) * 100 : 0,
            fullSet2: setStats[1]?.stats.atk,
            Set3: setStats[2] ? (setStats[2].stats.atk / STAT_MAX.atk) * 100 : 0,
            fullSet3: setStats[2]?.stats.atk
        },
        {
            stat: t('chart.statResist'),
            Average: (averageStats.efr / STAT_MAX.efr) * 100,
            fullAvg: averageStats.efr,
            Set1: setStats[0] ? (setStats[0].stats.efr / STAT_MAX.efr) * 100 : 0,
            fullSet1: setStats[0]?.stats.efr,
            Set2: setStats[1] ? (setStats[1].stats.efr / STAT_MAX.efr) * 100 : 0,
            fullSet2: setStats[1]?.stats.efr,
            Set3: setStats[2] ? (setStats[2].stats.efr / STAT_MAX.efr) * 100 : 0,
            fullSet3: setStats[2]?.stats.efr
        },
        {
            stat: t('chart.statEffect'),
            Average: (averageStats.eff / STAT_MAX.eff) * 100,
            fullAvg: averageStats.eff,
            Set1: setStats[0] ? (setStats[0].stats.eff / STAT_MAX.eff) * 100 : 0,
            fullSet1: setStats[0]?.stats.eff,
            Set2: setStats[1] ? (setStats[1].stats.eff / STAT_MAX.eff) * 100 : 0,
            fullSet2: setStats[1]?.stats.eff,
            Set3: setStats[2] ? (setStats[2].stats.eff / STAT_MAX.eff) * 100 : 0,
            fullSet3: setStats[2]?.stats.eff
        },
        {
            stat: t('chart.statCritDmg'),
            Average: (averageStats.chd / STAT_MAX.chd) * 100,
            fullAvg: averageStats.chd,
            Set1: setStats[0] ? (setStats[0].stats.chd / STAT_MAX.chd) * 100 : 0,
            fullSet1: setStats[0]?.stats.chd,
            Set2: setStats[1] ? (setStats[1].stats.chd / STAT_MAX.chd) * 100 : 0,
            fullSet2: setStats[1]?.stats.chd,
            Set3: setStats[2] ? (setStats[2].stats.chd / STAT_MAX.chd) * 100 : 0,
            fullSet3: setStats[2]?.stats.chd
        },
        {
            stat: t('chart.statCritPct'),
            Average: (averageStats.chc / STAT_MAX.chc) * 100,
            fullAvg: averageStats.chc,
            Set1: setStats[0] ? (setStats[0].stats.chc / STAT_MAX.chc) * 100 : 0,
            fullSet1: setStats[0]?.stats.chc,
            Set2: setStats[1] ? (setStats[1].stats.chc / STAT_MAX.chc) * 100 : 0,
            fullSet2: setStats[1]?.stats.chc,
            Set3: setStats[2] ? (setStats[2].stats.chc / STAT_MAX.chc) * 100 : 0,
            fullSet3: setStats[2]?.stats.chc
        },
        {
            stat: t('chart.statSpeed'),
            Average: (averageStats.spd / STAT_MAX.spd) * 100,
            fullAvg: averageStats.spd,
            Set1: setStats[0] ? (setStats[0].stats.spd / STAT_MAX.spd) * 100 : 0,
            fullSet1: setStats[0]?.stats.spd,
            Set2: setStats[1] ? (setStats[1].stats.spd / STAT_MAX.spd) * 100 : 0,
            fullSet2: setStats[1]?.stats.spd,
            Set3: setStats[2] ? (setStats[2].stats.spd / STAT_MAX.spd) * 100 : 0,
            fullSet3: setStats[2]?.stats.spd
        },
        {
            stat: t('chart.statDefense'),
            Average: (averageStats.def / STAT_MAX.def) * 100,
            fullAvg: averageStats.def,
            Set1: setStats[0] ? (setStats[0].stats.def / STAT_MAX.def) * 100 : 0,
            fullSet1: setStats[0]?.stats.def,
            Set2: setStats[1] ? (setStats[1].stats.def / STAT_MAX.def) * 100 : 0,
            fullSet2: setStats[1]?.stats.def,
            Set3: setStats[2] ? (setStats[2].stats.def / STAT_MAX.def) * 100 : 0,
            fullSet3: setStats[2]?.stats.def
        }
    ];

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const p = payload[0].payload;
            return (
                <div className="custom-tooltip">
                    <p className="label">{p.stat}</p>
                    <p className="desc avg-desc">{usePro ? t('chart.proAverage') : t('chart.average')}: {p.fullAvg}</p>
                    {setStats[0] && p.fullSet1 !== undefined && <p className="desc set1-desc">{setStats[0].setName}: {p.fullSet1}</p>}
                    {setStats[1] && p.fullSet2 !== undefined && <p className="desc set2-desc">{setStats[1].setName}: {p.fullSet2}</p>}
                    {setStats[2] && p.fullSet3 !== undefined && <p className="desc set3-desc">{setStats[2].setName}: {p.fullSet3}</p>}
                </div>
            );
        }
        return null;
    };



    const renderLegend = (props: any) => {
        const { payload } = props;
        return (
            <div className="custom-legend-container">
                {payload.map((entry: any, index: number) => {
                    const { value, color } = entry;
                    const isSet = value !== 'Avg' && value !== 'Pro Avg' && value !== 'Current';

                    return (
                        <div key={`item-${index}`} className="custom-legend-item">
                            <span
                                className="legend-bullet"
                                style={{ backgroundColor: color }}
                            />
                            {isSet ? (
                                <div className="set-icons-group">
                                    {value.split(' / ').map((setPart: string) => {
                                        const cleanPart = setPart.trim();
                                        const isChase = cleanPart.toLowerCase() === 'chase' || cleanPart.toLowerCase() === 'set_chase';
                                        return (
                                            <img
                                                key={cleanPart}
                                                src={getSetIconUrl(cleanPart)}
                                                alt={cleanPart}
                                                className={`set-legend-icon ${isChase ? 'no-scale' : ''}`}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <span className="legend-text">
                                    {value === 'Avg' ? t('chart.average') : value === 'Pro Avg' ? t('chart.proAverage') : value === 'Current' ? t('chart.current') : value}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const containerStyle = {
        background: `rgba(15, 20, 35, ${visualSettings.opacityOverlay})`,
        backdropFilter: visualSettings.blurEnabledOverlay ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: visualSettings.blurEnabledOverlay ? 'blur(12px)' : 'none',
    };

    return (
        <div className="build-stats-container" style={containerStyle}>
            {cachedDateStr && (
                <div style={{
                    position: 'absolute',
                    top: '6px',
                    left: '8px',
                    fontSize: '8px',
                    color: 'rgba(255, 255, 255, 0.45)',
                    fontFamily: 'Inter, sans-serif',
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    fontWeight: 600,
                    pointerEvents: 'none',
                    zIndex: 10
                }}>
                    {cachedDateStr}
                </div>
            )}
            {usePro && <div className="pro-chart-indicator">{t('chart.proBuilds')}</div>}
            <div className="build-stats-content">
                <div className="chart-section">
                    <ResponsiveContainer width="100%" height={210} debounce={200}>
                        <RadarChart cx="50%" cy="43%" outerRadius="65%" data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                            <PolarGrid stroke="rgba(255,255,255,0.2)" />
                            <PolarAngleAxis dataKey="stat" tick={{ fill: 'rgba(255,255,255,0.8)', fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

                            <Radar name={usePro ? "Pro Avg" : "Avg"} dataKey="Average" stroke="#00e5ff" fill="#00e5ff" fillOpacity={0.05} isAnimationActive={false} />

                            {setStats[0] && (
                                <Radar name={setStats[0].setName} dataKey="Set1" stroke="#4caf50" fill="#4caf50" fillOpacity={0.1} isAnimationActive={false} />
                            )}
                            {setStats[1] && (
                                <Radar name={setStats[1].setName} dataKey="Set2" stroke="#ff9800" fill="#ff9800" fillOpacity={0.1} isAnimationActive={false} />
                            )}
                            {setStats[2] && (
                                <Radar name={setStats[2].setName} dataKey="Set3" stroke="#e91e63" fill="#e91e63" fillOpacity={0.1} isAnimationActive={false} />
                            )}
                            <Tooltip content={<CustomTooltip />} />
                            <Legend content={renderLegend} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
                {combatStats && (
                    <div className="combat-stats-overlay-section">
                        <div className="combat-stats-title">
                            {t('chart.combatInfoTitle')}
                            <span
                                className="combat-badge-tag"
                                style={{
                                    color: combatStats.tierColor,
                                    borderColor: combatStats.tierColor,
                                    background: `${combatStats.tierColor}1a`, // Translucent 10% opacity hex
                                    boxShadow: `0 0 6px ${combatStats.tierColor}40`
                                }}
                            >
                                TIER {combatStats.tier}
                            </span>
                        </div>
                        <div className="combat-stats-grid">
                            <div className="combat-stat-item">
                                <span className="combat-stat-label">{t('chart.winRate')}</span>
                                <span className="combat-stat-val val-wr">{combatStats.winRate.toFixed(1)}%</span>
                            </div>
                            <div className="combat-stat-item">
                                <span className="combat-stat-label">{t('chart.pickRate')}</span>
                                <span className="combat-stat-val val-pr">{combatStats.pickRate.toFixed(1)}%</span>
                            </div>
                            <div className="combat-stat-item">
                                <span className="combat-stat-label">{t('chart.banRate')}</span>
                                <span className="combat-stat-val val-br">{combatStats.banRate.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="chart-keybind-tips">
                <span className="tip-item"><kbd>Alt + T</kbd>{t('chart.keybindTip')}</span>
                <span className="tip-item"><kbd>Alt + R</kbd>{t('chart.keybindDetailTip')}</span>
            </div>
        </div>
    );
};
