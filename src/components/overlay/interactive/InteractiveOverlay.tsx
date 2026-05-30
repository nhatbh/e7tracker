import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { HeroDetailsView } from '../../HeroDetailsView';
import { overlayManager } from '../../../overlay/services/OverlayManagerService';
import { InteractivePageType } from '../../../domain/models/InteractiveOverlay';
import './InteractiveOverlay.css';

interface InteractiveOverlayProps {
    onClose: () => void;
}

export const InteractiveOverlay: React.FC<InteractiveOverlayProps> = ({ onClose }) => {
    const [activeOverlayId, setActiveOverlayId] = useState<InteractivePageType | null>(null);

    useEffect(() => {
        const unsubscribe = overlayManager.onOverlayChange(setActiveOverlayId);
        setActiveOverlayId(overlayManager.getActiveOverlayId());
        return unsubscribe;
    }, []);

    // Toggle cursor pass-through when overlay becomes active/inactive
    useEffect(() => {
        const manageCursor = async () => {
            try {
                const window = getCurrentWindow();
                if (window.label === 'main') {
                    // When overlay is active, allow cursor interactions (false = don't ignore)
                    // When overlay is inactive, pass through to game (true = ignore)
                    await window.setIgnoreCursorEvents(activeOverlayId === null);
                }
            } catch (error) {
                // Silently fail if not in Tauri context
            }
        };

        manageCursor();
    }, [activeOverlayId]);

    if (!activeOverlayId) {
        return null;
    }

    const renderContent = () => {
        if (activeOverlayId === InteractivePageType.Dashboard) {
            const definition = overlayManager.getOverlay(InteractivePageType.Dashboard);
            if (definition) {
                const Component = definition.component as any;
                return <Component isActive={true} onClose={onClose} />;
            }
        }
        
        if (activeOverlayId === InteractivePageType.HeroDetails) {
            const heroName = overlayManager.getActiveOverlayData();
            if (!heroName) {
                return (
                    <div className="interactive-overlay-empty">
                        <p>No hero detected. Please select a hero in-game to view details.</p>
                        <button className="interactive-overlay-btn" onClick={onClose}>Close</button>
                    </div>
                );
            }
            return (
                <HeroDetailsView 
                    heroName={heroName} 
                    onClose={onClose}
                />
            );
        }

        return (
            <div className="interactive-overlay-empty">
                <p>Overlay not found.</p>
                <button className="interactive-overlay-btn" onClick={onClose}>Close</button>
            </div>
        );
    };

    return (
        <div className="interactive-overlay-container">
            {/* Full-screen backdrop */}
            <div className="interactive-overlay-backdrop" onClick={onClose} />

            {/* Interactive content panel */}
            <div className="interactive-overlay-panel">
                <div className="interactive-overlay-content">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
