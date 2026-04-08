/**
 * YourPar v1 schema types (JSDoc only — no runtime code)
 *
 * GPS-related fields are optional. All existing manual/demo courses
 * omit them entirely (undefined, not null) to save bytes.
 */

/**
 * @typedef {Object} GeoJSONPolygon
 * @property {'Polygon'} type
 * @property {number[][][]} coordinates - [ring][point][lng, lat]
 */

/**
 * @typedef {{ lat: number, lng: number }} LatLng
 */

/**
 * @typedef {Object} GreenGeometry
 * @property {GeoJSONPolygon} polygon   - Raw polygon for Turf operations
 * @property {LatLng} centre            - Precomputed centroid
 * @property {LatLng} front             - Closest point of green along line of play
 * @property {LatLng} back              - Farthest point of green along line of play
 */

/**
 * @typedef {Object} OsmMetadata
 * @property {'way'|'relation'} osmType
 * @property {number} osmId
 * @property {string} fetchedAt         - ISO 8601
 * @property {string|null} website
 * @property {string|null} phone
 */

/**
 * @typedef {Object} Hole
 *
 * Existing fields (v0, unchanged):
 * @property {number} hole              - 1–18 (or 1–9)
 * @property {number} par
 * @property {number} length            - metres
 * @property {number} index             - stroke index 1–18
 *
 * New in v1 (all optional — omit for non-GPS courses):
 * @property {LatLng} [tee]             - Primary tee position
 * @property {GreenGeometry} [green]    - Green geometry and precomputed points
 * @property {GeoJSONPolygon} [fairway] - Captured for future hazard work
 * @property {'ref'|'chained'|'manual'} [matchMethod]
 * @property {'high'|'medium'|'low'} [matchConfidence]
 */

/**
 * @typedef {Object} Course
 *
 * New in v1:
 * @property {string} id                - 'relation/4180856' for OSM, UUID for manual, 'demo/burns' for demo
 * @property {'manual'|'osm'|'demo'} source
 * @property {1} schemaVersion
 *
 * GPS fields (null for manual/demo):
 * @property {LatLng|null} [location]   - Centroid, for "near me" sorting
 * @property {number[]|null} [bbox]     - [minLng, minLat, maxLng, maxLat]
 * @property {OsmMetadata|null} [osmMetadata]
 * @property {'high'|'medium'|'low'|null} [ingestConfidence]
 *
 * Existing fields (v0, unchanged):
 * @property {string} name
 * @property {Hole[]} holes
 */

export {};
