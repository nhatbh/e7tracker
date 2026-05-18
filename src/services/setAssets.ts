export const mapSetNameToFile = (setName: string): string => {
    const s = setName.toLowerCase().trim();
    switch (s) {
        case 'speed':
        case 'spd':
            return 'setspeed';
        case 'attack':
        case 'atk':
            return 'setattack';
        case 'destruction':
        case 'destr':
        case 'crit dmg':
        case 'cri_dmg':
            return 'setdestruction';
        case 'lifesteal':
        case 'ls':
        case 'vamp':
        case 'vampire':
            return 'setlifesteal';
        case 'rage':
            return 'setrage';
        case 'unity':
            return 'setunity';
        case 'hit':
        case 'acc':
        case 'accuracy':
            return 'sethit';
        case 'max_hp':
            return 'sethealth';
        case 'resist':
        case 'res':
        case 'resistance':
            return 'setresist';
        case 'revenge':
            return 'setrevenge';
        case 'injury':
        case 'scar':
            return 'setinjury';
        case 'penetration':
        case 'penetrate':
            return 'setpenetration';
        case 'torrent':
            return 'settorrent';
        case 'protection':
        case 'shield':
            return 'setprotection';
        case 'opener':
        case 'revenant':
            return 'setrevenant';
        case 'chase':
            return 'set_chase';
        case 'block':
            return 'setblock';
        case 'riposte':
            return 'setriposte';
        case 'immune':
            return 'setimmunity';
        case 'def':
            return 'setdefense';
        case 'cri':
            return 'setcritical';
        default:
            return `set${s.replace(/[^a-z0-9]/g, '')}`;
    }
};

export const getSetIconUrl = (setName: string): string => {
    const filename = mapSetNameToFile(setName);
    return new URL(`../assets/images/item_set/${filename}.png`, import.meta.url).href;
};
