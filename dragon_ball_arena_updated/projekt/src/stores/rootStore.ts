import { create } from 'zustand';
import { createAuthSlice, type AuthSlice } from './authSlice';
import { createGameSlice, type GameSlice } from './gameSlice';
import { createDraftSlice, type DraftSlice } from './draftSlice';
import { createBattleSlice, type BattleSlice } from './battleSlice';

// RootState is the union of all slices
export type RootState = AuthSlice & GameSlice & DraftSlice & BattleSlice;

export const useGameState = create<RootState>()((...args) => ({
    ...createAuthSlice(...args),
    ...createGameSlice(...args),
    ...createDraftSlice(...args),
    ...createBattleSlice(...args),
}));
