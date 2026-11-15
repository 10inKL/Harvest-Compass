#!/usr/bin/env python3
"""Build an indexed local South Dakota CSB database from extracted GeoJSON."""
import argparse
import json
import sqlite3
import zlib
from pathlib import Path

import ijson


def points(geometry):
    if geometry["type"] == "Polygon":
        rings = geometry["coordinates"]
        for ring in rings:
            yield from ring
    elif geometry["type"] == "MultiPolygon":
        for polygon in geometry["coordinates"]:
            for ring in polygon:
                yield from ring


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(args.output)
    db.executescript("""
      create table if not exists fields (id integer primary key, csbid text unique, county_fips text, acres real, crop2025 integer, geometry blob);
      create virtual table if not exists bounds using rtree(id, min_lng, max_lng, min_lat, max_lat);
    """)
    count = 0
    with args.source.open("rb") as source:
        for field in ijson.items(source, "features.item", use_float=True):
            geom = field["geometry"]
            coords = list(points(geom))
            if not coords:
                continue
            lngs = [float(p[0]) for p in coords]
            lats = [float(p[1]) for p in coords]
            props = field["properties"]
            cursor = db.execute("insert or ignore into fields(csbid,county_fips,acres,crop2025,geometry) values(?,?,?,?,?)", (props["CSBID"], props.get("CNTYFIPS"), props.get("CSBACRES"), props.get("CDL2025"), zlib.compress(json.dumps(geom, separators=(",", ":")).encode(), 6)))
            if cursor.rowcount:
                db.execute("insert into bounds values(?,?,?,?,?)", (cursor.lastrowid, min(lngs), max(lngs), min(lats), max(lats)))
                count += 1
            if count % 10000 == 0:
                db.commit()
                print(f"Indexed {count:,} fields", flush=True)
    db.commit()
    db.close()
    print(f"Finished {count:,} fields in {args.output}")


if __name__ == "__main__":
    main()
