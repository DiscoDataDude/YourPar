import { buildHoleStrategy } from '../utils/holeStrategy';

describe('buildHoleStrategy', () => {
  const clubs = [
    { name: 'Driver', distance: 210 },
    { name: '3W', distance: 190 },
    { name: '5W', distance: 175 },
    { name: '7i', distance: 150 },
    { name: '8i', distance: 140 },
    { name: '9i', distance: 130 },
    { name: 'PW', distance: 110 },
    { name: 'GW', distance: 95 },
    { name: 'SW', distance: 80 },
    { name: 'LW', distance: 60 },
  ];

  test('returns a stable GIR-first plan when GIR is realistic', () => {
    const holeLength = 300;
    const yourGIR = 3;

    const res = buildHoleStrategy(
      holeLength,
      yourGIR,
      clubs,
      '7i', // favourite club
      'GW', // favourite wedge
      true, // useWedgeRegulation
    );

    expect(res).not.toBeNull();
    expect(res.shotsToGreen).toBeLessThanOrEqual(yourGIR);
    expect(res.path.length).toBe(res.shotsToGreen);

    // Tripwire assertions (not too brittle)
    expect(res.path[0].name).toBe('7i');
    expect(res.path.every((s) => typeof s.effective === 'number')).toBe(true);
    expect(res.delta).toBe(yourGIR - res.shotsToGreen);
  });

  test('prefers a full-swing shorter club over a partial when within 5m of the hole', () => {
    // Hole 1 Belconnen-style: par-5, yourGIR=3, planner ends up with ~141m
    // remaining on shot 3. 9i(130m here) is 11m short so won't trigger, but
    // if user's 9i were 140m it would. Use 8i(140m) as the "close" club:
    // remaining after 5W(175)+7i(150) = 461-175-150 = 136m.
    // 8i(140m) is 4m over remaining → in notShorter, returned as near-full swing.
    // Verify it is NOT a large partial by checking pct >= 90 or club is not partial.
    const res = buildHoleStrategy(
      461, // par-5 hole length
      3,   // yourGIR (scratch/low-target scenario)
      clubs,
      '7i',
      'GW',
      false, // WIR off for simplicity
    );
    expect(res).not.toBeNull();
    expect(res.path.length).toBeGreaterThan(0);
    const lastShot = res.path[res.path.length - 1];
    // The last shot must not be a large partial — either full swing or ≥90%
    if (lastShot.partial) {
      expect(lastShot.pct).toBeGreaterThanOrEqual(90);
    }
  });

  test('does not allow silly long-club partials under 60%', () => {
    const holeLength = 50;
    const yourGIR = 1;

    const res = buildHoleStrategy(
      holeLength,
      yourGIR,
      clubs,
      'Driver',
      null,
      false,
    );

    // With these rules, the engine should avoid “25% Driver” nonsense
    // and choose something smaller (LW/SW/etc), or at least not a long partial.
    expect(res).not.toBeNull();

    const first = res.path[0];
    if (first.distance >= 130 && first.partial) {
      expect(first.pct).toBeGreaterThanOrEqual(60);
    }
  });
});
