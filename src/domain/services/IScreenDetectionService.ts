/**
 * Screen Detection Service Interface
 * Defines contract for screen detection and frame parsing
 */

import { ScreenType, ParsedDetection, ParsedFrameResult, FrameResult, DetectionSlot } from '../models/DetectionSchema';

export interface IScreenDetectionService {
  /**
   * Parse raw frame result from backend into type-safe ParsedFrameResult
   */
  parseFrameResult(raw: FrameResult): ParsedFrameResult;

  /**
   * Get the current detected screen type
   */
  getCurrentScreen(): ScreenType;

  /**
   * Register a callback for screen changes
   * Returns unsubscribe function
   */
  onScreenChanged(callback: (screen: ScreenType) => void): () => void;

  /**
   * Get all detections for a specific slot on current screen
   */
  getDetectionsForSlot(slot: DetectionSlot): ParsedDetection[];

  /**
   * Check if a slot is available on current screen
   */
  isSlotAvailable(slot: DetectionSlot): boolean;

  /**
   * Update the current frame result (called when new detection arrives)
   */
  updateFrameResult(raw: FrameResult): void;

  /**
   * Get the latest parsed frame result
   */
  getLatestFrameResult(): ParsedFrameResult | null;
}
