/**
 * Combat Analytics Domain Models
 * Data related to hero matchups, counters, and draft performance
 */

// Hero reference in combat context
export interface CombatHero {
  hero: string;
  hero_name: string;
  count: number;
}

// Player performance data
export interface CombatPlayerData {
  player: string;
  region: string;
  url: string;
  games: number;
  wins: number;
  win_rate: number;
  fp_wr: number;  // first pick win rate
  sp_wr: number;  // second pick win rate
  fp_games: number;
  sp_games: number;
}

// Pick statistics for a position
export interface CombatPickStats {
  games: number;
  wins: number;
  win_rate: number;
}

// Position-specific statistics
export interface CombatPositionStats {
  wins: number;
  win_rate: number;
  pct: number;
  count: number;
}

// Hero pick in a specific position
export interface CombatPositionPick {
  hero: string;
  hero_name: string;
  count: number;
  win_rate: number;
}

// Response data for best pair analysis
export interface CombatBestPairByPosition {
  count: number;
  pct: number;
  win_rate: number;
  responding_to: Array<{
    hero: string;
    hero_name: string;
    count: number;
  }>;
}

export interface CombatBestPair {
  hero: string;
  hero_name: string;
  count: number;
  win_rate: number;
  by_position: Record<string, CombatBestPairByPosition>;
}

// Preban information
export interface CombatPreban {
  hero: string;
  hero_name?: string;
  count: number;
  win_rate?: number;
}

// Pilot ban data
export interface CombatPilotBan {
  hero: string;
  hero_name: string;
  count: number;
  ban_rate: number;
}

// Counter hero data
export interface CombatCounter {
  hero: string;
  hero_name: string;
  count: number;
  wins: number;
  losses: number;
  win_rate: number;
  loss_pct: number;
  loss_by_position: Record<string, {
    count: number;
    pct: number;
  }>;
}

// Direct matchup data
export interface CombatMatchup {
  hero: string;
  hero_name: string;
  count: number;
  wins: number;
  win_rate: number;
}

// Team composition data
export interface CombatTopComp {
  heroes: string[];
  hero_names: string[];
  count: number;
  win_rate: number;
}

// Preban pair data
export interface CombatPrebanPair {
  heroes: string[];
  hero_names: string[];
  count: number;
  win_rate: number;
}

// Opponent winning position data
export interface CombatOppWinningPosition {
  hero: string;
  hero_name: string;
  count: number;
  pct: number;
}

/**
 * Hero Analysis
 * Complete combat analysis for a single hero
 */
export interface HeroAnalysis {
  hero_code?: string;
  hero_name: string;
  
  // Overall stats
  total_matches: number;
  total_losses: number;
  total_appearances: number;
  players: number;
  player_list: CombatPlayerData[];
  wins: number;
  win_rate: number;
  
  // Draft position performance
  first_pick: CombatPickStats;
  second_pick: CombatPickStats;
  draft_position: Record<string, CombatPositionStats>;
  
  // Position picks
  position_picks_fp: Record<string, CombatPositionPick[]>;
  position_picks_sp: Record<string, CombatPositionPick[]>;
  
  // Synergy pairs (best allies)
  best_pairs_fp: CombatBestPair[];
  best_pairs_sp: CombatBestPair[];
  
  // Bans
  my_prebans: CombatPreban[];
  enemy_prebans: CombatPreban[];
  pilot_bans: CombatPilotBan[];
  
  // Counters
  counters_strong: CombatCounter[];
  counters_weak: CombatCounter[];
  
  // Direct matchups
  matchups_fp: CombatMatchup[];
  matchups_sp: CombatMatchup[];
  
  // Team compositions
  top_comps: CombatTopComp[];
  preban_pairs: CombatPrebanPair[];
  opp_winning_positions: Record<string, CombatOppWinningPosition[]>;
}

/**
 * Combat Metadata
 * Global metadata for the combat dataset
 */
export interface CombatMetadata {
  hero_list: CombatHero[];
  hero_image_map: Record<string, { name: string }>;
  total_matches: number;
  cachedAt: number;
  sourceUrl: string;
}
