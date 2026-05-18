import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BuildAssist, ProcessedBuildData } from '../services/buildAssist';
import { HeroAnalysis, MetagameHero } from '../services/combatData';
import { AverageStatsColumn } from './AverageStatsColumn';
import { BuildStatsOverlay } from './BuildStatsOverlay';
import './OverlayView.css';

export interface Zone {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface DebugZone {
    zone: Zone;
    image_name: string;
    screen_name: string;
    confidence: number;
    threshold: number;
}

export interface FrameResult {
    screen_name: string | null;
    detections: any[];
    debug_zones: DebugZone[];
}

interface OverlayViewProps {
    frameResult: FrameResult | null;
    buildData: { heroName: string; data: ProcessedBuildData } | null;
    isFetchingBuild: boolean;
    activeBuildSource: 'avg' | 'set1' | 'set2' | 'set3' | 'pro' | 'pro_set1' | 'pro_set2' | 'pro_set3';
    combatAnalysis: HeroAnalysis | null;
    metagameHero: MetagameHero | null;
}

export const OverlayView: React.FC<OverlayViewProps> = ({
    frameResult,
    buildData,
    isFetchingBuild,
    activeBuildSource,
    combatAnalysis,
    metagameHero
}) => {
    const { t } = useTranslation();
    const [winSize, setWinSize] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const handleResize = () => {
            setWinSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

            const isSafeSize = winSize.width >= 960 && winSize.width <= 1030 && winSize.height >= 540 && winSize.height <= 598;

            return (
                <main className="overlay-view overlay-view-wrapper">
                    {frameResult?.screen_name === "Hero_Stats" && (
                        <>
                            {buildData && (
                                <div className="overlay-stats-column-container">
                                    <AverageStatsColumn
                                        buildData={buildData.data}
                                        activeSource={activeBuildSource}
                                    />
                                </div>
                            )}
                            <div className="overlay-stats-radar-container">
                                {isFetchingBuild ? (
                                    <div className="overlay-message-card">
                                        {(() => {
                                            const raw = frameResult?.detections?.find(d => d.slot_id === "selected_hero" && d.hero_name)?.hero_name;
                                            const hero = raw ? (BuildAssist.matchHeroName(raw) || raw) : "Hero";
                                            return t('overlay.loadingBuild', { hero });
                                        })()}
                                    </div>
                                ) : buildData ? (
                                    <BuildStatsOverlay
                                        buildData={buildData.data}
                                        activeSource={activeBuildSource}
                                        combatAnalysis={combatAnalysis}
                                        metagameHero={metagameHero}
                                    />
                                ) : (
                                    <div className="overlay-message-card">
                                        {(() => {
                                            const rawHeroName = frameResult?.detections?.find(d => d.slot_id === "selected_hero" && d.hero_name)?.hero_name;
                                            const heroName = rawHeroName ? BuildAssist.matchHeroName(rawHeroName) : null;
                                            return heroName ? (
                                                <>
                                                    {t('overlay.noCachedBuilds', { hero: heroName })}
                                                    <br />
                                                    <span className="overlay-message-fetch-prompt">
                                                        {t('overlay.fetchPrompt')}
                                                    </span>
                                                </>
                                            ) : (
                                                t('overlay.waitingForDetection')
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    {!isSafeSize && (
                        <div className="overlay-scale-indicator unsafe-scale">
                            <div className="warning-row">
                                <span className="warning-icon">⚠️</span>
                                <span className="warning-title">{t('overlay.resolutionWarningTitle')}</span>
                                <span className="current-scale-val">{winSize.width} × {winSize.height}</span>
                            </div>
                            <div className="resize-prompt">
                                {t('overlay.resolutionWarningMessage')}
                            </div>
                        </div>
                    )}
                    
                    <div className="overlay-watermark">
                        <img src="/app-icon.png" alt="e7Tracker" className="watermark-icon" />
                        <span className="watermark-text">e7Tracker</span>
                    </div>
                </main>
            );
        };
