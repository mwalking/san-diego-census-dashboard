function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function rssMoe(moes) {
  if (!Array.isArray(moes) || moes.length === 0) {
    return null;
  }

  let sumSquares = 0;
  let count = 0;

  for (const rawMoe of moes) {
    const moe = toFiniteNumber(rawMoe);
    if (moe === null) {
      continue;
    }
    sumSquares += moe * moe;
    count += 1;
  }

  if (count === 0) {
    return null;
  }

  return Math.sqrt(sumSquares);
}

export function moeRatio(X, MOE_X, Y, MOE_Y) {
  const numerator = toFiniteNumber(X);
  const numeratorMoe = toFiniteNumber(MOE_X);
  const denominator = toFiniteNumber(Y);
  const denominatorMoe = toFiniteNumber(MOE_Y);

  if (
    numerator === null ||
    numeratorMoe === null ||
    denominator === null ||
    denominatorMoe === null
  ) {
    return null;
  }
  if (denominator <= 0) {
    return null;
  }

  const ratio = numerator / denominator;
  const inside = numeratorMoe ** 2 + ratio ** 2 * denominatorMoe ** 2;
  if (inside < 0) {
    return null;
  }

  return (1 / denominator) * Math.sqrt(inside);
}

export function moeProportion(X, MOE_X, Y, MOE_Y) {
  const numerator = toFiniteNumber(X);
  const numeratorMoe = toFiniteNumber(MOE_X);
  const denominator = toFiniteNumber(Y);
  const denominatorMoe = toFiniteNumber(MOE_Y);

  if (
    numerator === null ||
    numeratorMoe === null ||
    denominator === null ||
    denominatorMoe === null
  ) {
    return null;
  }
  if (denominator <= 0) {
    return null;
  }

  const proportion = numerator / denominator;
  const inside = numeratorMoe ** 2 - proportion ** 2 * denominatorMoe ** 2;

  if (inside >= 0) {
    return (1 / denominator) * Math.sqrt(inside);
  }

  return moeRatio(numerator, numeratorMoe, denominator, denominatorMoe);
}
