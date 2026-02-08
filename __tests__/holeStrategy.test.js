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
    const myGIR = 3;

    const res = buildHoleStrategy(
      holeLength,
      myGIR,
      clubs,
      '7i', // favourite club
      'GW', // favourite wedge
      true, // useWedgeRegulation
    );

    expect(res).not.toBeNull();
    expect(res.shotsToGreen).toBeLessThanOrEqual(myGIR);
    expect(res.path.length).toBe(res.shotsToGreen);

    // Tripwire assertions (not too brittle)
    expect(res.path[0].name).toBe('7i');
    expect(res.path.every((s) => typeof s.effective === 'number')).toBe(true);
    expect(res.delta).toBe(myGIR - res.shotsToGreen);
  });

  test('does not allow silly long-club partials under 60%', () => {
    const holeLength = 50;
    const myGIR = 1;

    const res = buildHoleStrategy(
      holeLength,
      myGIR,
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
