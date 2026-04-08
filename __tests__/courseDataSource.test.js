import * as turf from '@turf/turf';
import { normaliseOsmCourse } from '../data/courseDataSource';
import belconnen from './fixtures/belconnen.json';

// ── Shared osmSummary for Belconnen ───────────────────────────────────────────
// Relation 4180856; bbox from `relation(4180856);out bb;`
const BELCONNEN_SUMMARY = {
  osmType: 'relation',
  osmId: 4180856,
  name: 'Belconnen Golf Course',
  location: { lat: -35.2235, lng: 149.0024 },
  bbox: [148.9975742, -35.2298912, 149.0073257, -35.2170949],
  tags: { website: null, phone: null },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function distM(a, b) {
  return turf.distance(
    turf.point([a.lng, a.lat]),
    turf.point([b.lng, b.lat]),
    { units: 'meters' },
  );
}

// ── test suites ───────────────────────────────────────────────────────────────

describe('normaliseOsmCourse — Belconnen', () => {
  let course;

  beforeAll(() => {
    course = normaliseOsmCourse(belconnen, BELCONNEN_SUMMARY);
  });

  test('ingests successfully with all 18 holes, refs 1–18, par 72', () => {
    expect(course.holes).toHaveLength(18);

    const refs = course.holes.map((h) => h.hole).sort((a, b) => a - b);
    expect(refs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);

    const totalPar = course.holes.reduce((s, h) => s + h.par, 0);
    expect(totalPar).toBe(72);
  });

  test('each hole has a valid stroke index 1–18 with no duplicates', () => {
    const indices = course.holes.map((h) => h.index).sort((a, b) => a - b);
    expect(indices).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  test('stroke index is ranked by avg shot length (length / (par-2)), not raw length', () => {
    // Index 1 must have the highest avg-shot-length; index 18 the lowest.
    // A par 5 must not automatically beat a short par 3 just because it's longer.
    const withAvg = course.holes.map((h) => ({
      hole: h.hole,
      index: h.index,
      avg: h.length / Math.max(h.par - 2, 1),
    }));

    const idx1 = withAvg.find((h) => h.index === 1);
    const idx18 = withAvg.find((h) => h.index === 18);
    expect(idx1.avg).toBeGreaterThan(idx18.avg);

    // Every hole with a lower index should have a higher or equal avg shot length
    const sorted = [...withAvg].sort((a, b) => a.index - b.index);
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].avg).toBeGreaterThanOrEqual(sorted[i + 1].avg - 0.01);
    }
  });

  test('practice hole (no ref) is filtered out', () => {
    // OSM way 951442191 has golf=hole but no ref — must not appear
    expect(course.holes).toHaveLength(18);
    // Verify the practice hole is not among valid refs
    const refs = course.holes.map((h) => h.hole);
    refs.forEach((r) => expect(r).toBeGreaterThanOrEqual(1));
    refs.forEach((r) => expect(r).toBeLessThanOrEqual(18));
  });

  test('"Practice Green" green (non-numeric ref) is filtered out', () => {
    // way 1038901355 has ref="Practice Green" — must not be used as any hole's green
    // All 18 holes must have a green with a valid polygon centroid
    expect(course.holes.every((h) => h.green && h.green.centre)).toBe(true);
  });

  test('every hole has a tee, green polygon, centre, front, and back', () => {
    for (const h of course.holes) {
      expect(h.tee).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
      expect(h.green).toBeDefined();
      expect(h.green.polygon).toBeDefined();
      expect(h.green.centre).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
      expect(h.green.front).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
      expect(h.green.back).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) });
    }
  });

  test('front/centre/back are in correct order relative to line of play', () => {
    // For every hole: front is closer to the tee than back is.
    // Also: front < centre < back in distance from tee — all must hold within
    // ±5m tolerance (greens are ~25–30m in diameter).
    for (const h of course.holes) {
      const { tee, green } = h;
      const distFront = distM(tee, green.front);
      const distCentre = distM(tee, green.centre);
      const distBack = distM(tee, green.back);

      // Front must be closer to the tee than back
      expect(distFront).toBeLessThan(distBack);

      // Centre must be between front and back (within a 5m allowance to account
      // for non-circular greens where the centroid sits off-axis)
      expect(distCentre).toBeGreaterThan(distFront - 5);
      expect(distCentre).toBeLessThan(distBack + 5);
    }
  });

  test('course metadata is set correctly', () => {
    expect(course.id).toBe('relation/4180856');
    expect(course.source).toBe('osm');
    expect(course.schemaVersion).toBe(1);
    expect(course.name).toBe('Belconnen Golf Course');
    expect(course.ingestConfidence).toBe('high');
    expect(course.osmMetadata.osmType).toBe('relation');
    expect(course.osmMetadata.osmId).toBe(4180856);
  });
});

describe('normaliseOsmCourse — quality bar rejection', () => {
  test('rejects a course where all hole refs are missing', () => {
    const noRefs = {
      ...belconnen,
      elements: belconnen.elements.map((e) => {
        if (e.tags && e.tags.golf === 'hole') {
          const { ref: _omit, ...restTags } = e.tags;
          return { ...e, tags: restTags };
        }
        return e;
      }),
    };
    expect(() => normaliseOsmCourse(noRefs, BELCONNEN_SUMMARY)).toThrow(
      /Quality bar/,
    );
  });

  test('rejects a course where only 5 holes have refs', () => {
    let count = 0;
    const fewRefs = {
      ...belconnen,
      elements: belconnen.elements.map((e) => {
        if (e.tags && e.tags.golf === 'hole' && e.tags.ref) {
          count++;
          if (count > 5) {
            const { ref: _omit, ...restTags } = e.tags;
            return { ...e, tags: restTags };
          }
        }
        return e;
      }),
    };
    expect(() => normaliseOsmCourse(fewRefs, BELCONNEN_SUMMARY)).toThrow(
      /Quality bar/,
    );
  });
});
