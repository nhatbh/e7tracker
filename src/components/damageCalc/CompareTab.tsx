import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
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
import { getSetIconUrl } from '../../services/setAssets';
import { HeroMiniPortrait } from '../HeroMiniPortrait';
import { SavedBuildProfile, calculateProfileDamage } from '../../services/damageCalc/profileCalc';
import { formatFormLabel, FormDefaults, Heroes, getHeroCalculatorKey } from '../../services/damageCalc/damageService';
import './CompareTab.css';

const COMPARE_COLORS = ['#00f2fe', '#ff007f', '#10b981', '#ffb700'];

interface CompareTabProps {
  heroName: string;
  selectedCompareIds: string[];
  setSelectedCompareIds: React.Dispatch<React.SetStateAction<string[]>>;
  onBackToSavedBuilds: () => void;
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

const getArtifactIcon = (id: string) => {
  if (!id || id === 'noProc') {
    return new URL('../../assets/images/artifacts/noProc.png', import.meta.url).href;
  }
  return new URL(`../../assets/images/artifacts/${id}.png`, import.meta.url).href;
};

const getToggleIcon = (key: string, advantageousElement?: string): string => {
  switch (key) {
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

const getActiveBuffs = (profile: SavedBuildProfile, heroElement?: string): Array<{ key: string; label: string; iconUrl?: string }> => {
  const fs = profile.formState || {};
  const list: Array<{ key: string; label: string }> = [];
  
  if (fs.attackUp) list.push({ key: 'attackUp', label: 'Attack Up' });
  if (fs.attackUpGreat) list.push({ key: 'attackUpGreat', label: 'Attack Up (Greater)' });
  if (fs.increasedSpeed || fs.casterSpeedUp) list.push({ key: 'increasedSpeed', label: 'Speed Up' });
  if (fs.casterVigor) list.push({ key: 'casterVigor', label: 'Vigor' });
  if (fs.casterEnraged) list.push({ key: 'casterEnraged', label: 'Enraged' });
  if (fs.increasedCritDamage) list.push({ key: 'increasedCritDamage', label: 'Crit Damage Up' });
  if (fs.casterPerception) list.push({ key: 'casterPerception', label: 'Perception' });
  if (fs.casterRampage) list.push({ key: 'casterRampage', label: 'Rampage' });
  if (fs.casterHasCascade) list.push({ key: 'casterHasCascade', label: 'Cascade' });
  if (fs.casterHasAbundance) list.push({ key: 'casterHasAbundance', label: 'Abundance' });
  if (fs.casterHasChallenge) list.push({ key: 'casterHasChallenge', label: 'Challenge' });
  if (fs.casterHasExplosives) list.push({ key: 'casterHasExplosives', label: 'Explosives' });
  if (fs.casterHasSpecialFriendship) list.push({ key: 'casterHasSpecialFriendship', label: 'Special Friendship' });
  if (fs.elementalAdvantage) list.push({ key: 'elementalAdvantage', label: 'Elemental Advantage' });

  return list.map(item => {
    let element: string | undefined = undefined;
    if (item.key === 'elementalAdvantage' && heroElement) {
      const elementMap: Record<string, string> = {
        fire: 'ice',
        ice: 'wind',
        wind: 'fire',
        light: 'dark',
        dark: 'light'
      };
      element = elementMap[heroElement] || '';
    }
    return {
      ...item,
      iconUrl: getToggleIcon(item.key, element)
    };
  });
};

const getActiveDebuffs = (profile: SavedBuildProfile): Array<{ key: string; label: string; iconUrl?: string }> => {
  const fs = profile.formState || {};
  const list: Array<{ key: string; label: string }> = [];
  
  if (fs.targetDefenseDown) list.push({ key: 'targetDefenseDown', label: 'Defense Down' });
  if (fs.targetTargeted) list.push({ key: 'targetTargeted', label: 'Targeted' });
  if (fs.targetVigor) list.push({ key: 'targetVigor', label: 'Target Vigor' });
  if (fs.targetRuptured) list.push({ key: 'targetRuptured', label: 'Ruptured' });
  if (fs.targetPilfered) list.push({ key: 'targetPilfered', label: 'Target Pilfered' });
  if (fs.targetHasTrauma) list.push({ key: 'targetHasTrauma', label: 'Trauma' });
  if (fs.targetMagicNailed) list.push({ key: 'targetMagicNailed', label: 'Magic Nailed' });
  if (fs.targetFractured) list.push({ key: 'targetFractured', label: 'Fractured' });
  if (fs.targetLaceration) list.push({ key: 'targetLaceration', label: 'Laceration' });
  if (fs.targetDefenseUp) list.push({ key: 'targetDefenseUp', label: 'Defense Up' });

  return list.map(item => ({
    ...item,
    iconUrl: getToggleIcon(item.key)
  }));
};

const getActiveSpecialConditions = (profile: SavedBuildProfile): Array<{ key: string; label: string; iconUrl?: string }> => {
  const fs = profile.formState || {};
  const list: Array<{ key: string; label: string }> = [];

  const specialBooleans = [
    { key: 'casterBelow30PercentHP', label: 'Caster < 30% HP' },
    { key: 'casterAboveHalfHP', label: 'Caster > 50% HP' },
    { key: 'targetAboveHalfHP', label: 'Target > 50% HP' },
    { key: 'targetHasBarrier', label: 'Target Has Barrier' },
    { key: 'targetHasDebuff', label: 'Target Has Debuff' },
    { key: 'casterFullFocus', label: 'Full Focus' },
    { key: 'casterFullFightingSpirit', label: 'Full Fighting Spirit' }
  ];

  specialBooleans.forEach(sb => {
    if (fs[sb.key] === true) {
      list.push({ key: sb.key, label: sb.label });
    }
  });

  const excludedKeys = [
    'heroID', 'atk', 'defense', 'hp', 'speed', 'critDamage', 'artifactLevel', 'artifactId',
    'penetrationSet', 'rageSet', 'torrentSetStack', 'pursuitSet', 'molagoras1', 'molagoras2', 'molagoras3',
    'attackUp', 'attackUpGreat', 'increasedSpeed', 'casterSpeedUp', 'casterVigor', 'casterEnraged', 
    'increasedCritDamage', 'casterPerception', 'casterRampage', 'casterHasCascade', 'casterHasAbundance', 
    'casterHasChallenge', 'casterHasExplosives', 'casterHasSpecialFriendship', 'elementalAdvantage',
    'targetDefenseDown', 'targetTargeted', 'targetVigor', 'targetRuptured', 'targetPilfered', 
    'targetHasTrauma', 'targetMagicNailed', 'targetFractured', 'targetLaceration', 'targetDefenseUp',
    'casterBelow30PercentHP', 'casterAboveHalfHP', 'targetAboveHalfHP', 'targetHasBarrier', 
    'targetHasDebuff', 'casterFullFocus', 'casterFullFightingSpirit'
  ];

  Object.entries(fs).forEach(([key, val]) => {
    if (excludedKeys.includes(key)) return;

    const defaultObj = FormDefaults[key];
    let defaultVal: any = undefined;
    if (defaultObj) {
      if (defaultObj.defaultValue !== undefined) {
        defaultVal = defaultObj.defaultValue;
      } else if (defaultObj.default !== undefined) {
        defaultVal = defaultObj.default;
      }
    } else {
      if (typeof val === 'boolean') {
        defaultVal = false;
      } else if (typeof val === 'number') {
        defaultVal = 0;
      }
    }

    if (val !== undefined && val !== null && val !== '' && val !== defaultVal) {
      let displayLabel = '';

      if (typeof val === 'boolean') {
        if (val) {
          displayLabel = formatFormLabel(key);
        } else {
          return;
        }
      } else if (typeof val === 'number') {
        const unit = key.toLowerCase().includes('percent') || (key.toLowerCase().includes('hp') && key.toLowerCase().includes('current')) ? '%' : '';
        displayLabel = `${formatFormLabel(key)}: ${val}${unit}`;
      } else {
        displayLabel = `${formatFormLabel(key)}: ${formatFormLabel(String(val))}`;
      }

      if (displayLabel) {
        list.push({ key, label: displayLabel });
      }
    }
  });

  return list.map(item => ({
    ...item,
    iconUrl: getToggleIcon(item.key)
  }));
};

export const CompareTab: React.FC<CompareTabProps> = ({
  heroName,
  selectedCompareIds,
  setSelectedCompareIds,
  onBackToSavedBuilds
}) => {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<SavedBuildProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Opponent target simulation states
  const [targetType, setTargetType] = useState<'preset' | 'custom_build'>('preset');
  const [presetIndex, setPresetIndex] = useState(1); // Default to Bruiser
  const [opponentBuildId, setOpponentBuildId] = useState<string>('');
  const [customHP, setCustomHP] = useState<number>(15000);
  const [customDef, setCustomDef] = useState<number>(1300);

  const targetPresets = [
    { name: 'Squishy (8k HP / 800 Def)', def: 800, hp: 8000 },
    { name: 'Bruiser (15k HP / 1.3k Def)', def: 1300, hp: 15000 },
    { name: 'Tank (25k HP / 1.8k Def)', def: 1800, hp: 25000 },
    { name: 'Mega Tank (32k HP / 2.2k Def)', def: 2200, hp: 32000 }
  ];

  const heroKey = useMemo(() => getHeroCalculatorKey(heroName), [heroName]);
  const hero = useMemo(() => Heroes[heroKey] || Heroes.abigail, [heroKey]);
  const heroElement = hero?.element;

  // Load all profiles from cache
  const loadProfiles = async () => {
    try {
      setLoading(true);
      const cached = await invoke<string | null>("cache_get", { key: "saved_damage_calc_builds" });
      if (cached) {
        setProfiles(JSON.parse(cached));
      } else {
        setProfiles([]);
      }
    } catch (e) {
      console.error("Failed to load profiles in CompareTab:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, []);

  // All saved builds are selectable as opponent target
  const opponentOptions = useMemo(() => {
    return profiles;
  }, [profiles]);

  // Opponent search input state
  const [opponentSearchQuery, setOpponentSearchQuery] = useState('');

  // Global simulation target statuses (debuffs and status effects)
  const [globalStatusEffects, setGlobalStatusEffects] = useState<Record<string, boolean>>({
    targetDefenseUp: false,
    targetVigor: false,
    targetDefenseDown: false,
    targetTargeted: false,
    targetRuptured: false,
    targetPilfered: false,
    targetHasTrauma: false,
    targetMagicNailed: false,
    targetFractured: false,
    targetLaceration: false
  });

  const toggleStatusEffect = (key: string) => {
    setGlobalStatusEffects(prev => {
      const next = { ...prev };
      const newVal = !prev[key];
      next[key] = newVal;

      // Mutual exclusions for target defense up and defense down
      if (key === 'targetDefenseUp' && newVal) {
        next.targetDefenseDown = false;
      }
      if (key === 'targetDefenseDown' && newVal) {
        next.targetDefenseUp = false;
      }

      return next;
    });
  };

  // Search-filtered opponent options
  const filteredOpponentOptions = useMemo(() => {
    if (!opponentSearchQuery.trim()) return opponentOptions;
    const q = opponentSearchQuery.toLowerCase();
    return opponentOptions.filter(p => 
      p.heroName.toLowerCase().includes(q) || 
      p.profileName.toLowerCase().includes(q)
    );
  }, [opponentOptions, opponentSearchQuery]);

  // Set default opponent build selection if none
  useEffect(() => {
    if (opponentOptions.length > 0 && !opponentBuildId) {
      setOpponentBuildId(opponentOptions[0].id);
    }
  }, [opponentOptions, opponentBuildId]);

  // Resolve compared profiles list
  const comparedProfiles = useMemo(() => {
    return profiles.filter(p => selectedCompareIds.includes(p.id));
  }, [profiles, selectedCompareIds]);

  // Sync initial custom def/hp based on target preset or custom build
  useEffect(() => {
    if (comparedProfiles.length >= 2 && profiles.length > 0 && loading === false) {
      // Set initial HP and Def once loaded
      const preset = targetPresets[presetIndex] || targetPresets[1];
      setCustomHP(preset.hp);
      setCustomDef(preset.def);
    }
  }, [loading, profiles.length]);

  // Compute live compared stats against opponent HP and Def sliders
  const comparedProfilesStats = useMemo(() => {
    return comparedProfiles.map(p => {
      const atk = Number(p.atk || 0);
      const def = Number(p.defense || 0);
      const hp = Number(p.hp || 0);
      const spd = Number(p.speed || 0);
      const cd = Number(p.critDamage || 0);

      // EHP = HP * (1 + Defense / 300)
      const ehp = Math.round(hp * (1 + def / 300));
      
      // Damage Score = Attack * (Crit Damage / 100)
      const dmgScore = Math.round(atk * (cd / 100));

      // Prepare overrides specifically for target statuses, leaving caster buffs completely untouched
      const targetStatusOverrides: Record<string, any> = {
        targetDefenseUp: false,
        targetVigor: false,
        targetDefenseDown: false,
        targetTargeted: false,
        targetRuptured: false,
        targetPilfered: false,
        targetHasTrauma: false,
        targetMagicNailed: false,
        targetFractured: false,
        targetLaceration: false
      };

      Object.entries(globalStatusEffects).forEach(([key, value]) => {
        targetStatusOverrides[key] = value;
      });

      // Headless damage calculation with global target overrides
      const dmgOutput = calculateProfileDamage(p, customHP, customDef, targetStatusOverrides);

      return {
        profile: p,
        atk,
        def,
        hp,
        spd,
        cd,
        ehp,
        dmgScore,
        dmgOutput
      };
    });
  }, [comparedProfiles, customHP, customDef, globalStatusEffects]);

  // Maximum statistics among compared profiles for best-in-class highlighters
  const maxValues = useMemo(() => {
    if (comparedProfilesStats.length === 0) {
      return { atk: 0, defense: 0, hp: 0, speed: 0, cd: 0, ehp: 0, dmgScore: 0 };
    }
    return {
      atk: Math.max(...comparedProfilesStats.map(item => item.atk)),
      defense: Math.max(...comparedProfilesStats.map(item => item.def)),
      hp: Math.max(...comparedProfilesStats.map(item => item.hp)),
      speed: Math.max(...comparedProfilesStats.map(item => item.spd)),
      cd: Math.max(...comparedProfilesStats.map(item => item.cd)),
      ehp: Math.max(...comparedProfilesStats.map(item => item.ehp)),
      dmgScore: Math.max(...comparedProfilesStats.map(item => item.dmgScore))
    };
  }, [comparedProfilesStats]);

  // Recharts structures
  const compareChartData = useMemo(() => {
    if (comparedProfilesStats.length === 0) return { damageChartData: [], ehpChartData: [] };

    const skills = ['s1', 's2', 's3'];
    const damageChartData = skills.map(skillId => {
      const dataRow: Record<string, any> = { name: skillId.toUpperCase() };
      comparedProfilesStats.forEach((item, index) => {
        const dmgRow = item.dmgOutput.damages.find(d => 
          d.skill.toLowerCase() === skillId || 
          d.skill.toLowerCase().startsWith(skillId + '_')
        );
        const val = dmgRow ? (dmgRow.crit !== null ? dmgRow.crit : (dmgRow.normal !== null ? dmgRow.normal : 0)) : 0;
        dataRow[`Build_${index}`] = val;
        dataRow[`Build_${index}_name`] = item.profile.profileName;
      });
      return dataRow;
    });

    const ehpChartData = comparedProfilesStats.map((item, index) => {
      return {
        name: item.profile.profileName,
        'Effective HP': item.ehp,
        'Damage Score': item.dmgScore,
        fillColor: COMPARE_COLORS[index]
      };
    });

    return { damageChartData, ehpChartData };
  }, [comparedProfilesStats]);

  const activeTargetSpecs = useMemo(() => {
    if (presetIndex === -1 && targetType === 'preset') {
      return { hp: customHP, def: customDef, label: `Custom Target (${customHP.toLocaleString()} HP / ${customDef.toLocaleString()} Def)` };
    }
    if (targetType === 'preset') {
      const preset = targetPresets[presetIndex] || targetPresets[1];
      return { hp: preset.hp, def: preset.def, label: preset.name };
    } else {
      const opponent = opponentOptions.find(p => p.id === opponentBuildId);
      if (opponent) {
        return { 
          hp: opponent.hp, 
          def: opponent.defense, 
          label: `${opponent.heroName} (${opponent.profileName} - ${opponent.hp} HP / ${opponent.defense} Def)` 
        };
      }
      return { hp: 15000, def: 1300, label: 'Bruiser Preset (Fallback)' };
    }
  }, [targetType, presetIndex, opponentBuildId, opponentOptions, customHP, customDef]);

  const getActiveSetsList = (formState: Record<string, any> = {}) => {
    const list: string[] = [];
    if (formState.rageSet) list.push('setrage');
    if (formState.penetrationSet) list.push('setpenetration');
    if (formState.torrentSetStack > 0) list.push('settorrent');
    if (formState.pursuitSet) list.push('set_chase');
    return list;
  };

  const getSetDisplayName = (setName: string) => {
    if (setName === 'setrage') return 'Rage';
    if (setName === 'setpenetration') return 'Pen';
    if (setName === 'settorrent') return 'Torrent';
    if (setName === 'set_chase') return 'Pursuit';
    return '';
  };

  // If no builds are selected, display the glassmorphic card explaining how to select builds
  if (loading === false && comparedProfiles.length < 2) {
    return (
      <div className="compare-tab-empty-container">
        <div className="no-builds-card dashboard-card">
          <div className="no-builds-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#00f2fe" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 242, 254, 0.4))' }}>
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
          </div>
          <h3>Builds Comparison Dashboard</h3>
          <p>
            You haven't selected enough saved builds to compare. Please go back to the <strong>Saved Builds</strong> tab, select at least 2 builds using the checkboxes, and then return here!
          </p>
          <button className="compare-back-btn glow-cyan" onClick={onBackToSavedBuilds}>
            Return to Saved Builds
          </button>
        </div>
      </div>
    );
  }

  const targetDebuffsList = [
    { key: 'targetDefenseUp', label: 'Defense Up', iconUrl: getToggleIcon('targetDefenseUp') },
    { key: 'targetVigor', label: 'Vigor', iconUrl: getToggleIcon('targetVigor') },
    { key: 'targetDefenseDown', label: 'Def Down', iconUrl: getToggleIcon('targetDefenseDown') },
    { key: 'targetTargeted', label: 'Targeted', iconUrl: getToggleIcon('targetTargeted') },
    { key: 'targetRuptured', label: 'Ruptured', iconUrl: getToggleIcon('targetRuptured') },
    { key: 'targetPilfered', label: 'Pilfered', iconUrl: getToggleIcon('targetPilfered') },
    { key: 'targetHasTrauma', label: 'Trauma', iconUrl: getToggleIcon('targetHasTrauma') },
    { key: 'targetMagicNailed', label: 'Magic Nailed', iconUrl: getToggleIcon('targetMagicNailed') },
    { key: 'targetFractured', label: 'Fractured', iconUrl: getToggleIcon('targetFractured') },
    { key: 'targetLaceration', label: 'Laceration', iconUrl: getToggleIcon('targetLaceration') }
  ];

  return (
    <div className="compare-tab-container">
      
      {/* ── 1. Target Recalculation Control Card (Premium Glassmorphic Split-Pane) ── */}
      <div className="compare-target-control-bar dashboard-card">
        
        {/* Left Column: Searchable Saved Builds List (Always Visible) */}
        <div className="target-control-left-pane">
          <div className="target-control-group opponent-search-selection-group">
            <label className="target-control-label">Saved Builds (Click to Inject Stats)</label>
            <div className="opponent-search-wrapper">
              <input
                type="text"
                className="opponent-search-input"
                placeholder="Search saved builds by name..."
                value={opponentSearchQuery}
                onChange={(e) => setOpponentSearchQuery(e.target.value)}
              />
            </div>
            <div className="opponent-builds-compact-list">
              {filteredOpponentOptions.map(p => {
                const isSelected = targetType === 'custom_build' && opponentBuildId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`opponent-compact-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      setOpponentBuildId(p.id);
                      setCustomHP(Number(p.hp));
                      setCustomDef(Number(p.defense));
                      setTargetType('custom_build');
                    }}
                  >
                    <HeroMiniPortrait heroName={p.heroName} size={20} className="compact-portrait" />
                    <div className="opponent-item-details">
                      <span className="opponent-item-name">{p.heroName} • {p.profileName}</span>
                      <span className="opponent-item-stats">HP: {Number(p.hp).toLocaleString()} | Def: {Number(p.defense).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
              {filteredOpponentOptions.length === 0 && (
                <div className="no-opponents-found">No saved builds found</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Presets & Sliders */}
        <div className="target-control-right-pane">
          
          {/* Target Preset Selection */}
          <div className="target-control-group">
            <label className="target-control-label">Target Preset (Click to Inject Stats)</label>
            <div className="compare-preset-buttons">
              {targetPresets.map((preset, idx) => (
                <button
                  key={preset.name}
                  className={`compare-preset-btn ${targetType === 'preset' && presetIndex === idx ? 'active' : ''}`}
                  onClick={() => {
                    setTargetType('preset');
                    setPresetIndex(idx);
                    setCustomHP(preset.hp);
                    setCustomDef(preset.def);
                  }}
                >
                  {preset.name.split(' (')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders Container with Global Status Effects directly above */}
          <div className="target-sliders-container">
               {/* Global Target Statuses directly above sliders */}
            <div className="compare-global-status-effects">
              <div className="status-effects-group">
                <span className="target-control-label">Target Statuses</span>
                <div className="global-status-buttons target-statuses">
                  {targetDebuffsList.map(d => {
                    const isActive = !!globalStatusEffects[d.key];
                    const isBuff = d.key === 'targetDefenseUp' || d.key === 'targetVigor';
                    return (
                      <button
                        key={d.key}
                        className={`status-toggle-btn ${isBuff ? 'buff' : 'debuff'} ${isActive ? 'active' : ''}`}
                        onClick={() => toggleStatusEffect(d.key)}
                        title={d.label}
                      >
                        {d.iconUrl ? (
                          <img src={d.iconUrl} className="status-toggle-icon" alt={d.label} />
                        ) : (
                          <span>{d.label}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="target-sliders-row">
              <div className="target-control-group slider-group">
                <div className="slider-label-row">
                  <span className="target-control-label">Target Defense</span>
                  <span className="slider-value-indicator glowing-cyan-text">{customDef.toLocaleString()} Def</span>
                </div>
                <input
                  type="range"
                  className="compare-range-slider"
                  min="500"
                  max="3500"
                  step="50"
                  value={customDef}
                  onChange={(e) => {
                    setCustomDef(Number(e.target.value));
                    setTargetType('preset');
                    setPresetIndex(-1); // Custom override
                  }}
                />
              </div>

              <div className="target-control-group slider-group">
                <div className="slider-label-row">
                  <span className="target-control-label">Target HP (Health)</span>
                  <span className="slider-value-indicator glowing-cyan-text">{customHP.toLocaleString()} HP</span>
                </div>
                <input
                  type="range"
                  className="compare-range-slider"
                  min="3000"
                  max="45000"
                  step="250"
                  value={customHP}
                  onChange={(e) => {
                    setCustomHP(Number(e.target.value));
                    setTargetType('preset');
                    setPresetIndex(-1); // Custom override
                  }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── 2. Dual Grouped Bar Charts Row (Moved to Top) ── */}
      <div className="compare-charts-row">
        
        {/* PvP Damages Recalculation Chart */}
        <div className="compare-chart-card dashboard-card">
          <h3>PvP Simulation Damage (Recalculated)</h3>
          <div className="chart-target-indicator">
            Simulating Target: {customDef.toLocaleString()} Def • {customHP.toLocaleString()} HP
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={compareChartData.damageChartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(255, 255, 255, 0.4)"
                  tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 11, fontWeight: 600 }}
                />
                <YAxis 
                  stroke="rgba(255, 255, 255, 0.4)"
                  tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 10 }}
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                />
                <ChartTooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const skillName = payload[0].payload.name;
                      return (
                        <div className="custom-tooltip charts-tooltip">
                          <p className="tooltip-title">{skillName} Damage</p>
                          {payload.map((entry: any, index: number) => (
                            <p key={index} style={{ color: COMPARE_COLORS[index], margin: '3px 0', fontSize: '11px', fontWeight: 600 }}>
                              {entry.name}: {entry.value.toLocaleString()}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {comparedProfilesStats.map((item, index) => (
                  <Bar 
                    key={item.profile.id}
                    name={item.profile.profileName}
                    dataKey={`Build_${index}`} 
                    fill={COMPARE_COLORS[index]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                ))}
                <ChartLegend
                  content={({ payload }: any) => (
                    <div className="custom-legend-container compare-legend">
                      {payload.map((entry: any, index: number) => (
                        <div key={index} className="custom-legend-item">
                          <span className="legend-bullet" style={{ backgroundColor: COMPARE_COLORS[index] }} />
                          <span className="legend-text" style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '10px' }}>{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* EHP & Damage Score Chart */}
        <div className="compare-chart-card dashboard-card">
          <h3>Durability & Power Analysis</h3>
          <div className="chart-target-indicator secondary">
            Contrasting Effective Health (EHP) vs. Raw Damage Score
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={compareChartData.ehpChartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis 
                  dataKey="name" 
                  stroke="rgba(255, 255, 255, 0.4)"
                  tick={{ fill: 'rgba(255, 255, 255, 0.7)', fontSize: 10, fontWeight: 500 }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke="rgba(0, 242, 254, 0.6)"
                  tick={{ fill: 'rgba(0, 242, 254, 0.8)', fontSize: 9 }}
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="rgba(255, 183, 0, 0.6)"
                  tick={{ fill: 'rgba(255, 183, 0, 0.8)', fontSize: 9 }}
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                />
                <ChartTooltip
                  content={({ active, payload }: any) => {
                    if (active && payload && payload.length) {
                      const buildName = payload[0].payload.name;
                      return (
                        <div className="custom-tooltip charts-tooltip">
                          <p className="tooltip-title">{buildName}</p>
                          <p style={{ color: '#00f2fe', margin: '3px 0', fontSize: '11px', fontWeight: 600 }}>
                            Effective HP: {payload[0].value.toLocaleString()}
                          </p>
                          <p style={{ color: '#ffb700', margin: '3px 0', fontSize: '11px', fontWeight: 600 }}>
                            Damage Score: {payload[1].value.toLocaleString()}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  yAxisId="left"
                  dataKey="Effective HP" 
                  fill="#00f2fe"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <Bar 
                  yAxisId="right"
                  dataKey="Damage Score" 
                  fill="#ffb700"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
                <ChartLegend
                  content={() => (
                    <div className="custom-legend-container compare-legend">
                      <div className="custom-legend-item">
                        <span className="legend-bullet" style={{ backgroundColor: '#00f2fe' }} />
                        <span className="legend-text" style={{ color: '#00f2fe', fontSize: '10px', fontWeight: 600 }}>Effective HP (Left Axis)</span>
                      </div>
                      <div className="custom-legend-item">
                        <span className="legend-bullet" style={{ backgroundColor: '#ffb700' }} />
                        <span className="legend-text" style={{ color: '#ffb700', fontSize: '10px', fontWeight: 600 }}>Damage Score (Right Axis)</span>
                      </div>
                    </div>
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ── 3. Rotated Horizontal High-Density Table (Abbreviated, Space-Saving Headers) ── */}
      <div className="compare-table-card dashboard-card">
        <div className="compare-table-wrapper horizontal-scrollable">
          <table className="compare-table horizontal">
            <thead>
              <tr>
                <th>PROFILE</th>
                <th className="centered-col">EHP</th>
                <th className="centered-col">DMS</th>
                <th className="centered-col">ATK</th>
                <th className="centered-col">DEF</th>
                <th className="centered-col">HP</th>
                <th className="centered-col">SPD</th>
                <th className="centered-col">CHD</th>
                <th>SETS</th>
                <th className="centered-col">ART</th>
                <th className="centered-col">MOLA</th>
                <th className="centered-col">BUFFS</th>
                <th className="centered-col">DEBUFFS</th>
                <th>SPECIAL</th>
              </tr>
            </thead>
            <tbody>
              {comparedProfilesStats.map((item, idx) => {
                const activeSets = getActiveSetsList(item.profile.formState);
                const buffs = getActiveBuffs(item.profile, heroElement);
                const debuffs = getActiveDebuffs(item.profile);
                const conditions = getActiveSpecialConditions(item.profile);

                const isMaxEhp = item.ehp === maxValues.ehp && comparedProfilesStats.length > 1;
                const isMaxDmg = item.dmgScore === maxValues.dmgScore && comparedProfilesStats.length > 1;
                const isMaxAtk = item.atk === maxValues.atk && comparedProfilesStats.length > 1;
                const isMaxDef = item.def === maxValues.defense && comparedProfilesStats.length > 1;
                const isMaxHP = item.hp === maxValues.hp && comparedProfilesStats.length > 1;
                const isMaxSpd = item.spd === maxValues.speed && comparedProfilesStats.length > 1;
                const isMaxCD = item.cd === maxValues.cd && comparedProfilesStats.length > 1;

                return (
                  <tr key={item.profile.id}>
                    <td className="build-label-cell">
                      <div className="compare-th-content">
                        <span className="build-index-dot" style={{ backgroundColor: COMPARE_COLORS[idx] }} />
                        <HeroMiniPortrait heroName={item.profile.heroName} size={24} className="compact-portrait" />
                        <span className="build-th-name" title={item.profile.profileName}>{item.profile.profileName}</span>
                      </div>
                    </td>
                    
                    <td className={`centered-col stat-cell ${isMaxEhp ? 'max-text-ehp' : ''}`}>
                      {item.ehp.toLocaleString()}
                    </td>

                    <td className={`centered-col stat-cell ${isMaxDmg ? 'max-text-dmg' : ''}`}>
                      {item.dmgScore.toLocaleString()}
                    </td>

                    <td className={`centered-col stat-cell ${isMaxAtk ? 'max-text-atk' : ''}`}>
                      {item.atk.toLocaleString()}
                    </td>

                    <td className={`centered-col stat-cell ${isMaxDef ? 'max-text-def' : ''}`}>
                      {item.def.toLocaleString()}
                    </td>

                    <td className={`centered-col stat-cell ${isMaxHP ? 'max-text-hp' : ''}`}>
                      {item.hp.toLocaleString()}
                    </td>

                    <td className={`centered-col stat-cell ${isMaxSpd ? 'max-text-spd' : ''}`}>
                      {item.spd}
                    </td>

                    <td className={`centered-col stat-cell ${isMaxCD ? 'max-text-chd' : ''}`}>
                      {item.cd}%
                    </td>

                    <td>
                      <div className="compare-sets-list horizontal-list">
                        {activeSets.map(set => (
                          <div key={set} className="active-set-chip compact" title={getSetDisplayName(set)}>
                            <img src={getSetIconUrl(set)} className="set-chip-icon" alt="" />
                            <span>{getSetDisplayName(set).split(' ')[0]}</span>
                          </div>
                        ))}
                        {activeSets.length === 0 && <span className="empty-compare-text">-</span>}
                      </div>
                    </td>

                    <td className="centered-col compact-art-cell">
                      <img 
                        src={getArtifactIcon(item.profile.artifactId)} 
                        className="compare-art-icon-only" 
                        title={`${formatArtifactName(item.profile.artifactId)} (+${item.profile.artifactLevel})`} 
                        alt="" 
                      />
                    </td>

                    <td className="centered-col molas-flat-cell">
                      {item.profile.molagoras1}/{item.profile.molagoras2}/{item.profile.molagoras3}
                    </td>

                    <td className="centered-col">
                      <div className="compare-buffs-list compact-list horizontal-icons centered-icons">
                        {buffs.map(b => (
                          <img 
                            key={b.key} 
                            src={b.iconUrl} 
                            className="compare-flat-icon-badge" 
                            title={b.label} 
                            alt={b.label} 
                          />
                        ))}
                        {buffs.length === 0 && <span className="empty-compare-text">-</span>}
                      </div>
                    </td>

                    <td className="centered-col">
                      <div className="compare-buffs-list compact-list horizontal-icons centered-icons">
                        {debuffs.map(d => (
                          <img 
                            key={d.key} 
                            src={d.iconUrl} 
                            className="compare-flat-icon-badge" 
                            title={d.label} 
                            alt={d.label} 
                          />
                        ))}
                        {debuffs.length === 0 && <span className="empty-compare-text">-</span>}
                      </div>
                    </td>

                    <td>
                      <div className="compare-buffs-list compact-list">
                        {conditions.map(c => (
                          <div key={c.key} className="diag-tag compact" title={c.label}>
                            {c.iconUrl && <img src={c.iconUrl} className="diag-tag-icon" alt="" />}
                            <span>{c.label}</span>
                          </div>
                        ))}
                        {conditions.length === 0 && <span className="empty-compare-text">-</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
