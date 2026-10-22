'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Etapa, Midia, MediaFilters } from '@/lib/supabase';
import { snapToRoute, snapToRouteWithThreshold, distanceMeters } from '@/lib/geo';
import { Camera, Video, Film, Check } from 'lucide-react';
import DroneIcon from '@/components/icons/DroneIcon';

// SVG vetorial do novo ícone de Drone (vista frontal) para os marcadores HTML do MapLibre
const DRONE_PIN_SVG = `<svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
  <path d="M 1 6 C 1 5.6 1.4 5.3 1.8 5.3 L 8.2 5.3 C 8.6 5.3 9 5.6 9 6 C 9 6.4 8.6 6.7 8.2 6.7 L 1.8 6.7 C 1.4 6.7 1 6.4 1 6 Z" />
  <path d="M 15 6 C 15 5.6 15.4 5.3 15.8 5.3 L 22.2 5.3 C 22.6 5.3 23 5.6 23 6 C 23 6.4 22.6 6.7 22.2 6.7 L 15.8 6.7 C 15.4 6.7 15 6.4 15 6 Z" />
  <rect x="4.3" y="6.7" width="1.4" height="2" rx="0.5" />
  <rect x="18.3" y="6.7" width="1.4" height="2" rx="0.5" />
  <path d="M 4.2 8.7 C 7.5 8.2, 9.6 7.2, 12 7.2 C 14.4 7.2, 16.5 8.2, 19.8 8.7 C 20.6 9.8, 18.8 10.6, 17 10.3 C 14.5 9.8, 13.5 10.7, 12 10.7 C 10.5 10.7, 9.5 9.8, 7 10.3 C 5.2 10.6, 3.4 9.8, 4.2 8.7 Z" />
  <path d="M 7.2 10.3 C 5.8 12, 5.2 14.8, 5.8 18 C 6.2 18.2, 6.6 18, 6.8 17.6 C 6.4 15, 6.9 12.6, 8 11 Z" />
  <path d="M 16.8 10.3 C 18.2 12, 18.8 14.8, 18.2 18 C 17.8 18.2, 17.4 18, 17.2 17.6 C 17.6 15, 17.1 12.6, 16 11 Z" />
  <path fill-rule="evenodd" clip-rule="evenodd" d="M 9.5 11.2 H 14.5 C 15 11.2 15.4 11.6 15.4 12.1 V 15.5 C 15.4 16 15 16.4 14.5 16.4 H 9.5 C 9 16.4 8.6 16 8.6 15.5 V 12.1 C 8.6 11.6 9 11.2 9.5 11.2 Z M 12 15.3 C 12.9 15.3 13.6 14.6 13.6 13.7 C 13.6 12.8 12.9 12.1 12 12.1 C 11.1 12.1 10.4 12.8 10.4 13.7 C 10.4 14.6 11.1 15.3 12 15.3 Z" />
  <circle cx="12" cy="13.7" r="0.6" />
</svg>`;

interface MapProps {
  etapas: Etapa[];
  diaSelecionado: number | null;
  midias: Midia[];
  onSelectMidia: (midia: Midia) => void;
  tipoMapa: 'satellite' | 'streets' | 'topo';
  hoverCoord: [number, number] | null;
  isAdmin: boolean;
  isPickingPin: boolean;
  onPickPinCoord: (coord: [number, number], altitude?: number, kmNoTrajeto?: number) => void;
  onUpdateMidiaCoord: (
    id: string,
    lat: number,
    lon: number,
    altitude?: number,
    kmNoTrajeto?: number | null
  ) => Promise<void>;
  highlightedMidiaId?: string | null;
  mediaFilters?: MediaFilters;
  onToggleFilter?: (tipo: keyof MediaFilters) => void;
  focusMidia?: { coord: [number, number]; id?: string; timestamp: number } | null;
  pendingPinCoord?: [number, number] | null;
}

interface MidiaCluster {
  id: string;
  centerCoord: [number, number];
  midias: Midia[];
}

export default function Map({
  etapas,
  diaSelecionado,
  midias,
  onSelectMidia,
  tipoMapa,
  hoverCoord,
  isAdmin,
  isPickingPin,
  onPickPinCoord,
  onUpdateMidiaCoord,
  highlightedMidiaId,
  mediaFilters,
  onToggleFilter,
  focusMidia,
  pendingPinCoord,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const hoverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pendingMarkerRef = useRef<maplibregl.Marker | null>(null);

  // ID do cluster que está expandido em leque (Spiderfier)
  const [expandedClusterId, setExpandedClusterId] = useState<string | null>(null);

  // Inicializar o Mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const getMapStyle = (tipo: 'satellite' | 'streets' | 'topo'): maplibregl.StyleSpecification => {
      if (tipo === 'satellite') {
        return {
          version: 8,
          sources: {
            'esri-satellite': {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              ],
              tileSize: 256,
            },
          },
          layers: [
            {
              id: 'esri-satellite-layer',
              type: 'raster',
              source: 'esri-satellite',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        } as maplibregl.StyleSpecification;
      } else {
        return {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm-layer',
              type: 'raster',
              source: 'osm',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        } as maplibregl.StyleSpecification;
      }
    };

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: getMapStyle(tipoMapa),
      center: [-49.85, -28.75], // Centro aproximado dos Cânions
      zoom: 8.5,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    // Ao clicar no mapa (com snap automático ao caminho caso esteja marcando pin)
    map.on('click', (e) => {
      // Se clicar no mapa vazio, fecha qualquer cluster expandido
      setExpandedClusterId(null);

      if (isPickingPin) {
        // Encontrar rota ativa para aplicar snap
        const etapaAtiva = diaSelecionado
          ? etapas.find((et) => et.numero_dia === diaSelecionado)
          : etapas[0];

        const routeCoords = etapaAtiva?.geojson_rota?.geometry?.coordinates || [];
        if (routeCoords.length > 0) {
          const snapped = snapToRouteWithThreshold([e.lngLat.lng, e.lngLat.lat], routeCoords, 350);
          onPickPinCoord(snapped.coord, snapped.altitude, snapped.kmNoTrajeto ?? undefined);
        } else {
          onPickPinCoord([e.lngLat.lng, e.lngLat.lat]);
        }
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Alternar Camada de Satélite / Ruas
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateBaseLayer = () => {
      try {
        if (!map.isStyleLoaded()) return;

        if (tipoMapa === 'satellite') {
          if (!map.getSource('esri-satellite')) {
            map.addSource('esri-satellite', {
              type: 'raster',
              tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
              ],
              tileSize: 256,
            });
            map.addLayer(
              {
                id: 'esri-satellite-layer',
                type: 'raster',
                source: 'esri-satellite',
              },
              map.getStyle().layers?.[0]?.id
            );
          }
          if (map.getLayer('osm-layer')) map.removeLayer('osm-layer');
          if (map.getSource('osm')) map.removeSource('osm');
        } else {
          if (!map.getSource('osm')) {
            map.addSource('osm', {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
            });
            map.addLayer(
              {
                id: 'osm-layer',
                type: 'raster',
                source: 'osm',
              },
              map.getStyle().layers?.[0]?.id
            );
          }
          if (map.getLayer('esri-satellite-layer')) map.removeLayer('esri-satellite-layer');
          if (map.getSource('esri-satellite')) map.removeSource('esri-satellite');
        }
      } catch (err) {
        console.warn('Erro ao atualizar camada base:', err);
      }
    };

    if (map.isStyleLoaded()) {
      updateBaseLayer();
    } else {
      map.once('load', updateBaseLayer);
    }
  }, [tipoMapa]);

  // Atualizar cursor quando estiver no modo de marcação de pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = isPickingPin ? 'crosshair' : '';
  }, [isPickingPin]);

  // Efeito de Foco Dinâmico (Zoom cinematográfico flyTo no mapa ao clicar na galeria)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusMidia) return;

    map.flyTo({
      center: focusMidia.coord,
      zoom: 15.5,
      pitch: 45,
      duration: 1200,
      essential: true,
    });
  }, [focusMidia]);

  // Marcador Temporário do Upload (pendingPinCoord)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pendingMarkerRef.current) {
      pendingMarkerRef.current.remove();
      pendingMarkerRef.current = null;
    }

    if (pendingPinCoord) {
      const el = document.createElement('div');
      el.className = 'flex flex-col items-center justify-center pointer-events-none z-30 animate-bounce';
      el.innerHTML = `
        <div class="relative flex items-center justify-center">
          <div class="absolute w-8 h-8 rounded-full bg-orange-500 opacity-75 animate-ping"></div>
          <div class="w-7 h-7 rounded-full bg-orange-600 border-2 border-white shadow-2xl flex items-center justify-center text-white text-xs font-bold">
            📍
          </div>
        </div>
        <div class="mt-1 bg-slate-900/95 text-orange-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-orange-500 shadow-xl backdrop-blur-md">
          Novo Ponto
        </div>
      `;

      pendingMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: 'bottom',
      })
        .setLngLat(pendingPinCoord)
        .addTo(map);

      map.flyTo({
        center: pendingPinCoord,
        zoom: 15,
        duration: 1000,
        essential: true,
      });
    }
  }, [pendingPinCoord]);

  // Renderizar Rotas GPX (Trajetos) com suporte a cores personalizadas por dia
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderRoutes = () => {
      if (!map.isStyleLoaded()) return;

      const bounds = new maplibregl.LngLatBounds();
      let hasCoordinates = false;

      etapas.forEach((etapa) => {
        const sourceId = `route-source-${etapa.numero_dia}`;
        const casingId = `route-casing-${etapa.numero_dia}`;
        const lineId = `route-line-${etapa.numero_dia}`;

        const isCurrentDay = diaSelecionado === etapa.numero_dia;
        const isVisible = diaSelecionado === null || isCurrentDay;
        const corTrajeto = etapa.cor_trajeto || '#f97316';

        // Se a fonte ainda não existir, cria
        const existingSource = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
        if (!existingSource) {
          map.addSource(sourceId, {
            type: 'geojson',
            data: etapa.geojson_rota,
          });

          // Contorno escuro da linha para contraste
          map.addLayer({
            id: casingId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
              'visibility': isVisible ? 'visible' : 'none',
            },
            paint: {
              'line-color': '#020617',
              'line-width': isCurrentDay ? 7 : 4.5,
              'line-opacity': 0.85,
            },
          });

          // Linha interna com a cor personalizada da etapa
          map.addLayer({
            id: lineId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
              'visibility': isVisible ? 'visible' : 'none',
            },
            paint: {
              'line-color': corTrajeto,
              'line-width': isCurrentDay ? 5 : 3.5,
            },
          });
        } else {
          // Atualiza dados e visibilidade sem remover nem recriar
          existingSource.setData(etapa.geojson_rota);

          if (map.getLayer(casingId)) {
            map.setLayoutProperty(casingId, 'visibility', isVisible ? 'visible' : 'none');
            map.setPaintProperty(casingId, 'line-width', isCurrentDay ? 7 : 4.5);
          }
          if (map.getLayer(lineId)) {
            map.setLayoutProperty(lineId, 'visibility', isVisible ? 'visible' : 'none');
            map.setPaintProperty(lineId, 'line-color', corTrajeto);
            map.setPaintProperty(lineId, 'line-width', isCurrentDay ? 5 : 3.5);
          }
        }

        if (isVisible && etapa.bounds) {
          const minLon = Number(etapa.bounds.min_lon);
          const minLat = Number(etapa.bounds.min_lat);
          const maxLon = Number(etapa.bounds.max_lon);
          const maxLat = Number(etapa.bounds.max_lat);

          if (!isNaN(minLon) && !isNaN(minLat) && !isNaN(maxLon) && !isNaN(maxLat)) {
            bounds.extend([minLon, minLat]);
            bounds.extend([maxLon, maxLat]);
            hasCoordinates = true;
          } else if (etapa.bounds.centro && Array.isArray(etapa.bounds.centro) && etapa.bounds.centro.length === 2) {
            const cLat = Number(etapa.bounds.centro[0]);
            const cLon = Number(etapa.bounds.centro[1]);
            if (!isNaN(cLat) && !isNaN(cLon)) {
              bounds.extend([cLon - 0.15, cLat - 0.15]);
              bounds.extend([cLon + 0.15, cLat + 0.15]);
              hasCoordinates = true;
            }
          }
        }
      });

      if (hasCoordinates) {
        map.fitBounds(bounds, {
          padding: { top: 60, bottom: 120, left: 40, right: 40 },
          maxZoom: 14,
          duration: 1000,
        });
      }
    };

    if (map.isStyleLoaded()) {
      renderRoutes();
    } else {
      map.once('load', renderRoutes);
    }
  }, [etapas, diaSelecionado]);

  // Renderizar Marcadores com Ancoragem Restrita (Snap) e Anti-Sobreposição (Spiderfier)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Limpar marcadores anteriores
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Filtrar apenas mídias com coordenadas válidas (ignorar 0,0 ou nulas)
    const midiasValidas = midias.filter((m) => {
      const lat = Number(m.latitude);
      const lon = Number(m.longitude);
      return !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0);
    });

    // Filtrar mídias pelo dia selecionado
    const etapaAtual = etapas.find((e) => e.numero_dia === diaSelecionado);
    const midiasToRender = diaSelecionado
      ? midiasValidas.filter((m) => m.etapa_id === etapaAtual?.id)
      : midiasValidas;

    // 1. Agrupar mídias muito próximas (distância geográfica < 180 metros)
    const clusters: MidiaCluster[] = [];
    const thresholdMeters = 180;

    midiasToRender.forEach((m) => {
      const existingCluster = clusters.find((c) => {
        const d = distanceMeters(c.centerCoord[0], c.centerCoord[1], m.longitude, m.latitude);
        return d < thresholdMeters;
      });

      if (existingCluster) {
        existingCluster.midias.push(m);
      } else {
        clusters.push({
          id: `cluster_${m.id}`,
          centerCoord: [m.longitude, m.latitude],
          midias: [m],
        });
      }
    });

    // 2. Renderizar cada cluster
    clusters.forEach((cluster) => {
      const isMulti = cluster.midias.length > 1;
      const isExpanded = expandedClusterId === cluster.id;
      const primaryMidia = cluster.midias[0];

      // Encontrar rota correspondente para aplicação de Snap to Route durante o drag
      const midiaEtapa = etapas.find((et) => et.id === primaryMidia.etapa_id) || etapaAtual || etapas[0];
      const routeCoords = midiaEtapa?.geojson_rota?.geometry?.coordinates || [];

      // SE NÃO ESTIVER EXPANDIDO (Marcador Único ou Marcador de Pilha)
      if (!isExpanded) {
        const el = document.createElement('div');
        el.className = 'marker-pin w-10 h-10 cursor-pointer';

        const isDrone = primaryMidia.tipo === 'video_drone';
        const isVideo = primaryMidia.tipo === 'video';
        const isPrivate = primaryMidia.is_private;
        const isHighlighted = cluster.midias.some((m) => m.id === highlightedMidiaId);

        el.innerHTML = `
          <div class="marker-card relative transition-transform duration-200 ${
            isHighlighted ? 'scale-125 ring-4 ring-orange-500 rounded-full' : ''
          }">
            ${
              isMulti
                ? `<div class="absolute -top-1 -left-1 w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-600 opacity-60"></div>
                   <div class="absolute -top-0.5 -left-0.5 w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-500 opacity-80"></div>`
                : ''
            }
            <div class="w-10 h-10 rounded-full overflow-hidden border-2 shadow-2xl bg-slate-900 ${
              isDrone
                ? 'border-red-500 ring-2 ring-red-500/30'
                : isVideo
                ? 'border-sky-500 ring-2 ring-sky-500/30'
                : isPrivate
                ? 'border-amber-400 ring-2 ring-amber-400/30'
                : 'border-white'
            }">
              <img src="${primaryMidia.url_thumbnail || primaryMidia.url_midia}" alt="${primaryMidia.titulo || ''}" class="w-full h-full object-cover select-none pointer-events-none" />
            </div>

            ${
              isMulti
                ? cluster.midias.every((m) => m.tipo === 'video_drone')
                  ? `<div class="absolute -bottom-1.5 -right-1.5 bg-red-600 text-white rounded-full px-1.5 py-0.5 text-[9px] font-extrabold shadow-lg border border-white/50 ring-1 ring-red-400 flex items-center gap-1">
                       ${DRONE_PIN_SVG}
                       <span>${cluster.midias.length}</span>
                     </div>`
                  : `<div class="absolute -bottom-1 -right-1 bg-orange-600 text-white rounded-full px-1.5 py-0.5 text-[9px] font-extrabold shadow-lg border border-white/40 flex items-center gap-0.5">
                       <span>📸</span><span>${cluster.midias.length}</span>
                     </div>`
                : isDrone
                ? `<div class="absolute -bottom-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1 shadow-lg ring-1 ring-white/50 flex items-center justify-center">
                     ${DRONE_PIN_SVG}
                   </div>`
                : isVideo
                ? `<div class="absolute -bottom-1 -right-1 bg-sky-600 text-white rounded-full p-1 shadow-md">
                     <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                   </div>`
                : isPrivate
                ? `<div class="absolute -top-1 -right-1 bg-amber-500 text-slate-950 rounded-full p-1 shadow-md">
                     <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2h1V6a5 5 0 0110 0v2h1zm-6-5a3 3 0 00-3 3v2h6V6a3 3 0 00-3-3z"/></svg>
                   </div>`
                : ''
            }
          </div>
        `;

        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (isMulti) {
            // Se tiver múltiplas fotos, abre o leque (Spiderfier)
            setExpandedClusterId(cluster.id);
          } else {
            onSelectMidia(primaryMidia);
          }
        });

        // Só permite arrastar se for 1 foto e estiver como Admin
        const marker = new maplibregl.Marker({
          element: el,
          anchor: 'center',
          draggable: isAdmin && !isMulti,
        })
          .setLngLat(cluster.centerCoord)
          .addTo(map);

        // SNAP TO ROUTE DURANTE E APÓS O ARRASTE:
        if (isAdmin && !isMulti && routeCoords.length > 0) {
          // No evento drag: atração magnética flexível (gruda perto, solta longe)
          marker.on('drag', () => {
            const currentLngLat = marker.getLngLat();
            const snapped = snapToRouteWithThreshold([currentLngLat.lng, currentLngLat.lat], routeCoords, 350);
            marker.setLngLat(snapped.coord);
          });

          // No evento dragend: salva a posição final (snapada ou livre fora da rota)
          marker.on('dragend', () => {
            const currentLngLat = marker.getLngLat();
            const snapped = snapToRouteWithThreshold([currentLngLat.lng, currentLngLat.lat], routeCoords, 350);
            marker.setLngLat(snapped.coord);
            onUpdateMidiaCoord(
              primaryMidia.id,
              snapped.coord[1],
              snapped.coord[0],
              snapped.altitude,
              snapped.kmNoTrajeto
            );
          });
        }

        markersRef.current.push(marker);
      } else {
        // SE ESTIVER EXPANDIDO EM LEQUE (SPIDERFIER):
        // Renderiza cada foto do cluster ao redor do ponto central em círculo/leque
        const total = cluster.midias.length;
        const radiusPx = Math.max(65, total * 16); // raio seguro e amplo em pixels
        const centerLngLat = cluster.centerCoord;

        // 1. Renderizar as fotos ao redor (com offset nativo do MapLibre)
        cluster.midias.forEach((m, idx) => {
          const angle = (idx / total) * 2 * Math.PI - Math.PI / 2;
          const offsetXPx = Math.round(Math.cos(angle) * radiusPx);
          const offsetYPx = Math.round(Math.sin(angle) * radiusPx);

          const itemEl = document.createElement('div');
          itemEl.className = 'marker-pin w-10 h-10 cursor-pointer animate-fadeIn';
          const isDrone = m.tipo === 'video_drone';
          const isVideo = m.tipo === 'video';
          const isPrivate = m.is_private;
          const isHighlighted = m.id === highlightedMidiaId;

          itemEl.innerHTML = `
            <div class="marker-card relative transition-transform hover:scale-125 ${
              isHighlighted ? 'scale-125 ring-4 ring-orange-500 rounded-full' : ''
            }">
              <div class="w-10 h-10 rounded-full overflow-hidden border-2 shadow-2xl bg-slate-900 ${
                isDrone
                  ? 'border-red-500 ring-2 ring-red-500/30'
                  : isVideo
                  ? 'border-sky-500 ring-2 ring-sky-500/30'
                  : isPrivate
                  ? 'border-amber-400 ring-2 ring-amber-400/30'
                  : 'border-white'
              }">
                <img src="${m.url_thumbnail || m.url_midia}" alt="${m.titulo || ''}" class="w-full h-full object-cover select-none pointer-events-none" />
              </div>
              ${
                isDrone
                  ? `<div class="absolute -bottom-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1 shadow-lg ring-1 ring-white/50 flex items-center justify-center">
                       ${DRONE_PIN_SVG}
                     </div>`
                  : isVideo
                  ? `<div class="absolute -bottom-1 -right-1 bg-sky-600 text-white rounded-full p-1 shadow-md">
                       <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                     </div>`
                  : ''
              }
              ${
                isPrivate
                  ? `<div class="absolute -top-1 -right-1 bg-amber-500 text-slate-950 rounded-full p-1 shadow-md">
                       <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17a2 2 0 100-4 2 2 0 000 4zm6-9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10a2 2 0 012-2h1V6a5 5 0 0110 0v2h1zm-6-5a3 3 0 00-3 3v2h6V6a3 3 0 00-3-3z"/></svg>
                     </div>`
                  : ''
              }
            </div>
          `;

          // Marcador com OFFSET NATIVO do MapLibre: desloca o elemento pai inteiro!
          // Permite que o Admin arraste a foto diretamente para separá-la
          const itemMarker = new maplibregl.Marker({
            element: itemEl,
            anchor: 'center',
            offset: [offsetXPx, offsetYPx],
            draggable: isAdmin,
          })
            .setLngLat(centerLngLat)
            .addTo(map);

          if (isAdmin && routeCoords.length > 0) {
            let isDragging = false;

            itemMarker.on('dragstart', () => {
              isDragging = true;
              // Remove o offset de pétala para que o marcador fique diretamente na ponta do cursor/dedo
              itemMarker.setOffset([0, 0]);
            });

            itemMarker.on('drag', () => {
              const currentLngLat = itemMarker.getLngLat();
              const snapped = snapToRouteWithThreshold([currentLngLat.lng, currentLngLat.lat], routeCoords, 350);
              itemMarker.setLngLat(snapped.coord);
            });

            itemMarker.on('dragend', () => {
              const currentLngLat = itemMarker.getLngLat();
              const snapped = snapToRouteWithThreshold([currentLngLat.lng, currentLngLat.lat], routeCoords, 350);
              itemMarker.setLngLat(snapped.coord);
              // Fecha o leque para que os clusters sejam recalculados na nova posição
              setExpandedClusterId(null);
              onUpdateMidiaCoord(
                m.id,
                snapped.coord[1],
                snapped.coord[0],
                snapped.altitude,
                snapped.kmNoTrajeto
              );
            });

            itemEl.addEventListener('click', (ev) => {
              ev.stopPropagation();
              if (isDragging) return;
              setExpandedClusterId(null); // Fecha o leque ao abrir a foto em tela cheia
              onSelectMidia(m);
            });
          } else {
            itemEl.addEventListener('click', (ev) => {
              ev.stopPropagation();
              setExpandedClusterId(null); // Fecha o leque ao abrir a foto em tela cheia
              onSelectMidia(m);
            });
          }

          markersRef.current.push(itemMarker);
        });

        // 2. Ponto central de ancoragem com botão de fechar leque (z-index adequado ao mapa)
        const centerEl = document.createElement('div');
        centerEl.className = 'spiderfier-center-pin';
        centerEl.innerHTML = `
          <div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-orange-500 shadow-2xl flex items-center justify-center text-orange-400 font-black text-sm hover:bg-orange-500 hover:text-white active:scale-90 transition-all cursor-pointer">
            ✕
          </div>
        `;

        const handleCloseSpiderfier = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
          setExpandedClusterId(null);
        };

        centerEl.addEventListener('click', handleCloseSpiderfier);
        centerEl.addEventListener('touchend', handleCloseSpiderfier);
        centerEl.addEventListener('pointerdown', (ev) => ev.stopPropagation());

        const centerMarker = new maplibregl.Marker({
          element: centerEl,
          anchor: 'center',
        })
          .setLngLat(centerLngLat)
          .addTo(map);

        centerMarker.getElement().style.zIndex = '30';
        markersRef.current.push(centerMarker);
      }
    });
  }, [midias, diaSelecionado, etapas, isAdmin, expandedClusterId, highlightedMidiaId]);

  // Marcador móvel do cursor de altimetria (hover sincronizado)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (hoverCoord) {
      if (!hoverMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-lg animate-pulse';
        hoverMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat(hoverCoord)
          .addTo(map);
      } else {
        hoverMarkerRef.current.setLngLat(hoverCoord);
      }
    } else {
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.remove();
        hoverMarkerRef.current = null;
      }
    }
  }, [hoverCoord]);

  return (
    <div className="relative w-full h-full min-h-[450px]">
      <div ref={mapContainerRef} className="w-full h-full" />
      {isPickingPin && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-bounce z-30">
          <span>Clique na rota para ancorar a foto diretamente ao caminho</span>
        </div>
      )}
      {expandedClusterId && isAdmin && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-orange-500 text-orange-300 text-xs font-medium px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 z-30 backdrop-blur-md animate-fadeIn">
          <span>💡 Arraste qualquer foto do leque para separá-la na rota</span>
        </div>
      )}

      {/* Barra Flutuante de Filtro Rápido no Mapa (Ordem: Drone, Vídeos, Fotos) */}
      {mediaFilters && onToggleFilter && (
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-20 bg-slate-950/90 backdrop-blur-md border border-slate-800 shadow-2xl rounded-2xl p-1 sm:p-1.5 flex items-center gap-1 sm:gap-1.5 max-w-[calc(100vw-24px)] overflow-x-auto">
          {/* 1. Check Drone */}
          <button
            type="button"
            onClick={() => onToggleFilter('video_drone')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shrink-0 ${
              mediaFilters.video_drone
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/60'
            }`}
            title="Mostrar ou ocultar vídeos de drone no mapa"
          >
            <div
              className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] transition shrink-0 ${
                mediaFilters.video_drone
                  ? 'bg-red-600 border-red-500 text-white'
                  : 'border-slate-600 bg-slate-800'
              }`}
            >
              {mediaFilters.video_drone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <DroneIcon className="w-4 h-4 text-red-400 shrink-0" />
            <span>Drone</span>
          </button>

          {/* 2. Check Vídeos */}
          <button
            type="button"
            onClick={() => onToggleFilter('video')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shrink-0 ${
              mediaFilters.video
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/60'
            }`}
            title="Mostrar ou ocultar vídeos comuns no mapa"
          >
            <div
              className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] transition shrink-0 ${
                mediaFilters.video
                  ? 'bg-sky-600 border-sky-500 text-white'
                  : 'border-slate-600 bg-slate-800'
              }`}
            >
              {mediaFilters.video && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <Video className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Vídeos</span>
          </button>

          {/* 3. Check Fotos */}
          <button
            type="button"
            onClick={() => onToggleFilter('foto')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shrink-0 ${
              mediaFilters.foto
                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/60'
            }`}
            title="Mostrar ou ocultar fotos no mapa"
          >
            <div
              className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] transition shrink-0 ${
                mediaFilters.foto
                  ? 'bg-orange-600 border-orange-500 text-white'
                  : 'border-slate-600 bg-slate-800'
              }`}
            >
              {mediaFilters.foto && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            </div>
            <Camera className="w-4 h-4 text-orange-400 shrink-0" />
            <span>Fotos</span>
          </button>
        </div>
      )}
    </div>
  );
}
