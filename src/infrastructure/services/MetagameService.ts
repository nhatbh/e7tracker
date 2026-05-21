/**
 * Implementation of Metagame Service
 * Fetches and caches metagame trend data
 */

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { MetagameHero, MetagameMetadata } from '../../domain/models/MetagameData';
import { IMetagameService } from '../../domain/services/IMetagameService';

const CACHE_KEY_METAGAME_METADATA = "metagame_data_metadata";

export class MetagameService implements IMetagameService {
  private metadata: MetagameMetadata | null = null;
  private memoryMeta: Map<string, MetagameHero> = new Map();
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
      await emit("metagame-fetch-progress", { isFetching, message, progress, error });
    } catch (e) {
      console.error("Failed to emit metagame fetch progress event:", e);
    }
  }

  async init(): Promise<void> {
    try {
      await this.logInfo("[MetagameService] Initializing and checking cache...");
      const cachedMetaStr = await invoke<string | null>("cache_get", { key: CACHE_KEY_METAGAME_METADATA });
      if (cachedMetaStr) {
        this.metadata = JSON.parse(cachedMetaStr);
        await this.logInfo(`[MetagameService] Cache HIT. Loaded metadata from cache.`);
      } else {
        await this.logInfo("[MetagameService] Cache MISS. Metadata not found in local cache.");
      }
    } catch (e: any) {
      this.initError = e.message || String(e);
      await this.logError("[MetagameService] Initialization error", e);
    }
  }

  async fetchAndPartitionMetagameData(url: string, onProgress?: (msg: string) => void): Promise<void> {
    if (this.isInitialFetching) {
      throw new Error("A fetch operation is already in progress.");
    }

    this.isInitialFetching = true;
    this.initError = null;

    try {
      await this.logInfo(`[MetagameService] Starting fetch from URL: "${url}"`);
      await this.emitProgress("Initiating GET request to Metagame API...", 5);

      const responseText = await invoke<string>("fetch_combat_data", { url });
      await this.logInfo(`[MetagameService] Response received, parsing JSON...`);

      const data: any = JSON.parse(responseText);

      if (!data.hero_meta || data.hero_meta.length === 0) {
        throw new Error("No hero meta found in response.");
      }

      const heroList = data.hero_meta.map((h: any) => ({ hero: h.hero, hero_name: h.hero_name }));

      const metadata: MetagameMetadata = {
        overview: data.overview,
        hero_list: heroList,
        cachedAt: Date.now(),
        sourceUrl: url
      };

      await this.emitProgress("Caching metadata globally...", 50);
      await invoke("cache_set", { key: CACHE_KEY_METAGAME_METADATA, value: JSON.stringify(metadata) });
      this.metadata = metadata;

      const heroMetaList = data.hero_meta;
      const batchSize = 30;

      for (let i = 0; i < heroMetaList.length; i += batchSize) {
        const batch = heroMetaList.slice(i, i + batchSize);
        await Promise.all(batch.map(async (heroMeta: any) => {
          const cacheKey = `metagame_hero_${heroMeta.hero}`;
          await invoke("cache_set", { key: cacheKey, value: JSON.stringify(heroMeta) }).catch(() => {});
        }));

        const percent = 50 + Math.round((Math.min(i + batchSize, heroMetaList.length) / heroMetaList.length) * 48);
        await this.emitProgress(`Caching: ${Math.min(i + batchSize, heroMetaList.length)} / ${heroMetaList.length} heroes...`, percent);
      }

      this.memoryMeta.clear();
      await this.logInfo(`[MetagameService] Caching completed successfully.`);
      await this.emitProgress("Metagame data cached successfully!", 100, false);
    } catch (e: any) {
      this.initError = e.message || String(e);
      await this.logError("[MetagameService] Fetch & partition error", e);
      await this.emitProgress("Fetch & partition error occurred", 0, false, e.message || String(e));
      throw e;
    } finally {
      this.isInitialFetching = false;
    }
  }

  async getHeroMetagame(heroName: string): Promise<MetagameHero | null> {
    if (!this.metadata) return null;

    const heroItem = this.metadata.hero_list.find(
      (h) => h.hero_name.toLowerCase().trim() === heroName.toLowerCase().trim()
    );

    if (!heroItem) return null;

    const heroCode = heroItem.hero;

    if (this.memoryMeta.has(heroCode)) {
      return this.memoryMeta.get(heroCode)!;
    }

    try {
      const cacheKey = `metagame_hero_${heroCode}`;
      const cachedStr = await invoke<string | null>("cache_get", { key: cacheKey });
      if (cachedStr) {
        const parsed: MetagameHero = JSON.parse(cachedStr);
        if (this.memoryMeta.size >= 10) {
          const oldestKey = this.memoryMeta.keys().next().value;
          if (oldestKey) this.memoryMeta.delete(oldestKey);
        }
        this.memoryMeta.set(heroCode, parsed);
        return parsed;
      }
    } catch (e) {
      await this.logError(`[MetagameService] Failed to load cached metagame for ${heroName}`, e);
    }

    return null;
  }

  getMetadata(): MetagameMetadata | null {
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
      await invoke("cache_remove", { key: CACHE_KEY_METAGAME_METADATA });
      if (this.metadata) {
        for (const h of this.metadata.hero_list) {
          await invoke("cache_remove", { key: `metagame_hero_${h.hero}` }).catch(() => {});
        }
      }
      this.metadata = null;
      this.memoryMeta.clear();
      this.initError = null;
    } catch (e) {
      await this.logError("[MetagameService] Error clearing caches", e);
      throw e;
    }
  }
}
