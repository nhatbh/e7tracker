/**
 * User Build Profile
 * Represents a user's saved hero build configuration
 */

export interface BuildStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  chc: number;  // crit chance
  chd: number;  // crit damage
  eff: number;  // effectiveness
  efr: number;  // effect resistance
}

export interface GearSet {
  /** Set type: speed, crit, lifesteal, etc. */
  type: string;
  /** Number of pieces equipped */
  count: number;
}

export interface UserBuildProfile {
  /** Unique identifier */
  id: string;
  /** Hero this build belongs to */
  heroName: string;
  /** User-defined name for this build */
  profileName: string;
  /** Date when the build was saved */
  savedAt: string;
  
  /** Core stats */
  hp: number;
  atk: number;
  defense: number;
  speed: number;
  critDamage: number;
  
  /** Optional extended stats */
  critChance?: number;
  effectiveness?: number;
  effectResistance?: number;
  
  /** Equipped artifact code */
  artifactId: string;
  /** Artifact enhancement level */
  artifactLevel: number;
  
  /** Molagora enhancement levels */
  molagoras1: number;
  molagoras2: number;
  molagoras3: number;
  
  /** Gear sets equipped (parsed from raw data) */
  sets?: Record<string, string>;
  
  /** Gear score (if available) */
  gs?: number;
  
  /** Additional form state for calculator */
  formState?: Record<string, any>;
}

export type ActiveBuildSource = 'avg' | 'set1' | 'set2' | 'set3' | 'pro' | 'pro_set1' | 'pro_set2' | 'pro_set3';

/**
 * Processed Build Data
 * Represents aggregated build statistics for a hero
 */
export interface ProcessedBuildData {
  averageStats: BuildStats;
  topSets: string[];
  topArtifacts: string[];
  setStats: Array<{
    setName: string;
    percent: number;
    stats: BuildStats;
  }>;
  proStats?: {
    averageStats: BuildStats;
    topSets: string[];
    setStats: Array<{
      setName: string;
      percent: number;
      stats: BuildStats;
    }>;
  };
  /** Raw build data from API */
  rawBuilds?: Array<{
    artifactCode: string;
    atk: number;
    chc: number;
    chd: number;
    createDate: string;
    def: number;
    eff: number;
    efr: number;
    gs: number;
    hp: number;
    sets: Record<string, string>;
    spd: number;
    unitCode: string;
    unitName: string;
  }>;
  /** Timestamp when data was cached */
  cachedAt?: number;
}
