# Elevation check: FABDEM (and later FathomDEM) against ICESat-2 ground heights

2026-09-29. How wrong is "the bowl" at each campus? Reference: NASA ICESat-2 ground heights (ATL03 photons classified
with ATL08, 20 m segments, `h_te_median`), fetched with the SlideRule web client (client.slideruleearth.io, product
"ICESat-2 Canopy Heights" = PhoREAL, no login) for the 26 campus boxes, 2019–2026.

- Quality filter: `h_te_median > 0`, `ground_photon_count >= 10`, `pflags == 0` → 17,936 segments.
- Heights: ICESat-2 is ellipsoidal (ITRF2014); FABDEM is EGM2008. H = h_te_median − N, N from PROJ's
  `us_nga_egm08_25.tif` (github.com/OSGeo/PROJ-data), bilinear. N ≈ 43.7 m at Teachers Village.
- DEM sampled bilinearly from each campus cut `inputs/campuses/<id>/dem.tif` (not in git).
- `fabdem_results.txt`: per campus n, bias, median, RMSE, NMAD, % within 1 m / 2 m, % of segments with ≥ 12 m of
  canopy/buildings. `icesat2_ground_points.csv`: the filtered points with H and the FABDEM value.

Result: all 26 — bias +0.33 m, median +0.66 m, NMAD 1.39 m, RMSE 3.88 m, 46 % within 1 m, 72 % within 2 m. Open or
low-rise campuses (CLSU, LLCC, MSU-IIT, CMU): NMAD 0.4–0.8 m. Old Manila core (UST, FEU Tech, Mapúa, UDM): FABDEM
~2 m above ground, 2–12 % within 1 m. Error grows with built-up share.

Re-run: `python3 analysis/dem_check/score_dem_vs_icesat2.py <dir with us_nga_egm08_25.tif> <SlideRule CSVs…>`
(from the repo root). Caveat: in tight streets the satellite may take roofs for ground (pushes errors negative).
