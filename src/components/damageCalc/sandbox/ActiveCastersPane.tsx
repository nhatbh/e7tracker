import React from 'react';
import { HeroMiniPortrait } from '../../HeroMiniPortrait';
import { SavedBuildProfile } from '../../../services/damageCalc/profileCalc';

interface ActiveCastersPaneProps {
    activeCasters: SavedBuildProfile[];
    activeCasterId: string;
    setActiveCasterId: (id: string) => void;
    unsavedCasterIds: Set<string>;
    TAB_COLORS: string[];
    handleCloseCasterTab: (id: string, e: React.MouseEvent) => void;
    createBlankProfile: (heroName: string, profileName: string) => SavedBuildProfile;
    heroName: string;
    setActiveCasters: React.Dispatch<React.SetStateAction<SavedBuildProfile[]>>;
    activeCaster: SavedBuildProfile | undefined;
    updateActiveCasterField: (field: keyof SavedBuildProfile, val: any) => void;
    ocrStatus: 'idle' | 'scanning' | 'success' | 'failed';
    isOCRScanning: boolean;
    ocrCountdown: number;
    startStatsOCR: () => void;
    handleSaveCasterTab: (caster: SavedBuildProfile) => void;
    updateActiveCasterFormState: (key: string, val: any) => void;
    getArtifactIcon: (id: string) => string;
    formatArtifactName: (id: string) => string;
    artDropdownOpen: boolean;
    setArtDropdownOpen: (val: boolean) => void;
    artSearch: string;
    setArtSearch: (val: string) => void;
    filteredArtifacts: string[];
    activeHeroElement: string;
    targetProfile: SavedBuildProfile;
    getHeroElement: (hName: string) => string;
    hasElementalAdvantage: (casterElement?: string, targetElement?: string) => boolean;
    getToggleIcon: (key: string, advantageousElement?: string) => string;
    getAdvantageousElement: (element?: string) => string;
    getEnhanceMax: (hero: any, skill: string) => number;
    activeHero: any;
    dynamicInputs: { booleans: string[]; numbers: string[] };
    formatFormLabel: (key: string) => string;
    FormDefaults: Record<string, any>;
    calcMode?: 'single' | 'multi';
}

export const ActiveCastersPane: React.FC<ActiveCastersPaneProps> = ({
    activeCasters,
    activeCasterId,
    setActiveCasterId,
    unsavedCasterIds,
    TAB_COLORS,
    handleCloseCasterTab,
    createBlankProfile,
    heroName,
    setActiveCasters,
    activeCaster,
    updateActiveCasterField,
    ocrStatus,
    isOCRScanning,
    ocrCountdown,
    startStatsOCR,
    handleSaveCasterTab,
    updateActiveCasterFormState,
    getArtifactIcon,
    formatArtifactName,
    artDropdownOpen,
    setArtDropdownOpen,
    artSearch,
    setArtSearch,
    filteredArtifacts,
    activeHeroElement,
    targetProfile,
    getHeroElement,
    hasElementalAdvantage,
    getToggleIcon,
    getAdvantageousElement,
    getEnhanceMax,
    activeHero,
    dynamicInputs,
    formatFormLabel,
    FormDefaults,
    calcMode = 'multi'
}) => {
    return (
        <div className="casters-pane calc-card">
            {/* Workspace Tabs list */}
            {calcMode === 'multi' && (
                <div className="casters-tabs-strip">
                    {activeCasters.map((c, index) => {
                        const isActive = c.id === activeCasterId;
                        const isModified = unsavedCasterIds.has(c.id);
                        return (
                            <div
                                key={c.id}
                                className={`caster-tab-item ${isActive ? 'active' : ''}`}
                                onClick={() => setActiveCasterId(c.id)}
                                style={{ borderColor: isActive ? TAB_COLORS[index % 4] : 'rgba(255, 255, 255, 0.05)' }}
                            >
                                <HeroMiniPortrait heroName={c.heroName} size={22} />
                                <span className={`tab-profile-name ${isModified ? 'modified-red' : ''}`}>{c.profileName}</span>
                                <button className="close-tab-btn" onClick={(e) => handleCloseCasterTab(c.id, e)}>✕</button>
                            </div>
                        );
                    })}
                    <button className="add-empty-tab-btn" onClick={() => {
                        const newBlank = createBlankProfile(heroName, `Sandbox Build ${activeCasters.length + 1}`);
                        setActiveCasters(prev => [...prev, newBlank]);
                        setActiveCasterId(newBlank.id);
                    }}>+ Add Tab</button>
                </div>
            )}

            {/* Active Caster workspace inputs */}
            {activeCaster && (
                <div className="active-caster-body scrollable-inputs-block">
                    {/* Panel header controls */}
                    <div className="caster-body-title-bar">
                        <div className="c-info">
                            <HeroMiniPortrait heroName={activeCaster.heroName} size={38} />
                            <input
                                type="text"
                                className="edit-profile-name-input"
                                value={activeCaster.profileName}
                                onChange={(e) => updateActiveCasterField('profileName', e.target.value)}
                                placeholder="Customize Build Name..."
                            />
                            <span className="tag-hero-ref">{activeCaster.heroName}</span>
                        </div>

                        <div className="c-actions">
                            {/* OCR capture trigger */}
                            <button className={`ocr-capture-btn ocr-status-${ocrStatus}`} onClick={startStatsOCR} disabled={isOCRScanning}>
                                <svg className="ocr-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                    <circle cx="12" cy="13" r="4"></circle>
                                </svg>
                                <span>{ocrStatus === 'scanning' ? `Scanning... (${ocrCountdown}s)` : ocrStatus === 'success' ? 'Captured!' : 'Scan OCR'}</span>
                            </button>

                            {/* Quick save build icon button */}
                            <button className="save-caster-btn glow-cyan" onClick={() => handleSaveCasterTab(activeCaster)} title="Save Profile details to SQLite">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                                    <polyline points="7 3 7 8 15 8"></polyline>
                                </svg>
                                <span>Save Build</span>
                            </button>
                        </div>
                    </div>

                    {/* HIGH-DENSITY INPUT CONTROL SETS GRID (No Sliders!) */}
                    <div className="density-fields-grid">
                        {/* Row 1: Numeric text inputs */}
                        <div className="numeric-inputs-box">
                            <span className="group-label">Core Caster Stats</span>
                            <div className="stats-fields-row">
                                <div className="density-field-input">
                                    <label>Attack</label>
                                    <input type="number" value={activeCaster.atk} onChange={(e) => updateActiveCasterField('atk', Number(e.target.value))} />
                                </div>
                                <div className="density-field-input">
                                    <label>CRIT DMG %</label>
                                    <input type="number" value={activeCaster.critDamage} onChange={(e) => updateActiveCasterField('critDamage', Number(e.target.value))} />
                                </div>
                                <div className="density-field-input">
                                    <label>Max HP</label>
                                    <input type="number" value={activeCaster.hp} onChange={(e) => updateActiveCasterField('hp', Number(e.target.value))} />
                                </div>
                                <div className="density-field-input">
                                    <label>Defense</label>
                                    <input type="number" value={activeCaster.defense} onChange={(e) => updateActiveCasterField('defense', Number(e.target.value))} />
                                </div>
                                <div className="density-field-input">
                                    <label>Speed</label>
                                    <input type="number" value={activeCaster.speed} onChange={(e) => updateActiveCasterField('speed', Number(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Searchable Artifact Selector */}
                        <div className="artifacts-inputs-box">
                            <span className="group-label">Artifact Settings</span>
                            <div className="artifact-config-row">
                                <div className="density-field-input selector">
                                    <label>Artifact Name</label>
                                    <div className="art-selector-wrapper">
                                        <button className="art-dropdown-trigger" onClick={() => setArtDropdownOpen(!artDropdownOpen)}>
                                            <img src={getArtifactIcon(activeCaster.artifactId)} className="art-mini-icon" alt="" />
                                            <span>{formatArtifactName(activeCaster.artifactId)}</span>
                                            <span className="dd-arrow">▼</span>
                                        </button>

                                        {artDropdownOpen && (
                                            <div className="art-dropdown-portal">
                                                <input
                                                    type="text"
                                                    className="art-search-input"
                                                    placeholder="Search artifacts..."
                                                    value={artSearch}
                                                    onChange={(e) => setArtSearch(e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="art-options-list">
                                                    {filteredArtifacts.map(id => (
                                                        <div
                                                            key={id}
                                                            className={`art-option-item ${activeCaster.artifactId === id ? 'active' : ''}`}
                                                            onClick={() => {
                                                                updateActiveCasterField('artifactId', id);
                                                                setArtDropdownOpen(false);
                                                            }}
                                                        >
                                                            <img src={getArtifactIcon(id)} className="art-mini-icon" alt="" />
                                                            <span>{formatArtifactName(id)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="density-field-input level">
                                    <label>Level</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="30"
                                        value={activeCaster.artifactLevel}
                                        onChange={(e) => updateActiveCasterField('artifactLevel', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Row 3: Buffs and Debuffs (High-density Icon-Only Toggles) */}
                        <div className="buffs-toggles-box">
                            <span className="group-label">Caster Buffs & Gear Sets</span>
                            <div className="density-toggles-grid">
                                {/* Buff toggles */}
                                {[
                                    { key: 'attackUp', title: 'Attack Up' },
                                    { key: 'attackUpGreat', title: 'Greater Attack Up' },
                                    { key: 'increasedCritDamage', title: 'Crit Dmg Up' },
                                    { key: 'casterSpeedUp', title: 'Speed Up' },
                                    { key: 'casterVigor', title: 'Vigor' },
                                    { key: 'casterEnraged', title: 'Enrage' },
                                    { key: 'elementalAdvantage', title: 'Elemental Advantage' }
                                ].map(toggle => {
                                    const el = getAdvantageousElement(activeHeroElement);
                                    const icon = getToggleIcon(toggle.key, el);
                                    
                                    const casterElement = getHeroElement(activeCaster.heroName);
                                    const targetElement = getHeroElement(targetProfile.heroName);
                                    const isAdvantage = hasElementalAdvantage(casterElement, targetElement);
                                    
                                    const isChecked = toggle.key === 'elementalAdvantage'
                                        ? (isAdvantage || !!activeCaster.formState?.[toggle.key])
                                        : !!activeCaster.formState?.[toggle.key];
                                        
                                    return (
                                        <button
                                            key={toggle.key}
                                            className={`density-toggle-btn ${isChecked ? 'active' : ''} ${toggle.key === 'elementalAdvantage' && isAdvantage ? 'auto-active' : ''}`}
                                            onClick={() => {
                                                if (toggle.key === 'elementalAdvantage' && isAdvantage) {
                                                    return; // Automatically active due to advantage
                                                }
                                                updateActiveCasterFormState(toggle.key, !isChecked);
                                            }}
                                            title={toggle.key === 'elementalAdvantage' && isAdvantage ? 'Elemental Advantage (Auto-Detected Advantage!)' : toggle.title}
                                        >
                                            {icon ? <img src={icon} className="toggle-icon-graphic" alt="" /> : <span>{toggle.title}</span>}
                                        </button>
                                    );
                                })}

                                {/* Sets toggles */}
                                {[
                                    { key: 'rageSet', title: 'Rage Set' },
                                    { key: 'penetrationSet', title: 'Penetration Set' },
                                    { key: 'pursuitSet', title: 'Pursuit Set' }
                                ].map(toggle => {
                                    const icon = getToggleIcon(toggle.key);
                                    const isChecked = !!activeCaster.formState?.[toggle.key];
                                    return (
                                        <button
                                            key={toggle.key}
                                            className={`density-toggle-btn set-toggle ${isChecked ? 'active' : ''}`}
                                            onClick={() => updateActiveCasterFormState(toggle.key, !isChecked)}
                                            title={toggle.title}
                                        >
                                            {icon ? <img src={icon} className="toggle-icon-graphic" alt="" /> : <span>{toggle.title}</span>}
                                        </button>
                                    );
                                })}

                                {/* Torrent cyclic toggle */}
                                {(() => {
                                    const torrentStack = Number(activeCaster.formState?.torrentSetStack || 0);
                                    const torrentIcon = getToggleIcon('torrentSetStack');
                                    const handleTorrentClick = () => {
                                        // Cycle: 0 -> 1 -> 2 -> 3 -> 0
                                        const next = (torrentStack + 1) % 4;
                                        updateActiveCasterFormState('torrentSetStack', next);
                                    };

                                    return (
                                        <button
                                            className={`density-toggle-btn set-toggle torrent-cyclic-btn ${torrentStack > 0 ? 'active' : ''}`}
                                            onClick={handleTorrentClick}
                                            title={`Torrent Set: ${torrentStack} Stack(s) (Click to cycle)`}
                                            style={{ position: 'relative' }}
                                        >
                                            {torrentIcon && <img src={torrentIcon} className="toggle-icon-graphic" alt="" />}
                                            {torrentStack > 0 && (
                                                <span className="torrent-badge-count">{torrentStack}</span>
                                            )}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Row 4: Molagora Enhancements */}
                        <div className="molagoras-box">
                            <span className="group-label">Skill Enhancements (Molagoras)</span>
                            <div className="molagoras-fields-row">
                                <div className="density-field-input mola">
                                    <label>S1</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={getEnhanceMax(activeHero, 's1')}
                                        value={activeCaster.molagoras1}
                                        onChange={(e) => updateActiveCasterField('molagoras1', Number(e.target.value))}
                                    />
                                </div>
                                <div className="density-field-input mola">
                                    <label>S2</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={getEnhanceMax(activeHero, 's2')}
                                        value={activeCaster.molagoras2}
                                        onChange={(e) => updateActiveCasterField('molagoras2', Number(e.target.value))}
                                    />
                                </div>
                                <div className="density-field-input mola">
                                    <label>S3</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max={getEnhanceMax(activeHero, 's3')}
                                        value={activeCaster.molagoras3}
                                        onChange={(e) => updateActiveCasterField('molagoras3', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Row 5: Hero specific & dynamic sliders options */}
                        {(dynamicInputs.booleans.length > 0 || dynamicInputs.numbers.length > 0) && (
                            <div className="specifics-inputs-box">
                                <span className="group-label">Hero / Artifact Unique Conditions</span>
                                <div className="specifics-tray">
                                    {dynamicInputs.booleans.map(key => {
                                        const icon = getToggleIcon(key);
                                        const isChecked = !!activeCaster.formState?.[key];
                                        const title = formatFormLabel(key);
                                        return (
                                            <button
                                                key={key}
                                                className={`density-toggle-btn unique-toggle ${isChecked ? 'active' : ''}`}
                                                onClick={() => updateActiveCasterFormState(key, !isChecked)}
                                                title={title}
                                            >
                                                {icon ? (
                                                    <img src={icon} className="toggle-icon-graphic" alt="" />
                                                ) : (
                                                    <span className="unique-btn-text">{title}</span>
                                                )}
                                            </button>
                                        );
                                    })}

                                    {dynamicInputs.numbers.map(key => {
                                        const defObj = FormDefaults[key];
                                        const min = defObj?.min !== undefined ? defObj.min : 0;
                                        const max = defObj?.max !== undefined ? defObj.max : 100000;

                                        let fallbackVal = defObj?.defaultValue ?? defObj?.default ?? 0;
                                        if (key === 'casterMaxHP' || key === 'casterMaxHp') fallbackVal = activeCaster.hp;
                                        if (key === 'casterDefense' || key === 'casterDef') fallbackVal = activeCaster.defense;
                                        if (key === 'casterSpeed') fallbackVal = activeCaster.speed;
                                        if (key === 'casterAtk' || key === 'casterAttack') fallbackVal = activeCaster.atk;
                                        if (key === 'targetMaxHP' || key === 'targetMaxHp' || key === 'enemyMaxHP' || key === 'enemyMaxHp') fallbackVal = targetProfile.hp;
                                        if (key === 'targetDefense') fallbackVal = targetProfile.defense;
                                        if (key === 'targetSpeed') fallbackVal = targetProfile.speed;
                                        if (key === 'targetAtk' || key === 'targetAttack') fallbackVal = targetProfile.atk || 0;

                                        return (
                                            <div key={key} className="density-field-input spec">
                                                <label>{formatFormLabel(key)}</label>
                                                <input
                                                    type="number"
                                                    min={min}
                                                    max={max}
                                                    value={activeCaster.formState?.[key] !== undefined ? activeCaster.formState[key] : fallbackVal}
                                                    onChange={(e) => updateActiveCasterFormState(key, Number(e.target.value))}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
