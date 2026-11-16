export const MODES = {
  training: { title: '自在訓練', total: 0, perQuestion: 0, pool: [0, 1, 2, 4], players: 1 },
  simple: { title: '簡單挑戰', total: 40, perQuestion: 8, pool: [0, 2, 4], players: 1 },
  normal: { title: '一般挑戰', total: 30, perQuestion: 5, pool: [0, 1, 2, 4], players: 1 },
  hard: { title: '困難挑戰', total: 30, perQuestion: 5, pool: [0, 1, 2, 4], players: 1, math: true },
  duel: { title: '雙人搶快 PK', total: 0, perQuestion: 5, pool: [0, 1, 2, 4], players: 2, duel: true },
  coop: { title: '雙人合作湊腳數', total: 45, perQuestion: 6, pool: [0, 2, 4, 6, 8], players: 2, coop: true }
};
export const POSE_NAMES = { 0: '坐好', 1: '單腳站', 2: '雙腳站', 4: '雙手舉高' };
export const POSE_EMOJI = { 0: '🪑', 1: '🦩', 2: '🐧', 4: '🙌' };
export const ANIMALS = { 0: ['🐟', '🐍', '🪱'], 1: ['🦩', '🪽'], 2: ['🐔', '🦆', '🐧'], 4: ['🐕', '🐈', '🐘'], 6: ['🐜', '🐝'], 8: ['🐙', '🕷️'] };
export function getQuestionPool(mode) { return [...(MODES[mode]?.pool ?? MODES.training.pool)]; }
export function nextTarget(previous, pool, random = Math.random) {
  const choices = pool.filter(n => n !== previous);
  if (!choices.length) return pool[0] ?? 0;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}
export function classifyPose({ seated, leftAnkle, rightAnkle, leftHandUp, rightHandUp, ankleGap = 0.12 }) {
  if (seated) return 0;
  if (leftHandUp && rightHandUp) return 4;
  if (Math.abs(leftAnkle - rightAnkle) >= ankleGap) return 1;
  return 2;
}
export function calculateCoopTotal(left, right) { return (left ?? 0) + (right ?? 0); }
export function makeMathQuestion(random = Math.random) {
  const pairs = [[0, 0], [0, 1], [1, 1], [2, 2], [4, 0]];
  const [a, b] = pairs[Math.floor(random() * pairs.length)];
  return { a, b, answer: a + b, text: `${a} 隻腳的動物 + ${b} 隻腳的動物 = ?` };
}
