/**
 * Artifact Metadata Service Interface
 * Defines contract for fetching and caching static artifact data
 */

import { ArtifactMetadata } from '../models/Artifact';

export interface IArtifactMetadataService {
  /**
   * Initialize the service and load cached artifact data
   */
  init(): Promise<void>;

  /**
   * Wait for initialization to complete
   */
  waitForInit(): Promise<void>;

  /**
   * Get an artifact by code
   */
  getArtifactByCode(code: string): ArtifactMetadata | null;

  /**
   * Get all artifacts
   */
  getAllArtifacts(): ArtifactMetadata[];

  /**
   * Get artifact list (names only)
   */
  getArtifactList(): string[];

  /**
   * Get artifact name by code
   */
  getArtifactName(code: string): string | null;

  /**
   * Refetch artifact data from remote source
   */
  refetchArtifactData(): Promise<void>;

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean;
}
