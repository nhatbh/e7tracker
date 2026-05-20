import {
    DataService,
    DamageService,
    Heroes,
    Artifacts,
    DamageFormData,
    getHeroCalculatorKey
} from './damageService';
import { LanguageService } from './original/src/app/services/language.service';
import { HitType } from './original/src/app/models/skill';

export interface SavedBuildProfile {
    id: string;          // Unique UUID
    heroName: string;    // Name of the hero (e.g., "Abigail")
    profileName: string; // User-defined name (e.g., "Speed Tank")
    savedAt: string;     // ISO Timestamp

    // Core Stats
    atk: number;
    defense: number;
    hp: number;
    speed: number;
    critDamage: number;

    // Artifact
    artifactId: string;
    artifactLevel: number;

    // Skill Enhancements
    molagoras1: number;
    molagoras2: number;
    molagoras3: number;

    // Form Toggles (sets, buffs, debuffs, status effects)
    formState: Record<string, any>;
}

export interface CalculatedDamageOutput {
    damages: Array<{
        skill: string;
        crit: number | null;
        normal: number | null;
        crush: number | null;
        miss: number | null;
    }>;
    barriers: Array<{
        label: string;
        value: number;
    }>;
    modifiers: Record<string, any>;
}

/**
 * Calculates skill damages and shield barriers for a saved build profile instantly
 * against either a custom target or a dynamic opponent target.
 */
export const calculateProfileDamage = (
    profile: SavedBuildProfile,
    overrideTargetHP?: number,
    overrideTargetDef?: number,
    overrideFormState?: Record<string, any>
): CalculatedDamageOutput => {
    const heroKey = getHeroCalculatorKey(profile.heroName);
    const hero = Heroes[heroKey] || Heroes.abigail;
    const artifactId = profile.artifactId || 'noProc';
    const currentArtifact = Artifacts[artifactId] || Artifacts.noProc;

    const targetDef = overrideTargetDef !== undefined ? overrideTargetDef : Number(profile.formState?.targetDefense ?? 1000);
    const targetHP = overrideTargetHP !== undefined ? overrideTargetHP : Number(profile.formState?.targetHP ?? 10000);

    const rawData = {
        ...(profile.formState || {}),
        ...(overrideFormState || {}),

        // Core Caster Stats
        attack: Number(profile.atk),
        casterMaxHP: Number(profile.hp),
        casterDefense: Number(profile.defense),
        casterSpeed: Number(profile.speed),
        critDamage: Number(profile.critDamage),

        // Core Target Stats
        targetDefense: targetDef,
        targetMaxHP: targetHP,
        targetCurrentHP: targetHP,
        targetInjuries: Number(profile.formState?.targetInjuries ?? 0),

        // Molagora levels (populate both camelCase and snake_case versions)
        molagoraS1: Number(profile.molagoras1 ?? 0),
        molagoraS2: Number(profile.molagoras2 ?? 0),
        molagoraS3: Number(profile.molagoras3 ?? 0),
        molagoras1: Number(profile.molagoras1 ?? 0),
        molagoras2: Number(profile.molagoras2 ?? 0),
        molagoras3: Number(profile.molagoras3 ?? 0),

        artifactLevel: profile.artifactLevel || 30,
        inputOverrides: {}
    };

    const damageFormData = new DamageFormData(rawData);

    // Instantiate headless community calculator services
    const dataService = new DataService();
    const damageService = new DamageService(dataService, new LanguageService());

    dataService.updateSelectedHero(heroKey);
    dataService.updateSelectedArtifact(artifactId);

    dataService.damageInputValues = damageFormData;
    dataService.damageInputValues.artifactLevel = profile.artifactLevel || 30;

    damageService.updateDamages();

    const newDamages = damageService.damages.value;
    const modifiersMap: Record<string, any> = {};

    for (const skill of Object.values(hero.skills)) {
        if (
            skill.rate(false, damageFormData, false) ||
            skill.pow(false, damageFormData) ||
            skill.afterMath(HitType.crit, damageFormData, false) ||
            (skill.detonate && skill.detonate.length && skill.detonation(true, damageFormData))
        ) {
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
};
