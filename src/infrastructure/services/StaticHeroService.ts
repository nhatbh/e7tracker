/**
 * Implementation of Hero Metadata Service
 * Fetches and caches hero data from remote CDN and local disk
 */

import { invoke } from "@tauri-apps/api/core";
import { HeroMetadata } from '../../domain/models/Hero';
import { IHeroMetadataService } from '../../domain/services/IHeroMetadataService';

const HERO_DATA_URL = "https://e7-optimizer-game-data.s3-accelerate.amazonaws.com/herodata.json";
const CACHE_KEY_HERO = "buildassist_hero_data";
const CACHE_KEY_TIME = "buildassist_cache_time";

export class StaticHeroService implements IHeroMetadataService {
  private heroData: Record<string, HeroMetadata> | null = null;
  private _isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._performInit();
    return this.initPromise;
  }

  private async _performInit(): Promise<void> {
    try {
      const hStr = await invoke<string | null>("cache_get", { key: CACHE_KEY_HERO });
      
      if (hStr) {
        this.heroData = JSON.parse(hStr);
        this._isInitialized = true;
        return;
      }
      
      await this.refetchHeroData();
      this._isInitialized = true;
    } catch (e) {
      console.error("[StaticHeroService] Initialization failed", e);
      this._isInitialized = true; // Still allow app to attempt operation
    }
  }

  async waitForInit(): Promise<void> {
    if (this._isInitialized) return;
    if (this.initPromise) await this.initPromise;
    else await this.init();
  }

  getHeroByName(name: string): HeroMetadata | null {
    if (!this.heroData) return null;
    const key = name.toLowerCase().replace(/[\s\-]+/g, '_');
    return this.heroData[key] || null;
  }

  getAllHeroes(): HeroMetadata[] {
    return this.heroData ? Object.values(this.heroData) : [];
  }

  getHeroList(): string[] {
    return this.heroData ? Object.keys(this.heroData).sort() : [];
  }

  matchHeroName(ocrName: string): string | null {
    if (!this.heroData) return null;
    // Simple matching (Can elaborate with edit distance later)
    const normalized = ocrName.toLowerCase().replace(/[\s\-]+/g, '_');
    return Object.keys(this.heroData).find(k => k === normalized) || null;
  }

  async refetchHeroData(): Promise<void> {
    const res = await fetch(HERO_DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    this.heroData = await res.json();
    const hStr = JSON.stringify(this.heroData);
    
    await invoke("cache_set", { key: CACHE_KEY_HERO, value: hStr });
    await invoke("cache_set", { key: CACHE_KEY_TIME, value: Date.now().toString() });
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }
}
