import { recommendNextShot } from '../utils/recommendNextShot';

const clubs = [
  { name: '5W',  distance: 175 },
  { name: '7i',  distance: 150 },
  { name: '8i',  distance: 140 },
  { name: '9i',  distance: 130 },
  { name: 'PW',  distance: 110 },
  { name: 'GW',  distance: 95  },
  { name: 'SW',  distance: 80  },
];

const prefs = { favouriteClub: '7i', favouriteWedge: 'GW', useWedgeRegulation: true };

describe('recommendNextShot', () => {
  test('returns putt when within 5m of green', () => {
    expect(recommendNextShot(3, clubs, prefs)).toEqual({ type: 'putt' });
    expect(recommendNextShot(0, clubs, prefs)).toEqual({ type: 'putt' });
  });

  test('returns far when over 500m', () => {
    expect(recommendNextShot(501, clubs, prefs)).toEqual({ type: 'far' });
  });

  test('recommends full swing favourite club when it reaches', () => {
    const rec = recommendNextShot(145, clubs, prefs);
    expect(rec.type).toBe('go');
    expect(rec.club).toBe('7i');
    expect(rec.partial).toBe(false);
  });

  test('prefers full-swing shorter club over partial favourite', () => {
    // 128m — 7i(150m) would be 90% partial, 9i(130m) reaches at ~full swing
    // Should prefer 9i over 7i@90%
    const rec = recommendNextShot(128, clubs, prefs);
    expect(rec.type).toBe('go');
    expect(rec.club).toBe('9i');
    expect(rec.partial).toBe(false);
  });

  test('recommends layup when WIR on and cannot reach in one', () => {
    // 250m — no club reaches; with GW(95m) as wedge, should lay up to ~155m
    const rec = recommendNextShot(250, clubs, prefs);
    expect(rec.type).toBe('layup');
    expect(rec.wedge).toBe('GW');
    expect(rec.leave).toBeGreaterThan(70);
    expect(rec.leave).toBeLessThan(130);
  });

  test('advances with longest club when WIR off and cannot reach', () => {
    const noWIR = { ...prefs, useWedgeRegulation: false };
    const rec = recommendNextShot(300, clubs, noWIR);
    expect(rec.type).toBe('go');
    // Should advance with 5W or favourite (7i >= 80% of 5W)
    expect(['5W', '7i']).toContain(rec.club);
    expect(rec.partial).toBe(false);
  });

  test('returns null when no clubs configured', () => {
    expect(recommendNextShot(150, [], prefs)).toBeNull();
  });

  test('never recommends Driver', () => {
    const withDriver = [{ name: 'Driver', distance: 220 }, ...clubs];
    const rec = recommendNextShot(200, withDriver, prefs);
    expect(rec?.club).not.toBe('Driver');
  });
});
