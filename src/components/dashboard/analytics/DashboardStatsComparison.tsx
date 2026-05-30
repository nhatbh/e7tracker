import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { BuildStats } from '../../../services/buildAssist';
import { SetIconsGroup } from '../../common/SetIconsGroup';

interface DashboardStatsComparisonProps {
    radarData: any[];
    avg: BuildStats | undefined;
    pro: BuildStats | undefined;
    setStats: Array<{ setName: string; percent: number; stats: BuildStats; }>;
    proSetStats: Array<{ setName: string; percent: number; stats: BuildStats; }>;
}

// Move statsList outside component to prevent recreation on every render
const STATS_LIST: Array<{ labelKey: string; key: keyof BuildStats; isPercent?: boolean; isSpd?: boolean }> = [
    { labelKey: 'combat.atk', key: 'atk' },
    { labelKey: 'combat.def', key: 'def' },
    { labelKey: 'combat.hp', key: 'hp' },
    { labelKey: 'combat.spd', key: 'spd', isSpd: true },
    { labelKey: 'combat.critPct', key: 'chc', isPercent: true },
    { labelKey: 'combat.cDmg', key: 'chd', isPercent: true },
    { labelKey: 'combat.eff', key: 'eff', isPercent: true },
    { labelKey: 'combat.er', key: 'efr', isPercent: true },
];

export const DashboardStatsComparison: React.FC<DashboardStatsComparisonProps> = React.memo(({
    radarData,
    avg,
    pro,
    setStats,
    proSetStats
}) => {
    const { t } = useTranslation();

    const renderSetHeader = useMemo(() => (setObj: any, isPro: boolean) => {
        if (!setObj) return <span className="empty-header-dash">-</span>;
        return (
            <div className={`header-set-badge ${isPro ? 'pro-glow' : ''}`} title={`${setObj.setName} (${setObj.percent}%)`}>
                <SetIconsGroup setName={setObj.setName} className="header-set-icons" iconClassName="header-set-icon" />
                <span className="header-set-percent">{setObj.percent}%</span>
            </div>
        );
    }, []);

    const renderStatCell = useMemo(() => (setObj: any, statKey: keyof BuildStats, isPro: boolean) => {
        if (!setObj || !setObj.stats) return <span className="text-right text-muted">-</span>;
        const val = setObj.stats[statKey];
        const isPercent = statKey === 'chc' || statKey === 'chd' || statKey === 'eff' || statKey === 'efr';
        const formatted = isPercent ? `${Math.round(val)}%` : Math.round(val).toLocaleString();
        return (
            <span className={`text-right ${isPro ? 'comp-value-pro' : 'comp-value-set'}`}>
                {formatted}
            </span>
        );
    }, []);

    return (
        <div className="dashboard-column charts-radar-col">
            <div className="dashboard-card stats-benchmark-unified-card">
                <h4 className="chart-heading">{t("combat.statsBenchmark")}</h4>
                <div className="stats-benchmark-split-container">
                    {/* Left: Radar Chart side */}
                    <div className="stats-benchmark-radar-side">
                        {radarData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={160} debounce={200}>
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <PolarGrid stroke="rgba(255,255,255,0.05)" />
                                    <PolarAngleAxis dataKey="stat" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 7.5 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar name={t("combat.avgLabel")} dataKey="Average" stroke="#00e5ff" fill="#00e5ff" fillOpacity={0.15} isAnimationActive={false} />
                                    <Radar name={t("combat.proLabel")} dataKey="Pro" stroke="#ff007f" fill="#ff007f" fillOpacity={0.15} isAnimationActive={false} />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="chart-placeholder">{t("combat.noStatsLoaded")}</div>
                        )}
                    </div>

                    {/* Right: Benchmarks Table side */}
                    <div className="stats-benchmark-table-side">
                        <div className="comparison-flow-block">
                            <div className="comp-header-row">
                                <span>{t("combat.statLabel")}</span>
                                <span className="text-right" style={{ color: '#00e5ff' }}>{t("combat.avgLabel")}</span>
                                <span className="text-right" style={{ color: '#ff007f' }}>{t("combat.proLabel")}</span>

                                {/* Top 3 Avg Sets Headers */}
                                <span className="text-right">{renderSetHeader(setStats[0], false)}</span>
                                <span className="text-right">{renderSetHeader(setStats[1], false)}</span>
                                <span className="text-right">{renderSetHeader(setStats[2], false)}</span>

                                {/* Top 3 Pro Sets Headers */}
                                <span className="text-right">{renderSetHeader(proSetStats[0], true)}</span>
                                <span className="text-right">{renderSetHeader(proSetStats[1], true)}</span>
                                <span className="text-right">{renderSetHeader(proSetStats[2], true)}</span>
                            </div>
                            {avg ? (
                                <div className="comp-rows-container">
                                    {STATS_LIST.map(({ labelKey, key, isPercent, isSpd }) => (
                                        <div key={key} className="comp-row">
                                            <span className="stat-label-col">{t(labelKey)}</span>
                                            <span className="text-right">{isPercent ? `${Math.round(avg[key])}%` : isSpd ? Math.round(avg[key]) : Math.round(avg[key]).toLocaleString()}</span>
                                            <span className="text-right comp-value-pro">{pro ? (isPercent ? `${Math.round(pro[key])}%` : isSpd ? Math.round(pro[key]) : Math.round(pro[key]).toLocaleString()) : '-'}</span>

                                            {/* Avg sets stats cells */}
                                            {renderStatCell(setStats[0], key, false)}
                                            {renderStatCell(setStats[1], key, false)}
                                            {renderStatCell(setStats[2], key, false)}

                                            {/* Pro sets stats cells */}
                                            {renderStatCell(proSetStats[0], key, true)}
                                            {renderStatCell(proSetStats[1], key, true)}
                                            {renderStatCell(proSetStats[2], key, true)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="strategy-empty-state">{t("combat.noStatsLoaded")}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
