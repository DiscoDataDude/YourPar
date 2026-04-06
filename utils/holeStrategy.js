import { convertDistance, getUnitLabel } from './distanceUnits';

const SWEET_MIN = 80;
const SWEET_MAX = 110;
const SWEET_TARGET = 95;
const AWKWARD_MIN = 30;
const AWKWARD_MAX = 60;
const LONG_CLUB_MIN = 130; // clubs >= this distance count as long clubs
const MIN_LONG_PARTIAL = 60; // minimum % allowed for long-club partials

function getValidClubs(clubs) {
  return clubs
    .filter((c) => typeof c.distance === 'number' && c.distance > 0)
    .sort((a, b) => a.distance - b.distance);
}

function chooseBaseClub(
  remaining,
  yourGIR,
  shotNumber,
  clubs,
  favouriteName,
  useWedgeRegulation,
) {
  const validClubs = getValidClubs(clubs);
  if (validClubs.length === 0) return null;

  const favourite = favouriteName
    ? validClubs.find((c) => c.name === favouriteName)
    : null;

  const shotsLeft = Math.max(yourGIR - shotNumber + 1, 1);
  const canReachInGIR = validClubs.filter(
    (c) => c.distance * shotsLeft >= remaining,
  );

  // IMPORTANT FIX:
  // The "leave a sweet number (80-110m)" logic is effectively Wedge-In-Regulation behaviour.
  // If WIR is OFF, do NOT manufacture sweet-spot layups (this causes SW -> PW sequencing).
  if (useWedgeRegulation && shotsLeft > 1 && favourite) {
    const favLeave = remaining - favourite.distance;

    if (favLeave > AWKWARD_MIN && favLeave < AWKWARD_MAX) {
      const layCandidates = validClubs
        .map((c) => ({ ...c, leave: remaining - c.distance }))
        .filter((c) => c.leave >= SWEET_MIN && c.leave <= SWEET_MAX);

      if (layCandidates.length > 0) {
        return layCandidates.reduce((best, c) =>
          Math.abs(c.leave - SWEET_TARGET) < Math.abs(best.leave - SWEET_TARGET)
            ? c
            : best,
        );
      }
    }
  }

  if (
    favourite &&
    favourite.distance < remaining &&
    favourite.distance * shotsLeft >= remaining
  ) {
    return favourite;
  }

  if (favourite && favourite.distance * shotsLeft < remaining) {
    const longer = canReachInGIR.filter((c) => c.distance > favourite.distance);
    if (longer.length > 0) return longer[0];
    return validClubs[validClubs.length - 1];
  }

  const pool = favourite
    ? validClubs
    : canReachInGIR.length > 0
      ? canReachInGIR
      : validClubs;

  const notShorter = pool
    .filter((c) => c.distance >= remaining)
    .sort((a, b) => a.distance - b.distance);

  if (notShorter.length > 0) return notShorter[0];

  return pool[pool.length - 1];
}

function planPath(targetDistance, yourGIR, clubs, favouriteName, useWedgeRegulation) {
  const path = [];
  let remaining = targetDistance;
  let shotNumber = 1;
  const validClubs = getValidClubs(clubs);

  const maxShots = yourGIR + 5;

  while (remaining > 0 && shotNumber <= maxShots) {
    // Driver is only allowed on the tee shot (shot 1)
    const availableClubs =
      shotNumber === 1
        ? validClubs
        : validClubs.filter((c) => c.name !== 'Driver');

    const club = chooseBaseClub(
      remaining,
      yourGIR,
      shotNumber,
      availableClubs,
      favouriteName,
      useWedgeRegulation,
    );
    if (!club) break;

    let partial = false;
    let pct = null;
    let effective = club.distance;

    if (club.distance > remaining) {
      const rawPct = (remaining / club.distance) * 100;
      pct = Math.round(rawPct / 10) * 10;
      if (club.distance >= LONG_CLUB_MIN && pct < MIN_LONG_PARTIAL) {
        return { path: [], remaining: targetDistance };
      }
      partial = true;
      effective = remaining;
    }

    path.push({ ...club, partial, pct, effective });
    remaining -= effective;
    shotNumber += 1;
  }

  return { path, remaining };
}

function girIsRealistic(path, remaining, yourGIR) {
  if (!path || path.length === 0) return false;
  if (path.length > yourGIR) return false;
  if (remaining > 5) return false;

  for (const shot of path) {
    if (
      shot.distance >= LONG_CLUB_MIN &&
      shot.partial &&
      shot.pct < MIN_LONG_PARTIAL
    ) {
      return false;
    }
    if (shot.effective < 0.3 * Math.min(...path.map((s) => s.distance))) {
      return false;
    }
  }

  return true;
}

function buildDescription(
  path,
  holeLength,
  yourGIR,
  units = 'meters',
  finalLabelOverride = null,
) {
  const shotsToGreen = path.length;
  const delta = yourGIR - shotsToGreen;
  let description = '';

  let distLeft = holeLength;
  const unitLabel = getUnitLabel(units);

  path.forEach((shot, idx) => {
    const num = idx + 1;
    const used = Math.round(convertDistance(shot.effective, units));
    const next = Math.round(
      convertDistance(Math.max(0, distLeft - shot.effective), units),
    );
    const clubDist = Math.round(convertDistance(shot.distance, units));

    const isFinal = idx === path.length - 1;
    const finalLabel = finalLabelOverride || 'to get it on the green';

    if (shot.partial) {
      description += isFinal
        ? `• Shot ${num}: Hit a ${shot.pct}% ${shot.name} (~${used}${unitLabel}) ${finalLabel}\n`
        : `• Shot ${num}: Hit a ${shot.pct}% ${shot.name} (~${used}${unitLabel}), leaving ${next}${unitLabel}\n`;
    } else if (num === 1) {
      description += isFinal
        ? `• Shot 1: Hit ${shot.name} off the tee (${clubDist}${unitLabel}) ${finalLabel}\n`
        : `• Shot 1: Hit ${shot.name} off the tee (${clubDist}${unitLabel}), leaving ${next}${unitLabel}\n`;
    } else {
      description += isFinal
        ? `• Shot ${num}: Hit ${shot.name} (${clubDist}${unitLabel}) ${finalLabel}\n`
        : `• Shot ${num}: Hit ${shot.name} (${clubDist}${unitLabel}), leaving ${next}${unitLabel}\n`;
    }

    distLeft -= shot.effective;
  });

  if (delta > 0) {
    description += `\nYou reach the green in ${shotsToGreen} shots, ${delta} under your GIR.\nTake your medicine if you find trouble — you've got buffer.`;
  } else if (delta === 0) {
    description += `\nYou reach the green in ${shotsToGreen} shots, right on your GIR.\n`;
  } else {
    description += `\nYou reach the green in ${shotsToGreen} shots, ${Math.abs(delta)} over your GIR.\nPlay steady and avoid compounding errors.`;
  }

  return description;
}

export function buildHoleStrategy(
  holeLength,
  yourGIR,
  clubs,
  favouriteClub,
  favouriteWedge,
  useWedgeRegulation,
  units = 'meters',
) {
  const validClubs = getValidClubs(clubs);
  if (validClubs.length === 0) return null;

  const gir = planPath(holeLength, yourGIR, clubs, favouriteClub, useWedgeRegulation);
  const girRealistic = girIsRealistic(gir.path, gir.remaining, yourGIR);

  if (girRealistic || !useWedgeRegulation) {
    const description = buildDescription(gir.path, holeLength, yourGIR, units);
    return {
      path: gir.path,
      shotsToGreen: gir.path.length,
      delta: yourGIR - gir.path.length,
      description,
    };
  }

  const wedgeNames = ['LW', 'SW', 'GW', 'PW'];
  const clubMap = {};
  clubs.forEach((c) => {
    clubMap[c.name] = c;
  });

  const favWedgeClub = favouriteWedge ? clubMap[favouriteWedge] : null;

  const allWedges = validClubs.filter(
    (c) => wedgeNames.includes(c.name) || c.distance <= 140,
  );

  const wedgeCandidates = [];
  if (favWedgeClub) wedgeCandidates.push(favWedgeClub);
  allWedges.forEach((c) => {
    if (!wedgeCandidates.find((w) => w.name === c.name))
      wedgeCandidates.push(c);
  });

  for (const wedge of wedgeCandidates) {
    const wedgeDist = wedge.distance;
    if (wedgeDist >= holeLength) continue;

    const targetLength = holeLength - wedgeDist;
    const wirGIR = Math.max(yourGIR - 1, 1);

    const attempt = planPath(targetLength, wirGIR, clubs, favouriteClub, true);
    const progress = (targetLength - attempt.remaining) / targetLength;

    if (progress >= 0.8) {
      const finalShot = {
        name: wedge.name,
        distance: wedgeDist,
        effective: wedgeDist,
        partial: false,
        pct: null,
      };

      const fullPath = [...attempt.path, finalShot];
      const wedgeDistDisplay = Math.round(convertDistance(wedgeDist, units));
      const unitLabel = getUnitLabel(units);
      const description =
        `This hole is planned to leave you a full ${wedge.name} (${wedgeDistDisplay}${unitLabel}) into the green.\n\n` +
        buildDescription(
          fullPath,
          holeLength,
          yourGIR,
          units,
          'to get it on the green with your wedge',
        );

      return {
        path: fullPath,
        shotsToGreen: fullPath.length,
        delta: yourGIR - fullPath.length,
        description,
      };
    }
  }

  const description = buildDescription(gir.path, holeLength, yourGIR, units);
  return {
    path: gir.path,
    shotsToGreen: gir.path.length,
    delta: yourGIR - gir.path.length,
    description,
  };
}
