import requests

SUPABASE_URL = "https://mmrutnyypisikfxgvsnz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcnV0bnl5cGlzaWtmeGd2c256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NTk1MjEsImV4cCI6MjEwODAzNTUyMX0.JKv_Hr-OpWCUP3UnyQI-ty7rbx5ky41UCIQE5W4SWIw"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

resp_etapas = requests.get(f"{SUPABASE_URL}/rest/v1/etapas?select=id,numero_dia,titulo,geojson_rota", headers=headers)
etapas = resp_etapas.json()
for e in etapas:
    coords = e["geojson_rota"]["geometry"]["coordinates"]
    print(f"Etapa {e['numero_dia']}: {e['titulo']} - {len(coords)} pts")
    print(f"  Primeiro pt (lon, lat, ele): {coords[0]}")
    print(f"  Ultimo pt (lon, lat, ele): {coords[-1]}")
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    print(f"  Range lon: {min(lons)} a {max(lons)} | Range lat: {min(lats)} a {max(lats)}")

resp_midias = requests.get(f"{SUPABASE_URL}/rest/v1/midias?select=id,etapa_id,titulo,latitude,longitude", headers=headers)
midias = resp_midias.json()
print(f"\nTotal midias: {len(midias)}")
for m in midias[:12]:
    print(f"  Midia: {m['titulo']} | lat={m['latitude']} ({type(m['latitude'])}), lon={m['longitude']} ({type(m['longitude'])})")
