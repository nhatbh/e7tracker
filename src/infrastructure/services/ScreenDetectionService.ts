/**
 * Implementation of Screen Detection Service
 */

import { invoke } from "@tauri-apps/api/core";
import { IScreenDetectionService, SlotRegistry } from "../../domain/services";
import { Detection, DetectionSlot, FrameResult, ParsedDetection, ParsedFrameResult, ScreenType } from "../../domain/models/DetectionSchema";

export class ScreenDetectionService implements IScreenDetectionService {
    private currentScreen: ScreenType = ScreenType.Unknown;
    private currentFrameResult: ParsedFrameResult | null = null;
    private screenChangeListeners: Set<(screen: ScreenType) => void> = new Set();

    parseFrameResult(raw: FrameResult): ParsedFrameResult {
        const screen = this.mapScreenName(raw.screen_name);
        const detections = (raw.detections || [])
            .map(d => this.parseDetection(d))
            .filter((d): d is ParsedDetection => d !== null);

        return {
            screen,
            detections,
            timestamp: raw.timestamp || Date.now(),
        };
    }

    private mapScreenName(name: string): ScreenType {
        return (Object.values(ScreenType).includes(name as ScreenType)
            ? name
            : ScreenType.Unknown) as ScreenType;
    }

    private parseDetection(raw: Detection): ParsedDetection | null {
        const slot = SlotRegistry[raw.slot_id];
        if (!slot) return null;

        return {
            slot,
            heroName: raw.hero_name,
            coordinates: raw.coordinates,
            confidence: raw.confidence,
        };
    }

    getCurrentScreen(): ScreenType {
        return this.currentScreen;
    }

    onScreenChanged(callback: (screen: ScreenType) => void): () => void {
        this.screenChangeListeners.add(callback);
        return () => this.screenChangeListeners.delete(callback);
    }

    getDetectionsForSlot(slot: DetectionSlot): ParsedDetection[] {
        return this.currentFrameResult?.detections.filter(d => d.slot === slot) || [];
    }

    isSlotAvailable(slot: DetectionSlot): boolean {
        // Basic implementation: check if slot exists in current frame detections
        return this.currentFrameResult?.detections.some(d => d.slot === slot) ?? false;
    }

    updateFrameResult(raw: FrameResult): void {
        const parsed = this.parseFrameResult(raw);
        this.currentFrameResult = parsed;

        if (parsed.screen !== this.currentScreen) {
            this.currentScreen = parsed.screen;
            this.screenChangeListeners.forEach(cb => cb(this.currentScreen));
        }
    }

    getLatestFrameResult(): ParsedFrameResult | null {
        return this.currentFrameResult;
    }
}
