import urllib.request
import xml.etree.ElementTree as ET

channel_ids = ['UCZsh9LM2z1fGuvcdf1oxcmA', 'UC-WNIv9QcjlFMdERsrbLWYQ']

for cid in channel_ids:
    rss_url = f'https://www.youtube.com/feeds/videos.xml?channel_id={cid}'
    print("\nTestando RSS:", rss_url)
    try:
        req = urllib.request.Request(rss_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            xml_text = resp.read().decode('utf-8')
            root = ET.fromstring(xml_text)
            
            # Namespace do feed Atom
            ns = {'atom': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015'}
            author = root.find('atom:author/atom:name', ns)
            channel_title = root.find('atom:title', ns)
            print(f"Canal: {author.text if author is not None else ''} - {channel_title.text if channel_title is not None else ''}")
            
            entries = root.findall('atom:entry', ns)
            print(f"Total de vídeos no feed RSS: {len(entries)}")
            for e in entries:
                v_title = e.find('atom:title', ns).text
                v_id = e.find('yt:videoId', ns).text
                published = e.find('atom:published', ns).text
                print(f"  - [{v_id}] {v_title} ({published})")
    except Exception as e:
        print(f"Erro no canal {cid}: {e}")
