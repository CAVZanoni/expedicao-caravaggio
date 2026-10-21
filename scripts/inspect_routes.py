import json

with open('data/expedicao.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for e in data['etapas']:
    coords = e['geojson']['geometry']['coordinates']
    print(f"Dia {e['numero_dia']}: {e['titulo']}")
    print(f"  Inicio: lon={coords[0][0]}, lat={coords[0][1]}")
    print(f"  Meio:   lon={coords[len(coords)//2][0]}, lat={coords[len(coords)//2][1]}")
    print(f"  Fim:    lon={coords[-1][0]}, lat={coords[-1][1]}")
