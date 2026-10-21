import json
import requests

SUPABASE_URL = "https://mmrutnyypisikfxgvsnz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcnV0bnl5cGlzaWtmeGd2c256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NTk1MjEsImV4cCI6MjEwODAzNTUyMX0.JKv_Hr-OpWCUP3UnyQI-ty7rbx5ky41UCIQE5W4SWIw"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

with open("data/expedicao.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for etapa in data["etapas"]:
    payload = {
        "numero_dia": etapa["numero_dia"],
        "data": etapa["data"],
        "titulo": etapa["titulo"],
        "cidade_origem": etapa["cidade_origem"],
        "cidade_destino": etapa["cidade_destino"],
        "distancia_km": etapa["distancia_km"],
        "altimetria_ganho": etapa["altimetria_ganho"],
        "altimetria_perda": etapa["altimetria_perda"],
        "alt_min": etapa["alt_min"],
        "alt_max": etapa["alt_max"],
        "duracao_segundos": etapa["duracao_segundos"],
        "geojson_rota": etapa["geojson"],
        "perfil_altimetria": etapa["perfil_altimetria"],
        "bounds": etapa["bounds"]
    }
    
    url = f"{SUPABASE_URL}/rest/v1/etapas"
    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code in [200, 201]:
        print(f"Dia {etapa['numero_dia']} inserido com sucesso!")
    else:
        print(f"Erro no Dia {etapa['numero_dia']}: {resp.status_code} - {resp.text}")

print("Concluído!")
