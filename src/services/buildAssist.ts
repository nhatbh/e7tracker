import { invoke } from "@tauri-apps/api/core";

const HERO_DATA_URL = "https://e7-optimizer-game-data.s3-accelerate.amazonaws.com/herodata.json";
const ARTIFACT_DATA_URL = "https://e7-optimizer-game-data.s3-accelerate.amazonaws.com/artifactdata.json";
const GET_BUILDS_URL = "https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/dev/getBuilds";

const CACHE_KEY_HERO = "buildassist_hero_data";
const CACHE_KEY_ARTIFACT = "buildassist_artifact_data";
const CACHE_KEY_TIME = "buildassist_cache_time";



export interface BuildData {
    artifactCode: string;
    atk: number;
    chc: number;
    chd: number;
    createDate: string;
    def: number;
    eff: number;
    efr: number;
    gs: number;
    hp: number;
    sets: Record<string, string>;
    spd: number;
    unitCode: string;
    unitName: string;
}

export interface BuildStats {
    hp: number;
    atk: number;
    def: number;
    spd: number;
    chc: number;
    chd: number;
    eff: number;
    efr: number;
}

export interface ProcessedBuildData {
    averageStats: BuildStats;
    topSets: string[];
    topArtifacts: string[];
    setStats: Array<{
        setName: string;
        percent: number;
        stats: BuildStats;
    }>;
    proStats?: {
        averageStats: BuildStats;
        topSets: string[];
        setStats: Array<{
            setName: string;
            percent: number;
            stats: BuildStats;
        }>;
    };
    rawBuilds?: BuildData[];
    cachedAt?: number;
}

class BuildAssistService {
    private heroData: any = null;
    private artifactData: any = null;
    private memoryCache: Map<string, string> = new Map();

    async init() {
        try {
            const allCache = await invoke<Record<string, string>>("cache_get_all");
            this.memoryCache = new Map(Object.entries(allCache));
            console.log(`[BuildAssist] Loaded ${this.memoryCache.size} items from native disk cache.`);
        } catch (e) {
            console.error("[BuildAssist] Failed to load native disk cache:", e);
            this.memoryCache = new Map();
        }

        const cacheTime = this.memoryCache.get(CACHE_KEY_TIME);

        if (cacheTime) {
            const h = this.memoryCache.get(CACHE_KEY_HERO);
            const a = this.memoryCache.get(CACHE_KEY_ARTIFACT);
            if (h && a) {
                this.heroData = JSON.parse(h);
                this.artifactData = JSON.parse(a);
                console.log("[BuildAssist] Loaded static data from cache.");
                return;
            }
        }

        console.log("[BuildAssist] Fetching static data from APIs...");
        try {
            const [heroRes, artifactRes] = await Promise.all([
                fetch(HERO_DATA_URL),
                fetch(ARTIFACT_DATA_URL)
            ]);

            this.heroData = await heroRes.json();
            this.artifactData = await artifactRes.json();

            const hStr = JSON.stringify(this.heroData);
            const aStr = JSON.stringify(this.artifactData);
            const timeStr = Date.now().toString();

            this.memoryCache.set(CACHE_KEY_HERO, hStr);
            this.memoryCache.set(CACHE_KEY_ARTIFACT, aStr);
            this.memoryCache.set(CACHE_KEY_TIME, timeStr);

            invoke("cache_set", { key: CACHE_KEY_HERO, value: hStr }).catch(console.error);
            invoke("cache_set", { key: CACHE_KEY_ARTIFACT, value: aStr }).catch(console.error);
            invoke("cache_set", { key: CACHE_KEY_TIME, value: timeStr }).catch(console.error);

            console.log("[BuildAssist] Static data fetched and cached.");
        } catch (e) {
            console.error("[BuildAssist] Error fetching static data:", e);
        }
    }

    getCacheEntries() {
        const entries: { key: string; label: string; date: Date | null; valueSize: number; originalValue: string }[] = [];
        
        for (const [key, val] of this.memoryCache.entries()) {
            // Ignore combat analysis files to prevent UI lag and memory bloat in the cache manager table
            if (key.startsWith("combat_analysis_")) continue;

            let label = key;
            let date: Date | null = null;
            let valSize = val.length;

            if (key === CACHE_KEY_HERO) {
                label = "Static Hero Database";
                const cacheTime = this.memoryCache.get(CACHE_KEY_TIME);
                if (cacheTime) date = new Date(parseInt(cacheTime));
            } else if (key === CACHE_KEY_ARTIFACT) {
                label = "Static Artifact Database";
                const cacheTime = this.memoryCache.get(CACHE_KEY_TIME);
                if (cacheTime) date = new Date(parseInt(cacheTime));
            } else if (key === CACHE_KEY_TIME) {
                label = "Global Cache Expiration Marker";
                date = new Date(parseInt(val));
            } else if (key.startsWith("buildassist_build_")) {
                const heroName = key.replace("buildassist_build_", "");
                label = `Hero Build: ${heroName}`;
                try {
                    const parsed = JSON.parse(val);
                    if (parsed.timestamp) {
                        date = new Date(parsed.timestamp);
                    }
                } catch (e) {}
            }

            entries.push({ key, label, date, valueSize: valSize, originalValue: val });
        }
        
        // Sort: global files first, then individual hero builds alphabetically
        return entries.sort((a, b) => {
            if (a.key.startsWith("buildassist_build_") && !b.key.startsWith("buildassist_build_")) return 1;
            if (!a.key.startsWith("buildassist_build_") && b.key.startsWith("buildassist_build_")) return -1;
            return a.label.localeCompare(b.label);
        });
    }

    async refetchStaticData() {
        console.log("[BuildAssist] Selectively refetching static databases...");
        const [heroRes, artifactRes] = await Promise.all([
            fetch(HERO_DATA_URL),
            fetch(ARTIFACT_DATA_URL)
        ]);

        this.heroData = await heroRes.json();
        this.artifactData = await artifactRes.json();

        const hStr = JSON.stringify(this.heroData);
        const aStr = JSON.stringify(this.artifactData);
        const timeStr = Date.now().toString();

        this.memoryCache.set(CACHE_KEY_HERO, hStr);
        this.memoryCache.set(CACHE_KEY_ARTIFACT, aStr);
        this.memoryCache.set(CACHE_KEY_TIME, timeStr);

        await invoke("cache_set", { key: CACHE_KEY_HERO, value: hStr });
        await invoke("cache_set", { key: CACHE_KEY_ARTIFACT, value: aStr });
        await invoke("cache_set", { key: CACHE_KEY_TIME, value: timeStr });
        console.log("[BuildAssist] Static databases refetched selectively.");
    }

    async refetchHeroData() {
        console.log("[BuildAssist] Selectively refetching static Hero database...");
        const res = await fetch(HERO_DATA_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.heroData = await res.json();
        const hStr = JSON.stringify(this.heroData);
        const timeStr = Date.now().toString();

        this.memoryCache.set(CACHE_KEY_HERO, hStr);
        this.memoryCache.set(CACHE_KEY_TIME, timeStr);

        await invoke("cache_set", { key: CACHE_KEY_HERO, value: hStr });
        await invoke("cache_set", { key: CACHE_KEY_TIME, value: timeStr });
        console.log("[BuildAssist] Static Hero database refetched selectively.");
    }

    async refetchArtifactData() {
        console.log("[BuildAssist] Selectively refetching static Artifact database...");
        const res = await fetch(ARTIFACT_DATA_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.artifactData = await res.json();
        const aStr = JSON.stringify(this.artifactData);
        const timeStr = Date.now().toString();

        this.memoryCache.set(CACHE_KEY_ARTIFACT, aStr);
        this.memoryCache.set(CACHE_KEY_TIME, timeStr);

        await invoke("cache_set", { key: CACHE_KEY_ARTIFACT, value: aStr });
        await invoke("cache_set", { key: CACHE_KEY_TIME, value: timeStr });
        console.log("[BuildAssist] Static Artifact database refetched selectively.");
    }

    async refetchHeroBuild(heroName: string) {
        console.log(`[BuildAssist] Selectively refetching builds for ${heroName}...`);
        
        let url = GET_BUILDS_URL;
        let method = "POST";
        let body: any = heroName;

        // Check if existing cache entry contains custom requestData
        const cached = this.memoryCache.get(`buildassist_build_${heroName}`);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.requestData) {
                    url = parsed.requestData.url || url;
                    method = parsed.requestData.method || method;
                    body = parsed.requestData.body !== undefined ? parsed.requestData.body : body;
                }
            } catch (e) {}
        }

        const res = await fetch(url, {
            method,
            body: typeof body === "string" ? body : JSON.stringify(body),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const builds = json.data;
        if (!builds || builds.length === 0) {
            throw new Error("No build data found in response.");
        }

        const processed = this.processBuilds(builds);
        this.saveBuildsToCache(heroName, processed, { url, method, body });
        console.log(`[BuildAssist] Builds for ${heroName} refetched and cached.`);
    }

    async deleteCacheEntry(key: string) {
        this.memoryCache.delete(key);
        await invoke("cache_remove", { key });
        if (key === CACHE_KEY_HERO) this.heroData = null;
        if (key === CACHE_KEY_ARTIFACT) this.artifactData = null;
    }

    getBuildsFromCache(heroName: string): ProcessedBuildData | null {
        const cached = this.memoryCache.get(`buildassist_build_${heroName}`);
        if (!cached) return null;
        try {
            const parsed = JSON.parse(cached);
            if (parsed.data) {
                parsed.data.cachedAt = parsed.timestamp;
                return parsed.data;
            }
        } catch (e) {
            console.error("[BuildAssist] Error parsing cached build data", e);
        }
        return null;
    }

    saveBuildsToCache(heroName: string, data: ProcessedBuildData, requestData?: { url: string; method: string; body: any }) {
        try {
            const timestamp = Date.now();
            data.cachedAt = timestamp; // Ensure local map data contains the fetched timestamp
            const val = JSON.stringify({
                data,
                timestamp,
                requestData: requestData || {
                    url: GET_BUILDS_URL,
                    method: "POST",
                    body: heroName
                }
            });
            this.memoryCache.set(`buildassist_build_${heroName}`, val);
            invoke("cache_set", { key: `buildassist_build_${heroName}`, value: val }).catch(console.error);
        } catch (e) {
            console.error("[BuildAssist] Error saving build data to cache", e);
        }
    }

    async getBuilds(heroName: string): Promise<ProcessedBuildData | null> {
        if (!heroName) return null;

        // First, check cache
        const cached = this.getBuildsFromCache(heroName);
        if (cached) {
            const cacheHitMsg = `Found cached build data for hero: ${heroName}`;
            console.log("[BuildAssist]", cacheHitMsg);
            invoke("log_frontend_info", { msg: cacheHitMsg }).catch(() => {});
            return cached;
        }

        try {
            const infoMsg = `Initiating API request to fetch builds for hero: ${heroName}`;
            console.log("[BuildAssist]", infoMsg);
            invoke("log_frontend_info", { msg: infoMsg }).catch(() => {});

            const response = await fetch(GET_BUILDS_URL, {
                method: "POST",
                body: heroName,
            });

            if (!response.ok) {
                const errorMsg = `Failed to fetch builds for ${heroName}: ${response.status} ${response.statusText}`;
                console.error("[BuildAssist]", errorMsg);
                invoke("log_frontend_error", { msg: errorMsg }).catch(console.error);
                return null;
            }

            const json = await response.json();
            const builds: BuildData[] = json.data;
            
            if (!builds || builds.length === 0) {
                const noDataMsg = `API request successful, but no build data found for hero: ${heroName}`;
                console.log("[BuildAssist]", noDataMsg);
                invoke("log_frontend_info", { msg: noDataMsg }).catch(() => {});
                return null;
            }

            const successMsg = `Successfully fetched ${builds.length} builds for ${heroName}. Processing data...`;
            console.log("[BuildAssist]", successMsg);
            invoke("log_frontend_info", { msg: successMsg }).catch(() => {});

            const processed = this.processBuilds(builds);
            this.saveBuildsToCache(heroName, processed);
            return processed;
        } catch (e: any) {
            const errorMsg = `Error fetching builds for ${heroName}: ${e.message || String(e)}`;
            console.error("[BuildAssist]", errorMsg);
            invoke("log_frontend_error", { msg: errorMsg }).catch(console.error);
            return null;
        }
    }

    private calculateStatsSubset(builds: BuildData[]) {
        const total = builds.length;
        const sums: BuildStats = { hp: 0, atk: 0, def: 0, spd: 0, chc: 0, chd: 0, eff: 0, efr: 0 };
        const setCounts: Record<string, number> = {};

        for (const b of builds) {
            sums.hp += b.hp || 0;
            sums.atk += b.atk || 0;
            sums.def += b.def || 0;
            sums.spd += b.spd || 0;
            sums.chc += b.chc || 0;
            sums.chd += b.chd || 0;
            sums.eff += b.eff || 0;
            sums.efr += b.efr || 0;

            const setKeys = Object.keys(b.sets || {}).sort();
            const setString = setKeys.map(k => k.replace("set_", "")).join(" / ");
            if (setString) {
                setCounts[setString] = (setCounts[setString] || 0) + 1;
            }
        }

        const averageStats = {
            hp: total ? Math.round(sums.hp / total) : 0,
            atk: total ? Math.round(sums.atk / total) : 0,
            def: total ? Math.round(sums.def / total) : 0,
            spd: total ? Math.round(sums.spd / total) : 0,
            chc: total ? Math.round(sums.chc / total) : 0,
            chd: total ? Math.round(sums.chd / total) : 0,
            eff: total ? Math.round(sums.eff / total) : 0,
            efr: total ? Math.round(sums.efr / total) : 0,
        };

        const sortedSets = Object.entries(setCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        const topSets = sortedSets.map(x => {
            const percent = Math.round((x[1] / total) * 100);
            return `${x[0]} (${percent}%)`;
        });

        const setStats = sortedSets.map(([setName, count]) => {
            const matchingBuilds = builds.filter(b => {
                const setKeys = Object.keys(b.sets || {}).sort();
                const setString = setKeys.map(k => k.replace("set_", "")).join(" / ");
                return setString === setName;
            });

            const t = matchingBuilds.length;
            const s = { hp: 0, atk: 0, def: 0, spd: 0, chc: 0, chd: 0, eff: 0, efr: 0 };
            for (const b of matchingBuilds) {
                s.hp += b.hp || 0;
                s.atk += b.atk || 0;
                s.def += b.def || 0;
                s.spd += b.spd || 0;
                s.chc += b.chc || 0;
                s.chd += b.chd || 0;
                s.eff += b.eff || 0;
                s.efr += b.efr || 0;
            }

            return {
                setName,
                percent: Math.round((count / total) * 100),
                stats: {
                    hp: t ? Math.round(s.hp / t) : 0,
                    atk: t ? Math.round(s.atk / t) : 0,
                    def: t ? Math.round(s.def / t) : 0,
                    spd: t ? Math.round(s.spd / t) : 0,
                    chc: t ? Math.round(s.chc / t) : 0,
                    chd: t ? Math.round(s.chd / t) : 0,
                    eff: t ? Math.round(s.eff / t) : 0,
                    efr: t ? Math.round(s.efr / t) : 0,
                }
            };
        });

        return { averageStats, topSets, setStats };
    }

    private processBuilds(builds: BuildData[]): ProcessedBuildData {
        const total = builds.length;
        const artifactCounts: Record<string, number> = {};

        for (const b of builds) {
            if (b.artifactCode) {
                artifactCounts[b.artifactCode] = (artifactCounts[b.artifactCode] || 0) + 1;
            }
        }

        // 1. Calculate regular average stats
        const { averageStats, topSets, setStats } = this.calculateStatsSubset(builds);

        // 2. Sort by "gs" descending and take top 10% for Pro stats
        const sortedByGs = [...builds].sort((a, b) => (b.gs || 0) - (a.gs || 0));
        const top10Count = Math.max(1, Math.round(total * 0.1));
        const proBuilds = sortedByGs.slice(0, top10Count);
        const proStats = this.calculateStatsSubset(proBuilds);

        const topArtifacts = Object.entries(artifactCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(x => {
                const code = x[0];
                const artName = this.findArtifactNameByCode(code);
                const percent = Math.round((x[1] / total) * 100);
                return `${artName || code} (${percent}%)`;
            });

        return { averageStats, topSets, topArtifacts, setStats, proStats, rawBuilds: builds };
    }

    matchHeroName(ocrName: string): string | null {
        if (!ocrName) return null;
        if (!this.heroData) {
            const h = this.memoryCache.get(CACHE_KEY_HERO);
            if (h) {
                try {
                    this.heroData = JSON.parse(h);
                } catch (e) {}
            }
        }
        if (!this.heroData) {
            console.log("[BuildAssist] Static heroData not initialized yet, skipping match.");
            return null;
        }
        const heroKeys = Object.keys(this.heroData);
        let bestName: string | null = null;
        let bestScore = 0;

        for (const key of heroKeys) {
            const score = this.getSimilarity(ocrName, key);
            if (score > bestScore) {
                bestScore = score;
                bestName = key;
            }
        }

        // We require high probability (similarity >= 0.75)
        if (bestScore >= 0.75) {
            return bestName;
        }
        return null;
    }

    private getSimilarity(s1: string, s2: string): number {
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        if (longer.length === 0) return 1.0;
        return (longer.length - this.editDistance(longer, shorter)) / longer.length;
    }

    private editDistance(s1: string, s2: string): number {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else {
                    if (j > 0) {
                        let newValue = costs[j - 1];
                        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                        }
                        costs[j - 1] = lastValue;
                        lastValue = newValue;
                    }
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }

    private findArtifactNameByCode(code: string): string | null {
        if (!this.artifactData) return null;
        for (const [name, data] of Object.entries(this.artifactData)) {
            if ((data as any).code === code) {
                return name;
            }
        }
        return null;
    }

    getHeroList(): string[] {
        if (!this.heroData) {
            const h = this.memoryCache.get(CACHE_KEY_HERO);
            if (h) {
                try {
                    this.heroData = JSON.parse(h);
                } catch (e) {}
            }
        }
        return this.heroData ? Object.keys(this.heroData).sort() : [];
    }

    getArtifactList(): string[] {
        if (!this.artifactData) {
            const a = this.memoryCache.get(CACHE_KEY_ARTIFACT);
            if (a) {
                try {
                    this.artifactData = JSON.parse(a);
                } catch (e) {}
            }
        }
        return this.artifactData ? Object.keys(this.artifactData).sort() : [];
    }

    getArtifactName(code: string): string | null {
        return this.findArtifactNameByCode(code);
    }
}

export const BuildAssist = new BuildAssistService();

