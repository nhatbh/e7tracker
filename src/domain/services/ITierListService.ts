import { TierListHeroData } from '../models/TierList';

export interface ITierListService {
    getTierListData(): Promise<TierListHeroData[]>;
    recalculateTierList(): Promise<void>;
    onTierListUpdated(callback: () => void): void;
}
