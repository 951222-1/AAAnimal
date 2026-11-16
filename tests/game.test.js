import test from 'node:test';
import assert from 'node:assert/strict';
import { nextTarget, getQuestionPool, classifyPose, calculateCoopTotal, makeMathQuestion } from '../src/game.js';

test('solo target never repeats the previous foot count', () => {
  for (const previous of [0, 1, 2, 4]) {
    for (let i = 0; i < 100; i++) assert.notEqual(nextTarget(previous, [0, 1, 2, 4], () => 0.25), previous);
  }
});

test('simple mode only draws 0, 2, or 4', () => {
  assert.deepEqual(getQuestionPool('simple'), [0, 2, 4]);
});

test('simulated pose follows seated-first and arm-up rules', () => {
  assert.equal(classifyPose({ seated: true, leftAnkle: 0, rightAnkle: 1, leftHandUp: true, rightHandUp: true }), 0);
  assert.equal(classifyPose({ seated: false, leftAnkle: 0, rightAnkle: 1, leftHandUp: true, rightHandUp: true }), 4);
  assert.equal(classifyPose({ seated: false, leftAnkle: 0, rightAnkle: 1, leftHandUp: false, rightHandUp: false }), 1);
  assert.equal(classifyPose({ seated: false, leftAnkle: 1, rightAnkle: 1, leftHandUp: false, rightHandUp: false }), 2);
});

test('hard-mode arithmetic results always map to a playable pose', () => {
  const valid = new Set([0, 1, 2, 4]);
  for (let i = 0; i < 100; i++) assert.ok(valid.has(makeMathQuestion(() => i / 100).answer));
});

test('co-op combines each player state to a maximum of eight', () => {
  assert.equal(calculateCoopTotal(2, 4), 6);
  assert.equal(calculateCoopTotal(4, 4), 8);
});
