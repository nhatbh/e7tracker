import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';

import { FormDefaults, formatFormLabel, Artifacts, getHeroCalculatorKey, Heroes } from '../../services/damageCalc/damageService';
import { useBuildProfileService } from '../../context/BuildProfileServiceContext';
import { useDamageCalculatorService } from '../../context/DamageCalculatorContext';
import { SavedBuildProfile, calculateProfileDamage } from '../../services/damageCalc/profileCalc';
import { ProcessedBuildData } from '../../domain/models/BuildProfile';

import { CustomDialog } from './sandbox/CustomDialog';
import { CasterPresetsPopup } from './sandbox/CasterPresetsPopup';
import { TargetPresetsPopup } from './sandbox/TargetPresetsPopup';
import { SavedBuildsLibrary } from './sandbox/SavedBuildsLibrary';
import { ActiveCastersPane } from './sandbox/ActiveCastersPane';
import { TargetProfilePane } from './sandbox/TargetProfilePane';
import { ResultsComparisonPane } from './sandbox/ResultsComparisonPane';
import { SingleResultPane } from './sandbox/SingleResultPane';
import {
    TAB_COLORS,
    formatArtifactName,
    getArtifactIcon,
    getToggleIcon,
    getHeroElement,
    hasElementalAdvantage,
    getAdvantageousElement
} from './sandbox/sandboxUtils';

import './DamageCalculatorTab.css';

interface DamageCalculatorTabProps {
    heroName: string;
    buildData: ProcessedBuildData | null;
    isHidingForOCR: boolean;
    setIsHidingForOCR: (val: boolean) => void;
    importedProfileData?: SavedBuildProfile | null;
    onClearImportedProfile?: () => void;
}

export const DamageCalculatorTab: React.FC<DamageCalculatorTabProps> = ({
    heroName,
    buildData: initialBuildData,
    isHidingForOCR,
    setIsHidingForOCR,
    importedProfileData,
    onClearImportedProfile
}) => {
    const { t } = useTranslation();
    const buildProfileService = useBuildProfileService();
    const damageCalculatorService = useDamageCalculatorService();

    // ── STATE MANAGEMENT ──
    const [profiles, setProfiles] = useState<SavedBuildProfile[]>([]);
    const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);
    const [isLibraryCollapsed, setIsLibraryCollapsed] = useState(false);
    const [librarySearch, setLibrarySearch] = useState('');
    const [libraryFilter, setLibraryFilter] = useState<'current' | 'all'>('current');

    // Custom dialog modal state
    const [customDialog, setCustomDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'alert' | 'confirm';
        onConfirm?: () => void;
        onClose?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'alert'
    });

    const showCustomAlert = (message: string, title = 'System Notification') => {
        setCustomDialog({
            isOpen: true,
            title,
            message,
            type: 'alert'
        });
    };

    const showCustomConfirm = (message: string, onConfirm: () => void, title = 'Confirm Action') => {
        setCustomDialog({
            isOpen: true,
            title,
            message,
            type: 'confirm',
            onConfirm
        });
    };

    const handleCloseCustomDialog = (confirmed: boolean) => {
        const { onConfirm, onClose } = customDialog;
        setCustomDialog(prev => ({ ...prev, isOpen: false }));
        if (confirmed && onConfirm) {
            onConfirm();
        }
        if (onClose) {
            onClose();
        }
    };

    // Combat Sandbox states
    const [isLoading, setIsLoading] = useState(true);
    const [calcMode, setCalcMode] = useState<'single' | 'multi'>('single');
    const [activeCasters, setActiveCasters] = useState<SavedBuildProfile[]>([]);
    const [activeCasterId, setActiveCasterId] = useState<string>('');
    const [targetProfile, setTargetProfile] = useState<SavedBuildProfile>({
        id: 'target',
        heroName: '',
        profileName: 'Standard Target',
        savedAt: new Date().toISOString(),
        atk: 0,
        defense: 1300,
        hp: 15000,
        speed: 0,
        critDamage: 0,
        artifactId: 'noProc',
        artifactLevel: 30,
        molagoras1: 0,
        molagoras2: 0,
        molagoras3: 0,
        formState: { targetDefense: 1300, targetHP: 15000 }
    });

    // Presets modals triggers
    const [isCasterPresetOpen, setIsCasterPresetOpen] = useState(false);
    const [isTargetPresetOpen, setIsTargetPresetOpen] = useState(false);
    const [casterPresetHeroSearch, setCasterPresetHeroSearch] = useState('');
    const [selectedPresetHero, setSelectedPresetHero] = useState<string>('');
    const [presetHeroData, setPresetHeroData] = useState<ProcessedBuildData | null>(null);
    const [isPresetLoading, setIsPresetLoading] = useState(false);

    // Save active profile Modal state
    const [isOCRScanning, setIsOCRScanning] = useState(false);
    const [ocrStatus, setOcrStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
    const [ocrCountdown, setOcrCountdown] = useState(5);

    // Dropdown artifact options search
    const [artSearch, setArtSearch] = useState('');
    const [artDropdownOpen, setArtDropdownOpen] = useState(false);

    const [allHeroKeys, setAllHeroKeys] = useState<string[]>([]);

    // ── INITIAL LOAD & SYNC ──
    const loadSavedBuilds = async () => {
        try {
            const list = await damageCalculatorService.getProfilesByHero(heroName);
            setProfiles(list);
            return list;
        } catch (e) {
            console.error("Failed to load saved builds:", e);
            return [];
        }
    };

    // Combined Initial Load
    useEffect(() => {
        const initializeTab = async () => {
            setIsLoading(true);
            try {
                // 1. Load profiles and sandbox state in parallel
                const [profiles, cachedState] = await Promise.all([
                    damageCalculatorService.getProfilesByHero(heroName),
                    invoke<string | null>("cache_get", { key: `damage_calc_state_${heroName.toLowerCase()}` })
                ]);
                setProfiles(profiles);

                // 2. Load hero list
                const allProfiles = await buildProfileService.getAllProfiles();
                setAllHeroKeys(Array.from(new Set(allProfiles.map(p => p.heroName))));

                // 3. Process sandbox state
                if (cachedState) {
                    const parsed = JSON.parse(cachedState);
                    if (parsed.activeCasters && parsed.activeCasters.length > 0) {
                        setActiveCasters(parsed.activeCasters);
                        setActiveCasterId(parsed.activeCasterId || parsed.activeCasters[0].id);
                        if (parsed.targetProfile) setTargetProfile(parsed.targetProfile);
                        if (parsed.calcMode) setCalcMode(parsed.calcMode);
                        return; 
                    }
                }

                // 4. Default fallback
                const matches = profiles.filter(p => p.heroName.toLowerCase() === heroName.toLowerCase());
                if (matches.length > 0) {
                    setActiveCasters([matches[0]]);
                    setActiveCasterId(matches[0].id);
                } else {
                    const defaultCaster = createBlankProfile(heroName, 'Active Build');
                    setActiveCasters([defaultCaster]);
                    setActiveCasterId(defaultCaster.id);
                }
            } catch (err) {
                console.error("Failed to initialize sandbox tab:", err);
            } finally {
                setIsLoading(false);
            }
        };

        initializeTab();
    }, [heroName, damageCalculatorService, buildProfileService]);

    // Background State Persistence
    useEffect(() => {
        if (activeCasters.length === 0) return;
        const delayDebounce = setTimeout(() => {
            const statePayload = {
                activeCasters,
                activeCasterId,
                targetProfile,
                calcMode
            };
            invoke("cache_set", {
                key: `damage_calc_state_${heroName.toLowerCase()}`,
                value: JSON.stringify(statePayload)
            }).catch(e => console.error("Failed to persist sandbox state:", e));
        }, 500);

        return () => clearTimeout(delayDebounce);
    }, [activeCasters, activeCasterId, targetProfile, calcMode, heroName]);

    // Handle importing profiles from Saved Builds tab directly
    useEffect(() => {
        if (importedProfileData) {
            // Check if already in activeCasters
            const exists = activeCasters.find(c => c.id === importedProfileData.id);
            if (exists) {
                setActiveCasterId(importedProfileData.id);
            } else {
                setActiveCasters(prev => [...prev, importedProfileData]);
                setActiveCasterId(importedProfileData.id);
            }
            onClearImportedProfile?.();
        }
    }, [importedProfileData]);

    // Helper to generate blank SavedBuildProfile
    const createBlankProfile = (hero: string, name: string): SavedBuildProfile => {
        const heroKey = getHeroCalculatorKey(hero);
        const heroData = Heroes[heroKey] || Heroes.abigail;
        return {
            id: 'caster_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            heroName: hero,
            profileName: name,
            savedAt: new Date().toISOString(),
            atk: 3000,
            defense: 1000,
            hp: 10000,
            speed: 200,
            critDamage: 250,
            artifactId: 'noProc',
            artifactLevel: 30,
            molagoras1: 5,
            molagoras2: 5,
            molagoras3: 5,
            formState: {
                atk: 3000,
                defense: 1000,
                hp: 10000,
                speed: 200,
                critDamage: 250,
                molagoras1: 5,
                molagoras2: 5,
                molagoras3: 5,
                rageSet: false,
                penetrationSet: false,
                torrentSetStack: 0,
                pursuitSet: false
            }
        };
    };

    // Unsaved profile modifications tracking
    const unsavedCasterIds = useMemo(() => {
        const unsaved = new Set<string>();
        activeCasters.forEach(caster => {
            const original = profiles.find(p => p.id === caster.id);
            if (!original) {
                unsaved.add(caster.id);
                return;
            }
            const diff =
                original.atk !== caster.atk ||
                original.defense !== caster.defense ||
                original.hp !== caster.hp ||
                original.speed !== caster.speed ||
                original.critDamage !== caster.critDamage ||
                original.artifactId !== caster.artifactId ||
                original.artifactLevel !== caster.artifactLevel ||
                original.molagoras1 !== caster.molagoras1 ||
                original.molagoras2 !== caster.molagoras2 ||
                original.molagoras3 !== caster.molagoras3 ||
                JSON.stringify(original.formState || {}) !== JSON.stringify(caster.formState || {});

            if (diff) {
                unsaved.add(caster.id);
            }
        });
        return unsaved;
    }, [activeCasters, profiles]);

    // Active Caster profile select
    const activeCaster = useMemo(() => {
        return activeCasters.find(c => c.id === activeCasterId) || activeCasters[0] || null;
    }, [activeCasters, activeCasterId]);

    // Update field values on active caster
    const updateActiveCasterField = (field: keyof SavedBuildProfile, val: any) => {
        if (!activeCaster) return;
        setActiveCasters(prev => prev.map(c => {
            if (c.id === activeCaster.id) {
                const updated = { ...c, [field]: val };
                updated.formState = {
                    ...(updated.formState || {}),
                    [field]: val
                };
                return updated;
            }
            return c;
        }));
    };

    // Update nested formState values on active caster
    const updateActiveCasterFormState = (key: string, val: any) => {
        if (!activeCaster) return;
        setActiveCasters(prev => prev.map(c => {
            if (c.id === activeCaster.id) {
                return {
                    ...c,
                    formState: {
                        ...(c.formState || {}),
                        [key]: val
                    }
                };
            }
            return c;
        }));
    };

    // Update field values on active target
    const updateTargetField = (field: keyof SavedBuildProfile, val: any) => {
        setTargetProfile(prev => {
            const updated = { ...prev, [field]: val };
            updated.formState = {
                ...(updated.formState || {}),
                [field]: val
            };
            if (field === 'hp') {
                updated.formState.targetHP = Number(val);
                updated.formState.targetMaxHP = Number(val);
                updated.formState.targetCurrentHP = Number(val);
            }
            if (field === 'defense') {
                updated.formState.targetDefense = Number(val);
            }
            return updated;
        });
    };

    const updateTargetFormState = (key: string, val: any) => {
        setTargetProfile(prev => ({
            ...prev,
            formState: {
                ...(prev.formState || {}),
                [key]: val
            }
        }));
    };

    // ── CALCULATION ENGINE COUPLING ──
    const calculationsData = useMemo(() => {
        return activeCasters.map(caster => {
            try {
                const casterElement = getHeroElement(caster.heroName);
                const targetElement = getHeroElement(targetProfile.heroName);
                const isAdvantage = hasElementalAdvantage(casterElement, targetElement);

                const mergedCasterForm = {
                    ...(caster.formState || {}),
                    // Auto-populated stats fallbacks
                    casterMaxHP: caster.formState?.casterMaxHP !== undefined ? caster.formState.casterMaxHP : caster.hp,
                    casterMaxHp: caster.formState?.casterMaxHp !== undefined ? caster.formState.casterMaxHp : caster.hp,
                    casterDefense: caster.formState?.casterDefense !== undefined ? caster.formState.casterDefense : caster.defense,
                    casterDef: caster.formState?.casterDef !== undefined ? caster.formState.casterDef : caster.defense,
                    casterSpeed: caster.formState?.casterSpeed !== undefined ? caster.formState.casterSpeed : caster.speed,
                    casterAtk: caster.formState?.casterAtk !== undefined ? caster.formState.casterAtk : caster.atk,
                    casterAttack: caster.formState?.casterAttack !== undefined ? caster.formState.casterAttack : caster.atk,

                    targetMaxHP: caster.formState?.targetMaxHP !== undefined ? caster.formState.targetMaxHP : targetProfile.hp,
                    targetMaxHp: caster.formState?.targetMaxHp !== undefined ? caster.formState.targetMaxHp : targetProfile.hp,
                    enemyMaxHP: caster.formState?.enemyMaxHP !== undefined ? caster.formState.enemyMaxHP : targetProfile.hp,
                    enemyMaxHp: caster.formState?.enemyMaxHp !== undefined ? caster.formState.enemyMaxHp : targetProfile.hp,
                    targetDefense: caster.formState?.targetDefense !== undefined ? caster.formState.targetDefense : targetProfile.defense,
                    targetSpeed: caster.formState?.targetSpeed !== undefined ? caster.formState.targetSpeed : targetProfile.speed,
                    targetAtk: caster.formState?.targetAtk !== undefined ? caster.formState.targetAtk : (targetProfile.atk || 0),
                    targetAttack: caster.formState?.targetAttack !== undefined ? caster.formState.targetAttack : (targetProfile.atk || 0),

                    rageSet: !!caster.formState?.rageSet,
                    penetrationSet: !!caster.formState?.penetrationSet,
                    torrentSetStack: Number(caster.formState?.torrentSetStack || 0),
                    pursuitSet: !!caster.formState?.pursuitSet,
                    elementalAdvantage: isAdvantage ? true : !!caster.formState?.elementalAdvantage,
                };

                const mergedOverrideForm: Record<string, any> = {};
                if (targetProfile.formState) {
                    Object.keys(targetProfile.formState).forEach(key => {
                        if (key.startsWith('target') || key === 'enemyNumberOfDebuffs') {
                            mergedOverrideForm[key] = targetProfile.formState[key];
                        }
                    });
                }

                const output = calculateProfileDamage(
                    { ...caster, formState: mergedCasterForm },
                    targetProfile.hp,
                    targetProfile.defense,
                    mergedOverrideForm
                );
                return {
                    caster,
                    output
                };
            } catch (err: any) {
                console.error("Calculation failed for", caster.heroName, err);
                return {
                    caster,
                    output: { damages: [], barriers: [] },
                    error: err?.message || String(err)
                };
            }
        });
    }, [activeCasters, targetProfile]);

    // Bulk load casters from library
    const handleAddCastersFromLibrary = () => {
        const selected = profiles.filter(p => selectedLibraryIds.includes(p.id));
        if (selected.length === 0) return;

        if (calcMode === 'single') {
            const soleCaster = selected[0];
            setActiveCasters([soleCaster]);
            setActiveCasterId(soleCaster.id);
            setSelectedLibraryIds([]);
            return;
        }

        setActiveCasters(prev => {
            const list = [...prev];
            selected.forEach(p => {
                if (!list.find(x => x.id === p.id)) {
                    list.push(p);
                }
            });
            return list;
        });
        setActiveCasterId(selected[selected.length - 1].id);
        setSelectedLibraryIds([]);
    };

    // Set Target profile from library
    const handleAddTargetFromLibrary = () => {
        const selected = profiles.filter(p => selectedLibraryIds.includes(p.id));
        if (selected.length === 0) return;
        setTargetProfile(selected[0]);
        setSelectedLibraryIds([]);
    };

    // Preset list hero selection resolver
    const handleHeroPresetSelect = async (hero: string) => {
        setSelectedPresetHero(hero);
        setIsPresetLoading(true);
        try {
            const build = await buildProfileService.getProcessedBuildData(hero);
            setPresetHeroData(build);
        } catch (e) {
            console.error("Failed to load preset build info:", e);
            setPresetHeroData(null);
        } finally {
            setIsPresetLoading(false);
        }
    };

    // Presets application resolver
    const handleApplyCasterPreset = (presetName: string, stats: any, gearSets?: string[]) => {
        try {
            const blank = createBlankProfile(selectedPresetHero, `${selectedPresetHero} ${presetName}`);

            const finalForm = {
                ...blank.formState,
                atk: stats.atk,
                defense: stats.def || stats.defense,
                hp: stats.hp,
                speed: stats.speed || stats.spd,
                critDamage: stats.chd || stats.critDamage || 250,
                rageSet: gearSets?.some(s => s.toLowerCase().includes('rage')) || false,
                penetrationSet: gearSets?.some(s => s.toLowerCase().includes('penetration')) || false,
                torrentSetStack: gearSets?.some(s => s.toLowerCase().includes('torrent')) ? 1 : 0,
                pursuitSet: gearSets?.some(s => s.toLowerCase().includes('pursuit') || s.toLowerCase().includes('chase')) || false
            };

            const newProfile: SavedBuildProfile = {
                ...blank,
                atk: stats.atk,
                defense: stats.def || stats.defense,
                hp: stats.hp,
                speed: stats.speed || stats.spd,
                critDamage: stats.chd || stats.critDamage || 250,
                formState: finalForm
            };

            if (calcMode === 'single') {
                setActiveCasters([newProfile]);
            } else {
                setActiveCasters(prev => [...prev, newProfile]);
            }
            setActiveCasterId(newProfile.id);
        } catch (e) {
            console.error("Failed to apply & save preset build:", e);
        }

        // Close presets panel
        setIsCasterPresetOpen(false);
        setSelectedPresetHero('');
        setPresetHeroData(null);
    };

    // Target Preset selection resolver
    const handleApplyTargetPreset = (name: string, def: number, hp: number) => {
        const dummy: SavedBuildProfile = {
            id: 'target',
            heroName: '',
            profileName: name,
            savedAt: new Date().toISOString(),
            atk: 0,
            defense: def,
            hp: hp,
            speed: 0,
            critDamage: 0,
            artifactId: 'noProc',
            artifactLevel: 30,
            molagoras1: 0,
            molagoras2: 0,
            molagoras3: 0,
            formState: { targetDefense: def, targetHP: hp }
        };
        setTargetProfile(dummy);
        setIsTargetPresetOpen(false);
    };

    // Quick Save Caster Tab
    const handleSaveCasterTab = async (caster: SavedBuildProfile) => {
        try {
            let profileToSave = { ...caster };
            if (caster.id.startsWith('caster_') || caster.id.startsWith('preset_')) {
                const finalId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
                profileToSave.id = finalId;
                profileToSave.savedAt = new Date().toISOString();

                setActiveCasters(prev => prev.map(c => c.id === caster.id ? profileToSave : c));
                setActiveCasterId(finalId);
            }

            await damageCalculatorService.saveProfile(profileToSave);
            
            // Reload profiles
            const list = await damageCalculatorService.getProfilesByHero(heroName);
            setProfiles(list);

            showCustomAlert(`Saved Build "${profileToSave.profileName}" successfully!`, 'Success');
        } catch (e) {
            console.error("Failed to save caster build:", e);
        }
    };

    // Quick Save Target Tab
    const handleSaveTargetTab = async () => {
        if (!targetProfile || targetProfile.id === 'target') return;
        try {
            await damageCalculatorService.saveProfile(targetProfile);
            
            // Reload profiles
            const list = await damageCalculatorService.getProfilesByHero(heroName);
            setProfiles(list);
            
            showCustomAlert(`Saved Target "${targetProfile.profileName}" successfully!`, 'Success');
        } catch (e) {
            console.error("Failed to save target build:", e);
        }
    };

    // Close caster tab in workspace
    const handleCloseCasterTab = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeCasters.length <= 1) {
            showCustomAlert("At least one active caster build tab must remain in the sandbox.", "Action Blocked");
            return;
        }
        const filtered = activeCasters.filter(c => c.id !== id);
        setActiveCasters(filtered);
        if (activeCasterId === id) {
            setActiveCasterId(filtered[filtered.length - 1].id);
        }
    };

    // Bulk delete build profiles
    const handleDeleteLibraryProfiles = async () => {
        if (selectedLibraryIds.length === 0) return;
        
        showCustomConfirm(
            `Are you sure you want to delete the ${selectedLibraryIds.length} selected build profiles?`,
            async () => {
                try {
                    for (const id of selectedLibraryIds) {
                        await damageCalculatorService.deleteProfile(id);
                    }

                    // Reload profiles
                    const list = await damageCalculatorService.getProfilesByHero(heroName);
                    setProfiles(list);
                    
                    setActiveCasters(prev => prev.filter(c => !selectedLibraryIds.includes(c.id)));
                    setSelectedLibraryIds([]);
                } catch (e) {
                    console.error("Failed to delete library profiles:", e);
                }
            },
            "Delete Saved Profiles"
        );
    };

    // OCR Integration
    const startStatsOCR = async () => {
        if (isOCRScanning || !activeCaster) return;

        setIsOCRScanning(true);
        setOcrStatus('scanning');
        setOcrCountdown(5);
        setIsHidingForOCR(true);
        window.dispatchEvent(new CustomEvent("ocr-state-change", { detail: { active: true } }));

        try {
            await getCurrentWindow().setIgnoreCursorEvents(true);
            await invoke("set_overlay_mode", { mode: "Display" });
            await invoke("log_frontend_info", { msg: "[OCR Stats] Started sandbox stat scanning." });
        } catch (e) {
            console.error(e);
        }

        let scanTimer: any;
        let countdownInterval: any;
        let resolved = false;

        countdownInterval = setInterval(() => {
            setOcrCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownInterval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        const unlistenPromise = listen<any>("detection-result", async (event) => {
            if (resolved) return;

            const frameResult = event.payload;
            if (frameResult?.screen_name === "Hero_Stats") {
                const statsSlot = frameResult.detections?.find((d: any) => d.slot_id === "hero_stats_panel");
                if (statsSlot && statsSlot.hero_name) {
                    const parsed = parseOCRStats(statsSlot.hero_name);
                    if (parsed) {
                        resolved = true;
                        clearTimeout(scanTimer);
                        clearInterval(countdownInterval);

                        updateActiveCasterField('atk', parsed.atk);
                        updateActiveCasterField('defense', parsed.defense);
                        updateActiveCasterField('hp', parsed.hp);
                        updateActiveCasterField('speed', parsed.speed);
                        updateActiveCasterField('critDamage', parsed.chd);

                        try {
                            await invoke("cache_set", {
                                key: `hero_captured_stats_${activeCaster.heroName}`,
                                value: JSON.stringify(parsed)
                            });
                        } catch (err) {}

                        setOcrStatus('success');
                        setIsOCRScanning(false);
                        setIsHidingForOCR(false);
                        window.dispatchEvent(new CustomEvent("ocr-state-change", { detail: { active: false } }));
                        try {
                            await getCurrentWindow().setIgnoreCursorEvents(false);
                            await invoke("set_overlay_mode", { mode: "HeroDetails" });
                        } catch (e) { }

                        const unsub = await unlistenPromise;
                        unsub();

                        setTimeout(() => {
                            setOcrStatus('idle');
                        }, 2500);
                    }
                }
            }
        });

        scanTimer = setTimeout(async () => {
            if (!resolved) {
                resolved = true;
                clearInterval(countdownInterval);
                setOcrStatus('failed');
                setIsOCRScanning(false);
                setIsHidingForOCR(false);
                window.dispatchEvent(new CustomEvent("ocr-state-change", { detail: { active: false } }));

                try {
                    await getCurrentWindow().setIgnoreCursorEvents(false);
                    await invoke("set_overlay_mode", { mode: "HeroDetails" });
                } catch (e) { }

                const unsub = await unlistenPromise;
                unsub();

                setTimeout(() => {
                    setOcrStatus('idle');
                }, 2500);
            }
        }, 5000);
    };

    const parseOCRStats = (text: string) => {
        const tokens = text.split(/\s+/).filter(token => /\d/.test(token));
        if (tokens.length < 8) return null;

        const parseInteger = (token: string) => {
            const cleaned = token.replace(/\D/g, '');
            const val = parseInt(cleaned, 10);
            return isNaN(val) ? null : val;
        };

        const parsePercentage = (token: string, maxVal: number) => {
            let cleaned = token.toLowerCase().replace(/%/g, '').replace(/o/g, '').replace(/w/g, '');
            const val = parseFloat(cleaned);
            if (!isNaN(val) && val <= maxVal) return val;
            return null;
        };

        const atk = parseInteger(tokens[0]);
        const defense = parseInteger(tokens[1]);
        const hp = parseInteger(tokens[2]);
        const speed = parseInteger(tokens[3]);
        const chc = parsePercentage(tokens[4], 100.0);
        const chd = parsePercentage(tokens[5], 999.0);
        const eff = parsePercentage(tokens[6], 999.0);
        const efr = parsePercentage(tokens[7], 999.0);

        if (atk === null || defense === null || hp === null || speed === null) return null;
        return { atk, defense, hp, speed, chc, chd: chd || 250, eff: eff || 0, efr: efr || 0 };
    };

    // ── DYNAMIC INPUT FIELDS CONFIG ──
    const activeHeroKey = useMemo(() => activeCaster ? getHeroCalculatorKey(activeCaster.heroName) : 'abigail', [activeCaster]);
    const activeHero = useMemo(() => Heroes[activeHeroKey] || Heroes.abigail, [activeHeroKey]);
    const activeHeroElement = activeHero?.element;

    const dynamicInputs = useMemo(() => {
        let booleans: string[] = [];
        let numbers: string[] = [];

        if (activeHero && activeHero.heroSpecific) {
            for (const key of activeHero.heroSpecific) {
                const def = FormDefaults[key];
                if (def && (def.default !== undefined || typeof def.defaultValue === 'boolean')) {
                    booleans.push(key);
                } else {
                    numbers.push(key);
                }
            }
        }

        const artifact = Artifacts[activeCaster?.artifactId || 'noProc'];
        if (artifact && artifact.artifactSpecific) {
            for (const key of artifact.artifactSpecific) {
                const def = FormDefaults[key];
                if (def && (def.default !== undefined || typeof def.defaultValue === 'boolean')) {
                    booleans.push(key);
                } else {
                    numbers.push(key);
                }
            }
        }

        return { booleans: [...new Set(booleans)], numbers: [...new Set(numbers)] };
    }, [activeHero, activeCaster?.artifactId]);

    // Filtered artifact list for search
    const filteredArtifacts = useMemo(() => {
        const query = artSearch.toLowerCase();
        return Object.keys(Artifacts).filter(id => {
            if (id === 'noProc') return true;
            const formatted = formatArtifactName(id).toLowerCase();
            return id.toLowerCase().includes(query) || formatted.includes(query);
        });
    }, [artSearch]);

    // Library filtering logic
    const filteredLibraryProfiles = useMemo(() => {
        let list = profiles;
        if (libraryFilter === 'current') {
            list = list.filter(p => p.heroName.toLowerCase() === heroName.toLowerCase());
        }
        if (librarySearch.trim()) {
            const q = librarySearch.toLowerCase();
            list = list.filter(p =>
                p.profileName.toLowerCase().includes(q) ||
                p.heroName.toLowerCase().includes(q)
            );
        }
        return [...list].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    }, [profiles, libraryFilter, librarySearch, heroName]);

    // Active sets resolved in tab config
    const getSetsFromForm = (form: Record<string, any> = {}) => {
        const list: string[] = [];
        if (form.rageSet) list.push('setrage');
        if (form.penetrationSet) list.push('setpenetration');
        if (form.torrentSetStack > 0) list.push('settorrent');
        if (form.pursuitSet) list.push('set_chase');
        return list;
    };

    // Buff / debuff diagnostic filters
    const filterCasterToggles = (form: Record<string, any> = {}) => {
        const casterKeys = ['attackUp', 'attackUpGreat', 'casterSpeedUp', 'casterVigor', 'casterEnraged', 'increasedCritDamage', 'casterPerception', 'casterRampage', 'casterHasCascade', 'casterHasAbundance', 'casterHasChallenge', 'casterHasExplosives', 'casterHasSpecialFriendship', 'elementalAdvantage'];
        return casterKeys.filter(k => !!form[k]);
    };

    // S1, S2, S3 enhancements Max resolver
    const getEnhanceMax = (hero: any, skillId: string): number => {
        if (!hero || !hero.skills) return 5;
        const skill = hero.skills[skillId];
        if (!skill) return 0;
        if (skill.enhance && skill.enhance.length > 0) return skill.enhance.length;
        if (skill.enhanceFrom && hero.skills[skill.enhanceFrom]) {
            const parent = hero.skills[skill.enhanceFrom];
            if (parent && parent.enhance) return parent.enhance.length;
        }
        return skill.id ? 5 : 0;
    };

    // Find skill damage row by prefix and soulburn status
    const findSkillDamage = (damages: Array<{ skill: string; crit: number | null; normal: number | null }>, skillId: string, soulburn = false) => {
        if (!damages) return undefined;
        return damages.find(d => {
            const baseSkill = d.skill.replace(/_soulburn|_burn|\ssoulburn/gi, '').toLowerCase();
            const isSb = d.skill.toLowerCase().endsWith('_soulburn') || d.skill.toLowerCase().endsWith('_burn') || d.skill.toLowerCase().endsWith(' soulburn');
            if (soulburn !== isSb) return false;
            return baseSkill === skillId.toLowerCase();
        });
    };

    // Unique calculated active skills list
    const uniqueSkills = useMemo(() => {
        const skillsSet = new Set<string>();
        calculationsData.forEach(({ output }) => {
            if (output && output.damages) {
                output.damages.forEach(d => {
                    const baseSkill = d.skill.replace(/_soulburn|_burn|\ssoulburn/gi, '');
                    skillsSet.add(baseSkill);
                });
            }
        });

        return Array.from(skillsSet).sort((a, b) => {
            const getPriority = (x: string) => {
                if (x === 's1') return 1;
                if (x === 's2') return 2;
                if (x === 's3') return 3;
                if (x.startsWith('s1_')) return 4;
                if (x.startsWith('s2_')) return 5;
                if (x.startsWith('s3_')) return 6;
                return 7;
            };
            const pA = getPriority(a);
            const pB = getPriority(b);
            if (pA !== pB) return pA - pB;
            return a.localeCompare(b);
        });
    }, [calculationsData]);

    const formatSkillHeader = (skillId: string): string => {
        const upper = skillId.toUpperCase();
        return upper
            .replace('_EXTRA', ' (Extra)')
            .replace('_COUNTER', ' (Counter)')
            .replace('_BURST', ' (Burst)')
            .replace('_ADDITIONAL', ' (Additional)')
            .replace('_FOLLOWUP', ' (Follow-up)');
    };

    // Chart data mapping grouped by damage type instead of heroes
    const chartData = useMemo(() => {
        const categories: Array<{ name: string; key: string; isSoulburn: boolean }> = [];
        
        uniqueSkills.forEach(skillId => {
            categories.push({
                name: formatSkillHeader(skillId),
                key: skillId,
                isSoulburn: false
            });
            
            const hasSb = calculationsData.some(({ output }) => {
                const sbRow = findSkillDamage(output.damages, skillId, true);
                const sbVal = sbRow?.crit || sbRow?.normal || 0;
                return sbVal > 0;
            });
            
            if (hasSb) {
                categories.push({
                    name: `${formatSkillHeader(skillId)} SB`,
                    key: skillId,
                    isSoulburn: true
                });
            }
        });
        
        return categories.map(cat => {
            const item: Record<string, any> = { name: cat.name };
            calculationsData.forEach(({ caster, output }) => {
                const keyName = `${caster.heroName} (${caster.profileName})`;
                const row = findSkillDamage(output.damages, cat.key, cat.isSoulburn);
                item[keyName] = row?.crit || row?.normal || 0;
            });
            return item;
        });
    }, [calculationsData, uniqueSkills]);

    const handleModeSwitch = (mode: 'single' | 'multi') => {
        setCalcMode(mode);
        if (mode === 'single' && activeCasters.length > 1) {
            const current = activeCasters.find(c => c.id === activeCasterId) || activeCasters[0];
            setActiveCasters([current]);
            setActiveCasterId(current.id);
        }
    };

    // Preset list hero filtering
    const filteredPresetHeroes = useMemo(() => {
        if (!casterPresetHeroSearch.trim()) return allHeroKeys;
        const q = casterPresetHeroSearch.toLowerCase();
        return allHeroKeys.filter(h => h.toLowerCase().includes(q));
    }, [allHeroKeys, casterPresetHeroSearch]);

    return (
        <div className="damage-calc-tab-container comparative-sandbox-vibe">

            {/* Segmented Mode Switcher Button Set */}
            <div className="sandbox-mode-switcher-container">
                <div className="sandbox-mode-switcher">
                    <button
                        className={`mode-btn ${calcMode === 'single' ? 'active' : ''}`}
                        onClick={() => handleModeSwitch('single')}
                    >
                        Single Caster
                    </button>
                    <button
                        className={`mode-btn ${calcMode === 'multi' ? 'active' : ''}`}
                        onClick={() => handleModeSwitch('multi')}
                    >
                        Comparative Workspace
                    </button>
                </div>
            </div>

            {/* ── BLOCK 1: COLLAPSIBLE BUILD LIBRARY ── */}
            <SavedBuildsLibrary
                isLibraryCollapsed={isLibraryCollapsed}
                setIsLibraryCollapsed={setIsLibraryCollapsed}
                profiles={profiles}
                librarySearch={librarySearch}
                setLibrarySearch={setLibrarySearch}
                libraryFilter={libraryFilter}
                setLibraryFilter={setLibraryFilter}
                heroName={heroName}
                selectedLibraryIds={selectedLibraryIds}
                setSelectedLibraryIds={setSelectedLibraryIds}
                handleAddCastersFromLibrary={handleAddCastersFromLibrary}
                handleAddTargetFromLibrary={handleAddTargetFromLibrary}
                handleDeleteLibraryProfiles={handleDeleteLibraryProfiles}
                setIsCasterPresetOpen={setIsCasterPresetOpen}
                setIsTargetPresetOpen={setIsTargetPresetOpen}
                filteredLibraryProfiles={filteredLibraryProfiles}
                getSetsFromForm={getSetsFromForm}
                filterCasterToggles={filterCasterToggles}
                getArtifactIcon={getArtifactIcon}
                getToggleIcon={getToggleIcon}
                getAdvantageousElement={getAdvantageousElement}
                getHeroElement={getHeroElement}
                calcMode={calcMode}
            />

            {/* Calculation Error Banner (if calculations crash internally) */}
            {(() => {
                const errorItem = calculationsData.find(d => d.error);
                if (!errorItem) return null;
                return (
                    <div className="sandbox-calc-error-banner" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '12px 16px', margin: '15px 0', color: '#f87171', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                        <strong>⚠️ Calculation Error for {errorItem.caster.heroName}:</strong><br />
                        {errorItem.error}
                    </div>
                );
            })()}

            {/* ── BLOCK 2: SPLIT COMBAT WORKSPACE (3/4 and 1/4 split) ── */}
            <div className="combat-sandbox-workspace">

                {/* Left 3/4 Pane: Caster workspace tabs */}
                <ActiveCastersPane
                    activeCasters={activeCasters}
                    activeCasterId={activeCasterId}
                    setActiveCasterId={setActiveCasterId}
                    unsavedCasterIds={unsavedCasterIds}
                    TAB_COLORS={TAB_COLORS}
                    handleCloseCasterTab={handleCloseCasterTab}
                    createBlankProfile={createBlankProfile}
                    heroName={heroName}
                    setActiveCasters={setActiveCasters}
                    activeCaster={activeCaster || undefined}
                    updateActiveCasterField={updateActiveCasterField}
                    ocrStatus={ocrStatus}
                    isOCRScanning={isOCRScanning}
                    ocrCountdown={ocrCountdown}
                    startStatsOCR={startStatsOCR}
                    handleSaveCasterTab={handleSaveCasterTab}
                    updateActiveCasterFormState={updateActiveCasterFormState}
                    getArtifactIcon={getArtifactIcon}
                    formatArtifactName={formatArtifactName}
                    artDropdownOpen={artDropdownOpen}
                    setArtDropdownOpen={setArtDropdownOpen}
                    artSearch={artSearch}
                    setArtSearch={setArtSearch}
                    filteredArtifacts={filteredArtifacts}
                    activeHeroElement={activeHeroElement}
                    targetProfile={targetProfile}
                    getHeroElement={getHeroElement}
                    hasElementalAdvantage={hasElementalAdvantage}
                    getToggleIcon={getToggleIcon}
                    getAdvantageousElement={getAdvantageousElement}
                    getEnhanceMax={getEnhanceMax}
                    activeHero={activeHero}
                    dynamicInputs={dynamicInputs}
                    formatFormLabel={formatFormLabel}
                    FormDefaults={FormDefaults}
                    calcMode={calcMode}
                />

                {/* Right 1/4 Pane: Static Defensive Target column */}
                <TargetProfilePane
                    targetProfile={targetProfile}
                    handleSaveTargetTab={handleSaveTargetTab}
                    updateTargetField={updateTargetField}
                    updateTargetFormState={updateTargetFormState}
                    getToggleIcon={getToggleIcon}
                />

            </div>

            {/* ── BLOCK 3: RESULTS VISUALIZATION COMPARISON (Analytics Table + Performance Chart) ── */}
            {calcMode === 'single' ? (
                activeCaster && calculationsData[0] && (
                    <SingleResultPane
                        activeCaster={activeCasters.find(c => c.id === activeCasterId) || activeCasters[0] || activeCaster}
                        output={calculationsData.find(d => d.caster.id === (activeCasterId || activeCasters[0]?.id))?.output || calculationsData[0]?.output}
                        uniqueSkills={uniqueSkills}
                        formatSkillHeader={formatSkillHeader}
                        findSkillDamage={findSkillDamage}
                    />
                )
            ) : (
                <ResultsComparisonPane
                    calculationsData={calculationsData}
                    uniqueSkills={uniqueSkills}
                    formatSkillHeader={formatSkillHeader}
                    findSkillDamage={findSkillDamage}
                    TAB_COLORS={TAB_COLORS}
                    chartData={chartData}
                />
            )}

            {/* ── MODAL DIALOGS & POPUPS ── */}

            {/* A. Caster Presets Dialog Popup */}
            <CasterPresetsPopup
                isOpen={isCasterPresetOpen}
                onClose={() => setIsCasterPresetOpen(false)}
                casterPresetHeroSearch={casterPresetHeroSearch}
                setCasterPresetHeroSearch={setCasterPresetHeroSearch}
                filteredPresetHeroes={filteredPresetHeroes}
                selectedPresetHero={selectedPresetHero}
                handleHeroPresetSelect={handleHeroPresetSelect}
                isPresetLoading={isPresetLoading}
                presetHeroData={presetHeroData}
                handleApplyCasterPreset={handleApplyCasterPreset}
            />

            {/* B. Target Presets Dialog Popup */}
            <TargetPresetsPopup
                isOpen={isTargetPresetOpen}
                onClose={() => setIsTargetPresetOpen(false)}
                handleApplyTargetPreset={handleApplyTargetPreset}
            />

            {/* C. Custom Premium Glassmorphic Modal Dialog */}
            <CustomDialog
                isOpen={customDialog.isOpen}
                title={customDialog.title}
                message={customDialog.message}
                type={customDialog.type}
                onClose={handleCloseCustomDialog}
            />

            {/* D. Premium Viewport Loading Overlay */}
            {isLoading && createPortal(
                <div className="calculator-loading-overlay">
                    <div className="loading-vibe-card">
                        <div className="pulsing-hex-container">
                            <svg className="hex-spin-svg" viewBox="0 0 100 100">
                                <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" className="hex-poly" />
                            </svg>
                            <div className="hex-inner-glow"></div>
                        </div>
                        <h4>Initializing Combat Analyzer</h4>
                        <p>Syncing cached configurations and community datasets...</p>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
};
