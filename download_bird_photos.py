#!/usr/bin/env python3
"""
Download bird photos from iNaturalist for every species in your eBird CSV,
or for the full built-in list of ~900 common North American species.

Usage:
    python download_bird_photos.py MyEBirdData.csv   # your species only
    python download_bird_photos.py --all              # full NA list (~900 sp)
    python download_bird_photos.py --all MyEBird.csv  # both merged

Re-run any time — already-downloaded photos are skipped.
"""

import sys, os, json, time, re, csv, requests

PHOTO_DIR     = os.path.join(os.path.dirname(__file__), 'bird-photos')
MANIFEST_FILE = os.path.join(PHOTO_DIR, 'manifest.json')
INAT_URL      = 'https://api.inaturalist.org/v1/taxa'
DELAY         = 0.6   # seconds between iNat API calls
TIMEOUT       = 12

# ~900 regularly occurring North American species (ABA area)
NA_SPECIES = [
    "Fulvous Whistling-Duck","Black-bellied Whistling-Duck","Emperor Goose",
    "Snow Goose","Ross's Goose","Greater White-fronted Goose","Brant",
    "Cackling Goose","Canada Goose","Trumpeter Swan","Tundra Swan",
    "Whooper Swan","Wood Duck","Blue-winged Teal","Cinnamon Teal",
    "Northern Shoveler","Gadwall","Eurasian Wigeon","American Wigeon",
    "Mallard","American Black Duck","Mottled Duck","Northern Pintail",
    "Green-winged Teal","Canvasback","Redhead","Ring-necked Duck",
    "Tufted Duck","Greater Scaup","Lesser Scaup","Steller's Eider",
    "Spectacled Eider","King Eider","Common Eider","Harlequin Duck",
    "Surf Scoter","White-winged Scoter","Black Scoter","Long-tailed Duck",
    "Bufflehead","Common Goldeneye","Barrow's Goldeneye","Hooded Merganser",
    "Common Merganser","Red-breasted Merganser","Ruddy Duck",
    "Plain Chachalaca","Mountain Quail","Northern Bobwhite","Scaled Quail",
    "Gambel's Quail","California Quail","Montezuma Quail","Wild Turkey",
    "Ruffed Grouse","Greater Sage-Grouse","Gunnison Sage-Grouse",
    "Dusky Grouse","Sooty Grouse","White-tailed Ptarmigan","Willow Ptarmigan",
    "Rock Ptarmigan","Greater Prairie-Chicken","Lesser Prairie-Chicken",
    "Sharp-tailed Grouse","Ring-necked Pheasant","Gray Partridge","Chukar",
    "Red-throated Loon","Pacific Loon","Common Loon","Yellow-billed Loon",
    "Pied-billed Grebe","Horned Grebe","Red-necked Grebe","Eared Grebe",
    "Western Grebe","Clark's Grebe","Black-footed Albatross",
    "Laysan Albatross","Northern Fulmar","Murphy's Petrel","Mottled Petrel",
    "Hawaiian Petrel","Juan Fernandez Petrel","Cook's Petrel",
    "Buller's Shearwater","Short-tailed Shearwater","Sooty Shearwater",
    "Flesh-footed Shearwater","Pink-footed Shearwater","Manx Shearwater",
    "Black-vented Shearwater","Audubon's Shearwater","Wilson's Storm-Petrel",
    "Fork-tailed Storm-Petrel","Leach's Storm-Petrel","Ashy Storm-Petrel",
    "Band-rumped Storm-Petrel","Black Storm-Petrel","Least Storm-Petrel",
    "Red-billed Tropicbird","White-tailed Tropicbird","Masked Booby",
    "Blue-footed Booby","Brown Booby","Red-footed Booby","Northern Gannet",
    "American White Pelican","Brown Pelican","Brandt's Cormorant",
    "Neotropic Cormorant","Double-crested Cormorant","Great Cormorant",
    "Pelagic Cormorant","Red-faced Cormorant","Anhinga","Magnificent Frigatebird",
    "Great Blue Heron","Great Egret","Snowy Egret","Little Blue Heron",
    "Tricolored Heron","Reddish Egret","Cattle Egret","Green Heron",
    "Black-crowned Night-Heron","Yellow-crowned Night-Heron","White Ibis",
    "Glossy Ibis","White-faced Ibis","Roseate Spoonbill",
    "Black Vulture","Turkey Vulture","California Condor","Osprey",
    "White-tailed Kite","Hook-billed Kite","Swallow-tailed Kite",
    "Golden Eagle","Northern Harrier","Sharp-shinned Hawk","Cooper's Hawk",
    "Northern Goshawk","Bald Eagle","Mississippi Kite","Snail Kite",
    "Common Black Hawk","Harris's Hawk","Gray Hawk","Roadside Hawk",
    "Broad-winged Hawk","Short-tailed Hawk","Swainson's Hawk","Zone-tailed Hawk",
    "Red-tailed Hawk","Ferruginous Hawk","Rough-legged Hawk",
    "Crested Caracara","American Kestrel","Merlin","Gyrfalcon",
    "Peregrine Falcon","Prairie Falcon","Yellow Rail","Black Rail",
    "Ridgway's Rail","Clapper Rail","King Rail","Virginia Rail",
    "Sora","Purple Gallinule","Common Gallinule","American Coot",
    "Sandhill Crane","Whooping Crane","Limpkin",
    "Black-bellied Plover","American Golden-Plover","Pacific Golden-Plover",
    "Snowy Plover","Wilson's Plover","Semipalmated Plover","Piping Plover",
    "Killdeer","Mountain Plover","American Oystercatcher",
    "Black Oystercatcher","Black-necked Stilt","American Avocet",
    "Spotted Sandpiper","Solitary Sandpiper","Wandering Tattler",
    "Greater Yellowlegs","Willet","Lesser Yellowlegs","Upland Sandpiper",
    "Bristle-thighed Curlew","Whimbrel","Long-billed Curlew",
    "Hudsonian Godwit","Bar-tailed Godwit","Marbled Godwit",
    "Ruddy Turnstone","Black Turnstone","Red Knot","Ruff",
    "Broad-billed Sandpiper","Sharp-tailed Sandpiper","Stilt Sandpiper",
    "Curlew Sandpiper","Temminck's Stint","Long-toed Stint",
    "Red-necked Stint","Sanderling","Dunlin","Purple Sandpiper",
    "Rock Sandpiper","Baird's Sandpiper","Least Sandpiper",
    "White-rumped Sandpiper","Buff-breasted Sandpiper","Pectoral Sandpiper",
    "Semipalmated Sandpiper","Western Sandpiper","Short-billed Dowitcher",
    "Long-billed Dowitcher","Jack Snipe","Wilson's Snipe","American Woodcock",
    "Wilson's Phalarope","Red-necked Phalarope","Red Phalarope",
    "South Polar Skua","Pomarine Jaeger","Parasitic Jaeger","Long-tailed Jaeger",
    "Dovekie","Common Murre","Thick-billed Murre","Razorbill",
    "Black Guillemot","Pigeon Guillemot","Long-billed Murrelet",
    "Marbled Murrelet","Kittlitz's Murrelet","Scripps's Murrelet",
    "Guadalupe Murrelet","Craveri's Murrelet","Ancient Murrelet",
    "Cassin's Auklet","Parakeet Auklet","Least Auklet","Whiskered Auklet",
    "Crested Auklet","Rhinoceros Auklet","Atlantic Puffin","Horned Puffin",
    "Tufted Puffin","Black-legged Kittiwake","Red-legged Kittiwake",
    "Ivory Gull","Sabine's Gull","Bonaparte's Gull","Black-headed Gull",
    "Little Gull","Ross's Gull","Laughing Gull","Franklin's Gull",
    "Black-tailed Gull","Mew Gull","Ring-billed Gull","Western Gull",
    "Yellow-footed Gull","California Gull","Herring Gull","Iceland Gull",
    "Lesser Black-backed Gull","Slaty-backed Gull","Glaucous-winged Gull",
    "Glaucous Gull","Great Black-backed Gull","Sooty Tern","Bridled Tern",
    "Least Tern","Aleutian Tern","Caspian Tern","Black Tern",
    "White-winged Tern","Roseate Tern","Common Tern","Arctic Tern",
    "Forster's Tern","Royal Tern","Sandwich Tern","Elegant Tern",
    "Black Skimmer","Rock Pigeon","Band-tailed Pigeon","Eurasian Collared-Dove",
    "Inca Dove","Common Ground Dove","Ruddy Ground Dove",
    "White-tipped Dove","White-winged Dove","Mourning Dove",
    "Passenger Pigeon","Yellow-billed Cuckoo","Black-billed Cuckoo",
    "Mangrove Cuckoo","Greater Roadrunner","Smooth-billed Ani",
    "Groove-billed Ani","Barn Owl","Flammulated Owl","Western Screech-Owl",
    "Eastern Screech-Owl","Whiskered Screech-Owl","Great Horned Owl",
    "Snowy Owl","Northern Hawk Owl","Northern Pygmy-Owl","Ferruginous Pygmy-Owl",
    "Elf Owl","Burrowing Owl","Spotted Owl","Barred Owl","Great Gray Owl",
    "Long-eared Owl","Short-eared Owl","Boreal Owl","Northern Saw-whet Owl",
    "Lesser Nighthawk","Common Nighthawk","Antillean Nighthawk",
    "Common Pauraque","Common Poorwill","Chuck-will's-widow","Eastern Whip-poor-will",
    "Mexican Whip-poor-will","Black Swift","Chimney Swift","Vaux's Swift",
    "White-throated Swift","Broad-billed Hummingbird","White-eared Hummingbird",
    "Violet-crowned Hummingbird","Blue-throated Mountain-gem","Lucifer Hummingbird",
    "Ruby-throated Hummingbird","Black-chinned Hummingbird",
    "Anna's Hummingbird","Costa's Hummingbird","Calliope Hummingbird",
    "Rufous Hummingbird","Allen's Hummingbird","Broad-tailed Hummingbird",
    "Ringed Kingfisher","Belted Kingfisher","Green Kingfisher",
    "Lewis's Woodpecker","Red-headed Woodpecker","Acorn Woodpecker",
    "Gila Woodpecker","Golden-fronted Woodpecker","Red-bellied Woodpecker",
    "Williamson's Sapsucker","Yellow-bellied Sapsucker","Red-naped Sapsucker",
    "Red-breasted Sapsucker","American Three-toed Woodpecker",
    "Black-backed Woodpecker","Downy Woodpecker","Nuttall's Woodpecker",
    "Ladder-backed Woodpecker","Red-cockaded Woodpecker","Hairy Woodpecker",
    "Arizona Woodpecker","White-headed Woodpecker","Pileated Woodpecker",
    "Northern Flicker","Gilded Flicker","Olive-sided Flycatcher",
    "Greater Pewee","Western Wood-Pewee","Eastern Wood-Pewee",
    "Yellow-bellied Flycatcher","Acadian Flycatcher","Alder Flycatcher",
    "Willow Flycatcher","Least Flycatcher","Hammond's Flycatcher",
    "Gray Flycatcher","Dusky Flycatcher","Pacific-slope Flycatcher",
    "Cordilleran Flycatcher","Buff-breasted Flycatcher","Black Phoebe",
    "Eastern Phoebe","Say's Phoebe","Vermilion Flycatcher",
    "Dusky-capped Flycatcher","Ash-throated Flycatcher","Nutting's Flycatcher",
    "Great Crested Flycatcher","Brown-crested Flycatcher","La Sagra's Flycatcher",
    "Great Kiskadee","Sulphur-bellied Flycatcher","Tropical Kingbird",
    "Couch's Kingbird","Cassin's Kingbird","Thick-billed Kingbird",
    "Western Kingbird","Eastern Kingbird","Gray Kingbird","Scissor-tailed Flycatcher",
    "Fork-tailed Flycatcher","Rose-throated Becard","Loggerhead Shrike",
    "Northern Shrike","White-eyed Vireo","Bell's Vireo","Black-capped Vireo",
    "Gray Vireo","Hutton's Vireo","Yellow-throated Vireo","Cassin's Vireo",
    "Blue-headed Vireo","Plumbeous Vireo","Philadelphia Vireo","Warbling Vireo",
    "Red-eyed Vireo","Yellow-green Vireo","Black-whiskered Vireo",
    "Canada Jay","Pinyon Jay","Steller's Jay","Blue Jay",
    "Florida Scrub-Jay","Island Scrub-Jay","Woodhouse's Scrub-Jay",
    "California Scrub-Jay","Mexican Jay","Clark's Nutcracker",
    "Black-billed Magpie","Yellow-billed Magpie","Eurasian Jackdaw",
    "American Crow","Northwestern Crow","Tamaulipas Crow","Fish Crow",
    "Chihuahuan Raven","Common Raven","Horned Lark","Purple Martin",
    "Tree Swallow","Violet-green Swallow","Northern Rough-winged Swallow",
    "Bank Swallow","Cliff Swallow","Cave Swallow","Barn Swallow",
    "Carolina Chickadee","Black-capped Chickadee","Mountain Chickadee",
    "Mexican Chickadee","Chestnut-backed Chickadee","Boreal Chickadee",
    "Gray-headed Chickadee","Bridled Titmouse","Oak Titmouse","Juniper Titmouse",
    "Tufted Titmouse","Black-crested Titmouse","Verdin","Bushtit",
    "Red-breasted Nuthatch","White-breasted Nuthatch","Pygmy Nuthatch",
    "Brown-headed Nuthatch","Brown Creeper","Cactus Wren","Rock Wren",
    "Canyon Wren","House Wren","Pacific Wren","Winter Wren",
    "Sedge Wren","Marsh Wren","Carolina Wren","Bewick's Wren",
    "Gnatcatcher","Blue-gray Gnatcatcher","California Gnatcatcher",
    "Black-tailed Gnatcatcher","Black-capped Gnatcatcher","American Dipper",
    "Golden-crowned Kinglet","Ruby-crowned Kinglet","Arctic Warbler",
    "Middendorff's Grasshopper-Warbler","Dusky Warbler","Narcissus Flycatcher",
    "Siberian Flycatcher","Red-flanked Bluetail","Bluethroat",
    "Northern Wheatear","Eastern Bluebird","Western Bluebird",
    "Mountain Bluebird","Townsend's Solitaire","Veery",
    "Gray-cheeked Thrush","Bicknell's Thrush","Swainson's Thrush",
    "Hermit Thrush","Wood Thrush","Fieldfare","Redwing","Eyebrowed Thrush",
    "Dusky Thrush","American Robin","Varied Thrush","Aztec Thrush",
    "Gray Catbird","Curve-billed Thrasher","Brown Thrasher",
    "Long-billed Thrasher","Bendire's Thrasher","California Thrasher",
    "Crissal Thrasher","Le Conte's Thrasher","Sage Thrasher",
    "Northern Mockingbird","Blue Mockingbird","European Starling",
    "Common Myna","Bohemian Waxwing","Cedar Waxwing","Phainopepla",
    "House Sparrow","Eurasian Tree Sparrow","Bachman's Warbler",
    "Blue-winged Warbler","Golden-winged Warbler","Tennessee Warbler",
    "Orange-crowned Warbler","Colima Warbler","Lucy's Warbler",
    "Nashville Warbler","Virginia's Warbler","Connecticut Warbler",
    "MacGillivray's Warbler","Mourning Warbler","Kentucky Warbler",
    "Common Yellowthroat","Hooded Warbler","American Redstart",
    "Cape May Warbler","Cerulean Warbler","Northern Parula","Tropical Parula",
    "Magnolia Warbler","Bay-breasted Warbler","Blackburnian Warbler",
    "Yellow Warbler","Chestnut-sided Warbler","Blackpoll Warbler",
    "Black-throated Blue Warbler","Palm Warbler","Pine Warbler",
    "Yellow-rumped Warbler","Prairie Warbler","Grace's Warbler",
    "Black-throated Gray Warbler","Townsend's Warbler","Hermit Warbler",
    "Golden-cheeked Warbler","Black-throated Green Warbler",
    "Yellow-throated Warbler","Canada Warbler","Wilson's Warbler",
    "Red-faced Warbler","Painted Redstart","Slate-throated Redstart",
    "Fan-tailed Warbler","Golden-crowned Warbler","Rufous-capped Warbler",
    "Yellow-breasted Chat","Ovenbird","Worm-eating Warbler",
    "Louisiana Waterthrush","Northern Waterthrush","Swainson's Warbler",
    "Yellow-rumped Warbler","Prothonotary Warbler","Olive Warbler",
    "Hepatic Tanager","Summer Tanager","Scarlet Tanager","Western Tanager",
    "Flame-colored Tanager","White-collared Seedeater","Yellow-faced Grassquit",
    "Black-faced Grassquit","Morelet's Seedeater","Bachman's Sparrow",
    "Cassin's Sparrow","Botteri's Sparrow","Rufous-winged Sparrow",
    "American Tree Sparrow","Chipping Sparrow","Clay-colored Sparrow",
    "Black-chinned Sparrow","Field Sparrow","Brewer's Sparrow",
    "Black-throated Sparrow","Five-striped Sparrow","Lark Sparrow",
    "Lark Bunting","Savannah Sparrow","Baird's Sparrow","Grasshopper Sparrow",
    "Henslow's Sparrow","Le Conte's Sparrow","Seaside Sparrow",
    "Nelson's Sparrow","Saltmarsh Sparrow","Fox Sparrow","Song Sparrow",
    "Lincoln's Sparrow","Swamp Sparrow","White-throated Sparrow",
    "Harris's Sparrow","White-crowned Sparrow","Golden-crowned Sparrow",
    "Dark-eyed Junco","Yellow-eyed Junco","Spotted Towhee",
    "Eastern Towhee","Canyon Towhee","California Towhee","Abert's Towhee",
    "Rufous-crowned Sparrow","Green-tailed Towhee","Yellow-breasted Bunting",
    "Rose-breasted Grosbeak","Black-headed Grosbeak","Blue Grosbeak",
    "Lazuli Bunting","Indigo Bunting","Varied Bunting","Painted Bunting",
    "Dickcissel","Bobolink","Red-winged Blackbird","Tricolored Blackbird",
    "Western Meadowlark","Eastern Meadowlark","Yellow-headed Blackbird",
    "Rusty Blackbird","Brewer's Blackbird","Common Grackle",
    "Boat-tailed Grackle","Great-tailed Grackle","Shiny Cowbird",
    "Bronzed Cowbird","Brown-headed Cowbird","Orchard Oriole",
    "Hooded Oriole","Streak-backed Oriole","Bullock's Oriole",
    "Altamira Oriole","Audubon's Oriole","Baltimore Oriole",
    "Scott's Oriole","Gray-crowned Rosy-Finch","Black Rosy-Finch",
    "Brown-capped Rosy-Finch","Pine Grosbeak","Evening Grosbeak",
    "Purple Finch","Cassin's Finch","House Finch","Red Crossbill",
    "Cassia Crossbill","White-winged Crossbill","Common Redpoll",
    "Hoary Redpoll","Pine Siskin","Lesser Goldfinch","Lawrence's Goldfinch",
    "American Goldfinch","Brambling","Hawfinch",
]


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def fetch_inat_square(name):
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


def read_species_from_csv(csv_path):
    species = set()
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('Common Name', '').strip()
            if name:
                species.add(name)
    return species


def main():
    use_all = '--all' in sys.argv
    csv_args = [a for a in sys.argv[1:] if not a.startswith('-')]

    if not use_all and not csv_args:
        print(__doc__)
        sys.exit(1)

    species = set()
    if use_all:
        species.update(NA_SPECIES)
        print(f'Using built-in NA species list: {len(NA_SPECIES)} species')
    for csv_path in csv_args:
        if not os.path.exists(csv_path):
            print(f'File not found: {csv_path}')
            sys.exit(1)
        csv_sp = read_species_from_csv(csv_path)
        new = csv_sp - species
        print(f'{csv_path}: {len(csv_sp)} species ({len(new)} not already in list)')
        species.update(csv_sp)

    species_list = sorted(species)
    print(f'\nTotal unique species: {len(species_list)}')

    os.makedirs(PHOTO_DIR, exist_ok=True)

    manifest = {}
    if os.path.exists(MANIFEST_FILE):
        with open(MANIFEST_FILE) as f:
            manifest = json.load(f)

    to_fetch = [n for n in species_list
                if n not in manifest or not os.path.exists(os.path.join(PHOTO_DIR, slug(n) + '.jpg'))]
    print(f'{len(to_fetch)} need downloading  ({len(species_list) - len(to_fetch)} already cached)\n')

    ok = fail = 0
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
            print('OK')
            ok += 1
            # Save manifest incrementally every 25 species
            if ok % 25 == 0:
                with open(MANIFEST_FILE, 'w') as f:
                    json.dump(manifest, f, indent=2, sort_keys=True)
        else:
            print('download failed')
            fail += 1

        time.sleep(DELAY)

    with open(MANIFEST_FILE, 'w') as f:
        json.dump(manifest, f, indent=2, sort_keys=True)

    print(f'\n{ok} downloaded   {fail} failed   -- manifest now covers {len(manifest)} species')
    print(f'Commit bird-photos/ to git and redeploy.')


if __name__ == '__main__':
    main()
