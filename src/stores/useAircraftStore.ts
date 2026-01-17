import { create } from 'zustand';

/**
 * AircraftStore - 항공기 표시 관련 상태 관리
 * - 항공기 표시 설정
 * - 항적 설정
 * - 라벨 설정
 * - 선택된 항공기
 */

export interface LabelOffset {
  x: number;
  y: number;
}

export interface SelectedAircraft {
  hex: string;
  callsign?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number;
  gs?: number;
  track?: number;
  flight?: string;
  type?: string;
  registration?: string;
  [key: string]: unknown;
}

export interface GraphHoverData {
  time: number;
  altitude?: number;
  speed?: number;
  [key: string]: unknown;
}

interface AircraftState {
  // Display settings
  showAircraft: boolean;
  showAircraftTrails: boolean;
  show3DAircraft: boolean;

  // Trail settings
  trailDuration: number; // ms

  // Heading prediction
  headingPrediction: number; // seconds

  // Label settings
  labelOffset: LabelOffset;
  isDraggingLabel: boolean;

  // Selected aircraft
  selectedAircraft: SelectedAircraft | null;
  graphHoverData: GraphHoverData | null;
}

interface AircraftActions {
  // Display
  setShowAircraft: (value: boolean) => void;
  setShowAircraftTrails: (value: boolean) => void;
  setShow3DAircraft: (value: boolean) => void;

  // Trail
  setTrailDuration: (value: number) => void;
  setHeadingPrediction: (value: number) => void;

  // Label
  setLabelOffset: (value: LabelOffset) => void;
  setIsDraggingLabel: (value: boolean) => void;
  updateLabelOffset: (dx: number, dy: number) => void;
  resetLabelOffset: () => void;

  // Selection
  setSelectedAircraft: (value: SelectedAircraft | null) => void;
  clearSelectedAircraft: () => void;
  setGraphHoverData: (value: GraphHoverData | null) => void;

  // Toggles
  toggleAircraft: () => void;
  toggleTrails: () => void;
  toggle3DAircraft: () => void;
}

export type AircraftStore = AircraftState & AircraftActions;

const useAircraftStore = create<AircraftStore>((set) => ({
  // Display settings
  showAircraft: true,
  showAircraftTrails: true,
  show3DAircraft: true,

  // Trail settings
  trailDuration: 60000, // 1분 기본값 (ms)

  // Heading prediction
  headingPrediction: 30, // 초

  // Label settings
  labelOffset: { x: 1.0, y: 0 },
  isDraggingLabel: false,

  // Selected aircraft
  selectedAircraft: null,
  graphHoverData: null,

  // Actions - Display
  setShowAircraft: (value) => set({ showAircraft: value }),
  setShowAircraftTrails: (value) => set({ showAircraftTrails: value }),
  setShow3DAircraft: (value) => set({ show3DAircraft: value }),

  // Actions - Trail
  setTrailDuration: (value) => set({ trailDuration: value }),
  setHeadingPrediction: (value) => set({ headingPrediction: value }),

  // Actions - Label
  setLabelOffset: (value) => set({ labelOffset: value }),
  setIsDraggingLabel: (value) => set({ isDraggingLabel: value }),
  updateLabelOffset: (dx, dy) => set((state) => ({
    labelOffset: {
      x: Math.max(-3, Math.min(3, state.labelOffset.x + dx)),
      y: Math.max(-3, Math.min(3, state.labelOffset.y + dy)),
    }
  })),
  resetLabelOffset: () => set({ labelOffset: { x: 1.0, y: 0 } }),

  // Actions - Selection
  setSelectedAircraft: (value) => set({ selectedAircraft: value }),
  clearSelectedAircraft: () => set({ selectedAircraft: null, graphHoverData: null }),
  setGraphHoverData: (value) => set({ graphHoverData: value }),

  // Toggle helpers
  toggleAircraft: () => set((state) => ({ showAircraft: !state.showAircraft })),
  toggleTrails: () => set((state) => ({ showAircraftTrails: !state.showAircraftTrails })),
  toggle3DAircraft: () => set((state) => ({ show3DAircraft: !state.show3DAircraft })),
}));

export default useAircraftStore;
