import React from 'react';
import { createPortal } from 'react-dom';
import { HeroMiniPortrait } from '../../HeroMiniPortrait';

interface CasterPresetsPopupProps {
    isOpen: boolean;
    onClose: () => void;
    casterPresetHeroSearch: string;
    setCasterPresetHeroSearch: (val: string) => void;
    filteredPresetHeroes: string[];
    selectedPresetHero: string;
    handleHeroPresetSelect: (hero: string) => void;
    isPresetLoading: boolean;
    presetHeroData: any;
    handleApplyCasterPreset: (presetName: string, stats: any, gearSets?: string[]) => void;
}

export const CasterPresetsPopup: React.FC<CasterPresetsPopupProps> = ({
    isOpen,
    onClose,
    casterPresetHeroSearch,
    setCasterPresetHeroSearch,
    filteredPresetHeroes,
    selectedPresetHero,
    handleHeroPresetSelect,
    isPresetLoading,
    presetHeroData,
    handleApplyCasterPreset
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="presets-overlay-modal" onClick={onClose}>
            <div className="presets-popup-box calc-card" onClick={(e) => e.stopPropagation()}>
                <div className="popup-hdr">
                    <h4>Caster Community Presets</h4>
                    <button className="popup-close" onClick={onClose}>✕</button>
                </div>

                <div className="popup-split-body">
                    {/* Left part: Hero Selection List with search */}
                    <div className="preset-heroes-selector">
                        <input
                            type="text"
                            className="presets-search-input"
                            placeholder="Search hero templates..."
                            value={casterPresetHeroSearch}
                            onChange={(e) => setCasterPresetHeroSearch(e.target.value)}
                        />
                        <div className="preset-heroes-list">
                            {filteredPresetHeroes.map(hero => (
                                <div
                                    key={hero}
                                    className={`preset-hero-item ${selectedPresetHero === hero ? 'active' : ''}`}
                                    onClick={() => handleHeroPresetSelect(hero)}
                                >
                                    <HeroMiniPortrait heroName={hero} size={24} />
                                    <span>{hero}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right part: Recommended sets and presets actions */}
                    <div className="presets-options-panel">
                        {isPresetLoading ? (
                            <div className="preset-spinner">
                                <div className="loading-spinner"></div>
                                <span>Querying AWS buildData Optimizer...</span>
                            </div>
                        ) : !selectedPresetHero ? (
                            <div className="preset-prompt-vibe">
                                <span>Select a Hero on the left to see recommended community sets & averages</span>
                            </div>
                        ) : !presetHeroData ? (
                            <div className="preset-prompt-vibe">
                                <span>No build data found for {selectedPresetHero}. Apply a fallback AVG config:</span>
                                <button className="apply-preset-chip avg" onClick={() => handleApplyCasterPreset('AVG Fallback', { atk: 3000, def: 1000, hp: 10000, spd: 200, chd: 250 })}>
                                    Apply Fallback AVG
                                </button>
                            </div>
                        ) : (
                            <div className="recommended-sets-options scrollable-presets-block">
                                <h5>Template recommendations for <strong className="glow-cyan-text">{selectedPresetHero}</strong></h5>

                                {/* Averages */}
                                <div className="preset-set-card">
                                    <h6>Global Community Averages</h6>
                                    <div className="preset-card-actions">
                                        {presetHeroData.averageStats && (
                                            <button className="apply-preset-chip avg" onClick={() => handleApplyCasterPreset('AVG', presetHeroData.averageStats)}>
                                                Apply AVG Preset
                                            </button>
                                        )}
                                        {presetHeroData.proStats?.averageStats && (
                                            <button className="apply-preset-chip pro" onClick={() => handleApplyCasterPreset('PRO', presetHeroData.proStats!.averageStats)}>
                                                Apply PRO Preset
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Standard gear sets */}
                                {presetHeroData.setStats && presetHeroData.setStats.length > 0 && (
                                    <div className="preset-set-card">
                                        <h6>Recommended Gear Sets</h6>
                                        <div className="presets-set-grid">
                                            {presetHeroData.setStats.map((set: any, idx: number) => (
                                                <div key={idx} className="set-row-item">
                                                    <div className="set-meta">
                                                        <span className="set-nm">{set.setName}</span>
                                                        <span className="set-pct">({set.percent}%)</span>
                                                    </div>
                                                    <button className="apply-preset-chip small" onClick={() => handleApplyCasterPreset(`Set ${idx + 1}`, set.stats, set.setName.split(' / ').map((s: string)=>s.trim()))}>
                                                        Apply Set {idx + 1}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Pro sets */}
                                {(() => {
                                    const proStats = presetHeroData.proStats;
                                    if (!proStats || !proStats.setStats || proStats.setStats.length === 0) return null;
                                    return (
                                        <div className="preset-set-card">
                                            <h6>RTA Pro Recommendations</h6>
                                            <div className="presets-set-grid">
                                                {proStats.setStats.map((set: any, idx: number) => (
                                                    <div key={idx} className="set-row-item">
                                                        <div className="set-meta">
                                                            <span className="set-nm">{set.setName} Pro</span>
                                                            <span className="set-pct">({set.percent}%)</span>
                                                        </div>
                                                        <button className="apply-preset-chip small pro" onClick={() => handleApplyCasterPreset(`Set ${idx + 1} Pro`, set.stats, set.setName.split(' / ').map((s: string)=>s.trim()))}>
                                                            Apply Set {idx + 1} Pro
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
