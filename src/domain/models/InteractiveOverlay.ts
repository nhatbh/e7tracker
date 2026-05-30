/**
 * Interactive Overlay Domain Models
 * Defines types and enums for the interactive overlay system
 */

export enum InteractivePageType {
  Dashboard = 'dashboard',
  HeroDetails = 'hero_details'
}

export interface OverlayKeybind {
  alt?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  key: string;
}

export interface OverlayDefinition<T = any> {
  id: InteractivePageType;
  keybind?: OverlayKeybind;
  component: React.FC<T>;
  props?: T;
}
