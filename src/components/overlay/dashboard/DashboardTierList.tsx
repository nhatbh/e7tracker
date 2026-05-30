import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'react-tooltip';
import { TierListHeroData } from '../../../domain/models/TierList';
import { useTierListService } from '../../../context/TierListServiceContext';
import { HeroMiniPortrait } from '../../HeroMiniPortrait';
import './DashboardTierList.css';

export const DashboardTierList: React.FC = () => {
    const { t } = useTranslation();
    const tierService = useTierListService();
    const [tierList, setTierList] = useState<TierListHeroData[]>([]);

    useEffect(() => {
        const load = async () => {
            const data = await tierService.getTierListData();
            setTierList(data);
        };
        load();

        tierService.onTierListUpdated(load);
    }, [tierService]);

    // Group by tier
    const tierGroups = useMemo(() => {
        const groups: Record<string, TierListHeroData[]> = {
            'OP': [],
            'S': [],
            'A': [],
            'B': [],
            'C': []
        };

        tierList.forEach(hero => {
            if (groups[hero.tier]) {
                groups[hero.tier].push(hero);
            }
        });

        // Sort each tier by score descending
        Object.keys(groups).forEach(tier => {
            groups[tier].sort((a, b) => b.score - a.score);
        });

        return groups;
    }, [tierList]);

    const uniqueTags = useMemo(() => {
        const tagMap = new Map();
        tierList.forEach(hero => {
            hero.tags.slice(0, 2).forEach(tag => {
                if (!tagMap.has(tag.nameKey)) {
                    tagMap.set(tag.nameKey, tag);
                }
            });
        });
        return Array.from(tagMap.values());
    }, [tierList]);

    const tierOrder = ['OP', 'S', 'A', 'B', 'C'];

    return (
        <div className="tier-list-container">
            {tierOrder.map(tier => {
                const tierColor = tier === 'OP' ? '#ff007f' :
                                  tier === 'S' ? '#ffae00' :
                                  tier === 'A' ? '#10b981' :
                                  tier === 'B' ? '#38bdf8' : '#94a3b8';
                return (
                    <div key={tier} className="tier-swimlane" style={{ borderColor: `${tierColor}60` }}>
                        <div className="tier-header" style={{ borderRightColor: `${tierColor}30` }}>
                            <span className="tier-label" style={{ color: tierColor }}>{tier}</span>
                            <span className="tier-count" style={{ color: `${tierColor}aa` }}>{tierGroups[tier].length}</span>
                        </div>
                        <div className="tier-heroes">
                            {tierGroups[tier].length === 0 ? (
                                <div className="tier-empty">No heroes in this tier</div>
                            ) : (
                                tierGroups[tier].map(hero => (
                                <div key={hero.heroName} className="hero-card" style={{ borderColor: hero.tierColor }}>
                                    <div className="hero-name-compact">{hero.heroName}</div>
                                    <div className="hero-card-main">
                                        <HeroMiniPortrait heroCode={hero.heroCode} size={40} />
                                        <div className="hero-stats-compact">
                                            <div className="stat-col">
                                                <span className="stat-lbl">WR</span>
                                                <span className="stat-val">{hero.winRate.toFixed(1)}%</span>
                                            </div>
                                            <div className="stat-col">
                                                <span className="stat-lbl">PR</span>
                                                <span className="stat-val">{hero.pickRate.toFixed(1)}%</span>
                                            </div>
                                            <div className="stat-col">
                                                <span className="stat-lbl">BR</span>
                                                <span className="stat-val">{hero.banRate.toFixed(1)}%</span>
                                            </div>
                                            <div className="stat-col">
                                                <span className="stat-lbl">POWER</span>
                                                <span className="power-score" style={{ color: hero.tierColor }}>{hero.score.toFixed(0)}</span>
                                            </div>
                                        </div>
                                        {hero.pickRate < 0.1 && (
                                            <div className="specialist-warning">⚠️</div>
                                        )}
                                    </div>
                                    {hero.tags.length > 0 && (
                                        <div className="hero-tags-compact">
                                            {hero.tags.slice(0, 2).map(tag => (
                                                <span key={tag.nameKey} id={`tag-trigger-${tag.nameKey.replace(/\./g, '-')}`} className="tag-badge" style={{ borderColor: `${tag.color}60`, color: tag.color, background: tag.bg }}>
                                                    <span className="tag-vibe">{t(tag.vibeKey)}</span>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                ))
                            )}
                        </div>
                    </div>
                );
            })}
            {/* Custom Tooltips for Tags - Render only unique tags */}
            {uniqueTags.map(tag => (
                <Tooltip
                    key={`tooltip-tier-${tag.nameKey}`}
                    anchorSelect={`#tag-trigger-${tag.nameKey.replace(/\./g, '-')}`}
                    place="bottom"
                    className="portal-floating-tooltip"
                    style={{ borderColor: `${tag.color}80`, zIndex: 999999999 }}
                    openOnClick={false}
                    delayShow={0}
                    delayHide={50}
                >
                    <div className="tooltip-vibe-header" style={{ color: tag.color }}>
                        {t(tag.vibeKey)}
                    </div>
                    <div className="tooltip-tag-name">
                        {t(tag.nameKey)}
                    </div>
                    <div className="tooltip-tag-desc">
                        {t(tag.descKey)}
                    </div>
                </Tooltip>
            ))}
        </div>
    );
};
