import React, { useState, useEffect, useMemo } from 'react';
import { Tooltip } from 'react-tooltip';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import 'react-tooltip/dist/react-tooltip.css';
import { useBuildProfileService } from '../context/BuildProfileServiceContext';
import { useCombatAnalyticsService } from '../context/CombatAnalyticsServiceContext';
import { useMetagameService } from '../context/MetagameServiceContext';
import { useTierListService } from '../context/TierListServiceContext';
import { ProcessedBuildData } from '../domain/models/BuildProfile';
import { HeroAnalysis } from '../domain/models/CombatAnalytics';
import { MetagameHero } from '../domain/models/MetagameData';
import { TierListHeroData } from '../domain/models/TierList';
import { getDraftTags } from './dashboard/utils';
import { DamageCalculatorTab } from './damageCalc/DamageCalculatorTab';
import { DashboardCombatDetails } from './DashboardCombatDetails';
import { SavedBuildProfile } from '../services/damageCalc/profileCalc';
import './HeroDetailsView.css';
import { AnalyticsTab } from './dashboard/AnalyticsTab';

interface HeroDetailsViewProps {
    heroName: string;
    onClose: () => void;
    onHeroChange?: (newHeroName: string) => void;
    initialTab?: 'analytics' | 'combat' | 'calculator' | 'saved_builds' | 'compare';
    initialImportedProfile?: SavedBuildProfile | null;
}

export const HeroDetailsView: React.FC<HeroDetailsViewProps> = ({
    heroName,
    onClose,
    onHeroChange,
    initialTab = 'analytics',
    initialImportedProfile = null
}) => {
    const { t } = useTranslation();
    const buildProfileService = useBuildProfileService();
    const combatAnalyticsService = useCombatAnalyticsService();
    const metagameService = useMetagameService();
    const tierService = useTierListService();

    const [activeTab, setActiveTab] = useState<'analytics' | 'combat' | 'calculator' | 'saved_builds' | 'compare'>(initialTab);

    // Load preprocessed tier list data
    const [tierListData, setTierListData] = useState<TierListHeroData[]>([]);

    useEffect(() => {
        tierService.getTierListData().then(setTierListData);
    }, [tierService]);

    // Lookup cached tier data for this hero
    const heroTierInfo = useMemo(() => {
        return tierListData.find(h => h.heroName.toLowerCase() === heroName.toLowerCase()) || null;
    }, [tierListData, heroName]);

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

    // Combat States (Fetched from context)
    const [combatAnalysis, setCombatAnalysis] = useState<HeroAnalysis | null>(null);
    const [buildData, setBuildData] = useState<ProcessedBuildData | null>(null);
    const [metagameHero, setMetagameHero] = useState<MetagameHero | null>(null);

    // Fetch data from contexts when heroName changes
    useEffect(() => {
        let isMounted = true;

        const fetchData = async () => {
            try {
                const [bData, cAnalysis, mHero] = await Promise.all([
                    buildProfileService.getProcessedBuildData(heroName),
                    combatAnalyticsService.getHeroAnalysis(heroName),
                    metagameService.getHeroMetagame(heroName)
                ]);

                if (isMounted) {
                    setBuildData(bData);
                    setCombatAnalysis(cAnalysis);
                    setMetagameHero(mHero);
                }
            } catch (e) {
                console.error("[HeroDetailsView] Error fetching hero details from context services:", e);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [heroName, buildProfileService, combatAnalyticsService, metagameService]);

    // Portrait State
    const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
    const [isPortraitLoading, setIsPortraitLoading] = useState(false);

    // Aliases to maintain backward compatibility with existing component logic
    // (so we don't need to change hundreds of variable references)
    const localCombatAnalysis = combatAnalysis;
    const localBuildData = buildData;
    const localMetagameHero = metagameHero;

    // Compute draft tags in the parent to support absolute-bottom portal tooltips rendering
    const { tags, isSpecialistCapped } = useMemo(() => {
        if (heroTierInfo) {
            return { tags: heroTierInfo.tags, isSpecialistCapped: heroTierInfo.pickRate < 0.1 };
        }
        return getDraftTags(localCombatAnalysis, localMetagameHero, t);
    }, [localCombatAnalysis, localMetagameHero, heroTierInfo, t]);





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
                const meta = combatAnalyticsService.getMetadata();
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
    }, [heroName, localCombatAnalysis, combatAnalyticsService]);

    return (
        <div
            className="hero-details-container unified-dashboard"
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
            </div>

            {activeTab === 'analytics' ? (
                <AnalyticsTab
                    heroName={heroName}
                    localCombatAnalysis={localCombatAnalysis}
                    localMetagameHero={localMetagameHero}
                    portraitUrl={portraitUrl}
                    isPortraitLoading={isPortraitLoading}
                    tags={tags}
                    isSpecialistCapped={isSpecialistCapped}
                    localBuildData={localBuildData}
                    heroTierInfo={heroTierInfo}
                />
            ) : activeTab === 'combat' ? (
                <div className="dashboard-scrollable-content">
                    <DashboardCombatDetails
                        localCombatAnalysis={localCombatAnalysis}
                        heroName={heroName}
                    />
                </div>
            ) : (
                <div>
                    <DamageCalculatorTab
                        heroName={heroName}
                        buildData={localBuildData}
                        isHidingForOCR={isHidingForOCR}
                        setIsHidingForOCR={setIsHidingForOCR}
                        importedProfileData={importedProfileData}
                        onClearImportedProfile={() => setImportedProfileData(null)}
                    />
                </div>
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
