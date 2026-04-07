export type ViewTab = 'map' | 'list' | 'screenshot';

export interface FlyToTarget {
  latitude: number;
  longitude: number;
}

interface EnterpriseCoordinates {
  latitude: number | null;
  longitude: number | null;
}

interface ListSelectionUpdate {
  activeTab: ViewTab;
  flyTo: FlyToTarget | null;
}

export function getListSelectionUpdate(
  currentTab: ViewTab,
  currentFlyTo: FlyToTarget | null,
  enterprise: EnterpriseCoordinates
): ListSelectionUpdate {
  if (enterprise.latitude !== null && enterprise.longitude !== null) {
    return {
      activeTab: currentTab,
      flyTo: {
        latitude: enterprise.latitude,
        longitude: enterprise.longitude,
      },
    };
  }

  return {
    activeTab: currentTab,
    flyTo: currentFlyTo,
  };
}
