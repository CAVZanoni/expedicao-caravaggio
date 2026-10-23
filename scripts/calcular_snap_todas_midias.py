import json
import math
import os
import re

def distance_meters(lon1, lat1, lon2, lat2):
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def project_point_on_segment(px, py, ax, ay, bx, by):
    dx = bx - ax
    dy = by - ay
    lensq = dx*dx + dy*dy
    if lensq == 0:
        return ax, ay, 0.0
    t = max(0.0, min(1.0, ((px - ax)*dx + (py - ay)*dy) / lensq))
    return ax + t*dx, ay + t*dy, t

def snap_to_route(point, route_coords):
    if not route_coords or len(route_coords) < 2:
        return point, 0, None
    plon, plat = point
    min_dist = float('inf')
    best_coord = route_coords[0][:2]
    best_seg = 0
    best_t = 0.0

    for i in range(len(route_coords) - 1):
        p1 = route_coords[i]
        p2 = route_coords[i+1]
        proj_x, proj_y, t = project_point_on_segment(plon, plat, p1[0], p1[1], p2[0], p2[1])
        d = distance_meters(plon, plat, proj_x, proj_y)
        if d < min_dist:
            min_dist = d
            best_coord = [proj_x, proj_y]
            best_seg = i
            best_t = t

    cum_dist = 0.0
    for i in range(best_seg):
        cum_dist += distance_meters(route_coords[i][0], route_coords[i][1], route_coords[i+1][0], route_coords[i+1][1])
    
    seg_len = distance_meters(route_coords[best_seg][0], route_coords[best_seg][1], route_coords[best_seg+1][0], route_coords[best_seg+1][1])
    cum_dist += seg_len * best_t
    km = round(cum_dist / 1000.0, 1)

    return best_coord, round(min_dist), km

# Mapeamento numero_dia <-> etapa_id
dia_to_id = {
    1: '4455bcec-7519-4105-9439-5ddc1560002a',
    2: 'dd004945-e40a-4d10-ae7e-c6fddeedb583',
    3: '89cc0a96-8222-4ef3-9a5a-e55858020d36',
    4: '69741075-91f0-4f8e-aa73-ca650a2212d9',
    5: 'e5e5e5e5-1310-4000-8000-000000000005',
    6: '62fd4037-76db-488a-bd72-cf27e2525f32',
    7: '6d264508-6787-4390-b75e-3c30dcebfbc8',
    8: '6bec6682-16f1-4a39-b3fb-c8299aab0f6a'
}
id_to_dia = {v: k for k, v in dia_to_id.items()}

# 1. Carregar rotas de public/data/expedicao.json
with open('public/data/expedicao.json', 'r', encoding='utf-8') as f:
    exp_data = json.load(f)

etapas_routes = {}
for e in exp_data['etapas']:
    nd = e['numero_dia']
    coords = e.get('geojson', {}).get('geometry', {}).get('coordinates', [])
    if not coords:
        coords = e.get('geojson_rota', {}).get('geometry', {}).get('coordinates', [])
    etapas_routes[nd] = coords

# 2. Carregar mídias do Supabase
with open(r'C:\Users\cesar\.gemini\antigravity\brain\26588a0b-1e80-43cb-8b67-915307c2a7ce\.system_generated\steps\1865\output.txt', 'r', encoding='utf-8') as f:
    raw = json.load(f)

result_str = raw['result']
match = re.search(r'\[\s*\{.*\}\s*\]', result_str, re.DOTALL)
midias = json.loads(match.group(0))

print(f"Total de mídias: {len(midias)}")

updates = []
for m in midias:
    etapa_id = m.get('etapa_id')
    lat = float(m['latitude']) if m.get('latitude') is not None else None
    lon = float(m['longitude']) if m.get('longitude') is not None else None
    current_km = m.get('km_no_trajeto')

    if not lat or not lon or (lat == 0 and lon == 0):
        continue

    dia = id_to_dia.get(etapa_id)
    if dia and dia in etapas_routes:
        coords = etapas_routes[dia]
        if coords and len(coords) > 1:
            best_coord, dist_m, km = snap_to_route([lon, lat], coords)
            if current_km is None:
                updates.append({
                    'id': m['id'],
                    'arquivo_nome': m['arquivo_nome'],
                    'dia': dia,
                    'dist_m': dist_m,
                    'km': km
                })
                print(f"Mídia {m['arquivo_nome']} (Dia {dia}): dist={dist_m}m -> km={km}")

print(f"\nTotal a atualizar: {len(updates)}")

sql_statements = []
for u in updates:
    sql = f"UPDATE midias SET km_no_trajeto = {u['km']} WHERE id = '{u['id']}';"
    sql_statements.append(sql)

with open(r'C:\Users\cesar\.gemini\antigravity\brain\26588a0b-1e80-43cb-8b67-915307c2a7ce\scratch\updates_km.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_statements))

print("SQL salvo em updates_km.sql")
