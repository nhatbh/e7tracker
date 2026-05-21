/**
 * Metagame Domain Models
 * Data related to meta trends: pick rates, ban rates, win rates
 */

/**
 * Metagame Hero Entry
 * Represents a hero's meta statistics
 */
export interface MetagameHero {
  hero: string;
  hero_name: string;
  
  // Raw counts
  picks: number;
  played: number;
  bans: number;
  
  // Win/loss
  wins: number;
  losses: number;
  
  // Calculated rates
  pick_rate: number;
  ban_rate: number;
  pick_ban_rate: number;
  win_rate: number;
  
  // Player count
  players_using: number;
}

/**
 * First/Second Pick Advantage Stats
 */
export interface PickAdvantageStats {
  first_pick_wr: number;
  second_pick_wr: number;
}

/**
 * Metagame Overview
 * Global statistics for the current meta
 */
export interface MetagameOverview {
  total_matches: number;
  total_perspectives: number;
  total_players: number;
  first_pick_advantage: PickAdvantageStats;
}

/**
 * Metagame Metadata
 * Global metadata for the metagame dataset
 */
export interface MetagameMetadata {
  overview: MetagameOverview;
  hero_list: Array<{ hero: string; hero_name: string }>;
  cachedAt: number;
  sourceUrl: string;
}
