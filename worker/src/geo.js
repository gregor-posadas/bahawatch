import PLACES from '../../places.json' with { type: 'json' };
export { PLACES };
const BY_ID = new Map(Object.values(PLACES.sites).flat().map((p) => [p.id, p]));
export const placeById = (id) => BY_ID.get(id) || null;
export const round3 = (x) => Math.round(x * 1000) / 1000;
export function haversineM(lat1, lon1, lat2, lon2) {
  const r = (d) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}
