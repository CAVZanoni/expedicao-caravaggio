import urllib.request
import json
import os
import re

video_ids = [
    "4qpg-Dq291M",
    "4ww6Nv4Ss78",
    "2CgdvTpGzMY",
    "rTThqxyUX3w",
    "V6rF_apQEA8",
    "_QgD_yZ66q0",
    "iUQ0dAxcZSY",
    "RBgS9FsuoCA",
    "gdcmyk3LgsI",
    "IqLmSEhb_WE"
]

drone_base = r'C:\Users\cesar\OneDrive\DRONE\D_CARAVAGGIO'

# Mapear todos os arquivos SRT existentes no OneDrive
srt_files_map = {}
for root, dirs, files in os.walk(drone_base):
    for f in files:
        if f.upper().endswith('.SRT'):
            # chave limpa sem pontuação: DJI_20261009102256_0009_D -> DJI202610091022560009D
            clean_key = re.sub(r'[\s_-]+', '', os.path.splitext(f)[0]).upper()
            srt_files_map[clean_key] = os.path.join(root, f)

print(f"Total de arquivos SRT mapeados no OneDrive: {len(srt_files_map)}")

matched_videos = []

for idx, vid in enumerate(video_ids, 1):
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid}&format=json"
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            title = data.get('title', '').strip()
            
            # Buscar arquivo SRT correspondente
            clean_title = re.sub(r'[\s_-]+', '', title).upper()
            srt_path = srt_files_map.get(clean_title)
            
            # Extrair coordenadas do SRT se encontrado
            coords = []
            if srt_path and os.path.exists(srt_path):
                with open(srt_path, 'r', encoding='utf-8', errors='ignore') as srt_f:
                    srt_content = srt_f.read()
                    # Buscar [latitude: -28.xxxx] [longitude: -49.xxxx] [rel_alt: xx abs_alt: xx]
                    found = re.findall(r'\[latitude:\s*([-\d\.]+)\]\s*\[longitude:\s*([-\d\.]+)\]\s*\[rel_alt:\s*([-\d\.]+)\s+abs_alt:\s*([-\d\.]+)\]', srt_content)
                    valid_coords = [c for c in found if float(c[0]) != 0.0 and float(c[1]) != 0.0]
                    if valid_coords:
                        coords = valid_coords
            
            matched_videos.append({
                'idx': idx,
                'youtube_id': vid,
                'title': title,
                'srt_path': srt_path,
                'has_srt': bool(srt_path),
                'total_points': len(coords),
                'mid_point': coords[len(coords)//2] if coords else None
            })
            
            print(f"\n{idx}. Vídeo: [{vid}] {title}")
            if srt_path:
                print(f"   SRT Encontrado: {os.path.basename(srt_path)}")
                if coords:
                    mid = coords[len(coords)//2]
                    print(f"   Coordenadas: Lat {mid[0]}, Lon {mid[1]}, Altitude {mid[3]}m ({len(coords)} pontos)")
                else:
                    print("   Aviso: Coordenadas não extraídas do SRT")
            else:
                print("   SRT NÃO encontrado diretamente com clean_title:", clean_title)
    except Exception as e:
        print(f"\n{idx}. Erro ao consultar vídeo {vid}: {e}")

with open('matched_videos.json', 'w', encoding='utf-8') as f:
    json.dump(matched_videos, f, ensure_ascii=False, indent=2)
