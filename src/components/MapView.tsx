import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import type { MapMarker } from '../hooks/useMapMarkers';

const PUDONG_CENTER: [number, number] = [31.22, 121.54];
const DEFAULT_ZOOM = 12;

function createIcon(color: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 10px; height: 10px; border-radius: 50%;
      background: ${color}; border: 2px solid rgba(255,255,255,0.9);
      box-shadow: 0 0 8px ${color}aa;
    "></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

const ICONS = {
  confirmed: createIcon('#10b981'),
  highPending: createIcon('#3b82f6'),
  midPending: createIcon('#f59e0b'),
  noResult: createIcon('#6b7280'),
};

function getIcon(marker: MapMarker) {
  if (marker.has_cooling_tower) return ICONS.confirmed;
  if (marker.detection_status === 'no_result') return ICONS.noResult;
  if (marker.probability_level === '\u9ad8') return ICONS.highPending;
  return ICONS.midPending;
}

interface FlyToProps {
  target: { latitude: number; longitude: number } | null;
}

function FlyToMarker({ target }: FlyToProps) {
  const map = useMap();
  useEffect(() => {
    if (target?.latitude && target?.longitude) {
      map.flyTo([target.latitude, target.longitude], 16, { duration: 0.8 });
    }
  }, [target, map]);
  return null;
}

interface MapViewProps {
  markers: MapMarker[];
  onSelect: (id: string) => void;
  flyTo: { latitude: number; longitude: number } | null;
}

export default function MapView({ markers, onSelect, flyTo }: MapViewProps) {
  const geoMarkers = useMemo(
    () => markers.filter((m) => m.latitude && m.longitude),
    [markers]
  );

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-slate-700/40 relative">
      <MapContainer
        center={PUDONG_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          url="https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}"
          subdomains={['1', '2', '3', '4']}
          maxZoom={18}
        />
        <TileLayer
          url="https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}"
          subdomains={['1', '2', '3', '4']}
          attribution='&copy; <a href="https://amap.com">高德地图</a>'
          maxZoom={18}
        />

        <FlyToMarker target={flyTo} />

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          iconCreateFunction={(cluster: { getChildCount: () => number }) => {
            const count = cluster.getChildCount();
            let dim = 32;
            let bg = 'rgba(6, 182, 212, 0.75)';
            let border = 'rgba(6, 182, 212, 1)';
            if (count > 100) {
              dim = 52;
              bg = 'rgba(239, 68, 68, 0.75)';
              border = 'rgba(239, 68, 68, 1)';
            } else if (count > 50) {
              dim = 44;
              bg = 'rgba(245, 158, 11, 0.75)';
              border = 'rgba(245, 158, 11, 1)';
            } else if (count > 20) {
              dim = 38;
            }

            return L.divIcon({
              html: `<div style="
                width: ${dim}px; height: ${dim}px; border-radius: 50%;
                background: ${bg}; border: 2px solid ${border};
                display: flex; align-items: center; justify-content: center;
                color: white; font-size: ${count > 100 ? 13 : 11}px; font-weight: 700;
                box-shadow: 0 0 16px ${bg};
              ">${count}</div>`,
              className: 'custom-cluster',
              iconSize: L.point(dim, dim),
            });
          }}
        >
          {geoMarkers.map((marker) => (
            <Marker
              key={marker.id}
              position={[marker.latitude, marker.longitude]}
              icon={getIcon(marker)}
              eventHandlers={{ click: () => onSelect(marker.id) }}
            >
              <Popup maxWidth={280}>
                <div className="text-xs space-y-1">
                  <p className="font-semibold text-sm text-slate-800">{marker.enterprise_name}</p>
                  <p className="text-slate-500">{marker.address}</p>
                  <div className="flex gap-2 mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-white text-[10px] ${
                      marker.probability_level === '\u9ad8' ? 'bg-blue-500' : 'bg-amber-500'
                    }`}>
                      {marker.probability_level}概率
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-white text-[10px] ${
                      marker.has_cooling_tower ? 'bg-emerald-500' :
                      marker.detection_status === 'detected' ? 'bg-orange-500' : 'bg-slate-500'
                    }`}>
                      {marker.has_cooling_tower ? '有冷却塔' :
                       marker.detection_status === 'detected' ? '无冷却塔' : '待识别'}
                    </span>
                  </div>
                  {marker.has_cooling_tower && marker.cooling_tower_count > 0 && (
                    <div className="flex gap-3 mt-1">
                      <span className="text-emerald-600 font-medium">
                        冷却塔: {marker.cooling_tower_count} 台
                      </span>
                      {marker.detection_confidence > 0 && (
                        <span className="text-slate-500">
                          置信度: {(marker.detection_confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  )}
                  {marker.cooling_station_rated_power_mw > 0 && (
                    <p className="text-blue-600 font-medium">
                      估算功率: {marker.cooling_station_rated_power_mw} MW
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      <div className="absolute bottom-4 left-4 z-[1000] bg-black/70 backdrop-blur-sm rounded-lg
        border border-white/10 px-3 py-2 space-y-1">
        <p className="text-[10px] text-white/60 font-medium mb-1">图例</p>
        {[
          { color: '#10b981', label: '已确认冷却塔' },
          { color: '#3b82f6', label: '高概率待识别' },
          { color: '#f59e0b', label: '中概率待识别' },
          { color: '#6b7280', label: '未检出' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full border border-white/60"
              style={{ background: item.color, boxShadow: `0 0 4px ${item.color}80` }}
            />
            <span className="text-[10px] text-white/80">{item.label}</span>
          </div>
        ))}
        <div className="pt-1 border-t border-white/10">
          <span className="text-[10px] text-white/50">{geoMarkers.length.toLocaleString()} 个标记</span>
        </div>
      </div>
    </div>
  );
}
