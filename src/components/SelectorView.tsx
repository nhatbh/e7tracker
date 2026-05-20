import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

interface SelectorViewProps {
    containerRef?: React.RefObject<HTMLDivElement | null>;
    currentRect?: { x: number; y: number; w: number; h: number };
    handleMouseDown?: (e: React.MouseEvent) => void;
    handleMouseMove?: (e: React.MouseEvent) => void;
    handleMouseUp?: () => Promise<void>;
}

export const SelectorView: React.FC<SelectorViewProps> = () => {
    const { t } = useTranslation();

    // Autonomous dragging states for the canvas
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [dragRect, setDragRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
    const localContainerRef = useRef<HTMLDivElement>(null);

    // Profile editor configuration states
    const [client, setClient] = useState<string>('default');
    const [resolution, setResolution] = useState<string>('1600x900');

    // Auto-detect resolution range setting from the game window dimensions
    useEffect(() => {
        const updateDetectedResolution = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            
            // Map dimensions to standard buckets (similar to backend get_resolution_bucket)
            if (Math.abs(w - 1280) <= 60 && Math.abs(h - 720) <= 60) {
                setResolution("1280x720");
            } else if (Math.abs(w - 1600) <= 60 && Math.abs(h - 900) <= 60) {
                setResolution("1600x900");
            } else if (Math.abs(w - 1920) <= 60 && Math.abs(h - 1080) <= 60) {
                setResolution("1920x1080");
            } else {
                const ratio = w / h;
                if (Math.abs(ratio - 1.777) < 0.1) {
                    if (w < 1440) setResolution("1280x720");
                    else if (w < 1760) setResolution("1600x900");
                    else setResolution("1920x1080");
                }
            }
        };

        updateDetectedResolution();
        window.addEventListener('resize', updateDetectedResolution);
        return () => window.removeEventListener('resize', updateDetectedResolution);
    }, []);
    const [screen, setScreen] = useState<string>('Hero_Detail');
    const [signatureKey, setSignatureKey] = useState<string>('detail-signature.png');

    // Edit mode and slot configuration states
    const [editMode, setEditMode] = useState<'signature' | 'ocr'>('signature');
    const [slotId, setSlotId] = useState<string>('selected_hero');
    const [customSlotId, setCustomSlotId] = useState<string>('');

    // UI Status Alert Banner state
    const [alert, setAlert] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Current Configure Zone visualization state
    const [currentZone, setCurrentZone] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

    // Automatically update signature key suggestion when screen type changes
    useEffect(() => {
        if (screen === 'Hero_Detail') {
            setSignatureKey('detail-signature.png');
        } else if (screen === 'Hero_Stats') {
            setSignatureKey('stats-signature.png');
        } else if (screen === 'Lobby') {
            setSignatureKey('lobby-signature.png');
        } else {
            setSignatureKey(`${screen.toLowerCase()}-signature.png`);
        }
    }, [screen]);

    // Fetch the current detection zone coordinates on disk whenever dropdown configurations change
    useEffect(() => {
        const fetchCurrentZone = async () => {
            const finalSlotId = slotId === 'custom' ? customSlotId.trim() : slotId;
            try {
                const zone = await invoke<{ x: number; y: number; w: number; h: number } | null>('get_current_zone', {
                    client,
                    resolution,
                    screen,
                    editMode,
                    signatureKey: signatureKey.trim(),
                    slotId: finalSlotId
                });
                setCurrentZone(zone);
            } catch (err) {
                console.error('Failed to fetch current zone:', err);
                setCurrentZone(null);
            }
        };

        fetchCurrentZone();
    }, [client, resolution, screen, editMode, signatureKey, slotId, customSlotId]);

    // Drag Canvas mouse handlers
    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        const rect = localContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setStartPos({ x, y });
        setDragRect({ x, y, w: 0, h: 0 });
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const rect = localContainerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setDragRect({
            x: Math.min(x, startPos.x),
            y: Math.min(y, startPos.y),
            w: Math.abs(x - startPos.x),
            h: Math.abs(y - startPos.y),
        });
    };

    const onMouseUp = async () => {
        if (!isDragging) return;
        setIsDragging(false);
        const rect = localContainerRef.current?.getBoundingClientRect();
        if (!rect || dragRect.w < 6 || dragRect.h < 6) return;

        // Convert drag dimensions to percentage bounds
        const pctX = (dragRect.x / rect.width) * 100;
        const pctY = (dragRect.y / rect.height) * 100;
        const pctW = (dragRect.w / rect.width) * 100;
        const pctH = (dragRect.h / rect.height) * 100;

        const finalSlotId = slotId === 'custom' ? customSlotId.trim() : slotId;

        if (editMode === 'signature') {
            if (!signatureKey.trim()) {
                setAlert({ text: 'Error: Please specify a valid signature key filename (e.g. detail-signature.png)', type: 'error' });
                return;
            }

            setAlert({ text: 'Processing capture and cropping region...', type: 'info' });

            try {
                const resultMsg = await invoke<string>('save_cropped_signature', {
                    client,
                    resolution,
                    screen,
                    signatureKey: signatureKey.trim(),
                    x: pctX,
                    y: pctY,
                    w: pctW,
                    h: pctH
                });

                setAlert({ text: resultMsg, type: 'success' });
                setTimeout(() => {
                    setAlert(null);
                }, 4500);
            } catch (error: any) {
                setAlert({ text: `Failed: ${error || 'Unknown error occurred.'}`, type: 'error' });
            }
        } else {
            if (!finalSlotId) {
                setAlert({ text: 'Error: Please specify a valid Slot ID.', type: 'error' });
                return;
            }

            setAlert({ text: `Updating OCR region for Slot ID '${finalSlotId}'...`, type: 'info' });

            try {
                const resultMsg = await invoke<string>('update_ocr_zone', {
                    client,
                    resolution,
                    screen,
                    slotId: finalSlotId,
                    x: pctX,
                    y: pctY,
                    w: pctW,
                    h: pctH
                });

                setAlert({ text: resultMsg, type: 'success' });
                setTimeout(() => {
                    setAlert(null);
                }, 4500);
            } catch (error: any) {
                setAlert({ text: `Failed: ${error || 'Unknown error occurred.'}`, type: 'error' });
            }
        }
    };

    return (
        <main
            className="selector-view"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            ref={localContainerRef}
            style={{
                width: '100vw',
                height: '100vh',
                position: 'relative',
                background: 'rgba(0, 0, 0, 0.15)',
                cursor: 'crosshair',
                overflow: 'hidden',
                userSelect: 'none',
                boxSizing: 'border-box'
            }}
        >
            {/* 👑 Glassmorphic Premium Editor Header Panel */}
            {!isDragging && (
                <div
                    className="profile-editor-control-panel"
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
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
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Profile Editor</span>
                    </div>
                    <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.35)', fontWeight: 'bold' }}>DRAG BOX TO SCAN</span>
                </div>

                {/* Vertical Divider */}
                <div style={{ width: '1px', height: '32px', backgroundColor: 'rgba(255,255,255,0.08)' }}></div>

                {/* 0. Edit Mode Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>EDIT MODE</label>
                    <select
                        value={editMode}
                        onChange={(e) => setEditMode(e.target.value as 'signature' | 'ocr')}
                        style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '11px',
                            padding: '4px 8px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="signature">📷 Signature</option>
                        <option value="ocr">🔍 OCR Zone</option>
                    </select>
                </div>

                {/* 1. Client Type Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>CLIENT TYPE</label>
                    <select
                        value={client}
                        onChange={(e) => setClient(e.target.value)}
                        style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '11px',
                            padding: '4px 8px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="default">Default / Generic</option>
                        <option value="ldplayer">LDPlayer</option>
                        <option value="bluestacks">BlueStacks</option>
                        <option value="mumu">MuMu Player</option>
                        <option value="pc_client">PC Client</option>
                    </select>
                </div>

                {/* 2. Resolution Bucket Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>RESOLUTION RANGE</label>
                        <span style={{ fontSize: '7.5px', background: 'rgba(0, 242, 254, 0.15)', color: '#00f2fe', padding: '0px 4px', borderRadius: '3px', fontWeight: 'bold', border: '1px solid rgba(0, 242, 254, 0.2)' }}>AUTO</span>
                    </div>
                    <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '11px',
                            padding: '4px 8px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="default">Default (All sizes)</option>
                        <option value="1280x720">1280 x 720</option>
                        <option value="1600x900">1600 x 900</option>
                        <option value="1920x1080">1920 x 1080</option>
                    </select>
                </div>

                {/* 3. Screen Type Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>TARGET SCREEN</label>
                    <select
                        value={screen}
                        onChange={(e) => setScreen(e.target.value)}
                        style={{
                            background: 'rgba(0, 0, 0, 0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '11px',
                            padding: '4px 8px',
                            outline: 'none',
                            cursor: 'pointer'
                        }}
                    >
                        <option value="Hero_Detail">Hero_Detail</option>
                        <option value="Hero_Stats">Hero_Stats</option>
                        <option value="Lobby">Lobby</option>
                        <option value="Arena_Lobby">Arena_Lobby</option>
                        <option value="Preban">Preban</option>
                        <option value="Ban_Pick">Ban_Pick</option>
                    </select>
                </div>

                {/* 4. Dynamic Input swap based on Edit Mode */}
                {editMode === 'signature' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>SIGNATURE KEY NAME</label>
                        <input
                            type="text"
                            value={signatureKey}
                            onChange={(e) => setSignatureKey(e.target.value)}
                            placeholder="e.g. detail-signature.png"
                            style={{
                                background: 'rgba(0, 0, 0, 0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                                color: '#fff',
                                fontSize: '11px',
                                padding: '4px 8px',
                                width: '160px',
                                outline: 'none'
                            }}
                        />
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>OCR SLOT ID</label>
                            <select
                                value={slotId}
                                onChange={(e) => setSlotId(e.target.value)}
                                style={{
                                    background: 'rgba(0, 0, 0, 0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '11px',
                                    padding: '4px 8px',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="selected_hero">selected_hero</option>
                                <option value="hero_stats_panel">hero_stats_panel</option>
                                <option value="my_pick_1">my_pick_1</option>
                                <option value="my_pick_2">my_pick_2</option>
                                <option value="my_pick_3">my_pick_3</option>
                                <option value="my_pick_4">my_pick_4</option>
                                <option value="my_pick_5">my_pick_5</option>
                                <option value="enemy_pick_1">enemy_pick_1</option>
                                <option value="enemy_pick_2">enemy_pick_2</option>
                                <option value="enemy_pick_3">enemy_pick_3</option>
                                <option value="enemy_pick_4">enemy_pick_4</option>
                                <option value="enemy_pick_5">enemy_pick_5</option>
                                <option value="my_ban_1">my_ban_1</option>
                                <option value="my_ban_2">my_ban_2</option>
                                <option value="enemy_ban_1">enemy_ban_1</option>
                                <option value="enemy_ban_2">enemy_ban_2</option>
                                <option value="custom">Custom Slot ID...</option>
                            </select>
                        </div>

                        {slotId === 'custom' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>CUSTOM SLOT ID</label>
                                <input
                                    type="text"
                                    value={customSlotId}
                                    onChange={(e) => setCustomSlotId(e.target.value)}
                                    placeholder="e.g. custom_slot_1"
                                    style={{
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '6px',
                                        color: '#fff',
                                        fontSize: '11px',
                                        padding: '4px 8px',
                                        width: '120px',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
            )}

            {/* 💬 Status alert notification popup */}
            {alert && (
                <div
                    style={{
                        position: 'absolute',
                        top: '90px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 99999,
                        padding: '10px 18px',
                        borderRadius: '8px',
                        fontSize: '11.5px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        fontFamily: "'Outfit', sans-serif",
                        transition: 'all 0.3s ease',
                        animation: 'fadeIn 0.2s ease-out',
                        background: alert.type === 'success' ? 'rgba(16, 185, 129, 0.95)' : alert.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(0, 229, 255, 0.95)',
                        color: '#fff',
                        border: `1px solid ${alert.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : alert.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 229, 255, 0.2)'}`
                    }}
                >
                    <span>{alert.type === 'success' ? '✅' : alert.type === 'error' ? '❌' : '⚡'}</span>
                    <span>{alert.text}</span>
                </div>
            )}

            {/* Selection Guideline label in center (shown only when not dragging) */}
            {!isDragging && (dragRect.w === 0) && (
                <div
                    className="selection-guide"
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        background: 'rgba(0,0,0,0.4)',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span className="selection-guide-dot" style={{ width: '8px', height: '8px', backgroundColor: '#00f2fe', borderRadius: '50%', display: 'inline-block', animation: 'ocr-pulse 1s infinite alternate' }}></span>
                    Drag box over a screen visual signature to capture and update profile coordinates.
                </div>
            )}

            {/* 🟦 The active Dragging Rectangle */}
            {(dragRect.w > 0 || dragRect.h > 0) && (
                <div
                    className="selection-rect"
                    style={{
                        position: 'absolute',
                        left: dragRect.x,
                        top: dragRect.y,
                        width: dragRect.w,
                        height: dragRect.h,
                        border: '2px solid #00f2fe',
                        background: 'rgba(0, 242, 254, 0.08)',
                        boxShadow: '0 0 12px rgba(0, 242, 254, 0.4)',
                        pointerEvents: 'none'
                    }}
                >
                    <div
                        className="selection-label"
                        style={{
                            position: 'absolute',
                            bottom: '-24px',
                            left: '0',
                            background: '#00f2fe',
                            color: '#000',
                            fontSize: '9.5px',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                            fontFamily: 'monospace'
                        }}
                    >
                        x: {((dragRect.x / (localContainerRef.current?.clientWidth || 1)) * 100).toFixed(1)}%
                        {" "}y: {((dragRect.y / (localContainerRef.current?.clientHeight || 1)) * 100).toFixed(1)}%
                        {" "}w: {((dragRect.w / (localContainerRef.current?.clientWidth || 1)) * 100).toFixed(1)}%
                        {" "}h: {((dragRect.h / (localContainerRef.current?.clientHeight || 1)) * 100).toFixed(1)}%
                    </div>
                </div>
            )}

            {/* 📍 Current configured detection zone (Red dashed rectangle) */}
            {currentZone && (
                <div
                    style={{
                        position: 'absolute',
                        left: `${currentZone.x}%`,
                        top: `${currentZone.y}%`,
                        width: `${currentZone.w}%`,
                        height: `${currentZone.h}%`,
                        border: '2px dashed rgba(239, 68, 68, 0.85)',
                        boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
                        pointerEvents: 'none',
                        zIndex: 999
                    }}
                >
                    <span
                        style={{
                            position: 'absolute',
                            top: '-18px',
                            left: '2px',
                            background: 'rgba(239, 68, 68, 0.85)',
                            color: '#fff',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            whiteSpace: 'nowrap',
                            fontFamily: "'Outfit', sans-serif"
                        }}
                    >
                        CURRENT {editMode.toUpperCase()} ZONE
                    </span>
                </div>
            )}

            {/* Animation styling block */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translate(-50%, -10px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
            `}</style>
        </main>
    );
};
