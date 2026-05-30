import { invoke } from "@tauri-apps/api/core";
import { emit, listen, UnlistenFn } from "@tauri-apps/api/event";
import { ITierListService } from '../../domain/services/ITierListService';
import { TierListHeroData, TierListHeroTag } from '../../domain/models/TierList';
import { ICombatAnalyticsService, IMetagameService } from '../../domain/services';
import { calculateTier, getDraftTags } from '../../components/dashboard/utils';

const CACHE_KEY_TIERLIST = "tierlist_preprocessed_data";

export class TierListService implements ITierListService {
    private combatService: ICombatAnalyticsService;
    private metagameService: IMetagameService;
    private listeners: Set<() => void> = new Set();
    private tauriListeners: UnlistenFn[] = [];

    constructor(combatService: ICombatAnalyticsService, metagameService: IMetagameService) {
        this.combatService = combatService;
        this.metagameService = metagameService;

        // Initialize listeners to auto-recalculate when BOTH metagame and combat data fetches complete
        this.setupFetchProgressListeners();
    }

    private setupFetchProgressListeners() {
        // Track completed states of both fetches in this session
        let combatCompleted = false;
        let metagameCompleted = false;

        // Listen for combat progress events
        listen("fetch-progress", (event: any) => {
            const { type, isFetching } = event.payload;
            if (type === "combat-analytics" && !isFetching) {
                combatCompleted = true;
                this.checkAndRecalculate(combatCompleted, metagameCompleted);
            } else if (type === "metagame" && !isFetching) {
                metagameCompleted = true;
                this.checkAndRecalculate(combatCompleted, metagameCompleted);
            }
        }).then(unlisten => this.tauriListeners.push(unlisten));
    }

    private checkAndRecalculate(combatCompleted: boolean, metagameCompleted: boolean) {
        // If both have completed in this session, trigger dynamic recalculation
        if (combatCompleted && metagameCompleted) {
            this.recalculateTierList().catch(console.error);
        }
    }

    async getTierListData(): Promise<TierListHeroData[]> {
        try {
            const cached = await invoke<string | null>("cache_get", { key: CACHE_KEY_TIERLIST });
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            console.error("[TierListService] Error fetching cached tierlist:", e);
        }

        // Fallback: If cache is empty, calculate on the fly
        await this.recalculateTierList();
        const freshCached = await invoke<string | null>("cache_get", { key: CACHE_KEY_TIERLIST });
        return freshCached ? JSON.parse(freshCached) : [];
    }

    async recalculateTierList(): Promise<void> {
        let meta = this.metagameService.getMetadata();
        let combatMeta = this.combatService.getMetadata();

        // If metadata is not yet loaded, wait and retry (services load from cache asynchronously)
        if (!meta || !combatMeta) {
            let attempts = 0;
            while ((!meta || !combatMeta) && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 500));
                meta = this.metagameService.getMetadata();
                combatMeta = this.combatService.getMetadata();
                attempts++;
            }
            if (!meta || !combatMeta) {
                console.warn("[TierListService] Cannot recalculate tierlist. Missing metadata after retries.");
                return;
            }
        }

        console.log("[TierListService] Starting tier list preprocessing & caching...");

        const allHeroes = meta.hero_list;
        const computed: TierListHeroData[] = [];

        // Simple translation fallback for background calculations
        const mockT = (key: string, defaultVal?: string) => defaultVal || key;

        // Calculate stats for each hero
        for (const h of allHeroes) {
            const [combatAnalysis, metagameHero] = await Promise.all([
                this.combatService.getHeroAnalysis(h.hero_name),
                this.metagameService.getHeroMetagame(h.hero_name)
            ]);

            if (!combatAnalysis && !metagameHero) continue;

            const wr = metagameHero?.win_rate !== undefined
                ? metagameHero.win_rate
                : (combatAnalysis?.win_rate || 0);

            const pr = metagameHero?.pick_rate !== undefined
                ? metagameHero.pick_rate
                : (combatAnalysis ? (combatAnalysis.total_appearances / (combatAnalysis.total_matches || 1)) * 100 : 0);

            const br = metagameHero?.ban_rate !== undefined
                ? metagameHero.ban_rate
                : (combatAnalysis
                    ? ((combatAnalysis as any).ban_rate !== undefined
                        ? (combatAnalysis as any).ban_rate
                        : (combatAnalysis as any).ban_count !== undefined
                            ? ((combatAnalysis as any).ban_count / (combatAnalysis.total_matches || 1)) * 100
                            : 0)
                    : 0);

            const pbrTotal = metagameHero?.pick_ban_rate !== undefined
                ? metagameHero.pick_ban_rate
                : pr;

            const totalPicks = combatAnalysis?.total_appearances || 1;
            const slot1Count = combatAnalysis?.draft_position?.["1"]?.count || 0;
            const slot2Count = combatAnalysis?.draft_position?.["2"]?.count || 0;
            const slot3Count = combatAnalysis?.draft_position?.["3"]?.count || 0;
            const slot4Count = combatAnalysis?.draft_position?.["4"]?.count || 0;
            const slot5Count = combatAnalysis?.draft_position?.["5"]?.count || 0;

            const slot1WR = combatAnalysis?.draft_position?.["1"]?.win_rate || 0;
            const slot2WR = combatAnalysis?.draft_position?.["2"]?.win_rate || 0;
            const slot3WR = combatAnalysis?.draft_position?.["3"]?.win_rate || 0;
            const slot4WR = combatAnalysis?.draft_position?.["4"]?.win_rate || 0;
            const slot5WR = combatAnalysis?.draft_position?.["5"]?.win_rate || 0;

            const slot1Ratio = totalPicks > 0 ? (slot1Count / totalPicks) * 100 : 0;
            const slot2Ratio = totalPicks > 0 ? (slot2Count / totalPicks) * 100 : 0;
            const slot3Ratio = totalPicks > 0 ? (slot3Count / totalPicks) * 100 : 0;
            const slot45Ratio = totalPicks > 0 ? ((slot4Count + slot5Count) / totalPicks) * 100 : 0;

            const slot45Count = slot4Count + slot5Count;
            const wrS45 = slot45Count > 0
                ? ((slot4WR * slot4Count) + (slot5WR * slot5Count)) / slot45Count
                : 0;

            const prS12 = totalPicks > 0 ? ((slot1Count + slot2Count) / totalPicks) * 100 : 0;

            // Calculate Win Rate Points with a "Confidence Multiplier"
            // If a hero is played in less than 3% of matches, their win rate is unreliable.
            // We scale down their WR points based on how close they are to the 3% healthy threshold.
            let wrPoints = (wr - 50) * 10;
            if (pr < 3.0) {
                wrPoints = wrPoints * (pr / 3.0);
            }

            // Calculate Final Score
            const score = wrPoints + pbrTotal + (br * 0.5);
            let { tier, color } = calculateTier(score);

            // Extreme Specialist Fallback (Optional safety net for absolute zero presence)
            if (pr < 0.1 && pbrTotal < 0.5) {
                tier = 'C';
                color = '#94a3b8';
            }

            // Generate tags using the same logic as getDraftTags, but store translation keys
            // Create a custom t function that returns the key itself (for later translation in UI)
            const keyStoringT = (key: string, defaultVal?: string) => key;
            const { tags } = getDraftTags(combatAnalysis, metagameHero, keyStoringT);
            
            // Now convert the tags to include both the key and the translated name for storage
            const tagsWithKeys: TierListHeroTag[] = tags.map(tag => ({
                name: tag.name,
                nameKey: tag.name,
                vibe: tag.vibe,
                vibeKey: tag.vibe,
                desc: tag.desc,
                descKey: tag.desc,
                color: tag.color,
                bg: tag.bg
            }));

            computed.push({
                heroName: h.hero_name,
                heroCode: combatAnalysis?.hero_code || h.hero,
                tier: tier as any,
                tierColor: color,
                score,
                winRate: wr,
                pickRate: pr,
                banRate: br,
                pickBanRate: pbrTotal,
                prebanRate: pbrTotal - pr,
                tags: tagsWithKeys,
                slot1Ratio,
                slot2Ratio,
                slot3Ratio,
                slot45Ratio
            });
        }

        // Cache preprocessed list to Tauri SQLite Cache
        await invoke("cache_set", { key: CACHE_KEY_TIERLIST, value: JSON.stringify(computed) });
        console.log(`[TierListService] Preprocessing finished. Cached ${computed.length} heroes.`);

        // Notify listeners
        this.listeners.forEach(cb => cb());
        emit("tier-list-updated", {}).catch(() => {});
    }

    onTierListUpdated(callback: () => void): void {
        this.listeners.add(callback);
    }

    destroy() {
        this.tauriListeners.forEach(unlisten => unlisten());
    }
}
