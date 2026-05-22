/**
 * Client Profile Model
 * Defines configuration for different game clients with offset settings
 */

export interface LayoutDimension {
  pixels: number;
  percent: number;
}

export interface LayoutConfig {
  offset: {
    x: LayoutDimension;
    y: LayoutDimension;
  };
  size: {
    width: LayoutDimension;
    height: LayoutDimension;
  };
}

export interface ClientProfile {
  id: string;
  name: string;
  /** Exact window title to match for auto-detection */
  windowTitlePattern: string;

  layout: LayoutConfig;

  enabled: boolean;
}

/**
 * Calculate actual pixel value for a layout dimension
 */
export function calculateDimension(dim: LayoutDimension, base: number): number {
  return dim.pixels + (base * dim.percent) / 100;
}

/**
 * Calculate total X-Y layout (position and size) for a given window size
 */
export function calculateClientLayout(
  profile: ClientProfile,
  windowWidth: number,
  windowHeight: number
): { x: number; y: number; width: number; height: number } {
  const { offset, size } = profile.layout;
  
  return {
    x: calculateDimension(offset.x, windowWidth),
    y: calculateDimension(offset.y, windowHeight),
    width: calculateDimension(size.width, windowWidth),
    height: calculateDimension(size.height, windowHeight),
  };
}
