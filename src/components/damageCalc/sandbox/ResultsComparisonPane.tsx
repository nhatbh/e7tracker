import React from 'react';
import {
    ResponsiveContainer,
    BarChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Bar,
    Tooltip as ChartTooltip,
    Legend as ChartLegend
} from 'recharts';

interface ResultsComparisonPaneProps {
    calculationsData: Array<{
        caster: any;
        output: any;
        error?: string;
    }>;
    uniqueSkills: string[];
    formatSkillHeader: (skillId: string) => string;
    findSkillDamage: (damages: any[], skillId: string, soulburn: boolean) => any;
    TAB_COLORS: string[];
    chartData: any[];
}

export const ResultsComparisonPane: React.FC<ResultsComparisonPaneProps> = ({
    calculationsData,
    uniqueSkills,
    formatSkillHeader,
    findSkillDamage,
    TAB_COLORS,
    chartData
}) => {
    return (
        <div className="results-comparison-workspace">

            {/* Top: Full width detailed comparison table */}
            <div className="results-table-col calc-card">
                <h3 className="section-workspace-title">Comparative Analytics</h3>
                <div className="analytics-table-container">
                    <table className="sandbox-analytics-table">
                        <thead>
                            <tr>
                                <th>Caster Build</th>
                                {uniqueSkills.map(skillId => (
                                    <th key={skillId} className="skill-col">
                                        {formatSkillHeader(skillId)} Damage
                                    </th>
                                ))}
                                <th>Shields</th>
                            </tr>
                        </thead>
                        <tbody>
                            {calculationsData.map(({ caster, output }, idx) => {
                                const renderDamageCell = (skillId: string) => {
                                    const normalRow = findSkillDamage(output.damages, skillId, false);
                                    const soulburnRow = findSkillDamage(output.damages, skillId, true);

                                    const normalVal = normalRow?.crit !== undefined && normalRow?.crit !== null ? normalRow.crit : normalRow?.normal;
                                    const soulburnVal = soulburnRow?.crit !== undefined && soulburnRow?.crit !== null ? soulburnRow.crit : soulburnRow?.normal;

                                    if (normalVal === undefined && soulburnVal === undefined) return '--';

                                    return (
                                        <div className="damage-cell-content">
                                            {normalVal !== undefined && normalVal !== null ? (
                                                <div className="dmg-row-val normal">
                                                    <span>{normalRow?.crit !== null ? 'Crit' : 'Hit'}:</span>
                                                    <strong>{normalVal.toLocaleString()}</strong>
                                                </div>
                                            ) : '--'}
                                            {soulburnVal !== undefined && soulburnVal !== null && (
                                                <div className="dmg-row-val soulburn glow-purple-text">
                                                    <span>SB:</span>
                                                    <strong>{soulburnVal.toLocaleString()}</strong>
                                                </div>
                                            )}
                                        </div>
                                    );
                                };

                                return (
                                    <tr key={caster.id} style={{ borderLeft: `3px solid ${TAB_COLORS[idx % TAB_COLORS.length]}` }}>
                                        <td className="caster-col-name">
                                            <strong>{caster.heroName}</strong>
                                            <span>{caster.profileName}</span>
                                        </td>
                                        {uniqueSkills.map(skillId => (
                                            <td key={skillId}>{renderDamageCell(skillId)}</td>
                                        ))}
                                        <td className="shield-col">
                                            {output.barriers.length > 0 ? (
                                                output.barriers.map((b: any) => (
                                                    <div key={b.label} className="sh-item">
                                                        <span>{b.label}:</span>
                                                        <strong>+{b.value.toLocaleString()}</strong>
                                                    </div>
                                                ))
                                            ) : '--'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Bottom: Recharts clustered bar charts */}
            <div className="results-charts-col calc-card">
                <h3 className="section-workspace-title">Combat Performance Visualizer</h3>
                <div className="visualizer-chart-wrapper">
                    {chartData.length === 0 ? (
                        <div className="chart-empty-state">No caster workspace tab loaded.</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                                <ChartTooltip
                                    contentStyle={{ background: 'rgba(5, 8, 22, 0.95)', border: '1px solid rgba(0, 242, 254, 0.25)', borderRadius: '6px' }}
                                    labelStyle={{ color: '#00f2fe', fontWeight: 'bold' }}
                                />
                                <ChartLegend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                                {calculationsData.map(({ caster }, idx) => {
                                    const keyName = `${caster.heroName} (${caster.profileName})`;
                                    return (
                                        <Bar
                                            key={caster.id}
                                            dataKey={keyName}
                                            fill={TAB_COLORS[idx % TAB_COLORS.length]}
                                            radius={[4, 4, 0, 0]}
                                        />
                                    );
                                })}
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

        </div>
    );
};
