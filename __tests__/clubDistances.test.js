import {
  normaliseClubDistances,
  distancesToClubsArray,
} from '../utils/clubDistances';

describe('clubDistances normalisation', () => {
  test('handles null/invalid input safely', () => {
    expect(normaliseClubDistances(null)).toEqual({
      distances: {},
      favouriteClub: null,
      favouriteWedge: null,
      useWedgeRegulation: true,
    });
  });

  test('keeps canonical shape unchanged', () => {
    const input = {
      distances: { '7i': 150, PW: 110 },
      favouriteClub: '7i',
      favouriteWedge: 'PW',
      useWedgeRegulation: false,
    };

    expect(normaliseClubDistances(input)).toEqual(input);
  });

  test('migrates legacy flat shape into canonical shape', () => {
    const legacy = {
      Driver: 210,
      '7i': 150,
      favouriteClub: '7i',
      useWedgeRegulation: true,
    };

    expect(normaliseClubDistances(legacy)).toEqual({
      distances: { Driver: 210, '7i': 150 },
      favouriteClub: '7i',
      favouriteWedge: null,
      useWedgeRegulation: true,
    });
  });

  test('distancesToClubsArray filters invalid entries', () => {
    const distances = { '7i': '150', PW: 0, Bad: 'nope' };
    expect(distancesToClubsArray(distances)).toEqual([
      { name: '7i', distance: 150 },
    ]);
  });
});
