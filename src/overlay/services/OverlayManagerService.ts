/**
 * OverlayManagerService
 * Singleton service to manage interactive overlay state and data
 */

import { InteractivePageType, OverlayDefinition } from '../../domain/models';

type OverlayChangeCallback = (overlayId: InteractivePageType | null) => void;

class OverlayManagerService {
  private static instance: OverlayManagerService;
  private activeOverlayId: InteractivePageType | null = null;
  private activeOverlayData: any = null;
  private overlays: Map<InteractivePageType, OverlayDefinition> = new Map();
  private listeners: Set<OverlayChangeCallback> = new Set();

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): OverlayManagerService {
    if (!OverlayManagerService.instance) {
      OverlayManagerService.instance = new OverlayManagerService();
    }
    return OverlayManagerService.instance;
  }

  /**
   * Register an overlay definition
   */
  registerOverlay(definition: OverlayDefinition): void {
    this.overlays.set(definition.id, definition);
  }

  /**
   * Unregister an overlay definition
   */
  unregisterOverlay(id: InteractivePageType): void {
    this.overlays.delete(id);
    if (this.activeOverlayId === id) {
      this.closeOverlay();
    }
  }

  /**
   * Get an overlay definition by ID
   */
  getOverlay(id: InteractivePageType): OverlayDefinition | undefined {
    return this.overlays.get(id);
  }

  /**
   * Get all registered overlays
   */
  getAllOverlays(): OverlayDefinition[] {
    return Array.from(this.overlays.values());
  }

  /**
   * Get the currently active overlay ID
   */
  getActiveOverlayId(): InteractivePageType | null {
    return this.activeOverlayId;
  }

  /**
   * Get the data associated with the active overlay
   */
  getActiveOverlayData(): any {
    return this.activeOverlayData;
  }

  /**
   * Open a specific overlay with optional data payload
   */
  openOverlay(id: InteractivePageType, data?: any): void {
    if (this.overlays.has(id)) {
      this.activeOverlayId = id;
      this.activeOverlayData = data || null;
      this.notifyListeners();
    } else {
      console.warn(`[OverlayManager] Overlay ${id} is not registered.`);
    }
  }

  /**
   * Close the currently active overlay
   */
  closeOverlay(): void {
    this.activeOverlayId = null;
    this.activeOverlayData = null;
    this.notifyListeners();
  }

  /**
   * Toggle an overlay open/closed
   */
  toggleOverlay(id: InteractivePageType, data?: any): void {
    if (this.activeOverlayId === id) {
      this.closeOverlay();
    } else {
      this.openOverlay(id, data);
    }
  }

  /**
   * Check if a specific overlay is active
   */
  isOverlayActive(id: InteractivePageType): boolean {
    return this.activeOverlayId === id;
  }

  /**
   * Subscribe to overlay changes
   */
  onOverlayChange(callback: OverlayChangeCallback): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback(this.activeOverlayId));
  }
}

export const overlayManager = OverlayManagerService.getInstance();
export { OverlayManagerService };
