/**
 * Client Profile Model
 * Defines configuration for different game clients with offset settings
 */

export interface ClientProfile {
  id: string;
  name: string;
  /** Exact window title to match for auto-detection */
  windowTitlePattern: string;

  /** Fixed pixel offset for X-axis (can be negative) */
  offsetPixelsX: number;
  /** Percentage-based offset for X-axis (0-100, scales with window width) */
  offsetPercentageX: number;

  /** Fixed pixel offset for Y-axis (can be negative) */
  offsetPixelsY: number;
  /** Percentage-based offset for Y-axis (0-100, scales with window height) */
  offsetPercentageY: number;

  enabled: boolean;
}

/**
 * Calculate total X-Y offsets for a given window size
 * total_offset = offsetPixels + (dimension * offsetPercentage / 100)
 */
export function calculateClientOffsets(
  profile: ClientProfile,
  windowWidth: number,
  windowHeight: number
): { x: number; y: number } {
  const x = profile.offsetPixelsX + (windowWidth * profile.offsetPercentageX) / 100;
  const y = profile.offsetPixelsY + (windowHeight * profile.offsetPercentageY) / 100;
  return { x, y };
}
