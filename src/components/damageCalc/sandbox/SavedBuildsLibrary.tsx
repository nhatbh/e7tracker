import React from 'react';
import { HeroMiniPortrait } from '../../HeroMiniPortrait';
import { getSetIconUrl } from '../../../services/setAssets';
import { SavedBuildProfile } from '../../../services/damageCalc/profileCalc';

interface SavedBuildsLibraryProps {
    isLibraryCollapsed: boolean;
    setIsLibraryCollapsed: (val: boolean) => void;
    profiles: SavedBuildProfile[];
    librarySearch: string;
    setLibrarySearch: (val: string) => void;
    libraryFilter: 'current' | 'all';
    setLibraryFilter: (val: 'current' | 'all') => void;
    heroName: string;
    selectedLibraryIds: string[];
    setSelectedLibraryIds: React.Dispatch<React.SetStateAction<string[]>>;
    handleAddCastersFromLibrary: () => void;
    handleAddTargetFromLibrary: () => void;
    handleDeleteLibraryProfiles: () => void;
    setIsCasterPresetOpen: (val: boolean) => void;
    setIsTargetPresetOpen: (val: boolean) => void;
    filteredLibraryProfiles: SavedBuildProfile[];
    getSetsFromForm: (formState?: Record<string, any>) => string[];
    filterCasterToggles: (formState?: Record<string, any>) => string[];
    getArtifactIcon: (id: string) => string;
    getToggleIcon: (key: string, advantageousElement?: string) => string;
    getAdvantageousElement: (element?: string) => string;
    getHeroElement: (hName: string) => string;
    calcMode?: 'single' | 'multi';
}

export const SavedBuildsLibrary: React.FC<SavedBuildsLibraryProps> = ({
    isLibraryCollapsed,
    setIsLibraryCollapsed,
    profiles,
    librarySearch,
    setLibrarySearch,
    libraryFilter,
    setLibraryFilter,
    heroName,
    selectedLibraryIds,
    setSelectedLibraryIds,
    handleAddCastersFromLibrary,
    handleAddTargetFromLibrary,
    handleDeleteLibraryProfiles,
    setIsCasterPresetOpen,
    setIsTargetPresetOpen,
    filteredLibraryProfiles,
    getSetsFromForm,
    filterCasterToggles,
    getArtifactIcon,
    getToggleIcon,
    getAdvantageousElement,
    getHeroElement,
    calcMode = 'multi'
}) => {
    const [currentPage, setCurrentPage] = React.useState(1);

    // Reset pagination to page 1 whenever filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [librarySearch, libraryFilter, heroName]);

    const ITEMS_PER_PAGE = 10; // exactly 2 rows (5 columns * 2 rows)
    const totalPages = Math.ceil(filteredLibraryProfiles.length / ITEMS_PER_PAGE) || 1;
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const paginatedProfiles = filteredLibraryProfiles.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    return (
        <div className={`library-panel calc-card ${isLibraryCollapsed ? 'collapsed' : ''}`}>
            <div className="library-header" onClick={() => setIsLibraryCollapsed(!isLibraryCollapsed)}>
                <div className="hdr-text">
                    <svg className="folder-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <h3>Saved Build Library ({profiles.length})</h3>
                </div>
                <span className="collapsible-arrow">{isLibraryCollapsed ? '▼' : '▲'}</span>
            </div>

            {!isLibraryCollapsed && (
                <div className="library-content">
                    {/* Action Tool Row */}
                    <div className="library-actions-row">
                        <input
                            type="text"
                            className="saved-builds-search"
                            placeholder="Search library profiles..."
                            value={librarySearch}
                            onChange={(e) => setLibrarySearch(e.target.value)}
                        />
                        <div className="filter-chip-row">
                            <button className={`tab-filter-btn ${libraryFilter === 'current' ? 'active' : ''}`} onClick={() => setLibraryFilter('current')}>{heroName} only</button>
                            <button className={`tab-filter-btn ${libraryFilter === 'all' ? 'active' : ''}`} onClick={() => setLibraryFilter('all')}>All Heroes</button>
                        </div>
                    </div>

                    {/* Interactive Bulk Buttons */}
                    <div className="bulk-toolbar">
                        <button
                            className={`bulk-action-btn load-casters ${selectedLibraryIds.length > 0 ? 'active' : ''}`}
                            onClick={handleAddCastersFromLibrary}
                            disabled={selectedLibraryIds.length === 0}
                        >
                            {calcMode === 'single' ? 'Load Caster' : `Add Caster(s) (${selectedLibraryIds.length})`}
                        </button>
                        <button
                            className={`bulk-action-btn load-target ${selectedLibraryIds.length > 0 ? 'active' : ''}`}
                            onClick={handleAddTargetFromLibrary}
                            disabled={selectedLibraryIds.length === 0}
                        >
                            Add Target
                        </button>
                        <button
                            className={`bulk-action-btn delete-selected ${selectedLibraryIds.length > 0 ? 'active' : ''}`}
                            onClick={handleDeleteLibraryProfiles}
                            disabled={selectedLibraryIds.length === 0}
                        >
                            Delete
                        </button>
                        <button className="bulk-action-btn preset-launcher" onClick={() => setIsCasterPresetOpen(true)}>Caster Presets</button>
                        <button className="bulk-action-btn preset-launcher" onClick={() => setIsTargetPresetOpen(true)}>Target Presets</button>
                    </div>

                    {/* Grid list of compact rectangular cards */}
                    {filteredLibraryProfiles.length === 0 ? (
                        <div className="empty-library-filler">
                            <span>No profiles matches filters. Create some presets!</span>
                        </div>
                    ) : (
                        <>
                            <div className="saved-builds-grid">
                                {paginatedProfiles.map(profile => {
                                    const isSelected = selectedLibraryIds.includes(profile.id);
                                    const activeSets = getSetsFromForm(profile.formState);
                                    const activeBuffs = filterCasterToggles(profile.formState);

                                    return (
                                        <div
                                            key={profile.id}
                                            className={`compact-profile-card ${isSelected ? 'selected glow-selected' : ''}`}
                                            onClick={() => {
                                                setSelectedLibraryIds(prev =>
                                                    prev.includes(profile.id) ? prev.filter(x => x !== profile.id) : [...prev, profile.id]
                                                );
                                            }}
                                        >
                                            <div className="card-top-header">
                                                <HeroMiniPortrait heroName={profile.heroName} size={28} />
                                                <div className="name-box">
                                                    <span className="p-title">{profile.profileName}</span>
                                                    <span className="p-hero">{profile.heroName}</span>
                                                </div>
                                            </div>

                                            {/* Key stats column */}
                                            <div className="card-stats-column">
                                                <div className="stat-pill">Atk: {profile.atk.toLocaleString()}</div>
                                                <div className="stat-pill">CritD: {profile.critDamage}%</div>
                                                <div className="stat-pill">HP: {profile.hp.toLocaleString()}</div>
                                                <div className="stat-pill">Def: {profile.defense.toLocaleString()}</div>
                                                <div className="stat-pill">Spd: {profile.speed}</div>
                                            </div>

                                            {/* Artifact and badges */}
                                            <div className="card-footer-badges">
                                                <div className="artifact-pill">
                                                    <img src={getArtifactIcon(profile.artifactId)} className="art-thumb" alt="" />
                                                    <span>+{profile.artifactLevel}</span>
                                                </div>

                                                <div className="icons-tray">
                                                    {activeSets.map(set => (
                                                        <img key={set} src={getSetIconUrl(set)} className="tray-badge" title={set} alt="" />
                                                    ))}
                                                    {activeBuffs.slice(0, 3).map(buff => {
                                                        const cardEl = getAdvantageousElement(getHeroElement(profile.heroName));
                                                        return <img key={buff} src={getToggleIcon(buff, cardEl)} className="tray-badge" title={buff} alt="" />;
                                                    })}
                                                    {activeBuffs.length > 3 && <span className="more-tray">+{activeBuffs.length - 3}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="library-pagination-row">
                                    <button
                                        className="pag-btn prev"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={safeCurrentPage === 1}
                                    >
                                        ◀ Prev
                                    </button>
                                    <span className="pag-indicator">
                                        Page <strong className="glow-cyan-text">{safeCurrentPage}</strong> of {totalPages}
                                    </span>
                                    <button
                                        className="pag-btn next"
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={safeCurrentPage === totalPages}
                                    >
                                        Next ▶
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
