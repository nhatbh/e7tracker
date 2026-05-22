# E7Tracker Architecture & Systems Documentation

## Project Overview

**e7tracker** is a desktop application for Epic Seven game players that provides real-time hero statistics tracking, build analysis, and combat analytics. It's built as a Tauri desktop app with a React frontend and Rust backend, featuring AI-based screen detection and OCR capabilities.

### Technology Stack
- **Frontend**: React 19, TypeScript, Vite
- **Desktop Framework**: Tauri 2
- **Backend**: Rust with ONNX for AI models
- **Styling**: Vanilla CSS
- **State Management**: React Context API
- **Caching**: SQLite database
- **Charts**: Recharts
- **Internationalization**: i18next

---

## Architecture Overview

### High-Level Structure

```
e7tracker/
├── e7tracker/                    # Frontend (React/TypeScript)
│   ├── src/
│   │   ├── components/          # React components
│   │   ├── context/             # React Context providers
│   │   ├── domain/              # Domain models & service interfaces
│   │   ├── infrastructure/      # Service implementations
│   │   ├── services/            # Utility services
│   │   ├── i18n/                # Internationalization
│   │   ├── assets/              # Static assets
│   │   ├── App.tsx              # Root component
│   │   └── main.tsx             # Entry point
│   ├── src-tauri/               # Tauri backend (Rust)
│   │   ├── src/
│   │   │   ├── lib.rs           # Main Tauri commands & setup
│   │   │   ├── detection/       # AI detection engine
│   │   │   ├── capture.rs       # Window capture utilities
│   │   │   ├── cache_service.rs # SQLite cache management
│   │   │   └── models.rs        # Rust data models
│   │   └── assets/              # Backend assets (ONNX models, JSON configs)
│   └── public/                  # Static web assets
├── e7ai/                        # AI training (YOLOv8 classifier)
└── epic7-damage-calc/           # Damage calculator module
```

---

## Core Systems

### 1. Window Management System

**Purpose**: Track and manage the Epic Seven game window, handle multiple Tauri windows (overlay, controls, selector).

**Key Components**:
- **WindowService** (`src/infrastructure/services/WindowService.ts`)
  - Tracks the game window HWND (handle)
  - Manages window visibility and focus
  - Emits window change events
  
- **Tauri Backend** (`src-tauri/src/lib.rs`)
  - `get_windows()`: Enumerate all visible windows
  - `set_tracked_window()`: Set which window to track
  - `get_tracked_window()`: Get current tracked window
  - Auto-detection: Searches for "Epic Seven" window every 1.5 seconds if none tracked

**Windows**:
- **main**: Overlay window (transparent, always-on-top)
- **controls**: Control panel window (hidden by default, toggled with Alt+P)
- **selector**: Resolution/screen selector window (toggled with Alt+O)

---

### 2. Client Profile System

**Purpose**: Manage active client profiles for resolution-aware layout calculations. Handles automatic client detection based on window titles and provides layout offsets for UI positioning.

**Key Components**:
- **ClientProfileService** (`src/infrastructure/services/ClientProfileService.ts`)
  - `getProfiles()`: Get all available client profiles
  - `detectClient(windows)`: Auto-detect client by matching window titles
  - `getActiveProfile()`: Get currently active profile
  - `calculateTotalOffsets(width, height)`: Calculate X/Y offsets for a given resolution
  - Syncs with backend via `set_active_client_profile`

- **ClientProfileContext** (`src/context/ClientProfileContext.tsx`)
  - React context provider for client profile management
  - Manages active profile state and auto-detection
  - Listens for backend window tracking events
  - Syncs profile changes to backend

**Auto-Detection Flow**:
```
[App Start] → [Enumerate Windows] → [Match Window Title] → [Activate Profile]
```

**Client Profile Structure**:
- `id`: Unique identifier
- `windowTitlePattern`: Title to match for auto-detection
- `layout`: Resolution-aware layout configuration (offsets and sizes)
- `enabled`: Whether the profile is active for detection

---

### 3. AI Screen Detection System

**Purpose**: Identify which screen the player is currently viewing (Hero Stats, Guild War, Lobby, etc.) using AI classification.

**Architecture**:
```
Game Window Frame
    ↓
[Capture Window] (Rust)
    ↓
[Resize to 448x448] (ONNX input size)
    ↓
[ONNX Screen Classifier Model]
    ↓
[Softmax Classification] → Screen Type (Hero_Stats, Guild_War, Other)
    ↓
[Frontend State Update]
```

**Key Components**:
- **DetectionEngine** (`src-tauri/src/detection/mod.rs`)
  - Loads ONNX model: `assets/onnx/screen-classifier.onnx`
  - `detect_screen()`: Classifies current screen using AI
  - `process_frame()`: Main frame processing pipeline
  - Maps class indices to screen names:
    - 0 → "Guild_War"
    - 1 → "Hero_Stats"
    - 2 → "Other"

- **ScreenDetectionService** (`src/infrastructure/services/ScreenDetectionService.ts`)
  - Frontend wrapper for detection results
  - Parses raw detection results into typed data
  - Manages screen change listeners
  - Tracks current screen state

**Screen Types** (`src/domain/models/DetectionSchema.ts`):
```typescript
enum ScreenType {
  Lobby = "Lobby",
  HeroStats = "Hero_Stats",
  GuildWar = "Guild_War",
  Unknown = "Unknown",
}
```

---

### 4. OCR (Optical Character Recognition) System

**Purpose**: Extract hero names and stats from game screenshots using AI-based OCR.

**Architecture**:
```
Game Window Frame
    ↓
[Crop Zone] (Specific region for hero name or stats)
    ↓
[Convert to Grayscale]
    ↓
[AI OCR Engine] (Tesseract-like or custom model)
    ↓
[Text Extraction] → Hero Name or Stats
    ↓
[Frontend Validation & Matching]
```

**Key Components**:
- **Hero OCR** (`src-tauri/src/detection/hero_ocr.rs`)
  - `detect_hero_by_ocr()`: Extracts hero name from cropped image
  - Returns: (text, confidence)
  - Converts RGB image to grayscale for processing

- **OCRService** (`src/infrastructure/services/OCRService.ts`)
  - `performOCROnSlot()`: Calls backend OCR for specific zone
  - `scanHeroStats()`: Extracts stats from stats panel
  - `identifyHeroName()`: Gets hero name from detection
  - `parseOCRStats()`: Parses OCR text into structured stats
  
- **Detection Slots** (`src/domain/models/DetectionSchema.ts`):
  ```typescript
  enum DetectionSlot {
    SelectedHero = "selected_hero",
    StatsPanel = "hero_stats_panel",
    MenuButton = "menu_button",
  }
  ```

**OCR Zone Configuration**:
- Zones are defined per screen in `DetectionConfig`
- Each zone specifies: x, y, w, h (coordinates and dimensions)
- Frontend passes zones to backend on-demand via `perform_ocr_on_screen` command

**Stats Parsing**:
- Extracts 8 core stats: ATK, DEF, HP, SPD, CHC, CHD, EFF, EFR
- Handles OCR errors (misread characters like 'o' for '0')
- Validates percentage ranges (CHC: 0-100%, CHD: 0-999%, etc.)

---

### 5. Build Profile & Build Assist System

**Purpose**: Fetch, cache, and analyze hero build data from external API; provide build recommendations.

**Key Components**:
- **UserBuildProfileService** (`src/infrastructure/services/UserBuildProfileService.ts`)
  - Manages user-saved build profiles
  - Fetches build data from AWS API: `https://krivpfvxi0.execute-api.us-west-2.amazonaws.com/dev/getBuilds`
  - Implements cache-first pattern with SQLite backend
  - Processes raw build data into aggregated statistics

**Data Processing Pipeline**:
```
API Response (Raw Builds)
    ↓
[Calculate Average Stats] → avg
    ↓
[Calculate Top 3 Sets] → set1, set2, set3
    ↓
[Filter Top 5% by Gear Score]
    ↓
[Calculate Pro Stats] → pro, pro_set1, pro_set2, pro_set3
    ↓
[Cache in SQLite]
    ↓
[Return ProcessedBuildData]
```

**Build Data Structure**:
```typescript
interface ProcessedBuildData {
  averageStats: BuildStats;           // Average of all builds
  setStats: SetStat[];                // Top 3 gear set combinations
  topArtifacts: string[];             // Top 3 artifacts
  proStats: {
    averageStats: BuildStats;         // Average of top 5%
    setStats: SetStat[];              // Top 3 sets in top 5%
    topSets: string[];
  };
  rawBuilds: any[];                   // Raw API response
  cachedAt: number;                   // Cache timestamp
}
```

**Build Sources** (toggled with Alt+T):
- `avg`: Average of all builds
- `set1`, `set2`, `set3`: Top 3 gear sets
- `pro`: Top 5% builds (by gear score)
- `pro_set1`, `pro_set2`, `pro_set3`: Top 3 sets in top 5%

---

### 6. Caching System

**Purpose**: Persistent storage for hero data, build data, and user settings using SQLite.

**Key Components**:
- **CacheService** (`src-tauri/src/cache_service.rs`)
  - SQLite database at: `{app_cache_dir}/cache.db`
  - Tauri commands:
    - `cache_set(key, value)`: Store value
    - `cache_get(key)`: Retrieve value
    - `cache_remove(key)`: Delete value
    - `cache_clear()`: Clear all
    - `cache_get_all()`: Get all entries
    - `is_cache_ready()`: Check if initialized

- **CacheManager** (`src/context/CacheManager.tsx`)
  - React context for cache operations
  - Provides cache access to all components

**Cache Keys**:
- `saved_damage_calc_builds`: User-saved build profiles
- `buildassist_build_{heroName}`: Processed build data per hero
- Hero portrait images
- Combat analytics data

---

### 7. Hero Metadata System

**Purpose**: Manage hero database, match OCR text to actual hero names, provide hero information.

**Key Components**:
- **StaticHeroService** (`src/infrastructure/services/StaticHeroService.ts`)
  - Loads heroes from `assets/heroes.json`
  - `matchHeroName()`: Fuzzy-matches OCR text to hero database
  - Uses string similarity algorithm (>0.7 threshold)

- **Hero Model** (`src/domain/models/Hero.ts`):
  ```typescript
  interface HeroEntry {
    name: string;
    code: string;
    rarity: number;
    // ... other properties
  }
  ```

**Hero Matching Flow**:
```
OCR Text (e.g., "Sigret")
    ↓
[Fuzzy String Matching]
    ↓
[Find Best Match in Database]
    ↓
[Return Matched Hero Name]
```

---

### 8. Combat Analytics System

**Purpose**: Track and analyze combat performance, synergies, and counter-threats.

**Key Components**:
- **CombatAnalyticsService** (`src/infrastructure/services/CombatAnalyticsService.ts`)
  - Fetches combat data from external API
  - Analyzes hero synergies and matchups
  - Tracks win rates and performance metrics

**Data Structures**:
- Combat performance statistics
- Hero synergy data
- Counter-threat analysis
- Draft performance metrics

---

### 9. Metagame System

**Purpose**: Track current meta trends, popular builds, and strategic information.

**Key Components**:
- **MetagameService** (`src/infrastructure/services/MetagameService.ts`)
  - Fetches metagame data
  - Tracks popular heroes and builds
  - Provides strategic insights

---

## Frontend Architecture

### Component Hierarchy

```
App.tsx
├── [main window]
│   └── OverlayServiceProvider
│       └── OverlayView
│           └── HeroStatsOverlays
│               ├── AverageStatsColumn
│               └── BuildStatsOverlay
│
└── [controls window]
    └── ControlsView
        ├── DashboardIdentityCard
        ├── DashboardBuildsTable
        ├── DashboardCombatDetails
        ├── DashboardStatsComparison
        ├── DashboardGearRating
        ├── DashboardLeaderboard
        ├── DashboardDraftPerformance
        ├── DashboardCounterThreats
        ├── DashboardSynergyBans
        ├── HeroDetailsView
        ├── OcrMonitorView
        └── LogsView
```

### Context Providers

All services are provided via React Context:

1. **OverlayServiceProvider**: Consolidated root provider for all services
2. **WindowServiceContext**: Window tracking and management
3. **HeroServiceContext**: Hero metadata and matching
4. **ArtifactServiceContext**: Artifact data
5. **BuildProfileServiceContext**: Build profiles and data
6. **CombatAnalyticsServiceContext**: Combat analytics
7. **MetagameServiceContext**: Metagame data
8. **ScreenDetectionContext**: Screen detection state
9. **OCRContext**: OCR operations
10. **TickerContext**: Periodic updates
11. **KeybindContext**: Keyboard shortcuts
12. **ClientProfileContext**: Active client profile and layout management
13. **CacheManager**: Cache operations
14. **ControlsScreenServiceProvider**: Context provider for the controls window

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt+P | Toggle Controls window |
| Alt+O | Toggle Selection/Display mode |
| Alt+B | Fetch build data |
| Alt+T | Toggle build source (avg → set1 → set2 → pro) |
| Alt+R | Toggle hero details view |
| Alt+S | Scan hero stats |
| Alt+1 to Alt+9 | Select lobby menu items |
| Alt+. | Navigate menu next |
| Alt+, | Navigate menu previous |

---

## Data Flow Diagrams

### Hero Detection Flow

```
[Game Window Visible]
    ↓
[Capture Window Frame] (Rust)
    ↓
[AI Screen Detection] → Detect "Hero_Stats" screen
    ↓
[Frontend Receives Screen Type]
    ↓
[User Presses Alt+S or Manual Trigger]
    ↓
[Frontend Calls perform_ocr_on_screen]
    ↓
[Backend OCR] → Extract hero name
    ↓
[Frontend Fuzzy Match] → Match to hero database
    ↓
[Update UI with Hero Data]
    ↓
[Fetch Build Data] → Get builds from API
    ↓
[Display Build Stats Overlay]
```

### Build Data Flow

```
[User Selects Hero]
    ↓
[Check SQLite Cache]
    ├─ [Cache Hit] → Return cached data
    └─ [Cache Miss] → Fetch from API
        ↓
        [AWS API Request]
        ↓
        [Process Raw Builds]
        ├─ Calculate average stats
        ├─ Calculate top 3 sets
        ├─ Filter top 5% by gear score
        └─ Calculate pro stats
        ↓
        [Cache in SQLite]
        ↓
        [Return ProcessedBuildData]
    ↓
[Display in UI]
    ├─ AverageStatsColumn
    └─ BuildStatsOverlay
```

---

## Service Interfaces (Domain Layer)

### IScreenDetectionService
```typescript
interface IScreenDetectionService {
  getCurrentScreen(): ScreenType;
  onScreenChanged(callback: (screen: ScreenType) => void): () => void;
  getDetectionsForSlot(slot: DetectionSlot): ParsedDetection[];
  isSlotAvailable(slot: DetectionSlot): boolean;
  updateFrameResult(raw: FrameResult): void;
  getLatestFrameResult(): ParsedFrameResult | null;
}
```

### IOCRService
```typescript
interface IOCRService {
  scanHeroStats(): Promise<ParsedStats | null>;
  identifyHeroName(): Promise<string | null>;
  performOCROnSlot(slot: DetectionSlot): Promise<string | null>;
}
```

### IBuildProfileService
```typescript
interface IBuildProfileService {
  getAllProfiles(): Promise<UserBuildProfile[]>;
  getProfileById(id: string): Promise<UserBuildProfile | null>;
  getProfilesByHero(heroName: string): Promise<UserBuildProfile[]>;
  saveProfile(profile: UserBuildProfile): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  getProcessedBuildData(heroName: string): Promise<ProcessedBuildData | null>;
}
```

### IHeroMetadataService
```typescript
interface IHeroMetadataService {
  getAllHeroes(): Promise<HeroEntry[]>;
  getHeroByName(name: string): Promise<HeroEntry | null>;
  matchHeroName(text: string): HeroEntry | null;
}
```

---

## Tauri Commands (Backend API)

### Window Management
- `get_windows()`: Get list of visible windows
- `set_tracked_window(hwnd)`: Set tracked game window
- `get_tracked_window()`: Get current tracked window

### Overlay Control
- `set_overlay_mode(mode)`: Set overlay mode (Display/Selection/HeroDetails)
- `set_active_client_profile(profile)`: Sync active client profile with backend
- `log_selection(x, y, w, h)`: Log selection coordinates

### OCR & Detection
- `perform_ocr_on_screen(zone)`: Perform OCR on specific zone
  - Input: `{ x, y, w, h }` coordinates
  - Output: `{ hero_name, confidence, ... }`

### Caching
- `cache_set(key, value)`: Store in cache
- `cache_get(key)`: Retrieve from cache
- `cache_remove(key)`: Delete from cache
- `cache_clear()`: Clear all cache
- `cache_get_all()`: Get all cache entries
- `is_cache_ready()`: Check cache status

### Data Fetching
- `fetch_combat_data(url)`: Fetch data from URL (native HTTP)
- `get_hero_names()`: Get list of hero names
- `get_or_download_portrait(heroCode)`: Get hero portrait image

### Logging
- `get_rust_logs()`: Get backend logs
- `log_frontend_error(msg)`: Log error from frontend
- `log_frontend_info(msg)`: Log info from frontend

### System
- `is_autostart_enabled()`: Check if app auto-starts
- `set_autostart_enabled(enabled, silent)`: Configure auto-start
- `is_silent_launch()`: Check if launched silently
- `broadcast_settings(settings)`: Broadcast settings changes

---

## Asset Structure

### Backend Assets (`src-tauri/assets/`)
- `heroes.json`: Hero database with names, codes, rarities
- `ocr_zones.json`: OCR zone configurations per screen
- `onnx/screen-classifier.onnx`: AI model for screen classification
- Portrait images: `portraits/{heroCode}.png`

### Frontend Assets (`public/`)
- `app-icon.png`: Application icon
- Localization files (i18n)

---

## State Management

### Global State (React Context)
- Screen detection state
- Current hero selection
- Build data cache
- Window tracking state
- Overlay mode (Display/Selection/HeroDetails)

### Local Component State
- UI visibility toggles
- Form inputs
- Animation states
- Temporary data

---

## Key Algorithms

### String Similarity (Hero Matching)
```
similarity(a, b) = max(
  (a in b) ? len(a) / len(b) : 0,
  (b in a) ? len(b) / len(a) : 0
)
```
- Threshold: > 0.7 for match
- Used for fuzzy matching OCR text to hero names

### Softmax Classification (Screen Detection)
```
softmax(logits) = exp(logit_i) / sum(exp(logit_j))
```
- Applied to ONNX model outputs
- Selects class with highest probability
- Maps to screen type

### Build Statistics Aggregation
```
average_stat = sum(stat_i) / count
top_sets = sort_by_frequency(sets)[0:3]
pro_builds = sort_by_gear_score(builds)[0:top_5_percent]
```

---

## Performance Considerations

1. **OCR Throttling**: Limited to once per second to avoid excessive processing
2. **Screen Detection**: Runs continuously but only logs on changes
3. **Caching**: SQLite cache prevents repeated API calls
4. **Window Capture**: Only captures when window is visible and valid
5. **Auto-Detection**: Searches for Epic Seven window every 1.5 seconds if not tracked

---

## Error Handling

- **Window Not Found**: Auto-detection retries every 1.5 seconds
- **OCR Failure**: Returns null, UI shows watermark
- **API Failure**: Falls back to cache or returns null
- **Cache Corruption**: Detected and re-fetches from API
- **ONNX Model Missing**: Logs error, screen detection disabled

---

## Development Workflow

### Building
```bash
npm run build          # Build frontend + Tauri app
npm run dev            # Dev server with hot reload
npm run tauri dev      # Run Tauri in dev mode
```

### Debugging
- Backend logs: Accessible via `get_rust_logs()` command
- Frontend logs: Browser console (F12)
- OCR Monitor: View OCR results in real-time
- Logs View: Historical log viewer in controls window

---

## Future Extensibility

### Plugin Points
1. **New Screen Types**: Add to `ScreenType` enum and ONNX model
2. **New OCR Slots**: Add to `DetectionSlot` enum and zone configs
3. **New Services**: Implement interface in domain, add to ServiceProvider
4. **New Shortcuts**: Add to Tauri shortcut handlers in `lib.rs`
5. **New Analytics**: Extend CombatAnalyticsService

### Configuration
- Screen definitions: `ocr_zones.json`
- Hero database: `heroes.json`
- AI models: ONNX files in `assets/onnx/`
- Localization: i18n JSON files

---

## Summary

e7tracker is a sophisticated desktop application that combines:
- **Real-time screen detection** using AI/ONNX models
- **OCR-based hero identification** with fuzzy matching
- **Build data aggregation** from external APIs with intelligent caching
- **Multi-window overlay system** for seamless in-game integration
- **Comprehensive analytics** for combat performance and metagame tracking

The architecture follows domain-driven design principles with clear separation between domain models, service interfaces, and implementations, making it maintainable and extensible.
