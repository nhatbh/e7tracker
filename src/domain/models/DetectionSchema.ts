/**
 * OCR Detection Schema
 * Defines all types and enums for screen detection and OCR operations
 */

/**
 * Screen types that the application can detect
 */
export enum ScreenType {
  Lobby = "Lobby",
  HeroStats = "Hero_Stats",
  GuildWar = "Guild_War",
  Unknown = "Unknown",
}

/**
 * Detection slots - specific data points we can extract from screens
 */
export enum DetectionSlot {
  SelectedHero = "selected_hero",
  StatsPanel = "hero_stats_panel",
  MenuButton = "menu_button",
}

/**
 * Raw detection result from backend ONNX model
 */
export interface Detection {
  slot_id: string;
  hero_name?: string;
  coordinates?: { x: number; y: number; w: number; h: number };
  confidence?: number;
  [key: string]: any;
}

/**
 * Raw frame result from backend
 */
export interface FrameResult {
  screen_name: string;
  detections?: Detection[];
  timestamp?: number;
}

/**
 * Parsed, type-safe detection result
 */
export interface ParsedDetection {
  slot: DetectionSlot;
  heroName?: string;
  coordinates?: { x: number; y: number; w: number; h: number };
  confidence?: number;
}

/**
 * Parsed, type-safe frame result
 */
export interface ParsedFrameResult {
  screen: ScreenType;
  detections: ParsedDetection[];
  timestamp: number;
}

/**
 * Parsed OCR stats from hero stats panel
 */
export interface ParsedStats {
  atk: number;
  defense: number;
  hp: number;
  speed: number;
  chc: number;
  chd: number;
  eff: number;
  efr: number;
}
