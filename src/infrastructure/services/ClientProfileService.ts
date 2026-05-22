import { ClientProfile, WindowInfo } from '../../domain/models';
import { CLIENT_PROFILES, DEFAULT_CLIENT_PROFILE_ID } from '../../domain/constants/ClientProfiles';

class ClientProfileServiceImpl {
  private activeProfileId: string = DEFAULT_CLIENT_PROFILE_ID;
  private isAutoDetected: boolean = false;

  /**
   * Get all available client profiles
   */
  getProfiles(): ClientProfile[] {
    return CLIENT_PROFILES;
  }

  /**
   * Get only enabled client profiles
   */
  getEnabledProfiles(): ClientProfile[] {
    return CLIENT_PROFILES.filter((p) => p.enabled);
  }

  /**
   * Auto-detect the active client by matching window titles
   */
  detectClient(windows: WindowInfo[]): ClientProfile | null {
    const enabledProfiles = this.getEnabledProfiles();

    for (const profile of enabledProfiles) {
      const match = windows.find((w) => w.title === profile.windowTitlePattern);
      if (match) {
        this.activeProfileId = profile.id;
        this.isAutoDetected = true;
        return profile;
      }
    }

    return null;
  }

  /**
   * Get the currently active client profile
   */
  getActiveProfile(): ClientProfile {
    const profile = CLIENT_PROFILES.find((p) => p.id === this.activeProfileId);
    return profile || this.getDefaultProfile();
  }

  /**
   * Get the active profile ID
   */
  getActiveProfileId(): string {
    return this.activeProfileId;
  }

  /**
   * Check if the active profile was auto-detected
   */
  getIsAutoDetected(): boolean {
    return this.isAutoDetected;
  }

  /**
   * Manually set the active client profile
   */
  setActiveProfile(profileId: string): void {
    const profile = CLIENT_PROFILES.find((p) => p.id === profileId);
    if (profile) {
      this.activeProfileId = profileId;
      this.isAutoDetected = false;
    }
  }

  /**
   * Reset to default profile (Epic Seven PC)
   */
  resetToDefault(): void {
    this.activeProfileId = DEFAULT_CLIENT_PROFILE_ID;
    this.isAutoDetected = false;
  }

  /**
   * Get the default fallback profile
   */
  getDefaultProfile(): ClientProfile {
    const profile = CLIENT_PROFILES.find((p) => p.id === DEFAULT_CLIENT_PROFILE_ID);
    if (!profile) {
      throw new Error('Default client profile not found');
    }
    return profile;
  }

  /**
   * Calculate the total X and Y offsets (pixels + percentage-based) for a given window size
   */
  calculateTotalOffsets(windowWidth: number, windowHeight: number): { x: number; y: number } {
    const profile = this.getActiveProfile();
    const offsetX = profile.offsetPixelsX + (windowWidth * profile.offsetPercentageX) / 100;
    const offsetY = profile.offsetPixelsY + (windowHeight * profile.offsetPercentageY) / 100;
    return { x: offsetX, y: offsetY };
  }

  /**
   * Get profile by ID
   */
  getProfileById(profileId: string): ClientProfile | undefined {
    return CLIENT_PROFILES.find((p) => p.id === profileId);
  }
}

// Export singleton instance
export const ClientProfileService = new ClientProfileServiceImpl();
