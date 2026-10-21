'use client';

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Etapa, Midia, MediaFilters } from '@/lib/supabase';
import { snapToRoute, snapToRouteWithThreshold, distanceMeters } from '@/lib/geo';
import { Camera, Video, Film, Check } from 'lucide-react';
import DroneIcon from '@/components/icons/DroneIcon';

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
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const hoverMarkerRef = useRef<maplibregl.Marker | null>(null);

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
          bounds.extend([etapa.bounds.min_lon, etapa.bounds.min_lat]);
          bounds.extend([etapa.bounds.max_lon, etapa.bounds.max_lat]);
          hasCoordinates = true;
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

    // Filtrar mídias pelo dia selecionado
    const etapaAtual = etapas.find((e) => e.numero_dia === diaSelecionado);
    const midiasToRender = diaSelecionado
      ? midias.filter((m) => m.etapa_id === etapaAtual?.id)
      : midias;

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
                ? `<div class="absolute -bottom-1 -right-1 bg-orange-600 text-white rounded-full px-1.5 py-0.5 text-[9px] font-extrabold shadow-lg border border-white/40 flex items-center gap-0.5">
                     <span>📸</span><span>${cluster.midias.length}</span>
                   </div>`
                : isDrone
                ? `<div class="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-1 shadow-md">
                     <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                       <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" fill-opacity="0.3"/>
                       <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
                       <path d="M9 9 5.5 5.5M15 9l3.5-3.5M9 15l-3.5 3.5M15 15l3.5 3.5"/>
                       <line x1="2.5" y1="5.5" x2="8.5" y2="5.5"/>
                       <line x1="15.5" y1="5.5" x2="21.5" y2="5.5"/>
                       <line x1="2.5" y1="18.5" x2="8.5" y2="18.5"/>
                       <line x1="15.5" y1="18.5" x2="21.5" y2="18.5"/>
                     </svg>
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
                  ? `<div class="absolute -bottom-1 -right-1 bg-red-600 text-white rounded-full p-1 shadow-md">
                       <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                         <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" fill-opacity="0.3"/>
                         <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
                         <path d="M9 9 5.5 5.5M15 9l3.5-3.5M9 15l-3.5 3.5M15 15l3.5 3.5"/>
                         <line x1="2.5" y1="5.5" x2="8.5" y2="5.5"/>
                         <line x1="15.5" y1="5.5" x2="21.5" y2="5.5"/>
                         <line x1="2.5" y1="18.5" x2="8.5" y2="18.5"/>
                         <line x1="15.5" y1="18.5" x2="21.5" y2="18.5"/>
                       </svg>
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
