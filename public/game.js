import { WIDTH, HEIGHT } from './level.mjs';
import { Round } from './game-core.mjs';
import { createRetroEffect } from './retro.js';

const canvas = document.querySelector('#game'), stage = document.querySelector('.game-stage'), ctx = canvas.getContext('2d');
const screen = document.querySelector('#screen'), start = document.querySelector('#start-button');
const live = document.querySelector('#live-status'), countdown = document.querySelector('#countdown');
const pause = document.querySelector('#pause-button');
const round = new Round();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const retroButton = document.querySelector('#retro-button');
let retro;
try { retro = createRetroEffect(canvas); }
catch (error) { console.error('复古着色器初始化失败', error); }
retroButton.disabled = !retro;
retroButton.setAttribute('aria-pressed', String(!!retro));
retro?.output.addEventListener('retro-unavailable', () => {
  retro = null;
  retroButton.disabled = true;
  retroButton.setAttribute('aria-pressed', 'false');
  live.textContent = '复古画面暂不可用，行动可以继续。';
  resize();
});
const images = await Promise.all(['map-layout.svg','bug-orange.png','bug-yellow.png'].map(name => new Promise((resolve,reject) => {
  const image = new Image(); image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`素材加载失败：${name}`)); image.src = `./assets/${name}`;
}))).catch(error => {
  document.querySelector('#screen-copy').textContent = error.message;
  start.textContent = '刷新重试'; start.disabled = false; start.onclick = () => location.reload();
  throw error;
});
const [background, ...sprites] = images;
let previous = 0, shownState = '', announcedSecond = 0;
let viewScale = 1, viewOffsetX = 0, viewOffsetY = 0;
let resizeFrame = 0;

function sceneMetrics(rect) {
  const scale = Math.min(rect.width / WIDTH, rect.height / HEIGHT);
  return {
    scale,
    width: WIDTH * scale,
    height: HEIGHT * scale,
    offsetX: (rect.width - WIDTH * scale) / 2,
    offsetY: (rect.height - HEIGHT * scale) / 2,
  };
}

start.disabled = false;
document.querySelector('#button-label').textContent = '开始行动';
function resize() {
  const rect = stage.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  const useRetro = retro && !retro.output.hidden;
  document.querySelector('.game-frame').classList.toggle('retro-active', !!useRetro);
  const sourceWidth = useRetro ? 640 : Math.max(1, Math.round(rect.width * dpr));
  const sourceHeight = useRetro ? 400 : Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== sourceWidth) canvas.width = sourceWidth;
  if (canvas.height !== sourceHeight) canvas.height = sourceHeight;
  retro?.resize(Math.max(1, Math.round(rect.width * Math.min(dpr, 1.5))), Math.max(1, Math.round(rect.height * Math.min(dpr, 1.5))));
  viewScale = Math.min(canvas.width / WIDTH, canvas.height / HEIGHT);
  viewOffsetX = (canvas.width - WIDTH * viewScale) / 2;
  viewOffsetY = (canvas.height - HEIGHT * viewScale) / 2;
  draw();
}

function scheduleResize() {
  if (resizeFrame) return;
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    resize();
  });
}
retroButton.addEventListener('click', () => {
  retro.output.hidden = !retro.output.hidden;
  const enabled = !retro.output.hidden;
  retroButton.setAttribute('aria-pressed', String(enabled));
  retroButton.dataset.tooltip = enabled ? '复古画面：开' : '复古画面：关';
  live.textContent = enabled ? '已开启复古画面' : '已关闭复古画面';
  resize();
});
function draw() {
  ctx.imageSmoothingEnabled = !(retro && !retro.output.hidden);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#273447';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(viewScale, 0, 0, viewScale, viewOffsetX, viewOffsetY);
  ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);
  for (const bug of [...round.bugs].sort((a,b) => a.y-b.y)) {
    ctx.save(); ctx.translate(bug.x, bug.y);
    ctx.fillStyle = '#10192588'; ctx.beginPath();ctx.ellipse(0, 2, 24, 8, 0, 0, Math.PI*2);ctx.fill();
    const bounce = reducedMotion.matches ? 0 : Math.sin(bug.phase)*1.4;
    ctx.scale(bug.facing, 1 + bounce * .012);
    ctx.drawImage(sprites[bug.sprite], -32, -37 + bounce, 64, 43);
    ctx.restore();
  }
  for (const effect of round.effects) {
    const progress=effect.age/.45; ctx.save();ctx.globalAlpha=1-progress;
    ctx.strokeStyle=effect.hit?'#ffe5a2':'#65dfff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(effect.x,effect.y-10,8+progress*30,0,Math.PI*2);ctx.stroke();
    if(effect.hit){ctx.fillStyle='#fff1be';ctx.font='bold 19px sans-serif';ctx.textAlign='center';ctx.fillText('+1',effect.x,effect.y-25-progress*30);}
    ctx.restore();
  }
  retro?.render(reducedMotion.matches ? 0 : performance.now());
}
function updateUI() {
  const seconds = Math.ceil(round.time);
  document.querySelector('#time').textContent = String(seconds).padStart(2,'0');
  document.querySelector('#score').textContent = String(round.score).padStart(2,'0');
  document.querySelector('#leaks').textContent = String(round.leaks).padStart(2,'0');
  document.querySelector('.hud').classList.toggle('urgent',seconds <= 5);
  document.querySelector('.command-bar').classList.toggle('urgent',seconds <= 5);
  countdown.hidden = round.state !== 'countdown';
  countdown.textContent = Math.max(1,Math.ceil(round.countdown));
  pause.disabled = !['playing','countdown'].includes(round.state);
  if(round.state === 'playing' && seconds<=5 && seconds!==announcedSecond){live.textContent=`剩余 ${seconds} 秒`;announcedSecond=seconds;}
  if(shownState === round.state) return;
  shownState = round.state;
  screen.classList.toggle('is-hidden', ['playing','countdown'].includes(round.state));
  screen.classList.toggle('is-result',round.state === 'finished');
  document.querySelector('.game-frame').classList.toggle('is-result',round.state === 'finished');
  document.querySelector('#result-tally').hidden = round.state !== 'finished';
  if(round.state === 'finished') {
    document.querySelector('#screen-title').textContent = '行动结束';
    document.querySelector('#result-score').textContent = String(round.score).padStart(2,'0');
    document.querySelector('#result-leaks').textContent = String(round.leaks).padStart(2,'0');
    document.querySelector('#button-label').textContent = '再次行动';
    live.textContent=`行动结束，成功拦截 ${round.score} 只，漏网 ${round.leaks} 只。`;
    start.focus({preventScroll:true});
  }
  if(round.state === 'paused') {
    document.querySelector('#screen-title').textContent = '行动暂停';
    document.querySelector('#screen-copy').textContent = '计时与原石虫已暂停。准备好后继续守住蓝门。';
    document.querySelector('#button-label').textContent = '继续行动';
    start.focus({preventScroll:true});
  }
}
let stateBeforePause;
function pauseRound(){
  if(!['playing','countdown'].includes(round.state))return;
  stateBeforePause=round.state; round.state='paused'; updateUI();
}
start.addEventListener('click', () => {
  if(round.state==='paused') round.state=stateBeforePause;
  else {round.start();announcedSecond=0;live.textContent='准备，原石虫将从四个红门出现。';}
  previous=performance.now(); updateUI();
});
pause.addEventListener('click',pauseRound);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseRound();previous=0;});
// A fixed touchscreen station must not pan the page when fingers slide off the canvas.
document.addEventListener('touchmove',event=>event.preventDefault(),{passive:false});
document.addEventListener('dragstart',event=>event.preventDefault());
canvas.addEventListener('contextmenu',event=>event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  event.preventDefault();
  const rect=canvas.getBoundingClientRect();
  const metrics=sceneMetrics(rect);
  const x=event.clientX-rect.left-metrics.offsetX;
  const y=event.clientY-rect.top-metrics.offsetY;
  if (x < 0 || y < 0 || x > metrics.width || y > metrics.height) return;
  round.hit(x/metrics.scale,y/metrics.scale,Math.max(33,22/metrics.scale));
  updateUI(); draw();
});
document.querySelector('#fullscreen-button').addEventListener('click', async()=>{
  try {if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
  catch {live.textContent='当前浏览器不支持全屏，可使用浏览器菜单。';}
});
window.addEventListener('keydown',event=>{if(event.code==='Escape')pauseRound();});
new ResizeObserver(scheduleResize).observe(stage);
window.addEventListener('resize', scheduleResize, { passive: true });
window.addEventListener('orientationchange', scheduleResize, { passive: true });
document.addEventListener('fullscreenchange', scheduleResize);
window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });
resize();updateUI();
function frame(now){const dt=previous?(now-previous)/1000:0;previous=now;round.tick(dt);draw();updateUI();requestAnimationFrame(frame);}
requestAnimationFrame(frame);
if('serviceWorker' in navigator){
  try {
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(hadController && ['ready','finished'].includes(round.state)) location.reload();
      hadController = true;
    });
    const registration=await navigator.serviceWorker.register('./service-worker.js');
    const reportReady=async()=>{
      if(!registration.active)return;
      document.querySelector('#offline-status').textContent='离线可用';
    };
    if(registration.active)reportReady();
    else registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',reportReady));
    navigator.serviceWorker.ready.then(reportReady);
  } catch {document.querySelector('#offline-status').textContent='离线缓存未就绪';}
}

