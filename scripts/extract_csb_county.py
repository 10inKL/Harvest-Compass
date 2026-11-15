#!/usr/bin/env python3
"""Extract a small USDA CSB county pilot from the official national geodatabase.

Install outside the Next.js app: python -m venv /tmp/hc-csb &&
/tmp/hc-csb/bin/pip install geopandas pyogrio
"""
from __future__ import annotations

import argparse
import zipfile
from pathlib import Path

import geopandas as gpd


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("zip_file", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--state-fips", default="46")
    parser.add_argument("--county-fips", default="011")
    args = parser.parse_args()
    extract_dir = args.zip_file.with_suffix("")
    if not extract_dir.exists():
        print(f"Extracting {args.zip_file} …")
        with zipfile.ZipFile(args.zip_file) as archive:
            archive.extractall(extract_dir)
    geodatabases = list(extract_dir.rglob("*.gdb"))
    if not geodatabases:
        raise SystemExit("No .gdb found in the USDA archive")
    gdb = geodatabases[0]
    print(f"Reading {gdb} …")
    where = f"STATEFIPS = '{args.state_fips}' AND CNTYFIPS = '{args.county_fips}'"
    columns = ["CSBID", "CSBACRES", "STATEFIPS", "CNTYFIPS", *[f"CDL{year}" for year in range(2018, 2026)]]
    fields = gpd.read_file(gdb, layer="national1825", where=where, columns=columns, engine="pyogrio")
    if fields.empty:
        raise SystemExit("No CSB polygons matched the requested county")
    fields = fields.to_crs(4326)
    fields["source_release"] = "USDA NASS CSB 2018-2025"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fields.to_file(args.output, driver="GeoJSON")
    print(f"Wrote {len(fields):,} polygons to {args.output}")


if __name__ == "__main__":
    main()
