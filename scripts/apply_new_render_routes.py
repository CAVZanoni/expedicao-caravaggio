with open('components/Map.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

idx1 = code.find('  // Renderizar Rotas GPX (Trajetos)')
idx2 = code.find('  // Renderizar Marcadores de Mídia (Miniaturas Circulares)')

new_render_routes = """  // Renderizar Rotas GPX (Trajetos)
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
              'line-width': isCurrentDay ? 7 : 4,
              'line-opacity': 0.8,
            },
          });

          // Linha interna laranja vibrante
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
              'line-color': isCurrentDay ? '#fc4c02' : '#f97316',
              'line-width': isCurrentDay ? 4.5 : 2.5,
            },
          });
        } else {
          // Atualiza dados e visibilidade sem remover nem recriar
          existingSource.setData(etapa.geojson_rota);

          if (map.getLayer(casingId)) {
            map.setLayoutProperty(casingId, 'visibility', isVisible ? 'visible' : 'none');
            map.setPaintProperty(casingId, 'line-width', isCurrentDay ? 7 : 4);
          }
          if (map.getLayer(lineId)) {
            map.setLayoutProperty(lineId, 'visibility', isVisible ? 'visible' : 'none');
            map.setPaintProperty(lineId, 'line-color', isCurrentDay ? '#fc4c02' : '#f97316');
            map.setPaintProperty(lineId, 'line-width', isCurrentDay ? 4.5 : 2.5);
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

"""

if idx1 != -1 and idx2 != -1:
    new_code = code[:idx1] + new_render_routes + code[idx2:]
    with open('components/Map.tsx', 'w', encoding='utf-8') as f:
        f.write(new_code)
    print("renderRoutes atualizado com sucesso!")
else:
    print("Índices não encontrados.")
