const SAVE_KEY = "cloud-idle-save-v3";
const TICK_MS = 100;
const SAVE_INTERVAL_MS = 5000;
const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

const SHOP_ITEMS = [
  { id: "finger", name: "손가락 힘", icon: "👆", desc: "클릭당 +1 구름", category: "click", type: "click", baseCost: 15, costMult: 1.15, effect: 1 },
  { id: "fluffy", name: "몽실 장갑", icon: "🧤", desc: "클릭당 +3 구름", category: "click", type: "click", baseCost: 80, costMult: 1.16, effect: 3 },
  { id: "pillow", name: "구름 베개", icon: "🛏️", desc: "클릭당 +8 구름", category: "click", type: "click", baseCost: 450, costMult: 1.17, effect: 8 },
  { id: "dream", name: "낮잠의 힘", icon: "😴", desc: "클릭당 +25 구름", category: "click", type: "click", baseCost: 2800, costMult: 1.18, effect: 25 },
  { id: "zen", name: "멍의 경지", icon: "🧘", desc: "클릭당 +80 구름", category: "click", type: "click", baseCost: 18000, costMult: 1.19, effect: 80 },

  { id: "breeze", name: "산들바람", icon: "🍃", desc: "초당 0.1 구름", category: "auto", type: "auto", baseCost: 20, costMult: 1.12, effect: 0.1 },
  { id: "windmill", name: "풍차", icon: "🌀", desc: "초당 1 구름", category: "auto", type: "auto", baseCost: 120, costMult: 1.13, effect: 1 },
  { id: "plane", name: "하늘 비행기", icon: "✈️", desc: "초당 8 구름", category: "auto", type: "auto", baseCost: 900, costMult: 1.14, effect: 8 },
  { id: "balloon", name: "열기구", icon: "🎈", desc: "초당 22 구름", category: "auto", type: "auto", baseCost: 3200, costMult: 1.14, effect: 22 },
  { id: "storm", name: "뇌우 구름", icon: "⛈️", desc: "초당 47 구름", category: "auto", type: "auto", baseCost: 5500, costMult: 1.15, effect: 47 },
  { id: "castle", name: "하늘 성", icon: "🏰", desc: "초당 130 구름", category: "auto", type: "auto", baseCost: 28000, costMult: 1.15, effect: 130 },
  { id: "jet", name: "제트 기류", icon: "🌪️", desc: "초당 260 구름", category: "auto", type: "auto", baseCost: 52000, costMult: 1.16, effect: 260 },
  { id: "aurora", name: "오로라", icon: "🌌", desc: "초당 1400 구름", category: "auto", type: "auto", baseCost: 420000, costMult: 1.17, effect: 1400 },
  { id: "nebula", name: "성운 공장", icon: "✨", desc: "초당 7800 구름", category: "auto", type: "auto", baseCost: 3200000, costMult: 1.18, effect: 7800 },

  { id: "cushion", name: "멍 쿠션", icon: "🛋️", desc: "멍 공간 클릭 +25%", category: "mung", type: "mung_bonus", baseCost: 200, costMult: 1.2, effect: 0.25 },
  { id: "tea", name: "따뜻한 차", icon: "🍵", desc: "전체 생산 +5%", category: "mung", type: "mult", baseCost: 800, costMult: 1.22, effect: 0.05 },
  { id: "bell", name: "작은 종", icon: "🔔", desc: "전체 생산 +10%", category: "mung", type: "mult", baseCost: 5000, costMult: 1.23, effect: 0.1 },
  { id: "cat", name: "고양이 친구", icon: "🐱", desc: "전체 생산 +20%", category: "mung", type: "mult", baseCost: 35000, costMult: 1.24, effect: 0.2 },
  { id: "hammock", name: "해먹", icon: "🏖️", desc: "멍 공간 클릭 +50%", category: "mung", type: "mung_bonus", baseCost: 12000, costMult: 1.25, effect: 0.5 },
];

const MUNG_SCENES = [
  {
    id: "sky",
    name: "하늘 구경",
    image: "images/mung/sky.jpg",
    messages: [
      "구름 모양이 뭐 같아 보여?",
      "오늘은 아무것도 안 해도 돼.",
      "바람 소리만 들어도 충분해.",
      "생각은 구름처럼 떠다녀도 괜찮아.",
    ],
  },
  {
    id: "rain",
    name: "빗소리 멍",
    image: "images/mung/rain.jpg",
    messages: [
      "빗방울 하나씩 세어봐… 아니다 말자.",
      "창밖만 바라봐도 충분해.",
      "젖은 냄새가 상상돼.",
      "우산 없이 걸어도 괜찮은 날.",
    ],
    rain: true,
  },
  {
    id: "stars",
    name: "별 헤매기",
    image: "images/mung/stars.jpg",
    messages: [
      "별이 반짝일 때마다 숨 쉬어봐.",
      "우주는 넓고 나는 작아… 좋다.",
      "오늘 하루도 수고했어.",
      "아무 생각 없이 밤하늘만.",
    ],
  },
  {
    id: "breath",
    name: "호흡 멍",
    image: "images/mung/mountain.jpg",
    messages: [
      "들이쉬고…",
      "내쉬고…",
      "어깨 힘 빼.",
      "천천히, 급할 것 없어.",
    ],
    breathe: true,
  },
  {
    id: "blob",
    name: "없는 생각",
    image: "images/mung/forest.jpg",
    messages: [
      "……",
      "뭐 하고 있었더라?",
      "아무것도 아닌 게 좋은 거야.",
      "멍…",
    ],
  },
  {
    id: "window",
    name: "창밖 풍경",
    image: "images/mung/lake.jpg",
    messages: [
      "저기 나무가 살짝 흔들린다.",
      "버스 지나가는 소리가 들릴 것 같아.",
      "커튼 너머 하늘이 편해.",
      "그냥 앉아있기만 해도 돼.",
    ],
  },
  {
    id: "underwater",
    name: "수면 아래",
    image: "images/mung/ocean.jpg",
    messages: [
      "물속은 조용해.",
      "천천히 떠다녀도 돼.",
      "소리가 멀어지는 느낌.",
      "기포처럼 생각을 보내.",
    ],
  },
  {
    id: "sunset",
    name: "노을 멍",
    image: "images/mung/sunset.jpg",
    messages: [
      "하늘이 점점 부드러워져.",
      "오늘은 여기까지.",
      "노을은 말이 없어서 좋아.",
      "따뜻한 색에 잠깐 쉬어.",
    ],
  },
  {
    id: "grass",
    name: "잔디밭 누워",
    image: "images/mung/grass.jpg",
    messages: [
      "누워서 하늘만 봐.",
      "풀 냄새가 날 것 같아.",
      "바쁘지 않아도 괜찮아.",
      "멍하니… 좋다.",
    ],
  },
];

const defaultState = () => ({
  clouds: 0,
  totalEarned: 0,
  clickPower: 1,
  perSecond: 0,
  mungBonus: 0,
  productionMult: 1,
  owned: Object.fromEntries(SHOP_ITEMS.map((item) => [item.id, 0])),
  lastSave: Date.now(),
  settings: { bgm: false, sfx: true, mungBgmVolume: 0.7 },
});

let state = defaultState();
let activeTab = "click";
let mungActive = false;
let mungActivity = "cloud";
let currentScene = null;
let messageTimer = null;
let breatheTimer = null;

const cloudCountEl = document.getElementById("cloud-count");
const perSecondEl = document.getElementById("per-second");
const cloudBtn = document.getElementById("cloud-btn");
const shopListEl = document.getElementById("shop-list");
const resetBtn = document.getElementById("reset-btn");
const bgmToggle = document.getElementById("bgm-toggle");
const sfxToggle = document.getElementById("sfx-toggle");
const mungEnterBtn = document.getElementById("mung-enter");
const mungOverlay = document.getElementById("mung-overlay");
const mungSceneEl = document.getElementById("mung-scene");
const mungBgImg = document.getElementById("mung-bg-img");
const mungParticlesEl = document.getElementById("mung-particles");
const mungMessageEl = document.getElementById("mung-message");
const mungSceneNameEl = document.getElementById("mung-scene-name");
const mungCloudBtn = document.getElementById("mung-cloud-btn");
const mungCloudDisplay = document.getElementById("mung-cloud-display");
const mungCloseBtn = document.getElementById("mung-close");
const mungNextSceneBtn = document.getElementById("mung-next-scene");
const mungBgmToggle = document.getElementById("mung-bgm-toggle");
const mungBgmVolume = document.getElementById("mung-bgm-volume");
const mungVolumeWrap = document.querySelector(".mung-volume-wrap");

window.GameBridge = {
  getSnapshot: () => ({
    clouds: state.clouds,
    perSecond: state.perSecond,
    inMung: mungActive,
    mungActivity,
  }),
  setMungActivity: (activity) => {
    mungActivity = activity;
  },
  broadcastMungEvent: (type, payload) => {
    if (window.Multiplayer) Multiplayer.broadcastMungEvent(type, payload);
  },
};

function formatNumber(value) {
  const abs = Math.abs(value);
  if (abs < 1000) return Math.floor(value).toLocaleString("ko-KR");
  if (abs < 1_000_000) return `${(value / 1000).toFixed(2)}K`;
  if (abs < 1_000_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs < 1_000_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  return `${(value / 1_000_000_000_000).toFixed(2)}T`;
}

function getItemCost(item) {
  const owned = state.owned[item.id] || 0;
  return Math.ceil(item.baseCost * Math.pow(item.costMult, owned));
}

function recalcRates() {
  let clickPower = 1;
  let perSecond = 0;
  let mungBonus = 0;
  let productionMult = 1;

  for (const item of SHOP_ITEMS) {
    const count = state.owned[item.id] || 0;
    if (item.type === "click") clickPower += item.effect * count;
    if (item.type === "auto") perSecond += item.effect * count;
    if (item.type === "mung_bonus") mungBonus += item.effect * count;
    if (item.type === "mult") productionMult += item.effect * count;
  }

  state.clickPower = clickPower;
  state.perSecond = perSecond * productionMult;
  state.mungBonus = mungBonus;
  state.productionMult = productionMult;
}

function getClickGain(inMung) {
  let gain = state.clickPower;
  if (inMung) gain *= 1 + state.mungBonus;
  return gain;
}

function spawnFloatText(amount, x, y) {
  const el = document.createElement("span");
  el.className = "float-text";
  el.textContent = `+${formatNumber(amount)}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  if (mungActive) el.style.color = "rgba(255,255,255,0.95)";
  document.body.appendChild(el);
  el.addEventListener("animationend", () => el.remove());
}

function updateUI() {
  cloudCountEl.textContent = formatNumber(state.clouds);
  perSecondEl.textContent = formatNumber(state.perSecond);
  mungCloudDisplay.textContent = `${formatNumber(state.clouds)} 구름`;

  for (const item of SHOP_ITEMS) {
    if (item.category !== activeTab) continue;
    const row = shopListEl.querySelector(`[data-id="${item.id}"]`);
    if (!row) continue;

    const cost = getItemCost(item);
    const owned = state.owned[item.id] || 0;
    const canAfford = state.clouds >= cost;

    row.classList.toggle("disabled", !canAfford && owned === 0);
    row.querySelector(".shop-owned").textContent = owned > 0 ? `보유 ${owned}개` : "미보유";
    row.querySelector(".buy-btn").textContent = formatNumber(cost);
    row.querySelector(".buy-btn").disabled = !canAfford;
  }
}

function renderShop() {
  const items = SHOP_ITEMS.filter((item) => item.category === activeTab);
  shopListEl.innerHTML = items.map((item) => `
    <article class="shop-item" data-id="${item.id}">
      <div class="shop-icon" aria-hidden="true">${item.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${item.desc}</div>
        <div class="shop-owned">미보유</div>
      </div>
      <button class="buy-btn" type="button" data-buy="${item.id}">0</button>
    </article>
  `).join("");
  updateUI();
}

function buyItem(id) {
  const item = SHOP_ITEMS.find((entry) => entry.id === id);
  if (!item) return;

  const cost = getItemCost(item);
  if (state.clouds < cost) return;

  state.clouds -= cost;
  state.owned[item.id] = (state.owned[item.id] || 0) + 1;
  recalcRates();
  updateUI();
  saveGame();
}

function addClouds(gain, sourceEl) {
  state.clouds += gain;
  state.totalEarned += gain;

  CloudAudio.playCloudPuff();

  sourceEl.classList.add("pressed");
  window.setTimeout(() => sourceEl.classList.remove("pressed"), 120);

  const rect = sourceEl.getBoundingClientRect();
  const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * 50;
  const y = rect.top + rect.height / 2 - 10;
  spawnFloatText(gain, x, y);
  updateUI();
}

function onCloudClick() {
  CloudAudio.unlock();
  addClouds(getClickGain(false), cloudBtn);
}

function onMungCloudClick() {
  CloudAudio.unlock();
  addClouds(getClickGain(true), mungCloudBtn);
}

function pickRandomScene(excludeId) {
  const pool = MUNG_SCENES.filter((s) => s.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}

function clearMungEffects() {
  mungParticlesEl.innerHTML = "";
  if (messageTimer) window.clearInterval(messageTimer);
  if (breatheTimer) window.clearInterval(breatheTimer);
  messageTimer = null;
  breatheTimer = null;
}

function spawnParticles(scene) {
  if (!scene.particle) return;
  const count = 12;
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement("div");
    el.className = "mung-particle";
    const [minS, maxS] = scene.particle.size;
    const size = minS + Math.random() * (maxS - minS);
    el.style.width = `${size}px`;
    el.style.height = `${size * 0.6}px`;
    el.style.left = `${Math.random() * 100}%`;
    el.style.background = scene.particle.color;
    el.style.animationDuration = `${12 + Math.random() * 18}s`;
    el.style.animationDelay = `${Math.random() * 10}s`;
    mungParticlesEl.appendChild(el);
  }
}

function spawnRain() {
  for (let i = 0; i < 60; i += 1) {
    const drop = document.createElement("div");
    drop.className = "rain-drop";
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.animationDuration = `${0.6 + Math.random() * 0.6}s`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    mungParticlesEl.appendChild(drop);
  }
}

function spawnStars() {
  for (let i = 0; i < 80; i += 1) {
    const star = document.createElement("div");
    star.className = "star-dot";
    star.style.left = `${Math.random() * 100}%`;
    star.style.top = `${Math.random() * 70}%`;
    star.style.animationDuration = `${1 + Math.random() * 3}s`;
    star.style.animationDelay = `${Math.random() * 2}s`;
    mungParticlesEl.appendChild(star);
  }
}

function showMungMessage(text) {
  mungMessageEl.textContent = text;
  mungMessageEl.style.animation = "none";
  void mungMessageEl.offsetWidth;
  mungMessageEl.style.animation = "";
}

function startMessageCycle(scene) {
  const messages = [...scene.messages];
  let idx = Math.floor(Math.random() * messages.length);
  showMungMessage(messages[idx]);

  if (scene.breathe) {
    breatheTimer = window.setInterval(() => {
      idx = (idx + 1) % messages.length;
      showMungMessage(messages[idx]);
    }, 4000);
    return;
  }

  messageTimer = window.setInterval(() => {
    idx = (idx + 1) % messages.length;
    showMungMessage(messages[idx]);
  }, 6000 + Math.random() * 4000);
}

function applyMungScene(scene) {
  clearMungEffects();
  currentScene = scene;

  mungSceneEl.className = "mung-scene scene-photo";
  if (mungBgImg) {
    mungBgImg.src = scene.image;
    mungBgImg.alt = scene.name;
  }
  mungSceneNameEl.textContent = scene.name;

  if (scene.rain) spawnRain();
  else if (scene.id === "stars") spawnStars();

  startMessageCycle(scene);
}

function enterMungMode() {
  CloudAudio.unlock();
  mungActive = true;
  mungActivity = "cloud";
  mungOverlay.classList.remove("hidden");
  mungOverlay.setAttribute("aria-hidden", "false");

  applyMungScene(pickRandomScene());
  CloudAudio.enterMungAudio();
  applyMungBgmVolumeFromSettings();
  syncMungBgmButton();

  if (window.MungPlay) MungPlay.start();
}

function exitMungMode() {
  mungActive = false;
  mungActivity = "cloud";
  mungOverlay.classList.add("hidden");
  mungOverlay.setAttribute("aria-hidden", "true");
  clearMungEffects();
  CloudAudio.exitMungAudio();

  if (window.MungPlay) MungPlay.stop();
}

function syncMungBgmButton() {
  const enabled = CloudAudio.isMungBgmEnabled();
  mungBgmToggle.classList.toggle("active", enabled);
  mungBgmVolume.disabled = false;
  mungVolumeWrap.classList.toggle("disabled", false);
}

function applyMungBgmVolumeFromSettings() {
  const vol = state.settings.mungBgmVolume ?? 0.7;
  CloudAudio.setMungBgmVolume(vol);
  mungBgmVolume.value = String(Math.round(vol * 100));
}

function onMungBgmVolumeChange() {
  CloudAudio.unlock();
  const vol = Number(mungBgmVolume.value) / 100;
  state.settings.mungBgmVolume = vol;
  CloudAudio.setMungBgmVolume(vol);
  if (mungActive && !CloudAudio.isMungBgmEnabled()) {
    CloudAudio.startMungBgm();
  }
  syncMungBgmButton();
  saveGame();
}

function onMungBgmToggle() {
  CloudAudio.unlock();
  CloudAudio.toggleMungBgm();
  syncMungBgmButton();
  saveGame();
}

function nextMungScene() {
  applyMungScene(pickRandomScene(currentScene?.id));
}

function syncAudioButtons() {
  bgmToggle.classList.toggle("active", CloudAudio.isBgmEnabled());
  bgmToggle.setAttribute("aria-pressed", String(CloudAudio.isBgmEnabled()));
  sfxToggle.classList.toggle("active", CloudAudio.isSfxEnabled());
  sfxToggle.setAttribute("aria-pressed", String(CloudAudio.isSfxEnabled()));
}

function onBgmToggle() {
  CloudAudio.unlock();
  const enabled = CloudAudio.toggleBgm();
  state.settings.bgm = enabled;
  syncAudioButtons();
  saveGame();
}

function onSfxToggle() {
  CloudAudio.unlock();
  const enabled = CloudAudio.toggleSfx();
  state.settings.sfx = enabled;
  CloudAudio.setSfxEnabled(enabled);
  syncAudioButtons();
  saveGame();
}

function tick() {
  if (state.perSecond <= 0) return;
  const gain = state.perSecond * (TICK_MS / 1000);
  state.clouds += gain;
  state.totalEarned += gain;
  updateUI();
}

function saveGame() {
  state.lastSave = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    state = {
      ...defaultState(),
      ...saved,
      owned: { ...defaultState().owned, ...saved.owned },
      settings: { ...defaultState().settings, ...saved.settings },
    };
    recalcRates();

    if (state.settings.bgm) CloudAudio.startBgm();

    CloudAudio.setSfxEnabled(state.settings.sfx !== false);
    applyMungBgmVolumeFromSettings();

    const offlineSeconds = Math.min(
      (Date.now() - (saved.lastSave || Date.now())) / 1000,
      MAX_OFFLINE_SECONDS,
    );

    if (offlineSeconds > 1 && state.perSecond > 0) {
      const offlineGain = state.perSecond * offlineSeconds;
      state.clouds += offlineGain;
      state.totalEarned += offlineGain;
    }
  } catch {
    state = defaultState();
  }
}

function resetGame() {
  if (!window.confirm("정말 저장을 초기화할까요? 모든 구름과 업그레이드가 사라집니다.")) return;
  localStorage.removeItem(SAVE_KEY);
  CloudAudio.stopBgm();
  state = defaultState();
  recalcRates();
  renderShop();
  updateUI();
  syncAudioButtons();
}

cloudBtn.addEventListener("click", onCloudClick);
mungCloudBtn.addEventListener("click", onMungCloudClick);
resetBtn.addEventListener("click", resetGame);
bgmToggle.addEventListener("click", onBgmToggle);
sfxToggle.addEventListener("click", onSfxToggle);
mungEnterBtn.addEventListener("click", enterMungMode);
mungCloseBtn.addEventListener("click", exitMungMode);
mungNextSceneBtn.addEventListener("click", nextMungScene);
mungBgmToggle.addEventListener("click", onMungBgmToggle);
mungBgmVolume.addEventListener("input", onMungBgmVolumeChange);

document.querySelectorAll(".shop-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".shop-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    activeTab = tab.dataset.tab;
    renderShop();
  });
});

shopListEl.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-buy]");
  if (btn) buyItem(btn.dataset.buy);
});

window.addEventListener("beforeunload", saveGame);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && mungActive) exitMungMode();
  if (!mungActive) return;
  if (event.target.matches("input, textarea, select")) return;
  if (event.code === "KeyV") {
    event.preventDefault();
    if (window.MungPlay) MungPlay.toggleListen();
  }
});

loadGame();
recalcRates();
renderShop();
updateUI();
syncAudioButtons();
applyMungBgmVolumeFromSettings();

window.setInterval(tick, TICK_MS);
window.setInterval(saveGame, SAVE_INTERVAL_MS);

if (window.Multiplayer) Multiplayer.tryAutoJoin();
