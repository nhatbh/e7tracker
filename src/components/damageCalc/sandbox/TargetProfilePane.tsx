import React from 'react';
import { HeroMiniPortrait } from '../../HeroMiniPortrait';
import { SavedBuildProfile } from '../../../services/damageCalc/profileCalc';

interface TargetProfilePaneProps {
    targetProfile: SavedBuildProfile;
    handleSaveTargetTab: () => void;
    updateTargetField: (field: keyof SavedBuildProfile, val: any) => void;
    updateTargetFormState: (key: string, val: any) => void;
    getToggleIcon: (key: string, advantageousElement?: string) => string;
}

const TargetDummyPortrait = () => (
    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#00f2fe" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ background: 'rgba(0, 242, 254, 0.05)', borderRadius: '50%', padding: '4px', border: '1px solid rgba(0, 242, 254, 0.15)' }}>
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
        <circle cx="12" cy="12" r="4" fill="rgba(0, 242, 254, 0.2)" />
        <circle cx="12" cy="12" r="1.5" fill="#00f2fe" />
    </svg>
);

export const TargetProfilePane: React.FC<TargetProfilePaneProps> = ({
    targetProfile,
    handleSaveTargetTab,
    updateTargetField,
    updateTargetFormState,
    getToggleIcon
}) => {
    return (
        <div className="target-pane calc-card">
            <div className="target-panel-header">
                <div className="t-profile">
                    {targetProfile.heroName ? (
                        <HeroMiniPortrait heroName={targetProfile.heroName} size={30} />
                    ) : (
                        <TargetDummyPortrait />
                    )}
                    <div className="t-names">
                        <span className="t-lbl">SANDBOX TARGET</span>
                        <span className="t-val">{targetProfile.heroName ? `${targetProfile.heroName} (${targetProfile.profileName})` : 'Training Dummy (Stat-Only)'}</span>
                    </div>
                </div>

                {/* Save target edits (if it's a saved build target) */}
                {targetProfile.heroName && (
                    <button className="save-target-btn" onClick={handleSaveTargetTab} title="Save edits to SQLite target build">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        </svg>
                    </button>
                )}
            </div>

            <div className="target-body-scrollable">
                {/* HP and Defense numeric inputs */}
                <div className="target-stats-inputs">
                    <span className="section-title">Defensive Stats</span>
                    <div className="density-field-input target">
                        <label>Target HP / Max HP</label>
                        <input
                            type="number"
                            value={targetProfile.hp}
                            onChange={(e) => updateTargetField('hp', Number(e.target.value))}
                        />
                    </div>
                    <div className="density-field-input target">
                        <label>Target Defense</label>
                        <input
                            type="number"
                            value={targetProfile.defense}
                            onChange={(e) => updateTargetField('defense', Number(e.target.value))}
                        />
                    </div>
                </div>

                {/* Toggles debuffs/buffs on Target */}
                <div className="target-conditions">
                    <span className="section-title">Opponent Statuses</span>
                    <div className="density-toggles-grid target">
                        {[
                            { key: 'targetDefenseDown', title: 'Defense Down' },
                            { key: 'targetTargeted', title: 'Targeted' },
                            { key: 'targetDefenseUp', title: 'Defense Up' },
                            { key: 'targetVigor', title: 'Target Vigor' },
                            { key: 'targetRuptured', title: 'Ruptured' },
                            { key: 'targetPilfered', title: 'Target Pilfered' },
                            { key: 'targetHasTrauma', title: 'Trauma' },
                            { key: 'targetMagicNailed', title: 'Magic Nailed' },
                            { key: 'targetFractured', title: 'Fractured' },
                            { key: 'targetLaceration', title: 'Laceration' }
                        ].map(toggle => {
                            const icon = getToggleIcon(toggle.key);
                            const isChecked = !!targetProfile.formState?.[toggle.key];
                            return (
                                <button
                                    key={toggle.key}
                                    className={`density-toggle-btn ${isChecked ? 'active' : ''}`}
                                    onClick={() => updateTargetFormState(toggle.key, !isChecked)}
                                    title={toggle.title}
                                >
                                    {icon ? <img src={icon} className="toggle-icon-graphic" alt="" /> : <span>{toggle.title}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Read-only irrelevant target stats */}
                <div className="target-readonly-stats">
                    <span className="section-title">Non-Relevant Parameters</span>
                    <div className="readonly-pills-column">
                        <div className="ro-stat-pill"><span>Attack</span><strong>--</strong></div>
                        <div className="ro-stat-pill"><span>Crit Chance</span><strong>--</strong></div>
                        <div className="ro-stat-pill"><span>Crit Damage</span><strong>--</strong></div>
                        <div className="ro-stat-pill"><span>Speed</span><strong>--</strong></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
