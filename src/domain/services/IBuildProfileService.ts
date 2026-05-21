/**
 * Build Profile Service Interface
 * Defines contract for managing user build profiles
 */

import { UserBuildProfile, ProcessedBuildData } from '../models/BuildProfile';

export interface IBuildProfileService {
  /**
   * Initialize the service and load saved profiles
   */
  init(): Promise<void>;

  /**
   * Get all saved build profiles
   */
  getAllProfiles(): Promise<UserBuildProfile[]>;

  /**
   * Get a specific profile by ID
   */
  getProfileById(id: string): Promise<UserBuildProfile | null>;

  /**
   * Get profiles for a specific hero
   */
  getProfilesByHero(heroName: string): Promise<UserBuildProfile[]>;

  /**
   * Save or update a profile
   */
  saveProfile(profile: UserBuildProfile): Promise<void>;

  /**
   * Delete a profile
   */
  deleteProfile(id: string): Promise<void>;

  /**
   * Delete multiple profiles
   */
  deleteProfiles(ids: string[]): Promise<void>;

  /**
   * Get processed build data for a hero (aggregated stats)
   */
  getProcessedBuildData(heroName: string): Promise<ProcessedBuildData | null>;

  /**
   * Fetch and cache processed build data from remote API
   */
  fetchAndCacheBuilds(heroName: string): Promise<ProcessedBuildData | null>;

  /**
   * Clear all cached build data
   */
  clearCache(): Promise<void>;
}
