#!/usr/bin/env python3
"""
Download bird photos from iNaturalist for every species in your eBird CSV.
Saves thumbnails to bird-photos/ and writes bird-photos/manifest.json.

Usage:
    python download_bird_photos.py MyEBirdData.csv

Re-run any time you have new species — already-downloaded photos are skipped.
"""

import sys, os, json, time, re, csv, requests

PHOTO_DIR     = os.path.join(os.path.dirname(__file__), 'bird-photos')
MANIFEST_FILE = os.path.join(PHOTO_DIR, 'manifest.json')
INAT_URL      = 'https://api.inaturalist.org/v1/taxa'
DELAY         = 0.6   # seconds between iNat API calls (respect rate limit)
TIMEOUT       = 12


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def fetch_inat_square(name):
    """Return the 75px square thumbnail URL for the best iNat taxon match."""
    try:
        r = requests.get(
            INAT_URL,
            params={'q': name, 'rank': 'species', 'per_page': 1},
            timeout=TIMEOUT
        )
        r.raise_for_status()
        results = r.json().get('results', [])
        if results:
            photo = results[0].get('default_photo')
            if photo:
                return photo.get('square_url') or photo.get('medium_url')
    except Exception as e:
        print(f'  API error: {e}')
    return None


def download_image(url, filepath):
    try:
        r = requests.get(url, timeout=TIMEOUT, stream=True)
        r.raise_for_status()
        with open(filepath, 'wb') as f:
            for chunk in r.iter_content(8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f'  Download error: {e}')
        return False


def read_species(csv_path):
    species = set()
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('Common Name', '').strip()
            if name:
                species.add(name)
    return sorted(species)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    csv_path = sys.argv[1]
    if not os.path.exists(csv_path):
        print(f'File not found: {csv_path}')
        sys.exit(1)

    os.makedirs(PHOTO_DIR, exist_ok=True)

    # Load existing manifest so we can skip already-downloaded species
    manifest = {}
    if os.path.exists(MANIFEST_FILE):
        with open(MANIFEST_FILE) as f:
            manifest = json.load(f)

    species_list = read_species(csv_path)
    print(f'Found {len(species_list)} species in CSV')

    to_fetch = [n for n in species_list
                if n not in manifest or not os.path.exists(os.path.join(PHOTO_DIR, slug(n) + '.jpg'))]
    print(f'{len(to_fetch)} need downloading  ({len(species_list) - len(to_fetch)} already cached)\n')

    ok = skip = fail = 0
    for i, name in enumerate(to_fetch, 1):
        s    = slug(name)
        path = os.path.join(PHOTO_DIR, s + '.jpg')
        print(f'[{i}/{len(to_fetch)}] {name} ...', end='  ', flush=True)

        url = fetch_inat_square(name)
        if not url:
            print('no iNat match')
            fail += 1
        elif download_image(url, path):
            manifest[name] = f'bird-photos/{s}.jpg'
            print('✓')
            ok += 1
        else:
            print('download failed')
            fail += 1

        time.sleep(DELAY)

    # Save updated manifest
    with open(MANIFEST_FILE, 'w') as f:
        json.dump(manifest, f, indent=2, sort_keys=True)

    print(f'\n✓ {ok} downloaded   ✗ {fail} failed   — manifest now covers {len(manifest)} species')
    print(f'Commit bird-photos/ to git and redeploy.')


if __name__ == '__main__':
    main()
