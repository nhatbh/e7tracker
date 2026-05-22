/**
 * Implementation of Hero Metadata Service
 * Fetches and caches hero data from remote CDN and local disk
 */

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
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
    return this.heroData[name] || null;
  }

  getAllHeroes(): HeroMetadata[] {
    return this.heroData ? Object.values(this.heroData) : [];
  }

  getHeroList(): string[] {
    return this.heroData ? Object.keys(this.heroData).sort() : [];
  }

  matchHeroName(ocrName: string): HeroMetadata | null {
    if (!this.heroData) return null;

    const cleanedOcr = ocrName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ');
    
    // 1. Get all candidates that partially match
    const candidates = Object.keys(this.heroData).filter(key => {
        const cleanedKey = key.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ');
        return cleanedKey === cleanedOcr || cleanedKey.includes(cleanedOcr) || cleanedOcr.includes(cleanedKey);
    });

    if (candidates.length === 0) return null;

    // 2. Rank candidates:
    // - Exact matches (after cleaning) get priority
    // - Then by length proximity (smallest difference in length)
    const bestMatch = candidates.sort((a, b) => {
        const cleanedA = a.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ');
        const cleanedB = b.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ');

        // Exact match is always best
        if (cleanedA === cleanedOcr && cleanedB !== cleanedOcr) return -1;
        if (cleanedB === cleanedOcr && cleanedA !== cleanedOcr) return 1;

        // Otherwise, prefer length similarity
        return Math.abs(cleanedA.length - cleanedOcr.length) - Math.abs(cleanedB.length - cleanedOcr.length);
    })[0];

    return bestMatch ? this.heroData[bestMatch] : null;
  }

  async refetchHeroData(): Promise<void> {
    await emit("fetch-progress", { type: "hero", progress: 10, isFetching: true, message: "Fetching hero data..." });
    const res = await fetch(HERO_DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    await emit("fetch-progress", { type: "hero", progress: 50, isFetching: true, message: "Parsing hero data..." });
    this.heroData = await res.json();
    const hStr = JSON.stringify(this.heroData);
    
    await invoke("cache_set", { key: CACHE_KEY_HERO, value: hStr });
    await invoke("cache_set", { key: CACHE_KEY_TIME, value: Date.now().toString() });
    await emit("fetch-progress", { type: "hero", progress: 100, isFetching: false, message: "Hero data cached successfully" });
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }
}
