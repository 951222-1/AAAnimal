const MIN_VISIBILITY = 0.45;
function pointOk(lm, i) { return !!lm?.[i] && (lm[i].visibility ?? 1) >= MIN_VISIBILITY; }
function meanY(lm, a, b) { return (lm[a].y + lm[b].y) / 2; }

// MediaPipe normalized y grows downward. Return null when required joints are occluded.
export function classifyLandmarks(lm, { seatedMargin = 0.03, ankleGap = 0.07, handMargin = 0.025 } = {}) {
  const required = [11, 12, 15, 16, 23, 24, 25, 26, 27, 28];
  if (!required.every(i => pointOk(lm, i))) return null;
  const hipY = meanY(lm, 23, 24);
  const kneeY = meanY(lm, 25, 26);
  if (hipY >= kneeY - seatedMargin) return 0;
  const shoulderY = meanY(lm, 11, 12);
  if (lm[15].y < shoulderY - handMargin && lm[16].y < shoulderY - handMargin) return 4;
  if (Math.abs(lm[27].y - lm[28].y) >= ankleGap) return 1;
  if (lm[15].y >= shoulderY - handMargin && lm[16].y >= shoulderY - handMargin) return 2;
  return null;
}

export class PoseStabilizer {
  constructor(holdMs = 400) { this.holdMs = holdMs; this.candidate = null; this.since = 0; this.emitted = null; }
  reset() { this.candidate = null; this.since = 0; this.emitted = null; }
  update(value, timestamp) {
    if (value === null || value === undefined) { this.candidate = null; this.since = 0; this.emitted = null; return null; }
    if (value !== this.candidate) { this.candidate = value; this.since = timestamp; return null; }
    if (timestamp - this.since < this.holdMs || this.emitted === value) return null;
    this.emitted = value;
    return value;
  }
}
