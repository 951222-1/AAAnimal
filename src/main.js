import './style.css';
import { MODES, POSE_NAMES, POSE_EMOJI, ANIMALS, nextTarget, makeMathQuestion, calculateCoopTotal } from './game.js';
import { classifyLandmarks, PoseStabilizer } from './pose.js';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

const root = document.querySelector('#app');
let state = { screen: 'home', mode: 'training', score: 0, done: 0, target: 0, previous: null, left: 0, right: 0, correct: false, remaining: 0, questionLeft: 0, bestBalance: 0, standUps: 0, lastPose: 0, startedAt: 0, answer: null, questionCount: 0, timer: null, feedback: '', stream: null, poseLandmarker: null, cameraActive: false, cameraLoading: false, cameraError: '', simulation: false, stabilizers: [new PoseStabilizer(400), new PoseStabilizer(400)], coopStabilizer: new PoseStabilizer(500), lastVideoTime: -1, balanceSince: null, coopSeen: [false, false] };
const choices = [0, 1, 2, 4];
function chooseMode(mode) { state = { ...state, screen: 'rules', mode, score: 0, done: 0, previous: null, left: 0, right: 0, correct: false, bestBalance: 0, standUps: 0, questionCount: 0 }; render(); }
function startGame() {
  clearInterval(state.timer); state.screen = 'play'; state.startedAt = Date.now(); state.remaining = MODES[state.mode].total; state.questionLeft = MODES[state.mode].perQuestion; state.feedback = ''; state.simulation = false; state.stabilizers.forEach(s => s.reset()); state.coopStabilizer.reset(); nextQuestion(true); state.timer = setInterval(tick, 100); render();
}
async function enableCamera() {
  if (state.cameraLoading || state.cameraActive) return;
  state.cameraLoading = true; state.cameraError = '正在啟動鏡頭…'; render();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('此瀏覽器無法使用鏡頭，請用 localhost 或 HTTPS 開啟。');
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    state.cameraActive = true; state.cameraError = '正在載入姿勢辨識模型…'; render();
    const vision = await FilesetResolver.forVisionTasks(`${import.meta.env.BASE_URL}wasm`);
    state.poseLandmarker = await PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task`, delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 2, minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
    state.cameraLoading = false; state.cameraError = ''; render(); detectLoop();
  } catch (error) {
    state.cameraLoading = false; state.cameraError = error?.name === 'NotAllowedError' ? '鏡頭權限未開啟。可允許鏡頭，或改用下方按鈕試玩。' : `鏡頭啟動失敗：${error.message || error}`; render();
  }
}
function attachCameraVideo() {
  const video = root.querySelector('#camera-video');
  if (video && state.stream && video.srcObject !== state.stream) { video.srcObject = state.stream; video.play().catch(() => {}); }
}
function detectLoop() {
  if (state.screen !== 'play' || !state.cameraActive || !state.poseLandmarker) return;
  const video = root.querySelector('#camera-video');
  if (video?.readyState >= 2 && video.currentTime !== state.lastVideoTime) {
    state.lastVideoTime = video.currentTime;
    const result = state.poseLandmarker.detectForVideo(video, performance.now());
    const poses = (result.landmarks || []).map(lm => ({ lm, center: (lm[23]?.x + lm[24]?.x) / 2 })).sort((a,b) => a.center - b.center);
    if (poses.length) {
      const classes = poses.slice(0, 2).map(({lm}) => classifyLandmarks(lm));
      const now = performance.now();
      if (classes.includes(1)) { state.balanceSince ??= now; state.bestBalance = Math.max(state.bestBalance, (now - state.balanceSince) / 1000); } else state.balanceSince = null;
      const left = state.stabilizers[0].update(classes[0] ?? null, now);
      const right = state.stabilizers[1].update(classes[1] ?? null, now);
      if (state.mode === 'coop' && poses.length >= 2 && classes[0] !== null && classes[1] !== null) {
        const sum = calculateCoopTotal(classes[0], classes[1]);
        const stable = state.coopStabilizer.update(sum, performance.now());
        const badge = root.querySelector('#pose-status'); if (badge) badge.textContent = `左：${POSE_NAMES[classes[0]]}　右：${POSE_NAMES[classes[1]]}　合計 ${sum}`;
        if (stable !== null) { pose('left', classes[0]); if (state.screen === 'play' && !state.correct) pose('right', classes[1]); }
      } else {
        const detected = root.querySelector('#pose-status'); if (detected) detected.textContent = classes.map((n,i)=> n === null ? '' : `${i ? '右' : '左'}：${POSE_NAMES[n]}`).filter(Boolean).join('　') || '請站在鏡頭前';
        if (left !== null) pose('left', left);
        if (right !== null && (state.mode === 'duel' || state.mode === 'coop')) pose('right', right);
      }
    } else {
      state.balanceSince = null;
      state.stabilizers.forEach(s => s.update(null, performance.now())); state.coopStabilizer.update(null, performance.now());
      const detected = root.querySelector('#pose-status'); if (detected) detected.textContent = '尚未看到完整身體，請稍微退後一點';
    }
  }
  requestAnimationFrame(detectLoop);
}
function stopCamera() {
  if (state.stream) state.stream.getTracks().forEach(track => track.stop());
  state.stream = null; state.cameraActive = false; state.cameraLoading = false; state.lastVideoTime = -1;
}
function updateLiveUi() {
  const cfg = MODES[state.mode];
  const timer = root.querySelector('.timer'); if (timer) timer.textContent = `⏱ ${cfg.total ? `${Math.ceil(state.remaining)} 秒` : cfg.duel ? `第 ${Math.min(state.questionCount,8)} 題` : '慢慢來'}`;
  const count = root.querySelector('.question-count'); if (count) count.textContent = `第 ${state.questionCount} 題`;
  const scores = root.querySelectorAll('.play-stats strong'); if (scores[0]) scores[0].textContent = state.score; if (scores[1]) scores[1].textContent = state.done; if (scores[2]) scores[2].textContent = `${Math.ceil(state.questionLeft)} 秒`;
}

function nextQuestion(first = false) {
  const cfg = MODES[state.mode];
  state.target = nextTarget(first ? null : state.previous, cfg.pool);
  state.answer = null;
  if (cfg.math && Math.random() < 0.55) {
    const math = makeMathQuestion();
    if (math.answer !== state.previous) { state.answer = math; state.target = math.answer; }
  }
  state.previous = state.target; state.correct = false; state.questionLeft = cfg.perQuestion;
  state.duelCorrect = [false, false]; state.duelWinner = null; state.coopSeen = [false, false];
  state.questionCount++; state.left = 0; state.right = 0;
}
function tick() {
  const cfg = MODES[state.mode];
  if (cfg.total) state.remaining = Math.max(0, cfg.total - (Date.now() - state.startedAt) / 1000);
  if (cfg.perQuestion) state.questionLeft = Math.max(0, state.questionLeft - 0.1);
  if ((cfg.total && state.remaining <= 0) || (cfg.duel && state.questionCount > 8)) { finish(); return; }
  if (cfg.perQuestion && state.questionLeft <= 0) { if (cfg.duel && state.duelCorrect.some(Boolean)) state.done++; state.feedback = '時間到，下一題加油！'; nextQuestion(); render(); return; }
  updateLiveUi();
}
function finish() { clearInterval(state.timer); stopCamera(); state.screen = 'result'; render(); }
function pose(player, value) {
  const cfg = MODES[state.mode]; if (state.correct && !cfg.duel) return;
  if (player === 'left') state.left = value; else state.right = value;
  if (cfg.duel) {
    const index = player === 'left' ? 0 : 1;
    if (value === state.target && !state.duelCorrect[index]) {
      state.duelCorrect[index] = true; state.score += 10;
      if (state.duelWinner === null) { state.duelWinner = index; state.score += 5; state.feedback = `${player === 'left' ? '左玩家' : '右玩家'}先完成！答對 10 分，搶快加 5 分。`; }
      else state.feedback = `${player === 'left' ? '左玩家' : '右玩家'}也答對了！獲得 10 分。`;
      if (state.duelCorrect.every(Boolean)) { state.correct = true; state.done++; setTimeout(() => { if (state.screen !== 'play') return; nextQuestion(); render(); }, 700); }
    }
  } else if (cfg.coop) {
    state.coopSeen[player === 'left' ? 0 : 1] = true;
    const total = calculateCoopTotal(state.left, state.right);
    if (state.coopSeen.every(Boolean) && total === state.target) win('合作成功！兩位都獲得 10 分！', 20);
  } else if (value === state.target && (!state.answer || state.answer.answer === state.target)) {
    if (state.lastPose === 0 && value !== 0) state.standUps++;
    state.lastPose = value; win('答對了，太棒了！', 10);
  } else if (value === state.target && state.answer && state.answer.answer !== state.target) {
    state.feedback = `先想一想：答案是 ${state.answer.answer} 隻腳。`;
  }
  if (state.screen === 'play') { render(); updateLiveUi(); }
}
function win(message, points) { state.correct = true; state.done++; state.score += points; state.feedback = message; if (state.target === 1) state.bestBalance = Math.max(state.bestBalance, 0.4); setTimeout(() => { if (state.screen !== 'play') return; const cfg = MODES[state.mode]; if (cfg.total && (Date.now() - state.startedAt) / 1000 >= cfg.total) return finish(); nextQuestion(); render(); }, 700); }
function back() { clearInterval(state.timer); stopCamera(); state.screen = 'home'; render(); }
function render() {
  const cfg = MODES[state.mode];
  if (state.screen === 'home') {
    root.innerHTML = `<header class="top"><div class="brand"><span class="brand-icon">🐾</span><div><b>動物幾隻腳</b><small>一起動一動，開心練體力</small></div></div><span class="pill">體感訓練版</span></header><main class="home"><section class="hero"><div class="hero-copy"><span class="eyebrow">看題目・做動作・一起玩</span><h1>動物有幾隻腳？<br><em>換你來比一比！</em></h1><p>坐下、站起來，或舉起雙手，用身體猜猜動物的腳數。</p><div class="hero-tags"><span>🪑 坐好</span><span>🦩 單腳</span><span>🐧 站好</span><span>🙌 舉高手</span></div></div><div class="hero-art" aria-hidden="true"><span>🐘</span><span>🐧</span><span>🦩</span><i>🐟</i></div></section><h2 class="section-title">選擇遊戲模式 <small>選好後可看玩法說明</small></h2><section class="mode-grid">${[['training','🌿','自在訓練','不限時間・熟悉動作'],['simple','☀️','簡單挑戰','40 秒・坐下與站立'],['normal','⭐','一般挑戰','30 秒・加入單腳平衡'],['hard','🧠','困難挑戰','30 秒・動作加簡易算術'],['duel','🏁','雙人搶快 PK','兩位玩家輪流搶答'],['coop','🤝','雙人合作湊腳數','一起合作湊到 8 隻腳']].map(([id,icon,title,desc])=>`<button class="mode-card" data-mode="${id}"><span class="mode-icon">${icon}</span><b>${title}</b><small>${desc}</small><span class="card-arrow">開始了解　›</span></button>`).join('')}</section><aside class="safety">💛 <b>安全小提醒</b>　請在穩固椅子旁遊玩；單腳動作可扶著椅背。今天以舒服、安全為主。</aside></main><footer>鏡頭辨識支援單人及雙人模式；也可以使用按鈕模擬動作。</footer>`;
    root.querySelectorAll('[data-mode]').forEach(el => el.onclick = () => chooseMode(el.dataset.mode)); return;
  }
  if (state.screen === 'rules') {
    const rules = { training: '不限時間。依序模仿 0、1、2 或 4 隻腳的動作；每題都會換腳數。', simple: '總共 40 秒，每題 8 秒。題目有 0、2、4 隻腳。', normal: '總共 30 秒，每題 5 秒。題目有 0、1、2、4 隻腳。', hard: '總共 30 秒，每題 5 秒。動作題中會穿插簡單加減法。', duel: '雙人搶答，每題 5 秒；答對各得基礎分，率先完成者加分。示範版以按鈕分別代表左右玩家。', coop: '總共 45 秒，每題 6 秒。兩位玩家各選一個動作，合計湊成題目腳數。' }[state.mode];
    root.innerHTML = `<header class="top"><button class="text-button" id="back">‹ 返回模式</button><div class="brand"><span class="brand-icon">🐾</span><div><b>動物幾隻腳</b><small>遊戲說明</small></div></div><span class="pill">${cfg.title}</span></header><main class="rules-page"><div class="rules-card"><span class="big-icon">${state.mode === 'coop' ? '🤝' : state.mode === 'duel' ? '🏁' : '🎯'}</span><span class="eyebrow">開始前看一看</span><h1>${cfg.title}</h1><p>${rules}</p><div class="pose-guide">${[['🪑','0 隻','坐在椅子上'],['🦩','1 隻','站好，抬起一腳'],['🐧','2 隻','站好，手自然放下'],['🙌','4 隻','站好，雙手舉高']].map(x=>`<div><b>${x[0]} ${x[1]}</b><small>${x[2]}</small></div>`).join('')}</div><div class="demo-note"><span>📷</span><div><b>使用鏡頭辨識</b><small>請允許鏡頭權限，並盡量讓全身入鏡；也可用按鈕模擬姿勢。</small></div></div><button class="primary-button" id="start">我準備好了，開始！　›</button></div></main>`;
    root.querySelector('#back').onclick = back; root.querySelector('#start').onclick = startGame; return;
  }
  if (state.screen === 'play') {
    const cooperation = cfg.coop; const prompt = state.answer ? state.answer.text : `${ANIMALS[state.target]?.[0] ?? '🐙'} 有幾隻腳？`;
    const timerText = cfg.total ? `${Math.ceil(state.remaining)} 秒` : cfg.duel ? `第 ${Math.min(state.questionCount,8)} 題` : '慢慢來';
    const sim = (player='left') => `<div class="sim-player"><b>${player==='left'?'左邊玩家':'右邊玩家'}</b><div class="pose-buttons">${choices.map(n=>`<button class="pose-button ${((player==='left'?state.left:state.right)===n)?'selected':''}" data-player="${player}" data-pose="${n}"><span>${POSE_EMOJI[n]}</span><small>${POSE_NAMES[n]}</small></button>`).join('')}</div></div>`;
    const cameraPanel = `<section class="camera-card"><div class="camera-window">${state.cameraActive ? '<video id="camera-video" autoplay playsinline muted></video>' : `<div class="camera-placeholder">${state.cameraLoading ? '⏳' : '📷'}<b>${state.cameraLoading ? '正在準備鏡頭…' : '鏡頭姿勢辨識'}</b></div>`}</div><div class="camera-tools"><button class="camera-button" id="enable-camera" ${state.cameraActive || state.cameraLoading ? 'disabled' : ''}>${state.cameraActive ? '鏡頭已啟用' : state.cameraLoading ? '載入中…' : '📷 開啟鏡頭'}</button><span id="pose-status">${state.cameraError || (state.cameraActive ? '請站在鏡頭前，盡量讓全身入鏡' : '開啟鏡頭後，維持姿勢 0.4 秒即可判定')}</span><button class="soft-button" id="toggle-sim">${state.simulation ? '關閉按鈕試玩' : '沒有鏡頭？按鈕試玩'}</button></div></section>`;
    const simControls = (state.simulation || !state.cameraActive) ? (state.mode === 'duel' ? `<div class="players-grid">${sim('left')}${sim('right')}</div>` : cooperation ? `<div class="players-grid">${sim('left')}${sim('right')}</div>` : `<section class="sim-player single"><b>選一個動作模擬作答</b><div class="pose-buttons">${choices.map(n=>`<button class="pose-button ${state.left===n?'selected':''}" data-player="left" data-pose="${n}"><span>${POSE_EMOJI[n]}</span><small>${POSE_NAMES[n]}</small></button>`).join('')}</div></section>`) : '';
    root.innerHTML = `<header class="top"><button class="text-button" id="exit">‹ 離開</button><div class="brand"><span class="brand-icon">🐾</span><div><b>${cfg.title}</b><small class="question-count">第 ${state.questionCount} 題</small></div></div><span class="pill timer">⏱ ${timerText}</span></header><main class="play-page"><section class="play-stats"><span>⭐ 得分　<strong>${state.score}</strong></span><span>✅ 答對　<strong>${state.done}</strong></span>${cfg.perQuestion?`<span>本題　<strong>${Math.ceil(state.questionLeft)} 秒</strong></span>`:''}</section><section class="question-card"><div class="animal">${ANIMALS[state.target]?.[0] ?? '🐙'}</div><div class="question-text"><span class="eyebrow">請做出對應動作</span><h1>${prompt}</h1><p>${cooperation ? '兩位玩家合計要剛好湊到：' : '題目腳數'} <b class="target-number">${state.target} 隻腳</b></p></div><div class="hold-badge">${state.correct?'完成！':'鏡頭辨識穩定維持 0.4 秒即可判定'}</div></section>${cameraPanel}${cooperation?`<div class="coop-score"><span>左玩家 <b>${state.left}</b></span><strong>＋</strong><span>右玩家 <b>${state.right}</b></span><strong>＝</strong><span>合計 <b>${calculateCoopTotal(state.left,state.right)}</b></span></div>`:''}${simControls}<div class="feedback ${state.correct?'good':''}">${state.feedback || '準備好就選擇一個動作吧！'}</div><div class="play-controls"><button class="soft-button" id="skip">⏭ 跳過這題</button><button class="soft-button" id="finish">結束遊戲</button></div></main>`;
    root.querySelector('#exit').onclick = back; root.querySelector('#skip').onclick = () => { nextQuestion(); render(); }; root.querySelector('#finish').onclick = finish;
    root.querySelector('#enable-camera').onclick = enableCamera; root.querySelector('#toggle-sim').onclick = () => { state.simulation = !state.simulation; render(); };
    root.querySelectorAll('[data-pose]').forEach(el=>el.onclick=()=>pose(el.dataset.player,Number(el.dataset.pose)));
    attachCameraVideo(); return;
  }
  root.innerHTML = `<header class="top"><div class="brand"><span class="brand-icon">🐾</span><div><b>動物幾隻腳</b><small>遊戲結算</small></div></div></header><main class="result-page"><div class="result-card"><span class="big-icon">🎉</span><span class="eyebrow">${cfg.title}完成</span><h1>太棒了，今天動得很好！</h1><div class="result-stats"><div><b>${state.score}</b><small>總得分</small></div><div><b>${state.done}</b><small>完成題數</small></div><div><b>${state.standUps}</b><small>起站次數</small></div><div><b>${state.bestBalance.toFixed(1)} 秒</b><small>最佳平衡</small></div></div><p class="encourage">${state.standUps ? `太棒了！今天幫自己完成了 ${state.standUps} 次起立練習！` : '每一次嘗試都是很棒的練習！'}</p><button class="primary-button" id="again">再玩一次</button><button class="soft-button" id="home">回到模式選擇</button></div></main>`;
  root.querySelector('#again').onclick=startGame; root.querySelector('#home').onclick=back;
}
render();
