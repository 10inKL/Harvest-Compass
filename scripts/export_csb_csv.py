#!/usr/bin/env python3
"""Export the measured CSB subset as county CSVs for Supabase Table Editor.

The output files are generated data (ignored by Git). PostGIS accepts EWKT in
the geom column. Each county stays below the dashboard's 100 MB CSV limit.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

import ijson
from shapely.geometry import shape

COUNTIES = {
    "011": "brookings", "079": "lake", "101": "moody",
    "099": "minnehaha", "083": "lincoln", "087": "mccook",
    "097": "miner", "039": "deuel", "077": "kingsbury",
}
HEADERS = [
    "csbid", "source_release", "state_fips", "county_fips", "acres",
    "crop_2018", "crop_2019", "crop_2020", "crop_2021", "crop_2022",
    "crop_2023", "crop_2024", "crop_2025", "geom",
]


def main() -> None:
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "data/csb/south-dakota-selected-counties.geojson")
    output_dir = Path(sys.argv[2] if len(sys.argv) > 2 else "data/csb/import-csv")
    output_dir.mkdir(parents=True, exist_ok=True)
    files = {}
    writers = {}
    counts = {code: 0 for code in COUNTIES}
    try:
        for code, name in COUNTIES.items():
            file = (output_dir / f"{name}.csv").open("w", newline="")
            files[code] = file
            writer = csv.writer(file)
            writer.writerow(HEADERS)
            writers[code] = writer
        with source.open("rb") as data:
            for feature in ijson.items(data, "features.item", use_float=True):
                props = feature["properties"]
                code = str(props["CNTYFIPS"]).zfill(3)
                if code not in writers or str(props["STATEFIPS"]) != "46":
                    raise ValueError(f"Unexpected state/county in extracted subset: {code}")
                geometry = shape(feature["geometry"])
                if geometry.geom_type != "MultiPolygon":
                    raise ValueError(f"Expected MultiPolygon for {props['CSBID']}")
                writers[code].writerow([
                    props["CSBID"], props.get("source_release", "USDA NASS CSB 2018-2025"),
                    "46", code, props.get("CSBACRES"),
                    *[props.get(f"CDL{year}") for year in range(2018, 2026)],
                    f"SRID=4326;{geometry.wkt}",
                ])
                counts[code] += 1
    finally:
        for file in files.values():
            file.close()
    for code, name in COUNTIES.items():
        path = output_dir / f"{name}.csv"
        print(f"{name}: {counts[code]:,} rows, {path.stat().st_size / 1048576:.1f} MiB")
    print(f"Total: {sum(counts.values()):,} rows")


if __name__ == "__main__":
    main()
