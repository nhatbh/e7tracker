import React from 'react';
import { useTranslation } from 'react-i18next';
import { HeroAnalysis } from '../services/combatData';

interface DashboardLeaderboardProps {
    localCombatAnalysis: HeroAnalysis | null;
}

export const DashboardLeaderboard: React.FC<DashboardLeaderboardProps> = React.memo(({
    localCombatAnalysis
}) => {
    const { t } = useTranslation();

    return (
        <div className="dashboard-card strategy-card leaderboard-unified-card">
            <h4 className="strategy-card-title">{t('combat.leaderboard')}</h4>
            <div className="leaderboard-condensed-wrapper">
                {localCombatAnalysis && localCombatAnalysis.player_list && localCombatAnalysis.player_list.length > 0 ? (
                    <table className="leaderboard-table condensed">
                        <thead>
                            <tr>
                                <th>{t('combat.playerName')}</th>
                                <th>{t('combat.region')}</th>
                                <th>{t('combat.games')}</th>
                                <th>{t('combat.winRate')}</th>
                                <th>{t('combat.ggLink')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localCombatAnalysis.player_list.slice(0, 3).map((player: any, idx: number) => (
                                <tr key={idx}>
                                    <td className="player-name truncate">{player.player}</td>
                                    <td>{player.region}</td>
                                    <td>{player.games}</td>
                                    <td className="player-wr" style={{ color: player.win_rate >= 60 ? '#10b981' : '#38bdf8' }}>
                                        {player.win_rate}%
                                    </td>
                                    <td>
                                        {player.url ? (
                                            <a href={player.url} target="_blank" rel="noopener noreferrer" className="mini-record-btn">
                                                GG ↗
                                            </a>
                                        ) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="strategy-empty-state">{t('combat.noLeaderboards')}</div>
                )}
            </div>
        </div>
    );
});
