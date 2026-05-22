/**
 * Implementation of Artifact Metadata Service
 */

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { ArtifactMetadata } from '../../domain/models/Artifact';
import { IArtifactMetadataService } from '../../domain/services/IArtifactMetadataService';

const ARTIFACT_DATA_URL = "https://e7-optimizer-game-data.s3-accelerate.amazonaws.com/artifactdata.json";
const CACHE_KEY_ARTIFACT = "buildassist_artifact_data";
const CACHE_KEY_TIME = "buildassist_cache_time";

export class StaticArtifactService implements IArtifactMetadataService {
  private artifactData: Record<string, ArtifactMetadata> | null = null;
  private _isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._performInit();
    return this.initPromise;
  }

  private async _performInit(): Promise<void> {
    try {
      const aStr = await invoke<string | null>("cache_get", { key: CACHE_KEY_ARTIFACT });
      if (aStr) {
        this.artifactData = JSON.parse(aStr);
        this._isInitialized = true;
        return;
      }
      await this.refetchArtifactData();
      this._isInitialized = true;
    } catch (e) {
      console.error("[StaticArtifactService] Initialization failed", e);
      this._isInitialized = true;
    }
  }

  async waitForInit(): Promise<void> {
    if (this._isInitialized) return;
    if (this.initPromise) await this.initPromise;
    else await this.init();
  }

  getArtifactByCode(code: string): ArtifactMetadata | null {
    if (!this.artifactData) return null;
    return this.artifactData[code] || null;
  }

  getAllArtifacts(): ArtifactMetadata[] {
    return this.artifactData ? Object.values(this.artifactData) : [];
  }

  getArtifactList(): string[] {
    return this.artifactData ? Object.keys(this.artifactData).sort() : [];
  }

  getArtifactName(code: string): string | null {
    const art = this.getArtifactByCode(code);
    return art ? art.name : null;
  }

  async refetchArtifactData(): Promise<void> {
    await emit("fetch-progress", { type: "artifact", progress: 10, isFetching: true, message: "Fetching artifact data..." });
    const res = await fetch(ARTIFACT_DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await emit("fetch-progress", { type: "artifact", progress: 50, isFetching: true, message: "Parsing artifact data..." });
    this.artifactData = await res.json();
    const aStr = JSON.stringify(this.artifactData);

    await invoke("cache_set", { key: CACHE_KEY_ARTIFACT, value: aStr });
    await invoke("cache_set", { key: CACHE_KEY_TIME, value: Date.now().toString() });
    await emit("fetch-progress", { type: "artifact", progress: 100, isFetching: false, message: "Artifact data cached successfully" });
  }

  isInitialized(): boolean {
    return this._isInitialized;
  }
}
