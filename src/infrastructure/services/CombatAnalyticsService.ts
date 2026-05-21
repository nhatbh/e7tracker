/**
 * Implementation of Combat Analytics Service
 * Fetches and caches hero combat analysis data
 */

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { HeroAnalysis, CombatMetadata } from '../../domain/models/CombatAnalytics';
import { ICombatAnalyticsService } from '../../domain/services/ICombatAnalyticsService';

const CACHE_KEY_METADATA = "combat_data_metadata";

export class CombatAnalyticsService implements ICombatAnalyticsService {
  private metadata: CombatMetadata | null = null;
  private memoryAnalyses: Map<string, HeroAnalysis> = new Map();
  private isInitialFetching = false;
  private initError: string | null = null;

  private async logInfo(msg: string): Promise<void> {
    console.log(msg);
    await invoke("log_frontend_info", { msg }).catch(() => {});
  }

  private async logError(msg: string, err?: any): Promise<void> {
    const fullMsg = err ? `${msg} | Error: ${err.message || err}` : msg;
    console.error(fullMsg);
    await invoke("log_frontend_error", { msg: fullMsg }).catch(() => {});
  }

  private async emitProgress(message: string, progress: number, isFetching = true, error: string | null = null): Promise<void> {
    try {
      await emit("combat-fetch-progress", { isFetching, message, progress, error });
    } catch (e) {
      console.error("Failed to emit fetch progress event:", e);
    }
  }

  async init(): Promise<void> {
    try {
      await this.logInfo("[CombatAnalyticsService] Initializing and checking cache...");
      const cachedMetaStr = await invoke<string | null>("cache_get", { key: CACHE_KEY_METADATA });
      if (cachedMetaStr) {
        this.metadata = JSON.parse(cachedMetaStr);
        await this.logInfo(`[CombatAnalyticsService] Cache HIT. Loaded metadata from cache.`);
      } else {
        await this.logInfo("[CombatAnalyticsService] Cache MISS. Metadata not found in local cache.");
      }
    } catch (e: any) {
      this.initError = e.message || String(e);
      await this.logError("[CombatAnalyticsService] Initialization error", e);
    }
  }

  async fetchAndPartitionCombatData(url: string, onProgress?: (msg: string) => void): Promise<void> {
    if (this.isInitialFetching) {
      throw new Error("A fetch operation is already in progress.");
    }

    this.isInitialFetching = true;
    this.initError = null;

    try {
      await this.logInfo(`[CombatAnalyticsService] Starting fetch from URL: "${url}"`);
      await this.emitProgress("Initiating GET request to Combat API...", 5);

      const responseText = await invoke<string>("fetch_combat_data", { url });
      await this.logInfo(`[CombatAnalyticsService] Response received, parsing JSON...`);

      const data: any = JSON.parse(responseText);

      if (!data.hero_analyses || Object.keys(data.hero_analyses).length === 0) {
        throw new Error("No hero analyses found in response.");
      }

      const metadata: CombatMetadata = {
        hero_list: data.hero_list || [],
        hero_image_map: data.hero_image_map || {},
        total_matches: data.total_matches || 0,
        cachedAt: Date.now(),
        sourceUrl: url
      };

      await this.emitProgress("Caching metadata globally...", 50);
      await invoke("cache_set", { key: CACHE_KEY_METADATA, value: JSON.stringify(metadata) });
      this.metadata = metadata;

      const analyses = data.hero_analyses;
      const heroCodes = Object.keys(analyses);
      const batchSize = 20;

      for (let i = 0; i < heroCodes.length; i += batchSize) {
        const batch = heroCodes.slice(i, i + batchSize);
        await Promise.all(batch.map(async (code) => {
          const heroAnalysis = analyses[code];
          heroAnalysis.hero_code = code;
          const cacheKey = `combat_analysis_${code}`;
          await invoke("cache_set", { key: cacheKey, value: JSON.stringify(heroAnalysis) }).catch(() => {});
        }));

        const percent = 50 + Math.round((Math.min(i + batchSize, heroCodes.length) / heroCodes.length) * 48);
        await this.emitProgress(`Caching: ${Math.min(i + batchSize, heroCodes.length)} / ${heroCodes.length} heroes...`, percent);
      }

      this.memoryAnalyses.clear();
      await this.logInfo(`[CombatAnalyticsService] Caching completed successfully.`);
      await this.emitProgress("Combat data cached successfully!", 100, false);
    } catch (e: any) {
      this.initError = e.message || String(e);
      await this.logError("[CombatAnalyticsService] Fetch & partition error", e);
      await this.emitProgress("Fetch & partition error occurred", 0, false, e.message || String(e));
      throw e;
    } finally {
      this.isInitialFetching = false;
    }
  }

  async getHeroAnalysis(heroName: string): Promise<HeroAnalysis | null> {
    if (!this.metadata) return null;

    const heroItem = this.metadata.hero_list.find(
      (h) => h.hero_name.toLowerCase().trim() === heroName.toLowerCase().trim()
    );

    if (!heroItem) return null;

    const heroCode = heroItem.hero;

    if (this.memoryAnalyses.has(heroCode)) {
      return this.memoryAnalyses.get(heroCode)!;
    }

    try {
      const cacheKey = `combat_analysis_${heroCode}`;
      const cachedStr = await invoke<string | null>("cache_get", { key: cacheKey });
      if (cachedStr) {
        const parsed: HeroAnalysis = JSON.parse(cachedStr);
        parsed.hero_code = heroCode;

        if (this.memoryAnalyses.size >= 5) {
          const oldestKey = this.memoryAnalyses.keys().next().value;
          if (oldestKey) this.memoryAnalyses.delete(oldestKey);
        }
        this.memoryAnalyses.set(heroCode, parsed);
        return parsed;
      }
    } catch (e) {
      await this.logError(`[CombatAnalyticsService] Failed to load cached analysis for ${heroName}`, e);
    }

    return null;
  }

  getMetadata(): CombatMetadata | null {
    return this.metadata;
  }

  isFetching(): boolean {
    return this.isInitialFetching;
  }

  getError(): string | null {
    return this.initError;
  }

  async clearCache(): Promise<void> {
    try {
      await invoke("cache_remove", { key: CACHE_KEY_METADATA });
      if (this.metadata) {
        for (const h of this.metadata.hero_list) {
          await invoke("cache_remove", { key: `combat_analysis_${h.hero}` }).catch(() => {});
        }
      }
      this.metadata = null;
      this.memoryAnalyses.clear();
      this.initError = null;
    } catch (e) {
      await this.logError("[CombatAnalyticsService] Error clearing caches", e);
      throw e;
    }
  }
}
