import React from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';
import { getSetIconUrl } from '../../../services/setAssets';

interface DashboardGearRatingProps {
    gsList: number[];
    binnedChartData: any[];
    mainSet: any;
    offSet: any;
    sortedArts: any[];
}

export const DashboardGearRating: React.FC<DashboardGearRatingProps> = React.memo(({
    gsList,
    binnedChartData,
    mainSet,
    offSet,
    sortedArts
}) => {
    const { t } = useTranslation();

    return (
        <div className="dashboard-card strategy-card rating-distribution-card">
            <div className="rating-split-flex">
                <div className="split-block flex-grow-1">
                    <span className="split-label">{t("combat.gearScoreDistribution")}</span>
                    <div className="mini-distribution-chart">
                        {gsList.length > 0 ? (
                            <ResponsiveContainer width="100%" height={80} debounce={200}>
                                <BarChart data={binnedChartData} margin={{ top: 5, right: 0, left: -32, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                    <XAxis dataKey="range" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 7 }} />
                                    <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 7 }} allowDecimals={false} />
                                    <Bar dataKey="Builds" fill="#00e5ff" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="strategy-empty-state mini">{t("combat.noGearRecords")}</div>
                        )}
                    </div>
                </div>

                <div className="split-block split-meta-stats">
                    <div className="meta-stat-sub-row">
                        <span className="meta-lbl">{t("combat.popularSets")}</span>
                        <div className="meta-sets-list">
                            {mainSet && (
                                <div className="meta-set-tag" title={`${mainSet.setName} (${mainSet.percent}%)`}>
                                    <img src={getSetIconUrl(mainSet.setName)} className="tag-set-icon" alt="" />
                                    <span>{mainSet.percent}%</span>
                                </div>
                            )}
                            {offSet && (
                                <div className="meta-set-tag" title={`${offSet.setName} (${offSet.percent}%)`}>
                                    <img src={getSetIconUrl(offSet.setName)} className="tag-set-icon" alt="" />
                                    <span>{offSet.percent}%</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="meta-stat-sub-row">
                        <span className="meta-lbl">{t("combat.topArtifacts")}</span>
                        <div className="meta-art-ranking-list">
                            {sortedArts.slice(0, 2).map(([code]: any, aIdx: number) => (
                                <span key={code} className="meta-art-text-tag truncate" title={code}>
                                    #{aIdx + 1} {code.substring(0, 14)}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
