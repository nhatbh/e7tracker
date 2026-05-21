/**
 * OCR Registry
 * Code-based configuration for detection rules and slot mappings
 */

import { ScreenType, DetectionSlot } from '../models/DetectionSchema';

/**
 * Maps screen types to available detection slots
 * This defines what data can be extracted from each screen
 */
export const ScreenDetectionRegistry: Record<ScreenType, DetectionSlot[]> = {
  [ScreenType.HeroStats]: [DetectionSlot.SelectedHero, DetectionSlot.StatsPanel],
  [ScreenType.Lobby]: [DetectionSlot.MenuButton],
  [ScreenType.GuildWar]: [DetectionSlot.SelectedHero],
  [ScreenType.Unknown]: [],
};

/**
 * Maps raw slot ID strings from backend to canonical DetectionSlot enums
 * This is the source of truth for slot name mapping
 */
export const SlotRegistry: Record<string, DetectionSlot> = {
  "selected_hero": DetectionSlot.SelectedHero,
  "hero_stats_panel": DetectionSlot.StatsPanel,
  "menu_button": DetectionSlot.MenuButton,
};

/**
 * Reverse mapping: DetectionSlot enum to raw string ID
 * Used when sending requests to backend
 */
export const SlotToStringRegistry: Record<DetectionSlot, string> = {
  [DetectionSlot.SelectedHero]: "selected_hero",
  [DetectionSlot.StatsPanel]: "hero_stats_panel",
  [DetectionSlot.MenuButton]: "menu_button",
};

/**
 * Helper function to validate if a slot ID is recognized
 */
export function isValidSlotId(slotId: string): boolean {
  return slotId in SlotRegistry;
}

/**
 * Helper function to get DetectionSlot from raw string ID
 */
export function getDetectionSlot(slotId: string): DetectionSlot | null {
  return SlotRegistry[slotId] || null;
}
