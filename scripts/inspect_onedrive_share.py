import urllib.request
import json
import re

share_url = 'https://1drv.ms/f/c/09c8d0f014d1e01e/IgAXE9PPsYxoRbSjG9AecPxYAVA41DKYhrmABFtio__iX2o'
req = urllib.request.Request(share_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})

try:
    with urllib.request.urlopen(req) as resp:
        final_url = resp.geturl()
        print("Final URL:", final_url)
        html = resp.read().decode('utf-8', errors='ignore')
        print("Tamanho do HTML retornado:", len(html))
        
        # Procurar por nomes de pastas como D1_20261009 ou D_CARAVAGGIO
        names = re.findall(r'\"name\":\"([^\"]+)\"', html)
        print("Nomes encontrados:", set(names))
except Exception as e:
    print("Erro:", e)
