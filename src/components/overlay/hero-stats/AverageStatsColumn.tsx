import React, { useState, useEffect } from 'react';
import { ProcessedBuildData } from '../../../services/buildAssist';
import { SetIconsGroup } from '../../common/SetIconsGroup';
import './AverageStatsColumn.css';

interface AverageStatsColumnProps {
    buildData: ProcessedBuildData;
    activeSource: 'avg' | 'set1' | 'set2' | 'set3' | 'pro' | 'pro_set1' | 'pro_set2' | 'pro_set3';
}

export const AverageStatsColumn: React.FC<AverageStatsColumnProps> = ({ buildData: initialBuildData, activeSource }) => {
    const [localBuildData, setLocalBuildData] = useState<ProcessedBuildData | null>(null);

    // Deep copy build data independently when the screen turns on / updates
    useEffect(() => {
        if (initialBuildData) {
            setLocalBuildData(JSON.parse(JSON.stringify(initialBuildData)));
        } else {
            setLocalBuildData(null);
        }
    }, [initialBuildData?.rawBuilds?.[0]?.unitName, initialBuildData?.cachedAt]);

    if (!localBuildData) {
        return null; // Return null if independent copy is not prepared yet
    }

    const statsSource = (localBuildData as any).data || localBuildData;
    const { averageStats, setStats, proStats } = statsSource;

    // Resolve which stats and labels/icons to use based on activeSource
    let statsToUse = averageStats || { atk: 0, def: 0, hp: 0, spd: 0, chc: 0, chd: 0, eff: 0, efr: 0 };
    let badgeText = 'Avg';
    let popularSet: string | null = null;

    if (activeSource === 'set1' && setStats && setStats[0]) {
        statsToUse = setStats[0].stats;
        badgeText = `${setStats[0].percent}%`;
        popularSet = setStats[0].setName;
    } else if (activeSource === 'set2' && setStats && setStats[1]) {
        statsToUse = setStats[1].stats;
        badgeText = `${setStats[1].percent}%`;
        popularSet = setStats[1].setName;
    } else if (activeSource === 'set3' && setStats && setStats[2]) {
        statsToUse = setStats[2].stats;
        badgeText = `${setStats[2].percent}%`;
        popularSet = setStats[2].setName;
    } else if (activeSource === 'pro') {
        statsToUse = proStats?.averageStats || averageStats;
        badgeText = 'Pro';
        popularSet = null;
    } else if (activeSource === 'pro_set1' && proStats?.setStats && proStats.setStats[0]) {
        statsToUse = proStats.setStats[0].stats;
        badgeText = `Pro ${proStats.setStats[0].percent}%`;
        popularSet = proStats.setStats[0].setName;
    } else if (activeSource === 'pro_set2' && proStats?.setStats && proStats.setStats[1]) {
        statsToUse = proStats.setStats[1].stats;
        badgeText = `Pro ${proStats.setStats[1].percent}%`;
        popularSet = proStats.setStats[1].setName;
    } else if (activeSource === 'pro_set3' && proStats?.setStats && proStats.setStats[2]) {
        statsToUse = proStats.setStats[2].stats;
        badgeText = `Pro ${proStats.setStats[2].percent}%`;
        popularSet = proStats.setStats[2].setName;
    }

    const stats = [
        Math.round(statsToUse.atk).toLocaleString(),
        Math.round(statsToUse.def).toLocaleString(),
        Math.round(statsToUse.hp).toLocaleString(),
        Math.round(statsToUse.spd),
        `${statsToUse.chc.toFixed(1)}%`,
        `${statsToUse.chd.toFixed(1)}%`,
        `${statsToUse.eff.toFixed(1)}%`,
        `${statsToUse.efr.toFixed(1)}%`,
    ];



    return (
        <div className="average-stats-values-only">
            {stats.map((val, index) => (
                <div key={index} className="stat-value-row">
                    {val}
                </div>
            ))}

            <div className="build-identifier-badge">
                <span className="badge-text">{badgeText}</span>
                {popularSet && (
                    <SetIconsGroup setName={popularSet} className="badge-set-icons" iconClassName="badge-set-icon" />
                )}
            </div>
        </div>
    );
};
