/**
 * Keybind Schema
 * Defines all available keybinds in the application
 */

export enum Keybind {
    AltB = 'alt-b',
    AltH = 'alt-h',
    AltS = 'alt-s',
    AltDot = 'alt-dot',
    AltComma = 'alt-comma'
}

export interface KeybindEvent {
    keybind: Keybind;
    screen: string | null;
    timestamp: number;
}
