import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { IKeybindService } from '../../domain/services/IKeybindService';
import { Keybind } from '../../domain/models/KeybindSchema';
import { IScreenDetectionService } from '../../domain/services/IScreenDetectionService';
import { throttle } from 'lodash-es'; // Using lodash-es

export class KeybindService implements IKeybindService {
    private callbacks: Map<Keybind, Set<(screen: string | null) => void>> = new Map();
    private unlistenFunctions: Map<string, UnlistenFn> = new Map();
    private throttleDuration = 300; // 300ms throttle

    constructor(private screenDetectionService: IScreenDetectionService) {
        this.initializeListeners();
    }

    private initializeListeners() {
        // Map of Tauri event names to Keybind enum
        const bindings = [
            { event: 'alt-b', key: Keybind.AltB },
            { event: 'alt-h', key: Keybind.AltH },
            { event: 'alt-s', key: Keybind.AltS },
            { event: 'alt-dot', key: Keybind.AltDot },
            { event: 'alt-comma', key: Keybind.AltComma },
            { event: 'alt-d', key: Keybind.AltD },
            { event: 'alt-r', key: Keybind.AltR },
        ];

        for (const binding of bindings) {
            listen(binding.event, () => this.handleEvent(binding.key));
        }
    }

    private handleEvent = throttle((key: Keybind) => {
        const screen = this.screenDetectionService.getLatestFrameResult()?.screen || null;
        const callbacks = this.callbacks.get(key);
        if (callbacks) {
            callbacks.forEach(cb => cb(screen));
        }
    }, this.throttleDuration, { leading: true, trailing: false });

    onKeybind(keybind: Keybind, callback: (screen: string | null) => void): () => void {
        if (!this.callbacks.has(keybind)) {
            this.callbacks.set(keybind, new Set());
        }
        this.callbacks.get(keybind)!.add(callback);

        return () => {
            const callbacks = this.callbacks.get(keybind);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }
}
