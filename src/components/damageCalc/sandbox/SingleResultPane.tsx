import React from 'react';
import { SavedBuildProfile } from '../../../services/damageCalc/profileCalc';

interface SingleResultPaneProps {
    activeCaster: SavedBuildProfile;
    output: any;
    uniqueSkills: string[];
    formatSkillHeader: (skillId: string) => string;
    findSkillDamage: (damages: any[], skillId: string, soulburn: boolean) => any;
}

export const SingleResultPane: React.FC<SingleResultPaneProps> = ({
    activeCaster,
    output,
    uniqueSkills,
    formatSkillHeader,
    findSkillDamage
}) => {
    if (!output || !output.damages) {
        return (
            <div className="single-result-empty calc-card">
                <span className="empty-msg">No active calculations for this caster.</span>
            </div>
        );
    }

    return (
        <div className="single-results-blocks-workspace">
            <h3 className="section-workspace-title">
                Calculated Damages ➔ <span className="highlight-caster">{activeCaster.heroName} ({activeCaster.profileName})</span>
            </h3>

            <div className="single-results-grid">
                {uniqueSkills.map(skillId => {
                    const normalRow = findSkillDamage(output.damages, skillId, false);
                    const soulburnRow = findSkillDamage(output.damages, skillId, true);

                    const normalVal = normalRow?.crit !== undefined && normalRow?.crit !== null ? normalRow.crit : normalRow?.normal;
                    const soulburnVal = soulburnRow?.crit !== undefined && soulburnRow?.crit !== null ? soulburnRow.crit : soulburnRow?.normal;

                    // If neither normal nor soulburn exists for this skill, skip rendering or render "--"
                    if (normalVal === undefined && soulburnVal === undefined) return null;

                    return (
                        <div key={skillId} className="single-skill-block-card calc-card glow-card-effect">
                            <div className="skill-card-header">
                                <span className="skill-badge-title">{formatSkillHeader(skillId)}</span>
                                <span className="skill-type-sub">Damage Output</span>
                            </div>

                            <div className="skill-card-body">
                                {/* Normal/Crit Hit Block */}
                                {normalVal !== undefined && normalVal !== null && (
                                    <div className="damage-stat-row">
                                        <div className="stat-label">
                                            <span className="bullet-dot normal"></span>
                                            <span>{normalRow?.crit !== null ? 'Critical Hit' : 'Normal Hit'}</span>
                                        </div>
                                        <div className="stat-value normal-val">
                                            {normalVal.toLocaleString()}
                                        </div>
                                    </div>
                                )}

                                {/* Soulburn Hit Block */}
                                {soulburnVal !== undefined && soulburnVal !== null && (
                                    <div className="damage-stat-row soulburn-highlight-row">
                                        <div className="stat-label">
                                            <span className="bullet-dot soulburn"></span>
                                            <span className="glow-purple-text">Soulburn Hit</span>
                                        </div>
                                        <div className="stat-value soulburn-val glow-purple-text">
                                            {soulburnVal.toLocaleString()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Shield / Barrier Card Block (if any barriers exist) */}
                {output.barriers && output.barriers.length > 0 && (
                    <div className="single-skill-block-card calc-card barrier-card glow-card-effect-green">
                        <div className="skill-card-header">
                            <span className="skill-badge-title shield-title">Shields & Barriers</span>
                            <span className="skill-type-sub">Support Buffs</span>
                        </div>
                        <div className="skill-card-body">
                            {output.barriers.map((b: any) => (
                                <div key={b.label} className="damage-stat-row">
                                    <div className="stat-label">
                                        <span className="bullet-dot barrier"></span>
                                        <span>{b.label}</span>
                                    </div>
                                    <div className="stat-value barrier-val text-cyan">
                                        +{b.value.toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
