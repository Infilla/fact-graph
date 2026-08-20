const missing = value => value === '' || value === null || value === undefined;

export function populateGisFromCoordinates(site, random = Math.random) {
  if (!site || missing(site.latitude) || missing(site.longitude)) return false;
  site.gis ||= {};
  let changed = false;
  const setIfMissing = (name, value) => {
    if (!missing(site.gis[name])) return;
    site.gis[name] = String(value);
    changed = true;
  };
  setIfMissing('stateMaintained', true);
  setIfMissing('limitedAccess', random() < 0.2);
  setIfMissing('airportAirspace', random() < 0.2);
  setIfMissing('nearRailroad', random() < 0.2);
  return changed;
}
