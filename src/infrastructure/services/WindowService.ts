/**
 * Window Service Implementation
 * Handles all window management operations and event subscriptions
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { IWindowService } from '../../domain/services/IWindowService';
import { WindowInfo } from '../../domain/models/Window';

class WindowServiceImpl implements IWindowService {
  private trackedWindowCallbacks: Set<(isTracking: boolean, hwnd: number | null) => void> = new Set();
  private unlisteners: (() => void)[] = [];
  private initialized = false;

  /**
   * Initialize event listeners for window tracking
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Listen for auto-tracked window event
      const unlistenAutoTrack = await listen<WindowInfo>('auto-tracked-window', (event) => {
        this.notifyTrackedWindowChanged(true, event.payload.hwnd);
      });
      this.unlisteners.push(unlistenAutoTrack);

      // Listen for tracked window lost event
      const unlistenLostTrack = await listen('tracked-window-lost', () => {
        this.notifyTrackedWindowChanged(false, null);
      });
      this.unlisteners.push(unlistenLostTrack);

      this.initialized = true;
      await invoke('log_frontend_info', { msg: '[WindowService] Event listeners initialized' }).catch(() => {});
    } catch (error) {
      await invoke('log_frontend_error', { msg: `[WindowService] Failed to initialize: ${error}` }).catch(() => {});
    }
  }

  /**
   * Notify all subscribers of tracking changes
   */
  private notifyTrackedWindowChanged(isTracking: boolean, hwnd: number | null): void {
    this.trackedWindowCallbacks.forEach((callback) => {
      callback(isTracking, hwnd);
    });
  }

  /**
   * Get list of all visible system windows
   */
  async getWindows(): Promise<WindowInfo[]> {
    try {
      const windows = await invoke<WindowInfo[]>('get_windows');
      return windows;
    } catch (error) {
      await invoke('log_frontend_error', { msg: `[WindowService] Failed to get windows: ${error}` }).catch(() => {});
      return [];
    }
  }

  /**
   * Get the currently tracked window HWND
   */
  async getTrackedWindow(): Promise<number | null> {
    try {
      const hwnd = await invoke<number | null>('get_tracked_window');
      return hwnd;
    } catch (error) {
      await invoke('log_frontend_error', { msg: `[WindowService] Failed to get tracked window: ${error}` }).catch(() => {});
      return null;
    }
  }

  /**
   * Set the active client profile on the backend
   */
  async setActiveClientProfile(profile: any): Promise<void> {
    try {
      await invoke('set_active_client_profile', { profile });
      await invoke('log_frontend_info', { msg: `[WindowService] Set client profile: ${profile.name}` }).catch(() => {});
    } catch (error) {
      await invoke('log_frontend_error', { msg: `[WindowService] Failed to set client profile: ${error}` }).catch(() => {});
      throw error;
    }
  }

  /**
   * Set which window to track for overlay
   */
  async setTrackedWindow(hwnd: number): Promise<void> {
    try {
      await invoke('set_tracked_window', { hwnd });
      await invoke('log_frontend_info', { msg: `[WindowService] Set tracked window to HWND: ${hwnd}` }).catch(() => {});
    } catch (error) {
      await invoke('log_frontend_error', { msg: `[WindowService] Failed to set tracked window: ${error}` }).catch(() => {});
      throw error;
    }
  }

  /**
   * Subscribe to window tracking changes
   */
  async onTrackedWindowChanged(
    callback: (isTracking: boolean, hwnd: number | null) => void
  ): Promise<() => void> {
    // Initialize listeners on first subscription
    await this.initialize();

    this.trackedWindowCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.trackedWindowCallbacks.delete(callback);
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.unlisteners.forEach((unlisten) => unlisten());
    this.unlisteners = [];
    this.trackedWindowCallbacks.clear();
    this.initialized = false;
  }
}

// Export singleton instance
export const WindowService = new WindowServiceImpl();
