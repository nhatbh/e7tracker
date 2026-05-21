/**
 * Static Artifact Metadata
 * Represents an artifact's definition from the static database
 */

export interface ArtifactMetadata {
  /** Unique identifier (e.g., "dust_disk") */
  code: string;
  /** Display name (e.g., "Dust Disk") */
  name: string;
  /** Rarity: epic, rare, uncommon, common */
  rarity: 'epic' | 'rare' | 'uncommon' | 'common';
  /** Set bonus type (e.g., "lifesteal", "attack", "immunity") */
  setBonus: string;
  /** Item level range */
  minLevel?: number;
  maxLevel?: number;
  /** Effect description */
  effect?: string;
  /** Full raw data from the static database */
  rawData?: any;
}

export type ArtifactSetType = 
  | 'lifesteal' | 'attack' | 'defense' | 'health' 
  | 'speed' | 'crit' | 'immunity' | 'resist' 
  | 'destruction' | 'counter' | 'unity' | 'injury'
  | 'penetration' | 'rage' | 'torrent' | 'pursuit';
