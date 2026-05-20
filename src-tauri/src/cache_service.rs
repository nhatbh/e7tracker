use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::OnceLock;
use rusqlite::{params, Connection};

pub struct CacheService {
    pub conn: Mutex<Connection>,
}

pub struct CacheState(pub OnceLock<CacheService>);

impl CacheState {
    pub fn get_service(&self) -> Result<&CacheService, String> {
        self.0.get().ok_or_else(|| {
            let err = "[CacheState] Error: Attempted to query cache before CacheService was initialized.".to_string();
            err
        })
    }
}

impl CacheService {
    pub fn new(db_path: PathBuf) -> Self {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        
        let conn = Connection::open(&db_path).expect("Failed to open SQLite database");
        
        // Enable WAL (Write-Ahead Logging) mode for optimized concurrent reads and writes
        let _ = conn.execute("PRAGMA journal_mode=WAL;", []);
        
        let service = Self { conn: Mutex::new(conn) };
        service.init_db().expect("Failed to initialize database tables");
        service
    }

    fn init_db(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();

        // 1. Fallback / generic configuration cache table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS kv_cache (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );",
            [],
        )?;

        // 2. Static global databases table (e.g. hero_data, artifact_data)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS static_data (
                data_type TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );",
            [],
        )?;

        // 3. Hero builds table (segmented by hero name, containing parsed sets/stats)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS hero_builds (
                hero_name TEXT PRIMARY KEY,
                build_data TEXT NOT NULL,
                request_data TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );",
            [],
        )?;

        // 4. Combat analyses table (segmented by hero code, containing win/loss, synergies, matchups)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS combat_analyses (
                hero_code TEXT PRIMARY KEY,
                hero_name TEXT NOT NULL,
                analysis_data TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );",
            [],
        )?;

        // 5. Hero portraits table (stashing base64 data URLs of downloaded portraits to bypass CORS)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS hero_portraits (
                hero_code TEXT PRIMARY KEY,
                portrait_base64 TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );",
            [],
        )?;

        Ok(())
    }
}

#[tauri::command]
pub fn is_cache_ready(state: tauri::State<'_, CacheState>) -> bool {
    let ready = state.0.get().is_some();
    crate::log_message(&format!("[CacheState] is_cache_ready check requested by frontend. Status: {}", ready));
    ready
}

#[tauri::command]
pub fn cache_set(state: tauri::State<'_, CacheState>, key: String, value: String) -> Result<(), String> {
    let service = state.get_service()?;
    // A. Static global databases
    if key == "buildassist_hero_data" {
        let conn = service.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO static_data (data_type, payload, updated_at)
             VALUES ('hero_data', ?1, ?2)
             ON CONFLICT(data_type) DO UPDATE SET payload = ?1, updated_at = ?2;",
            params![value, now],
        ).map_err(|e| e.to_string())?;
        return Ok(());
    }
    
    if key == "buildassist_artifact_data" {
        let conn = service.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO static_data (data_type, payload, updated_at)
             VALUES ('artifact_data', ?1, ?2)
             ON CONFLICT(data_type) DO UPDATE SET payload = ?1, updated_at = ?2;",
            params![value, now],
        ).map_err(|e| e.to_string())?;
        return Ok(());
    }

    // B. Individual Hero Builds
    if key.starts_with("buildassist_build_") {
        let hero_name = &key[18..];
        // Attempt structural decomposition of the payload JSON
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&value) {
            if let (Some(data), Some(timestamp), Some(req_data)) = (
                parsed.get("data"),
                parsed.get("timestamp").and_then(|t| t.as_i64()),
                parsed.get("requestData"),
            ) {
                let conn = service.conn.lock().unwrap();
                conn.execute(
                    "INSERT INTO hero_builds (hero_name, build_data, request_data, updated_at)
                     VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT(hero_name) DO UPDATE SET
                         build_data = ?2,
                         request_data = ?3,
                         updated_at = ?4;",
                    params![hero_name, data.to_string(), req_data.to_string(), timestamp],
                ).map_err(|e| e.to_string())?;
                return Ok(());
            }
        }
        // Fallback for flat structure
        let conn = service.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO hero_builds (hero_name, build_data, request_data, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(hero_name) DO UPDATE SET
                 build_data = ?2,
                 request_data = ?3,
                 updated_at = ?4;",
            params![hero_name, value, "{}", now],
        ).map_err(|e| e.to_string())?;
        return Ok(());
    }

    // C. Segmented Combat Analysis per Character
    if key.starts_with("combat_analysis_") {
        let hero_code = &key[16..];
        let hero_name = if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&value) {
            parsed.get("hero_name")
                .and_then(|n| n.as_str())
                .unwrap_or(hero_code)
                .to_string()
        } else {
            hero_code.to_string()
        };
        let conn = service.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO combat_analyses (hero_code, hero_name, analysis_data, updated_at)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(hero_code) DO UPDATE SET
                 hero_name = ?2,
                 analysis_data = ?3,
                 updated_at = ?4;",
            params![hero_code, hero_name, value, now],
        ).map_err(|e| e.to_string())?;
        return Ok(());
    }

    // D. Generic configuration fallback
    let conn = service.conn.lock().unwrap();
    let now = chrono::Utc::now().timestamp_millis();
    conn.execute(
        "INSERT INTO kv_cache (key, value, updated_at)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ?3;",
        params![key, value, now],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn cache_get(state: tauri::State<'_, CacheState>, key: String) -> Result<Option<String>, String> {
    let service = state.get_service()?;
    // A. Static global databases
    if key == "buildassist_hero_data" {
        let conn = service.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT payload FROM static_data WHERE data_type = 'hero_data'").map_err(|e| e.to_string())?;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let payload: String = row.get(0).map_err(|e| e.to_string())?;
            return Ok(Some(payload));
        }
        return Ok(None);
    }
    
    if key == "buildassist_artifact_data" {
        let conn = service.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT payload FROM static_data WHERE data_type = 'artifact_data'").map_err(|e| e.to_string())?;
        let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let payload: String = row.get(0).map_err(|e| e.to_string())?;
            return Ok(Some(payload));
        }
        return Ok(None);
    }

    // B. Individual Hero Builds
    if key.starts_with("buildassist_build_") {
        let hero_name = &key[18..];
        let conn = service.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT build_data, request_data, updated_at FROM hero_builds WHERE hero_name = ?1"
        ).map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![hero_name]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let build_data: String = row.get(0).map_err(|e| e.to_string())?;
            let request_data: String = row.get(1).map_err(|e| e.to_string())?;
            let updated_at: i64 = row.get(2).map_err(|e| e.to_string())?;
            
            // Reconstruct the exact JSON layout the frontend services expect
            let reconstructed = format!(
                "{{\"data\":{},\"timestamp\":{},\"requestData\":{}}}",
                build_data, updated_at, request_data
            );
            return Ok(Some(reconstructed));
        }
        return Ok(None);
    }

    // C. Segmented Combat Analysis
    if key.starts_with("combat_analysis_") {
        let hero_code = &key[16..];
        let conn = service.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT analysis_data FROM combat_analyses WHERE hero_code = ?1").map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![hero_code]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let analysis_data: String = row.get(0).map_err(|e| e.to_string())?;
            return Ok(Some(analysis_data));
        }
        return Ok(None);
    }

    // D. Generic fallback
    let conn = service.conn.lock().unwrap();
    let mut stmt = conn.prepare("SELECT value FROM kv_cache WHERE key = ?1").map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let value: String = row.get(0).map_err(|e| e.to_string())?;
        return Ok(Some(value));
    }
    Ok(None)
}

#[tauri::command]
pub fn cache_remove(state: tauri::State<'_, CacheState>, key: String) -> Result<(), String> {
    let service = state.get_service()?;
    // A. Static global databases
    if key == "buildassist_hero_data" {
        let conn = service.conn.lock().unwrap();
        conn.execute("DELETE FROM static_data WHERE data_type = 'hero_data';", []).map_err(|e| e.to_string())?;
        return Ok(());
    }
    if key == "buildassist_artifact_data" {
        let conn = service.conn.lock().unwrap();
        conn.execute("DELETE FROM static_data WHERE data_type = 'artifact_data';", []).map_err(|e| e.to_string())?;
        return Ok(());
    }

    // B. Individual Hero Builds
    if key.starts_with("buildassist_build_") {
        let hero_name = &key[18..];
        let conn = service.conn.lock().unwrap();
        conn.execute("DELETE FROM hero_builds WHERE hero_name = ?1;", params![hero_name]).map_err(|e| e.to_string())?;
        return Ok(());
    }

    // C. Segmented Combat Analysis
    if key.starts_with("combat_analysis_") {
        let hero_code = &key[16..];
        let conn = service.conn.lock().unwrap();
        conn.execute("DELETE FROM combat_analyses WHERE hero_code = ?1;", params![hero_code]).map_err(|e| e.to_string())?;
        return Ok(());
    }

    // D. Generic fallback
    let conn = service.conn.lock().unwrap();
    conn.execute("DELETE FROM kv_cache WHERE key = ?1;", params![key]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn cache_clear(state: tauri::State<'_, CacheState>) -> Result<(), String> {
    let service = state.get_service()?;
    let conn = service.conn.lock().unwrap();
    conn.execute("DELETE FROM static_data;", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM hero_builds;", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM combat_analyses;", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM hero_portraits;", []).map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM kv_cache;", []).map_err(|e| e.to_string())?;
    crate::log_message("[CacheService] All SQLite cache tables cleared successfully.");
    Ok(())
}

#[tauri::command]
pub fn cache_get_all(state: tauri::State<'_, CacheState>) -> Result<HashMap<String, String>, String> {
    let service = state.get_service()?;
    let mut map = HashMap::new();
    let conn = service.conn.lock().unwrap();

    // 1. Load static databases
    let mut stmt = conn.prepare("SELECT data_type, payload FROM static_data").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let data_type: String = row.get(0).map_err(|e| e.to_string())?;
        let payload: String = row.get(1).map_err(|e| e.to_string())?;
        let key = match data_type.as_str() {
            "hero_data" => "buildassist_hero_data".to_string(),
            "artifact_data" => "buildassist_artifact_data".to_string(),
            _ => format!("buildassist_{}", data_type),
        };
        map.insert(key, payload);
    }

    // 2. Load hero builds
    let mut stmt = conn.prepare("SELECT hero_name, build_data, request_data, updated_at FROM hero_builds").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let hero_name: String = row.get(0).map_err(|e| e.to_string())?;
        let build_data: String = row.get(1).map_err(|e| e.to_string())?;
        let request_data: String = row.get(2).map_err(|e| e.to_string())?;
        let updated_at: i64 = row.get(3).map_err(|e| e.to_string())?;

        let reconstructed = format!(
            "{{\"data\":{},\"timestamp\":{},\"requestData\":{}}}",
            build_data, updated_at, request_data
        );
        map.insert(format!("buildassist_build_{}", hero_name), reconstructed);
    }

    // 3. Load configurations from generic KV cache
    let mut stmt = conn.prepare("SELECT key, value FROM kv_cache WHERE key LIKE 'buildassist_%'").map_err(|e| e.to_string())?;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let key: String = row.get(0).map_err(|e| e.to_string())?;
        let value: String = row.get(1).map_err(|e| e.to_string())?;
        map.insert(key, value);
    }

    Ok(map)
}

#[tauri::command]
pub async fn get_or_download_portrait(state: tauri::State<'_, CacheState>, hero_code: String) -> Result<String, String> {
    let service = state.get_service()?;
    let code = hero_code.trim().to_lowercase();
    if code.is_empty() {
        return Err("Hero code cannot be empty".to_string());
    }

    // 1. Check local cache first
    {
        let conn = service.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT portrait_base64 FROM hero_portraits WHERE hero_code = ?1").map_err(|e| e.to_string())?;
        let mut rows = stmt.query(params![code]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let base64_str: String = row.get(0).map_err(|e| e.to_string())?;
            return Ok(base64_str);
        }
    }

    // 2. Fetch from slendy.gg
    let url = format!("https://www.slendy.gg/assets/heroes/{}.png", code);
    crate::log_message(&format!("[CacheService] Portrait cache miss for code: {}. Downloading from slendy.gg...", code));

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let response = client.get(&url).send().await.map_err(|e| format!("Failed to download portrait from slendy.gg: {}", e))?;
    if !response.status().is_success() {
        return Err(format!("Failed to retrieve portrait: HTTP {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| format!("Failed to read response bytes: {}", e))?;

    // 3. Convert to base64 Data URL
    use base64::{Engine as _, engine::general_purpose};
    let b64_encoded = general_purpose::STANDARD.encode(&bytes);
    let data_url = format!("data:image/png;base64,{}", b64_encoded);

    // 4. Commit to local SQLite
    {
        let conn = service.conn.lock().unwrap();
        let now = chrono::Utc::now().timestamp_millis();
        conn.execute(
            "INSERT INTO hero_portraits (hero_code, portrait_base64, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(hero_code) DO UPDATE SET portrait_base64 = ?2, updated_at = ?3;",
            params![code, data_url, now],
        ).map_err(|e| e.to_string())?;
    }

    crate::log_message(&format!("[CacheService] Portrait for code {} successfully downloaded and stashed in SQLite.", code));
    Ok(data_url)
}

/// Get list of hero names from cached hero data
#[tauri::command]
pub fn get_hero_names(state: tauri::State<'_, CacheState>) -> Result<Vec<String>, String> {
    let service = state.get_service()?;
    let conn = service.conn.lock().unwrap();
    
    // Try to get hero data from static_data table
    let mut stmt = conn.prepare(
        "SELECT payload FROM static_data WHERE data_type = 'hero_data'"
    ).map_err(|e| format!("[get_hero_names] DB error: {}", e))?;
    
    let mut rows = stmt.query([]).map_err(|e| format!("[get_hero_names] Query error: {}", e))?;
    
    if let Some(row) = rows.next().map_err(|e| format!("[get_hero_names] Row error: {}", e))? {
        let payload: String = row.get(0).map_err(|e| format!("[get_hero_names] Get error: {}", e))?;
        
        // Parse the JSON payload and extract hero names
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&payload) {
            if let Some(heroes) = parsed.as_object() {
                let names: Vec<String> = heroes.keys().cloned().collect();
                crate::log_message(&format!("[get_hero_names] Found {} hero names in cache", names.len()));
                return Ok(names);
            }
        }
    }
    
    // Fallback: try to get from individual hero builds
    let mut stmt = conn.prepare(
        "SELECT DISTINCT hero_name FROM hero_builds"
    ).map_err(|e| format!("[get_hero_names] Fallback query error: {}", e))?;
    
    let mut rows = stmt.query([]).map_err(|e| format!("[get_hero_names] Fallback row error: {}", e))?;
    
    let mut names = Vec::new();
    while let Some(row) = rows.next().map_err(|e| format!("[get_hero_names] Fallback next error: {}", e))? {
        let name: String = row.get(0).map_err(|e| format!("[get_hero_names] Fallback get error: {}", e))?;
        names.push(name);
    }
    
    crate::log_message(&format!("[get_hero_names] Found {} hero names from builds cache", names.len()));
    Ok(names)
}
