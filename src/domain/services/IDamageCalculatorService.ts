/**
 * Damage Calculator Service Interface
 * Defines contract for damage calculation and saved profile management.
 */

import { SavedBuildProfile, CalculatedDamageOutput } from '../../services/damageCalc/profileCalc';

export interface IDamageCalculatorService {
  /**
   * Get all saved build profiles for a hero
   */
  getProfilesByHero(heroName: string): Promise<SavedBuildProfile[]>;

  /**
   * Get all saved build profiles across all heroes
   */
  getAllProfiles(): Promise<SavedBuildProfile[]>;

  /**
   * Save or update a profile
   */
  saveProfile(profile: SavedBuildProfile): Promise<void>;

  /**
   * Delete a profile
   */
  deleteProfile(id: string): Promise<void>;

  /**
   * Perform damage calculation
   */
  calculateDamage(
    profile: SavedBuildProfile,
    overrideTargetHP?: number,
    overrideTargetDef?: number,
    overrideFormState?: Record<string, any>
  ): CalculatedDamageOutput;
}
