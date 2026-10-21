with open('components/Map.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text_norm = text.replace('\r\n', '\n')

old_part = """        const isCurrentDay = diaSelecionado === etapa.numero_dia;
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
        }"""

new_part = """        const isCurrentDay = diaSelecionado === etapa.numero_dia;
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
        }"""

if old_part in text_norm:
    text_norm = text_norm.replace(old_part, new_part)
    with open('components/Map.tsx', 'w', encoding='utf-8') as f:
        f.write(text_norm)
    print("Map.tsx atualizado com corTrajeto!")
else:
    print("old_part não encontrada em Map.tsx")
