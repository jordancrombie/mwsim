import { create } from 'zustand';
import { api } from '../services/api';
import type { Card, Bank, EnrolledBank } from '../types';

interface WalletState {
  // State
  cards: Card[];
  banks: Bank[];
  enrolledBanks: EnrolledBank[];
  isLoading: boolean;
  isOffline: boolean;
  lastSyncedAt: Date | null;

  // Actions
  fetchCards: () => Promise<void>;
  fetchBanks: () => Promise<void>;
  setDefaultCard: (cardId: string) => Promise<void>;
  removeCard: (cardId: string) => Promise<void>;
  refreshWallet: () => Promise<void>;
  loadCachedData: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  // Initial state
  cards: [],
  banks: [],
  enrolledBanks: [],
  isLoading: false,
  isOffline: false,
  lastSyncedAt: null,

  // Fetch cards from API
  fetchCards: async () => {
    set({ isLoading: true });

    try {
      const cards = await api.getCards();
      set({
        cards,
        isLoading: false,
        isOffline: false,
        lastSyncedAt: new Date(),
      });
    } catch (error) {
      // Try to load cached data
      const cachedCards = await api.getCachedCards();
      if (cachedCards) {
        set({
          cards: cachedCards,
          isLoading: false,
          isOffline: true,
        });
      } else {
        set({ isLoading: false, isOffline: true });
      }
    }
  },

  // Fetch available banks
  fetchBanks: async () => {
    try {
      const banks = await api.getBanks();
      set({ banks });
    } catch (error) {
      console.error('Failed to fetch banks:', error);
    }
  },

  // Set a card as default
  setDefaultCard: async (cardId: string) => {
    const { cards } = get();

    // Optimistic update
    const updatedCards = cards.map((card) => ({
      ...card,
      isDefault: card.id === cardId,
    }));
    set({ cards: updatedCards });

    try {
      await api.setDefaultCard(cardId);
    } catch (error) {
      // Revert on failure
      set({ cards });
      throw error;
    }
  },

  // Remove a card
  removeCard: async (cardId: string) => {
    const { cards } = get();

    // Optimistic update
    const updatedCards = cards.filter((card) => card.id !== cardId);
    set({ cards: updatedCards });

    try {
      await api.removeCard(cardId);
    } catch (error) {
      // Revert on failure
      set({ cards });
      throw error;
    }
  },

  // Full wallet refresh
  refreshWallet: async () => {
    set({ isLoading: true });

    try {
      const summary = await api.getWalletSummary();
      set({
        cards: summary.cards,
        enrolledBanks: summary.enrolledBanks,
        isLoading: false,
        isOffline: false,
        lastSyncedAt: new Date(),
      });
    } catch (error) {
      set({ isLoading: false, isOffline: true });
    }
  },

  // Load cached data (for offline mode)
  loadCachedData: async () => {
    const cachedCards = await api.getCachedCards();
    if (cachedCards) {
      set({
        cards: cachedCards,
        isOffline: true,
      });
    }
  },
}));
