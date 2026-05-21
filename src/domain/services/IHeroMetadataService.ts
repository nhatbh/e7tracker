/**
 * Hero Metadata Service Interface
 * Defines contract for fetching and caching static hero data
 */

import { HeroMetadata } from '../models/Hero';

export interface IHeroMetadataService {
  /**
   * Initialize the service and load cached hero data
   */
  init(): Promise<void>;

  /**
   * Wait for initialization to complete
   */
  waitForInit(): Promise<void>;

  /**
   * Get a hero by name
   */
  getHeroByName(name: string): HeroMetadata | null;

  /**
   * Get all heroes
   */
  getAllHeroes(): HeroMetadata[];

  /**
   * Get hero list (names only)
   */
  getHeroList(): string[];

  /**
   * Match OCR hero name to canonical hero name
   */
  matchHeroName(ocrName: string): string | null;

  /**
   * Refetch hero data from remote source
   */
  refetchHeroData(): Promise<void>;

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean;
}
