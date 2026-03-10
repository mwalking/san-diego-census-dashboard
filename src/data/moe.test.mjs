import test from 'node:test';
import assert from 'node:assert/strict';
import { moeProportion, moeRatio, rssMoe } from './moe.js';

function closeTo(actual, expected, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `Expected ${actual} to be close to ${expected}`,
  );
}

test('rssMoe computes root-sum-square', () => {
  const result = rssMoe([3, 4]);
  closeTo(result, 5);
});

test('rssMoe ignores null values and returns null when empty', () => {
  closeTo(rssMoe([null, 5]), 5);
  assert.equal(rssMoe([null, undefined]), null);
});

test('moeRatio computes ACS ratio MOE', () => {
  const result = moeRatio(50, 5, 100, 10);
  closeTo(result, 0.07071067811865475);
});

test('moeProportion computes ACS proportion MOE when discriminant is non-negative', () => {
  const result = moeProportion(50, 5, 100, 10);
  closeTo(result, 0);
});

test('moeProportion falls back to ratio formula when discriminant is negative', () => {
  const proportionResult = moeProportion(90, 2, 100, 5);
  const ratioResult = moeRatio(90, 2, 100, 5);
  closeTo(proportionResult, ratioResult);
});

test('ratio/proportion helpers guard invalid inputs', () => {
  assert.equal(moeRatio(null, 1, 10, 1), null);
  assert.equal(moeRatio(1, 1, 0, 1), null);
  assert.equal(moeProportion(1, 1, null, 1), null);
  assert.equal(moeProportion(1, 1, 0, 1), null);
});
