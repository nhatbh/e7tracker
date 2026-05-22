/**
 * Window Service Interface
 * Defines the contract for window management operations
 */

import { WindowInfo } from '../models/Window';

export interface IWindowService {
  /**
   * Get list of all visible system windows
   */
  getWindows(): Promise<WindowInfo[]>;

  /**
   * Get the currently tracked window HWND
   */
  getTrackedWindow(): Promise<number | null>;

  /**
   * Set which window to track for overlay
   */
  setTrackedWindow(hwnd: number): Promise<void>;

  /**
   * Set the active client profile on the backend
   */
  setActiveClientProfile(profile: any): Promise<void>;

  /**
   * Subscribe to window tracking changes
   * @param callback Called with (isTracking, hwnd) when tracking state changes
   * @returns Unsubscribe function
   */
  onTrackedWindowChanged(
    callback: (isTracking: boolean, hwnd: number | null) => void
  ): Promise<() => void>;
}
