import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
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
import { SavedBuildProfile, calculateProfileDamage, CalculatedDamageOutput } from '../../services/damageCalc/profileCalc';
import { formatFormLabel, FormDefaults, Heroes, getHeroCalculatorKey } from '../../services/damageCalc/damageService';
import { useDamageCalculatorService } from '../../context/DamageCalculatorContext';
import './SavedBuildsTab.css';

const COMPARE_COLORS = ['#00f2fe', '#ff007f', '#10b981', '#ffb700'];

interface SavedBuildsTabProps {
  heroName: string;
  onLoadIntoCalculator: (profile: SavedBuildProfile) => void;
  selectedCompareIds: string[];
  setSelectedCompareIds: React.Dispatch<React.SetStateAction<string[]>>;
  onStartComparison: () => void;
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

// Retrieve official E7 game asset icons for buffs, debuffs, and elements
const getToggleIcon = (key: string, advantageousElement?: string): string => {
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

// Config parsing helpers to retrieve active setups with corresponding icons
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

  // 1. Explicitly check standard special boolean conditions (if true)
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

  // 2. Scan all other keys in formState (numeric sliders, dropdowns, inputs, and hero-specific/artifact-specific parameters)
  const excludedKeys = [
    // Core stats & sets
    'heroID', 'atk', 'defense', 'hp', 'speed', 'critDamage', 'artifactLevel', 'artifactId',
    'penetrationSet', 'rageSet', 'torrentSetStack', 'pursuitSet', 'molagoras1', 'molagoras2', 'molagoras3',
    // Buffs & Debuffs (already displayed in their own rows)
    'attackUp', 'attackUpGreat', 'increasedSpeed', 'casterSpeedUp', 'casterVigor', 'casterEnraged', 
    'increasedCritDamage', 'casterPerception', 'casterRampage', 'casterHasCascade', 'casterHasAbundance', 
    'casterHasChallenge', 'casterHasExplosives', 'casterHasSpecialFriendship', 'elementalAdvantage',
    'targetDefenseDown', 'targetTargeted', 'targetVigor', 'targetRuptured', 'targetPilfered', 
    'targetHasTrauma', 'targetMagicNailed', 'targetFractured', 'targetLaceration', 'targetDefenseUp',
    // Exclude the booleans we handled in step 1 to prevent duplication
    'casterBelow30PercentHP', 'casterAboveHalfHP', 'targetAboveHalfHP', 'targetHasBarrier', 
    'targetHasDebuff', 'casterFullFocus', 'casterFullFightingSpirit'
  ];

  Object.entries(fs).forEach(([key, val]) => {
    if (excludedKeys.includes(key)) return;

    // Check if it is an active/non-default value
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

    // We consider it "active" if it is different from default value
    if (val !== undefined && val !== null && val !== '' && val !== defaultVal) {
      let displayLabel = '';

      if (typeof val === 'boolean') {
        if (val) {
          displayLabel = formatFormLabel(key);
        } else {
          return; // Don't show inactive booleans
        }
      } else if (typeof val === 'number') {
        // Render number values beautifully with their unit (e.g. % for HP, count for deaths/stacks)
        const unit = key.toLowerCase().includes('percent') || (key.toLowerCase().includes('hp') && key.toLowerCase().includes('current')) ? '%' : '';
        displayLabel = `${formatFormLabel(key)}: ${val}${unit}`;
      } else {
        // Strings / Dropdowns
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

export const SavedBuildsTab: React.FC<SavedBuildsTabProps> = ({
  heroName,
  onLoadIntoCalculator,
  selectedCompareIds,
  setSelectedCompareIds,
  onStartComparison
}) => {
  const { t } = useTranslation();
  const damageCalculatorService = useDamageCalculatorService();
  const [profiles, setProfiles] = useState<SavedBuildProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter and Search States
  const [filterMode, setFilterMode] = useState<'current' | 'all'>('current');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded Profile for Quick Calculator
  const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null);

  const toggleCompareSelection = (id: string) => {
    setSelectedCompareIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        if (prev.length >= 4) {
          alert("You can compare up to 4 builds simultaneously.");
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  // Target overrides for instant calculations
  const [targetType, setTargetType] = useState<'preset' | 'custom_build'>('preset');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(1); // Default to Bruiser
  const [selectedOpponentBuildId, setSelectedOpponentBuildId] = useState<string>('');

  const targetPresets = [
    { name: 'Squishy (8k HP / 800 Def)', def: 800, hp: 8000 },
    { name: 'Bruiser (15k HP / 1.3k Def)', def: 1300, hp: 15000 },
    { name: 'Tank (25k HP / 1.8k Def)', def: 1800, hp: 25000 },
    { name: 'Mega Tank (32k HP / 2.2k Def)', def: 2200, hp: 32000 }
  ];

  // Resolve active hero details to extract elemental characteristics
  const heroKey = useMemo(() => getHeroCalculatorKey(heroName), [heroName]);
  const hero = useMemo(() => Heroes[heroKey] || Heroes.abigail, [heroKey]);
  const heroElement = hero?.element;

  // Load profiles from context on mount
  const loadProfiles = async () => {
    try {
      setLoading(true);
      const list = await damageCalculatorService.getProfilesByHero(heroName); // Actually get all profiles for the filterMode logic to work
      setProfiles(list);
    } catch (e) {
      console.error("Failed to load saved builds:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [heroName, damageCalculatorService]);

  const handleDeleteProfile = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this saved build profile?")) return;

    try {
      await damageCalculatorService.deleteProfile(id);
      
      // Reload profiles
      const list = await damageCalculatorService.getProfilesByHero(heroName);
      setProfiles(list);
      
      if (expandedProfileId === id) setExpandedProfileId(null);
    } catch (e) {
      console.error("Failed to delete profile:", e);
    }
  };

  // Filtered profiles list
  const filteredProfiles = useMemo(() => {
    let list = profiles;
    if (filterMode === 'current') {
      list = list.filter(p => p.heroName.toLowerCase() === heroName.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.profileName.toLowerCase().includes(q) || 
        p.heroName.toLowerCase().includes(q)
      );
    }
    // Sort by saved time descending
    return [...list].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }, [profiles, filterMode, heroName, searchQuery]);

  // List of other profiles for target opponent selection
  const opponentOptions = useMemo(() => {
    return profiles.filter(p => p.id !== expandedProfileId);
  }, [profiles, expandedProfileId]);

  // Auto-select first opponent option if none is selected
  useEffect(() => {
    if (opponentOptions.length > 0 && !selectedOpponentBuildId) {
      setSelectedOpponentBuildId(opponentOptions[0].id);
    }
  }, [opponentOptions, selectedOpponentBuildId]);


  // Active calculations target specs
  const activeTargetSpecs = useMemo(() => {
    if (targetType === 'preset') {
      const preset = targetPresets[selectedPresetIndex] || targetPresets[1];
      return { hp: preset.hp, def: preset.def, label: preset.name };
    } else {
      const opponent = opponentOptions.find(p => p.id === selectedOpponentBuildId);
      if (opponent) {
        return { 
          hp: opponent.hp, 
          def: opponent.defense, 
          label: `${opponent.heroName} (${opponent.profileName} - ${opponent.hp} HP / ${opponent.defense} Def)` 
        };
      }
      return { hp: 15000, def: 1300, label: 'Bruiser Preset (Fallback)' };
    }
  }, [targetType, selectedPresetIndex, selectedOpponentBuildId, opponentOptions]);

  // Expanded Profile Calculation Output
  const calculationOutput = useMemo<CalculatedDamageOutput | null>(() => {
    if (!expandedProfileId) return null;
    const profile = profiles.find(p => p.id === expandedProfileId);
    if (!profile) return null;

    return calculateProfileDamage(profile, activeTargetSpecs.hp, activeTargetSpecs.def);
  }, [expandedProfileId, profiles, activeTargetSpecs]);

  // Resolve active sets saved in formState
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

  return (
    <div className="saved-builds-tab-container">
      {/* ── TOP CONTROL PANEL ── */}
      <div className="saved-builds-header">
        <div className="header-left">
          <h2>{t('savedBuilds.title', 'Saved Build Profiles')}</h2>
          <p>Instantly compare damage formulas and simulated stats across saved configurations.</p>
        </div>

        <div className="header-right">
          <div className="search-filter-controls">
            <input
              type="text"
              className="saved-builds-search"
              placeholder="Search by profile name or hero..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="filter-mode-toggles">
              <button
                className={`filter-btn ${filterMode === 'current' ? 'active' : ''}`}
                onClick={() => setFilterMode('current')}
              >
                {heroName} Builds
              </button>
              <button
                className={`filter-btn ${filterMode === 'all' ? 'active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                All Heroes
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="saved-builds-loading">
          <div className="loading-spinner"></div>
          <span>Syncing with SQLite Cache Database...</span>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="no-builds-card">
          <div className="no-builds-icon">
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
          </div>
          <h3>No Saved Build Profiles Found</h3>
          <p>
            You haven't saved any build profiles for {filterMode === 'current' ? heroName : 'any heroes'} yet.
            Go to the Damage Calculator tab, configure your stats, sets, and buffs, then click Save Profile in the top bar!
          </p>
        </div>
      ) : (
        <div className="saved-builds-list">
          {filteredProfiles.map(profile => {
            const isExpanded = expandedProfileId === profile.id;
            const activeSets = getActiveSetsList(profile.formState);

            const activeBuffs = getActiveBuffs(profile, heroElement);
            const activeDebuffs = getActiveDebuffs(profile);
            const activeConditions = getActiveSpecialConditions(profile);

            return (
              <div key={profile.id} className={`profile-card ${isExpanded ? 'expanded glow-cyan' : ''}`}>
                <div 
                  className="profile-card-header"
                  onClick={() => setExpandedProfileId(isExpanded ? null : profile.id)}
                >
                  <div className="header-info-group">
                    <div 
                      className="compare-checkbox-wrapper" 
                      onClick={(e) => {
                        e.stopPropagation(); // Stop expansion toggle
                      }}
                    >
                      <label className="cyber-checkbox-container">
                        <input 
                          type="checkbox" 
                          checked={selectedCompareIds.includes(profile.id)}
                          onChange={() => toggleCompareSelection(profile.id)}
                        />
                        <span className="cyber-checkmark"></span>
                      </label>
                    </div>
                    <HeroMiniPortrait heroName={profile.heroName} size={36} className="profile-hero-portrait" />
                    <div className="header-text-container">
                      <h3 className="profile-name-title">{profile.profileName}</h3>
                      <div className="header-sub-meta">
                        <span className="profile-hero-name">{profile.heroName}</span>
                        <span className="profile-meta-dot">•</span>
                        <span className="profile-date">
                          {new Date(profile.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="header-badge-group">
                    {/* Render active set badges */}
                    {activeSets.map(set => (
                      <div key={set} className="active-set-chip">
                        <img src={getSetIconUrl(set)} className="set-chip-icon" alt="" />
                        <span>{getSetDisplayName(set)}</span>
                      </div>
                    ))}

                    <div className="header-actions">
                      <button
                        className="card-action-btn load-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadIntoCalculator(profile);
                        }}
                        title="Load into active Damage Calculator"
                      >
                        Load
                      </button>
                      <button
                        className="card-action-btn delete-btn"
                        onClick={(e) => handleDeleteProfile(profile.id, e)}
                        title="Delete Build Profile"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}
                      >
                        <svg className="trash-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Main Stats Summary */}
                <div className="profile-card-stats-row" onClick={() => setExpandedProfileId(isExpanded ? null : profile.id)}>
                  <div className="summary-stat-box">
                    <span className="stat-lbl">Atk</span>
                    <span className="stat-val">{profile.atk.toLocaleString()}</span>
                  </div>
                  <div className="summary-stat-box">
                    <span className="stat-lbl">Crit Dmg</span>
                    <span className="stat-val">{profile.critDamage}%</span>
                  </div>
                  <div className="summary-stat-box">
                    <span className="stat-lbl">HP</span>
                    <span className="stat-val">{profile.hp.toLocaleString()}</span>
                  </div>
                  <div className="summary-stat-box">
                    <span className="stat-lbl">Def</span>
                    <span className="stat-val">{profile.defense.toLocaleString()}</span>
                  </div>
                  <div className="summary-stat-box">
                    <span className="stat-lbl">Spd</span>
                    <span className="stat-val">{profile.speed}</span>
                  </div>

                  <div className="summary-artifact-box">
                    <img 
                      src={getArtifactIcon(profile.artifactId)} 
                      onError={(e) => { e.currentTarget.src = getArtifactIcon('noProc'); }}
                      className="artifact-thumbnail"
                      alt=""
                    />
                    <div className="art-name-details">
                      <span className="art-title">{formatArtifactName(profile.artifactId)}</span>
                      <span className="art-lvl">+{profile.artifactLevel}</span>
                    </div>
                  </div>
                </div>

                {/* ── EXPANDED QUICK CALCULATOR SECTION ── */}
                {isExpanded && (
                  <div className="quick-calculator-panel">
                    <div className="quick-calc-divider"></div>

                    {/* Diagnostics: Active Buffs, Debuffs, and Special Conditions */}
                    <div className="profile-config-diagnostic">
                      {activeBuffs.length > 0 && (
                        <div className="diagnostic-group">
                          <span className="diagnostic-hdr">Caster Buffs</span>
                          <div className="diagnostic-tags">
                            {activeBuffs.map(b => (
                              <span key={b.key} className="diag-tag buff-tag">
                                {b.iconUrl && <img src={b.iconUrl} className="diag-tag-icon" alt="" />}
                                <span>{b.label}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeDebuffs.length > 0 && (
                        <div className="diagnostic-group">
                          <span className="diagnostic-hdr">Target Debuffs</span>
                          <div className="diagnostic-tags">
                            {activeDebuffs.map(d => (
                              <span key={d.key} className="diag-tag debuff-tag">
                                {d.iconUrl && <img src={d.iconUrl} className="diag-tag-icon" alt="" />}
                                <span>{d.label}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeConditions.length > 0 && (
                        <div className="diagnostic-group">
                          <span className="diagnostic-hdr">Special Conditions</span>
                          <div className="diagnostic-tags">
                            {activeConditions.map(c => (
                              <span key={c.key} className="diag-tag cond-tag">
                                {c.iconUrl && <img src={c.iconUrl} className="diag-tag-icon" alt="" />}
                                <span>{c.label}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="diagnostic-group">
                        <span className="diagnostic-hdr">Skill Enhancements</span>
                        <div className="diagnostic-tags">
                          <span className="diag-tag mola-tag">S1: +{profile.molagoras1}</span>
                          <span className="diag-tag mola-tag">S2: +{profile.molagoras2}</span>
                          <span className="diag-tag mola-tag">S3: +{profile.molagoras3}</span>
                        </div>
                      </div>
                    </div>

                    <div className="quick-calc-divider"></div>

                    {/* Opponent Target Selector Header */}
                    <div className="target-select-bar">
                      <div className="target-bar-left">
                        <span className="target-bar-title">Opponent Target:</span>
                        <div className="target-mode-toggles">
                          <button
                            className={`target-mode-btn ${targetType === 'preset' ? 'active' : ''}`}
                            onClick={() => setTargetType('preset')}
                          >
                            Presets
                          </button>
                          <button
                            className={`target-mode-btn ${targetType === 'custom_build' ? 'active' : ''}`}
                            onClick={() => setTargetType('custom_build')}
                            disabled={opponentOptions.length === 0}
                          >
                            My Saved builds ({opponentOptions.length})
                          </button>
                        </div>
                      </div>

                      <div className="target-bar-right">
                        {targetType === 'preset' ? (
                          <div className="presets-row">
                            {targetPresets.map((pr, idx) => (
                              <button
                                key={pr.name}
                                className={`target-tag-btn ${selectedPresetIndex === idx ? 'active' : ''}`}
                                onClick={() => setSelectedPresetIndex(idx)}
                              >
                                {pr.name.split(' (')[0]}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <select
                            className="opponent-build-selector"
                            value={selectedOpponentBuildId}
                            onChange={(e) => setSelectedOpponentBuildId(e.target.value)}
                          >
                            {opponentOptions.map(op => (
                              <option key={op.id} value={op.id}>
                                {op.heroName} - {op.profileName} ({op.hp.toLocaleString()} HP / {op.defense} Def)
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>

                    {/* Active Calculation Specs Banner */}
                    <div className="target-specs-badge">
                      Target Configured: <strong className="glowing-cyan-text">{activeTargetSpecs.label}</strong>
                    </div>

                    {/* Render Headless Damages */}
                    {calculationOutput && (
                      <div className="quick-damage-grid">
                        
                        {/* Barriers Section */}
                        {calculationOutput.barriers.length > 0 && (
                          <div className="quick-barriers-box">
                            <span className="quick-box-header">Shield Barriers</span>
                            <div className="barriers-flex">
                              {calculationOutput.barriers.map(bar => (
                                <div key={bar.label} className="quick-barrier-chip">
                                  <span>{bar.label}</span>
                                  <strong>+{bar.value.toLocaleString()} HP</strong>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="quick-skills-list">
                          {calculationOutput.damages.map(dmgRow => {
                            const skillId = dmgRow.skill.replace('_soulburn', '').replace('_extra', '').replace('_counter', '');
                            const isSoulburn = dmgRow.skill.includes('_soulburn');
                            const isExtra = dmgRow.skill.includes('_extra');
                            const isCounter = dmgRow.skill.includes('_counter');
                            const mods = calculationOutput.modifiers[dmgRow.skill] || {};

                            return (
                              <div key={dmgRow.skill} className="quick-skill-dmg-card">
                                <div className="quick-skill-card-top">
                                  <div className="quick-skill-badges">
                                    <span className="quick-skill-name">{skillId.toUpperCase()}</span>
                                    {isSoulburn && <span className="q-badge soulburn">Soulburn</span>}
                                    {isExtra && <span className="q-badge extra">Extra</span>}
                                    {isCounter && <span className="q-badge counter">Counter</span>}
                                  </div>

                                  {/* Scaling Multipliers Chips */}
                                  <div className="quick-multiplier-chips">
                                    {mods.rate !== undefined && (
                                      <span className="mult-chip">Rate: x{mods.rate.toFixed(2)}</span>
                                    )}
                                    {mods.pow !== undefined && (
                                      <span className="mult-chip">Pow: x{mods.pow.toFixed(2)}</span>
                                    )}
                                    {mods.pen > 0 && (
                                      <span className="mult-chip glowing-cyan-border">Pen: {mods.pen}%</span>
                                    )}
                                    {mods.afterMathDmg > 0 && (
                                      <span className="mult-chip glowing-orange-border">Aftermath: +{mods.afterMathDmg.toLocaleString()}</span>
                                    )}
                                  </div>
                                </div>

                                <div className="quick-dmg-values-row">
                                  {dmgRow.crit !== null && (
                                    <div className="q-val-box crit">
                                      <span className="q-lbl">Critical Hit</span>
                                      <span className="q-val">{dmgRow.crit.toLocaleString()}</span>
                                    </div>
                                  )}
                                  {dmgRow.normal !== null && (
                                    <div className="q-val-box normal">
                                      <span className="q-lbl">Normal Hit</span>
                                      <span className="q-val">{dmgRow.normal.toLocaleString()}</span>
                                    </div>
                                  )}
                                  {dmgRow.crush !== null && (
                                    <div className="q-val-box crush">
                                      <span className="q-lbl">Crush Hit</span>
                                      <span className="q-val">{dmgRow.crush.toLocaleString()}</span>
                                    </div>
                                  )}
                                  {dmgRow.miss !== null && (
                                    <div className="q-val-box miss">
                                      <span className="q-lbl">Miss Hit</span>
                                      <span className="q-val">{dmgRow.miss.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Compare Bottom Floating Selection Bar ── */}
      {selectedCompareIds.length > 0 && (
        <div className="compare-floating-bar glow-cyan">
          <div className="compare-bar-info">
            <span className="compare-count-badge">{selectedCompareIds.length}</span>
            <span className="compare-bar-label">
              {selectedCompareIds.length === 1 
                ? "Build selected (Select 1 more to compare)" 
                : "Builds selected for comparison"}
            </span>
          </div>
          <div className="compare-bar-actions">
            <button 
              className="compare-clear-btn"
              onClick={() => setSelectedCompareIds([])}
            >
              Clear
            </button>
            <button 
              className={`compare-submit-btn ${selectedCompareIds.length >= 2 ? 'active glow-cyan' : 'disabled'}`}
              onClick={() => selectedCompareIds.length >= 2 && onStartComparison()}
              disabled={selectedCompareIds.length < 2}
            >
              Compare Selected
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
