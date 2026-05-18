import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { useDamageCalculator, formatSkillModTip, FormDefaults, formatFormLabel, Artifacts, getHeroCalculatorKey } from '../../services/damageCalc/damageService';
import { ProcessedBuildData } from '../../services/buildAssist';
import { getSetIconUrl } from '../../services/setAssets';
import './DamageCalculatorTab.css';

interface DamageCalculatorTabProps {
  heroName: string;
  buildData: ProcessedBuildData | null;
  isHidingForOCR: boolean;
  setIsHidingForOCR: (val: boolean) => void;
}

const formatArtifactName = (id: string): string => {
  if (id === 'noProc') return 'None / Generic';
  return id
    .split('_')
    .map(word => {
      if (word === 's' || word === 't') return `'${word}`;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ')
    .replace(" 's", "'s")
    .replace(" 't", "'t");
};

const advantageousElementMap = {
  fire: 'ice',
  ice: 'wind',
  wind: 'fire',
  light: 'dark',
  dark: 'light'
};

const getToggleIcon = (key: string, advantageousElement?: string) => {
  switch (key) {
    // Caster Toggles
    case 'elementalAdvantage':
      return advantageousElement ? new URL(`../../assets/images/elements/${advantageousElement}.png`, import.meta.url).href : '';
    case 'decreasedAttack':
      return new URL('../../assets/images/debuffs/attack-debuff.png', import.meta.url).href;
    case 'attackUp':
      return new URL('../../assets/images/buffs/attack-buff.png', import.meta.url).href;
    case 'attackUpGreat':
      return new URL('../../assets/images/buffs/greater-attack-buff.png', import.meta.url).href;
    case 'casterPilfered':
      return new URL('../../assets/images/debuffs/pilfer-debuff.png', import.meta.url).href;
    case 'increasedCritDamage':
      return new URL('../../assets/images/buffs/critical-hit-damage-buff.png', import.meta.url).href;
    case 'casterVigor':
      return new URL('../../assets/images/buffs/vigor-buff.png', import.meta.url).href;
    case 'casterEnraged':
      return new URL('../../assets/images/buffs/rage-buff.png', import.meta.url).href;
    case 'casterHasCascade':
      return new URL('../../assets/images/buffs/cascade-buff.png', import.meta.url).href;
    case 'casterHasAbundance':
      return new URL('../../assets/images/buffs/abundance-buff.png', import.meta.url).href;
    case 'casterHasChallenge':
      return new URL('../../assets/images/buffs/challenge-buff.png', import.meta.url).href;
    case 'casterHasExplosives':
      return new URL('../../assets/images/buffs/explosives-buff.png', import.meta.url).href;
    case 'casterHasSpecialFriendship':
      return new URL('../../assets/images/buffs/special-friendship-buff.png', import.meta.url).href;
    case 'casterRampage':
      return new URL('../../assets/images/buffs/rampage-buff.png', import.meta.url).href;
    case 'rageSet':
      return new URL('../../assets/images/item_set/setrage.png', import.meta.url).href;
    case 'penetrationSet':
      return new URL('../../assets/images/item_set/setpenetration.png', import.meta.url).href;
    case 'torrentSetStack':
      return new URL('../../assets/images/item_set/settorrent.png', import.meta.url).href;
    case 'pursuitSet':
      return new URL('../../assets/images/item_set/set_chase.png', import.meta.url).href;

    // Target Toggles
    case 'targetDefenseUp':
      return new URL('../../assets/images/buffs/defense-buff.png', import.meta.url).href;
    case 'targetVigor':
      return new URL('../../assets/images/buffs/vigor-buff.png', import.meta.url).href;
    case 'targetDefenseDown':
      return new URL('../../assets/images/debuffs/defense-debuff.png', import.meta.url).href;
    case 'targetTargeted':
      return new URL('../../assets/images/debuffs/target-debuff.png', import.meta.url).href;
    case 'targetRuptured':
      return new URL('../../assets/images/debuffs/rupture-debuff.png', import.meta.url).href;
    case 'targetPilfered':
      return new URL('../../assets/images/debuffs/pilfer-debuff.png', import.meta.url).href;
    case 'targetHasTrauma':
      return new URL('../../assets/images/debuffs/trauma-debuff.png', import.meta.url).href;
    case 'targetMagicNailed':
      return new URL('../../assets/images/debuffs/nail-debuff.png', import.meta.url).href;
    case 'targetFractured':
      return new URL('../../assets/images/debuffs/fracture-debuff.png', import.meta.url).href;
    case 'targetLaceration':
      return new URL('../../assets/images/debuffs/laceration-debuff.png', import.meta.url).href;

    default: {
      const defaultDef = FormDefaults[key];
      if (defaultDef && defaultDef.icon) {
        const iconPath = defaultDef.icon;
        if (iconPath.startsWith('buffs/')) {
          const file = iconPath.substring(6);
          return new URL(`../../assets/images/buffs/${file}`, import.meta.url).href;
        }
        if (iconPath.startsWith('debuffs/')) {
          const file = iconPath.substring(8);
          return new URL(`../../assets/images/debuffs/${file}`, import.meta.url).href;
        }
        if (iconPath.startsWith('icons/')) {
          const file = iconPath.substring(6);
          return new URL(`../../assets/images/icons/${file}`, import.meta.url).href;
        }
        if (iconPath.startsWith('heroes/')) {
          const file = iconPath.substring(7);
          return new URL(`../../assets/images/heroes/${file}`, import.meta.url).href;
        }
      }
      return '';
    }
  }
};

const getArtifactIcon = (id: string) => {
  if (!id || id === 'noProc') {
    return new URL('../../assets/images/artifacts/noProc.png', import.meta.url).href;
  }
  return new URL(`../../assets/images/artifacts/${id}.png`, import.meta.url).href;
};

export interface ParsedStats {
  atk: number;
  defense: number;
  hp: number;
  speed: number;
  chc: number;
  chd: number;
  eff: number;
  efr: number;
}

export function parseOCRStats(text: string): ParsedStats | null {
  const tokens = text.split(/\s+/).filter(token => /\d/.test(token));
  if (tokens.length < 8) {
    console.warn(`[OCR Stats] Expected at least 8 numeric tokens, got ${tokens.length}:`, tokens);
    return null;
  }

  const parseInteger = (token: string): number | null => {
    const cleaned = token.replace(/\D/g, '');
    const val = parseInt(cleaned, 10);
    return isNaN(val) ? null : val;
  };

  const parsePercentage = (token: string, maxVal: number): number | null => {
    let cleaned = token.toLowerCase();
    if (cleaned.endsWith('/0')) cleaned = cleaned.slice(0, -2);
    else if (cleaned.endsWith('/o')) cleaned = cleaned.slice(0, -2);
    else if (cleaned.endsWith('wo')) cleaned = cleaned.slice(0, -2);
    else if (cleaned.endsWith('%')) cleaned = cleaned.slice(0, -1);
    else if (cleaned.endsWith('o') && cleaned.length > 1) {
      if (/\d/.test(cleaned[cleaned.length - 2])) {
        cleaned = cleaned.slice(0, -1);
      }
    }

    if (cleaned.includes('.')) {
      const dotCleaned = cleaned.replace(/[^0-9.]/g, '');
      const val = parseFloat(dotCleaned);
      if (!isNaN(val) && val <= maxVal) {
        return val;
      }
    }

    const digitsCleaned = cleaned.replace(/\D/g, '');
    if (!digitsCleaned) return null;

    const num = parseInt(digitsCleaned, 10);
    if (isNaN(num)) return null;

    const val1 = num / 10;
    if (val1 <= maxVal) return val1;

    const val2 = num / 100;
    if (val2 <= maxVal) return val2;

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

  if (atk === null || defense === null || hp === null || speed === null ||
      chc === null || chd === null || eff === null || efr === null) {
    return null;
  }

  return { atk, defense, hp, speed, chc, chd, eff, efr };
}

export const DamageCalculatorTab: React.FC<DamageCalculatorTabProps> = ({ 
  heroName, 
  buildData, 
  isHidingForOCR, 
  setIsHidingForOCR 
}) => {
  const { t } = useTranslation();
  const {
    hero,
    artifactId,
    artifactLevel,
    setArtifactId,
    setArtifactLevel,
    formState,
    updateField,
    calculatedOutput
  } = useDamageCalculator(heroName, undefined);

  const [isOCRScanning, setIsOCRScanning] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'scanning' | 'success' | 'failed'>('idle');
  const [ocrCountdown, setOcrCountdown] = useState(5);

  const [activePreset, setActivePreset] = useState<string>('current');
  const [capturedStats, setCapturedStats] = useState<ParsedStats | null>(null);

  // 1. Generate available presets dynamically based on RTA buildData
  const presets = useMemo(() => {
    const list: Array<{ id: string; label: string; stats: any; activeSetsIcon?: string[] }> = [
      { id: 'current', label: 'Current', stats: null }
    ];

    if (buildData) {
      if (buildData.averageStats) {
        list.push({ id: 'avg', label: 'Avg', stats: buildData.averageStats });
      }
      if (buildData.proStats?.averageStats) {
        list.push({ id: 'pro', label: 'Pro', stats: buildData.proStats.averageStats });
      }
      
      // Standard sets
      if (buildData.setStats) {
        buildData.setStats.forEach((set, index) => {
          list.push({
            id: `set${index + 1}`,
            label: `Set ${index + 1}`,
            stats: set.stats,
            activeSetsIcon: set.setName.split(' / ').map(s => s.trim())
          });
        });
      }

      // Pro sets
      if (buildData.proStats?.setStats) {
        buildData.proStats.setStats.forEach((set, index) => {
          list.push({
            id: `pro_set${index + 1}`,
            label: `Set ${index + 1} Pro`,
            stats: set.stats,
            activeSetsIcon: set.setName.split(' / ').map(s => s.trim())
          });
        });
      }
    }

    return list;
  }, [buildData]);

  // 2. Automatically load captured stats from SQLite DB when mounting / hero changes!
  useEffect(() => {
    const loadSavedStats = async () => {
      try {
        const cached = await invoke<string | null>("cache_get", { key: `hero_captured_stats_${heroName}` });
        if (cached) {
          const stats = JSON.parse(cached);
          setCapturedStats(stats);
          
          if (activePreset === 'current') {
            updateField('atk', stats.atk);
            updateField('defense', stats.defense);
            updateField('hp', stats.hp);
            updateField('speed', stats.speed);
            updateField('critDamage', stats.chd);
          }
        } else {
          setCapturedStats(null);
          if (activePreset === 'current') {
            updateField('atk', "");
            updateField('defense', "");
            updateField('hp', "");
            updateField('speed', "");
            updateField('critDamage', "");
          }
        }
      } catch (e) {
        console.error("Failed to load saved captured stats:", e);
      }
    };
    loadSavedStats();
  }, [heroName, activePreset]);

  // Handle Preset Toggle Button
  const handlePresetToggle = (presetId: string) => {
    setActivePreset(presetId);
    
    if (presetId === 'current') {
      if (capturedStats) {
        updateField('atk', capturedStats.atk);
        updateField('defense', capturedStats.defense);
        updateField('hp', capturedStats.hp);
        updateField('speed', capturedStats.speed);
        updateField('critDamage', capturedStats.chd);
      } else {
        updateField('atk', "");
        updateField('defense', "");
        updateField('hp', "");
        updateField('speed', "");
        updateField('critDamage', "");
      }
    } else {
      const match = presets.find(p => p.id === presetId);
      if (match && match.stats) {
        updateField('atk', Math.round(match.stats.atk));
        updateField('defense', Math.round(match.stats.def));
        updateField('hp', Math.round(match.stats.hp));
        updateField('speed', Math.round(match.stats.spd));
        updateField('critDamage', Math.round(match.stats.chd));
      }
    }
  };

  // 2. OCR Trigger Function
  const startStatsOCR = async () => {
    if (isOCRScanning) return;

    setIsOCRScanning(true);
    setOcrStatus('scanning');
    setOcrCountdown(5);
    setIsHidingForOCR(true);
    window.dispatchEvent(new CustomEvent("ocr-state-change", { detail: { active: true } }));

    try {
      await getCurrentWindow().setIgnoreCursorEvents(true);
      await invoke("set_overlay_mode", { mode: "Display" });
      await invoke("log_frontend_info", { msg: "[OCR Stats] Started 5s screen capture stat capture loop." });
    } catch (e) {
      console.error(e);
    }

    let scanTimer: any;
    let countdownInterval: any;
    let resolved = false;

    // Countdown interval
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
          const ocrText = statsSlot.hero_name;
          const stats = parseOCRStats(ocrText);
          if (stats) {
            resolved = true;
            clearTimeout(scanTimer);
            clearInterval(countdownInterval);
            
            // Populate & set current active preset
            updateField('atk', stats.atk);
            updateField('defense', stats.defense);
            updateField('hp', stats.hp);
            updateField('speed', stats.speed);
            updateField('critDamage', stats.chd);
            
            setCapturedStats(stats);
            setActivePreset('current');
            
            // Save to SQLite cache database
            try {
              await invoke("cache_set", { 
                key: `hero_captured_stats_${heroName}`, 
                value: JSON.stringify(stats) 
              });
              await invoke("log_frontend_info", { msg: `[OCR Stats] Successfully resolved and saved to DB for ${heroName}: ${JSON.stringify(stats)}` });
            } catch (err) {
              console.error("Failed to save captured stats to DB:", err);
            }

            // Cleanup & Restore UI
            setOcrStatus('success');
            setIsOCRScanning(false);
            setIsHidingForOCR(false);
            window.dispatchEvent(new CustomEvent("ocr-state-change", { detail: { active: false } }));
            try {
              await getCurrentWindow().setIgnoreCursorEvents(false);
              await invoke("set_overlay_mode", { mode: "HeroDetails" });
            } catch (e) {}
            
            const unsub = await unlistenPromise;
            unsub();

            // Set state back to idle after a pleasant 2.5s success confirmation
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
        
        await invoke("log_frontend_info", { msg: "[OCR Stats] Scan timeout. No stat resolved in 5 seconds." });

        try {
          await getCurrentWindow().setIgnoreCursorEvents(false);
          await invoke("set_overlay_mode", { mode: "HeroDetails" });
        } catch (e) {}

        const unsub = await unlistenPromise;
        unsub();

        // Set state back to idle after 2.5s
        setTimeout(() => {
          setOcrStatus('idle');
        }, 2500);
      }
    }, 5000);
  };

  const advantageousElement = hero?.element ? (advantageousElementMap[hero.element as keyof typeof advantageousElementMap] || '') : '';

  const getEnhanceMax = (skillId: string): number => {
    if (!hero || !hero.skills) return 5;
    const skill = hero.skills[skillId];
    if (!skill) return 0;
    if (skill.enhance && skill.enhance.length > 0) {
      return skill.enhance.length;
    }
    if (skill.enhanceFrom && hero.skills[skill.enhanceFrom]) {
      const parentSkill = hero.skills[skill.enhanceFrom];
      if (parentSkill && parentSkill.enhance) {
        return parentSkill.enhance.length;
      }
    }
    // Default to 5 only if it's not explicitly a passive/un-enhanceable skill
    return skill.id ? 5 : 0;
  };

  const s1Max = getEnhanceMax('s1');
  const s2Max = getEnhanceMax('s2');
  const s3Max = getEnhanceMax('s3');

  const heroKey = useMemo(() => getHeroCalculatorKey(heroName), [heroName]);

  // Dynamic Hero & Artifact Specific inputs (Matching the original Angular layout exactly!)
  const {
    heroSpecificBooleans,
    heroSpecificNumbers,
    artifactSpecificBooleans,
    artifactSpecificNumbers
  } = useMemo(() => {
    let heroSpecificBooleans: string[] = [];
    let heroSpecificNumbers: string[] = [];
    let artifactSpecificBooleans: string[] = [];
    let artifactSpecificNumbers: string[] = [];

    // 1. Initial categorization
    if (hero && hero.heroSpecific) {
      for (const key of hero.heroSpecific) {
        const defaultDef = FormDefaults[key];
        if (defaultDef) {
          if (defaultDef.default !== undefined || typeof defaultDef.defaultValue === 'boolean') {
            heroSpecificBooleans.push(key);
          } else {
            heroSpecificNumbers.push(key);
          }
        } else {
          const isBool = key.includes('Has') || key.includes('Is') || key.includes('Below') || key.includes('Above') || key.includes('Debuffed') || key.includes('Passive');
          if (isBool) heroSpecificBooleans.push(key);
          else heroSpecificNumbers.push(key);
        }
      }
    }

    const artifact = Artifacts[artifactId];
    if (artifact && artifact.artifactSpecific) {
      for (const key of artifact.artifactSpecific) {
        const defaultDef = FormDefaults[key];
        if (defaultDef) {
          if (defaultDef.default !== undefined || typeof defaultDef.defaultValue === 'boolean') {
            artifactSpecificBooleans.push(key);
          } else {
            artifactSpecificNumbers.push(key);
          }
        } else {
          const isBool = key.includes('Has') || key.includes('Is') || key.includes('Below') || key.includes('Above') || key.includes('Debuffed') || key.includes('Passive');
          if (isBool) artifactSpecificBooleans.push(key);
          else artifactSpecificNumbers.push(key);
        }
      }
    }

    // 2. addAddtionalBooleanInputs
    const buffModifiedSpecific = ['casterSpeed', 'targetSpeed', 'casterDefense', 'targetDefense', 'targetAttack', 'highestAllyAttack'];
    const HPIncreaseArtifacts = ['prayer_of_solitude', 'sweet_miracle'];

    // Hero additional booleans
    heroSpecificNumbers.forEach(input => {
      if (buffModifiedSpecific.includes(input)) {
        heroSpecificBooleans.push(`${input}Up`);
        heroSpecificBooleans.push(`${input}Down`);

        if (input === 'targetAttack') {
          heroSpecificBooleans.push('targetAttackUpGreat');
          heroSpecificBooleans.push('targetEnraged');
          heroSpecificBooleans.push('targetHasDemonBladeUnleashed');
        } else if (input === 'highestAllyAttack') {
          heroSpecificBooleans.push('highestAllyAttackUpGreat');
        } else if (input === 'targetSpeed') {
          heroSpecificBooleans.push('targetEnraged');
          heroSpecificBooleans.push('targetHasRampage');
          heroSpecificBooleans.push('targetHasSuperhumanization');
        } else if (input === 'casterSpeed') {
          heroSpecificBooleans.push('casterHasSuperhumanization');
        }
      } else {
        if (input === 'casterMaxHP') {
          heroSpecificBooleans.push('casterHasCollapse');
          heroSpecificBooleans.push('casterHasSuperhumanization');
        } else if (input === 'targetMaxHP') {
          heroSpecificBooleans.push('targetHasCollapse');
          heroSpecificBooleans.push('targetHasSuperhumanization');
        }
      }
    });

    // Artifact additional booleans
    artifactSpecificNumbers.forEach(input => {
      if (buffModifiedSpecific.includes(input)) {
        artifactSpecificBooleans.push(`${input}Up`);
        artifactSpecificBooleans.push(`${input}Down`);

        if (input === 'targetAttack') {
          artifactSpecificBooleans.push(`${input}UpGreat`);
        }
        if (input === 'targetSpeed') {
          artifactSpecificBooleans.push('targetEnraged');
        }
      }
    });

    // inBattleHP check
    if ((heroSpecificNumbers.includes('casterMaxHP') || artifactSpecificNumbers.includes('casterMaxHP')) && 
        (!!formState.casterPilfered || HPIncreaseArtifacts.includes(artifactId))) {
      heroSpecificBooleans.push('inBattleHP');
    }

    // beehooPassive check
    const hasBurn = heroKey.includes('beehoo') || Object.values(hero.skills || {}).some((skill: any) => 
      (skill.detonate && skill.detonate.includes('burn')) || (skill.dot && skill.dot.includes('burn'))
    );
    if (hasBurn) {
      heroSpecificBooleans.push('beehooPassive');
    }

    // 3. addAddtionalNumberInputs
    const initialHeroSpecificNumbers = [...heroSpecificNumbers];
    initialHeroSpecificNumbers.forEach(input => {
      if (input === 'casterMaxHP') {
        heroSpecificNumbers.push('casterMaxHPIncrease');
        heroSpecificNumbers.push('casterLingeringFragranceStack');
      }
    });

    const initialArtifactSpecificNumbers = [...artifactSpecificNumbers];
    initialArtifactSpecificNumbers.forEach(input => {
      if (input === 'casterMaxHP') {
        artifactSpecificNumbers.push('casterMaxHPIncrease');
        artifactSpecificNumbers.push('casterLingeringFragranceStack');
      }
    });

    // 4. dedupeForm
    heroSpecificBooleans = [...(new Set(heroSpecificBooleans))];
    artifactSpecificBooleans = [...(new Set(artifactSpecificBooleans))];
    heroSpecificNumbers = [...(new Set(heroSpecificNumbers))];
    artifactSpecificNumbers = [...(new Set(artifactSpecificNumbers))];

    // Filter out artifact duplicates
    artifactSpecificBooleans = artifactSpecificBooleans.filter(input => !heroSpecificBooleans.includes(input));
    artifactSpecificNumbers = artifactSpecificNumbers.filter(input => !heroSpecificNumbers.includes(input));

    // Filter out core stats from dynamic sliders/toggles
    const coreExcluded = ['atk', 'attack', 'defense', 'casterDefense', 'hp', 'casterMaxHP', 'speed', 'casterSpeed', 'critDamage', 'targetDefense', 'targetMaxHP', 'targetCurrentHP', 'targetInjuries'];
    heroSpecificNumbers = heroSpecificNumbers.filter(input => !coreExcluded.includes(input));
    artifactSpecificNumbers = artifactSpecificNumbers.filter(input => !coreExcluded.includes(input));

    return {
      heroSpecificBooleans,
      heroSpecificNumbers,
      artifactSpecificBooleans,
      artifactSpecificNumbers
    };
  }, [hero, artifactId, formState, heroKey]);

  // Search & Filter Artifacts
  const [artSearch, setArtSearch] = useState('');
  const [artDropdownOpen, setArtDropdownOpen] = useState(false);

  const filteredArtifacts = useMemo(() => {
    const query = artSearch.toLowerCase();
    return Object.keys(Artifacts).filter(id => {
      if (id === 'noProc') return true;
      const formatted = formatArtifactName(id).toLowerCase();
      return id.toLowerCase().includes(query) || formatted.includes(query);
    });
  }, [artSearch]);

  const targetPresets = [
    { name: 'Custom (10k HP / 1k Def)', def: 1000, hp: 10000 },
    { name: 'Squishy (8k HP / 800 Def)', def: 800, hp: 8000 },
    { name: 'Bruiser (15k HP / 1.3k Def)', def: 1300, hp: 15000 },
    { name: 'Tank (25k HP / 1.8k Def)', def: 1800, hp: 25000 },
    { name: 'Mega Tank (32k HP / 2.2k Def)', def: 2200, hp: 32000 }
  ];

  const applyTargetPreset = (def: number, hp: number) => {
    updateField('targetDefense', def);
    updateField('targetHP', hp);
  };

  return (
    <div className="damage-calc-tab-container">
      {/* ── LEFT COLUMN: INPUT CONTROLS ── */}
      <div className="calc-inputs-column">
        
        {/* 1. Hero Core Stats (Pre-populated) */}
        <div className="calc-card">
          <div className="calc-card-header-with-ocr" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 className="calc-card-title" style={{ margin: 0 }}>{t('damageCalc.heroStats', 'Hero Core Stats')}</h3>
            <button 
              className={`ocr-capture-btn ocr-status-${ocrStatus}`}
              onClick={startStatsOCR}
              disabled={isOCRScanning}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '4px',
                color: 'rgba(255, 255, 255, 0.65)',
                padding: '3px 8px',
                fontSize: '0.65rem',
                fontWeight: 'normal',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              {ocrStatus === 'scanning' ? (
                <>
                  <span className="ocr-scanner-dot" style={{ width: '4px', height: '4px', backgroundColor: '#00f2fe', borderRadius: '50%', display: 'inline-block', animation: 'ocr-pulse 1s infinite alternate' }} />
                  <span>Scanning ({ocrCountdown}s)</span>
                </>
              ) : ocrStatus === 'success' ? (
                <>
                  <span style={{ color: '#00ff87' }}>✓ Resolved</span>
                </>
              ) : ocrStatus === 'failed' ? (
                <>
                  <span style={{ color: '#ff4d4d' }}>✗ Timeout</span>
                </>
              ) : (
                <>
                  <span>Capture Game Stats</span>
                </>
              )}
            </button>
          </div>

          {/* Preset Toggle Toolbar */}
          <div className="preset-toggle-toolbar" style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            marginBottom: '14px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: '6px',
            padding: '6px'
          }}>
            {presets.map(preset => {
              const isActive = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetToggle(preset.id)}
                  style={{
                    background: isActive ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(79, 172, 254, 0.15) 100%)' : 'rgba(255, 255, 255, 0.03)',
                    border: isActive ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '4px',
                    color: isActive ? '#00f2fe' : 'rgba(255, 255, 255, 0.6)',
                    padding: '4px 8px',
                    fontSize: '0.65rem',
                    fontWeight: isActive ? 'bold' : 'normal',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {preset.activeSetsIcon && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: '2px' }}>
                      {preset.activeSetsIcon.map((setIcon, i) => (
                        <img 
                          key={i}
                          src={getSetIconUrl(setIcon)} 
                          style={{ width: '10px', height: '10px' }} 
                          alt="" 
                        />
                      ))}
                    </div>
                  )}
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="calc-fields-grid">
            <div className="calc-input-group">
              <label>Attack</label>
              <input 
                type="number" 
                value={formState.atk} 
                onChange={(e) => updateField('atk', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Scan to fill..."
              />
            </div>
            <div className="calc-input-group">
              <label>Crit Damage (%)</label>
              <input 
                type="number" 
                value={formState.critDamage} 
                onChange={(e) => updateField('critDamage', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Scan to fill..."
              />
            </div>
            <div className="calc-input-group">
              <label>Health (HP)</label>
              <input 
                type="number" 
                value={formState.hp} 
                onChange={(e) => updateField('hp', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Scan to fill..."
              />
            </div>
            <div className="calc-input-group">
              <label>Defense</label>
              <input 
                type="number" 
                value={formState.defense} 
                onChange={(e) => updateField('defense', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Scan to fill..."
              />
            </div>
            <div className="calc-input-group">
              <label>Speed</label>
              <input 
                type="number" 
                value={formState.speed} 
                onChange={(e) => updateField('speed', e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Scan to fill..."
              />
            </div>
          </div>
        </div>

        {/* 2. Artifact Selector */}
        <div className="calc-card">
          <h3 className="calc-card-title">{t('damageCalc.artifact', 'Artifact Setup')}</h3>
          <div className="calc-artifact-dropdown-wrapper">
            <button 
              className="calc-dropdown-trigger-btn"
              onClick={() => setArtDropdownOpen(!artDropdownOpen)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img 
                  src={getArtifactIcon(artifactId)} 
                  onError={(e) => { e.currentTarget.src = getArtifactIcon('noProc'); }}
                  style={{ width: '18px', height: '18px', objectFit: 'cover', borderRadius: '3px', flexShrink: 0 }} 
                  alt="" 
                />
                <span>{formatArtifactName(artifactId)}</span>
              </div>
              <span>▾</span>
            </button>
            
            {artDropdownOpen && (
              <div className="calc-dropdown-list">
                <input 
                  type="text" 
                  className="calc-dropdown-search"
                  placeholder="Search Artifact..."
                  value={artSearch}
                  onChange={(e) => setArtSearch(e.target.value)}
                  autoFocus
                />
                <div className="calc-dropdown-options-scroll">
                  {filteredArtifacts.map(id => (
                    <button
                      key={id}
                      className={`calc-dropdown-option ${artifactId === id ? 'active' : ''}`}
                      onClick={() => {
                        setArtifactId(id);
                        setArtDropdownOpen(false);
                      }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <img 
                        src={getArtifactIcon(id)} 
                        onError={(e) => { e.currentTarget.src = getArtifactIcon('noProc'); }}
                        style={{ width: '16px', height: '16px', objectFit: 'cover', borderRadius: '2px', flexShrink: 0 }} 
                        alt="" 
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatArtifactName(id)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="calc-slider-group" style={{ marginTop: '8px' }}>
            <div className="slider-header">
              <label>Artifact Level</label>
              <span className="slider-value">+{artifactLevel}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max="30" 
              value={artifactLevel} 
              onChange={(e) => setArtifactLevel(Number(e.target.value))}
            />
          </div>
        </div>



        {/* 3.5 Dynamic Hero Specific & Artifact Specific Options */}
        {(heroSpecificBooleans.length > 0 || heroSpecificNumbers.length > 0 ||
          artifactSpecificBooleans.length > 0 || artifactSpecificNumbers.length > 0) && (
          <div className="calc-card dynamic-specifics-card glow-magenta">
            <h3 className="calc-card-title">Hero & Artifact Options</h3>
            
            {/* Dynamic Number Sliders */}
            {(heroSpecificNumbers.length > 0 || artifactSpecificNumbers.length > 0) && (
              <div className="calc-sliders-container">
                {[...heroSpecificNumbers, ...artifactSpecificNumbers].map(field => {
                  const max = FormDefaults[field]?.max ?? 100;
                  const min = FormDefaults[field]?.min ?? 0;
                  const step = FormDefaults[field]?.step ?? 1;
                  const value = formState[field] ?? FormDefaults[field]?.defaultValue ?? 0;

                  return (
                    <div key={field} className="calc-slider-group">
                      <div className="slider-header">
                        <label>{formatFormLabel(field)}</label>
                        <span className="slider-value">{value}</span>
                      </div>
                      <input 
                        type="range" 
                        min={min} 
                        max={max} 
                        step={step}
                        value={value} 
                        onChange={(e) => updateField(field, Number(e.target.value))}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dynamic Boolean Toggles */}
            {(heroSpecificBooleans.length > 0 || artifactSpecificBooleans.length > 0) && (
              <div className="calc-toggles-grid" style={{ marginTop: heroSpecificNumbers.length + artifactSpecificNumbers.length > 0 ? '10px' : '0' }}>
                {[...heroSpecificBooleans, ...artifactSpecificBooleans].map(field => {
                  const checked = !!formState[field];
                  const iconUrl = getToggleIcon(field);
                  return (
                    <label key={field} className="calc-switch-container">
                      <input 
                        type="checkbox" 
                        checked={checked}
                        onChange={(e) => updateField(field, e.target.checked)}
                      />
                      {iconUrl && (
                        <img src={iconUrl} className="switch-icon" alt="" />
                      )}
                      <span className="switch-label">{formatFormLabel(field)}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. Molagoras / Skill Enhance */}
        {(s1Max > 0 || s2Max > 0 || s3Max > 0) && (
          <div className="calc-card">
            <h3 className="calc-card-title">{t('damageCalc.molagoras', 'Skill Enhancements')}</h3>
            <div className="calc-sliders-container">
              {s1Max > 0 && (
                <div className="calc-slider-group">
                  <div className="slider-header">
                    <label>S1 level</label>
                    <span className="slider-value">+{Math.min(formState.molagoras1, s1Max)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max={s1Max} 
                    value={Math.min(formState.molagoras1, s1Max)} 
                    onChange={(e) => updateField('molagoras1', Number(e.target.value))}
                  />
                </div>
              )}
              {s2Max > 0 && (
                <div className="calc-slider-group">
                  <div className="slider-header">
                    <label>S2 level</label>
                    <span className="slider-value">+{Math.min(formState.molagoras2, s2Max)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max={s2Max} 
                    value={Math.min(formState.molagoras2, s2Max)} 
                    onChange={(e) => updateField('molagoras2', Number(e.target.value))}
                  />
                </div>
              )}
              {s3Max > 0 && (
                <div className="calc-slider-group">
                  <div className="slider-header">
                    <label>S3 level</label>
                    <span className="slider-value">+{Math.min(formState.molagoras3, s3Max)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max={s3Max} 
                    value={Math.min(formState.molagoras3, s3Max)} 
                    onChange={(e) => updateField('molagoras3', Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Target Presets & Stats */}
        <div className="calc-card">
          <h3 className="calc-card-title">{t('damageCalc.target', 'Target Parameters')}</h3>
          
          <div className="calc-presets-tags">
            {targetPresets.map(preset => (
              <button 
                key={preset.name}
                className="calc-tag-btn"
                onClick={() => applyTargetPreset(preset.def, preset.hp)}
              >
                {preset.name}
              </button>
            ))}
          </div>

          <div className="calc-sliders-container" style={{ marginTop: '10px' }}>
            <div className="calc-slider-group">
              <div className="slider-header">
                <label>Target Defense</label>
                <span className="slider-value">{formState.targetDefense} Def</span>
              </div>
              <input 
                type="range" 
                min="200" 
                max="3000" 
                step="50"
                value={formState.targetDefense} 
                onChange={(e) => updateField('targetDefense', Number(e.target.value))}
              />
            </div>
            <div className="calc-slider-group">
              <div className="slider-header">
                <label>Target Max HP</label>
                <span className="slider-value">{formState.targetHP.toLocaleString()} HP</span>
              </div>
              <input 
                type="range" 
                min="3000" 
                max="50000" 
                step="500"
                value={formState.targetHP} 
                onChange={(e) => updateField('targetHP', Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* 6. Combat Buffs & Conditions */}
        <div className="calc-card">
          <h3 className="calc-card-title">{t('damageCalc.buffs', 'Buffs & Debuffs')}</h3>
          <div className="calc-toggles-grid">
            
            <h4 className="toggles-header">Caster Status & Sets</h4>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.elementalAdvantage} onChange={(e) => updateField('elementalAdvantage', e.target.checked)} />
              {getToggleIcon('elementalAdvantage', advantageousElement) && (
                <img src={getToggleIcon('elementalAdvantage', advantageousElement)} className="switch-icon" alt="" />
              )}
              <span className="switch-label">Advantage</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.decreasedAttack} onChange={(e) => updateField('decreasedAttack', e.target.checked)} />
              <img src={getToggleIcon('decreasedAttack')} className="switch-icon" alt="" />
              <span className="switch-label">Attack Down</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.attackUp} onChange={(e) => updateField('attackUp', e.target.checked)} />
              <img src={getToggleIcon('attackUp')} className="switch-icon" alt="" />
              <span className="switch-label">Attack Up</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.attackUpGreat} onChange={(e) => updateField('attackUpGreat', e.target.checked)} />
              <img src={getToggleIcon('attackUpGreat')} className="switch-icon" alt="" />
              <span className="switch-label">Atk Up (Gt)</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.casterPilfered} onChange={(e) => updateField('casterPilfered', e.target.checked)} />
              <img src={getToggleIcon('casterPilfered')} className="switch-icon" alt="" />
              <span className="switch-label">Pilfered</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.increasedCritDamage} onChange={(e) => updateField('increasedCritDamage', e.target.checked)} />
              <img src={getToggleIcon('increasedCritDamage')} className="switch-icon" alt="" />
              <span className="switch-label">Crit Dmg Up</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.casterVigor} onChange={(e) => updateField('casterVigor', e.target.checked)} />
              <img src={getToggleIcon('casterVigor')} className="switch-icon" alt="" />
              <span className="switch-label">Vigor</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.casterEnraged} onChange={(e) => updateField('casterEnraged', e.target.checked)} />
              <img src={getToggleIcon('casterEnraged')} className="switch-icon" alt="" />
              <span className="switch-label">Enraged</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.casterHasCascade} onChange={(e) => updateField('casterHasCascade', e.target.checked)} />
              <img src={getToggleIcon('casterHasCascade')} className="switch-icon" alt="" />
              <span className="switch-label">Cascade</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.casterHasAbundance} onChange={(e) => updateField('casterHasAbundance', e.target.checked)} />
              <img src={getToggleIcon('casterHasAbundance')} className="switch-icon" alt="" />
              <span className="switch-label">Abundance</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.casterHasChallenge} onChange={(e) => updateField('casterHasChallenge', e.target.checked)} />
              <img src={getToggleIcon('casterHasChallenge')} className="switch-icon" alt="" />
              <span className="switch-label">Challenge</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.casterHasExplosives} onChange={(e) => updateField('casterHasExplosives', e.target.checked)} />
              <img src={getToggleIcon('casterHasExplosives')} className="switch-icon" alt="" />
              <span className="switch-label">Explosives</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.casterHasSpecialFriendship} onChange={(e) => updateField('casterHasSpecialFriendship', e.target.checked)} />
              <img src={getToggleIcon('casterHasSpecialFriendship')} className="switch-icon" alt="" />
              <span className="switch-label">Special Friendship</span>
            </label>
            {hero?.element === 'dark' && (
              <label className="calc-switch-container">
                <input type="checkbox" checked={!!formState.casterRampage} onChange={(e) => updateField('casterRampage', e.target.checked)} />
                <img src={getToggleIcon('casterRampage')} className="switch-icon" alt="" />
                <span className="switch-label">Rampage</span>
              </label>
            )}
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.rageSet} onChange={(e) => updateField('rageSet', e.target.checked)} />
              <img src={getToggleIcon('rageSet')} className="switch-icon" alt="" />
              <span className="switch-label">Rage Set</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.penetrationSet} onChange={(e) => updateField('penetrationSet', e.target.checked)} />
              <img src={getToggleIcon('penetrationSet')} className="switch-icon" alt="" />
              <span className="switch-label">Penetration Set</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.torrentSetStack} onChange={(e) => updateField('torrentSetStack', e.target.checked ? 1 : 0)} />
              <img src={getToggleIcon('torrentSetStack')} className="switch-icon" alt="" />
              <span className="switch-label">Torrent Set</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.pursuitSet} onChange={(e) => updateField('pursuitSet', e.target.checked)} />
              <img src={getToggleIcon('pursuitSet')} className="switch-icon" alt="" />
              <span className="switch-label">Pursuit Set</span>
            </label>

            <h4 className="toggles-header" style={{ marginTop: '8px' }}>Target Statuses</h4>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.targetDefenseUp} onChange={(e) => updateField('targetDefenseUp', e.target.checked)} />
              <img src={getToggleIcon('targetDefenseUp')} className="switch-icon" alt="" />
              <span className="switch-label">Defense Up</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.targetVigor} onChange={(e) => updateField('targetVigor', e.target.checked)} />
              <img src={getToggleIcon('targetVigor')} className="switch-icon" alt="" />
              <span className="switch-label">Vigor</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.targetDefenseDown} onChange={(e) => updateField('targetDefenseDown', e.target.checked)} />
              <img src={getToggleIcon('targetDefenseDown')} className="switch-icon" alt="" />
              <span className="switch-label">Def Down</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.targetTargeted} onChange={(e) => updateField('targetTargeted', e.target.checked)} />
              <img src={getToggleIcon('targetTargeted')} className="switch-icon" alt="" />
              <span className="switch-label">Targeted</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.targetRuptured} onChange={(e) => updateField('targetRuptured', e.target.checked)} />
              <img src={getToggleIcon('targetRuptured')} className="switch-icon" alt="" />
              <span className="switch-label">Ruptured</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.targetPilfered} onChange={(e) => updateField('targetPilfered', e.target.checked)} />
              <img src={getToggleIcon('targetPilfered')} className="switch-icon" alt="" />
              <span className="switch-label">Pilfered</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.targetHasTrauma} onChange={(e) => updateField('targetHasTrauma', e.target.checked)} />
              <img src={getToggleIcon('targetHasTrauma')} className="switch-icon" alt="" />
              <span className="switch-label">Trauma</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.targetMagicNailed} onChange={(e) => updateField('targetMagicNailed', e.target.checked)} />
              <img src={getToggleIcon('targetMagicNailed')} className="switch-icon" alt="" />
              <span className="switch-label">Magic Nailed</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.targetFractured} onChange={(e) => updateField('targetFractured', e.target.checked)} />
              <img src={getToggleIcon('targetFractured')} className="switch-icon" alt="" />
              <span className="switch-label">Fractured</span>
            </label>
            <label className="calc-switch-container">
              <input type="checkbox" checked={!!formState.targetLaceration} onChange={(e) => updateField('targetLaceration', e.target.checked)} />
              <img src={getToggleIcon('targetLaceration')} className="switch-icon" alt="" />
              <span className="switch-label">Laceration</span>
            </label>

          </div>
        </div>

      </div>

      {/* ── RIGHT COLUMN: CALCULATED DASHBOARD OUTPUT ── */}
      <div className="calc-outputs-column">
        
        {/* 1. Shield Barriers Section */}
        {calculatedOutput.barriers.length > 0 && (
          <div className="calc-card glow-blue">
            <h3 className="calc-card-title">{t('damageCalc.barriers', 'Shield Barriers')}</h3>
            <div className="calc-barriers-grid">
              {calculatedOutput.barriers.map(barrier => (
                <div key={barrier.label} className="barrier-badge">
                  <span className="barrier-label">{barrier.label} Barrier</span>
                  <span className="barrier-val">+{barrier.value.toLocaleString()} HP</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. Interactive Skill Damage Cards */}
        <div className="calc-results-header">
          <h2>Calculated Damages for {heroName}</h2>
          <p>Real-time damages updated based on exact ingame formulas, enhancements, and custom multipliers.</p>
        </div>

        <div className="calc-skills-grid">
          {calculatedOutput.damages.map((row: any) => {
            const skillId = row.skill.replace('_soulburn', '').replace('_extra', '').replace('_counter', '');
            const mods = calculatedOutput.modifiers[row.skill] || {};
            const isSoulburn = row.skill.includes('_soulburn');
            const isExtra = row.skill.includes('_extra');
            const isCounter = row.skill.includes('_counter');

            return (
              <div key={row.skill} className="skill-dmg-card">
                <div className="skill-card-top">
                  <div className="skill-badge-wrapper">
                    <span className="skill-name">{skillId.toUpperCase()}</span>
                    {isSoulburn && <span className="badge soulburn">Soulburn</span>}
                    {isExtra && <span className="badge extra">Extra</span>}
                    {isCounter && <span className="badge counter">Counter</span>}
                  </div>
                  
                  {mods.elementalAdvantage && (
                    <span className="skill-advantage-chip">Advantage</span>
                  )}
                </div>

                {/* Damage Values Output Row */}
                <div className="damage-stats-row">
                  {row.crit !== null && (
                    <div className="dmg-box crit">
                      <span className="box-label">Critical Hit</span>
                      <span className="box-val">{row.crit.toLocaleString()}</span>
                    </div>
                  )}
                  {row.normal !== null && (
                    <div className="dmg-box normal">
                      <span className="box-label">Normal Hit</span>
                      <span className="box-val">{row.normal.toLocaleString()}</span>
                    </div>
                  )}
                  {row.crush !== null && (
                    <div className="dmg-box crush">
                      <span className="box-label">Crush Hit</span>
                      <span className="box-val">{row.crush.toLocaleString()}</span>
                    </div>
                  )}
                  {row.miss !== null && (
                    <div className="dmg-box miss">
                      <span className="box-label">Miss Hit</span>
                      <span className="box-val">{row.miss.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Math Formulas chips details */}
                <div className="skill-math-accordion">
                  <div className="accordion-heading">Formula Multipliers & Scaling</div>
                  <div className="math-chips-grid">
                    <div className="math-chip">
                      <span className="chip-lbl">Rate</span>
                      <span className="chip-val">x{mods.rate?.toFixed(2) || '0'}</span>
                    </div>
                    <div className="math-chip">
                      <span className="chip-lbl">Pow</span>
                      <span className="chip-val">x{mods.pow?.toFixed(2) || '0'}</span>
                    </div>
                    {mods.flat > 0 && (
                      <div className="math-chip">
                        <span className="chip-lbl">Flat</span>
                        <span className="chip-val">+{mods.flat.toLocaleString()} {mods.flatTip}</span>
                      </div>
                    )}
                    {mods.pen > 0 && (
                      <div className="math-chip glowing-cyan">
                        <span className="chip-lbl">Pen</span>
                        <span className="chip-val">{mods.pen}% {mods.penTip}</span>
                      </div>
                    )}
                    {mods.afterMathDmg > 0 && (
                      <div className="math-chip glowing-orange">
                        <span className="chip-lbl">Aftermath</span>
                        <span className="chip-val">+{mods.afterMathDmg.toLocaleString()} {mods.afterMathFormula}</span>
                      </div>
                    )}
                    {mods.fixed > 0 && (
                      <div className="math-chip glowing-gold">
                        <span className="chip-lbl">Fixed</span>
                        <span className="chip-val">+{mods.fixed.toLocaleString()} {mods.fixedTip}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
