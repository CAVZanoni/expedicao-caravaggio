import json
import re

with open('playlist_debug.json', 'w', encoding='utf-8') as out:
    pass

import urllib.request

url = 'https://www.youtube.com/playlist?list=PLL2e3vjTK5MU'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
}

req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req) as resp:
    html = resp.read().decode('utf-8', errors='ignore')

m = re.search(r'var ytInitialData = ({.*?});</script>', html)
if m:
    data = json.loads(m.group(1))
    with open('playlist_debug.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Salvo playlist_debug.json")
    
    # Procurar recursivamente por videoId
    def find_videos(obj, results):
        if isinstance(obj, dict):
            if 'videoId' in obj:
                # Tenta pegar título
                title = ""
                if 'title' in obj:
                    t = obj['title']
                    if isinstance(t, dict):
                        if 'runs' in t and len(t['runs']) > 0:
                            title = t['runs'][0].get('text', '')
                        elif 'simpleText' in t:
                            title = t.get('simpleText', '')
                results.append((obj['videoId'], title))
            for k, v in obj.items():
                find_videos(v, results)
        elif isinstance(obj, list):
            for item in obj:
                find_videos(item, results)

    videos = []
    find_videos(data, videos)
    print(f"Vídeos encontrados: {len(videos)}")
    seen = set()
    for vid, title in videos:
        if vid not in seen:
            seen.add(vid)
            print(f"[{vid}] {title}")
