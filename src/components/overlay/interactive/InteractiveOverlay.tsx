/**
 * InteractiveOverlay Component
 * Full-screen interactive overlay that sits on top of the main overlay
 * Toggles cursor pass-through when active
 */

import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './InteractiveOverlay.css';

interface InteractiveOverlayProps {
    isActive: boolean;
    onClose: () => void;
}

export const InteractiveOverlay: React.FC<InteractiveOverlayProps> = ({ isActive, onClose }) => {
    const [clickCount, setClickCount] = useState(0);

    // Toggle cursor pass-through when overlay becomes active/inactive
    useEffect(() => {
        const manageCursor = async () => {
            try {
                const window = getCurrentWindow();
                if (window.label === 'main') {
                    // When overlay is active, allow cursor interactions (false = don't ignore)
                    // When overlay is inactive, pass through to game (true = ignore)
                    await window.setIgnoreCursorEvents(!isActive);
                }
            } catch (error) {
                // Silently fail if not in Tauri context
            }
        };

        manageCursor();
    }, [isActive]);

    if (!isActive) {
        return null;
    }

    return (
        <div className="interactive-overlay-container">
            {/* Full-screen backdrop */}
            <div className="interactive-overlay-backdrop" onClick={onClose} />

            {/* Interactive content panel */}
            <div className="interactive-overlay-panel">
                <div className="interactive-overlay-header">
                    <h2 className="interactive-overlay-title">Interactive Overlay</h2>
                    <button 
                        className="interactive-overlay-close-btn"
                        onClick={onClose}
                        aria-label="Close overlay"
                    >
                        ✕
                    </button>
                </div>

                <div className="interactive-overlay-content">
                    <p className="interactive-overlay-description">
                        This is the new interactive overlay layer. You can now interact with UI elements.
                    </p>

                    <div className="interactive-overlay-button-group">
                        <button 
                            className="interactive-overlay-btn interactive-overlay-btn-primary"
                            onClick={() => setClickCount(clickCount + 1)}
                        >
                            Test Button (Clicked: {clickCount})
                        </button>

                        <button 
                            className="interactive-overlay-btn interactive-overlay-btn-secondary"
                            onClick={() => setClickCount(0)}
                        >
                            Reset Counter
                        </button>

                        <button 
                            className="interactive-overlay-btn interactive-overlay-btn-danger"
                            onClick={onClose}
                        >
                            Close Overlay (Alt+R)
                        </button>
                    </div>

                    <div className="interactive-overlay-info">
                        <p className="interactive-overlay-info-text">
                            ℹ️ Cursor pass-through is now <strong>disabled</strong>. Click anywhere to interact.
                        </p>
                        <p className="interactive-overlay-info-text">
                            Press <kbd>Alt+R</kbd> or click "Close Overlay" to return to non-interactive mode.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
