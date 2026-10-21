import os
import json
import math
from datetime import datetime
import gpxpy
import gpxpy.gpx

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calcula a distância entre duas coordenadas em quilômetros."""
    R = 6371.0 # Raio da Terra em km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

GPX_MAPPING = [
    {
        "numero_dia": 1,
        "arquivo": "activity_24667293360.gpx",
        "data": "2026-10-09",
        "titulo": "Etapa 1 - Lauro Müller",
        "cidade_origem": "Lauro Müller",
        "cidade_destino": "Lauro Müller"
    },
    {
        "numero_dia": 2,
        "arquivo": "activity_24678784325.gpx",
        "data": "2026-10-10",
        "titulo": "Etapa 2 - Subida da Serra do Rio do Rastro",
        "cidade_origem": "Lauro Müller",
        "cidade_destino": "Bom Jardim da Serra"
    },
    {
        "numero_dia": 3,
        "arquivo": "activity_24690517212.gpx",
        "data": "2026-10-11",
        "titulo": "Etapa 3 - Cânions de São José dos Ausentes",
        "cidade_origem": "Bom Jardim da Serra",
        "cidade_destino": "São José dos Ausentes"
    },
    {
        "numero_dia": 4,
        "arquivo": "activity_24702194329.gpx",
        "data": "2026-10-12",
        "titulo": "Etapa 4 - Descida dos Cânions para Turvo",
        "cidade_origem": "São José dos Ausentes",
        "cidade_destino": "Turvo"
    },
    {
        "numero_dia": 5,
        "arquivo": "activity_24723658278.gpx",
        "data": "2026-10-14",
        "titulo": "Etapa 5 - Campos de Cima da Serra (São Francisco de Paula)",
        "cidade_origem": "Cambará do Sul",
        "cidade_destino": "São Francisco de Paula"
    },
    {
        "numero_dia": 6,
        "arquivo": "activity_24735221335.gpx",
        "data": "2026-10-15",
        "titulo": "Etapa 6 - Rumo à Serra Gaúcha (Gramado)",
        "cidade_origem": "São Francisco de Paula",
        "cidade_destino": "Gramado"
    },
    {
        "numero_dia": 7,
        "arquivo": "activity_24750527261.gpx",
        "data": "2026-10-16",
        "titulo": "Etapa 7 - Caminho de Caravaggio (Nova Petrópolis e Farroupilha)",
        "cidade_origem": "Gramado",
        "cidade_destino": "Nova Petrópolis / Caravaggio"
    }
]

def process_gpx_file(item):
    filepath = item["arquivo"]
    if not os.path.exists(filepath):
        print(f"Arquivo não encontrado: {filepath}")
        return None

    print(f"Processando Dia {item['numero_dia']}: {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        gpx = gpxpy.parse(f)

    raw_points = []
    for track in gpx.tracks:
        for segment in track.segments:
            for pt in segment.points:
                raw_points.append({
                    "lat": pt.latitude,
                    "lon": pt.longitude,
                    "ele": pt.elevation if pt.elevation is not None else 0.0,
                    "time": pt.time.isoformat() if pt.time else None
                })

    if not raw_points:
        print(f"Nenhum ponto no GPX {filepath}")
        return None

    total_dist_km = 0.0
    ganho_elevacao = 0.0
    perda_elevacao = 0.0
    alt_min = raw_points[0]["ele"]
    alt_max = raw_points[0]["ele"]
    
    lats = [p["lat"] for p in raw_points]
    lons = [p["lon"] for p in raw_points]
    bounds = {
        "min_lat": min(lats),
        "max_lat": max(lats),
        "min_lon": min(lons),
        "max_lon": max(lons),
        "centro": [(min(lats) + max(lats)) / 2.0, (min(lons) + max(lons)) / 2.0]
    }

    cum_distances = [0.0]
    for i in range(1, len(raw_points)):
        p1 = raw_points[i-1]
        p2 = raw_points[i]
        d = haversine_distance(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
        total_dist_km += d
        cum_distances.append(total_dist_km)

        diff_ele = p2["ele"] - p1["ele"]
        # Filtrar micro-ruído de GPS (< 0.5m)
        if diff_ele > 0.5:
            ganho_elevacao += diff_ele
        elif diff_ele < -0.5:
            perda_elevacao += abs(diff_ele)

        if p2["ele"] < alt_min:
            alt_min = p2["ele"]
        if p2["ele"] > alt_max:
            alt_max = p2["ele"]

    # Amostragem da rota para GeoJSON (em torno de 1200 pontos para leveza máxima)
    step = max(1, len(raw_points) // 1200)
    sampled_coords = []
    for idx in range(0, len(raw_points), step):
        pt = raw_points[idx]
        sampled_coords.append([round(pt["lon"], 6), round(pt["lat"], 6), round(pt["ele"], 1)])
    # Garantir o último ponto
    last = raw_points[-1]
    sampled_coords.append([round(last["lon"], 6), round(last["lat"], 6), round(last["ele"], 1)])

    # Perfil altimétrico para o gráfico (300 pontos com distância acumulada)
    elev_step = max(1, len(raw_points) // 300)
    perfil_altimetria = []
    for idx in range(0, len(raw_points), elev_step):
        pt = raw_points[idx]
        perfil_altimetria.append({
            "km": round(cum_distances[idx], 2),
            "altitude": round(pt["ele"], 1),
            "lat": round(pt["lat"], 6),
            "lon": round(pt["lon"], 6),
            "time": pt["time"]
        })
    perfil_altimetria.append({
        "km": round(total_dist_km, 2),
        "altitude": round(last["ele"], 1),
        "lat": round(last["lat"], 6),
        "lon": round(last["lon"], 6),
        "time": last["time"]
    })

    # Duração total
    t_start = raw_points[0]["time"]
    t_end = raw_points[-1]["time"]
    duracao_segundos = 0
    if t_start and t_end:
        dt1 = datetime.fromisoformat(t_start.replace("Z", "+00:00"))
        dt2 = datetime.fromisoformat(t_end.replace("Z", "+00:00"))
        duracao_segundos = int((dt2 - dt1).total_seconds())

    etapa = {
        "numero_dia": item["numero_dia"],
        "data": item["data"],
        "titulo": item["titulo"],
        "cidade_origem": item["cidade_origem"],
        "cidade_destino": item["cidade_destino"],
        "arquivo_gpx": item["arquivo"],
        "distancia_km": round(total_dist_km, 2),
        "altimetria_ganho": int(round(ganho_elevacao)),
        "altimetria_perda": int(round(perda_elevacao)),
        "alt_min": round(alt_min, 1),
        "alt_max": round(alt_max, 1),
        "duracao_segundos": duracao_segundos,
        "inicio_iso": t_start,
        "fim_iso": t_end,
        "total_pontos_bruto": len(raw_points),
        "total_pontos_rota": len(sampled_coords),
        "bounds": bounds,
        "perfil_altimetria": perfil_altimetria,
        "geojson": {
            "type": "Feature",
            "properties": {
                "dia": item["numero_dia"],
                "titulo": item["titulo"],
                "distancia_km": round(total_dist_km, 2),
                "ganho_m": int(round(ganho_elevacao))
            },
            "geometry": {
                "type": "LineString",
                "coordinates": sampled_coords
            }
        }
    }
    return etapa

def main():
    os.makedirs("public/data", exist_ok=True)
    os.makedirs("data", exist_ok=True)
    
    etapas = []
    dist_total_expedicao = 0.0
    ganho_total_expedicao = 0

    for item in GPX_MAPPING:
        etapa = process_gpx_file(item)
        if etapa:
            etapas.append(etapa)
            dist_total_expedicao += etapa["distancia_km"]
            ganho_total_expedicao += etapa["altimetria_ganho"]

    resumo_geral = {
        "titulo": "Expedição Cânions & Caminho de Caravaggio",
        "total_dias": len(etapas),
        "distancia_total_km": round(dist_total_expedicao, 2),
        "ganho_elevacao_total_m": ganho_total_expedicao,
        "data_inicio": etapas[0]["data"] if etapas else None,
        "data_fim": etapas[-1]["data"] if etapas else None,
        "onedrive_pasta_url": "https://1drv.ms/f/c/09c8d0f014d1e01e/IgAXE9PPsYxoRbSjG9AecPxYAVA41DKYhrmABFtio__iX2o",
        "etapas": etapas
    }

    with open("public/data/expedicao.json", "w", encoding="utf-8") as f:
        json.dump(resumo_geral, f, ensure_ascii=False, indent=2)

    with open("data/expedicao.json", "w", encoding="utf-8") as f:
        json.dump(resumo_geral, f, ensure_ascii=False, indent=2)

    print("\n" + "="*50)
    print("RESUMO DA EXPEDIÇÃO PROCESSADA COM SUCESSO:")
    print(f"Total de Dias: {len(etapas)}")
    print(f"Distância Total: {dist_total_expedicao:.2f} km")
    print(f"Altimetria Positiva Acumulada: {ganho_total_expedicao} m")
    print("="*50)
    for e in etapas:
        print(f"Dia {e['numero_dia']} ({e['data']}): {e['titulo']} | {e['distancia_km']} km | +{e['altimetria_ganho']}m | Pontos: {e['total_pontos_bruto']} -> {e['total_pontos_rota']}")

if __name__ == "__main__":
    main()
