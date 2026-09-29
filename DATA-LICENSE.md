# Data licences

The code in this repository is MIT-licensed (see `LICENSE`). The data files
are derived from open datasets and remain under their source licences.

| Files | Source | Licence |
|---|---|---|
| Street, creek and building-dot layers in `data/*.json`; `inputs/export.geojson`, `sites/*/export.geojson`, `places.json` (street names) | © OpenStreetMap contributors: the Geofabrik Philippines extract (campuses) and the Overpass API (Teachers Village, Berkeley) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). These are derivative databases: any further redistribution must attribute OpenStreetMap and stay under ODbL. |
| Building dots, per-cell counts and blocked cells in the Philippine `data/*.json` files | VIDA's combined building footprints: Google Open Buildings, Microsoft Building Footprints and OpenStreetMap | Google Open Buildings: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Microsoft Building Footprints: ODbL 1.0. OpenStreetMap: ODbL 1.0. |
| The `elev` grids in the Philippine `data/*.json` files (the 25 campuses, Teachers Village and San Joaquin) | FABDEM V1-2 © University of Bristol (Hawker et al. 2022, *Environ. Res. Lett.* 17 024016), derived from Copernicus GLO-30 | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/): **non-commercial use only**, attribution, share-alike. |
| `inputs/output_hh.tif`, `sites/diliman/output_hh.tif` (kept as the record of the first builds; no page uses them) | Copernicus GLO-30 DEM © ESA/DLR/Airbus, distributed by OpenTopography, [doi:10.5069/G9028PQB](https://doi.org/10.5069/G9028PQB) | Free use and redistribution with attribution (Copernicus DEM licence). |
| `sites/berkeley/output_USGS1m.tif` and the `elev` grid in `data/berkeley.json` | USGS 3DEP 1 m lidar DEM, via OpenTopography (`OTNED.012021.4269.3`) | Public domain (US Government work). |
| The `noah` grids and NOAH shares in the Philippine `data/*.json` files (the raw shapefiles are not committed) | UP Project NOAH / UP Resilience Institute flood hazard maps (5-, 25- and 100-year): the provinces the campus boxes fall in (Metro Manila, Laguna, Batangas, Nueva Ecija, Cebu, Lanao del Norte, Misamis Oriental) and any neighbouring province a box reaches | ODbL 1.0. |
| Barangay names, codes and cells in `data/*.json` and `places.json`; `data/ph_outline.json` (country outline); `sites/*/barangays.geojson` | Philippine Statistics Authority (PSA) and National Mapping and Resource Information Authority (NAMRIA) administrative boundaries, via OCHA HDX (`cod-ab-phl`, <https://data.humdata.org/dataset/cod-ab-phl>) | [Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)](https://creativecommons.org/licenses/by/3.0/igo/), as stated on the HDX dataset page (confirmed by Gregor, 2026-09-27). |
| The MMDA passability thresholds and the vehicle-speed context | MMDA Flood Gauge; Mamuyac et al. (2025), *Natural Hazards* 121:14907 | Facts, cited in the README. |
| `shared/tiles/*.pmtiles` (the vector map tiles) | OpenStreetMap (roads, rivers, places, streets, waterways) and VIDA's combined building footprints (Google Open Buildings, Microsoft Building Footprints, OSM) | OpenStreetMap: ODbL 1.0. Google Open Buildings: CC BY 4.0. Microsoft Building Footprints: ODbL 1.0. Attribution shown on the map. |
| `shared/fonts/*` | Noto Sans glyphs, from protomaps/basemaps-assets | SIL Open Font License 1.1 (`shared/fonts/OFL.txt`). |
| `shared/fonts/atkinson/*.woff2` (the page's typeface) | Atkinson Hyperlegible Next and Atkinson Hyperlegible Mono © 2020, 2024 Braille Institute of America, files as supplied by the Braille Institute, unaltered | Free for non-commercial and commercial use without derivatives or alteration; no attribution required (the licence in the fonts' own name table). |
| `shared/fonts/Atkinson Hyperlegible Next Regular/*.pbf`, `…Medium/*.pbf` (map-label glyphs) | Rendered by `tools/build_glyphs.py` from the SIL OFL release of Atkinson Hyperlegible Next (github.com/google/fonts, `ofl/atkinsonhyperlegiblenext`); code points it lacks are Noto Sans glyphs | SIL Open Font License 1.1 (`shared/fonts/atkinson/OFL.txt`; Noto: `shared/fonts/OFL.txt`). |
| `lib/pmtiles-4.5.0/*` | pmtiles (Protomaps) with fflate | BSD-3-Clause and MIT (`LICENSE.txt` in that folder). |
| Map tiles and fonts in UC Berkeley's zoomed-out view only (fetched live, not in the repo) | OpenFreeMap © OpenMapTiles Data from OpenStreetMap | OpenStreetMap data ODbL 1.0; OpenMapTiles schema; attribution shown on the map. |
| `lib/maplibre-gl-6.11.2/*` | MapLibre GL JS | BSD-3-Clause (`LICENSE.txt` in that folder). |

The FABDEM licence is the most restrictive here: the Philippine site files may
be shared and adapted for non-commercial purposes only, with attribution and
under the same licence.

The sensor readings in the dashboard are simulated and carry no licence.
