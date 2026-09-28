import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, smoothstep, damp, angleDiff, mulberry32, hash2, makeNoise2D } from '../src/core/math.js';

test('clamp, lerp and smoothstep', () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(lerp(2, 4, 0.5), 3);
  assert.equal(smoothstep(0, 1, -1), 0);
  assert.equal(smoothstep(0, 1, 2), 1);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
});

test('damp converges and is frame-rate independent', () => {
  let a = 0, b = 0;
  for (let i = 0; i < 60; i++) a = damp(a, 10, 3, 1 / 60);
  for (let i = 0; i < 30; i++) b = damp(b, 10, 3, 1 / 30);
  assert.ok(Math.abs(a - b) < 1e-9);
  assert.ok(a > 9 && a < 10);
});

test('angleDiff wraps to the shortest turn', () => {
  assert.ok(Math.abs(angleDiff(0, Math.PI * 1.5) + Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(angleDiff(Math.PI * 1.9, Math.PI * 0.1) - Math.PI * 0.2) < 1e-9);
  assert.equal(angleDiff(1, 1), 0);
});

test('mulberry32 is deterministic and in [0, 1)', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('hash2 and simplex noise stay in range', () => {
  const noise = makeNoise2D(3);
  for (let i = 0; i < 500; i++) {
    const x = i * 1.37 - 300, z = i * 0.71 + 11;
    const h = hash2(x, z);
    assert.ok(h >= 0 && h < 1);
    const n = noise(x * 0.05, z * 0.05);
    assert.ok(n >= -1.001 && n <= 1.001);
  }
  assert.equal(makeNoise2D(9)(1.5, 2.5), makeNoise2D(9)(1.5, 2.5));
});
