import gpxpy
import glob

for f in sorted(glob.glob("*.gpx")):
    with open(f, "r", encoding="utf-8") as g:
        gpx = gpxpy.parse(g)
    pts = [p for t in gpx.tracks for s in t.segments for p in s.points]
    lats = [p.latitude for p in pts]
    lons = [p.longitude for p in pts]
    name = gpx.tracks[0].name if gpx.tracks else "Sem nome"
    t_start = pts[0].time if pts else None
    print(f"GPX: {f}")
    print(f"  Nome: {name} | Data: {t_start}")
    print(f"  Lat: {min(lats):.4f} a {max(lats):.4f}")
    print(f"  Lon: {min(lons):.4f} a {max(lons):.4f}")
