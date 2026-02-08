const DEFAULT_SHAPE = {
  distances: {},
  favouriteClub: null,
  favouriteWedge: null,
  useWedgeRegulation: true,
};

export function normaliseClubDistances(stored) {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_SHAPE };

  // Canonical shape
  if (stored.distances && typeof stored.distances === 'object') {
    return {
      distances: stored.distances,
      favouriteClub: stored.favouriteClub || stored.favoriteClub || null,
      favouriteWedge: stored.favouriteWedge || stored.favoriteWedge || null,
      useWedgeRegulation:
        typeof stored.useWedgeRegulation === 'boolean'
          ? stored.useWedgeRegulation
          : true,
    };
  }

  // Legacy “flat” format: { "7i": 150, ... } plus optional favourites
  const {
    favouriteClub,
    favoriteClub,
    favouriteWedge,
    favoriteWedge,
    useWedgeRegulation,
    ...rest
  } = stored;

  return {
    distances: rest,
    favouriteClub: favouriteClub || favoriteClub || null,
    favouriteWedge: favouriteWedge || favoriteWedge || null,
    useWedgeRegulation:
      typeof useWedgeRegulation === 'boolean' ? useWedgeRegulation : true,
  };
}

export function distancesToClubsArray(distances) {
  if (!distances || typeof distances !== 'object') return [];

  return Object.entries(distances)
    .map(([name, val]) => ({ name, distance: Number(val) }))
    .filter((c) => !Number.isNaN(c.distance) && c.distance > 0);
}
