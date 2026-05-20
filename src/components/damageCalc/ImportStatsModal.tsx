import React, { useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Heroes, getHeroCalculatorKey } from '../../services/damageCalc/damageService';
import { SavedBuildProfile } from '../../services/damageCalc/profileCalc';
import './ImportStatsModal.css';

interface ImportStatsModalProps {
    initialStats: {
        atk?: number;
        defense?: number;
        hp?: number;
        speed?: number;
        chc?: number;
        chd?: number;
        eff?: number;
        efr?: number;
    } | null;
    detectedHeroName?: string | null;
    onConfirm: (profile: SavedBuildProfile, importToCalculator: boolean) => void;
    onCancel: () => void;
}

const formatHeroName = (key: string): string => {
    if (!key) return '';
    const val = Heroes[key];
    if (val && (val as any).name) return (val as any).name;
    
    return key
        .split('_')
        .map((word) => {
            if (word === 'ae') return 'ae-';
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ')
        .replace('ae- ', 'ae-');
};

export const ImportStatsModal: React.FC<ImportStatsModalProps> = ({
    initialStats,
    detectedHeroName,
    onConfirm,
    onCancel
}) => {
    // Resolve initial hero (locked in place, not selectable)
    const selectedHero = useMemo(() => {
        if (detectedHeroName) {
            const key = getHeroCalculatorKey(detectedHeroName);
            if (Heroes[key]) return { key, name: formatHeroName(key) };
        }
        return { key: 'abigail', name: formatHeroName('abigail') };
    }, [detectedHeroName]);

    // Build/profile name
    const [buildName, setBuildName] = useState(() => {
        let heroName = 'Hero';
        if (detectedHeroName) {
            const key = getHeroCalculatorKey(detectedHeroName);
            if (Heroes[key]) {
                heroName = formatHeroName(key);
            }
        } else {
            heroName = formatHeroName('abigail');
        }
        return `${heroName} Build`;
    });

    // Core stats
    const [atk, setAtk] = useState(initialStats?.atk ?? 2000);
    const [defense, setDefense] = useState(initialStats?.defense ?? 1000);
    const [hp, setHp] = useState(initialStats?.hp ?? 10000);
    const [speed, setSpeed] = useState(initialStats?.speed ?? 180);
    const [chc, setChc] = useState(initialStats?.chc ?? 100);
    const [chd, setChd] = useState(initialStats?.chd ?? 250);
    const [eff, setEff] = useState(initialStats?.eff ?? 0);
    const [efr, setEfr] = useState(initialStats?.efr ?? 0);
    const [submitAction, setSubmitAction] = useState<'save' | 'import'>('save');

    // Handle form submission
    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();

        const newProfile: SavedBuildProfile = {
            id: `build-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            heroName: selectedHero.name,
            profileName: buildName.trim() || 'Imported Build',
            savedAt: new Date().toISOString(),
            atk: Number(atk) || 0,
            defense: Number(defense) || 0,
            hp: Number(hp) || 0,
            speed: Number(speed) || 0,
            critDamage: Number(chd) || 0,
            artifactId: 'noProc',
            artifactLevel: 30,
            molagoras1: 0,
            molagoras2: 0,
            molagoras3: 0,
            formState: {
                heroID: selectedHero.key,
                atk: Number(atk) || 0,
                defense: Number(defense) || 0,
                hp: Number(hp) || 0,
                speed: Number(speed) || 0,
                critDamage: Number(chd) || 0,
                chc: Number(chc) || 0,
                eff: Number(eff) || 0,
                efr: Number(efr) || 0,
                rageSet: false,
                penetrationSet: false,
                torrentSetStack: 0,
                pursuitSet: false
            }
        };

        try {
            // Persist to database cache
            const cached = await invoke<string | null>('cache_get', { key: 'saved_damage_calc_builds' });
            const list: SavedBuildProfile[] = cached ? JSON.parse(cached) : [];
            list.push(newProfile);
            await invoke('cache_set', { key: 'saved_damage_calc_builds', value: JSON.stringify(list) });

            onConfirm(newProfile, submitAction === 'import');
        } catch (err) {
            console.error('Failed to save imported build:', err);
            alert('Failed to save build to database.');
        }
    };

    return (
        <div className="import-modal-overlay">
            <div className="import-modal-container">
                <div className="import-modal-header">
                    <div className="import-header-titles">
                        <h2>Import {selectedHero.name} Build</h2>
                    </div>
                    <button type="button" className="import-header-close" onClick={onCancel}>✕</button>
                </div>

                <form onSubmit={handleConfirm} className="import-modal-body">
                    <div className="import-form-row">
                        <div className="import-form-field">
                            <label>Build Name</label>
                            <input
                                type="text"
                                value={buildName}
                                onChange={(e) => setBuildName(e.target.value)}
                                placeholder="Speed DPS, Tank, etc..."
                                maxLength={35}
                                required
                            />
                        </div>
                    </div>

                    <div className="import-stats-matrix">
                        <div className="stats-matrix-grid">
                            <div className="stat-input-box">
                                <label>Attack</label>
                                <input
                                    type="number"
                                    value={atk}
                                    onChange={(e) => setAtk(Number(e.target.value))}
                                    min={0}
                                    max={9999}
                                    required
                                />
                            </div>
                            <div className="stat-input-box">
                                <label>Defense</label>
                                <input
                                    type="number"
                                    value={defense}
                                    onChange={(e) => setDefense(Number(e.target.value))}
                                    min={0}
                                    max={9999}
                                    required
                                />
                            </div>
                            <div className="stat-input-box">
                                <label>Health (HP)</label>
                                <input
                                    type="number"
                                    value={hp}
                                    onChange={(e) => setHp(Number(e.target.value))}
                                    min={0}
                                    max={99999}
                                    required
                                />
                            </div>
                            <div className="stat-input-box">
                                <label>Speed</label>
                                <input
                                    type="number"
                                    value={speed}
                                    onChange={(e) => setSpeed(Number(e.target.value))}
                                    min={0}
                                    max={400}
                                    required
                                />
                            </div>
                            <div className="stat-input-box">
                                <label>Crit Chance (%)</label>
                                <input
                                    type="number"
                                    value={chc}
                                    onChange={(e) => setChc(Number(e.target.value))}
                                    min={0}
                                    max={100}
                                    required
                                />
                            </div>
                            <div className="stat-input-box">
                                <label>Crit Damage (%)</label>
                                <input
                                    type="number"
                                    value={chd}
                                    onChange={(e) => setChd(Number(e.target.value))}
                                    min={150}
                                    max={350}
                                    required
                                />
                            </div>
                            <div className="stat-input-box">
                                <label>Effectiveness (%)</label>
                                <input
                                    type="number"
                                    value={eff}
                                    onChange={(e) => setEff(Number(e.target.value))}
                                    min={0}
                                    max={400}
                                    required
                                />
                            </div>
                            <div className="stat-input-box">
                                <label>Effect Resist (%)</label>
                                <input
                                    type="number"
                                    value={efr}
                                    onChange={(e) => setEfr(Number(e.target.value))}
                                    min={0}
                                    max={400}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="import-form-footer">
                        <button type="button" className="import-btn cancel" onClick={onCancel}>
                            Cancel
                        </button>
                        <button type="submit" className="import-btn save-only" onClick={() => setSubmitAction('save')}>
                            Save
                        </button>
                        <button type="submit" className="import-btn confirm" onClick={() => setSubmitAction('import')}>
                            Save & Import
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
