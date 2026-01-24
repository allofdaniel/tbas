import { create } from 'zustand';

/**
 * AtcStore - ATC/레이더 관련 상태 관리
 * - 레이더 뷰 모드
 * - 레이더 범위
 * - 선택된 섹터
 */

interface AtcState {
  // Radar view mode
  atcOnlyMode: boolean;
  radarRange: number; // nm
  radarBlackBackground: boolean;

  // Selected sectors
  selectedAtcSectors: Set<string>;
}

interface AtcActions {
  // Radar mode
  setAtcOnlyMode: (value: boolean) => void;
  setRadarRange: (value: number) => void;
  setRadarBlackBackground: (value: boolean) => void;
  toggleAtcOnlyMode: () => void;

  // Sector selection
  setSelectedAtcSectors: (value: Set<string>) => void;
  toggleSector: (sectorId: string) => void;
  selectAllSectors: (sectorIds: string[]) => void;
  deselectAllSectors: (sectorIds: string[]) => void;
  toggleSectorGroup: (sectorIds: string[]) => void;
  clearAllSectors: () => void;

  // Radar mode helpers
  enableRadarMode: () => void;
  resetRadarSettings: () => void;
}

export type AtcStore = AtcState & AtcActions;

const useAtcStore = create<AtcStore>((set) => ({
  // Radar view mode
  atcOnlyMode: false,
  radarRange: 100, // nm
  radarBlackBackground: false,  // 기본값: 검은 배경 꺼짐

  // Selected sectors
  selectedAtcSectors: new Set(),

  // Actions - Radar mode
  setAtcOnlyMode: (value) => set({ atcOnlyMode: value }),
  setRadarRange: (value) => set({ radarRange: value }),
  setRadarBlackBackground: (value) => set({ radarBlackBackground: value }),
  toggleAtcOnlyMode: () => set((state) => ({ atcOnlyMode: !state.atcOnlyMode })),

  // Actions - Sector selection
  setSelectedAtcSectors: (value) => set({ selectedAtcSectors: value }),
  toggleSector: (sectorId) => set((state) => {
    const newSet = new Set(state.selectedAtcSectors);
    if (newSet.has(sectorId)) {
      newSet.delete(sectorId);
    } else {
      newSet.add(sectorId);
    }
    return { selectedAtcSectors: newSet };
  }),
  selectAllSectors: (sectorIds) => set((state) => {
    const newSet = new Set(state.selectedAtcSectors);
    sectorIds.forEach(id => newSet.add(id));
    return { selectedAtcSectors: newSet };
  }),
  deselectAllSectors: (sectorIds) => set((state) => {
    const newSet = new Set(state.selectedAtcSectors);
    sectorIds.forEach(id => newSet.delete(id));
    return { selectedAtcSectors: newSet };
  }),
  toggleSectorGroup: (sectorIds) => set((state) => {
    const newSet = new Set(state.selectedAtcSectors);
    const allSelected = sectorIds.every(id => newSet.has(id));
    sectorIds.forEach(id => allSelected ? newSet.delete(id) : newSet.add(id));
    return { selectedAtcSectors: newSet };
  }),
  clearAllSectors: () => set({ selectedAtcSectors: new Set() }),

  // Enable radar mode (카메라 이동 없음)
  enableRadarMode: () => {
    set({
      atcOnlyMode: true,
    });
  },

  // Reset radar settings
  resetRadarSettings: () => set({
    atcOnlyMode: false,
    radarRange: 100,
    radarBlackBackground: false,
    selectedAtcSectors: new Set(),
  }),
}));

export default useAtcStore;
