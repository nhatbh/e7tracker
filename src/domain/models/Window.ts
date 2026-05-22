/**
 * Window Domain Model
 * Represents a system window that can be tracked for game overlay
 */

export interface WindowInfo {
  /** Window handle (HWND on Windows) */
  hwnd: number;
  /** Window title/name */
  title: string;
  /** Associated client profile ID (e.g., "epic7-pc", "bluestack") */
  clientProfileId?: string;
}
