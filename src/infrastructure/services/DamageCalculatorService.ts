/**
 * DamageCalculatorService
 * Wrapper that provides access to the external damage calculator module
 * for Epic Seven to ensure architectural separation and copyright compliance.
 */

import { IDamageCalculatorService } from '../../domain/services/IDamageCalculatorService';
import { SavedBuildProfile, CalculatedDamageOutput, calculateProfileDamage } from '../../services/damageCalc/profileCalc';
import { UserBuildProfileService } from '../services/UserBuildProfileService';

export class DamageCalculatorService implements IDamageCalculatorService {
    private userBuildProfileService: UserBuildProfileService;

    constructor(userBuildProfileService: UserBuildProfileService) {
        this.userBuildProfileService = userBuildProfileService;
    }

    // --- Saved Profile Management ---
    // Delegates management to the centralized UserBuildProfileService

    async getProfilesByHero(heroName: string): Promise<SavedBuildProfile[]> {
        const profiles = await this.userBuildProfileService.getProfilesByHero(heroName);
        return profiles as unknown as SavedBuildProfile[];
    }

    async getAllProfiles(): Promise<SavedBuildProfile[]> {
        const profiles = await this.userBuildProfileService.getAllProfiles();
        return profiles as unknown as SavedBuildProfile[];
    }

    async saveProfile(profile: SavedBuildProfile): Promise<void> {
        return await this.userBuildProfileService.saveProfile(profile as any);
    }

    async deleteProfile(id: string): Promise<void> {
        return await this.userBuildProfileService.deleteProfile(id);
    }

    // --- External Library Wrapper ---
    // Acts as a gateway to the damage calculator library functions.

    calculateDamage(
        profile: SavedBuildProfile,
        overrideTargetHP?: number,
        overrideTargetDef?: number,
        overrideFormState?: Record<string, any>
    ): CalculatedDamageOutput {
        // This is the direct call to the external library wrapper provided in profileCalc
        return calculateProfileDamage(profile, overrideTargetHP, overrideTargetDef, overrideFormState);
    }
}
