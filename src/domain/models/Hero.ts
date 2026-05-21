/**
 * Static Hero Metadata
 * Represents a hero's base definition from the static database
 */

export interface HeroMetadata {
  /** Unique identifier (e.g., "armin") */
  code: string;
  /** Display name (e.g., "Armin") */
  name: string;
  /** Element type: fire, ice, earth, dark, light */
  element: 'fire' | 'ice' | 'earth' | 'dark' | 'light';
  /** Zodiac sign */
  zodiac?: string;
  /** Base attack stat */
  baseAttack?: number;
  /** Base defense stat */
  baseDefense?: number;
  /** Base health stat */
  baseHealth?: number;
  /** Class/role: knight, warrior, mage, ranger, soulweaver, thief */
  class?: string;
  /** Path in the constellation/skyladder */
  constellation?: string;
  /** Full raw data from the static database */
  rawData?: any;
}
