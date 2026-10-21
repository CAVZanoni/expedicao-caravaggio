import requests

SUPABASE_URL = "https://mmrutnyypisikfxgvsnz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcnV0bnl5cGlzaWtmeGd2c256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0NTk1MjEsImV4cCI6MjEwODAzNTUyMX0.JKv_Hr-OpWCUP3UnyQI-ty7rbx5ky41UCIQE5W4SWIw"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

# Buscar todas as mídias
resp = requests.get(f"{SUPABASE_URL}/rest/v1/midias?select=id,arquivo_nome,tipo", headers=headers)
if resp.status_code != 200:
    print("Erro ao buscar mídias:", resp.text)
    exit(1)

midias = resp.json()
print(f"Total de mídias para atualizar: {len(midias)}")

atualizadas = 0
for m in midias:
    if m.get("arquivo_nome") and m.get("tipo") == "foto":
        fname = m["arquivo_nome"]
        hd_url = f"/api/media/{fname}"
        
        up_resp = requests.patch(
            f"{SUPABASE_URL}/rest/v1/midias?id=eq.{m['id']}",
            headers=headers,
            json={"url_midia": hd_url}
        )
        if up_resp.status_code in [200, 204]:
            atualizadas += 1

print(f"Atualizadas {atualizadas} fotos para apontar para a rota HD /api/media/!")
