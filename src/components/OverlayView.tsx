import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listen } from '@tauri-apps/api/event';
import { BuildAssist, ProcessedBuildData } from '../services/buildAssist';
import { HeroAnalysis, MetagameHero } from '../services/combatData';
import { AverageStatsColumn } from './AverageStatsColumn';
import { BuildStatsOverlay } from './BuildStatsOverlay';
import { ScanStatusOverlay } from './ScanStatusOverlay';
import './OverlayView.css';

export interface Zone {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface DebugZone {
    zone: Zone;
    image_name: string;
    screen_name: string;
    confidence: number;
    threshold: number;
}

export interface FrameResult {
    screen_name: string | null;
    detections: any[];
    debug_zones: DebugZone[];
}

interface OverlayViewProps {
    frameResult: FrameResult | null;
    buildData: { heroName: string; data: ProcessedBuildData } | null;
    isFetchingBuild: boolean;
    activeBuildSource: 'avg' | 'set1' | 'set2' | 'set3' | 'pro' | 'pro_set1' | 'pro_set2' | 'pro_set3';
    combatAnalysis: HeroAnalysis | null;
    metagameHero: MetagameHero | null;
    statsOcrStatus?: 'idle' | 'scanning' | 'timeout' | 'success';
    statsOcrCountdown?: number;
}

const LobbyOverlay: React.FC = () => {
    const { t } = useTranslation();
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [actionNotification, setActionNotification] = useState<string | null>(null);

    const page1Items = [
        {
            name: "Builds",
            fullName: "Hero Build Database",
            key: 1,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
            )
        },
        {
            name: "Drafts",
            fullName: "Draft Position Advisor",
            key: 2,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                </svg>
            )
        },
        {
            name: "Synergy",
            fullName: "Synergy Duo Catalog",
            key: 3,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            )
        },
        {
            name: "Counters",
            fullName: "Counter Threats Analyzer",
            key: 4,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
                    <line x1="13" y1="19" x2="19" y2="13" />
                    <line x1="16" y1="16" x2="20" y2="20" />
                    <line x1="19" y1="21" x2="21" y2="19" />
                </svg>
            )
        }
    ];

    const page2Items = [
        {
            name: "Matchups",
            fullName: "Head-to-Head Matchups",
            key: 1,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                </svg>
            )
        },
        {
            name: "Damage",
            fullName: "Damage Calculator",
            key: 2,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
            )
        },
        {
            name: "Bans",
            fullName: "Banning Patterns Profile",
            key: 3,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
            )
        },
        {
            name: "OCR Setup",
            fullName: "OCR Settings & Calibration",
            key: 4,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
            )
        }
    ];

    const page3Items = [
        {
            name: "Dev Logs",
            fullName: "Developer Console & Logs",
            key: 1,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                </svg>
            )
        },
        {
            name: "Tray Mode",
            fullName: "Tray Minimization System",
            key: 2,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="17" x2="15" y2="17" />
                </svg>
            )
        },
        {
            name: "Autostart",
            fullName: "Autostart Configuration",
            key: 3,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
            )
        },
        {
            name: "Cache DB",
            fullName: "SQLite Cache Management",
            key: 4,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                    <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                </svg>
            )
        }
    ];

    const page4Items = [
        {
            name: "Hardware",
            fullName: "System Hardware Specs",
            key: 1,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <rect x="2" y="2" width="20" height="14" rx="2" ry="2" />
                    <line x1="12" y1="22" x2="12" y2="16" />
                    <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
            )
        },
        {
            name: "HUD Stats",
            fullName: "Real-time Live Stats Overlay",
            key: 2,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
            )
        },
        {
            name: "Theme CSS",
            fullName: "UI Custom Styling Themes",
            key: 3,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                </svg>
            )
        },
        {
            name: "Language",
            fullName: "System Language Preferences",
            key: 4,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
            )
        }
    ];

    const page5Items = [
        {
            name: "API Check",
            fullName: "Network & Backend API Status",
            key: 1,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                    <path d="M8.58 16.14a7 7 0 0 1 6.84 0" />
                    <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
                </svg>
            )
        },
        {
            name: "About App",
            fullName: "App Version Info & Credits",
            key: 2,
            color: "#00e5ff",
            icon: (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 3px rgba(0,229,255,0.4))" }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="3" />
                </svg>
            )
        }
    ];

    const currentItems = 
        currentPage === 1 ? page1Items :
        currentPage === 2 ? page2Items :
        currentPage === 3 ? page3Items :
        currentPage === 4 ? page4Items :
        page5Items;

    useEffect(() => {
        // Listen for keyboard navigation from global shortcuts via Tauri
        // Alt+. and Alt+, acts as pagination triggers!
        const unlistenNavigate = listen<string>("menu-navigate", (event) => {
            const direction = event.payload;
            setCurrentPage((prev) => {
                if (direction === "next") {
                    return prev === 5 ? 1 : prev + 1;
                } else {
                    return prev === 1 ? 5 : prev - 1;
                }
            });
        });

        // Listen for keyboard selection from global shortcuts via Tauri
        const unlistenSelect = listen<number>("menu-item-select", (event) => {
            const num = event.payload; // 1 to 9
            const items = 
                currentPage === 1 ? page1Items :
                currentPage === 2 ? page2Items :
                currentPage === 3 ? page3Items :
                currentPage === 4 ? page4Items :
                page5Items;
            if (num >= 1 && num <= items.length) {
                const idx = num - 1;
                triggerItemAction(items[idx].fullName);
            }
        });

        return () => {
            unlistenNavigate.then((fn) => fn());
            unlistenSelect.then((fn) => fn());
        };
    }, [currentPage]); // Rebind listener on page change

    const triggerItemAction = (name: string) => {
        setActionNotification(`System Activated: ${name}`);
        // Remove notification after 2 seconds
        const timer = setTimeout(() => {
            setActionNotification(null);
        }, 2000);
        return () => clearTimeout(timer);
    };

    return (
        <div className="overlay-lobby-container">
            <div className="lobby-top-bar">
                <div className="lobby-brand">
                    <img src="/app-icon.png" alt="e7Tracker" className="lobby-brand-icon" />
                    <span className="lobby-brand-name">e7Tracker</span>
                </div>
                <div className="lobby-top-nav">
                    <span className="lobby-nav-hint-top">Alt+, / Alt+.</span>
                    <div className="lobby-pagination-top">
                        {[1, 2, 3, 4, 5].map((p) => (
                            <span key={p} className={`lobby-page-dot ${currentPage === p ? "active" : ""}`} />
                        ))}
                    </div>
                </div>
            </div>

            <ul className="lobby-menu-grid">
                {currentItems.map((item) => (
                    <li
                        key={item.key}
                        className="lobby-menu-card"
                        onClick={() => triggerItemAction(item.fullName)}
                    >
                        <div className="lobby-menu-card-icon">
                            {item.icon}
                        </div>
                        <span className="lobby-menu-card-name">{item.name}</span>
                        <span className="lobby-menu-card-keybind">Alt+{item.key}</span>
                    </li>
                ))}
            </ul>

            {actionNotification && (
                <div className="action-notification">
                    {actionNotification}
                </div>
            )}
        </div>
    );
};

export const OverlayView: React.FC<OverlayViewProps> = ({
    frameResult,
    buildData,
    isFetchingBuild,
    activeBuildSource,
    combatAnalysis,
    metagameHero,
    statsOcrStatus = 'idle',
    statsOcrCountdown = 5
}) => {
    const { t } = useTranslation();
    const [winSize, setWinSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    
    // Debug Mode & Coordinate Tickers State
    const [debugMode, setDebugMode] = useState<boolean>(() => {
        return localStorage.getItem('debug_overlay_mode') === 'true';
    });
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0, pctX: 0, pctY: 0 });

    useEffect(() => {
        const handleResize = () => {
            setWinSize({ width: window.innerWidth, height: window.innerHeight });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        localStorage.setItem('debug_overlay_mode', String(debugMode));
    }, [debugMode]);

    useEffect(() => {
        if (!debugMode) return;
        const handleMouseMove = (e: MouseEvent) => {
            const x = e.clientX;
            const y = e.clientY;
            const pctX = (x / window.innerWidth) * 100;
            const pctY = (y / window.innerHeight) * 100;
            setCursorPos({ x, y, pctX, pctY });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [debugMode]);

    const isSafeSize = winSize.width >= 960 && winSize.width <= 1030 && winSize.height >= 540 && winSize.height <= 598;

    return (
        <main className={`overlay-view overlay-view-wrapper ${debugMode ? 'debug-mode-active' : ''}`}>
            {frameResult?.screen_name === "Hero_Stats" && (
                <>
                    {buildData && (
                        <>
                            <div className="overlay-scan-status-container">
                                <ScanStatusOverlay
                                    status={statsOcrStatus}
                                    countdown={statsOcrCountdown}
                                />
                            </div>
                            <div className="overlay-stats-column-container">
                                <AverageStatsColumn
                                    buildData={buildData.data}
                                    activeSource={activeBuildSource}
                                />
                            </div>
                        </>
                    )}
                    <div className="overlay-stats-radar-container">
                        {isFetchingBuild ? (
                            <div className="overlay-message-card">
                                {(() => {
                                    const raw = frameResult?.detections?.find(d => d.slot_id === "selected_hero" && d.hero_name)?.hero_name;
                                    const hero = raw ? (BuildAssist.matchHeroName(raw) || raw) : "Hero";
                                    return t('overlay.loadingBuild', { hero });
                                })()}
                            </div>
                        ) : buildData ? (
                            <BuildStatsOverlay
                                buildData={buildData.data}
                                activeSource={activeBuildSource}
                                combatAnalysis={combatAnalysis}
                                metagameHero={metagameHero}
                            />
                        ) : (
                            <div className="overlay-message-card">
                                {(() => {
                                    const rawHeroName = frameResult?.detections?.find(d => d.slot_id === "selected_hero" && d.hero_name)?.hero_name;
                                    const heroName = rawHeroName ? BuildAssist.matchHeroName(rawHeroName) : null;
                                    return heroName ? (
                                        <>
                                            {t('overlay.noCachedBuilds', { hero: heroName })}
                                            <br />
                                            <span className="overlay-message-fetch-prompt">
                                                {t('overlay.fetchPrompt')}
                                            </span>
                                        </>
                                    ) : (
                                        t('overlay.waitingForDetection')
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </>
            )}
            {frameResult?.screen_name === "Lobby" && (
                <LobbyOverlay />
            )}
            {!isSafeSize && (
                <div className="overlay-scale-indicator unsafe-scale">
                    <div className="warning-row">
                        <span className="warning-icon">⚠️</span>
                        <span className="warning-title">{t('overlay.resolutionWarningTitle')}</span>
                        <span className="current-scale-val">{winSize.width} × {winSize.height}</span>
                    </div>
                    <div className="resize-prompt">
                        {t('overlay.resolutionWarningMessage')}
                    </div>
                </div>
            )}
            
            {frameResult?.screen_name !== "Lobby" && (
                <div className="overlay-watermark">
                    <img src="/app-icon.png" alt="e7Tracker" className="watermark-icon" />
                    <span className="watermark-text">e7Tracker</span>
                </div>
            )}

            {/* ── Calibration & Debug HUD Rulers Layer ── */}
            {debugMode && (
                <>
                    {/* Top Edge Ruler Grid ticks */}
                    <div className="debug-ruler-bar horizontal">
                        {Array.from({ length: Math.ceil(winSize.width / 100) + 1 }).map((_, idx) => {
                            const px = idx * 100;
                            return (
                                <div key={px} className="ruler-tick top-tick" style={{ left: px }}>
                                    <span className="tick-label">{px}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Left Edge Ruler Grid ticks */}
                    <div className="debug-ruler-bar vertical">
                        {Array.from({ length: Math.ceil(winSize.height / 100) + 1 }).map((_, idx) => {
                            const px = idx * 100;
                            return (
                                <div key={px} className="ruler-tick left-tick" style={{ top: px }}>
                                    <span className="tick-label">{px}</span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Dotted Dilation Target Crosshairs */}
                    <div className="debug-ruler-line-h" style={{ top: cursorPos.y }} />
                    <div className="debug-ruler-line-v" style={{ left: cursorPos.x }} />

                    {/* Absolute Neon Position Cursor Ticker Tooltip */}
                    <div 
                        className="debug-cursor-tooltip" 
                        style={{ 
                            left: Math.min(cursorPos.x + 12, winSize.width - 120), 
                            top: Math.min(cursorPos.y + 12, winSize.height - 45) 
                        }}
                    >
                        X: {cursorPos.x}px ({cursorPos.pctX.toFixed(1)}%)<br />
                        Y: {cursorPos.y}px ({cursorPos.pctY.toFixed(1)}%)
                    </div>
                </>
            )}

            {/* Neon Toggler Button positioned in the bottom edge panel */}
            <button
                className={`overlay-debug-toggle-btn ${debugMode ? 'active' : ''}`}
                onClick={() => setDebugMode(prev => !prev)}
                title="Toggle absolute calibration debug overlay"
            >
                🛠️ {debugMode ? 'Debug HUD ON' : 'Debug HUD OFF'}
            </button>
        </main>
    );
};
