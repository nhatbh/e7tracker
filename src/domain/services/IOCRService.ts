/**
 * OCR Service Interface
 * Defines contract for OCR scanning operations
 */

import { DetectionSlot, ParsedStats } from '../models/DetectionSchema';

export interface IOCRService {
  /**
   * Scan hero stats from the stats panel
   */
  scanHeroStats(): Promise<ParsedStats | null>;

  /**
   * Identify hero name from current detection
   */
  identifyHeroName(): Promise<string | null>;

  /**
   * Perform OCR on a specific slot
   */
  performOCROnSlot(slot: DetectionSlot): Promise<string | null>;

  /**
   * Parse raw OCR text into structured stats
   */
  parseOCRStats(text: string): ParsedStats | null;
}
