# YourPar GPS Feature — Design Doc

**Status:** Approved, ready for implementation
**Audience:** Future Claude (Code) sessions, future Mark
**Source of truth:** This document. If implementation diverges, update this doc in the same commit.

---

## 1. What we're building

YourPar is gaining GPS-aware course discovery and live "next shot" recommendations, sourced from OpenStreetMap via the Overpass API. The goal is to transform YourPar from a pre-round planning tool into a **live caddie** that gives the user the right club for their next shot from wherever they're standing.

### Why
- Removes the friction of manual course entry (current onboarding pain point)
- Adds genuine in-round value: "what club from here?" answered live
- Differentiates YourPar from Shot Scope and similar — no hardware, no setup, value from session one
- Lays the groundwork for personalised club distance learning (Phase 8) without ever requiring tags or sensors

### Why OpenStreetMap
- Free, no API key, no rate limits beyond reasonable use
- Coverage validated: 654 named golf courses found in NSW/ACT/VIC (single Overpass query, April 2026)
- Belconnen Golf Course (canonical test case) has high-quality data: every hole tagged with `ref` and `par`, all greens as polygons, multiple tees per hole
- Public data, swappable later if needed (the schema deliberately decouples from OSM quirks)

---

## 2. Core principles

These principles override implementation details. When in doubt, refer back here.

1. **The strategy engine cares about distance to green, not hole length.** Hole length is only used for the initial "from the tee" view and the `yourPar` allocation. Live recommendations care only about where the user is *now*.

2. **The "plan" and the "next shot recommendation" are decoupled.** They answer different questions (psychological framing vs immediate action) and must not interfere with each other. See §6.

3. **GPS data is additive, never required.** Every GPS field on the schema is optional. Existing manual courses, the Burns demo, and any course with incomplete OSM data must continue to work — the strategy engine should never crash because `hole.green` is undefined.

4. **OSM is decoupled at the data layer.** Raw Overpass JSON never reaches the rest of the app. Ingest normalises immediately into YourPar's internal schema. The data source is swappable.

5. **Strict quality bar for GPS-enabled courses.** Bad GPS data is worse than no GPS data — it erodes user trust. A course is only GPS-enabled if it meets the quality criteria in §7. Anything else is filtered from discovery or shown without GPS features.

6. **The existing strategy engine and `calculateYourPar` change as little as possible.** They already work. We're adding alongside, not rewriting.

7. **Battery-conscious GPS.** GPS subscription only when actively viewing the hole screen. One subscription at the parent level for the whole round, not one per hole.

8. **OSM data is cached aggressively.** Once a course is ingested, the user can play it offline indefinitely. Overpass is hit zero times during a round.

---

## 3. The schema

All courses in AsyncStorage now follow this shape. GPS-related fields are optional (null/undefined) for non-GPS courses. The strategy engine spreads the hole object (`{...hole, yourPar, ...}`) so any extra fields survive untouched.

### Course

```js
{
  // NEW in v1
  id: string,                // OSM type+id ("relation/4180856") or UUID for manual/demo
  source: 'manual' | 'osm' | 'demo',
  schemaVersion: 1,

  // GPS fields — null for manual/demo
  location: { lat, lng } | null,        // centroid, for "near me" sorting
  bbox: [minLng, minLat, maxLng, maxLat] | null,
  osmMetadata: {                        // null for non-osm
    osmType: 'way' | 'relation',
    osmId: number,
    fetchedAt: ISO8601 string,
    website: string | null,             // bonus from OSM relation tags
    phone: string | null,               // bonus from OSM relation tags
  } | null,
  ingestConfidence: 'high' | 'medium' | 'low' | null,

  // EXISTING (unchanged from v0)
  name: string,
  holes: Hole[],
}
```

### Hole

```js
{
  // EXISTING (unchanged from v0)
  hole: number,         // 1-18 (or 1-9 for 9-hole courses)
  par: number,
  length: number,       // meters; for OSM courses this is linestring length (see §8)
  index: number,        // stroke index 1-18 for difficulty ranking

  // NEW — all optional
  tee: { lat, lng } | null,             // primary tee (closest to start of hole linestring)
  green: {
    polygon: GeoJSONPolygon,            // raw polygon for Turf operations
    centre: { lat, lng },               // precomputed centroid
    front: { lat, lng },                // precomputed, relative to line of play
    back: { lat, lng },                 // precomputed, relative to line of play
  } | null,
  fairway: GeoJSONPolygon | null,       // captured for future hazard work, unused in v1
  matchMethod: 'ref' | 'chained' | 'manual' | null,
  matchConfidence: 'high' | 'medium' | 'low' | null,
}
```

### Schema design notes

- **`id` replaces `name` as the primary key.** Existing code keys courses by name (`addSavedCourse`, `deleteSavedCourse`, the FlatList `keyExtractor`). All of that changes to use `id`. This fixes the dedupe collision risk between manual and OSM courses, and is the single most important change in Phase 1.
- **Geometry is stored as GeoJSON, not raw OSM nodes.** Turf consumes GeoJSON natively, avoiding a translation layer at the GPS update hot path.
- **Front/centre/back are precomputed at ingest, not on the fly.** They depend on the line of play (tee → green centroid). Computing once at ingest means each GPS update is just three point-to-point Turf calls.
- **Stroke index is missing from OSM.** See §8 for the workaround.

### Stroke index

OSM doesn't tag stroke index. For OSM courses we approximate it from hole length (longest hole = index 1, shortest = index 18). This is roughly how SI works in practice and is good enough for the strategy engine, which only uses it to distribute extra strokes across holes when the user's target is over par. Users may eventually be able to override per-hole — that's a future enhancement, not v1.

---

## 4. Course identity and storage

### Identity
- **OSM courses:** `id` is `"{type}/{osmId}"`, e.g. `"relation/4180856"`. Stable across re-ingests, guaranteed unique by OSM.
- **Manual courses (legacy):** UUID generated by `expo-crypto.randomUUID()` during migration.
- **Burns demo:** hardcoded `id: "demo/burns"`.

### Storage keys (unchanged from v0)
- `currentCourse` — the active course (single object)
- `savedCourses` — array of courses the user has played before, acts as the cache
- `schemaVersion` — NEW, integer, used by the migration runner
- `savedCourses_v0_backup` — NEW, written once during v0→v1 migration as a safety net

### `savedCourses` becomes a cache, not a library
Post-pivot, the user never explicitly "saves" or "deletes" courses. They're cached automatically when the user plays them. There's no UI for managing the cache. Eviction is "never" for v1 (a course is ~10KB normalised, 100 courses is <1MB, AsyncStorage handles it fine). LRU eviction can come later if needed.

---

## 5. End-to-end flow

### First launch
1. Run migrations (see §10).
2. Open course-select screen.
3. Request foreground location permission. If denied → show Burns demo card only with "enable location to find courses" message.
4. One-shot `getCurrentPositionAsync` at low accuracy (city-level fine).
5. Query Overpass for courses within 25km (see §7).
6. Render "Courses near you" list, sorted by distance.
7. Burns demo card always shown at bottom as a fallback.
8. User taps a course → ingest (see §7) → set as `currentCourse` → straight into goal/strategy.

### Subsequent launches
1. Run migrations (idempotent — does nothing on already-migrated data).
2. Open course-select screen.
3. Show cached courses from `savedCourses` immediately (offline-first).
4. In parallel, query Overpass for nearby courses (24h cache TTL keyed on rounded lat/lng).
5. Merge and dedupe by `id`. Cached courses load instantly when tapped; new ones run ingest.

### During a round (hole screen)
1. Hole screen mounts. `currentCourse` is loaded.
2. If any hole has `green` data, parent screen subscribes to `watchPositionAsync` ONCE for the whole round.
3. As user swipes between holes, the GPS subscription stays alive at the parent level. The current hole's green is what changes, not the subscription.
4. Each location update (throttled to ~1/second for UI) recomputes:
   - Distance to front/centre/back of current hole's green via Turf
   - The "next shot" recommendation (see §6)
5. The "plan" header (Your Par, shots to green, avg distance) is set ONCE when the hole loads and doesn't update.
6. Subscription dies in cleanup when the screen unmounts.

---

## 6. The plan vs the recommendation (CRITICAL)

This is the most important architectural decision in the design. There are **two distinct things** on the hole screen and they must not be confused.

### The plan (static, set once at hole start)
- **Question it answers:** "What kind of hole is this for me today?"
- **Purpose:** Psychological framing. Sets the user's expectations so they don't feel like they're failing when they take 6 shots on a hole the scorecard calls a 4. This is the core of YourPar's identity.
- **When computed:** Once, when the user starts the hole.
- **What it shows:** Your Par for this hole, shots to green in the plan, average shot length, two putts assumed, optional one-line framing message.
- **Updates during hole:** NEVER. It must not jump around mid-hole or it loses its grounding effect.
- **Implementation:** This is essentially what `calculateYourPar` already produces. It stays as-is. The output goes into state and persists for the duration of the hole.

### The next shot recommendation (dynamic, recomputes on every GPS tick)
- **Question it answers:** "What do I do right now?"
- **Purpose:** Live tactical advice. The "live caddie" core experience.
- **When computed:** On every meaningful GPS update (throttled).
- **What it shows:** ONE recommendation. A single club, swing percentage, brief reasoning. Not a multi-shot path. Not "shot 2 of 4." Just the next shot.
- **Inputs:** Distance to green (from current GPS), user's clubs, WIR preference, (Phase 6: hazards).
- **Implementation:** A new pure function `recommendNextShot(distanceToGreen, clubs, prefs)` replaces `buildHoleStrategy`'s role on the live screen.

### How they relate
- **Decoupled.** The plan doesn't constrain the recommendation, and the recommendation doesn't update the plan.
- A user whose plan said "4 shots to green" hits a great drive leaving 130m → recommendation says "wedge it close" even though by the original plan they were "supposed" to be playing a longer iron next. That's correct behaviour.
- The one place they touch: when the user is on the tee, the recommendation should match what the original plan's first shot would have been (because they're standing where the plan was computed from).

### Layout sketch

```
HOLE 5 · Par 4 · 387m
─────────────────────────────────
THE PLAN (static)
Your Par: 6 · Shots to green: 4 · Avg: 95m
"This is a tough one — stay patient"
─────────────────────────────────
NEXT SHOT (live)
142m to centre (front 132 · back 158)
→ 6 IRON, full swing
─────────────────────────────────
SCORE THIS HOLE
[stepper]
```

### Edge cases the recommendation must handle
- **User on the green** (distance < 5m or inside polygon) → switch to a putting message instead of a club recommendation.
- **User impossibly far** (>500m, probably on wrong hole or driving to course) → suppress recommendation, show "waiting for GPS" or "are you on this hole?"
- **No GPS fix yet** → fall back to the original tee-based recommendation from `buildHoleStrategy` so the screen is never empty.
- **Hole has no green polygon** → no live recommendation possible. Fall back to existing static strategy view. This is the graceful degradation path — every screen must work for non-GPS courses.

---

## 7. Overpass queries and the quality bar

### Discovery query (find courses near user)
```
[out:json][timeout:25];
(
  node["leisure"="golf_course"](around:25000,{lat},{lng});
  way["leisure"="golf_course"](around:25000,{lat},{lng});
  relation["leisure"="golf_course"](around:25000,{lat},{lng});
);
out center;
```

- `out center` returns centroids without full geometry — small response, fast render.
- Cache result keyed on rounded lat/lng (e.g., to 2 decimal places ≈ 1km granularity), TTL 24h.

### Ingest query (full course data, given a course's bbox)
```
[out:json][timeout:25];
(
  way["golf"="hole"]({bbox});
  way["golf"="green"]({bbox});
  way["golf"="tee"]({bbox});
  way["golf"="fairway"]({bbox});
);
out geom;
```

- Use bbox queries, NOT `map_to_area`. `map_to_area` fails silently when the course is tagged as a relation (Belconnen is — see §8).
- Drop any feature whose centroid falls outside the parent course's bounds (handles adjacent courses sharing fence lines).

### The quality bar (what counts as GPS-enabled)

A course passes the quality bar and is shown in discovery as GPS-enabled IF:
1. It has exactly 18 (or exactly 9) hole features after filtering, AND
2. Every hole feature has a `ref` tag that parses to an integer in range 1–18 (or 1–9), AND
3. Every hole's far endpoint has a green polygon within 30m, AND
4. (Recommended) every hole has a `par` tag (but missing par can be inferred from length as a fallback).

Anything else is **filtered out of discovery entirely** for v1. Strict bar, but it means everything in the list works properly. Tier 2/3/4 matching strategies (chain inference, no-ref handling, user-correction screens) are deferred to a future version.

### Filter rules during ingest
- **Drop hole features without a `ref` tag** — these are practice features, range markers, or partial data.
- **Drop greens with non-numeric `ref`** (e.g., `ref=Practice Green`).
- **Drop greens whose centroid is more than 50m from the nearest hole's far endpoint.**

### Hole-to-green matching (Tier 1 only for v1)
1. For each `golf=hole` linestring, find the green polygon whose centroid is closest to either endpoint of the line.
2. The endpoint closer to the green is the "green end"; the other is the tee end.
3. Trust the `ref` tag for hole numbering. Mark `matchMethod: 'ref'`, `matchConfidence: 'high'`.
4. For each hole, find the closest `golf=tee` feature to the tee end of the linestring — that's the primary tee. (Most holes have multiple tees for forward/regular/back; we only care about one in v1.)

### Belconnen test case findings (April 2026)
- Course is `relation 4180856`, tagged `leisure=golf_course`, multipolygon with 2 outer members.
- Has bonus tags: `golf:par=72`, `golf:course=18_hole`, `phone`, `website`, `addr:street`. Capture the `phone` and `website` into `osmMetadata` for the course detail screen.
- All 18 holes have valid `ref` (1–18) and `par` tags. Total par 72.
- Has ~25 `golf=tee` features (multiple tees per hole).
- Has multiple `golf=fairway` polygons per hole (capture for future hazard work).
- One `golf=hole` feature (way 951442191) has no `ref` and no `par` — it's a practice/range feature. The filter rule above handles it.
- One green is tagged `ref=Practice Green` — also handled by the filter rule.

The Belconnen JSON should be saved to `__tests__/fixtures/belconnen.json` and used as the canonical test fixture for the matcher and normaliser.

---

## 8. Known limitations and decisions

### Hole length is computed from the linestring
OSM hole linestrings are typically only 2–4 nodes — straight tee-to-green lines, not following the actual fairway. The computed length will be the straight-line distance, which underestimates true playing distance on doglegs by ~5–15%.

**This is fine because the live strategy engine only cares about distance from the user's current position to the green.** Hole length is used only for:
1. The initial "from the tee" view (before first GPS update), and
2. The `yourPar` allocation, which works on rough averages anyway.

A 30m error on hole length rarely changes which clubs come out of the recommender. Decision: **use linestring distance directly, no correction factor.**

### Stroke index is approximated from length
OSM doesn't tag stroke index. For OSM courses, holes are ranked by length (longest = index 1, shortest = 18). Crude but consistent. Manual override per hole is a future enhancement.

### Course is a relation, not a way
Belconnen (and many courses) is tagged as a multipolygon `relation`, not a closed `way`. The discovery query MUST handle both types. The ingest query uses bbox so it sidesteps this entirely.

### Relations don't work with `map_to_area`
The original ingest query attempt used `map_to_area`, which silently fails on relation-typed courses and returns an empty dataset. **Use bbox queries always.**

### Hazards are not in v1
Phase 6 work. The fairway polygons are captured during ingest for future use, but not consumed.

### Manual entry is removed from the UI but kept in code
The `app/course-entry.js` file stays in the codebase so the navigation graph doesn't break and existing v0 manual courses can still be loaded after migration. It's just unlinked from the new course-select. We may delete it entirely in a later cleanup pass.

---

## 9. Implementation phases

Each phase is small enough to ship and verify in isolation. **Branch per phase, test on device, commit, merge before starting next.**

### Phase 1: Migration + schema
**Goal:** Add `id`, `source`, `schemaVersion` to existing courses. Re-key everything by `id`. No new features.

- Create `utils/migrations.js` with a `runMigrations()` function that:
  - Reads `schemaVersion` from AsyncStorage
  - If missing or <1: backs up current `savedCourses` to `savedCourses_v0_backup`, then migrates each course in `savedCourses` and `currentCourse` by adding `id` (UUID via `expo-crypto.randomUUID()`), `source: 'manual'`, `schemaVersion: 1`. Leave all GPS fields undefined.
  - Writes `schemaVersion = 1`
  - Idempotent — running twice does nothing.
- Update `utils/courseUtils.js`:
  - `addSavedCourse(course)` and `deleteSavedCourse(id)` use `id` instead of `name`.
  - Read functions unchanged in shape.
- Update `app/_layout.tsx` to call `runMigrations()` once on app launch, before any other AsyncStorage reads.
- Update `app/course-select.js` `keyExtractor` and delete handler to use `id`.
- Add a JSDoc types file at `utils/types.js` documenting the v1 Course/Hole shape (no TypeScript needed).

**Do NOT in Phase 1:** touch the strategy engine, write any Overpass code, change the hole screen, remove `course-entry.js`, change the Burns demo (it stays hardcoded as-is, but tag it `source: 'demo'` when it's loaded as the fallback).

**Verification:** install on device, confirm existing courses still load and play correctly.

### Phase 2: Overpass data layer (no UI yet)
**Goal:** Build a clean module that wraps Overpass behind a swappable interface. Pure logic, fully tested.

- Create `data/courseDataSource.js` exporting:
  - `discoverNearby(lat, lng, radiusM = 25000): Promise<CourseSummary[]>`
  - `ingest(osmRef): Promise<Course>` — returns a fully normalised Course matching the v1 schema
- Implement Overpass queries from §7.
- Implement the matcher and normaliser per §7 quality rules.
- Implement front/back/centre precomputation: project green polygon vertices onto the tee→green axis, take min/max along that axis as front/back.
- Cache discovery results in AsyncStorage: key = `discover:${roundedLat}:${roundedLng}`, TTL 24h.
- Save Belconnen JSON to `__tests__/fixtures/belconnen.json`.
- Write unit tests in `__tests__/courseDataSource.test.js` covering:
  - Belconnen ingests successfully with all 18 holes, refs 1–18, par 72
  - Practice features are filtered out
  - The "Practice Green" green is filtered out
  - Front/centre/back are computed in correct positions relative to line of play
  - A simulated course with missing refs is rejected by the quality bar

**Do NOT in Phase 2:** change any UI, hook anything up to the app yet. This phase ships zero user-visible changes.

**Verification:** all tests pass, Belconnen ingests correctly when called from a test harness.

### Phase 3: New course-select screen
**Goal:** Replace the existing course-select with the discovery-based flow. Manual entry disappears from the UI.

- Rewrite `app/course-select.js`:
  - Mount: load cached courses from `savedCourses` and render immediately.
  - In parallel, request location permission, run discovery, merge results.
  - Sort by distance.
  - Cached courses load instantly on tap. New courses run `ingest()` with a loading state.
  - Burns demo card at the bottom as a fallback.
- Remove the "Add Course" / "Manual Entry" link from the UI (don't delete `course-entry.js`).
- Handle permission denied gracefully (Burns demo only).
- Handle no nearby courses gracefully (Burns demo only, "no courses found near you" message).

**Verification:** install on device, walk through the discovery flow, ingest Belconnen for real, play a round.

### Phase 4: Live distance display on hole screen
**Goal:** Show the distance number live. Don't change the strategy engine yet.

- Add GPS subscription at the parent level of `app/hole.js`. Subscribe in `useEffect` keyed on whether any hole in the course has `green` data. Cleanup on unmount.
- `expo-location` config: `accuracy: Balanced`, `timeInterval: 5000`, `distanceInterval: 10`.
- Throttle UI updates to 1/second.
- Pass `userLocation` down to `renderItem` along with the current hole.
- In renderItem, compute and display "X m to centre / Y m to front / Z m to back" using Turf.
- If no green data on this hole → don't show the distance section, no errors.
- If GPS not yet fixed → show "waiting for GPS" or similar.

**Verification:** install on device, walk a real hole at Belconnen, confirm distance updates correctly and battery drain is acceptable over a 4-hour test.

### Phase 5: Dynamic recommendation (the live caddie)
**Goal:** The plan/recommendation split goes live.

- Create `utils/recommendNextShot.js` exporting `recommendNextShot(distanceToGreen, clubs, prefs): Recommendation`.
- The function returns ONE recommendation: club, swing %, brief reasoning. Pure function, no React.
- Handle edge cases: on green, very far, no green data.
- Update `app/hole.js`:
  - The "plan" section reads from the existing `calculateYourPar` output, set once at hole load, doesn't update.
  - The new "next shot" section is keyed on `userLocation` via `useMemo`, calls `recommendNextShot`, updates live.
  - When no GPS fix: fall back to the original `buildHoleStrategy` first-shot output for the recommendation section.
- The existing multi-shot strategy view stays for non-GPS courses. For GPS courses, it's replaced by the live recommendation.

**Verification:** play a real hole, walk to several different positions, confirm the recommendation updates appropriately.

### Phase 6: Hazard awareness (deferred)
Three-option recommendations (aggressive / balanced / conservative) when a hazard is between the user and the green. Logic outlined in conversation but not designed in detail here. Use `golf=bunker` and `golf=water_hazard` polygons, add to ingest. Detect when options collapse (too similar to be meaningfully different) and present fewer. Consider hazards within a band around the target, not just between user and green.

### Phase 7: Shot logging button (deferred)
"I hit my shot" button on the hole screen. Records GPS position + optional club. Reconciles against the score stepper at end of hole. Continuous GPS stays — the button is additive, not a replacement. Stroke counting and shot position log are the foundation for Phase 8.

### Phase 8: Personalised club distance learning (deferred)
Use accumulated shot logs from Phase 7 to compute the user's real club distances and dispersions over time. Suggest updates to their configured club distances. This is the killer feature that competitively differentiates from Shot Scope (no hardware required).

---

## 10. Migration details

### Why a migration system at all
The current app has no schema versioning. Existing v1 users (you and family) have courses in `savedCourses` keyed by name with no `id`, `source`, or version field. We need to upgrade their data without losing it.

### `runMigrations()` contract
- Called exactly once on app launch, before any other AsyncStorage reads
- Idempotent: safe to run multiple times, only acts when needed
- Atomic per migration: if a migration fails, the data should not be left half-updated (use try/catch and write the new version only after all transformations succeed)
- Logs progress to console for debugging
- Backs up pre-migration data once (only on the first v0→v1 run)

### v0 → v1 migration steps
1. Read `schemaVersion`. If present and ≥1, return immediately.
2. Read `savedCourses`. If absent, treat as empty array.
3. Write `savedCourses_v0_backup` with the original data.
4. For each course in `savedCourses`:
   - Add `id: randomUUID()`
   - Add `source: 'manual'`
   - Add `schemaVersion: 1`
   - Leave all GPS fields undefined (don't add them as null — undefined is fine and saves bytes)
5. Write the migrated `savedCourses` back.
6. Read `currentCourse`. If present, apply the same transformation and write back.
7. Write `schemaVersion: '1'`.

### Future migrations
Add new migration functions (`migrateV1ToV2`, etc.) and call them in order based on the current `schemaVersion` value. Never modify existing migration functions once shipped.

---

## 11. Testing strategy

### Phase 1
- Manual: install on a device with existing v0 data, confirm courses still load
- Manual: install on a clean device, confirm migration runs and writes `schemaVersion: 1`
- Manual: launch twice, confirm second launch is a no-op

### Phase 2
- Unit tests against `__tests__/fixtures/belconnen.json`
- Test cases listed in Phase 2 above
- Add fixtures from 1-2 other Canberra courses once verified to work

### Phase 3
- Manual: walk through discovery and ingest of a real course at Belconnen
- Manual: test permission-denied path
- Manual: test offline behaviour (cached course should load instantly with no network)

### Phase 4
- Manual: stand on a known location at a real course, confirm distance is accurate to within ~5m
- Manual: 4-hour battery drain test on a real round
- Manual: confirm subscription dies on screen unmount (use device dev tools to verify no background GPS)

### Phase 5
- Manual: walk a hole and verify the recommendation updates as expected
- Manual: stand on the green, confirm the putting message appears
- Manual: simulate no GPS fix (airplane mode briefly), confirm fallback to tee recommendation

---

## 12. Open questions and future work

These are explicitly NOT in scope for v1 but worth recording so they're not forgotten:

- **Per-hole stroke index override.** Users may want to correct the length-based approximation for their home course.
- **Per-hole length override.** Users may want to enter scorecard distances if the linestring is wildly wrong.
- **Tee selection.** Forward/regular/back tees as a setting per round.
- **Round history.** Persist completed rounds with scores and (eventually) shot positions.
- **Course corrections submitted back to OSM.** A "this hole is wrong" button that helps the user open an OSM editor. Long-term ecosystem play.
- **Driving range mode.** Use the shot logging from Phase 7 at a range to bootstrap club distances faster.
- **Multi-day cached courses.** Cache eviction policy if `savedCourses` gets large.
- **Swappable data source.** The `courseDataSource` interface is designed to allow plugging in a paid course API (e.g., for international coverage or higher quality data) without changing the rest of the app. Not in v1, but the abstraction is in place from Phase 2.

---

## 13. Glossary

- **Overpass / Overpass API:** The query API for OpenStreetMap data. Free, public, rate-limited by fair use. We use it for both discovery and ingest.
- **OSM:** OpenStreetMap. The underlying data source.
- **Way:** An OSM primitive — an ordered list of nodes, used for linestrings and closed polygons.
- **Relation:** An OSM primitive — a collection of ways/nodes/relations with roles. Used for multipolygons (courses with holes/cutouts).
- **Linestring:** A line made of connected points. `golf=hole` features are linestrings.
- **Polygon:** A closed area. `golf=green`, `golf=tee`, `golf=fairway` features are polygons.
- **Tier 1 matching:** Trust the `ref` tag for hole numbering. The only matching strategy implemented in v1.
- **Quality bar:** The criteria a course must meet to be considered GPS-enabled and shown in discovery (§7).
- **The plan:** The static "Your Par" framing for a hole, set once at hole start, never updates.
- **The recommendation:** The dynamic "next shot" advice, recomputes on every GPS update.
- **Front/centre/back of green:** The closest, middle, and farthest points of the green polygon as projected onto the line of play (tee → green centroid axis).
- **WIR:** Wedge In Regulation. The user preference for planning to leave a full wedge into the green.
- **Round Companion Mode:** The existing swipe-between-holes UI that lives on the hole screen. The GPS subscription must integrate cleanly with this.

---

## 14. Document maintenance

- **This doc is the source of truth.** If implementation diverges from the design, update the doc in the same commit and explain why in the commit message.
- **Don't modify shipped phases.** If a phase needs rework, add a new phase rather than retroactively editing an old one — that way the history of decisions is preserved.
- **When in doubt, refer to §2 (Core Principles).** Implementation details may change; principles should not without explicit discussion.
