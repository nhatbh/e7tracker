import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { ProcessedBuildData, ActiveBuildSource } from '../../../domain/models/BuildProfile';
import { HeroAnalysis } from '../../../domain/models/CombatAnalytics';
import { MetagameHero } from '../../../domain/models/MetagameData';
import { AverageStatsColumn } from './AverageStatsColumn';
import { BuildStatsOverlay } from './BuildStatsOverlay';
import { ScanStatusOverlay } from '../../ScanStatusOverlay';
import { useScreenDetection, useHeroService, useOCRService } from '../../../context';
import { useBuildProfileService } from '../../../context/BuildProfileServiceContext';
import { useCombatAnalyticsService } from '../../../context/CombatAnalyticsServiceContext';
import { useMetagameService } from '../../../context/MetagameServiceContext';
import { DetectionSlot, ScreenType } from '../../../domain/models/DetectionSchema';

interface HeroData {
    id: string;
    name: string;
    [key: string]: any;
}

export const HeroStatsOverlays: React.FC = () => {
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
    const currentScreen = screenDetection.getCurrentScreen?.() || ScreenType.Unknown;

    // ============================================================================
    // OCR SCANNING LOOP: Run every 1 second when on HeroStats screen
    // ============================================================================
    useEffect(() => {
        // Only run scanner when on HeroStats screen
        if (currentScreen !== ScreenType.HeroStats) {
            // Clean up interval if we leave the screen
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }

        // Prevent multiple instances of the interval
        if (intervalRef.current) {
            return;
        }

        const runOCRScan = async () => {
            try {
                setStatsOcrStatus('scanning');

                // Perform OCR on Selected Hero slot
                const heroName = await ocrService.performOCROnSlot(DetectionSlot.SelectedHero);

                if (heroName) {
                    setRawHeroName(heroName);

                    // Try to match against hero database
                    const matchedHeroName = heroService.matchHeroName(heroName);
                    if (matchedHeroName) {
                        // Set currentHero with matched data
                        setCurrentHero({
                            id: matchedHeroName.toLowerCase().replace(/\s+/g, '_'),
                            name: matchedHeroName
                        });
                        setStatsOcrStatus('success');
                    }
                }
            } catch (error) {
                invoke("log_frontend_info", { msg: `[HeroStatsOverlays] OCR scan error: ${error}` }).catch(() => { });
                setStatsOcrStatus('timeout');
            }
        };

        // Start the interval
        intervalRef.current = setInterval(runOCRScan, 1000);

        // Run once immediately
        runOCRScan();

        // Cleanup function
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [currentScreen]);

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

                invoke("log_frontend_info", { msg: `[HeroStatsOverlays] Successfully fetched data for hero: ${currentHero.name}` }).catch(() => { });
            } catch (error) {
                invoke("log_frontend_info", { msg: `[HeroStatsOverlays] Failed to fetch hero data: ${error}` }).catch(() => { });
            } finally {
                setIsFetchingBuild(false);
            }
        };

        fetchHeroData();
    }, [currentHero, buildProfileService, combatAnalyticsService, metagameService]);

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
                    const matchedHeroName = rawHeroName ? heroService.matchHeroName(rawHeroName) : null;
                    const displayHeroName = matchedHeroName || rawHeroName || "Hero";

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
                            {matchedHeroName
                                ? t('overlay.fetchPrompt', { hero: matchedHeroName })
                                : t('overlay.waitingForDetection')}
                        </div>
                    );
                })()}
            </div>
        </>
    );
};
