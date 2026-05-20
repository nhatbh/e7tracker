import React from 'react';
import { createPortal } from 'react-dom';

interface TargetPresetsPopupProps {
    isOpen: boolean;
    onClose: () => void;
    handleApplyTargetPreset: (name: string, def: number, hp: number) => void;
}

const TargetDummyPortrait = () => (
    <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#00f2fe" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ background: 'rgba(0, 242, 254, 0.05)', borderRadius: '50%', padding: '4px', border: '1px solid rgba(0, 242, 254, 0.15)' }}>
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
        <circle cx="12" cy="12" r="4" fill="rgba(0, 242, 254, 0.2)" />
        <circle cx="12" cy="12" r="1.5" fill="#00f2fe" />
    </svg>
);

export const TargetPresetsPopup: React.FC<TargetPresetsPopupProps> = ({
    isOpen,
    onClose,
    handleApplyTargetPreset
}) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="presets-overlay-modal" onClick={onClose}>
            <div className="presets-popup-box target calc-card" onClick={(e) => e.stopPropagation()}>
                <div className="popup-hdr">
                    <h4>Target Defensive Presets</h4>
                    <button className="popup-close" onClick={onClose}>✕</button>
                </div>

                <div className="target-presets-grid-row">
                    {[
                        { name: 'Squishy (Dps)', def: 800, hp: 8000, desc: 'Flimsy defensive stats typical for Glass Cannon dps and fast speed units.' },
                        { name: 'Bruiser (Standard)', def: 1300, hp: 15000, desc: 'Balanced RTA bulk parameters for mid-range fighters and utility builds.' },
                        { name: 'Tank (Defensive)', def: 1800, hp: 25000, desc: 'High armor levels typical of front-line mitigators, knights, and heavy healers.' },
                        { name: 'Supertank (Heavy)', def: 2200, hp: 32000, desc: 'Extreme defensive ceiling for RTA tanks like massive HP scaling units.' }
                    ].map(preset => (
                        <div key={preset.name} className="target-preset-box" onClick={() => handleApplyTargetPreset(preset.name, preset.def, preset.hp)}>
                            <TargetDummyPortrait />
                            <h5>{preset.name}</h5>
                            <div className="stats-readout">
                                <span>Def: <strong>{preset.def}</strong></span>
                                <span>HP: <strong>{preset.hp.toLocaleString()}</strong></span>
                            </div>
                            <p>{preset.desc}</p>
                            <button className="select-target-preset-btn">Apply Target Dummy</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
};
