import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

// Type for setTimeout return value
type Timeout = ReturnType<typeof setTimeout>;

interface OcrZoneConfig {
    zones: Record<string, {
        zone: { x: number; y: number; w: number; h: number };
        description: string;
    }>;
    description: string;
}

interface OcrMonitorViewProps {
    currentScreen: string | null;
    ocrStatus: 'idle' | 'scanning' | 'success' | 'error';
}

export const OcrMonitorView: React.FC<OcrMonitorViewProps> = ({ currentScreen, ocrStatus }) => {
    const { t } = useTranslation();
    const [ocrZones, setOcrZones] = useState<OcrZoneConfig | null>(null);
    const [flashGreen, setFlashGreen] = useState(false);
    const flashTimeoutRef = useRef<Timeout | null>(null);

    // Fetch OCR zones for the current screen
    useEffect(() => {
        const fetchOcrZones = async () => {
            if (currentScreen) {
                try {
                    const zones = await invoke<OcrZoneConfig | null>('get_ocr_zones_for_screen', {
                        screenName: currentScreen
                    });
                    setOcrZones(zones);
                } catch (err) {
                    console.error('Failed to fetch OCR zones:', err);
                    setOcrZones(null);
                }
            } else {
                setOcrZones(null);
            }
        };

        fetchOcrZones();
    }, [currentScreen]);

    // Handle OCR status changes for visual feedback
    useEffect(() => {
        if (ocrStatus === 'scanning') {
            // Flash green when OCR is active
            setFlashGreen(true);
            if (flashTimeoutRef.current) {
                clearTimeout(flashTimeoutRef.current);
            }
            flashTimeoutRef.current = setTimeout(() => {
                setFlashGreen(false);
            }, 100);
        }

        return () => {
            if (flashTimeoutRef.current) {
                clearTimeout(flashTimeoutRef.current);
            }
        };
    }, [ocrStatus]);

    return (
        <main
            className="ocr-monitor-view"
            style={{
                width: '100vw',
                height: '100vh',
                position: 'relative',
                background: 'rgba(0, 0, 0, 0.15)',
                cursor: 'default',
                overflow: 'hidden',
                userSelect: 'none',
                boxSizing: 'border-box'
            }}
        >
            {/* 👑 Glassmorphic OCR Monitor Header Panel */}
            <div
                className="ocr-monitor-control-panel"
                style={{
                    position: 'absolute',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(10, 15, 26, 0.82)',
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '12px 20px',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65)',
                    fontFamily: "'Outfit', 'Inter', sans-serif"
                }}
            >
                {/* Brand / Mode indicator */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', backgroundColor: '#00f2fe', borderRadius: '50%', boxShadow: '0 0 6px #00f2fe' }}></span>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>OCR Monitor</span>
                    </div>
                    <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.35)', fontWeight: 'bold' }}>MONITORING ZONES</span>
                </div>

                {/* Vertical Divider */}
                <div style={{ width: '1px', height: '32px', backgroundColor: 'rgba(255,255,255,0.08)' }}></div>

                {/* Current Screen Display */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>CURRENT SCREEN</label>
                    <div style={{
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '11px',
                        padding: '4px 8px',
                        outline: 'none',
                        minWidth: '120px',
                        textAlign: 'center'
                    }}>
                        {currentScreen || 'No screen detected'}
                    </div>
                </div>

                {/* OCR Status Indicator */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>OCR STATUS</label>
                    <div style={{
                        background: ocrStatus === 'scanning' ? 'rgba(16, 185, 129, 0.8)' : 
                                    ocrStatus === 'success' ? 'rgba(16, 185, 129, 0.5)' :
                                    ocrStatus === 'error' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(100, 100, 100, 0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '11px',
                        padding: '4px 8px',
                        outline: 'none',
                        minWidth: '100px',
                        textAlign: 'center',
                        fontWeight: 'bold'
                    }}>
                        {ocrStatus === 'scanning' ? 'SCANNING...' : 
                         ocrStatus === 'success' ? 'SUCCESS' :
                         ocrStatus === 'error' ? 'ERROR' : 'IDLE'}
                    </div>
                </div>
            </div>

            {/* 📍 OCR Zone Visualization */}
            {ocrZones && currentScreen && (
                <div style={{
                    position: 'absolute',
                    top: '80px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0, 0, 0, 0.6)',
                    border: '1px solid rgba(0, 255, 255, 0.2)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    zIndex: 99998,
                    fontSize: '11px',
                    color: '#fff',
                    maxWidth: '80%',
                    textAlign: 'center'
                }}>
                    Monitoring {Object.keys(ocrZones.zones).length} OCR zones for {currentScreen}
                </div>
            )}

            {/* Render all OCR zones for the current screen */}
            {ocrZones && currentScreen && Object.entries(ocrZones.zones).map(([slotId, zoneConfig]) => (
                <div key={slotId} style={{
                    position: 'absolute',
                    left: `${zoneConfig.zone.x}%`,
                    top: `${zoneConfig.zone.y}%`,
                    width: `${zoneConfig.zone.w}%`,
                    height: `${zoneConfig.zone.h}%`,
                    border: flashGreen ? '2px solid rgba(16, 185, 129, 0.85)' : '2px solid rgba(239, 68, 68, 0.85)',
                    boxShadow: flashGreen ? '0 0 10px rgba(16, 185, 129, 0.4)' : '0 0 10px rgba(239, 68, 68, 0.4)',
                    pointerEvents: 'none',
                    zIndex: 999,
                    transition: 'border-color 0.1s ease, box-shadow 0.1s ease'
                }}>
                    <span style={{
                        position: 'absolute',
                        top: '-18px',
                        left: '2px',
                        background: flashGreen ? 'rgba(16, 185, 129, 0.85)' : 'rgba(239, 68, 68, 0.85)',
                        color: '#fff',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        whiteSpace: 'nowrap',
                        fontFamily: "'Outfit', sans-serif",
                        transition: 'background-color 0.1s ease'
                    }}>
                        {slotId.toUpperCase()}
                    </span>
                    <span style={{
                        position: 'absolute',
                        bottom: '-16px',
                        left: '2px',
                        background: 'rgba(0, 0, 0, 0.7)',
                        color: '#fff',
                        fontSize: '8px',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        whiteSpace: 'nowrap',
                        fontFamily: "'Outfit', sans-serif",
                        maxWidth: '200px',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden'
                    }}>
                        {zoneConfig.description}
                    </span>
                </div>
            ))}

            {/* No zones detected message */}
            {currentScreen && !ocrZones && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    pointerEvents: 'none'
                }}>
                    No OCR zones configured for {currentScreen}
                </div>
            )}

            {/* No screen detected message */}
            {!currentScreen && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    background: 'rgba(0, 0, 0, 0.4)',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    pointerEvents: 'none'
                }}>
                    No screen detected - OCR monitoring inactive
                </div>
            )}

            {/* Animation styling block */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, -10px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                
                @keyframes pulse {
                    0%, 100% { border-color: rgba(239, 68, 68, 0.85); }
                    50% { border-color: rgba(16, 185, 129, 0.85); }
                }
            `}</style>
        </main>
    );
};