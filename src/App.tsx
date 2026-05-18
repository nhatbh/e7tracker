import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import "./App.css";

import { BuildAssist, ProcessedBuildData } from "./services/buildAssist";
import { CombatData, HeroAnalysis, MetagameData, MetagameHero } from "./services/combatData";
import { ControlsView, WindowInfo } from "./components/ControlsView";
import { SelectorView } from "./components/SelectorView";
import { OverlayView, FrameResult } from "./components/OverlayView";
import { LogsView } from "./components/LogsView";
import { HeroDetailsView } from "./components/HeroDetailsView";


function App() {
    const { t } = useTranslation();
    const [windowLabel, setWindowLabel] = useState<string>("");
    const [windows, setWindows] = useState<WindowInfo[]>([]);
    const [selectedHwnd, setSelectedHwnd] = useState<number | null>(null);
    const [isTracking, setIsTracking] = useState(false);

    // Selector state
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [currentRect, setCurrentRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Overlay state
    const [frameResult, setFrameResult] = useState<FrameResult | null>(null);

    // BuildAssist state
    const [buildData, setBuildData] = useState<{ heroName: string, data: ProcessedBuildData } | null>(null);
    const [isFetchingBuild, setIsFetchingBuild] = useState(false);
    const [activeBuildSource, setActiveBuildSource] = useState<'avg' | 'set1' | 'set2' | 'set3' | 'pro' | 'pro_set1' | 'pro_set2' | 'pro_set3'>('avg');
    const [cacheWipedMsg, setCacheWipedMsg] = useState(false);

    // Detailed Hero View state
    const [showHeroDetails, setShowHeroDetails] = useState(false);
    const [detailedHeroName, setDetailedHeroName] = useState<string>("");
    const [combatAnalysis, setCombatAnalysis] = useState<HeroAnalysis | null>(null);
    const [metagameHero, setMetagameHero] = useState<MetagameHero | null>(null);
    const [isHidingForOCR, setIsHidingForOCR] = useState(false);
    const [isAppLoaded, setIsAppLoaded] = useState(false);

    useEffect(() => {
        const handleOCRChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            setIsHidingForOCR(customEvent.detail.active);
        };
        window.addEventListener("ocr-state-change", handleOCRChange);
        return () => window.removeEventListener("ocr-state-change", handleOCRChange);
    }, []);


    // We need a ref to the latest frameResult to use in the event listener
    const frameResultRef = useRef<FrameResult | null>(null);
    useEffect(() => {
        frameResultRef.current = frameResult;
    }, [frameResult]);

    const buildDataRef = useRef(buildData);
    useEffect(() => {
        buildDataRef.current = buildData;
    }, [buildData]);

    const showHeroDetailsRef = useRef(showHeroDetails);
    useEffect(() => {
        showHeroDetailsRef.current = showHeroDetails;
    }, [showHeroDetails]);

    const detailedHeroNameRef = useRef(detailedHeroName);
    useEffect(() => {
        detailedHeroNameRef.current = detailedHeroName;
    }, [detailedHeroName]);

    const lastHeroNameRef = useRef<string | null>(null);


    // Automatically monitor OCR value changes when on Hero_Stats screen
    useEffect(() => {
        // If the interactive dashboard is currently open, DO NOT let background OCR tracking alter the displayed hero's build data!
        if (showHeroDetails) return;

        if (!frameResult) return;

        if (frameResult.screen_name === "Hero_Stats") {
            const rawHeroName = frameResult.detections?.find(d => d.slot_id === "selected_hero" && d.hero_name)?.hero_name || null;
            const heroName = rawHeroName ? BuildAssist.matchHeroName(rawHeroName) : null;

            if (heroName !== lastHeroNameRef.current) {
                lastHeroNameRef.current = heroName;

                if (heroName) {
                    const cached = BuildAssist.getBuildsFromCache(heroName);
                    if (cached) {
                        setBuildData({ heroName, data: cached });
                        invoke("log_frontend_info", { msg: `[App] Cache HIT for hero: ${heroName}. Displaying immediately.` }).catch(() => { });
                    } else {
                        setBuildData(null);
                        invoke("log_frontend_info", { msg: `[App] Cache MISS for hero: ${heroName}. Displaying fetch prompt.` }).catch(() => { });
                    }

                    // Background load combat analysis and metagame data
                    Promise.all([
                        CombatData.getHeroAnalysis(heroName),
                        MetagameData.getHeroMetagame(heroName)
                    ]).then(([analysis, meta]) => {
                        if (lastHeroNameRef.current === heroName) {
                            setCombatAnalysis(analysis ? JSON.parse(JSON.stringify(analysis)) : null);
                            setMetagameHero(meta);
                        }
                    }).catch((err) => {
                        console.error("[App] Background load combat data failed:", err);
                    });
                } else {
                    setBuildData(null);
                    setCombatAnalysis(null);
                    setMetagameHero(null);
                }
            }
        } else {
            // Not on Hero_Stats screen, reset tracking refs & state
            if (lastHeroNameRef.current !== null) {
                lastHeroNameRef.current = null;
                setBuildData(null);
                setCombatAnalysis(null);
                setMetagameHero(null);
            }
        }
    }, [frameResult, showHeroDetails]);

    useEffect(() => {
        const queryParams = new URLSearchParams(window.location.search);
        const forceLabel = queryParams.get("label");
        let label = forceLabel || "";
        
        if (!label) {
            try {
                label = getCurrentWindow().label;
            } catch (e) {
                console.warn("Not running in Tauri context, no window label.", e);
            }
        }
        setWindowLabel(label);

        if (label === "controls") {
            refreshWindows().catch(() => {});
        }

        // Query initially tracked window state from backend
        const checkInitialTrackedWindow = async () => {
            try {
                const hwnd = await invoke<number | null>("get_tracked_window");
                if (hwnd !== null) {
                    setSelectedHwnd(hwnd);
                    setIsTracking(true);
                }
            } catch (e) {
                console.error("Failed to query initial tracked window:", e);
            }
        };
        checkInitialTrackedWindow();

        // Control window show flow to completely prevent native gray flashes
        const revealWindow = async () => {
            if (label === "controls") {
                setTimeout(async () => {
                    try {
                        await getCurrentWindow().show();
                        setIsAppLoaded(true);
                    } catch (e) {
                        console.error(e);
                        setIsAppLoaded(true);
                    }
                }, 250);
            } else {
                setIsAppLoaded(true);
            }
        };
        revealWindow();

        // --- Register auto-track listeners in ALL windows so their states are in sync! ---
        const unlistenAutoTrack = listen<WindowInfo>("auto-tracked-window", (event) => {
            setSelectedHwnd(event.payload.hwnd);
            setIsTracking(true);
        });

        const unlistenLostTrack = listen("tracked-window-lost", () => {
            setSelectedHwnd(null);
            setIsTracking(false);
        });

        // Initialize sub-window listeners
        let unlistenResult: Promise<any> | null = null;
        let unlistenBuild: Promise<any> | null = null;
        let unlistenToggle: Promise<any> | null = null;
        let unlistenHeroDetails: Promise<any> | null = null;

        if (label === "main") {
            // Overlay is always click-through
            getCurrentWindow().setIgnoreCursorEvents(true);

            BuildAssist.init().catch(console.error);
            CombatData.init().catch(console.error);
            MetagameData.init().catch(console.error);

            unlistenResult = listen<FrameResult>("detection-result", (event) => {
                setFrameResult(event.payload);
            });

            unlistenBuild = listen("fetch-build-data", async () => {
                const latestFrame = frameResultRef.current;
                invoke("log_frontend_info", { msg: `[App] Received fetch-build-data event.` }).catch(() => { });

                if (latestFrame?.screen_name !== "Hero_Stats") {
                    invoke("log_frontend_info", { msg: `[App] Not on Hero_Stats screen, ignoring Alt+B` }).catch(() => { });
                    return;
                }

                const rawHeroName = latestFrame?.detections?.find(d => d.slot_id === "selected_hero" && d.hero_name)?.hero_name;
                const heroName = rawHeroName ? BuildAssist.matchHeroName(rawHeroName) : null;
                if (!heroName) {
                    invoke("log_frontend_info", { msg: `[App] No hero matched by OCR, cannot fetch.` }).catch(() => { });
                    return;
                }

                invoke("log_frontend_info", { msg: `[App] Alt+B pressed. Fetching build data from API for: ${heroName}` }).catch(() => { });
                setIsFetchingBuild(true);
                const [data, analysis, meta] = await Promise.all([
                    BuildAssist.getBuilds(heroName),
                    CombatData.getHeroAnalysis(heroName),
                    MetagameData.getHeroMetagame(heroName)
                ]);
                if (data) {
                    setBuildData({ heroName, data });
                    setCombatAnalysis(analysis ? JSON.parse(JSON.stringify(analysis)) : null);
                    setMetagameHero(meta);
                    setActiveBuildSource('avg');
                } else {
                    console.error("[App] Failed to fetch build data for", heroName);
                }
                setIsFetchingBuild(false);
            });

            unlistenToggle = listen("toggle-build-source", () => {
                invoke("log_frontend_info", { msg: `[App] Received toggle-build-source event.` }).catch(() => { });
                const currentBuild = buildDataRef.current;
                if (!currentBuild) return;

                const setStats = currentBuild.data.setStats || [];
                const hasSet1 = setStats.length > 0;
                const hasSet2 = setStats.length > 1;
                const hasSet3 = setStats.length > 2;

                const proStats = currentBuild.data.proStats;
                const hasPro = !!proStats;
                const proSetStats = proStats?.setStats || [];
                const hasProSet1 = proSetStats.length > 0;
                const hasProSet2 = proSetStats.length > 1;
                const hasProSet3 = proSetStats.length > 2;

                setActiveBuildSource((prev) => {
                    if (prev === 'avg') {
                        return hasSet1 ? 'set1' : (hasPro ? 'pro' : 'avg');
                    }
                    if (prev === 'set1') {
                        return hasSet2 ? 'set2' : (hasPro ? 'pro' : 'avg');
                    }
                    if (prev === 'set2') {
                        return hasSet3 ? 'set3' : (hasPro ? 'pro' : 'avg');
                    }
                    if (prev === 'set3') {
                        return hasPro ? 'pro' : 'avg';
                    }
                    if (prev === 'pro') {
                        return hasProSet1 ? 'pro_set1' : 'avg';
                    }
                    if (prev === 'pro_set1') {
                        return hasProSet2 ? 'pro_set2' : 'avg';
                    }
                    if (prev === 'pro_set2') {
                        return hasProSet3 ? 'pro_set3' : 'avg';
                    }
                    return 'avg';
                });
            });

            unlistenHeroDetails = listen("toggle-hero-details", async () => {
                invoke("log_frontend_info", { msg: `[App] Received toggle-hero-details event.` }).catch(() => { });
                const currentShow = showHeroDetailsRef.current;
                
                if (currentShow) {
                    setShowHeroDetails(false);
                    await invoke("set_overlay_mode", { mode: "Display" });
                    await getCurrentWindow().setIgnoreCursorEvents(true);
                    invoke("log_frontend_info", { msg: `[App] Interactive dashboard closed. Capturing resumed and click-through restored.` }).catch(() => { });
                } else {
                    const latestFrame = frameResultRef.current;
                    if (latestFrame?.screen_name !== "Hero_Stats") {
                        invoke("log_frontend_info", { msg: `[App] Cannot open dashboard: not on Hero_Stats screen.` }).catch(() => { });
                        return;
                    }

                    const rawHeroName = latestFrame?.detections?.find(d => d.slot_id === "selected_hero" && d.hero_name)?.hero_name;
                    const heroName = rawHeroName ? BuildAssist.matchHeroName(rawHeroName) : null;
                    if (!heroName) {
                        invoke("log_frontend_info", { msg: `[App] Cannot open dashboard: no hero detected.` }).catch(() => { });
                        return;
                    }

                    const currentBuild = buildDataRef.current;
                    if (!currentBuild || currentBuild.heroName !== heroName || !currentBuild.data) {
                        invoke("log_frontend_info", { msg: `[App] Cannot open dashboard: build data for ${heroName} is not loaded.` }).catch(() => { });
                        return;
                    }

                    // Process combat analysis and metagame data outside dashboard and copy in when triggered by keybind
                    const [analysis, meta] = await Promise.all([
                        CombatData.getHeroAnalysis(heroName),
                        MetagameData.getHeroMetagame(heroName)
                    ]);
                    setCombatAnalysis(analysis ? JSON.parse(JSON.stringify(analysis)) : null);
                    setMetagameHero(meta);

                    setDetailedHeroName(heroName);
                    setShowHeroDetails(true);
                    await invoke("set_overlay_mode", { mode: "HeroDetails" });
                    await getCurrentWindow().setIgnoreCursorEvents(false);
                    invoke("log_frontend_info", { msg: `[App] Interactive dashboard opened for hero: ${heroName}. Capturing paused and click-through disabled.` }).catch(() => { });
                }
            });
        }

        return () => {
            unlistenAutoTrack.then((f) => f());
            unlistenLostTrack.then((f) => f());
            if (unlistenResult) unlistenResult.then((f) => f());
            if (unlistenBuild) unlistenBuild.then((f) => f());
            if (unlistenToggle) unlistenToggle.then((f) => f());
            if (unlistenHeroDetails) unlistenHeroDetails.then((f) => f());
        };
    }, []);

    const refreshWindows = async () => {
        const winList = await invoke<WindowInfo[]>("get_windows");
        setWindows(winList.sort((a, b) => a.title.localeCompare(b.title)));
    };

    const startTracking = async () => {
        if (selectedHwnd !== null) {
            await invoke("set_tracked_window", { hwnd: selectedHwnd });
            setIsTracking(true);
        }
    };

    const handleWipeCache = async () => {
        try {
            await invoke("cache_clear");
        } catch (e) {
            console.error("[App] Failed to clear native cache:", e);
        }
        setBuildData(null);
        setCacheWipedMsg(true);
        setTimeout(() => setCacheWipedMsg(false), 2000);
        invoke("log_frontend_info", { msg: "[App] Cache wiped successfully by user. Immediately re-initializing hero and artifact databases..." }).catch(() => {});
        
        try {
            await BuildAssist.init();
            invoke("log_frontend_info", { msg: "[App] Hero and artifact databases successfully re-fetched and cached after wipe." }).catch(() => {});
        } catch (e) {
            invoke("log_frontend_error", { msg: `[App] Failed to re-fetch static databases: ${String(e)}` }).catch(() => {});
        }
    };

    const handleCloseHeroDetails = async () => {
        setShowHeroDetails(false);
        await invoke("set_overlay_mode", { mode: "Display" });
        await getCurrentWindow().setIgnoreCursorEvents(true);
        invoke("log_frontend_info", { msg: `[App] Interactive dashboard manually closed. Capturing resumed and click-through restored.` }).catch(() => { });
    };

    const handleHeroChange = async (newHeroName: string) => {
        setDetailedHeroName(newHeroName);
        setIsFetchingBuild(true);

        // Fetch combat analysis and metagame data outside dashboard and copy in
        const [analysis, meta] = await Promise.all([
            CombatData.getHeroAnalysis(newHeroName),
            MetagameData.getHeroMetagame(newHeroName)
        ]);
        setCombatAnalysis(analysis ? JSON.parse(JSON.stringify(analysis)) : null);
        setMetagameHero(meta);

        const data = await BuildAssist.getBuilds(newHeroName);
        if (data) {
            setBuildData({ heroName: newHeroName, data });
            setActiveBuildSource('avg');
        }
        setIsFetchingBuild(false);
    };

    // Selection handlers (for the selector window only)
    const handleMouseDown = (e: React.MouseEvent) => {

        setIsDragging(true);
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setStartPos({ x, y });
        setCurrentRect({ x, y, w: 0, h: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setCurrentRect({
            x: Math.min(x, startPos.x),
            y: Math.min(y, startPos.y),
            w: Math.abs(x - startPos.x),
            h: Math.abs(y - startPos.y),
        });
    };

    const handleMouseUp = async () => {
        if (!isDragging) return;
        setIsDragging(false);
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect || currentRect.w < 5 || currentRect.h < 5) return;

        const pctX = (currentRect.x / rect.width) * 100;
        const pctY = (currentRect.y / rect.height) * 100;
        const pctW = (currentRect.w / rect.width) * 100;
        const pctH = (currentRect.h / rect.height) * 100;

        await invoke("log_selection", { x: pctX, y: pctY, w: pctW, h: pctH });
    };

    // ── Splash Screen (prevents window gray flashes during initialization) ──
    if (windowLabel === "controls" && !isAppLoaded) {
        return (
            <div style={{
                width: '100vw',
                height: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0d14',
                color: '#fff',
                fontFamily: 'Outfit, sans-serif'
            }}>
                <div style={{
                    width: '36px',
                    height: '36px',
                    border: '3px solid rgba(0, 242, 254, 0.08)',
                    borderTop: '3px solid #00f2fe',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                    marginBottom: '16px'
                }}></div>
                <div style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#00f2fe',
                    textShadow: '0 0 8px rgba(0, 242, 254, 0.4)',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase'
                }}>
                    {t('controls.appInfoName', 'E7Tracker Dashboard')}
                </div>
                <div style={{
                    fontSize: '9px',
                    color: 'rgba(255, 255, 255, 0.3)',
                    marginTop: '6px',
                    letterSpacing: '0.5px'
                }}>
                    {t('controls.loadingSync', 'Synchronizing local data...')}
                </div>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    // ── Controls Window ──
    if (windowLabel === "controls") {
        return (
            <ControlsView
                windows={windows}
                selectedHwnd={selectedHwnd}
                setSelectedHwnd={setSelectedHwnd}
                isTracking={isTracking}
                cacheWipedMsg={cacheWipedMsg}
                refreshWindows={refreshWindows}
                startTracking={startTracking}
                handleWipeCache={handleWipeCache}
            />
        );
    }

    // ── Selector Window (interactive, sits above overlay) ──
    if (windowLabel === "selector") {
        return (
            <SelectorView
                containerRef={containerRef}
                currentRect={currentRect}
                handleMouseDown={handleMouseDown}
                handleMouseMove={handleMouseMove}
                handleMouseUp={handleMouseUp}
            />
        );
    }

    // ── Logs Window ──
    if (windowLabel === "logs") {
        return <LogsView />;
    }

    // ── Overlay Window (always click-through) ──
    return (
        <>
            {showHeroDetails && (
                <div style={{ display: isHidingForOCR ? 'none' : 'block', width: '100vw', height: '100vh' }}>
                    <HeroDetailsView
                        heroName={detailedHeroName}
                        buildData={buildData ? buildData.data : null}
                        combatAnalysis={combatAnalysis}
                        metagameHero={metagameHero}
                        onClose={handleCloseHeroDetails}
                        onHeroChange={handleHeroChange}
                    />
                </div>
            )}
            
            <div style={{ display: (!showHeroDetails || isHidingForOCR) ? 'block' : 'none', width: '100vw', height: '100vh' }}>
                <OverlayView
                    frameResult={frameResult}
                    buildData={buildData}
                    isFetchingBuild={isFetchingBuild}
                    activeBuildSource={activeBuildSource}
                    combatAnalysis={combatAnalysis}
                    metagameHero={metagameHero}
                />
            </div>
        </>
    );
}


export default App;
