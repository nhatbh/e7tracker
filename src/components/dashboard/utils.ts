/**
 * Utility functions for Dashboard Analytics components
 */

/**
 * Filter matchups by minimum count threshold with fallback logic
 * @param list Array of matchup objects with count and win_rate properties
 * @returns Filtered and sorted array of legitimate matchups
 */
export const getLegitMatchups = (list: any[]) => {
    if (!list) return [];
    const minCount = 10;
    let filtered = list.filter(item => item.count >= minCount);
    if (filtered.length === 0) {
        filtered = list.filter(item => item.count >= 5);
    }
    if (filtered.length === 0) {
        filtered = list.filter(item => item.count >= 2);
    }
    return filtered.sort((a, b) => b.win_rate - a.win_rate);
};

/**
 * Calculate hero tier based on power score
 * @param score Power score calculated from win rate, pick rate, and ban rate
 * @returns Object with tier string and corresponding color hex code
 */
export const calculateTier = (score: number): { tier: string; color: string } => {
    if (score > 150) return { tier: 'OP', color: '#ff007f' };
    if (score >= 80) return { tier: 'S', color: '#ffae00' };
    if (score >= 30) return { tier: 'A', color: '#10b981' };
    if (score >= 0) return { tier: 'B', color: '#38bdf8' };
    return { tier: 'C', color: '#94a3b8' };
};

/**
 * Calculate draft tags based on hero combat analysis and metagame data
 * @param combatAnalysis Hero combat analysis data
 * @param metagameHero Hero metagame data
 * @param t Translation function
 * @returns Object with tags array and isSpecialistCapped flag
 */
export const getDraftTags = (
    combatAnalysis: any,
    metagameHero: any,
    t: any
): { tags: Array<{ name: string; vibe: string; desc: string; color: string; bg: string }>; isSpecialistCapped: boolean } => {
    const tags: Array<{ name: string; vibe: string; desc: string; color: string; bg: string }> = [];
    if (!combatAnalysis && !metagameHero) {
        return { tags, isSpecialistCapped: false };
    }

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
                    : (pr * 0.6))
            : 0);

    const pbrTotal = metagameHero?.pick_ban_rate !== undefined
        ? metagameHero.pick_ban_rate
        : (pr + br);

    const isSpecialistCapped = pr < 3;
    const prebanRate = Math.max(0, pbrTotal - pr);
    const totalPicks = combatAnalysis?.total_appearances || 1;

    const slot1Count = combatAnalysis?.draft_position?.["1"]?.count || 0;
    const slot2Count = combatAnalysis?.draft_position?.["2"]?.count || 0;
    const slot3Count = combatAnalysis?.draft_position?.["3"]?.count || 0;
    const slot4Count = combatAnalysis?.draft_position?.["4"]?.count || 0;
    const slot5Count = combatAnalysis?.draft_position?.["5"]?.count || 0;

    const slot1Ratio = totalPicks > 0 ? (slot1Count / totalPicks) * 100 : 0;
    const slot2Ratio = totalPicks > 0 ? (slot2Count / totalPicks) * 100 : 0;
    const slot3Ratio = totalPicks > 0 ? (slot3Count / totalPicks) * 100 : 0;

    const slot1WR = combatAnalysis?.draft_position?.["1"]?.win_rate || 0;
    const slot2WR = combatAnalysis?.draft_position?.["2"]?.win_rate || 0;
    const slot3WR = combatAnalysis?.draft_position?.["3"]?.win_rate || 0;
    const slot4WR = combatAnalysis?.draft_position?.["4"]?.win_rate || 0;
    const slot5WR = combatAnalysis?.draft_position?.["5"]?.win_rate || 0;

    const slot45Count = slot4Count + slot5Count;
    const wrS45 = slot45Count > 0
        ? ((slot4WR * slot4Count) + (slot5WR * slot5Count)) / slot45Count
        : 0;

    const prS12 = totalPicks > 0 ? ((slot1Count + slot2Count) / totalPicks) * 100 : 0;
    const prS45 = totalPicks > 0 ? ((slot4Count + slot5Count) / totalPicks) * 100 : 0;
    const presence = pbrTotal;

    // 1. Highly Contested (Meta Apex Predator)
    if ((slot1Ratio >= 50 && prebanRate > 15) || prebanRate > 40) {
        tags.push({
            name: t("tags.highlyContested.name"),
            vibe: t("tags.highlyContested.vibe"),
            desc: t("tags.highlyContested.desc"),
            color: "#ff007f",
            bg: "rgba(255, 0, 127, 0.08)"
        });
    }
    // 2. Snowballer (Slot 1 Dictator)
    if (slot1Ratio >= 30 && slot1WR >= 52 && wrS45 < 49) {
        tags.push({
            name: t("tags.snowballer.name"),
            vibe: t("tags.snowballer.vibe"),
            desc: t("tags.snowballer.desc"),
            color: "#a855f7",
            bg: "rgba(168, 85, 247, 0.08)"
        });
    }
    // 3. The Wingman (Solid Early Foundation)
    if (prS12 >= 65 && slot2WR >= 50.5) {
        tags.push({
            name: t("tags.wingman.name"),
            vibe: t("tags.wingman.vibe"),
            desc: t("tags.wingman.desc"),
            color: "#3b82f6",
            bg: "rgba(59, 130, 246, 0.08)"
        });
    }
    // 4. Draft Trap (Overvalued First Pick)
    if (slot1Ratio >= 40 && slot1WR < 48 && slot1WR < wr) {
        tags.push({
            name: t("tags.draftTrap.name"),
            vibe: t("tags.draftTrap.vibe"),
            desc: t("tags.draftTrap.desc"),
            color: "#ef4444",
            bg: "rgba(239, 68, 68, 0.08)"
        });
    }
    // 5. Noob Trap (Popular but Weak) - Relaxed PR threshold to catch more traps
    if (pr >= 8 && prebanRate < 5 && wr < 47) {
        tags.push({
            name: t("tags.noobTrap.name"),
            vibe: t("tags.noobTrap.vibe"),
            desc: t("tags.noobTrap.desc"),
            color: "#f43f5e",
            bg: "rgba(244, 63, 94, 0.08)"
        });
    }
    // 6. Core Pick (Safe Win Condition)
    if (slot3Ratio >= 50 && (br - prebanRate) < 10 && slot3WR >= 51) {
        tags.push({
            name: t("tags.corePick.name"),
            vibe: t("tags.corePick.vibe"),
            desc: t("tags.corePick.desc"),
            color: "#10b981",
            bg: "rgba(16, 185, 129, 0.08)"
        });
    }
    // 7. Troll Pick (Guaranteed Draft Loss) - Removed presence constraint to punish strictly by WR
    if (slot3Ratio >= 60 && slot3WR < 45) {
        tags.push({
            name: t("tags.trollPick.name"),
            vibe: t("tags.trollPick.vibe"),
            desc: t("tags.trollPick.desc"),
            color: "#e2e8f0",
            bg: "rgba(226, 232, 240, 0.08)"
        });
    }
    // 8. Clutcher (Late Draft Terror)
    if (prS45 >= 45 && (br - prebanRate) >= 20 && wrS45 >= 53) {
        tags.push({
            name: t("tags.clutcher.name"),
            vibe: t("tags.clutcher.vibe"),
            desc: t("tags.clutcher.desc"),
            color: "#ff00e5",
            bg: "rgba(255, 0, 229, 0.08)"
        });
    }
    // 9. Pocket Pick (Niche Secret Weapon) - Added hard win rate floor
    if (prS45 >= 60 && pr < 5 && wrS45 > wr && wrS45 >= 50) {
        tags.push({
            name: t("tags.pocketPick.name"),
            vibe: t("tags.pocketPick.vibe"),
            desc: t("tags.pocketPick.desc"),
            color: "#ffae00",
            bg: "rgba(255, 174, 0, 0.08)"
        });
    }
    // 10. Failed Counter (Backfiring Reaction)
    if (prS45 >= 40 && wrS45 < 48 && wrS45 < wr) {
        tags.push({
            name: t("tags.failedCounter.name"),
            vibe: t("tags.failedCounter.vibe"),
            desc: t("tags.failedCounter.desc"),
            color: "#f97316",
            bg: "rgba(249, 115, 22, 0.08)"
        });
    }
    // 11. The Decoy (Irrational Fear Ban)
    if (presence >= 25 && wr <= 48.5) {
        tags.push({
            name: t("tags.decoy.name"),
            vibe: t("tags.decoy.vibe"),
            desc: t("tags.decoy.desc"),
            color: "#f43f5e",
            bg: "rgba(244, 63, 94, 0.08)"
        });
    }
    // 12. Hidden Gem (Forgotten but Broken)
    if (presence < 8 && pr >= 1.5 && wr >= 54.5) {
        tags.push({
            name: t("tags.hiddenGem.name"),
            vibe: t("tags.hiddenGem.vibe"),
            desc: t("tags.hiddenGem.desc"),
            color: "#00e5ff",
            bg: "rgba(0, 229, 255, 0.08)"
        });
    }
    // 13. Flex Pick (Unpredictable Safe Choice)
    if (pr >= 10 && slot1Ratio >= 15 && slot1Ratio <= 45 && slot2Ratio >= 15 && slot2Ratio <= 45 && slot3Ratio >= 15 && slot3Ratio <= 45 && wr >= 49) {
        tags.push({
            name: t("tags.flexPick.name"),
            vibe: t("tags.flexPick.vibe"),
            desc: t("tags.flexPick.desc"),
            color: "#38bdf8",
            bg: "rgba(56, 189, 248, 0.08)"
        });
    }
    // 14. Dead Meta (Statistically Useless) - Relaxed presence constraint to catch more useless heroes
    if (presence < 10 && (br - prebanRate) < 2 && wr < 47) {
        tags.push({
            name: t("tags.deadMeta.name"),
            vibe: t("tags.deadMeta.vibe"),
            desc: t("tags.deadMeta.desc"),
            color: "#64748b",
            bg: "rgba(100, 116, 139, 0.08)"
        });
    }

    // 15. The Safety Net: Catch any remaining underperforming heroes that dodged all traps
    if (tags.length === 0 && wr < 48) {
        tags.push({
            name: t("tags.underperforming.name"),
            vibe: t("tags.underperforming.vibe"),
            desc: t("tags.underperforming.desc"),
            color: "#9ca3af",
            bg: "rgba(156, 163, 175, 0.08)"
        });
    }

    // 16. Fallback Default (Only if no other tags applied and WR is healthy)
    if (tags.length === 0) {
        tags.push({
            name: t("tags.standardDraft.name"),
            vibe: t("tags.standardDraft.vibe"),
            desc: t("tags.standardDraft.desc"),
            color: "#94a3b8",
            bg: "rgba(148, 163, 184, 0.08)"
        });
    }

    return { tags, isSpecialistCapped };
};

