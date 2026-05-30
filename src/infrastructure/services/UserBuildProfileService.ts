/**
 * Implementation of User Build Profile Service
 */

import { invoke } from "@tauri-apps/api/core";
import { UserBuildProfile, ProcessedBuildData, BuildStats } from '../../domain/models/BuildProfile';
import { IBuildProfileService } from '../../domain/services/IBuildProfileService';

const CACHE_KEY_SAVED_BUILDS = "saved_damage_calc_builds";
const GET_BUILDS_URL = "https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/dev/getBuilds";

export class UserBuildProfileService implements IBuildProfileService {
  private profiles: UserBuildProfile[] = [];

  async init(): Promise<void> {
    const cached = await invoke<string | null>("cache_get", { key: CACHE_KEY_SAVED_BUILDS });
    this.profiles = cached ? JSON.parse(cached) : [];
  }

  async getAllProfiles(): Promise<UserBuildProfile[]> {
    return [...this.profiles];
  }

  async getProfileById(id: string): Promise<UserBuildProfile | null> {
    return this.profiles.find(p => p.id === id) || null;
  }

  async getProfilesByHero(heroName: string): Promise<UserBuildProfile[]> {
    return this.profiles.filter(p => p.heroName.toLowerCase() === heroName.toLowerCase());
  }

  async saveProfile(profile: UserBuildProfile): Promise<void> {
    const index = this.profiles.findIndex(p => p.id === profile.id);
    if (index >= 0) {
      this.profiles[index] = profile;
    } else {
      this.profiles.push(profile);
    }
    await this._persist();
  }

  async deleteProfile(id: string): Promise<void> {
    this.profiles = this.profiles.filter(p => p.id !== id);
    await this._persist();
  }

  async deleteProfiles(ids: string[]): Promise<void> {
    this.profiles = this.profiles.filter(p => !ids.includes(p.id));
    await this._persist();
  }

  private async _persist(): Promise<void> {
    await invoke("cache_set", { key: CACHE_KEY_SAVED_BUILDS, value: JSON.stringify(this.profiles) });
  }

  async getProcessedBuildData(heroName: string): Promise<ProcessedBuildData | null> {
    // Check cache first
    const cached = await invoke<string | null>("cache_get", { key: `buildassist_build_${heroName}` });
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed.data;
      } catch (e) {
        // Cache corrupted, fall through to fetch
      }
    }
    
    // Cache miss or corrupted, fetch from API
    return await this.fetchAndCacheBuilds(heroName);
  }

  async fetchAndCacheBuilds(heroName: string): Promise<ProcessedBuildData | null> {
    try {
      const response = await fetch(GET_BUILDS_URL, {
        method: "POST",
        body: heroName,
      });

      if (!response.ok) {
        console.error(`[UserBuildProfileService] Failed to fetch builds for ${heroName}: ${response.status} ${response.statusText}`);
        return null;
      }

      const json = await response.json();
      const builds: any[] = json.data || [];

      if (!builds || builds.length === 0) {
        console.log(`[UserBuildProfileService] API request successful, but no build data found for hero: ${heroName}`);
        return null;
      }

      console.log(`[UserBuildProfileService] Successfully fetched ${builds.length} builds for ${heroName}. Processing data...`);

      // Helper to calculate stats
      const calculateStats = (subset: any[]): BuildStats => {
        const stats: BuildStats = { hp: 0, atk: 0, def: 0, spd: 0, chc: 0, chd: 0, eff: 0, efr: 0 };
        subset.forEach(b => {
          stats.hp += b.hp || 0;
          stats.atk += b.atk || 0;
          stats.def += b.def || 0;
          stats.spd += b.spd || 0;
          stats.chc += b.chc || 0;
          stats.chd += b.chd || 0;
          stats.eff += b.eff || 0;
          stats.efr += b.efr || 0;
        });
        (Object.keys(stats) as Array<keyof BuildStats>).forEach(k => stats[k] = Math.round(stats[k] / subset.length));
        return stats;
      };

      // Helper for top sets
      const calculateTopSets = (subset: any[]) => {
        const setMap = new Map<string, number>();
        subset.forEach(b => {
          if (b.sets) {
            const setKeys = Object.keys(b.sets || {}).sort();
            const setString = setKeys.map(k => k.replace("set_", "")).join(" / ");
            if (setString) {
              setMap.set(setString, (setMap.get(setString) || 0) + 1);
            }
          }
        });
        const topSets = [...setMap.entries()].sort((a: [string, number], b: [string, number]) => b[1]-a[1]).slice(0, 3);
        return topSets.map(([setName, count]) => ({
            setName,
            percent: Math.round((count / subset.length) * 100),
            stats: calculateStats(subset.filter(b => {
              const setKeys = Object.keys(b.sets || {}).sort();
              const setString = setKeys.map(k => k.replace("set_", "")).join(" / ");
              return setString === setName;
            }))
        }));
      };

      // 1. All builds
      const averageStats = calculateStats(builds);
      const setStats = calculateTopSets(builds);

      // 2. Top 10% Pro builds (matching legacy BuildAssist behavior)
      const sortedByGs = [...builds].sort((a: any,b: any) => (b.gs || 0) - (a.gs || 0));
      const top10PercentCount = Math.max(1, Math.round(builds.length * 0.1));
      const proBuilds = sortedByGs.slice(0, top10PercentCount);
      
      const proStats = {
          averageStats: calculateStats(proBuilds),
          setStats: calculateTopSets(proBuilds),
          topSets: calculateTopSets(proBuilds).map(s => s.setName)
      };

      const processedData: ProcessedBuildData = {
        averageStats,
        setStats,
        topSets: setStats.map(s => s.setName),
        topArtifacts: [...builds.reduce((acc, b) => acc.set(b.artifactCode, (acc.get(b.artifactCode) || 0) + 1), new Map<string, number>()).entries()]
            .sort((a: [string, number], b: [string, number]) => b[1]-a[1]).slice(0,3).map((e: [string, number]) => e[0]),
        proStats,
        rawBuilds: builds,
        cachedAt: Date.now(),
      };

      // Cache with timestamp and requestData (matching legacy format)
      const cacheValue = JSON.stringify({
        data: processedData,
        timestamp: Date.now(),
        requestData: {
          url: GET_BUILDS_URL,
          method: "POST",
          body: heroName
        }
      });

      await invoke("cache_set", { key: `buildassist_build_${heroName}`, value: cacheValue });
      return processedData;
    } catch (e) {
      console.error(`[UserBuildProfileService] Error fetching builds for ${heroName}:`, e);
      return null;
    }
  }

  async clearCache(): Promise<void> {
    this.profiles = [];
    await invoke("cache_remove", { key: CACHE_KEY_SAVED_BUILDS });
  }
}
