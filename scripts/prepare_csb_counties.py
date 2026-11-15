#!/usr/bin/env python3
"""Extract complete USDA CSB records for the requested South Dakota counties."""
import argparse
import json
from collections import defaultdict
from pathlib import Path

import ijson

COUNTIES = {
    "011": "Brookings", "079": "Lake", "101": "Moody",
    "099": "Minnehaha", "083": "Lincoln", "087": "McCook",
    "097": "Miner", "039": "Deuel", "077": "Kingsbury",
}
OPTIONAL = {"103": "Pennington"}


def point_count(geometry):
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    return sum(len(ring) for polygon in polygons for ring in polygon)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--include-pennington", action="store_true")
    args = parser.parse_args()
    names = COUNTIES | (OPTIONAL if args.include_pennington else {})
    counts = defaultdict(int)
    raw_bytes = defaultdict(int)
    vertices = defaultdict(int)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.source.open("rb") as source, args.output.open("w") as output:
        output.write('{"type":"FeatureCollection","features":[')
        first = True
        for feature in ijson.items(source, "features.item", use_float=True):
            props = feature["properties"]
            county = str(props.get("CNTYFIPS", "")).zfill(3)
            if props.get("STATEFIPS") != "46" or county not in names:
                continue
            serialized = json.dumps(feature, separators=(",", ":"))
            output.write(("" if first else ",") + serialized)
            first = False
            counts[county] += 1
            raw_bytes[county] += len(serialized.encode())
            vertices[county] += point_count(feature["geometry"])
        output.write("]}")
    for code, name in names.items():
        print(f"{name:12} {code}: {counts[code]:>7,} fields, {raw_bytes[code]/1048576:>7.1f} MiB GeoJSON, {vertices[code]:>9,} vertices")
    total = sum(counts.values())
    size = args.output.stat().st_size
    # WKB geometry estimate: 16 bytes per coordinate plus ring/polygon headers;
    # row/TOAST, B-tree and GiST indexes add substantial variable overhead.
    wkb = 16 * sum(vertices.values()) + 128 * total
    lower = wkb + 160 * total
    upper = int(lower * 1.8)
    print(f"TOTAL: {total:,} fields; GeoJSON {size/1048576:.1f} MiB; estimated PostgreSQL table + indexes {lower/1048576:.1f}–{upper/1048576:.1f} MiB")


if __name__ == "__main__":
    main()
