/**
 * Domain model for preprocessed Tier List data
 * This data is computed once and cached to avoid recalculation
 */

export interface TierListHeroTag {
    name: string;
    nameKey: string;
    vibe: string;
    vibeKey: string;
    desc: string;
    descKey: string;
    color: string;
    bg: string;
}

export interface TierListHeroData {
    heroName: string;
    heroCode: string;
    tier: 'OP' | 'S' | 'A' | 'B' | 'C';
    tierColor: string;
    score: number;
    winRate: number;
    pickRate: number;
    banRate: number;
    pickBanRate: number;
    prebanRate: number;
    tags: TierListHeroTag[];
    // Draft position stats
    slot1Ratio: number;
    slot2Ratio: number;
    slot3Ratio: number;
    slot45Ratio: number;
}

export interface TierListMetadata {
    lastUpdated: number;
    heroCount: number;
}
