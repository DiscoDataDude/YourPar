// utils/strategy.js
export function calculateYourPar(course, targetScore) {
  const coursePar = course.holes.reduce((sum, h) => sum + h.par, 0);
  const extra = targetScore - coursePar;
  const numHoles = course.holes.length;

  const baseAdd = Math.floor(extra / numHoles);
  const remainder = extra % numHoles;

  // sort by difficulty (index ascending)
  const sorted = [...course.holes].sort((a, b) => a.index - b.index);

  const calc = sorted.map((hole, i) => {
    let added = baseAdd;
    if (i < remainder) added += 1;

    const yourPar = hole.par + added;
    const yourGIR = yourPar - 2;
    const avgShot = Math.round(hole.length / yourGIR / 10) * 10;

    return {
      ...hole,
      yourPar,
      yourGIR,
      avgShot,
    };
  });

  // back to hole order
  return calc.sort((a, b) => a.hole - b.hole);
}
