import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip as ChartTooltip, Legend } from 'recharts';
import { HeroAnalysis, CombatCounter, CombatMatchup, CombatPreban, CombatPilotBan, CombatBestPair, CombatPositionPick, CombatPrebanPair, CombatOppWinningPosition } from '../services/combatData';
import { HeroMiniPortrait } from './HeroMiniPortrait';

interface DashboardCombatDetailsProps {
    localCombatAnalysis: HeroAnalysis | null;
    heroName: string;
}

export const DashboardCombatDetails: React.FC<DashboardCombatDetailsProps> = React.memo(({
    localCombatAnalysis,
    heroName
}) => {
    const { t } = useTranslation();

    // Toggles and Interactive states
    const [selectedSlotPos, setSelectedSlotPos] = useState<string>("1");
    const [duoPickType, setDuoPickType] = useState<'fp' | 'sp'>('fp');
    const [matchupPickType, setMatchupPickType] = useState<'fp' | 'sp'>('fp');
    const [matchupSearchQuery, setMatchupSearchQuery] = useState<string>("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");
    const [counterViewType, setCounterViewType] = useState<'strong' | 'weak'>('strong');

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(matchupSearchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [matchupSearchQuery]);

    // 1. FP vs SP Advantage Recharts Data
    const pickAdvantageChartData = useMemo(() => {
        if (!localCombatAnalysis) return [];
        const fp = localCombatAnalysis.first_pick ?? { games: 0, wins: 0, win_rate: 0 };
        const sp = localCombatAnalysis.second_pick ?? { games: 0, wins: 0, win_rate: 0 };
        const fpWinRate = typeof fp?.win_rate === 'number' ? fp.win_rate : 0;
        const spWinRate = typeof sp?.win_rate === 'number' ? sp.win_rate : 0;
        return [
            {
                name: t('combat.fpLabel', 'First Pick'),
                [t('combat.winRate', 'Win Rate')]: Number(fpWinRate.toFixed(1)),
                [t('combat.gamesLabel', 'Games')]: fp?.games ?? 0,
            },
            {
                name: t('combat.spLabel', 'Second Pick'),
                [t('combat.winRate', 'Win Rate')]: Number(spWinRate.toFixed(1)),
                [t('combat.gamesLabel', 'Games')]: sp?.games ?? 0,
            }
        ];
    }, [localCombatAnalysis, t]);

    // 2. Position Picks (FP vs SP) for Selected Position
    const positionPicksFP = useMemo(() => {
        if (!localCombatAnalysis || !localCombatAnalysis.position_picks_fp) return [];
        return localCombatAnalysis.position_picks_fp[selectedSlotPos] || [];
    }, [localCombatAnalysis, selectedSlotPos]);

    const positionPicksSP = useMemo(() => {
        if (!localCombatAnalysis || !localCombatAnalysis.position_picks_sp) return [];
        return localCombatAnalysis.position_picks_sp[selectedSlotPos] || [];
    }, [localCombatAnalysis, selectedSlotPos]);

    // 3. Best Duo Partners FP vs SP
    const currentDuos = useMemo(() => {
        if (!localCombatAnalysis) return [];
        const duos = duoPickType === 'fp'
            ? localCombatAnalysis.best_pairs_fp
            : localCombatAnalysis.best_pairs_sp;
        return (duos || []).slice(0, 10);
    }, [localCombatAnalysis, duoPickType]);

    // 4. Filtered Matchups FP vs SP
    const currentMatchups = useMemo(() => {
        if (!localCombatAnalysis) return [];
        const raw = matchupPickType === 'fp'
            ? localCombatAnalysis.matchups_fp
            : localCombatAnalysis.matchups_sp;
        if (!Array.isArray(raw)) return [];

        return raw.filter(item => {
            const name = item?.hero_name ?? item?.hero ?? '';
            return typeof name === 'string' && name.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
        });
    }, [localCombatAnalysis, matchupPickType, debouncedSearchQuery]);

    // 5. Counters Breakdown (Strong vs Weak)
    const currentCounters = useMemo(() => {
        if (!localCombatAnalysis) return [];
        const raw = counterViewType === 'strong'
            ? localCombatAnalysis.counters_strong
            : localCombatAnalysis.counters_weak;
        return (raw || []).slice(0, 8);
    }, [localCombatAnalysis, counterViewType]);

    // 6. Preban Pairs (Dual Pre-bans)
    const prebanPairs = useMemo(() => {
        if (!localCombatAnalysis || !localCombatAnalysis.preban_pairs) return [];
        return localCombatAnalysis.preban_pairs.slice(0, 6);
    }, [localCombatAnalysis]);

    // 7. Opponent Winning Positions Deep Grid
    const oppWinningSlots = useMemo(() => {
        if (!localCombatAnalysis || !localCombatAnalysis.opp_winning_positions) return [];
        return ["1", "2", "3", "4", "5"].map(pos => {
            const list = localCombatAnalysis.opp_winning_positions[pos] || [];
            return {
                pos,
                list: list.slice(0, 4)
            };
        });
    }, [localCombatAnalysis]);

    if (!localCombatAnalysis) {
        return (
            <div className="dashboard-card empty-combat-details">
                <h3>{t('combat.noCombatDetailsTitle', 'Detailed Combat Data Unavailable')}</h3>
                <p>{t('combat.noCombatDetailsDesc', 'Make sure combat data is cached or loaded for this hero.')}</p>
            </div>
        );
    }

    const firstPickStats = localCombatAnalysis?.first_pick ?? { games: 0, wins: 0, win_rate: 0 };
    const secondPickStats = localCombatAnalysis?.second_pick ?? { games: 0, wins: 0, win_rate: 0 };

    return (
        <div className="advanced-combat-dashboard">

            {/* ── TIER 1: ADVANTAGE BENCHMARKS & DRAFT SLOTS CHOICE ── */}
            <div className="combat-row-two-columns">
                {/* Advantage Benchmark Card */}
                <div className="dashboard-card combat-sub-card first-sp-advantage-card">
                    <h4 className="strategy-card-title">{t('combat.draftSideAdvantage', 'Side Pick Advantage')}</h4>
                    <div className="pick-advantage-summary-flex">
                        <div className="pick-advantage-stat-block">
                            <span className="side-lbl first-pick-glow">{t('combat.firstPickShort', 'First Pick')}</span>
                            <span className="side-val">{(firstPickStats?.win_rate ?? 0).toFixed(1)}% {t('combat.wr', 'WR')}</span>
                            <span className="side-sub-lbl">{firstPickStats?.wins ?? 0} W / {firstPickStats?.games ?? 0} G</span>
                        </div>
                        <div className="pick-advantage-chart-wrapper">
                            <ResponsiveContainer width="100%" height={100} debounce={200}>
                                <BarChart data={pickAdvantageChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                    <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 8 }} />
                                    <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 8 }} />
                                    <Bar dataKey={t('combat.winRate', 'Win Rate')} fill="#38bdf8" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="pick-advantage-stat-block text-right">
                            <span className="side-lbl second-pick-glow">{t('combat.secondPickShort', 'Second Pick')}</span>
                            <span className="side-val">{(secondPickStats?.win_rate ?? 0).toFixed(1)}% {t('combat.wr', 'WR')}</span>
                            <span className="side-sub-lbl">{secondPickStats?.wins ?? 0} W / {secondPickStats?.games ?? 0} G</span>
                        </div>
                    </div>
                </div>

                {/* Positional Selections FP vs SP */}
                <div className="dashboard-card combat-sub-card position-selections-card">
                    <div className="card-header-flex">
                        <h4 className="strategy-card-title">{t('combat.posSelectionsTitle', 'Slot Pick Preferences')}</h4>
                        <div className="slot-pill-selector">
                            {["1", "2", "3", "4", "5"].map(pos => (
                                <button
                                    key={pos}
                                    className={`slot-pill ${selectedSlotPos === pos ? 'active' : ''}`}
                                    onClick={() => setSelectedSlotPos(pos)}
                                >
                                    S{pos}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pos-choices-grid-split">
                        <div className="pos-column-choices">
                            <span className="choices-heading first-pick-glow">{t('combat.fpChoices', 'Top FP Drafts')}</span>
                            <div className="choices-mini-list">
                                {positionPicksFP.length > 0 ? (
                                    positionPicksFP.slice(0, 4).map((p, idx) => (
                                        <div key={idx} className="choice-row">
                                            <HeroMiniPortrait heroName={p.hero_name || p.hero} size={18} className="choice-avatar" />
                                            <span className="choice-name truncate">{p.hero_name || p.hero}</span>
                                            <div className="choice-stats">
                                                <span className="choice-games">{p.count} g</span>
                                                <span className="choice-wr" style={{ color: p.win_rate >= 50 ? '#10b981' : '#38bdf8' }}>
                                                    {p.win_rate.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="choices-empty-state">{t('combat.noRecords', 'No records')}</div>
                                )}
                            </div>
                        </div>

                        <div className="pos-column-choices border-left-choices">
                            <span className="choices-heading second-pick-glow">{t('combat.spChoices', 'Top SP Drafts')}</span>
                            <div className="choices-mini-list">
                                {positionPicksSP.length > 0 ? (
                                    positionPicksSP.slice(0, 4).map((p, idx) => (
                                        <div key={idx} className="choice-row">
                                            <HeroMiniPortrait heroName={p.hero_name || p.hero} size={18} className="choice-avatar" />
                                            <span className="choice-name truncate">{p.hero_name || p.hero}</span>
                                            <div className="choice-stats">
                                                <span className="choice-games">{p.count} g</span>
                                                <span className="choice-wr" style={{ color: p.win_rate >= 50 ? '#10b981' : '#38bdf8' }}>
                                                    {p.win_rate.toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="choices-empty-state">{t('combat.noRecords', 'No records')}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── TIER 2: ADVANCED DUOS & BANNING PATTERNS ── */}
            <div className="combat-row-two-columns">
                {/* Advanced Duos Column */}
                <div className="dashboard-card combat-sub-card best-pairs-large-card">
                    <div className="card-header-flex">
                        <h4 className="strategy-card-title">{t('combat.bestDuosTitle', 'Best Synergy Partners')}</h4>
                        <div className="segmented-selector">
                            <button
                                className={`segmented-btn ${duoPickType === 'fp' ? 'active' : ''}`}
                                onClick={() => setDuoPickType('fp')}
                            >
                                {t('combat.firstPickShort', 'First Pick')}
                            </button>
                            <button
                                className={`segmented-btn ${duoPickType === 'sp' ? 'active' : ''}`}
                                onClick={() => setDuoPickType('sp')}
                            >
                                {t('combat.secondPickShort', 'Second Pick')}
                            </button>
                        </div>
                    </div>

                    <div className="duo-large-list">
                        {currentDuos.length > 0 ? (
                            <table className="duo-table-high-density">
                                <thead>
                                    <tr>
                                        <th>{t('combat.hero', 'Hero')}</th>
                                        <th className="text-right">{t('combat.matches', 'Matches')}</th>
                                        <th className="text-right">{t('combat.winRate', 'Win Rate')}</th>
                                        <th className="text-right slot-distribution-header">{t('combat.slotDist', 'Slot Win Rate (S1-S5)')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentDuos.map((duo, idx) => (
                                        <tr key={idx}>
                                            <td className="duo-hero-cell">
                                                <HeroMiniPortrait heroName={duo?.hero_name ?? duo?.hero ?? ''} size={18} className="duo-avatar" />
                                                <span className="duo-name truncate">{duo?.hero_name ?? duo?.hero ?? 'Unknown'}</span>
                                            </td>
                                            <td className="text-right text-muted">{duo?.count ?? 0} g</td>
                                            <td className="text-right font-bold text-cyan">{(duo?.win_rate ?? 0).toFixed(1)}%</td>
                                            <td className="text-right">
                                                <div className="mini-distribution-bar-flex">
                                                    {["1", "2", "3", "4", "5"].map(slot => {
                                                        const slotData = duo?.by_position?.[slot];
                                                        const wr = typeof slotData?.win_rate === 'number' ? slotData.win_rate : 0;
                                                        const hasGames = slotData && typeof slotData.count === 'number' && slotData.count > 0;
                                                        return (
                                                            <div
                                                                key={slot}
                                                                className={`mini-slot-badge ${hasGames ? 'active' : 'empty'}`}
                                                                title={hasGames ? `S${slot}: ${wr.toFixed(0)}% WR (${slotData?.count ?? 0} games)` : `S${slot}: No games`}
                                                                style={hasGames ? { background: wr >= 53 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(56, 189, 248, 0.15)', borderColor: wr >= 53 ? '#10b981' : '#38bdf8' } : {}}
                                                            >
                                                                {slot}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="strategy-empty-state">{t('combat.noSynergiesRecords', 'No synergy records loaded')}</div>
                        )}
                    </div>
                </div>

                {/* Banning Patterns Deep-Dive */}
                <div className="dashboard-card combat-sub-card banning-patterns-card">
                    <h4 className="strategy-card-title">{t('combat.banPatternsTitle', 'Advanced Banning & Ban Pairs')}</h4>

                    {/* Preban Pairs */}
                    <div className="preban-pairs-section">
                        <span className="banning-sub-title">{t('combat.prebanPairsTitle', 'Top Pre-ban Couples (Banned Together)')}</span>
                        <div className="preban-pairs-list">
                            {prebanPairs.length > 0 ? (
                                prebanPairs.map((pair, idx) => (
                                    <div key={idx} className="preban-pair-row">
                                        <div className="avatars-joined">
                                            {Array.isArray(pair?.hero_names) && pair.hero_names.slice(0, 2).map((name, hIdx) => (
                                                <div key={hIdx} className="mini-avatar-overlap" title={name}>
                                                    <HeroMiniPortrait heroName={name} size={18} className="overlap-img" />
                                                </div>
                                            ))}
                                        </div>
                                        <span className="joined-names truncate">{Array.isArray(pair?.hero_names) ? pair.hero_names.join(' + ') : 'Unknown'}</span>
                                        <div className="joined-stats">
                                            <span className="joined-count">{pair?.count ?? 0} g</span>
                                            <span className="joined-wr" style={{ color: (pair?.win_rate ?? 0) >= 50 ? '#10b981' : '#38bdf8' }}>{(pair?.win_rate ?? 0).toFixed(0)}% WR</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="strategy-empty-state mini">{t('combat.noPrebanPairs', 'No pre-ban pairs recorded')}</div>
                            )}
                        </div>
                    </div>

                    {/* Extended Preban Lists */}
                    <div className="ban-grids-extended">
                        <div className="ban-col-extended">
                            <span className="banning-sub-title">{t('combat.topSelfPrebans', 'My Top Pre-bans')}</span>
                            <div className="extended-ban-list">
                                {Array.isArray(localCombatAnalysis?.my_prebans) && localCombatAnalysis.my_prebans.length > 0 ? (
                                    localCombatAnalysis.my_prebans.slice(0, 5).map((b, idx) => (
                                        <div key={idx} className="condensed-ban-line">
                                            <HeroMiniPortrait heroName={b.hero_name || b.hero} size={14} className="portrait-micro" />
                                            <span className="ban-hero-name truncate">{b.hero_name || b.hero}</span>
                                            <span className="ban-metric">{b.count} g</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="choices-empty-state">{t('combat.noData', 'No data')}</div>
                                )}
                            </div>
                        </div>

                        <div className="ban-col-extended border-left-choices">
                            <span className="banning-sub-title">{t('combat.topEnemyPrebans', 'Enemy Top Pre-bans')}</span>
                            <div className="extended-ban-list">
                                {Array.isArray(localCombatAnalysis?.enemy_prebans) && localCombatAnalysis.enemy_prebans.length > 0 ? (
                                    localCombatAnalysis.enemy_prebans.slice(0, 5).map((b, idx) => (
                                        <div key={idx} className="condensed-ban-line">
                                            <HeroMiniPortrait heroName={b.hero_name || b.hero} size={14} className="portrait-micro" />
                                            <span className="ban-hero-name truncate">{b.hero_name || b.hero}</span>
                                            <span className="ban-metric">{b.count} g</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="choices-empty-state">{t('combat.noData', 'No data')}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── TIER 3: COUNTER DANGER AND HEAD-TO-HEAD MATCHUPS ── */}
            <div className="combat-row-two-columns">
                {/* Advanced Counter Positional Breakdown */}
                <div className="dashboard-card combat-sub-card counters-large-card">
                    <div className="card-header-flex">
                        <h4 className="strategy-card-title">{t('combat.posCountersTitle', 'Counter Positional Danger')}</h4>
                        <div className="segmented-selector">
                            <button
                                className={`segmented-btn ${counterViewType === 'strong' ? 'active' : ''}`}
                                onClick={() => setCounterViewType('strong')}
                            >
                                {t('combat.strongAgainst', 'Strong Against')}
                            </button>
                            <button
                                className={`segmented-btn ${counterViewType === 'weak' ? 'active' : ''}`}
                                onClick={() => setCounterViewType('weak')}
                            >
                                {t('combat.weakAgainst', 'Weak Against')}
                            </button>
                        </div>
                    </div>

                    <div className="counters-position-profiles-list">
                        {currentCounters.length > 0 ? (
                            currentCounters.map((counter, idx) => (
                                <div key={idx} className="counter-profile-row">
                                    <div className="counter-profile-hero">
                                        <HeroMiniPortrait heroName={counter?.hero_name ?? 'Unknown'} size={20} className="profile-avatar" />
                                        <div className="profile-hero-desc">
                                            <span className="profile-name truncate">{counter?.hero_name ?? 'Unknown'}</span>
                                            <span className="profile-stats-txt">{counter?.count ?? 0} g ({(counter?.win_rate ?? 0).toFixed(0)}% WR)</span>
                                        </div>
                                    </div>
                                    <div className="counter-positional-threat-bar">
                                        <span className="threat-lbl-mini">{t('combat.positionalLossRate', 'Loss Rate by Slot')}</span>
                                        <div className="mini-threat-progress-grid">
                                            {["1", "2", "3", "4", "5"].map(slot => {
                                                const posData = counter.loss_by_position?.[slot];
                                                const lossPct = posData ? posData.pct : 0;
                                                const count = posData ? posData.count : 0;
                                                return (
                                                    <div
                                                        key={slot}
                                                        className="threat-bar-container"
                                                        title={`Slot ${slot}: ${lossPct.toFixed(0)}% loss rate (${count} losses)`}
                                                    >
                                                        <span className="slot-num">S{slot}</span>
                                                        <div className="threat-track">
                                                            <div
                                                                className="threat-fill"
                                                                style={{
                                                                    width: `${lossPct}%`,
                                                                    background: lossPct >= 60 ? '#f43f5e' : lossPct >= 45 ? '#ffae00' : '#10b981'
                                                                }}
                                                            ></div>
                                                        </div>
                                                        <span className="threat-pct">{lossPct.toFixed(0)}%</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="strategy-empty-state">{t('combat.noCountersRecords', 'No counters records loaded')}</div>
                        )}
                    </div>
                </div>

                {/* Head-to-head Matchups Filterable Table */}
                <div className="dashboard-card combat-sub-card matchups-large-card">
                    <div className="card-header-flex flex-wrap-mobile">
                        <h4 className="strategy-card-title">{t('combat.matchupsTitle', 'Head-to-Head Matchups')}</h4>
                        <div className="matchup-header-controls">
                            <input
                                type="text"
                                className="matchup-search-input"
                                placeholder={t('combat.searchHeroPlaceholder', 'Search hero...')}
                                value={matchupSearchQuery}
                                onChange={(e) => setMatchupSearchQuery(e.target.value)}
                            />
                            <div className="segmented-selector">
                                <button
                                    className={`segmented-btn ${matchupPickType === 'fp' ? 'active' : ''}`}
                                    onClick={() => setMatchupPickType('fp')}
                                >
                                    {t('combat.firstPickShort', 'FP')}
                                </button>
                                <button
                                    className={`segmented-btn ${matchupPickType === 'sp' ? 'active' : ''}`}
                                    onClick={() => setMatchupPickType('sp')}
                                >
                                    {t('combat.secondPickShort', 'SP')}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="matchups-scroll-wrapper">
                        {currentMatchups.length > 0 ? (
                            <table className="matchups-high-density-table">
                                <thead>
                                    <tr>
                                        <th>{t('combat.opponent', 'Opponent')}</th>
                                        <th className="text-right">{t('combat.matches', 'Matches')}</th>
                                        <th className="text-right">{t('combat.winRate', 'Win Rate')}</th>
                                        <th className="text-right">{t('combat.ratio', 'W / L')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentMatchups.map((m, idx) => {
                                        const count = m?.count ?? 0;
                                        const wins = m?.wins ?? 0;
                                        const losses = count - wins;
                                        const winRate = m?.win_rate ?? 0;
                                        return (
                                            <tr key={idx}>
                                                <td className="opponent-cell">
                                                    <HeroMiniPortrait heroName={m?.hero_name ?? m?.hero ?? 'Unknown'} size={18} className="opponent-avatar" />
                                                    <span className="opponent-name truncate">{m?.hero_name ?? m?.hero ?? 'Unknown'}</span>
                                                </td>
                                                <td className="text-right text-muted">{count} g</td>
                                                <td className="text-right font-bold" style={{ color: winRate >= 52 ? '#10b981' : winRate >= 48 ? '#38bdf8' : '#f43f5e' }}>
                                                    {winRate.toFixed(1)}%
                                                </td>
                                                <td className="text-right text-muted">{wins}w - {losses}l</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <div className="strategy-empty-state">{t('combat.noMatchupsFound', 'No matchups match search query')}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── TIER 4: OPPONENT WINNING POSITIONS DEEP BLOCK ── */}
            <div className="dashboard-card combat-sub-card opp-winning-positions-large-card">
                <h4 className="strategy-card-title">{t('combat.oppWinningSlotsTitle', 'Opponent Top Slot Threat Picks')}</h4>
                <div className="opp-winning-slots-container">
                    {oppWinningSlots.map(({ pos, list }) => (
                        <div key={pos} className="winning-slot-column">
                            <span className="slot-title-badge">Slot {pos}</span>
                            <div className="winning-slot-picks-list">
                                {list.length > 0 ? (
                                    list.map((item, idx) => (
                                        <div key={idx} className="winning-pick-line">
                                            <HeroMiniPortrait heroName={item?.hero_name ?? 'Unknown'} size={16} className="winning-avatar" />
                                            <span className="winning-name truncate">{item?.hero_name ?? 'Unknown'}</span>
                                            <span className="winning-pct" style={{ color: (item?.pct ?? 0) >= 53 ? '#f43f5e' : '#38bdf8' }}>{(item?.pct ?? 0).toFixed(0)}% WR</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="winning-empty">{t('combat.noThreats', 'No threats')}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
});
