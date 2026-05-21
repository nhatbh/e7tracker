/**
 * Metagame Service Interface
 * Defines contract for fetching and caching metagame data
 */

import { MetagameHero, MetagameMetadata } from '../models/MetagameData';

export interface IMetagameService {
  /**
   * Initialize the service and load cached metadata
   */
  init(): Promise<void>;

  /**
   * Fetch and partition metagame data from remote source
   */
  fetchAndPartitionMetagameData(url: string, onProgress?: (msg: string) => void): Promise<void>;

  /**
   * Get metagame data for a specific hero
   */
  getHeroMetagame(heroName: string): Promise<MetagameHero | null>;

  /**
   * Get global metadata
   */
  getMetadata(): MetagameMetadata | null;

  /**
   * Check if currently fetching
   */
  isFetching(): boolean;

  /**
   * Get last error (if any)
   */
  getError(): string | null;

  /**
   * Clear all metagame caches
   */
  clearCache(): Promise<void>;
}
