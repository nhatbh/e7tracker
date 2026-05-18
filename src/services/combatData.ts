import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";

// ── CONSTANTS ──
export const DEFAULT_COMBAT_DATA_URL = "https://e7analyzerslendymang-production.up.railway.app/api/hero-explorer";
const CACHE_KEY_METADATA = "combat_data_metadata";

// ── TYPES & INTERFACES ──

export interface CombatHero {
    hero: string;
    hero_name: string;
    count: number;
}

export interface CombatPlayerData {
    player: string;
    region: string;
    url: string;
    games: number;
    wins: number;
    win_rate: number;
    fp_wr: number;
    sp_wr: number;
    fp_games: number;
    sp_games: number;
}

export interface CombatPickStats {
    games: number;
    wins: number;
    win_rate: number;
}

export interface CombatPositionStats {
    wins: number;
    win_rate: number;
    pct: number;
    count: number;
}

export interface CombatPositionPick {
    hero: string;
    hero_name: string;
    count: number;
    win_rate: number;
}

export interface CombatBestPairByPosition {
    count: number;
    pct: number;
    win_rate: number;
    responding_to: Array<{
        hero: string;
        hero_name: string;
        count: number;
    }>;
}

export interface CombatBestPair {
    hero: string;
    hero_name: string;
    count: number;
    win_rate: number;
    by_position: Record<string, CombatBestPairByPosition>;
}

export interface CombatPreban {
    hero: string;
    hero_name?: string;
    count: number;
    win_rate?: number;
}

export interface CombatPilotBan {
    hero: string;
    hero_name: string;
    count: number;
    ban_rate: number;
}

export interface CombatCounter {
    hero: string;
    hero_name: string;
    count: number;
    wins: number;
    losses: number;
    win_rate: number;
    loss_pct: number;
    loss_by_position: Record<string, {
        count: number;
        pct: number;
    }>;
}

export interface CombatMatchup {
    hero: string;
    hero_name: string;
    count: number;
    wins: number;
    win_rate: number;
}

export interface CombatTopComp {
    heroes: string[];
    hero_names: string[];
    count: number;
    win_rate: number;
}

export interface CombatPrebanPair {
    heroes: string[];
    hero_names: string[];
    count: number;
    win_rate: number;
}

export interface CombatOppWinningPosition {
    hero: string;
    hero_name: string;
    count: number;
    pct: number;
}

export interface HeroAnalysis {
    hero_code?: string;
    hero_name: string;
    total_matches: number;
    total_losses: number;
    total_appearances: number;
    players: number;
    player_list: CombatPlayerData[];
    wins: number;
    win_rate: number;
    first_pick: CombatPickStats;
    second_pick: CombatPickStats;
    draft_position: Record<string, CombatPositionStats>;
    position_picks_fp: Record<string, CombatPositionPick[]>;
    position_picks_sp: Record<string, CombatPositionPick[]>;
    best_pairs_fp: CombatBestPair[];
    best_pairs_sp: CombatBestPair[];
    my_prebans: CombatPreban[];
    enemy_prebans: CombatPreban[];
    pilot_bans: CombatPilotBan[];
    counters_strong: CombatCounter[];
    counters_weak: CombatCounter[];
    matchups_fp: CombatMatchup[];
    matchups_sp: CombatMatchup[];
    top_comps: CombatTopComp[];
    preban_pairs: CombatPrebanPair[];
    opp_winning_positions: Record<string, CombatOppWinningPosition[]>;
}

export interface CombatMetadata {
    hero_list: CombatHero[];
    hero_image_map: Record<string, { name: string }>;
    total_matches: number;
    cachedAt: number;
    sourceUrl: string;
}

export interface CombatDataResponse {
    hero_list: CombatHero[];
    hero_analyses: Record<string, HeroAnalysis>;
    hero_image_map: Record<string, { name: string }>;
    total_matches: number;
}

// ── SERVICE CLASS ──

class CombatDataService {
    private metadata: CombatMetadata | null = null;
    private memoryAnalyses: Map<string, HeroAnalysis> = new Map(); // keyed by heroCode
    private isInitialFetching = false;
    private initError: string | null = null;

    /**
     * Helper to send log messages to the Rust backend terminal and console.
     */
    private async logInfo(msg: string): Promise<void> {
        console.log(msg);
        await invoke("log_frontend_info", { msg }).catch(() => {});
    }

    private async logError(msg: string, err?: any): Promise<void> {
        const fullMsg = err ? `${msg} | Error: ${err.message || err} | Stack: ${err.stack || ""}` : msg;
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

    /**
     * Initializes the service by reading cache. If cache misses, triggers auto-fetch.
     */
    async init(autoFetchOnMiss = true): Promise<void> {
        try {
            await this.logInfo("[CombatDataService] Initializing and checking cache...");
            const cachedMetaStr = await invoke<string | null>("cache_get", { key: CACHE_KEY_METADATA });
            if (cachedMetaStr) {
                this.metadata = JSON.parse(cachedMetaStr);
                await this.logInfo(`[CombatDataService] Cache HIT. Loaded metadata from cache. Total matches analyzed: ${this.metadata?.total_matches}. Cached at: ${new Date(this.metadata?.cachedAt || 0).toLocaleString()}`);
                return;
            }

            await this.logInfo("[CombatDataService] Cache MISS. Metadata not found in local cache.");
            if (autoFetchOnMiss) {
                await this.logInfo("[CombatDataService] Auto-fetching combat data on startup...");
                await this.fetchAndPartitionCombatData(DEFAULT_COMBAT_DATA_URL).catch(async (err) => {
                    await this.logError("[CombatDataService] Startup auto-fetch failed", err);
                });
            }
        } catch (e: any) {
            this.initError = e.message || String(e);
            await this.logError("[CombatDataService] Initialization error", e);
        }
    }

    async fetchAndPartitionCombatData(url: string, onProgress?: (msg: string) => void): Promise<void> {
        if (this.isInitialFetching) {
            await this.logError("[CombatDataService] Blocked: A fetch operation is already in progress.");
            throw new Error("A fetch operation is already in progress.");
        }

        this.isInitialFetching = true;
        this.initError = null;

        await this.logInfo(`[CombatDataService] Starting fetchAndPartitionCombatData. URL: "${url}"`);
        await this.emitProgress("Initiating GET request to Combat API...", 5);

        try {
            onProgress?.("Initiating GET request to Combat API...");
            await this.logInfo(`[CombatDataService] Dispatching fetch request to "${url}"...`);
            await this.emitProgress("Sending request to Railway...", 10);
            
            onProgress?.("Downloading and parsing 5MB JSON payload...");
            await this.emitProgress("Downloading and parsing 5MB JSON payload...", 25);
            await this.logInfo("[CombatDataService] Invoking native Rust fetch_combat_data command to bypass CORS...");
            
            const responseText = await invoke<string>("fetch_combat_data", { url }).catch(async (err) => {
                await this.logError(`[CombatDataService] NATIVE RUST FETCH FAILED to URL: "${url}"`, err);
                throw err;
            });

            await this.logInfo(`[CombatDataService] Native response received, parsing JSON (${(responseText.length / (1024 * 1024)).toFixed(2)} MB)...`);
            
            const data: CombatDataResponse = JSON.parse(responseText);

            await this.logInfo(`[CombatDataService] JSON parsing succeeded. Total heroes in list: ${data.hero_list?.length || 0}. Total analyses: ${data.hero_analyses ? Object.keys(data.hero_analyses).length : 0}`);
            await this.emitProgress("Creating metadata and partitioning data...", 40);

            if (!data.hero_analyses || Object.keys(data.hero_analyses).length === 0) {
                const errText = "No hero analyses found in response. Invalid structure.";
                await this.logError(`[CombatDataService] Validation failed: ${errText}`);
                throw new Error(errText);
            }

            onProgress?.("Creating metadata and partitioning data...");
            const metadata: CombatMetadata = {
                hero_list: data.hero_list || [],
                hero_image_map: data.hero_image_map || {},
                total_matches: data.total_matches || 0,
                cachedAt: Date.now(),
                sourceUrl: url
            };

            // Write metadata to cache
            onProgress?.("Caching metadata globally...");
            await this.emitProgress("Caching metadata globally...", 50);
            await this.logInfo(`[CombatDataService] Saving global metadata (key: "${CACHE_KEY_METADATA}") to disk...`);
            await invoke("cache_set", { key: CACHE_KEY_METADATA, value: JSON.stringify(metadata) }).catch(async (err) => {
                await this.logError(`[CombatDataService] Failed to write global metadata to disk`, err);
                throw err;
            });
            this.metadata = metadata;
            await this.logInfo("[CombatDataService] Global metadata cached successfully.");

            // Partition hero analyses and save individually
            const analyses = data.hero_analyses;
            const heroCodes = Object.keys(analyses);
            onProgress?.(`Partitioning and caching analytics for ${heroCodes.length} heroes...`);
            await this.logInfo(`[CombatDataService] Starting partitioning write for ${heroCodes.length} heroes...`);

            // We do caching in batches to avoid overwhelming the Tauri command queue
            const batchSize = 20;
            for (let i = 0; i < heroCodes.length; i += batchSize) {
                const batch = heroCodes.slice(i, i + batchSize);
                await this.logInfo(`[CombatDataService] Caching batch: heroes ${i} to ${Math.min(i + batchSize, heroCodes.length)}...`);
                await Promise.all(batch.map(async (code) => {
                    const heroAnalysis = analyses[code];
                    heroAnalysis.hero_code = code;
                    const cacheKey = `combat_analysis_${code}`;
                    // Write to local disk cache only (do not hold in RAM)
                    await invoke("cache_set", { key: cacheKey, value: JSON.stringify(heroAnalysis) }).catch(async (err) => {
                        await this.logError(`[CombatDataService] Failed to cache hero "${code}" to disk`, err);
                    });
                }));
                
                const percent = 50 + Math.round((Math.min(i + batchSize, heroCodes.length) / heroCodes.length) * 48);
                const progressMsg = `Caching: ${Math.min(i + batchSize, heroCodes.length)} / ${heroCodes.length} heroes...`;
                onProgress?.(progressMsg);
                await this.emitProgress(progressMsg, percent);
            }

            // Clear any lingering memory cache so V8 garbage collection can fully clean up the 5MB payload
            this.memoryAnalyses.clear();

            await this.logInfo(`[CombatDataService] Caching completed successfully for all ${heroCodes.length} heroes.`);
            onProgress?.("Combat data parsed, split, and cached successfully!");
            await this.emitProgress("Combat data parsed, split, and cached successfully!", 100, false);
        } catch (e: any) {
            this.initError = e.message || String(e);
            await this.logError("[CombatDataService] Fetch & partition error occurred", e);
            await this.emitProgress("Fetch & partition error occurred", 0, false, e.message || String(e));
            throw e;
        } finally {
            this.isInitialFetching = false;
        }
    }

    /**
     * Resolves a hero name (e.g. "Perfumer Byblis") to their analysis from memory or disk cache.
     */
    async getHeroAnalysis(heroName: string): Promise<HeroAnalysis | null> {
        if (!this.metadata) {
            await this.logError("[CombatDataService] Warn: Metadata not loaded, cannot get hero analysis.");
            return null;
        }

        await this.logInfo(`[CombatDataService] Resolving combat analysis for name: "${heroName}"`);

        // 1. Find hero code matching the display name
        const heroItem = this.metadata.hero_list.find(
            (h) => h.hero_name.toLowerCase().trim() === heroName.toLowerCase().trim()
        );

        if (!heroItem) {
            await this.logInfo(`[CombatDataService] Hero name "${heroName}" not found in metadata hero_list.`);
            return null;
        }

        const heroCode = heroItem.hero;
        await this.logInfo(`[CombatDataService] Display name "${heroName}" resolved to heroCode: "${heroCode}"`);

        // 2. Check memory cache
        if (this.memoryAnalyses.has(heroCode)) {
            await this.logInfo(`[CombatDataService] Memory Cache HIT for "${heroCode}"`);
            return this.memoryAnalyses.get(heroCode)!;
        }

        // 3. Check disk cache
        try {
            const cacheKey = `combat_analysis_${heroCode}`;
            await this.logInfo(`[CombatDataService] Memory Cache MISS for "${heroCode}". Querying disk cache with key: "${cacheKey}"...`);
            const cachedStr = await invoke<string | null>("cache_get", { key: cacheKey });
            if (cachedStr) {
                await this.logInfo(`[CombatDataService] Disk Cache HIT for "${heroCode}". Loading and parsing JSON...`);
                const parsed: HeroAnalysis = JSON.parse(cachedStr);
                parsed.hero_code = heroCode;
                
                // Implement bounded LRU/FIFO memory caching (max 5 heroes) to prevent RAM bloat
                if (this.memoryAnalyses.size >= 5) {
                    const oldestKey = this.memoryAnalyses.keys().next().value;
                    if (oldestKey) {
                        this.memoryAnalyses.delete(oldestKey);
                    }
                }
                this.memoryAnalyses.set(heroCode, parsed);
                return parsed;
            }
            await this.logInfo(`[CombatDataService] Disk Cache MISS for "${heroCode}". No record exists on disk.`);
        } catch (e) {
            await this.logError(`[CombatDataService] Failed to load cached analysis for ${heroName} (${heroCode})`, e);
        }

        return null;
    }

    /**
     * Clears all combat related caches from the disk cache.
     */
    async clearCombatCache(): Promise<void> {
        try {
            await this.logInfo("[CombatDataService] Clearing combat caches from disk...");
            await invoke("cache_remove", { key: CACHE_KEY_METADATA });
            if (this.metadata) {
                for (const h of this.metadata.hero_list) {
                    await invoke("cache_remove", { key: `combat_analysis_${h.hero}` }).catch(() => {});
                }
            }
            this.metadata = null;
            this.memoryAnalyses.clear();
            this.initError = null;
            await this.logInfo("[CombatDataService] Combat caches cleared successfully.");
        } catch (e) {
            await this.logError("[CombatDataService] Error clearing combat caches", e);
            throw e;
        }
    }

    // Getters for frontend components
    getMetadata() { return this.metadata; }
    isFetching() { return this.isInitialFetching; }
    getError() { return this.initError; }
}

export const CombatData = new CombatDataService();

// ── METAGAME DATA SERVICE ──
export const DEFAULT_METAGAME_DATA_URL = "https://e7analyzerslendymang-production.up.railway.app/api/meta-dashboard";
const CACHE_KEY_METAGAME_METADATA = "metagame_data_metadata";

export interface MetagameHero {
    hero: string;
    hero_name: string;
    picks: number;
    played: number;
    bans: number;
    wins: number;
    losses: number;
    pick_rate: number;
    ban_rate: number;
    pick_ban_rate: number;
    win_rate: number;
    players_using: number;
}

export interface MetagameOverview {
    total_matches: number;
    total_perspectives: number;
    total_players: number;
    first_pick_advantage: {
        first_pick_wr: number;
        second_pick_wr: number;
    };
}

export interface MetagameMetadata {
    overview: MetagameOverview;
    hero_list: { hero: string; hero_name: string }[];
    cachedAt: number;
    sourceUrl: string;
}

export interface MetagameDataResponse {
    generated_at: string;
    overview: MetagameOverview;
    hero_meta: MetagameHero[];
}

class MetagameDataService {
    private metadata: MetagameMetadata | null = null;
    private memoryMeta: Map<string, MetagameHero> = new Map(); // keyed by heroCode
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

    async init(autoFetchOnMiss = true): Promise<void> {
        try {
            await this.logInfo("[MetagameDataService] Initializing and checking cache...");
            const cachedMetaStr = await invoke<string | null>("cache_get", { key: CACHE_KEY_METAGAME_METADATA });
            if (cachedMetaStr) {
                this.metadata = JSON.parse(cachedMetaStr);
                await this.logInfo(`[MetagameDataService] Cache HIT. Loaded metadata from cache. Cached at: ${new Date(this.metadata?.cachedAt || 0).toLocaleString()}`);
                return;
            }

            await this.logInfo("[MetagameDataService] Cache MISS. Metadata not found in local cache.");
            if (autoFetchOnMiss) {
                await this.logInfo("[MetagameDataService] Auto-fetching metagame data on startup...");
                await this.fetchAndPartitionMetagameData(DEFAULT_METAGAME_DATA_URL).catch(async (err) => {
                    await this.logError("[MetagameDataService] Startup auto-fetch failed", err);
                });
            }
        } catch (e: any) {
            this.initError = e.message || String(e);
            await this.logError("[MetagameDataService] Initialization error", e);
        }
    }

    async fetchAndPartitionMetagameData(url: string, onProgress?: (msg: string) => void): Promise<void> {
        if (this.isInitialFetching) {
            await this.logError("[MetagameDataService] Blocked: A fetch operation is already in progress.");
            throw new Error("A fetch operation is already in progress.");
        }

        this.isInitialFetching = true;
        this.initError = null;

        await this.logInfo(`[MetagameDataService] Starting fetchAndPartitionMetagameData. URL: "${url}"`);
        await this.emitProgress("Initiating GET request to Metagame API...", 5);

        try {
            onProgress?.("Initiating GET request to Metagame API...");
            await this.emitProgress("Sending request to Railway...", 10);
            
            onProgress?.("Downloading and parsing Metagame JSON payload...");
            await this.emitProgress("Downloading and parsing Metagame JSON payload...", 25);
            
            const responseText = await invoke<string>("fetch_combat_data", { url }).catch(async (err) => {
                await this.logError(`[MetagameDataService] NATIVE RUST FETCH FAILED to URL: "${url}"`, err);
                throw err;
            });

            await this.logInfo(`[MetagameDataService] Native response received, parsing JSON (${(responseText.length / (1024 * 1024)).toFixed(2)} MB)...`);
            
            const data: MetagameDataResponse = JSON.parse(responseText);

            await this.logInfo(`[MetagameDataService] JSON parsing succeeded. Total heroes in list: ${data.hero_meta?.length || 0}`);
            await this.emitProgress("Creating metadata and partitioning data...", 40);

            if (!data.hero_meta || data.hero_meta.length === 0) {
                const errText = "No hero meta found in response. Invalid structure.";
                await this.logError(`[MetagameDataService] Validation failed: ${errText}`);
                throw new Error(errText);
            }

            const heroList = data.hero_meta.map(h => ({ hero: h.hero, hero_name: h.hero_name }));

            const metadata: MetagameMetadata = {
                overview: data.overview,
                hero_list: heroList,
                cachedAt: Date.now(),
                sourceUrl: url
            };

            // Write metadata to cache
            onProgress?.("Caching metadata globally...");
            await this.emitProgress("Caching metadata globally...", 50);
            await invoke("cache_set", { key: CACHE_KEY_METAGAME_METADATA, value: JSON.stringify(metadata) }).catch(async (err) => {
                await this.logError(`[MetagameDataService] Failed to write global metadata to disk`, err);
                throw err;
            });
            this.metadata = metadata;

            // Partition hero meta and save individually
            const heroMetaList = data.hero_meta;
            onProgress?.(`Partitioning and caching metagame for ${heroMetaList.length} heroes...`);

            const batchSize = 30;
            for (let i = 0; i < heroMetaList.length; i += batchSize) {
                const batch = heroMetaList.slice(i, i + batchSize);
                await Promise.all(batch.map(async (heroMeta) => {
                    const cacheKey = `metagame_hero_${heroMeta.hero}`;
                    await invoke("cache_set", { key: cacheKey, value: JSON.stringify(heroMeta) }).catch(async (err) => {
                        await this.logError(`[MetagameDataService] Failed to cache hero "${heroMeta.hero}" to disk`, err);
                    });
                }));
                
                const percent = 50 + Math.round((Math.min(i + batchSize, heroMetaList.length) / heroMetaList.length) * 48);
                const progressMsg = `Caching: ${Math.min(i + batchSize, heroMetaList.length)} / ${heroMetaList.length} heroes...`;
                onProgress?.(progressMsg);
                await this.emitProgress(progressMsg, percent);
            }

            this.memoryMeta.clear();
            await this.logInfo(`[MetagameDataService] Caching completed successfully for all ${heroMetaList.length} heroes.`);
            onProgress?.("Metagame data parsed, split, and cached successfully!");
            await this.emitProgress("Metagame data parsed, split, and cached successfully!", 100, false);
        } catch (e: any) {
            this.initError = e.message || String(e);
            await this.logError("[MetagameDataService] Fetch & partition error occurred", e);
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
            await this.logError(`[MetagameDataService] Failed to load cached metagame for ${heroName}`, e);
        }

        return null;
    }

    async clearMetagameCache(): Promise<void> {
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
            await this.logError("[MetagameDataService] Error clearing metagame caches", e);
            throw e;
        }
    }

    getMetadata() { return this.metadata; }
    isFetching() { return this.isInitialFetching; }
    getError() { return this.initError; }
}

export const MetagameData = new MetagameDataService();
