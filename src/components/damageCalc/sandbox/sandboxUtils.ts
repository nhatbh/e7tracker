import { FormDefaults, getHeroCalculatorKey, Heroes } from '../../../services/damageCalc/damageService';

export const TAB_COLORS = ['#00f2fe', '#ff007f', '#10b981', '#ffb700'];

export const formatArtifactName = (id: string): string => {
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

export const getArtifactIcon = (id: string) => {
    if (!id || id === 'noProc') {
        return new URL('../../../assets/images/artifacts/noProc.png', import.meta.url).href;
    }
    return new URL(`../../../assets/images/artifacts/${id}.png`, import.meta.url).href;
};

export const getToggleIcon = (key: string, advantageousElement?: string): string => {
    switch (key) {
        case 'elementalAdvantage':
            return advantageousElement ? new URL(`../../../assets/images/elements/${advantageousElement}.png`, import.meta.url).href : '';
        case 'decreasedAttack':
            return new URL('../../../assets/images/debuffs/attack-debuff.png', import.meta.url).href;
        case 'attackUp':
            return new URL('../../../assets/images/buffs/attack-buff.png', import.meta.url).href;
        case 'attackUpGreat':
            return new URL('../../../assets/images/buffs/greater-attack-buff.png', import.meta.url).href;
        case 'casterPilfered':
            return new URL('../../../assets/images/debuffs/pilfer-debuff.png', import.meta.url).href;
        case 'increasedCritDamage':
            return new URL('../../../assets/images/buffs/critical-hit-damage-buff.png', import.meta.url).href;
        case 'casterVigor':
            return new URL('../../../assets/images/buffs/vigor-buff.png', import.meta.url).href;
        case 'casterEnraged':
            return new URL('../../../assets/images/buffs/rage-buff.png', import.meta.url).href;
        case 'casterHasCascade':
            return new URL('../../../assets/images/buffs/cascade-buff.png', import.meta.url).href;
        case 'casterHasAbundance':
            return new URL('../../../assets/images/buffs/abundance-buff.png', import.meta.url).href;
        case 'casterHasChallenge':
            return new URL('../../../assets/images/buffs/challenge-buff.png', import.meta.url).href;
        case 'casterHasExplosives':
            return new URL('../../../assets/images/buffs/explosives-buff.png', import.meta.url).href;
        case 'casterHasSpecialFriendship':
            return new URL('../../../assets/images/buffs/special-friendship-buff.png', import.meta.url).href;
        case 'casterRampage':
            return new URL('../../../assets/images/buffs/rampage-buff.png', import.meta.url).href;
        case 'casterSpeedUp':
            return new URL('../../../assets/images/buffs/speed-buff.png', import.meta.url).href;

        // Sets
        case 'rageSet':
            return new URL('../../../assets/images/item_set/setrage.png', import.meta.url).href;
        case 'penetrationSet':
            return new URL('../../../assets/images/item_set/setpenetration.png', import.meta.url).href;
        case 'torrentSetStack':
            return new URL('../../../assets/images/item_set/settorrent.png', import.meta.url).href;
        case 'pursuitSet':
            return new URL('../../../assets/images/item_set/set_chase.png', import.meta.url).href;

        // Target Toggles
        case 'targetDefenseUp':
            return new URL('../../../assets/images/buffs/defense-buff.png', import.meta.url).href;
        case 'targetVigor':
            return new URL('../../../assets/images/buffs/vigor-buff.png', import.meta.url).href;
        case 'targetDefenseDown':
            return new URL('../../../assets/images/debuffs/defense-debuff.png', import.meta.url).href;
        case 'targetTargeted':
            return new URL('../../../assets/images/debuffs/target-debuff.png', import.meta.url).href;
        case 'targetRuptured':
            return new URL('../../../assets/images/debuffs/rupture-debuff.png', import.meta.url).href;
        case 'targetPilfered':
            return new URL('../../../assets/images/debuffs/pilfer-debuff.png', import.meta.url).href;
        case 'targetHasTrauma':
            return new URL('../../../assets/images/debuffs/trauma-debuff.png', import.meta.url).href;
        case 'targetMagicNailed':
            return new URL('../../../assets/images/debuffs/nail-debuff.png', import.meta.url).href;
        case 'targetFractured':
            return new URL('../../../assets/images/debuffs/fracture-debuff.png', import.meta.url).href;
        case 'targetLaceration':
            return new URL('../../../assets/images/debuffs/laceration-debuff.png', import.meta.url).href;

        default: {
            const defaultDef = FormDefaults[key];
            if (defaultDef && defaultDef.icon) {
                const iconPath = defaultDef.icon;
                if (iconPath.startsWith('buffs/')) {
                    return new URL(`../../../assets/images/buffs/${iconPath.substring(6)}`, import.meta.url).href;
                }
                if (iconPath.startsWith('debuffs/')) {
                    return new URL(`../../../assets/images/debuffs/${iconPath.substring(8)}`, import.meta.url).href;
                }
                if (iconPath.startsWith('icons/')) {
                    return new URL(`../../../assets/images/icons/${iconPath.substring(6)}`, import.meta.url).href;
                }
                if (iconPath.startsWith('heroes/')) {
                    return new URL(`../../../assets/images/heroes/${iconPath.substring(7)}`, import.meta.url).href;
                }
            }
            return '';
        }
    }
};

export const getHeroElement = (hName: string) => {
    if (!hName) return '';
    const key = getHeroCalculatorKey(hName);
    return Heroes[key]?.element || '';
};

export const hasElementalAdvantage = (casterElement?: string, targetElement?: string): boolean => {
    if (!casterElement || !targetElement) return false;
    const c = casterElement.toLowerCase();
    const t = targetElement.toLowerCase();

    if (c === 'light' && t === 'dark') return true;
    if (c === 'dark' && t === 'light') return true;
    if (c === 'fire' && (t === 'earth' || t === 'wind')) return true;
    if ((c === 'earth' || c === 'wind') && t === 'ice') return true;
    if (c === 'ice' && t === 'fire') return true;

    return false;
};

export const getAdvantageousElement = (element?: string) => {
    if (!element) return '';
    const advantageousElementMap = { fire: 'ice', ice: 'wind', wind: 'fire', light: 'dark', dark: 'light' };
    return advantageousElementMap[element as keyof typeof advantageousElementMap] || '';
};
