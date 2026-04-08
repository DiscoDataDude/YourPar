/**
 * utils/recommendNextShot.js
 *
 * Pure function — given the player's current distance to the green centre,
 * their clubs, and their preferences, return ONE next-shot recommendation.
 *
 * This is separate from buildHoleStrategy, which plans the full path from the
 * tee. recommendNextShot answers "what do I do RIGHT NOW from where I'm
 * standing?" and recomputes on every GPS tick.
 *
 * Return shape:
 *   { type: 'putt' }                                         — on or near green
 *   { type: 'far' }                                          — >500m, probably wrong hole
 *   { type: 'go', club, distance, pct, partial }             — hit toward green
 *   { type: 'layup', club, distance, pct, partial,
 *                    leave, wedge }                          — WIR layup
 *   null                                                     — no clubs configured
 */

const ON_GREEN_M = 5;
const TOO_FAR_M = 500;
const NEAR_ENOUGH_M = 5;   // within 5 m of club distance counts as "reaches"
const MIN_PARTIAL_PCT = 60;
const FULL_SWING_THRESHOLD = 95; // ≥ 95% → report as full swing

function getValidClubs(clubs) {
  // Exclude Driver — live recommendations are for fairway/approach shots.
  // Driver is covered by the static plan's first-shot fallback on the tee.
  return clubs
    .filter((c) => c.name !== 'Driver' && typeof c.distance === 'number' && c.distance > 0)
    .sort((a, b) => a.distance - b.distance);
}

function buildGoResult(club, distanceToGreen) {
  if (club.distance < distanceToGreen) {
    // Full swing, lands within NEAR_ENOUGH_M of the flag
    return { type: 'go', club: club.name, distance: club.distance, pct: null, partial: false };
  }
  const rawPct = (distanceToGreen / club.distance) * 100;
  const pct = Math.round(rawPct / 10) * 10;
  if (pct >= FULL_SWING_THRESHOLD) {
    return { type: 'go', club: club.name, distance: club.distance, pct: null, partial: false };
  }
  return { type: 'go', club: club.name, distance: club.distance, pct, partial: true };
}

export function recommendNextShot(distanceToGreen, clubs, prefs = {}) {
  // ── Edge cases ────────────────────────────────────────────────────────────────
  if (distanceToGreen <= ON_GREEN_M) return { type: 'putt' };
  if (distanceToGreen > TOO_FAR_M) return { type: 'far' };

  const { favouriteClub, favouriteWedge, useWedgeRegulation } = prefs;
  const validClubs = getValidClubs(clubs);
  if (validClubs.length === 0) return null;

  const favourite = favouriteClub
    ? validClubs.find((c) => c.name === favouriteClub)
    : null;

  // ── Can we reach the green? ───────────────────────────────────────────────────
  // "Reaches" = full-swing distance is within NEAR_ENOUGH_M of or beyond the flag
  const canReach = validClubs.filter((c) => c.distance >= distanceToGreen - NEAR_ENOUGH_M);

  if (canReach.length > 0) {
    // Try the favourite first — but only commit to it if it doesn't require
    // a partial swing when a full-swing alternative exists.
    if (favourite && favourite.distance >= distanceToGreen - NEAR_ENOUGH_M) {
      const favResult = buildGoResult(favourite, distanceToGreen);
      if (!favResult.partial) return favResult;

      // Favourite needs a partial — prefer a shorter club at full swing if one exists
      const fullSwingAlts = canReach.filter((c) => !buildGoResult(c, distanceToGreen).partial);
      if (fullSwingAlts.length > 0) {
        // Use the shortest full-swing club (minimises overshoot)
        return buildGoResult(fullSwingAlts[0], distanceToGreen);
      }

      // No full-swing alternative — use the favourite partial if swing % is acceptable
      if (favResult.pct >= MIN_PARTIAL_PCT) return favResult;
    }

    // No usable favourite — use the shortest club that reaches
    return buildGoResult(canReach[0], distanceToGreen);
  }

  // ── Can't reach in one shot ───────────────────────────────────────────────────

  // WIR layup: hit a club that leaves a full favourite-wedge into the green
  if (useWedgeRegulation && favouriteWedge) {
    const wedge = validClubs.find((c) => c.name === favouriteWedge);
    if (wedge && distanceToGreen > wedge.distance * 1.5) {
      const targetLayup = distanceToGreen - wedge.distance;
      // Pick the club whose distance is closest to targetLayup without going over
      const layupClub = validClubs.reduce((best, c) => {
        if (c.distance > targetLayup + 15) return best; // don't overshoot the layup point
        if (!best) return c;
        return Math.abs(c.distance - targetLayup) < Math.abs(best.distance - targetLayup)
          ? c
          : best;
      }, null);

      if (layupClub) {
        const leave = distanceToGreen - layupClub.distance;
        // Only use this layup if it actually leaves a sensible wedge distance
        if (leave >= wedge.distance * 0.75 && leave <= wedge.distance * 1.3) {
          return {
            type: 'layup',
            club: layupClub.name,
            distance: layupClub.distance,
            pct: null,
            partial: false,
            leave: Math.round(leave),
            wedge: wedge.name,
          };
        }
      }
    }
  }

  // Advance: hit the longest available club (or favourite if it's nearly as long)
  const longest = validClubs[validClubs.length - 1];
  const advanceWith =
    favourite && favourite.distance >= longest.distance * 0.8 ? favourite : longest;
  return {
    type: 'go',
    club: advanceWith.name,
    distance: advanceWith.distance,
    pct: null,
    partial: false,
  };
}
