/**
 * YourPar Overpass data layer.
 *
 * Exports:
 *   discoverNearby(lat, lng, radiusM)  → CourseSummary[]   (cached, network)
 *   ingest(osmSummary)                 → Course            (network)
 *   normaliseOsmCourse(data, summary)  → Course            (pure, exported for tests)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as turf from '@turf/turf';

// ─── constants ────────────────────────────────────────────────────────────────

// Mirrors tried in order. If one returns 5xx or times out we fall through.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const DISCOVER_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const OVERPASS_TIMEOUT_MS = 20000; // 20 s per mirror attempt

// ─── low-level geometry helpers ───────────────────────────────────────────────

/**
 * Distance in metres between two {lat, lng} points.
 * Uses Turf — accurate on real WGS-84 coordinates.
 */
function distanceM(a, b) {
  return turf.distance(
    turf.point([a.lng, a.lat]),
    turf.point([b.lng, b.lat]),
    { units: 'meters' },
  );
}

/**
 * Centroid of an Overpass geometry array ({lat, lon}[]).
 * Returns {lat, lng}.
 */
function centroidOfGeom(geometry) {
  const coords = geometry.map((n) => [n.lon, n.lat]);
  const c = turf.centroid(turf.polygon([coords]));
  return { lat: c.geometry.coordinates[1], lng: c.geometry.coordinates[0] };
}

/**
 * Length of an Overpass way geometry in metres (straight-line segments).
 */
function lengthOfWay(geometry) {
  const coords = geometry.map((n) => [n.lon, n.lat]);
  return Math.round(turf.length(turf.lineString(coords), { units: 'meters' }));
}

/**
 * Compute the GreenGeometry for a green way, given the tee-end point.
 *
 * Projects each polygon vertex onto the tee→centroid axis (the "line of play").
 * The vertex with the minimum projection is `front` (closest to player approaching
 * from the tee); the vertex with the maximum projection is `back`.
 *
 * @param {object} greenWay   - Overpass way with geometry
 * @param {{ lat, lng }} teePoint
 * @returns {{ polygon, centre, front, back }}
 */
function computeGreenGeometry(greenWay, teePoint) {
  const coords = greenWay.geometry.map((n) => [n.lon, n.lat]);
  const polygon = turf.polygon([coords]);

  const centroidFeature = turf.centroid(polygon);
  const centre = {
    lat: centroidFeature.geometry.coordinates[1],
    lng: centroidFeature.geometry.coordinates[0],
  };

  // Bearing from tee to centre defines the line of play
  const teePt = turf.point([teePoint.lng, teePoint.lat]);
  const centrePt = turf.point([centre.lng, centre.lat]);
  const bearing = turf.bearing(teePt, centrePt);

  // Project each polygon vertex onto the line-of-play axis;
  // find the min (front) and max (back) projections.
  let frontVertex = null;
  let backVertex = null;
  let minProj = Infinity;
  let maxProj = -Infinity;

  // Exclude the repeated closing vertex of the ring
  const ring = coords.slice(0, -1);
  for (const coord of ring) {
    const vertexPt = turf.point(coord);
    const dist = turf.distance(teePt, vertexPt, { units: 'meters' });
    const bearingToVertex = turf.bearing(teePt, vertexPt);
    const angleDiff = (bearingToVertex - bearing) * (Math.PI / 180);
    const proj = dist * Math.cos(angleDiff);

    if (proj < minProj) {
      minProj = proj;
      frontVertex = { lat: coord[1], lng: coord[0] };
    }
    if (proj > maxProj) {
      maxProj = proj;
      backVertex = { lat: coord[1], lng: coord[0] };
    }
  }

  return {
    polygon: polygon.geometry,
    centre,
    front: frontVertex,
    back: backVertex,
  };
}

// ─── normaliser ───────────────────────────────────────────────────────────────

/**
 * Pure function: converts raw Overpass ingest data + a course summary into a
 * fully normalised v1 Course object. Throws a descriptive error if the data
 * fails the quality bar.
 *
 * Exported for unit testing — callers supply the Overpass JSON directly so
 * tests never make network calls.
 *
 * @param {{ elements: object[] }} overpassData  - Raw Overpass `out geom;` response
 * @param {object} osmSummary                    - CourseSummary from discoverNearby
 * @returns {import('./types').Course}
 */
export function normaliseOsmCourse(overpassData, osmSummary) {
  const els = overpassData.elements;

  // ── 1. Filter holes ──────────────────────────────────────────────────────────
  // Drop anything without a numeric ref (practice holes, range markers, etc.)
  const validHoles = els.filter((e) => {
    if (!(e.tags && e.tags.golf === 'hole')) return false;
    if (!e.tags.ref) return false;
    return !isNaN(parseInt(e.tags.ref, 10));
  });

  // ── 2. Filter greens ─────────────────────────────────────────────────────────
  // Drop greens with no geometry or a non-numeric ref (e.g. "Practice Green")
  const validGreens = els.filter((e) => {
    if (!(e.tags && e.tags.golf === 'green')) return false;
    if (!e.geometry || e.geometry.length < 3) return false;
    if (e.tags.ref && isNaN(parseInt(e.tags.ref, 10))) return false;
    return true;
  });

  // ── 3. Filter tees ───────────────────────────────────────────────────────────
  const validTees = els.filter(
    (e) =>
      e.tags &&
      e.tags.golf === 'tee' &&
      e.geometry &&
      e.geometry.length >= 3,
  );

  // ── 4. Quality bar — hole count ──────────────────────────────────────────────
  const holeCount = validHoles.length;
  if (holeCount !== 18 && holeCount !== 9) {
    throw new Error(
      `Quality bar: expected 18 or 9 holes, got ${holeCount} after filtering`,
    );
  }
  const maxRef = holeCount;

  // ── 5. Quality bar — ref range ───────────────────────────────────────────────
  for (const h of validHoles) {
    const ref = parseInt(h.tags.ref, 10);
    if (ref < 1 || ref > maxRef) {
      throw new Error(
        `Quality bar: hole ref ${ref} is out of range 1–${maxRef}`,
      );
    }
  }

  // ── 6. Pre-compute green centroids ───────────────────────────────────────────
  const greensWithCentroid = validGreens.map((g) => ({
    ...g,
    _centroid: centroidOfGeom(g.geometry),
  }));

  // ── 7. Proximity filter — drop greens >50 m from every hole endpoint ─────────
  const allEndpoints = validHoles.flatMap((h) => {
    const pts = h.geometry;
    return [
      { lat: pts[0].lat, lng: pts[0].lon },
      { lat: pts[pts.length - 1].lat, lng: pts[pts.length - 1].lon },
    ];
  });

  const proximateGreens = greensWithCentroid.filter((g) =>
    allEndpoints.some((pt) => distanceM(g._centroid, pt) <= 50),
  );

  // ── 8. Match each hole to a green ────────────────────────────────────────────
  const holes = [];

  for (const holeWay of validHoles) {
    const pts = holeWay.geometry;
    const firstPt = { lat: pts[0].lat, lng: pts[0].lon };
    const lastPt = { lat: pts[pts.length - 1].lat, lng: pts[pts.length - 1].lon };

    // Find green whose centroid is closest to either endpoint
    let bestGreen = null;
    let bestDist = Infinity;
    let greenEndPt = null;
    let teeEndPt = null;

    for (const g of proximateGreens) {
      const dFirst = distanceM(g._centroid, firstPt);
      const dLast = distanceM(g._centroid, lastPt);
      const d = Math.min(dFirst, dLast);
      if (d < bestDist) {
        bestDist = d;
        bestGreen = g;
        if (dFirst <= dLast) {
          greenEndPt = firstPt;
          teeEndPt = lastPt;
        } else {
          greenEndPt = lastPt;
          teeEndPt = firstPt;
        }
      }
    }

    // Quality bar — green must be within 30 m of a hole endpoint
    if (!bestGreen || bestDist > 30) {
      throw new Error(
        `Quality bar: hole ${holeWay.tags.ref} has no green within 30 m` +
          (bestGreen ? ` (closest: ${bestDist.toFixed(1)} m)` : ''),
      );
    }

    // Closest tee feature to the tee end
    let primaryTee = null;
    let bestTeeDist = Infinity;
    for (const teeWay of validTees) {
      const tc = centroidOfGeom(teeWay.geometry);
      const d = distanceM(tc, teeEndPt);
      if (d < bestTeeDist) {
        bestTeeDist = d;
        primaryTee = tc;
      }
    }

    // Compute green geometry (polygon, centroid, front, back)
    const greenGeom = computeGreenGeometry(bestGreen, teeEndPt);

    holes.push({
      hole: parseInt(holeWay.tags.ref, 10),
      par: holeWay.tags.par ? parseInt(holeWay.tags.par, 10) : null,
      length: lengthOfWay(holeWay.geometry),
      index: null, // assigned in step 9
      tee: primaryTee,
      green: greenGeom,
      matchMethod: 'ref',
      matchConfidence: 'high',
    });
  }

  // ── 9. Assign stroke index — hardest average shot = index 1 ─────────────────
  // Use length / (par - 2) as the difficulty proxy: this is the average
  // distance per shot to the green. A par 5 is long but you get 3 shots to
  // the green, so it may be easier per-shot than a short but tight par 3.
  // Guard against par ≤ 2 (shouldn't exist, but divide-by-zero safe).
  [...holes]
    .sort((a, b) => {
      const girA = Math.max((a.par ?? 4) - 2, 1);
      const girB = Math.max((b.par ?? 4) - 2, 1);
      return b.length / girB - a.length / girA;
    })
    .forEach((h, i) => {
      h.index = i + 1;
    });

  // ── 10. Build Course ─────────────────────────────────────────────────────────
  const { osmType, osmId, name, location, bbox, tags = {} } = osmSummary;
  return {
    id: `${osmType}/${osmId}`,
    source: 'osm',
    schemaVersion: 1,
    name,
    location: location ?? null,
    bbox: bbox ?? null,
    osmMetadata: {
      osmType,
      osmId,
      fetchedAt: new Date().toISOString(),
      website: tags.website ?? null,
      phone: tags.phone ?? null,
    },
    ingestConfidence: 'high',
    holes: holes.sort((a, b) => a.hole - b.hole),
  };
}

// ─── network helpers ──────────────────────────────────────────────────────────

async function postOverpass(query) {
  let lastError;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);

      let response;
      try {
        response = await fetch(mirror, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      // 5xx → try next mirror; 4xx → fail immediately (bad query, not server issue)
      if (response.status >= 500) {
        const text = await response.text().catch(() => '');
        lastError = new Error(`Overpass ${response.status} from ${mirror}: ${text.slice(0, 120)}`);
        console.warn('[courseDataSource] mirror failed, trying next:', mirror, response.status);
        continue;
      }
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`Overpass ${response.status}: ${text.slice(0, 200)}`);
      }

      return response.json();
    } catch (e) {
      if (e.name === 'AbortError') {
        lastError = new Error(`Overpass timeout on ${mirror}`);
        console.warn('[courseDataSource] mirror timed out, trying next:', mirror);
        continue;
      }
      // Network error (no connectivity etc.) — try next mirror
      lastError = e;
      console.warn('[courseDataSource] mirror error, trying next:', mirror, e.message);
    }
  }

  throw lastError ?? new Error('All Overpass mirrors failed');
}

// ─── discoverNearby ───────────────────────────────────────────────────────────

/**
 * Find golf courses within `radiusM` metres of the given location.
 * Results are cached in AsyncStorage for 24 hours keyed on ±1 km granularity.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radiusM=50000]
 * @returns {Promise<CourseSummary[]>}
 */
export async function discoverNearby(lat, lng, radiusM = 50000, forceRefresh = false) {
  const rLat = Math.round(lat * 100) / 100;
  const rLng = Math.round(lng * 100) / 100;
  const cacheKey = `discover:${rLat}:${rLng}:${radiusM}`;

  // Check cache (skipped when forceRefresh is true)
  if (!forceRefresh) {
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const { data, fetchedAt } = JSON.parse(cached);
        if (Date.now() - new Date(fetchedAt).getTime() < DISCOVER_TTL_MS) {
          return data;
        }
      }
    } catch {
      // Cache miss or corrupt — fall through to network
    }
  }

  // out bb; returns bounds (minlat/minlon/maxlat/maxlon) AND center for
  // way/relation elements — giving us both the bbox needed for ingest and
  // the centroid needed for distance sorting.
  const query =
    `[out:json][timeout:25];` +
    `(node["leisure"="golf_course"](around:${radiusM},${lat},${lng});` +
    `way["leisure"="golf_course"](around:${radiusM},${lat},${lng});` +
    `relation["leisure"="golf_course"](around:${radiusM},${lat},${lng});` +
    `);out bb;`;

  const json = await postOverpass(query);

  const courses = json.elements
    .filter((e) => e.tags && e.tags.name)
    .map((e) => {
      const bounds = e.bounds;
      // Nodes have lat/lon directly; ways/relations have center + bounds from `out bb;`
      const center =
        e.center ??
        (e.type === 'node'
          ? { lat: e.lat, lon: e.lon }
          : bounds
            ? {
                lat: (bounds.minlat + bounds.maxlat) / 2,
                lon: (bounds.minlon + bounds.maxlon) / 2,
              }
            : null);
      return {
        id: `${e.type}/${e.id}`,
        osmType: e.type,
        osmId: e.id,
        name: e.tags.name,
        location: center ? { lat: center.lat, lng: center.lon } : null,
        bbox: bounds
          ? [bounds.minlon, bounds.minlat, bounds.maxlon, bounds.maxlat]
          : null,
        tags: {
          website: e.tags.website ?? null,
          phone: e.tags.phone ?? null,
        },
      };
    });

  // Cache result (non-fatal on write error)
  try {
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ data: courses, fetchedAt: new Date().toISOString() }),
    );
  } catch {
    /* non-fatal */
  }

  return courses;
}

// ─── ingest ───────────────────────────────────────────────────────────────────

/**
 * Fetch and normalise a full course from Overpass, given a CourseSummary
 * (from discoverNearby or a cached entry).
 *
 * Throws if the course fails the quality bar.
 *
 * @param {object} osmSummary - CourseSummary with osmType, osmId, bbox, name, tags
 * @returns {Promise<import('./types').Course>}
 */
export async function ingest(osmSummary) {
  const { bbox } = osmSummary;
  if (!bbox) throw new Error('Cannot ingest: osmSummary has no bbox');

  const [minLng, minLat, maxLng, maxLat] = bbox;
  const bboxStr = `${minLat},${minLng},${maxLat},${maxLng}`;

  const query =
    `[out:json][timeout:25];` +
    `(way["golf"="hole"](${bboxStr});` +
    `way["golf"="green"](${bboxStr});` +
    `way["golf"="tee"](${bboxStr});` +
    `way["golf"="fairway"](${bboxStr});` +
    `);out geom;`;

  const overpassData = await postOverpass(query);
  return normaliseOsmCourse(overpassData, osmSummary);
}
