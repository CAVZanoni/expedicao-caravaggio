import os
import json
import glob
from PIL import Image
import requests

SUPABASE_URL = "https://mmrutnyypisikfxgvsnz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcnV0bnl5cGlzaWtmeGd2c256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NTk1MjEsImV4cCI6MjEwODAzNTUyMX0.JKv_Hr-OpWCUP3UnyQI-ty7rbx5ky41UCIQE5W4SWIw"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# 1. Carregar as etapas cadastradas no Supabase
resp = requests.get(f"{SUPABASE_URL}/rest/v1/etapas?select=id,numero_dia,data,geojson_rota", headers=headers)
if resp.status_code != 200:
    print("Erro ao buscar etapas:", resp.text)
    exit(1)

etapas_db = {e["numero_dia"]: e for e in resp.json()}

# 2. Localizar pasta do WhatsApp
wa_folders = [d for d in os.listdir('.') if os.path.isdir(d) and 'WhatsApp' in d]
if not wa_folders:
    print("Pasta do WhatsApp não encontrada")
    exit(1)
wa_folder = wa_folders[0]

os.makedirs("public/thumbnails", exist_ok=True)

# Mapeamento data string no nome -> dia
date_map = {
    "20261009": 1,
    "20261010": 2,
    "20261011": 3,
    "20261012": 4,
    "20261014": 5,
    "20261015": 6,
    "20261016": 7,
    "20261017": 7 # fotos da chegada em Nova Petrópolis/Farroupilha enviadas no dia 17
}

midias_inseridas = 0

for date_str, dia_num in date_map.items():
    etapa = etapas_db.get(dia_num)
    if not etapa:
        continue
    
    coords = etapa["geojson_rota"]["geometry"]["coordinates"]
    num_pts = len(coords)
    
    # Buscar fotos desse dia
    pattern = os.path.join(wa_folder, f"IMG-{date_str}-*.jpg")
    files = sorted(glob.glob(pattern))
    
    # Selecionar até 6 fotos representativas espalhadas pelo dia
    if not files:
        continue
    
    step = max(1, len(files) // 6)
    selected_files = files[::step][:6]
    
    for idx, fpath in enumerate(selected_files):
        fname = os.path.basename(fpath)
        thumb_name = f"{os.path.splitext(fname)[0]}.webp"
        thumb_path = os.path.join("public", "thumbnails", thumb_name)
        
        # Gerar miniatura WebP de alta qualidade e leve
        if not os.path.exists(thumb_path):
            try:
                with Image.open(fpath) as img:
                    img.thumbnail((320, 320))
                    img.save(thumb_path, "WEBP", quality=80)
            except Exception as e:
                print(f"Erro ao processar imagem {fname}: {e}")
                continue
        
        # Posicionar ao longo da rota
        pt_idx = int((idx / max(1, len(selected_files) - 1)) * (num_pts - 1))
        lon, lat, ele = coords[pt_idx]
        
        # Inserir no Supabase
        payload = {
            "etapa_id": etapa["id"],
            "tipo": "foto",
            "origem": "whatsapp",
            "titulo": f"Dia {dia_num} - {fname}",
            "arquivo_nome": fname,
            "url_midia": f"/thumbnails/{thumb_name}",
            "url_thumbnail": f"/thumbnails/{thumb_name}",
            "latitude": lat,
            "longitude": lon,
            "altitude": ele,
            "is_private": False,
            "posicao": f"POINT({lon} {lat})"
        }
        
        # Usar RPC ou insert via REST
        insert_resp = requests.post(
            f"{SUPABASE_URL}/rest/v1/midias",
            headers=headers,
            json=payload
        )
        if insert_resp.status_code in [200, 201]:
            midias_inseridas += 1
            print(f"Foto inserida: Dia {dia_num} - {fname} ({lat:.5f}, {lon:.5f})")
        else:
            print(f"Erro ao inserir {fname}: {insert_resp.status_code} - {insert_resp.text}")

print(f"\nTotal de fotos iniciais importadas e posicionadas no mapa: {midias_inseridas}")
