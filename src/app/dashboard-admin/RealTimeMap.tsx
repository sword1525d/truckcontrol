'use client';
import { useState, useEffect, useRef } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl';
import { LngLatBounds } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { type LocationPoint } from './page';
import { Truck } from 'lucide-react';
import type { LineLayer } from 'react-map-gl';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Estilo da linha do trajeto
const routeLayerStyle: LineLayer = {
  id: 'route',
  type: 'line',
  source: 'route',
  layout: {
    'line-join': 'round',
    'line-cap': 'round',
  },
  paint: {
    'line-color': '#2563eb', // Um azul forte
    'line-width': 5,
    'line-opacity': 0.8,
  },
};

interface RealTimeMapProps {
  locationHistory: LocationPoint[];
}

// Função para calcular a distância entre dois pontos (em km)
const haversineDistance = (coords1: [number, number], coords2: [number, number]): number => {
    const [lon1, lat1] = coords1;
    const [lon2, lat2] = coords2;

    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // Raio da Terra em km

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

// Função para simplificar o trajeto
const simplifyRoute = (points: LocationPoint[], minDistanceKm = 0.02): [number, number][] => {
    if (points.length < 2) {
        return points.map(p => [p.longitude, p.latitude]);
    }
    
    const simplified: [number, number][] = [[points[0].longitude, points[0].latitude]];
    let lastPoint = simplified[0];

    for (let i = 1; i < points.length; i++) {
        const currentPoint: [number, number] = [points[i].longitude, points[i].latitude];
        if (haversineDistance(lastPoint, currentPoint) > minDistanceKm) {
            simplified.push(currentPoint);
            lastPoint = currentPoint;
        }
    }
    
    // Garante que o último ponto seja sempre incluído
    const lastOriginalPoint: [number, number] = [points[points.length-1].longitude, points[points.length-1].latitude];
    if(simplified[simplified.length -1] !== lastOriginalPoint){
        simplified.push(lastOriginalPoint);
    }

    return simplified;
};


const RealTimeMap = ({ locationHistory }: RealTimeMapProps) => {
  const mapRef = useRef<MapRef>(null);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-destructive/10 rounded-lg p-4">
        <p className="text-destructive text-center font-medium">
          A chave de acesso do Mapbox não foi configurada. Por favor, adicione seu token ao arquivo .env.local.
        </p>
      </div>
    );
  }

  if (!locationHistory || locationHistory.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg">
        <p className="text-muted-foreground">Sem dados de localização para exibir.</p>
      </div>
    );
  }
  
  const simplifiedCoordinates = simplifyRoute(locationHistory);

  // Transforma o histórico de localização em um formato GeoJSON para a linha
  const routeGeoJSON = {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: simplifiedCoordinates,
    },
  };

  const lastPosition = locationHistory[locationHistory.length - 1];

  // Efeito para ajustar a visualização do mapa quando o histórico de localização muda
  useEffect(() => {
    if (mapRef.current && simplifiedCoordinates.length > 1) {
      const coordinates = routeGeoJSON.geometry.coordinates as [number, number][];
      const bounds = new LngLatBounds(
        coordinates[0],
        coordinates[0]
      );
      for (const coord of coordinates) {
        bounds.extend(coord);
      }
      mapRef.current.fitBounds(bounds, {
        padding: 60, // Aumenta o padding para melhor visualização
        duration: 1000,
      });
    }
  }, [locationHistory, routeGeoJSON.geometry.coordinates]);


  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: lastPosition.longitude,
        latitude: lastPosition.latitude,
        zoom: 15,
      }}
      style={{ width: '100%', height: '100%', borderRadius: '0.5rem' }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      mapboxAccessToken={MAPBOX_TOKEN}
    >
      {/* Fonte de dados para a rota */}
      <Source id="route" type="geojson" data={routeGeoJSON}>
        <Layer {...routeLayerStyle} />
      </Source>
      
      {/* Marcador para a posição atual */}
      <Marker
        longitude={lastPosition.longitude}
        latitude={lastPosition.latitude}
        anchor="bottom"
      >
        <div className="bg-primary rounded-full p-2 shadow-lg">
            <Truck className="h-5 w-5 text-primary-foreground" />
        </div>
      </Marker>
    </Map>
  );
};

export default RealTimeMap;
