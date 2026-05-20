# 🌌 E7Tracker — Release Notes v0.1.0

> [!NOTE]
> **Version:** `v0.1.0` (Cyber-Combat & Automation Update)  
> **Target Client:** Epic Seven (PC / Emulator)  
> **Technology Stack:** Tauri v2, Rust (Tokio/GDI/OCR), React 19, TypeScript 5.8, SQLite  

Welcome to the **v0.1.0 Cyber-Combat Release** of **E7Tracker**! This major version introduces an elite, 100% mathematically verified **Epic Seven Damage Calculator** directly integrated into the game overlay HUD. Alongside this, we have unlocked advanced Windows-native **OCR Screen Capture**, registry-backed **Silent Boot Autostart**, background **Emulator Auto-Tracking**, and a sleek three-tab **Settings Cockpit Console**.

---

## 🚀 Key Highlights & Major Features

### 1. ⚔️ Pristine ESM Damage Calculator (100% Framework-Free!)
We have successfully decoupled and integrated the community-approved **Epic Seven Damage Calculator** into the desktop `e7tracker` application as a first-class, real-time interactive tab inside the **Hero Details View**.

* **Pristine Library Decoupling**: Rather than manual porting which risks math errors, we engineered an automated Node script (`update_calculator_library.cjs`) that pulls unmodified core services, models, and datasets directly from the community Angular repository. It automatically:
  * Strips framework-specific `@Injectable` decorators.
  * Replaces Angular Router and framework modules with pure ESM TypeScript stubs via a custom `angular_stubs.ts` bridge.
  * Simplifies data constructors and updates dependencies cleanly.
* **Cyber-Combat Glassmorphic Interface**:
  * Toggles instantly between 📊 **Builds & Analytics** and ⚔️ **Damage Calculator** with a gorgeous glowing neon tab bar.
  * Displays dynamic, high-fidelity skill damage cards for all hero abilities, including **Soulburn**, **Extra**, and **Counter** variations.
  * Glow-in-the-dark HSL color-coded cards representing **Critical Hits** (neon cyan), **Normal Hits** (steel gray), **Crushing Hits** (amber gold), and **Misses** (faded ruby).
  * Pre-populates all calculator fields automatically using the selected hero's captured or average stats from the database.
* **Dynamic Form Options Panel**:
  * Automatically inspects active Hero custom fields (`heroSpecific`) and active Artifact properties (`artifactSpecific`) to generate custom slider and toggle selectors on the fly (e.g., Lethe's Omen stacks slider, Abigail's EE switch).
  * Includes a searchable Artifact dropdown, set and buff neon toggles, and target preset tags (**Wyvern**, **Tank**, **Bruiser**, **Squishy**) to theorycraft matchups in one click.
  * Displays **Math Modifier Chips** detailing precise multipliers, Pow, flat scaling, defense penetration %, and aftermath/bleed/burn detonate formulas.

---

### 2. ⚡ Game Client OCR Stats Capture & Auto-Populating
We have implemented high-performance screen scanning to seamlessly bridge your actual in-game characters with the Damage Calculator.

* **Smooth Click-Through Capture Flow**:
  * Clicking the glowing cyan **⚡ CAPTURE GAME STATS** button hides the dashboard overlay instantly (reducing opacity to 0 with a `0.25s` transition).
  * Invokes Tauri's `setIgnoreCursorEvents(true)` to pass mouse click actions directly through to the emulator.
  * Triggers a Rust background thread to perform desktop DC-based capture using precise coordinate-based cropping.
* **Smart Parsing & Normalization**:
  * Scans the 8 core in-game stats based on layout coordinates defined in `screens.json`.
  * Renders scans through a robust TypeScript parser (`parseOCRStats`) that repairs OCR inaccuracies (e.g., correcting text artifacts like `wo` or `0/0` to `%`, adding missing decimals, and enforcing percentage and numeric bounds).
* **Automated SQLite Caching**:
  * Decoded stats are saved to the local SQLite database under `hero_captured_stats_${heroName}`.
  * Automatically reloads your captured stats whenever you open the hero, persisting stats across application launches.

---

### 3. 🛰️ Intelligent Emulator Auto-Tracking & Recovery
E7Tracker is now completely zero-configuration. The application runs actively in the background, listening for the game client.

* **Window Auto-Discovery**:
  * Upgraded the Rust background capture thread to continuously scan active Windows handles for the title `"Epic Seven"`.
  * If found, it automatically connects, maps coordinates, and starts tracking screens instantly!
* **Active Health Checks & Recovery**:
  * Integrates real-time emulator visibility checks using `IsWindowVisible(hwnd)`.
  * If the emulator crashes or is closed, the tracker automatically emits a `tracked-window-lost` event, resets states gracefully, and reverts to passive discovery mode.
* **Multi-Window Event Sync**:
  * Broadcasts window tracking status globally across all Tauri window contexts (Main Overlay, Controls console, manual Selector), preventing state desynchronization.

---

### 4. ⚙️ System Tray Console & Settings Cockpit
We have refactored the original Controls window into a premium cyberpunk cockpit dashboard that fits right into your system tray.

* **Sleek System Tray & Toggle**:
  * Integrates a native system tray icon with a high-performance left-click toggle to show/hide the Controls console instantly.
  * Includes a clean **"Close App"** context menu option that gracefully exits all Toki-managed background Rust loops.
* **Registry-Backed Silent Boot Autostart**:
  * Features native Rust commands (`is_autostart_enabled`, `set_autostart_enabled`) that read and write directly to `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`.
  * Startup window visibility is optimized: the app launches silently on boot, remaining in the system tray until clicked or until the emulator is detected.
* **Three-Tab Cockpit Dashboard**:
  * **Dashboard**: Displays a neon-green pulsing indicator representing E7Tracker status, active emulator handle details (HWND/window name), a manual window picker, and a gradient sync bar for the database cache.
  * **System Logs**: Renders a live, scrolling system console logging all OCR scans, window states, and backend actions in real-time.
  * **Settings**: Offers iOS-style sliders to toggle "Start with Windows", language preferences, global hotkeys references (`Alt+P`, `Alt+O`, `Alt+B`), and a red glassmorphic "Factory Reset" command to safely purge all SQL captured data and cache.

---

### 5. 🎨 UI/UX Polish & Cyberpunk Aesthetics
* **Zero-Flash Cyber Splash**:
  * Custom glassmorphic cyberpunk loading spinner shown while styles and i18n hydrate, entirely eliminating the default gray Tauri window flash.
* **HUD Detailing & Watermark**:
  * Renders a premium, translucent glassmorphic watermark overlay in the bottom-left corner of the in-game overlay showing `e7Tracker`.
  * Keeps safe-scale boundary checks active to warn you if your emulator window resolution drops below or exceeds the optimal 1080p boundary.

---

## 🔬 Mathematical Verification & Code Quality

* **Strict TypeScript Type Safety**:
  * Running `npx tsc --noEmit` returns **zero errors and zero warnings** across the entire project repository.
  * Full compiler check support enabled under strict `"strict": true` tsconfig rules.
* **100% Identity-Level Parity**:
  * Because E7Tracker runs the actual community Angular calculations engine stripped and stubbed into pure ESM TypeScript, mathematical projections match the community calculator down to the exact decimal point.

---

## 📂 Key Architecture Files

| Component / Layer | Relative File Path | Purpose |
| :--- | :--- | :--- |
| **React Wrapper Bridge** | `src/services/damageCalc/damageService.ts` | Feeds React state reactively into imported community Angular calculation classes. |
| **Calculator UI** | `src/components/damageCalc/DamageCalculatorTab.tsx` | Main frontend component for stats sliders, preset buttons, skill output boxes, and custom modifier chips. |
| **Stripper Script** | `scripts/update_calculator_library.cjs` | CommonJS script that automatically parses, stubs, and imports Angular source code into pure ESM classes. |
| **Tauri Integration** | `src-tauri/src/lib.rs` | Houses the GDI-based screen capture thread, tray-icon handlers, registry-based autostart commands, and SQLite integration. |
| **Overlay HUD** | `src/components/OverlayView.tsx` | Translucent overlay panel including stats comparison bars, active build cards, and bottom-left cyberpunk watermark logo. |
| **Cockpit Console** | `src/components/ControlsView.tsx` | Control panel containing Dashboard status lights, scrolling live System Logs, and boot options. |

---

> [!TIP]
> **Getting Started with v0.1.0:**
> 1. Launch `e7tracker`.
> 2. Boot up your emulator running **Epic Seven**.
> 3. E7Tracker will automatically attach and lock onto the window!
> 4. Open a hero, navigate to their Stats page in-game, and press **⚡ CAPTURE GAME STATS** to sync your build instantly!
