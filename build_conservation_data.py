"""
Builds data/pnw_nwr.geojson — National Wildlife Refuge boundaries for
Oregon and Washington — from OpenStreetMap via the Overpass API.

No API key required.  Run once, then commit the output file.
Re-run whenever you want to refresh the data.

Usage:
    python build_conservation_data.py
"""

import json
import math
import os
import time
import urllib.parse
import urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'pnw_nwr.geojson')

OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
]

# Bounding box covering Oregon + Washington
BBOX = '41.9,-124.8,49.1,-116.5'

# RDP simplification epsilon (degrees).  0.0003 ≈ 30 m at this latitude.
EPSILON = 0.0003


# ─── Overpass ─────────────────────────────────────────────────────────────────

def fetch_overpass(query, timeout=120):
    data = urllib.parse.urlencode({'data': query}).encode('utf-8')
    for mirror in OVERPASS_MIRRORS:
        try:
            req = urllib.request.Request(
                mirror, data=data,
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'OnlyBirdNerds-ConservationLayer/1.0',
                }
            )
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read())
        except Exception as e:
            print(f'  mirror {mirror}: {e}')
            time.sleep(2)
    raise RuntimeError('All Overpass mirrors failed')


# ─── Geometry helpers ─────────────────────────────────────────────────────────

def rdp(points, epsilon):
    """Ramer-Douglas-Peucker line simplification."""
    if len(points) < 3:
        return points
    start, end = points[0], points[-1]
    dx, dy = end[0] - start[0], end[1] - start[1]
    dist_sq = dx * dx + dy * dy
    max_d, max_i = 0.0, 0
    for i in range(1, len(points) - 1):
        px, py = points[i]
        if dist_sq == 0:
            d = math.sqrt((px - start[0]) ** 2 + (py - start[1]) ** 2)
        else:
            t = max(0.0, min(1.0, ((px - start[0]) * dx + (py - start[1]) * dy) / dist_sq))
            d = math.sqrt((px - start[0] - t * dx) ** 2 + (py - start[1] - t * dy) ** 2)
        if d > max_d:
            max_d, max_i = d, i
    if max_d > epsilon:
        left  = rdp(points[:max_i + 1], epsilon)
        right = rdp(points[max_i:],     epsilon)
        return left[:-1] + right
    return [start, end]


def simplify_ring(ring, prec=4):
    pts = [[round(c, prec) for c in p] for p in ring]
    deduped = [pts[0]]
    for p in pts[1:]:
        if p != deduped[-1]:
            deduped.append(p)
    simplified = rdp(deduped, EPSILON)
    if simplified and simplified[0] != simplified[-1]:
        simplified.append(simplified[0])
    return simplified if len(simplified) >= 4 else None


def simplify_geometry(geom):
    t = geom.get('type')
    if t == 'Polygon':
        rings = [r for r in (simplify_ring(ring) for ring in geom['coordinates']) if r]
        return {'type': 'Polygon', 'coordinates': rings} if rings else None
    if t == 'MultiPolygon':
        polys = []
        for poly in geom['coordinates']:
            rings = [r for r in (simplify_ring(ring) for ring in poly) if r]
            if rings:
                polys.append(rings)
        return {'type': 'MultiPolygon', 'coordinates': polys} if polys else None
    return geom


# ─── OSM → GeoJSON converters ─────────────────────────────────────────────────

def stitch_ways(ways):
    """Join a list of coordinate arrays into closed rings."""
    remaining = [list(w) for w in ways]
    rings = []
    while remaining:
        ring = remaining.pop(0)
        changed = True
        while changed:
            changed = False
            for i, w in enumerate(remaining):
                if ring[-1] == w[0]:
                    ring.extend(w[1:]); remaining.pop(i); changed = True; break
                elif ring[-1] == w[-1]:
                    ring.extend(list(reversed(w))[1:]); remaining.pop(i); changed = True; break
                elif ring[0] == w[-1]:
                    ring = w + ring[1:]; remaining.pop(i); changed = True; break
                elif ring[0] == w[0]:
                    ring = list(reversed(w)) + ring[1:]; remaining.pop(i); changed = True; break
        if ring and ring[0] != ring[-1]:
            ring.append(ring[0])
        if len(ring) >= 4:
            rings.append(ring)
    return rings


def relation_to_feature(rel):
    tags = rel.get('tags', {})
    outer = []
    for m in rel.get('members', []):
        if m.get('type') != 'way' or m.get('role') == 'inner':
            continue
        coords = [[n['lon'], n['lat']] for n in m.get('geometry', [])]
        if coords:
            outer.append(coords)
    rings = stitch_ways(outer)
    if not rings:
        return None
    geometry = (
        {'type': 'Polygon',      'coordinates': [rings[0]]}
        if len(rings) == 1
        else {'type': 'MultiPolygon', 'coordinates': [[r] for r in rings]}
    )
    geom = simplify_geometry(geometry)
    if not geom:
        return None
    return {
        'type': 'Feature',
        'geometry': geom,
        'properties': {
            'ORGNAME': tags.get('name', 'National Wildlife Refuge'),
            'ORG_WB':  tags.get('website', tags.get('url', '')),
        }
    }


def way_to_feature(way):
    tags = way.get('tags', {})
    coords = [[n['lon'], n['lat']] for n in way.get('geometry', [])]
    if len(coords) < 4:
        return None
    if coords[0] != coords[-1]:
        coords.append(coords[0])
    geom = simplify_geometry({'type': 'Polygon', 'coordinates': [coords]})
    if not geom:
        return None
    return {
        'type': 'Feature',
        'geometry': geom,
        'properties': {
            'ORGNAME': tags.get('name', 'Wildlife Refuge'),
            'ORG_WB':  tags.get('website', tags.get('url', '')),
        }
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    features = []
    seen = set()

    print('Fetching NWR relations from Overpass API...')
    q_rel = (
        f'[out:json][timeout:90];'
        f'(relation["boundary"="protected_area"]["name"~"Wildlife Refuge"]({BBOX}););'
        f'out geom;'
    )
    try:
        obj = fetch_overpass(q_rel, timeout=110)
        for rel in obj.get('elements', []):
            f = relation_to_feature(rel)
            if f:
                name = f['properties']['ORGNAME']
                features.append(f)
                seen.add(name)
        print(f'  {len(features)} relation features')
    except Exception as e:
        print(f'  relations failed: {e}')

    print('Fetching NWR way boundaries from Overpass API...')
    q_way = (
        f'[out:json][timeout:60];'
        f'(way["boundary"="protected_area"]["name"~"Wildlife Refuge"]({BBOX}););'
        f'out geom;'
    )
    try:
        obj2 = fetch_overpass(q_way, timeout=75)
        before = len(features)
        for way in obj2.get('elements', []):
            f = way_to_feature(way)
            if f and f['properties']['ORGNAME'] not in seen:
                features.append(f)
                seen.add(f['properties']['ORGNAME'])
        print(f'  {len(features) - before} way features added')
    except Exception as e:
        print(f'  ways failed: {e}')

    if not features:
        print('\nNo features fetched. Saving empty placeholder.')
        gj = {'type': 'FeatureCollection', 'features': []}
    else:
        gj = {'type': 'FeatureCollection', 'features': features}

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(gj, f, separators=(',', ':'))

    size_kb = os.path.getsize(OUT) / 1024
    print(f'\nSaved {len(features)} NWR features  ({size_kb:.0f} KB) to {OUT}')
    if features:
        for feat in sorted(features, key=lambda x: x['properties']['ORGNAME']):
            print(f'  {feat["properties"]["ORGNAME"]}')
        print('\nNow commit data/pnw_nwr.geojson and push to update the site.')


if __name__ == '__main__':
    main()
