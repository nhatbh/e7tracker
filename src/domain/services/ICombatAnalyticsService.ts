/**
 * Combat Analytics Service Interface
 * Defines contract for fetching and caching combat analysis data
 */

import { HeroAnalysis, CombatMetadata } from '../models/CombatAnalytics';

export interface ICombatAnalyticsService {
  /**
   * Initialize the service and load cached metadata
   */
  init(): Promise<void>;

  /**
   * Fetch and partition combat data from remote source
   */
  fetchAndPartitionCombatData(url: string, onProgress?: (msg: string) => void): Promise<void>;

  /**
   * Get hero analysis by hero name
   */
  getHeroAnalysis(heroName: string): Promise<HeroAnalysis | null>;

  /**
   * Get global metadata
   */
  getMetadata(): CombatMetadata | null;

  /**
   * Check if currently fetching
   */
  isFetching(): boolean;

  /**
   * Get last error (if any)
   */
  getError(): string | null;

  /**
   * Clear all combat caches
   */
  clearCache(): Promise<void>;
}
