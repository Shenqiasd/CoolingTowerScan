import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { SATELLITE_SOURCE_TILE_SIZE } from '../../utils/rasterViewport';

export interface MapCanvasHandle {
  map: mapboxgl.Map | null;
}

interface Props {
  token: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  onReady?: (map: mapboxgl.Map) => void;
  onClick?: (lng: number, lat: number) => void;
  onMouseDown?: (lng: number, lat: number, e: mapboxgl.MapMouseEvent) => void;
  onMouseMove?: (lng: number, lat: number) => void;
  onMouseUp?: (lng: number, lat: number) => void;
  cursor?: string;
}

const TOKEN_KEY = 'mapbox_token';

const MapCanvas = forwardRef<MapCanvasHandle, Props>(({
  token,
  initialCenter = [121.5, 31.2],
  initialZoom = 12,
  onReady,
  onClick,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  cursor,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useImperativeHandle(ref, () => ({ map: mapRef.current }));

  useEffect(() => {
    if (!containerRef.current || !token) return;
    mapboxgl.accessToken = token;
    localStorage.setItem(TOKEN_KEY, token);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'google-satellite': {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
            tileSize: SATELLITE_SOURCE_TILE_SIZE,
          },
        },
        layers: [{ id: 'satellite', type: 'raster', source: 'google-satellite' }],
      },
      center: initialCenter,
      zoom: initialZoom,
      preserveDrawingBuffer: true,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.on('load', () => onReady?.(map));
    map.on('click', (e) => onClick?.(e.lngLat.lng, e.lngLat.lat));
    map.on('mousedown', (e) => onMouseDown?.(e.lngLat.lng, e.lngLat.lat, e));
    map.on('mousemove', (e) => onMouseMove?.(e.lngLat.lng, e.lngLat.lat));
    map.on('mouseup', (e) => onMouseUp?.(e.lngLat.lng, e.lngLat.lat));

    mapRef.current = map;
    // expose after mount
    (ref as React.MutableRefObject<MapCanvasHandle>).current = { map };

    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = cursor ?? '';
    }
  }, [cursor]);

  return <div ref={containerRef} className="w-full h-full" />;
});

MapCanvas.displayName = 'MapCanvas';
export default MapCanvas;
