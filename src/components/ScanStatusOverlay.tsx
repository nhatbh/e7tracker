import React from 'react';
import './ScanStatusOverlay.css';

interface ScanStatusOverlayProps {
    status: 'idle' | 'scanning' | 'timeout' | 'success';
    countdown: number;
}

export const ScanStatusOverlay: React.FC<ScanStatusOverlayProps> = ({ status, countdown }) => {
    return (
        <div className={`scan-status-overlay-card ${status}`}>
            {status === 'scanning' ? (
                <div className="scan-status-item scanning">
                    <kbd className="pulse-cyan">Alt + S</kbd>
                    <span className="pulse-text" style={{ color: '#00f2fe' }}>Scanning... ({countdown}s)</span>
                </div>
            ) : status === 'timeout' ? (
                <div className="scan-status-item timeout">
                    <kbd className="pulse-amber" style={{ color: '#ff9800', borderColor: '#ff9800' }}>Alt + S</kbd>
                    <span className="warning-text" style={{ color: '#ff9800' }}>Timed out!</span>
                </div>
            ) : status === 'success' ? (
                <div className="scan-status-item success">
                    <kbd className="pulse-green" style={{ color: '#4caf50', borderColor: '#4caf50' }}>✓</kbd>
                    <span className="success-text" style={{ color: '#4caf50' }}>Success!</span>
                </div>
            ) : (
                <div className="scan-status-item">
                    <kbd>Alt + S</kbd>
                    <span>Scan Stats</span>
                </div>
            )}
        </div>
    );
};
