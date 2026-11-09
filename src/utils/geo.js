// Location maths: real distances, fuzzed map pins, and the distance text people see.

const EARTH_RADIUS_KM = 6371;
const MIN_FUZZ_KM = 0.2;
const MAX_FUZZ_KM = 0.4;
const SMALL_MOVE_KM = 0.1;
const KM_PER_DEGREE_LATITUDE = 111.32;

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

// The Haversine formula gives the distance between two points on a sphere, such as the Earth.
export function distanceKm(lat1, lng1, lat2, lng2) {
  const latDifference = toRadians(lat2 - lat1);
  const lngDifference = toRadians(lng2 - lng1);

  const a =
    Math.sin(latDifference / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(lngDifference / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Finds the point a given distance and direction away. Accurate enough for short distances.
export function offsetPoint(lat, lng, km, bearingRadians) {
  // Lines of longitude get closer together towards the poles, so the same distance
  // needs more degrees there. The minimum avoids dividing by almost zero at a pole.
  const lngScale = Math.max(Math.cos(toRadians(lat)), 0.01);

  const newLat = lat + (km * Math.cos(bearingRadians)) / KM_PER_DEGREE_LATITUDE;
  const newLng = lng + (km * Math.sin(bearingRadians)) / (KM_PER_DEGREE_LATITUDE * lngScale);

  return {
    lat: Math.min(90, Math.max(-90, newLat)),
    // Keeps longitude between -180 and 180 for someone near the date line.
    lng: ((newLng + 540) % 360) - 180,
  };
}

function randomFuzzedPoint(lat, lng) {
  const km = MIN_FUZZ_KM + Math.random() * (MAX_FUZZ_KM - MIN_FUZZ_KM);
  const bearing = Math.random() * 2 * Math.PI;
  return offsetPoint(lat, lng, km, bearing);
}

// Creates the location stored for a user.
// If they've barely moved, the old pin is kept. A new random pin for every update from the same
// spot would let someone average the pins and find the real position.
export function buildLocation(previous, lat, lng) {
  let fuzzed = null;

  if (previous) {
    const movedKm = distanceKm(previous.lat, previous.lng, lat, lng);
    const pinDistanceKm = distanceKm(previous.fuzzLat, previous.fuzzLng, lat, lng);
    // The second check keeps the pin 200–400 m away even after several small moves add up.
    const canKeepPin =
      movedKm < SMALL_MOVE_KM && pinDistanceKm >= MIN_FUZZ_KM && pinDistanceKm <= MAX_FUZZ_KM;
    if (canKeepPin) {
      fuzzed = { lat: previous.fuzzLat, lng: previous.fuzzLng };
    }
  }

  if (!fuzzed) {
    fuzzed = randomFuzzedPoint(lat, lng);
  }

  return {
    lat,
    lng,
    fuzzLat: fuzzed.lat,
    fuzzLng: fuzzed.lng,
    updatedAt: new Date().toISOString(),
  };
}

// The exact number stays on the server, and only this text is sent to other people.
export function distanceLabel(km) {
  return km < 0.5 ? '< 0.5 km' : `${km.toFixed(1)} km`;
}
