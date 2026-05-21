import { Keybind } from '../../domain/models/KeybindSchema';

export interface IKeybindService {
    onKeybind(keybind: Keybind, callback: (screen: string | null) => void): () => void;
}
