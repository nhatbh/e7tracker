import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index';
import './ControlsView.css';

export interface WindowInfo {
    hwnd: number;
    title: string;
}

interface ControlsViewProps {
    windows: WindowInfo[];
    selectedHwnd: number | null;
    setSelectedHwnd: (hwnd: number | null) => void;
    isTracking: boolean;
    cacheWipedMsg: boolean;
    refreshWindows: () => Promise<void>;
    startTracking: () => Promise<void>;
    handleWipeCache: () => Promise<void>;
}

const LANGUAGES = [
    { code: 'en', flag: '🇬🇧', label: 'English' },
    { code: 'vi', flag: '🇻🇳', label: 'Tiếng Việt' },
];

export const ControlsView: React.FC<ControlsViewProps> = ({
    windows,
    selectedHwnd,
    setSelectedHwnd,
    isTracking,
    cacheWipedMsg,
    refreshWindows,
    startTracking,
    handleWipeCache
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'general'>('dashboard');
    const [logs, setLogs] = useState<string[]>([]);
    const [currentLang, setCurrentLang] = useState(i18n.language || 'en');
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Startup Registry Option
    const [startupEnabled, setStartupEnabled] = useState(false);
    const [startupSilent, setStartupSilent] = useState(true);

    // Window Picker Collapsible state (for overriding auto-detect)
    const [showManualPicker, setShowManualPicker] = useState(false);

    // Task Sync Progress State
    const [taskProgress, setTaskProgress] = useState<{
        isFetching: boolean;
        message: string;
        progress: number;
        error: string | null;
    }>({
        isFetching: false,
        message: "Idle",
        progress: 0,
        error: null
    });
    const [hasMetadataCache, setHasMetadataCache] = useState<boolean>(false);

    // 1. Initial startup registry value check
    useEffect(() => {
        const checkStartup = async () => {
            try {
                const [enabled, silent] = await Promise.all([
                    invoke<boolean>("is_autostart_enabled"),
                    invoke<boolean>("is_autostart_silent")
                ]);
                setStartupEnabled(enabled);
                setStartupSilent(silent);
            } catch (e) {
                console.error("Failed to check autostart:", e);
            }
        };
        checkStartup();
    }, []);

    const toggleStartup = async () => {
        try {
            const next = !startupEnabled;
            await invoke("set_autostart_enabled", { enabled: next, silent: startupSilent });
            setStartupEnabled(next);
        } catch (e) {
            console.error("Failed to toggle autostart:", e);
        }
    };

    const toggleStartupSilent = async () => {
        try {
            const next = !startupSilent;
            await invoke("set_autostart_enabled", { enabled: startupEnabled, silent: next });
            setStartupSilent(next);
        } catch (e) {
            console.error("Failed to toggle autostart silent:", e);
        }
    };

    // 2. Listen to background combat database fetch progress
    useEffect(() => {
        let unlistenProgress: (() => void) | null = null;

        const setup = async () => {
            try {
                const unlisten = await listen<any>("combat-fetch-progress", (event) => {
                    setTaskProgress(event.payload);
                });
                unlistenProgress = unlisten;
            } catch (e) {
                console.error("Failed to setup progress listener:", e);
            }
        };

        setup();

        return () => {
            if (unlistenProgress) {
                unlistenProgress();
            }
        };
    }, []);

    // Check if the metadata exists in the disk cache
    const checkMetadataCache = async () => {
        try {
            const cached = await invoke<string | null>("cache_get", { key: "combat_data_metadata" });
            setHasMetadataCache(!!cached);
        } catch (e) {
            console.error("Failed to check metadata cache:", e);
        }
    };

    useEffect(() => {
        checkMetadataCache();
    }, [activeTab]);

    // Fetch Logs
    useEffect(() => {
        if (activeTab !== 'logs') return;

        const fetchLogs = async () => {
            try {
                const fetched = await invoke<string[]>('get_rust_logs');
                setLogs(fetched);
            } catch (e) {
                console.error(e);
            }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 500);
        return () => clearInterval(interval);
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'logs') {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, activeTab]);

    const handleLangChange = (code: string) => {
        i18n.changeLanguage(code);
        setCurrentLang(code);
    };

    // Get currently tracked window title if selectedHwnd is active
    const trackedWindowName = selectedHwnd 
        ? (windows.find(w => w.hwnd === selectedHwnd)?.title || "Epic Seven (Auto-Attached)")
        : null;

    return (
        <main className="container settings-window-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', boxSizing: 'border-box' }}>
            {/* Glassmorphic Tabs Header */}
            <div className="settings-tabs-header">
                <button className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                    <span className="tab-icon">🎯</span>
                    <span className="tab-label">{t('controls.tabDashboard', 'Dashboard')}</span>
                </button>
                <button className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
                    <span className="tab-icon">🖥️</span>
                    <span className="tab-label">{t('controls.tabLogs', 'System Logs')}</span>
                </button>
                <button className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>
                    <span className="tab-icon">⚙️</span>
                    <span className="tab-label">{t('controls.tabGeneral', 'Settings')}</span>
                </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="settings-tab-content" style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* 🎯 Dashboard Tab */}
                {activeTab === 'dashboard' && (
                    <div className="tab-pane-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        
                        {/* 1. Core Status Card */}
                        <div className="dashboard-status-card" style={{
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div className="status-indicator-wrapper" style={{ position: 'relative' }}>
                                    <div className="status-pulse-ring" style={{
                                        position: 'absolute',
                                        width: '14px',
                                        height: '14px',
                                        borderRadius: '50%',
                                        backgroundColor: '#00ff87',
                                        opacity: 0.4,
                                        animation: 'ocr-pulse 1.8s infinite ease-in-out'
                                    }}></div>
                                    <div className="status-dot-core" style={{
                                        width: '14px',
                                        height: '14px',
                                        borderRadius: '50%',
                                        backgroundColor: '#00ff87',
                                        boxShadow: '0 0 8px #00ff87',
                                        zIndex: 2,
                                        position: 'relative'
                                    }}></div>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '13px', color: '#fff', fontWeight: 'bold' }}>E7Tracker Client</h3>
                                    <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>Process status: Active & Scanning</span>
                                </div>
                            </div>
                            <span style={{
                                background: 'rgba(0, 255, 135, 0.1)',
                                border: '1px solid rgba(0, 255, 135, 0.25)',
                                color: '#00ff87',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                            }}>RUNNING</span>
                        </div>

                        {/* 2. Window Tracking Status Card */}
                        <div className="dashboard-status-card" style={{
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="label-text" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Game window tracking
                                </span>
                                {isTracking ? (
                                    <span style={{
                                        color: '#00f2fe',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        <span className="ocr-scanner-dot" style={{ width: '6px', height: '6px', backgroundColor: '#00f2fe', borderRadius: '50%', display: 'inline-block', animation: 'ocr-pulse 1s infinite alternate' }} />
                                        Auto-Attached
                                    </span>
                                ) : (
                                    <span style={{
                                        color: 'rgba(255, 255, 255, 0.35)',
                                        fontSize: '11px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                        <div className="progress-spinner" style={{ width: '8px', height: '8px', border: '1.5px solid rgba(255,255,255,0.15)', borderTop: '1.5px solid rgba(255,255,255,0.5)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                        Searching for Epic Seven window...
                                    </span>
                                )}
                            </div>

                            {isTracking && selectedHwnd ? (
                                <div style={{
                                    background: 'rgba(0, 242, 254, 0.03)',
                                    border: '1px solid rgba(0, 242, 254, 0.1)',
                                    borderRadius: '8px',
                                    padding: '10px 12px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                                            {trackedWindowName}
                                        </span>
                                        <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '10px', fontStyle: 'italic' }}>
                                            HWND: {selectedHwnd}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.04)',
                                    borderRadius: '8px',
                                    padding: '10px 12px',
                                    textAlign: 'center',
                                    color: 'rgba(255, 255, 255, 0.45)',
                                    fontSize: '11.5px',
                                    lineHeight: '1.4'
                                }}>
                                    Launch <strong>Epic Seven</strong> in your emulator (LDPlayer/BlueStacks) or PC client. E7Tracker will detect it and display the overlay automatically!
                                </div>
                            )}

                            {/* Manual Picker Collapsible Trigger */}
                            <div style={{ marginTop: '4px' }}>
                                <button 
                                    onClick={() => {
                                        refreshWindows();
                                        setShowManualPicker(!showManualPicker);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255, 255, 255, 0.4)',
                                        fontSize: '10.5px',
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                    }}
                                >
                                    {showManualPicker ? 'Hide Manual Window Picker' : 'Select Target Window Manually...'}
                                </button>

                                {showManualPicker && (
                                    <div className="window-list-container" style={{
                                        marginTop: '10px',
                                        background: 'rgba(0,0,0,0.15)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '8px',
                                        padding: '8px',
                                        maxHeight: '150px',
                                        display: 'flex',
                                        flexDirection: 'column'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold' }}>ACTIVE SYSTEM WINDOWS</span>
                                            <button className="refresh-btn" onClick={refreshWindows} style={{ fontSize: '9px', padding: '2px 6px' }}>Refresh</button>
                                        </div>
                                        <div className="window-list" style={{ overflowY: 'auto', flex: 1, maxHeight: '110px' }}>
                                            {windows.length === 0 ? (
                                                <div className="no-windows-msg" style={{ fontSize: '10.5px', padding: '10px 0' }}>No open windows found.</div>
                                            ) : (
                                                windows.map((win) => (
                                                    <div 
                                                        key={win.hwnd} 
                                                        className={`window-item ${selectedHwnd === win.hwnd ? 'selected' : ''}`} 
                                                        onClick={async () => {
                                                            setSelectedHwnd(win.hwnd);
                                                            await invoke("set_tracked_window", { hwnd: win.hwnd });
                                                        }}
                                                        style={{ padding: '6px 8px', fontSize: '11px' }}
                                                    >
                                                        <span className="window-title">{win.title}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 3. Background Sync Progress Card */}
                        <div className="dashboard-status-card" style={{
                            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: '12px',
                            padding: '16px'
                        }}>
                            <div className="task-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="task-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span className="task-badge" style={{
                                        display: 'inline-block',
                                        padding: '3px 6px',
                                        borderRadius: '4px',
                                        fontSize: '9px',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase',
                                        backgroundColor: taskProgress.isFetching ? 'rgba(0, 229, 255, 0.12)' : taskProgress.error ? 'rgba(239, 68, 68, 0.12)' : hasMetadataCache ? 'rgba(16, 185, 129, 0.12)' : 'rgba(164, 176, 190, 0.12)',
                                        color: taskProgress.isFetching ? '#00e5ff' : taskProgress.error ? '#f87171' : hasMetadataCache ? '#10b981' : '#a4b0be',
                                        border: `1px solid ${taskProgress.isFetching ? 'rgba(0, 229, 255, 0.25)' : taskProgress.error ? 'rgba(239, 68, 68, 0.25)' : hasMetadataCache ? 'rgba(16, 185, 129, 0.25)' : 'rgba(164, 176, 190, 0.25)'}`
                                    }}>
                                        {taskProgress.isFetching ? "Syncing" : taskProgress.error ? "Failed" : hasMetadataCache ? "Synchronized" : "Ready"}
                                    </span>
                                    <h3 className="task-title" style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>RTA Combat Database</h3>
                                </div>
                                {taskProgress.isFetching && (
                                    <div className="progress-spinner" style={{
                                        width: '12px',
                                        height: '12px',
                                        border: '1.5px solid rgba(0, 229, 255, 0.2)',
                                        borderTop: '1.5px solid #00e5ff',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite'
                                    }}></div>
                                )}
                            </div>

                            <div className="progress-container" style={{ margin: '12px 0 6px 0' }}>
                                <div className="progress-bar-bg" style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                                    <div className="progress-bar-fill" style={{
                                        height: '100%',
                                        width: `${taskProgress.progress || (hasMetadataCache ? 100 : 0)}%`,
                                        background: taskProgress.error ? '#ef4444' : 'linear-gradient(90deg, #00e5ff 0%, #0088ff 100%)',
                                        transition: 'width 0.4s ease',
                                        boxShadow: taskProgress.error ? 'none' : '0 0 8px rgba(0, 229, 255, 0.4)'
                                    }}></div>
                                </div>
                                <div className="progress-meta" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', marginTop: '5px', color: '#a4b0be' }}>
                                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                                        {taskProgress.isFetching ? taskProgress.message : (hasMetadataCache ? 'Local combat database loaded and cached.' : 'Synchronize database to start RTA tracking.')}
                                    </span>
                                    <span style={{ fontWeight: 'bold', color: taskProgress.error ? '#f87171' : '#00e5ff' }}>
                                        {taskProgress.isFetching ? `${taskProgress.progress}%` : (hasMetadataCache ? '100%' : '0%')}
                                    </span>
                                </div>
                            </div>

                            {taskProgress.error && (
                                <div className="task-error-alert" style={{
                                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                    border: '1px solid rgba(239, 68, 68, 0.2)',
                                    color: '#f87171',
                                    borderRadius: '6px',
                                    padding: '8px 10px',
                                    fontSize: '10.5px',
                                    marginTop: '8px'
                                }}>
                                    ❌ {taskProgress.error}
                                </div>
                            )}

                            {!taskProgress.isFetching && (
                                <button
                                    onClick={async () => {
                                        setTaskProgress({
                                            isFetching: true,
                                            message: "Initializing manual sync request...",
                                            progress: 0,
                                            error: null
                                        });
                                        try {
                                            const { CombatData: CD, DEFAULT_COMBAT_DATA_URL } = await import('../services/combatData');
                                            await CD.fetchAndPartitionCombatData(DEFAULT_COMBAT_DATA_URL);
                                            await checkMetadataCache();
                                        } catch (err: any) {
                                            setTaskProgress({
                                                isFetching: false,
                                                error: err.message || String(err),
                                                progress: 0,
                                                message: "Sync failed."
                                            });
                                        }
                                    }}
                                    style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        color: '#fff',
                                        fontWeight: 'normal',
                                        fontSize: '11px',
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        width: '100%',
                                        marginTop: '10px',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                                >
                                    Force Sync/Update RTA Database
                                </button>
                            )}
                        </div>

                    </div>
                )}

                {/* 🖥️ System Logs Tab */}
                {activeTab === 'logs' && (
                    <div className="tab-pane-logs" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexShrink: 0 }}>
                            <h2 className="section-title" style={{ margin: 0 }}>{t('controls.logsTitle')}</h2>
                            <button className="clear-logs-btn" onClick={() => setLogs([])}>{t('controls.clear')}</button>
                        </div>
                        <div className="terminal-logs-window" style={{ flex: 1, overflowY: 'auto' }}>
                            {logs.length === 0 ? (
                                <div className="no-logs-msg">{t('controls.noLogs')}</div>
                            ) : (
                                logs.map((line, i) => {
                                    const isError = /error|warning|failed|could not/i.test(line);
                                    const isSuccess = /loaded|success|detected|hit/i.test(line);
                                    const color = isError ? '#ff6b81' : isSuccess ? '#2ed573' : '#a0c4ff';
                                    return (
                                        <div key={i} className="log-line-item" style={{ color }}>
                                            {line}
                                        </div>
                                    );
                                })
                            )}
                            <div ref={logsEndRef} />
                        </div>
                    </div>
                )}

                {/* ⚙️ General Tab */}
                {activeTab === 'general' && (
                    <div className="tab-pane-general">
                        <h2 className="section-title">{t('controls.tabGeneral', 'General Settings')}</h2>
                        
                        {/* Startup Control switch card */}
                        <div className="settings-group-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <h3 className="group-title">{t('controls.startupConfig', 'Startup Configuration')}</h3>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: 'rgba(255, 255, 255, 0.02)',
                                border: '1px solid rgba(255, 255, 255, 0.04)',
                                borderRadius: '8px',
                                padding: '12px'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '75%' }}>
                                    <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>
                                        {t('controls.startWithWindows', 'Start with Windows')}
                                    </span>
                                    <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>
                                        {t('controls.startWithWindowsDesc', 'Automatically launch the application when your computer boots up.')}
                                    </span>
                                </div>
                                <label className="startup-switch" style={{
                                    position: 'relative',
                                    display: 'inline-block',
                                    width: '38px',
                                    height: '20px'
                                }}>
                                    <input 
                                        type="checkbox" 
                                        checked={startupEnabled}
                                        onChange={toggleStartup}
                                        style={{ opacity: 0, width: 0, height: 0 }}
                                    />
                                    <span className="startup-slider" style={{
                                        position: 'absolute',
                                        cursor: 'pointer',
                                        top: 0, left: 0, right: 0, bottom: 0,
                                        backgroundColor: startupEnabled ? '#00f2fe' : 'rgba(255,255,255,0.15)',
                                        transition: '0.3s',
                                        borderRadius: '20px',
                                        boxShadow: startupEnabled ? '0 0 6px #00f2fe' : 'none'
                                    }}>
                                        <span style={{
                                            position: 'absolute',
                                            content: '""',
                                            height: '14px',
                                            width: '14px',
                                            left: '3px',
                                            bottom: '3px',
                                            backgroundColor: '#fff',
                                            transition: '0.3s',
                                            borderRadius: '50%',
                                            transform: startupEnabled ? 'translateX(18px)' : 'translateX(0)'
                                        }}></span>
                                    </span>
                                </label>
                            </div>

                            {startupEnabled && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: 'rgba(255, 255, 255, 0.01)',
                                    border: '1px solid rgba(255, 255, 255, 0.03)',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    marginTop: '-2px',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '75%' }}>
                                        <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>
                                            {t('controls.startSilently', 'Start Silently in System Tray')}
                                        </span>
                                        <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>
                                            {t('controls.startSilentlyDesc', 'Automatically hide the settings window when the application autostarts.')}
                                        </span>
                                    </div>
                                    <label className="startup-switch" style={{
                                        position: 'relative',
                                        display: 'inline-block',
                                        width: '38px',
                                        height: '20px'
                                    }}>
                                        <input 
                                            type="checkbox" 
                                            checked={startupSilent}
                                            onChange={toggleStartupSilent}
                                            style={{ opacity: 0, width: 0, height: 0 }}
                                        />
                                        <span className="startup-slider" style={{
                                            position: 'absolute',
                                            cursor: 'pointer',
                                            top: 0, left: 0, right: 0, bottom: 0,
                                            backgroundColor: startupSilent ? '#00f2fe' : 'rgba(255,255,255,0.15)',
                                            transition: '0.3s',
                                            borderRadius: '20px',
                                            boxShadow: startupSilent ? '0 0 6px #00f2fe' : 'none'
                                        }}>
                                            <span style={{
                                                position: 'absolute',
                                                content: '""',
                                                height: '14px',
                                                width: '14px',
                                                left: '3px',
                                                bottom: '3px',
                                                backgroundColor: '#fff',
                                                transition: '0.3s',
                                                borderRadius: '50%',
                                                transform: startupSilent ? 'translateX(18px)' : 'translateX(0)'
                                            }}></span>
                                        </span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="settings-group-card">
                            <h3 className="group-title">{t('controls.langSelection', 'Language Selection')}</h3>
                            <div className="lang-selectors-row">
                                {LANGUAGES.map((lang) => (
                                    <button
                                        key={lang.code}
                                        onClick={() => handleLangChange(lang.code)}
                                        className={`lang-btn ${currentLang === lang.code ? 'active' : ''}`}
                                    >
                                        <span className="lang-flag">{lang.flag}</span>
                                        <span className="lang-label">{lang.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="settings-group-card">
                            <h3 className="group-title">{t('controls.globalShortcuts', 'Global Keyboard Shortcuts')}</h3>
                            <div className="shortcuts-list">
                                <div className="shortcut-row">
                                    <kbd className="shortcut-key">Alt + P</kbd>
                                    <span className="shortcut-desc">{t('controls.shortcutMenu')}</span>
                                </div>
                                <div className="shortcut-row">
                                    <kbd className="shortcut-key">Alt + O</kbd>
                                    <span className="shortcut-desc">{t('controls.shortcutSelection')}</span>
                                </div>
                                <div className="shortcut-row">
                                    <kbd className="shortcut-key">Alt + B</kbd>
                                    <span className="shortcut-desc">{t('controls.shortcutFetchDesc', 'Fetch and display builds')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="settings-group-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <h3 className="group-title">{t('controls.cacheOps', 'Cache Operations')}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', maxWidth: '65%', lineHeight: 1.3 }}>
                                    {t('controls.cacheOpsDesc', 'Clear local cache, combat analytics files, and saved hero statistics.')}
                                </span>
                                <button 
                                    onClick={handleWipeCache}
                                    style={{
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        color: '#f87171',
                                        fontSize: '11px',
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'; }}
                                >
                                    {cacheWipedMsg ? t('controls.cacheWiped', 'Wiped!') : t('controls.wipeCacheBtn', 'Wipe Local Cache')}
                                </button>
                            </div>
                        </div>

                        <div className="settings-group-card info-card">
                            <h3 className="group-title">{t('controls.appInfo', 'Application Info')}</h3>
                            <p style={{ margin: '4px 0', fontSize: '12px', color: '#888' }}>{t('controls.appInfoName', 'E7Tracker Dashboard')}</p>
                            <p style={{ margin: '4px 0', fontSize: '11px', color: '#555' }}>{t('controls.appInfoDesc', 'Version 2.2.0 • Running smoothly')}</p>
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
};
