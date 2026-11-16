import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLandmarks, PoseStabilizer } from '../src/pose.js';

function makePose({ hipY = .48, kneeY = .62, leftAnkleY = .92, rightAnkleY = .92, armsUp = false } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: .5, y: .5, visibility: 1 }));
  lm[11].y = lm[12].y = .3;
  lm[15].y = lm[16].y = armsUp ? .12 : .44;
  lm[23].y = lm[24].y = hipY;
  lm[25].y = lm[26].y = kneeY;
  lm[27].y = leftAnkleY;
  lm[28].y = rightAnkleY;
  return lm;
}

test('pose classification prioritizes seated over raised hands and feet', () => {
  assert.equal(classifyLandmarks(makePose({ hipY: .7, kneeY: .65, leftAnkleY: .9, rightAnkleY: .7, armsUp: true })), 0);
});

test('standing pose distinguishes 4, 1, and 2 represented feet', () => {
  assert.equal(classifyLandmarks(makePose({ armsUp: true })), 4);
  assert.equal(classifyLandmarks(makePose({ leftAnkleY: .75, rightAnkleY: .93 })), 1);
  assert.equal(classifyLandmarks(makePose()), 2);
});

test('missing key landmarks are not scored as a pose', () => {
  const lm = makePose(); lm[27].visibility = .1;
  assert.equal(classifyLandmarks(lm), null);
});

test('one raised hand is not mistaken for the two-leg pose', () => {
  const lm = makePose(); lm[15].y = .12;
  assert.equal(classifyLandmarks(lm), null);
});

test('stabilizer emits a pose only after the hold threshold and once per pose', () => {
  const tracker = new PoseStabilizer(400);
  assert.equal(tracker.update(2, 0), null);
  assert.equal(tracker.update(2, 399), null);
  assert.equal(tracker.update(2, 400), 2);
  assert.equal(tracker.update(2, 900), null);
  assert.equal(tracker.update(4, 920), null);
  assert.equal(tracker.update(4, 1320), 4);
});
