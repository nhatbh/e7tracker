/**
 * Implementation of OCR Service
 */

import { invoke } from "@tauri-apps/api/core";
import { DetectionSlot, ParsedStats } from "../../domain/models";
import { IOCRService, IScreenDetectionService, IHeroMetadataService, SlotToStringRegistry } from "../../domain/services";

export class OCRService implements IOCRService {
    constructor(
        private screenDetection: IScreenDetectionService,
        private heroService: IHeroMetadataService,
    ) { }

    async scanHeroStats(): Promise<ParsedStats | null> {
        if (!this.screenDetection.isSlotAvailable(DetectionSlot.StatsPanel)) {
            return null;
        }

        const text = await this.performOCROnSlot(DetectionSlot.StatsPanel);
        return text ? this.parseOCRStats(text) : null;
    }

    async identifyHeroName(): Promise<string | null> {
        const detections = this.screenDetection.getDetectionsForSlot(DetectionSlot.SelectedHero);
        if (detections.length === 0) return null;

        const rawName = detections[0].heroName;
        if (!rawName) return null;

        return this.heroService.matchHeroName(rawName);
    }

    async performOCROnSlot(slot: DetectionSlot): Promise<string | null> {
        try {
            const result = await invoke<string>("perform_ocr_on_screen", {
                slot_id: SlotToStringRegistry[slot],
            });
            return result;
        } catch (e) {
            console.error(`[OCRService] Failed to perform OCR on slot ${slot}`, e);
            return null;
        }
    }

    parseOCRStats(text: string): ParsedStats | null {
        const tokens = text.split(/\s+/).filter(token => /\d/.test(token));
        if (tokens.length < 8) return null;

        const parseInteger = (token: string): number | null => {
            const cleaned = token.replace(/\D/g, '');
            const val = parseInt(cleaned, 10);
            return isNaN(val) ? null : val;
        };

        const parsePercentage = (token: string, maxVal: number): number | null => {
            let cleaned = token.toLowerCase();
            if (cleaned.endsWith('/0')) cleaned = cleaned.slice(0, -2);
            else if (cleaned.endsWith('/o')) cleaned = cleaned.slice(0, -2);
            else if (cleaned.endsWith('wo')) cleaned = cleaned.slice(0, -2);
            else if (cleaned.endsWith('%')) cleaned = cleaned.slice(0, -1);
            else if (cleaned.endsWith('o') && cleaned.length > 1) {
                if (/\d/.test(cleaned[cleaned.length - 2])) {
                    cleaned = cleaned.slice(0, -1);
                }
            }

            if (cleaned.includes('.')) {
                const dotCleaned = cleaned.replace(/[^0-9.]/g, '');
                const val = parseFloat(dotCleaned);
                if (!isNaN(val) && val <= maxVal) {
                    return val;
                }
            }

            const digitsCleaned = cleaned.replace(/\D/g, '');
            if (!digitsCleaned) return null;

            const num = parseInt(digitsCleaned, 10);
            if (isNaN(num)) return null;

            const val1 = num / 10;
            if (val1 <= maxVal) return val1;

            const val2 = num / 100;
            if (val2 <= maxVal) return val2;

            return null;
        };

        const atk = parseInteger(tokens[0]);
        const defense = parseInteger(tokens[1]);
        const hp = parseInteger(tokens[2]);
        const speed = parseInteger(tokens[3]);
        const chc = parsePercentage(tokens[4], 100.0);
        const chd = parsePercentage(tokens[5], 999.0);
        const eff = parsePercentage(tokens[6], 999.0);
        const efr = parsePercentage(tokens[7], 999.0);

        if (atk === null || defense === null || hp === null || speed === null ||
            chc === null || chd === null || eff === null || efr === null) {
            return null;
        }

        return { atk, defense, hp, speed, chc, chd, eff, efr };
    }
}
