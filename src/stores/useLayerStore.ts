import { create } from 'zustand';

/**
 * LayerStore - 레이어 표시 관련 상태 관리
 * - 웨이포인트/장애물/공역
 * - 기상 레이어
 * - 한국 공역/항로
 */

interface LayerState {
  // RKPU layers
  showWaypoints: boolean;
  showObstacles: boolean;
  showAirspace: boolean;

  // Weather layers
  showLightning: boolean;
  showSigmet: boolean;

  // Korea airspace
  showKoreaRoutes: boolean;
  showKoreaWaypoints: boolean;
  showKoreaNavaids: boolean;
  showKoreaAirspaces: boolean;
}

interface LayerActions {
  // RKPU layers
  setShowWaypoints: (value: boolean) => void;
  setShowObstacles: (value: boolean) => void;
  setShowAirspace: (value: boolean) => void;

  // Weather layers
  setShowLightning: (value: boolean) => void;
  setShowSigmet: (value: boolean) => void;

  // Korea airspace
  setShowKoreaRoutes: (value: boolean) => void;
  setShowKoreaWaypoints: (value: boolean) => void;
  setShowKoreaNavaids: (value: boolean) => void;
  setShowKoreaAirspaces: (value: boolean) => void;

  // Toggle helpers
  toggleWaypoints: () => void;
  toggleObstacles: () => void;
  toggleAirspace: () => void;
  toggleLightning: () => void;
  toggleSigmet: () => void;

  // Reset
  resetLayers: () => void;
}

export type LayerStore = LayerState & LayerActions;

const useLayerStore = create<LayerStore>((set) => ({
  // RKPU layers
  showWaypoints: false,
  showObstacles: false,
  showAirspace: true,

  // Weather layers
  showLightning: false,
  showSigmet: false,

  // Korea airspace
  showKoreaRoutes: false,
  showKoreaWaypoints: false,
  showKoreaNavaids: false,
  showKoreaAirspaces: false,

  // Actions - RKPU layers
  setShowWaypoints: (value) => set({ showWaypoints: value }),
  setShowObstacles: (value) => set({ showObstacles: value }),
  setShowAirspace: (value) => set({ showAirspace: value }),

  // Actions - Weather layers
  setShowLightning: (value) => set({ showLightning: value }),
  setShowSigmet: (value) => set({ showSigmet: value }),

  // Actions - Korea airspace
  setShowKoreaRoutes: (value) => set({ showKoreaRoutes: value }),
  setShowKoreaWaypoints: (value) => set({ showKoreaWaypoints: value }),
  setShowKoreaNavaids: (value) => set({ showKoreaNavaids: value }),
  setShowKoreaAirspaces: (value) => set({ showKoreaAirspaces: value }),

  // Toggle helpers
  toggleWaypoints: () => set((state) => ({ showWaypoints: !state.showWaypoints })),
  toggleObstacles: () => set((state) => ({ showObstacles: !state.showObstacles })),
  toggleAirspace: () => set((state) => ({ showAirspace: !state.showAirspace })),
  toggleLightning: () => set((state) => ({ showLightning: !state.showLightning })),
  toggleSigmet: () => set((state) => ({ showSigmet: !state.showSigmet })),

  // Reset all layers
  resetLayers: () => set({
    showWaypoints: false,
    showObstacles: false,
    showAirspace: true,
    showLightning: false,
    showSigmet: false,
    showKoreaRoutes: false,
    showKoreaWaypoints: false,
    showKoreaNavaids: false,
    showKoreaAirspaces: false,
  }),
}));

export default useLayerStore;
