import { useState, useMemo, useEffect } from 'react';
import * as _ from 'lodash-es';

// Import everything from the original community calculator library
import { Heroes } from './original/src/assets/data/heroes';
import { Artifacts } from './original/src/assets/data/artifacts';
import { DamageFormData, FormDefaults } from './original/src/app/models/forms';
import { DamageService } from './original/src/app/services/damage.service';
import { DataService } from './original/src/app/services/data.service';
import { LanguageService } from './original/src/app/services/language.service';
import { HitType } from './original/src/app/models/skill';

export { Heroes, Artifacts, DamageFormData, FormDefaults, DamageService, DataService };

// Map OCR/Fribbels names to damage calc keys
export const getHeroCalculatorKey = (name: string): string => {
  if (!name) return 'abigail';
  let key = name.toLowerCase()
                .replace(/[\s\-]+/g, '_')
                .replace(/[^a-z0-9\_]/g, '');

  if (Heroes[key]) return key;
  
  const manualMap: Record<string, string> = {
    'arbitred_vildred': 'arbiter_vildred',
    'little_queen_charlotte': 'little_queen_charlotte',
    'charlotte': 'charlotte',
    'ml_choux': 'urban_shadow_choux',
    'fury': 'furious'
  };

  if (manualMap[key]) return manualMap[key];

  const found = Object.keys(Heroes).find(k => k.includes(key) || key.includes(k));
  return found || 'abigail';
};

// Helper to format camelCase/snake_case dynamic field IDs to gorgeous display titles
export const formatFormLabel = (id: string): string => {
  if (!id) return '';
  const manualLabels: Record<string, string> = {
    exclusiveEquipment1: 'Exclusive Equipment (EE1)',
    exclusiveEquipment2: 'Exclusive Equipment (EE2)',
    exclusiveEquipment3: 'Exclusive Equipment (EE3)',
    casterMaxHP: 'Caster Max HP',
    targetMaxHP: 'Target Max HP',
    casterDefense: 'Caster Defense',
    targetDefense: 'Target Defense',
    casterSpeed: 'Caster Speed',
    targetSpeed: 'Target Speed',
    casterHasTrauma: 'Caster Has Trauma',
    casterHasArchdemonsMight: "Caster Has Archdemon's Might",
    targetDefenseDownAftermath: 'Target Defense Down Aftermath',
    targetHasBarrier: 'Target Has Barrier',
    targetHasDebuff: 'Target Has Debuff',
    targetNumberOfDebuffs: 'Target Number of Debuffs',
    enemyNumberOfDebuffs: 'Enemy Number of Debuffs',
    targetBleedDetonate: 'Target Bleed Detonates',
    targetBurnDetonate: 'Target Burn Detonates',
    targetBombDetonate: 'Target Bomb Detonates',
    skill3Stack: 'S3 Stack',
    skill1Stack: 'S1 Stack',
    numberOfTargets: 'Number of Targets',
    numberOfDeaths: 'Number of Deaths',
    casterFullFocus: 'Caster Full Focus',
    casterFullFightingSpirit: 'Caster Full Fighting Spirit',
    casterFightingSpirit: 'Caster Fighting Spirit',
    casterFocus: 'Caster Focus',
    casterBelow30PercentHP: 'Caster Below 30% HP',
    casterAboveHalfHP: 'Caster Above 50% HP',
    targetAboveHalfHP: 'Target Above 50% HP',
    casterCurrentHPPercent: 'Caster Current HP %',
    targetCurrentHPPercent: 'Target Current HP %',
  };

  if (manualLabels[id]) return manualLabels[id];

  return id
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_\s\-]+/g, ' ')
    .trim()
    .split(' ')
    .map(word => {
      if (word.toLowerCase() === 'hp') return 'HP';
      if (word.toLowerCase() === 'ee') return 'EE';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

// Stub formatSkillModTip helper to format mathematical skill scaling tooltips cleanly
export const formatSkillModTip = (tips: Record<string, number>): string => {
  if (!tips) return '';
  const labels: Record<string, string> = {
    casterMaxHP: 'caster Max HP',
    casterDefense: 'caster Def',
    caster_defense: 'caster Def',
    attackPercent: 'Attack',
    per_fewer_target: 'per fewer target',
    skill_tree: 'from Skill Tree',
    exclusive_equipment: 'from EE',
    casterSpeed: 'caster Spd',
    targetMaxHP: 'target Max HP',
    casterCurrentHPPercent: 'caster HP %',
    targetCurrentHPPercent: 'target HP %',
    numberOfTargets: 'number of targets',
    numberOfDeaths: 'number of deaths',
    skill3Stack: 'S3 Stack',
    skill1Stack: 'S1 Stack',
    enemyCounterStack: 'Counter Stack',
    rageSet: 'Rage Set',
    torrentSet: 'Torrent Set',
    bleed_detonated: 'Bleed Detonates',
    burn_detonated: 'Burn Detonates',
    bomb_detonated: 'Bomb Detonates',
  };

  return Object.entries(tips)
    .filter(([_, val]) => val !== 0 && val !== undefined)
    .map(([key, val]) => `${val}% ${labels[key] || key}`)
    .join(' + ');
};

const getEnhanceMax = (hero: any, skillId: string): number => {
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
  return skill.id ? 5 : 0;
};

// Main hook for React UI consumption wrapping the Angular library
export const useDamageCalculator = (heroName: string, defaultStats: any) => {
  const heroKey = useMemo(() => getHeroCalculatorKey(heroName), [heroName]);
  const hero = useMemo(() => Heroes[heroKey] || Heroes.abigail, [heroKey]);

  // Generate clean default values matching forms.ts structure
  const initialFormValues = useMemo(() => {
    const atk = Number(defaultStats?.atk || defaultStats?.attack || hero.baseAttack || 1000);
    const def = Number(defaultStats?.def || defaultStats?.defense || hero.baseDefense || 800);
    const hp = Number(defaultStats?.hp || defaultStats?.casterMaxHP || hero.baseHP || 10000);
    const speed = Number(defaultStats?.spd || defaultStats?.speed || 150);
    const chd = Number(defaultStats?.chd || defaultStats?.critDamage || 150);

    return {
      heroID: heroKey,
      atk: atk,
      defense: def,
      hp: hp,
      speed: speed,
      critDamage: chd,
      artifactLevel: 30,
      
      // Target Defaults
      targetDefense: 1000,
      targetHP: 10000,
      targetInjuries: 0,
      
      // Sets
      penetrationSet: false,
      rageSet: false,
      torrentSet: false,
      pursuitSet: false,

      // Molagoras defaults (Always default to the detected max level cap)
      molagoras1: getEnhanceMax(hero, 's1'),
      molagoras2: getEnhanceMax(hero, 's2'),
      molagoras3: getEnhanceMax(hero, 's3'),
      
      // Buffs & conditions
      increasedCritDamage: false,
      increasedSpeed: false,
      attackUp: false,
      attackUpGreat: false,
      targetDefenseDown: false,
      targetTargeted: false,
      targetVigor: false,
      casterVigor: false,
      casterEnraged: false,
      casterPerception: false,
      elementalAdvantage: false
    };
  }, [heroKey, hero, defaultStats]);

  const [formState, setFormState] = useState<Record<string, any>>(initialFormValues);
  const [artifactId, setArtifactId] = useState<string>('noProc');
  const [artifactLevel, setArtifactLevel] = useState<number>(30);

  // Re-sync forms if heroName changes
  useEffect(() => {
    setFormState(initialFormValues);
  }, [initialFormValues]);

  const updateField = (field: string, value: any) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const bulkUpdateFields = (fields: Record<string, any>) => {
    setFormState(prev => ({ ...prev, ...fields }));
  };

  const currentArtifact = useMemo(() => {
    return Artifacts[artifactId] || Artifacts.noProc;
  }, [artifactId]);

  // Combine into forms.ts DamageFormData shape for calculation logic
  const damageFormData = useMemo(() => {
    // Dynamically resolve defaults for heroSpecific and artifactSpecific to ensure engine never evaluates undefined
    const dynamicDefaults: Record<string, any> = {};
    const dummy = new DamageFormData({});
    if (hero?.heroSpecific) {
      for (const key of hero.heroSpecific) {
        dynamicDefaults[key] = FormDefaults[key]?.defaultValue ?? FormDefaults[key]?.default ?? dummy[key] ?? 0;
      }
    }
    if (currentArtifact?.artifactSpecific) {
      for (const key of currentArtifact.artifactSpecific) {
        dynamicDefaults[key] = FormDefaults[key]?.defaultValue ?? FormDefaults[key]?.default ?? dummy[key] ?? 0;
      }
    }

    const rawData = {
      ...dynamicDefaults,
      ...formState,
      
      // Core Caster Stats
      attack: Number(formState.atk),
      casterMaxHP: Number(formState.hp),
      casterDefense: Number(formState.defense),
      casterSpeed: Number(formState.speed),
      critDamage: Number(formState.critDamage),
      
      // Core Target Stats
      targetDefense: Number(formState.targetDefense),
      targetMaxHP: Number(formState.targetHP),
      targetCurrentHP: Number(formState.targetHP),
      targetInjuries: Number(formState.targetInjuries || 0),
      
      // Molagora enhancement levels (populate both camelCase and snake_case versions for robust lookups)
      molagoraS1: Number(formState.molagoras1 ?? 0),
      molagoraS2: Number(formState.molagoras2 ?? 0),
      molagoraS3: Number(formState.molagoras3 ?? 0),
      molagoras1: Number(formState.molagoras1 ?? 0),
      molagoras2: Number(formState.molagoras2 ?? 0),
      molagoras3: Number(formState.molagoras3 ?? 0),
      
      // Buffs / Debuffs / Toggles
      casterSpeedUp: !!formState.increasedSpeed,
      increasedCritDamage: !!formState.increasedCritDamage,
      
      artifactLevel,
      inputOverrides: {}
    };
    return new DamageFormData(rawData);
  }, [hero, currentArtifact, formState, artifactLevel]);

  // Instantiate the ACTUAL unmodified community Angular services side-by-side!
  const calculatedOutput = useMemo(() => {
    // 1. Instantiate the framework-stripped services
    const dataService = new DataService();
    const damageService = new DamageService(dataService, new LanguageService());

    // 2. Feed current hero and artifact
    dataService.updateSelectedHero(heroKey);
    dataService.updateSelectedArtifact(artifactId);

    // 3. Populate raw data form
    dataService.damageInputValues = damageFormData;
    dataService.damageInputValues.artifactLevel = artifactLevel;

    // 4. Force state calculation trigger
    damageService.updateDamages();

    // 5. Gather modifiers mapped by skill id
    const newDamages = damageService.damages.value;
    const modifiersMap: Record<string, any> = {};

    for (const skill of Object.values(hero.skills)) {
      if (skill.rate(false, damageFormData, false) || skill.pow(false, damageFormData) || skill.afterMath(HitType.crit, damageFormData, false) || (skill.detonate && skill.detonate.length && skill.detonation(true, damageFormData))) {
        modifiersMap[skill.id] = damageService.getModifiers(skill, false, false);

        if (skill.soulburn) {
          modifiersMap[`${skill.id}_soulburn`] = damageService.getModifiers(skill, true, false);
        }
  
        if (skill.canExtra && (currentArtifact.extraAttackBonus || skill.extraModifier)) {
          modifiersMap[`${skill.id}_extra`] = damageService.getModifiers(skill, false, true);
        }
      }
    }

    const barriers = damageService.getBarriers();

    return {
      damages: newDamages,
      barriers,
      modifiers: modifiersMap
    };
  }, [heroKey, hero, artifactId, currentArtifact, damageFormData, artifactLevel]);

  return {
    hero,
    artifactId,
    artifactLevel,
    setArtifactId,
    setArtifactLevel,
    formState,
    updateField,
    bulkUpdateFields,
    calculatedOutput
  };
};
