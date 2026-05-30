import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { ProcessedBuildData, ActiveBuildSource } from '../../../domain/models/BuildProfile';
import { HeroAnalysis } from '../../../domain/models/CombatAnalytics';
import { MetagameHero } from '../../../domain/models/MetagameData';
import { AverageStatsColumn } from './AverageStatsColumn';
import { BuildStatsOverlay } from './BuildStatsOverlay';
import { ScanStatusOverlay } from '../../ScanStatusOverlay';
import { useScreenDetection, useHeroService, useOCRService, useTickerService } from '../../../context';
import { useBuildProfileService } from '../../../context/BuildProfileServiceContext';
import { useCombatAnalyticsService } from '../../../context/CombatAnalyticsServiceContext';
import { useMetagameService } from '../../../context/MetagameServiceContext';
import { DetectionSlot, ScreenType } from '../../../domain/models/DetectionSchema';

interface HeroData {
    id: string;
    code: string;
    name: string;
    [key: string]: any;
}

interface HeroStatsOverlaysProps {
    onHeroChange?: (heroName: string | null) => void;
}

export const HeroStatsOverlays: React.FC<HeroStatsOverlaysProps> = ({ onHeroChange }) => {

    const [buildData, setBuildData] = useState<{ heroName: string; data: ProcessedBuildData } | null>(null);
    const [isFetchingBuild, setIsFetchingBuild] = useState(false);
    const [activeBuildSource, setActiveBuildSource] = useState<ActiveBuildSource>('avg');
    const [combatAnalysis, setCombatAnalysis] = useState<HeroAnalysis | null>(null);
    const [metagameHero, setMetagameHero] = useState<MetagameHero | null>(null);
    const [statsOcrStatus, setStatsOcrStatus] = useState<'idle' | 'scanning' | 'timeout' | 'success'>('idle');
    const [statsOcrCountdown, setStatsOcrCountdown] = useState(5);

    // OCR scanning state
    const [currentHero, setCurrentHero] = useState<HeroData | null>(null);
    const [rawHeroName, setRawHeroName] = useState<string | null>(null);
    const intervalRef = useRef<number | null>(null);

    const { t } = useTranslation();
    const screenDetection = useScreenDetection();
    const heroService = useHeroService();
    const ocrService = useOCRService();


    let tickerService;
    try {
        tickerService = useTickerService();
    } catch (error) {
        return <div>Error: TickerService not available</div>;
    }
    useEffect(() => {
        const taskId = 'hero-stats-ocr-scan';
        tickerService.registerTask({
            id: taskId,
            screenCondition: (screen) => screen === ScreenType.HeroStats,
            execute: async () => {
                try {
                    const heroName = await ocrService.performOCROnSlot(DetectionSlot.SelectedHero);

                    if (heroName) {
                        setRawHeroName(heroName);

                        // Try to match against hero database
                        const heroData = heroService.matchHeroName(heroName);

                        if (heroData) {
                            // Only update if the hero actually changed
                            setCurrentHero((prev: HeroData | null) => {
                                if (prev && prev.code === heroData.code) {
                                    return prev;
                                }
                                return {
                                    code: heroData.code,
                                    name: heroData.name,
                                    id: heroData.code
                                };
                            });
                        }
                    }
                } catch (error) {
                    invoke("log_frontend_info", { msg: `[HeroStatsOverlays] OCR scan error: ${error}` }).catch(() => { });
                }
            }
        });

        return () => {
            tickerService.unregisterTask(taskId);
        };
    }, [tickerService, ocrService, heroService]);

    // ============================================================================
    // DATA FETCHING: Fetch build, combat, and metagame data when hero changes
    // ============================================================================
    const buildProfileService = useBuildProfileService();
    const combatAnalyticsService = useCombatAnalyticsService();
    const metagameService = useMetagameService();

    useEffect(() => {
        if (!currentHero) {
            setBuildData(null);
            setCombatAnalysis(null);
            setMetagameHero(null);
            return;
        }

        const fetchHeroData = async () => {
            try {
                setIsFetchingBuild(true);

                // Fetch build data from service
                const buildResult = await buildProfileService.getProcessedBuildData(currentHero.name);
                if (buildResult) {
                    setBuildData({
                        heroName: currentHero.name,
                        data: buildResult
                    });
                }

                // Fetch combat analysis
                const combatResult = await combatAnalyticsService.getHeroAnalysis(currentHero.name);
                if (combatResult) {
                    setCombatAnalysis(combatResult);
                }

                // Fetch metagame data
                const metagameResult = await metagameService.getHeroMetagame(currentHero.name);
                if (metagameResult) {
                    setMetagameHero(metagameResult);
                }

            } catch (error) {
            } finally {
                setIsFetchingBuild(false);
            }
        };

        fetchHeroData();
        onHeroChange?.(currentHero.name);
    }, [currentHero, buildProfileService, combatAnalyticsService, metagameService, onHeroChange]);

    return (
        <>
            {buildData && (
                <>
                    <div className="overlay-scan-status-container">
                        <ScanStatusOverlay
                            status={statsOcrStatus}
                            countdown={statsOcrCountdown}
                        />
                    </div>
                    <div className="overlay-stats-column-container">
                        <AverageStatsColumn
                            buildData={buildData.data}
                            activeSource={activeBuildSource}
                        />
                    </div>
                </>
            )}
            <div className="overlay-stats-radar-container">
                {(() => {
                    // Extract hero name matching logic
                    const displayHeroName = currentHero?.name || "Hero";

                    // Render based on state
                    if (isFetchingBuild) {
                        return (
                            <div className="overlay-message-card">
                                {t('overlay.loadingBuild', { hero: displayHeroName })}
                            </div>
                        );
                    }

                    if (buildData) {
                        return (
                            <BuildStatsOverlay
                                buildData={buildData.data}
                                activeSource={activeBuildSource}
                                combatAnalysis={combatAnalysis}
                                metagameHero={metagameHero}
                            />
                        );
                    }

                    // Waiting for detection or data
                    return (
                        <div className="overlay-message-card">
                            {currentHero?.name
                                ? t('overlay.fetchPrompt', { hero: currentHero.name })
                                : t('overlay.waitingForDetection')}
                        </div>
                    );
                })()}
            </div>
        </>
    );
};
