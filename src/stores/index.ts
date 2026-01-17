/**
 * Zustand Stores - 중앙화된 상태 관리
 *
 * 기존 App.jsx의 51개 useState를 5개 스토어로 분리:
 * - useMapStore: 지도 뷰 설정 (3D/2D, 다크모드, 지형 등)
 * - useUIStore: UI 상태 (패널, 아코디언, 팝업)
 * - useAircraftStore: 항공기 표시 설정
 * - useAtcStore: ATC/레이더 설정
 * - useLayerStore: 레이어 표시 설정
 */

export { default as useMapStore } from './useMapStore';
export { default as useUIStore } from './useUIStore';
export { default as useAircraftStore } from './useAircraftStore';
export { default as useAtcStore } from './useAtcStore';
export { default as useLayerStore } from './useLayerStore';

// Re-export types
export type { MapStore } from './useMapStore';
export type { UIStore } from './useUIStore';
export type { AircraftStore, SelectedAircraft, GraphHoverData, LabelOffset } from './useAircraftStore';
export type { AtcStore } from './useAtcStore';
export type { LayerStore } from './useLayerStore';
