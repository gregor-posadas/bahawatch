# Data licences

The code in this repository is MIT-licensed (see `LICENSE`). The data files
are derived from open datasets and remain under their source licences.

| Files | Source | Licence |
|---|---|---|
| `data.json`, `data_diliman.json`, `data_berkeley.json` (street, creek and building layers, sensor siting), `inputs/export.geojson`, `sites/*/export.geojson` | © OpenStreetMap contributors, via the Overpass API | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). These are derivative databases: any further redistribution must attribute OpenStreetMap and stay under ODbL. |
| `inputs/output_hh.tif`, `sites/diliman/output_hh.tif`, and the `elev` grids inside the Philippine data blobs | Copernicus GLO-30 DEM © ESA/DLR/Airbus, distributed by OpenTopography, [doi:10.5069/G9028PQB](https://doi.org/10.5069/G9028PQB) | Free use and redistribution with attribution (Copernicus DEM licence). |
| `sites/berkeley/output_USGS1m.tif` and the `elev` grid inside `data_berkeley.json` | USGS 3DEP 1 m lidar DEM, via OpenTopography (`OTNED.012021.4269.3`) | Public domain (US Government work). |
| The `noah` grids inside the Philippine data blobs (the raw shapefiles are not committed — README §2.3) | UP Project NOAH / UP Resilience Institute Metro Manila flood hazard maps | ODbL 1.0. |
| The MMDA passability thresholds and the vehicle-speed context | MMDA Flood Gauge; Mamuyac et al. (2025), *Natural Hazards* 121:14907 | Facts, cited in the README. |

The sensor readings in the dashboard are simulated and carry no licence.
