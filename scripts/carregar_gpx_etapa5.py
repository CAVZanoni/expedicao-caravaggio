#!/usr/bin/env python3
"""
Script Utilitário: carregar_gpx_etapa5.py
Permite carregar o arquivo GPX da Etapa 5 (Turvo a Cambará do Sul - 13/10/2026) fornecido
por qualquer amigo do grupo que pedalou na etapa.

Uso:
    python scripts/carregar_gpx_etapa5.py <caminho_do_arquivo.gpx>
"""

import sys
import os
import json
import math
import gpxpy
import gpxpy.gpx
import requests

SUPABASE_URL = "https://mmrutnyypisikfxgvsnz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcnV0bnl5cGlzaWtmeGd2c256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NTk1MjEsImV4cCI6MjEwODAzNTUyMX0.JKv_Hr-OpWCUP3UnyQI-ty7rbx5ky41UCIQE5W4SWIw"
ETAPA_5_ID = "e5e5e5e5-1310-4000-8000-000000000005"

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000 # metros
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def process_gpx(gpx_path):
    if not os.path.exists(gpx_path):
        print(f"Erro: Arquivo não encontrado: {gpx_path}")
        sys.exit(1)

    print(f"Lendo e processando arquivo GPX: {gpx_path}...")
    with open(gpx_path, 'r', encoding='utf-8', errors='ignore') as f:
        gpx = gpxpy.parse(f)

    points = []
    for track in gpx.tracks:
        for segment in track.segments:
            for pt in segment.points:
                points.append(pt)

    if not points:
        print("Erro: Nenhum ponto geográfico encontrado no GPX.")
        sys.exit(1)

    print(f"Total de pontos brutos no GPX: {len(points)}")

    # Calcular distâncias e altimetrias
    coordinates = []
    perfil_altimetria = []
    dist_total_m = 0.0
    alt_ganho = 0.0
    alt_perda = 0.0
    alt_min = points[0].elevation or 0.0
    alt_max = points[0].elevation or 0.0

    last_pt = None
    step_sampling = max(1, len(points) // 1500) # Amostragem balanceada ~1500 pts

    for i, pt in enumerate(points):
        lat = pt.latitude
        lon = pt.longitude
        alt = pt.elevation or 0.0
        time_iso = pt.time.isoformat() if pt.time else None

        alt_min = min(alt_min, alt)
        alt_max = max(alt_max, alt)

        if last_pt:
            d = haversine_distance(last_pt.latitude, last_pt.longitude, lat, lon)
            dist_total_m += d
            diff_alt = alt - (last_pt.elevation or 0.0)
            if diff_alt > 0:
                alt_ganho += diff_alt
            else:
                alt_perda += abs(diff_alt)

        last_pt = pt

        if i % step_sampling == 0 or i == len(points) - 1:
            coordinates.append([lon, lat])
            perfil_altimetria.append({
                "km": round(dist_total_m / 1000.0, 2),
                "altitude": round(alt, 1),
                "lat": lat,
                "lon": lon,
                "time": time_iso
            })

    dist_km = round(dist_total_m / 1000.0, 2)
    alt_ganho = round(alt_ganho)
    alt_perda = round(alt_perda)

    geojson_rota = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coordinates
        },
        "properties": {
            "etapa": 5,
            "distancia_km": dist_km,
            "altimetria_ganho": alt_ganho,
            "altimetria_perda": alt_perda
        }
    }

    bounds = {
        "min_lat": min(p.latitude for p in points),
        "max_lat": max(p.latitude for p in points),
        "min_lon": min(p.longitude for p in points),
        "max_lon": max(p.longitude for p in points),
        "centro": [
            (min(p.latitude for p in points) + max(p.latitude for p in points)) / 2.0,
            (min(p.longitude for p in points) + max(p.longitude for p in points)) / 2.0
        ]
    }

    print(f"Distância Total: {dist_km} km | Ganho Elev.: +{alt_ganho} m | Perda: -{alt_perda} m")
    print(f"Total de pontos na rota renderizada: {len(coordinates)}")

    return {
        "distancia_km": dist_km,
        "altimetria_ganho": alt_ganho,
        "altimetria_perda": alt_perda,
        "alt_min": round(alt_min, 1),
        "alt_max": round(alt_max, 1),
        "geojson_rota": geojson_rota,
        "perfil_altimetria": perfil_altimetria,
        "bounds": bounds
    }

def update_supabase(etapa_data):
    print("Atualizando Etapa 5 no Supabase...")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    url = f"{SUPABASE_URL}/rest/v1/etapas?id=eq.{ETAPA_5_ID}"
    resp = requests.patch(url, headers=headers, json=etapa_data)
    if resp.status_code not in (200, 204):
        print(f"Erro ao atualizar Supabase: {resp.status_code} - {resp.text}")
    else:
        print("Etapa 5 atualizada com sucesso no Supabase!")

def update_local_json(etapa_data):
    for path in [r'd:\.ANTIGRAVITY\WEBAPP_CARAVAGGIO\public\data\expedicao.json', r'd:\.ANTIGRAVITY\WEBAPP_CARAVAGGIO\data\expedicao.json']:
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                d = json.load(f)
            for e in d.get('etapas', []):
                if e.get('numero_dia') == 5:
                    e.update(etapa_data)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(d, f, ensure_ascii=False, indent=2)
            print(f"Atualizado arquivo local: {path}")

def apply_magnetic_snap_to_midias(perfil_altimetria, threshold_meters=350):
    print(f"Aplicando algoritmo de atração magnética nos pins da Etapa 5 (threshold: {threshold_meters}m)...")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    # Buscar mídias da etapa 5
    url = f"{SUPABASE_URL}/rest/v1/midias?etapa_id=eq.{ETAPA_5_ID}"
    resp = requests.get(url, headers=headers)
    if resp.status_code != 200:
        print("Erro ao buscar mídias:", resp.text)
        return

    midias = resp.json()
    snapped = 0
    for m in midias:
        lat = float(m.get('latitude') or 0)
        lon = float(m.get('longitude') or 0)
        if lat == 0 or lon == 0:
            continue

        best_d = float('inf')
        best_pt = None
        for pt in perfil_altimetria:
            d = haversine_distance(lat, lon, pt['lat'], pt['lon'])
            if d < best_d:
                best_d = d
                best_pt = pt

        if best_pt and best_d <= threshold_meters:
            patch_url = f"{SUPABASE_URL}/rest/v1/midias?id=eq.{m['id']}"
            update_body = {
                "km_no_trajeto": best_pt['km']
            }
            requests.patch(patch_url, headers=headers, json=update_body)
            snapped += 1
            print(f"  ✓ Mídia {m.get('arquivo_nome')} atraída magneticamente para km {best_pt['km']} (distância: {best_d:.1f}m)")

    print(f"Total de mídias da Etapa 5 ancoradas na nova rota: {snapped}/{len(midias)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python scripts/carregar_gpx_etapa5.py <caminho_do_arquivo.gpx>")
        sys.exit(1)

    gpx_path = sys.argv[1]
    etapa_data = process_gpx(gpx_path)
    update_supabase(etapa_data)
    update_local_json(etapa_data)
    apply_magnetic_snap_to_midias(etapa_data['perfil_altimetria'])
    print("\nProcesso concluído! A nova rota da Etapa 5 já está disponível no webapp.")
