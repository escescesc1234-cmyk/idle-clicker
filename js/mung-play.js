const MungPlay = (() => {
  let active = false;
  let activity = "cloud";
  let bubbleTimer = null;
  let drawing = false;
  let lastPoint = null;
  let myBubblePops = 0;
  let pondRaf = null;
  let fish = [];
  let foods = [];
  let lastPondTick = 0;
  let heldFood = 0;
  let keys = { up: false, down: false, left: false, right: false };
  let stickVec = { x: 0, y: 0 };
  let stickActive = false;
  let player = { x: 800, y: 860, facing: 1, vx: 0, vy: 0, angle: 0 };
  let cam = { x: 0, y: 0 };
  let nearMachine = false;
  let nearPond = false;
  let footstepTimer = 0;
  let lastMoveBroadcast = 0;
  let use3D = false;
  const remotePlayers = new Map();

  function syncPond3D(walking) {
    if (!use3D || !window.Pond3D) return;
    Pond3D.sync({
      player,
      fish,
      foods,
      remotes: remotePlayers,
      walking: !!walking,
      nearMachine,
    });
  }

  const feedDispenseFx = document.getElementById("feed-dispense-fx");
  const foodBagEl = document.querySelector(".pond-food-bag");
  const pondRemotesEl = document.getElementById("pond-remotes");

  const WORLD_W = 1600;
  const WORLD_H = 1100;
  const PLAYER_SPEED = 210;
  const PLAYER_ACCEL = 780;
  const PLAYER_FRICTION = 920;
  const MAX_HELD_FOOD = 12;
  const MACHINE_POS = { x: 1285, y: 735 };
  const POND_RECT = { x: 398, y: 318, w: 724, h: 344 };
  const SHOP_RECT = { x: 1225, y: 760, w: 170, h: 120 };
  const WALK_BOUNDS = { left: 220, right: 1480, top: 280, bottom: 1000 };
  const FISH_KINDS = ["koi-orange", "koi-red", "koi-white", "koi-orange", "koi-red"];

  const overlay = document.getElementById("mung-overlay");
  const center = document.getElementById("mung-center");
  const cloudBtn = document.getElementById("mung-cloud-btn");
  const hint = document.getElementById("mung-hint");
  const ripplesEl = document.getElementById("mung-ripples");
  const bubblesEl = document.getElementById("mung-bubbles");
  const canvas = document.getElementById("mung-draw-canvas");
  const breathCircle = document.getElementById("breath-circle");
  const pondLayer = document.getElementById("pond-layer");
  const pondWorld = document.getElementById("pond-world");
  const pondFishEl = document.getElementById("pond-fish");
  const pondFoodEl = document.getElementById("pond-food");
  const pondRipplesEl = document.getElementById("pond-ripples");
  const feedMachine = document.getElementById("feed-machine");
  const pondPlayer = document.getElementById("pond-player");
  const heldFoodEl = document.getElementById("held-food-count");
  const pondActionHint = document.getElementById("pond-action-hint");
  const pondActionBtn = document.getElementById("pond-action-btn");
  const pondStick = document.getElementById("pond-stick");
  const pondStickKnob = document.getElementById("pond-stick-knob");
  const ctx = canvas.getContext("2d");

  const bubbleStatsPanel = document.getElementById("bubble-stats");
  const bubbleStatsToggle = document.getElementById("bubble-stats-toggle");
  const bubbleStatsBadge = document.getElementById("bubble-stats-badge");
  const myBubbleCountEl = document.getElementById("my-bubble-count");
  const exitListenBtn = document.getElementById("mung-exit-listen");

  const hints = {
    listen: "배경과 소리만 감상해요. 「감상 끝내기」로 나와요",
    cloud: "천천히 눌러도 괜찮아요",
    ripple: "드래그로 시점 회전 · 매점 자판기에서 먹이를 담아 연못 가에 주세요",
    bubble: "떠오르는 거품을 톡톡 터뜨려요",
    draw: "손가락이나 마우스로 천천히 그려보세요",
    breath: "원이 커질 때 들이쉬고, 작아질 때 내쉬어요",
  };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function updateBubbleUI() {
    const text = String(myBubblePops);
    myBubbleCountEl.textContent = text;
    bubbleStatsBadge.textContent = text;
    if (window.Multiplayer) Multiplayer.updateBubbleStats();
  }

  function showBubbleStats(show) {
    if (!bubbleStatsPanel) return;
    bubbleStatsPanel.classList.toggle("hidden", !show);
    if (!show) bubbleStatsPanel.classList.add("collapsed");
  }

  function onBubblePop() {
    myBubblePops += 1;
    updateBubbleUI();
    if (window.GameBridge) {
      window.GameBridge.broadcastMungEvent("bubble-pop", { total: myBubblePops });
    }
  }

  function toggleListen() {
    if (!active) return;
    setActivity(activity === "listen" ? "cloud" : "listen");
  }

  function setActivity(next) {
    activity = next;
    document.querySelectorAll(".mung-activity").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.activity === next);
    });

    const isListen = next === "listen";
    const isCloud = next === "cloud";
    const isDraw = next === "draw";
    const isBreath = next === "breath";
    const isBubble = next === "bubble";
    const isPond = next === "ripple";

    overlay.classList.toggle("listen-mode", isListen);
    overlay.classList.toggle("pond-mode", isPond);
    center.classList.toggle("hidden", !isCloud);
    cloudBtn.classList.toggle("hidden", !isCloud);
    canvas.classList.toggle("active", isDraw);
    breathCircle.classList.toggle("hidden", !isBreath);
    hint.textContent = hints[next];
    showBubbleStats(isBubble);

    if (isListen) stopBubbles(false);

    if (isDraw) {
      resizeCanvas();
      requestAnimationFrame(fadeCanvas);
    }
    if (isBubble) startBubbles();
    else stopBubbles();

    if (isPond) startPond();
    else stopPond();

    if (window.GameBridge) {
      window.GameBridge.setMungActivity(next);
    }
  }

  function createRipple(x, y, fromRemote = false) {
    const ripple = document.createElement("div");
    ripple.className = "ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripplesEl.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
    if (!fromRemote) {
      CloudAudio.playRipple();
      if (window.GameBridge) window.GameBridge.broadcastMungEvent("ripple", { x, y });
    }
  }

  function spawnBubble() {
    if (!active || activity !== "bubble") return;
    const bubble = document.createElement("button");
    bubble.type = "button";
    bubble.className = "mung-bubble";
    const size = 28 + Math.random() * 36;
    bubble.style.width = `${size}px`;
    bubble.style.height = `${size}px`;
    bubble.style.left = `${Math.random() * (window.innerWidth - size)}px`;
    bubble.style.bottom = "-60px";
    bubble.style.animationDuration = `${8 + Math.random() * 10}s`;

    const popBubble = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (bubble.dataset.popped === "1") return;
      bubble.dataset.popped = "1";
      bubble.disabled = true;
      bubble.style.pointerEvents = "none";
      bubble.classList.add("pop");
      CloudAudio.playSoftPop();
      onBubblePop();
      window.setTimeout(() => bubble.remove(), 300);
    };

    bubble.addEventListener("pointerdown", popBubble);
    bubblesEl.appendChild(bubble);
    bubble.addEventListener("animationend", () => {
      if (bubble.dataset.popped !== "1") bubble.remove();
    });
  }

  function startBubbles() {
    stopBubbles(false);
    for (let i = 0; i < 6; i += 1) window.setTimeout(spawnBubble, i * 400);
    bubbleTimer = window.setInterval(spawnBubble, 1800);
  }

  function stopBubbles(clearCount = true) {
    if (bubbleTimer) window.clearInterval(bubbleTimer);
    bubbleTimer = null;
    bubblesEl.innerHTML = "";
    if (clearCount) {
      myBubblePops = 0;
      updateBubbleUI();
    }
  }

  function pondInnerBounds() {
    return {
      left: 24,
      right: POND_RECT.w - 24,
      top: 24,
      bottom: POND_RECT.h - 24,
    };
  }

  function createFish(index) {
    const bounds = pondInnerBounds();
    const kind = FISH_KINDS[index % FISH_KINDS.length];
    const el = document.createElement("div");
    el.className = `pond-fish ${kind}`;
    const scale = 0.75 + Math.random() * 0.55;
    el.style.transform = "translate(-50%, -50%)";
    el.style.width = `${36 * scale}px`;
    el.style.height = `${18 * scale}px`;

    const body = document.createElement("div");
    body.className = "pond-fish-body";
    const spot = document.createElement("span");
    spot.className = "pond-fish-spot";
    spot.style.width = `${6 + Math.random() * 8}px`;
    spot.style.height = `${5 + Math.random() * 6}px`;
    spot.style.left = `${8 + Math.random() * 10}px`;
    spot.style.top = `${3 + Math.random() * 5}px`;
    body.appendChild(spot);
    el.appendChild(body);
    pondFishEl.appendChild(el);

    return {
      el,
      x: bounds.left + Math.random() * (bounds.right - bounds.left),
      y: bounds.top + Math.random() * (bounds.bottom - bounds.top),
      vx: (Math.random() * 0.55 + 0.2) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() - 0.5) * 0.3,
      turnTimer: 1 + Math.random() * 3,
      excited: 0,
    };
  }

  function updateHeldFoodUI() {
    if (heldFoodEl) heldFoodEl.textContent = String(heldFood);
  }

  function updatePondPrompt() {
    const distMachine = Math.hypot(player.x - MACHINE_POS.x, player.y - MACHINE_POS.y);
    nearMachine = distMachine < 110;

    const cx = POND_RECT.x + POND_RECT.w / 2;
    const cy = POND_RECT.y + POND_RECT.h / 2;
    const rx = POND_RECT.w * 0.5;
    const ry = POND_RECT.h * 0.5;
    const nx = (player.x - cx) / rx;
    const ny = (player.y - cy) / ry;
    const ellipse = Math.sqrt(nx * nx + ny * ny);
    nearPond = ellipse > 0.92 && ellipse < 1.22;

    feedMachine.classList.toggle("nearby", nearMachine);

    let text = "WASD / 조이스틱으로 걸어보세요";
    let actionLabel = "담기";
    let canAct = false;

    if (nearMachine) {
      if (heldFood >= MAX_HELD_FOOD) {
        text = "먹이 주머니가 가득 찼어요";
        actionLabel = "가득";
      } else {
        text = "자판기 근처 · 담기 / E / 자판기 터치";
        actionLabel = "담기";
        canAct = true;
      }
    } else if (nearPond && heldFood > 0) {
      text = "연못 가 · 먹이 주기 / E / 액션 버튼";
      actionLabel = "주기";
      canAct = true;
    } else if (heldFood > 0) {
      text = `먹이 ${heldFood}개 · 연못 가로 가서 주세요`;
      actionLabel = "주기";
    } else {
      text = "매점 자판기로 가서 먹이를 담으세요";
      actionLabel = "담기";
    }

    if (pondActionHint) pondActionHint.textContent = text;
    if (pondActionBtn) {
      pondActionBtn.textContent = actionLabel;
      pondActionBtn.disabled = !canAct;
    }
  }

  function pulseFoodBag() {
    if (!foodBagEl) return;
    foodBagEl.classList.remove("pulse");
    void foodBagEl.offsetWidth;
    foodBagEl.classList.add("pulse");
  }

  function collectFood() {
    if (!active || activity !== "ripple") return;
    if (!nearMachine) return;
    if (heldFood >= MAX_HELD_FOOD) return;
    const gain = Math.min(4, MAX_HELD_FOOD - heldFood);
    heldFood += gain;
    updateHeldFoodUI();
    pulseFoodBag();
    if (CloudAudio.playFeedCollect) CloudAudio.playFeedCollect();
    else CloudAudio.playFeed();
    if (feedDispenseFx) {
      feedDispenseFx.classList.remove("pop");
      void feedDispenseFx.offsetWidth;
      feedDispenseFx.classList.add("pop");
    }
    updatePondPrompt();
  }

  function spawnPondRipple(x, y, big = false) {
    const ripple = document.createElement("div");
    ripple.className = `pond-world-ripple${big ? " big" : ""}`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    pondRipplesEl.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }

  function throwFood() {
    if (!active || activity !== "ripple") return;
    if (!nearPond || heldFood <= 0) return;

    heldFood -= 1;
    updateHeldFoodUI();
    pulseFoodBag();
    CloudAudio.playFeed();

    const targetX = 50 + Math.random() * (POND_RECT.w - 100);
    const targetY = 50 + Math.random() * (POND_RECT.h - 100);
    const el = document.createElement("div");
    el.className = "pond-pellet";
    pondFoodEl.appendChild(el);

    const startX = Math.max(10, Math.min(POND_RECT.w - 10, player.x - POND_RECT.x));
    const startY = Math.max(-10, Math.min(POND_RECT.h + 20, player.y - POND_RECT.y));

    foods.push({
      el,
      x: startX,
      y: startY,
      tx: targetX,
      ty: targetY,
      life: 16 + Math.random() * 5,
      falling: true,
      splash: false,
      arc: 0,
    });

    fish.forEach((f) => {
      f.excited = 2 + Math.random();
      f.el.classList.add("excited");
    });

    if (window.GameBridge) {
      window.GameBridge.broadcastMungEvent("pond-feed", {
        sx: startX,
        sy: startY,
        tx: targetX,
        ty: targetY,
      });
    }

    updatePondPrompt();
  }

  function doPondAction() {
    if (nearMachine) collectFood();
    else if (nearPond && heldFood > 0) throwFood();
  }

  function updateCamera(dt = 0.016) {
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    let targetX = player.x - viewW / 2;
    let targetY = player.y - viewH / 2;
    targetX = Math.max(0, Math.min(Math.max(0, WORLD_W - viewW), targetX));
    targetY = Math.max(0, Math.min(Math.max(0, WORLD_H - viewH), targetY));
    if (WORLD_W < viewW) targetX = (WORLD_W - viewW) / 2;
    if (WORLD_H < viewH) targetY = (WORLD_H - viewH) / 2;

    const lerp = 1 - Math.exp(-8 * dt);
    cam.x += (targetX - cam.x) * lerp;
    cam.y += (targetY - cam.y) * lerp;
    const parallax = Math.sin(cam.x * 0.002) * 2;
    pondWorld.style.transform = `translate(${-cam.x}px, ${-cam.y + parallax * 0.15}px)`;
  }

  function isInPondWater(x, y) {
    const cx = POND_RECT.x + POND_RECT.w / 2;
    const cy = POND_RECT.y + POND_RECT.h / 2;
    const rx = POND_RECT.w * 0.48;
    const ry = POND_RECT.h * 0.48;
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    return nx * nx + ny * ny < 1;
  }

  function isInShop(x, y) {
    return x > SHOP_RECT.x
      && x < SHOP_RECT.x + SHOP_RECT.w
      && y > SHOP_RECT.y
      && y < SHOP_RECT.y + SHOP_RECT.h;
  }

  function isWalkBlocked(x, y) {
    return isInPondWater(x, y) || isInShop(x, y);
  }

  function softPushFromWater(x, y) {
    if (isInPondWater(x, y)) {
      const cx = POND_RECT.x + POND_RECT.w / 2;
      const cy = POND_RECT.y + POND_RECT.h / 2;
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return {
        x: cx + (dx / len) * (POND_RECT.w * 0.5),
        y: cy + (dy / len) * (POND_RECT.h * 0.5),
      };
    }
    if (isInShop(x, y)) {
      const cx = SHOP_RECT.x + SHOP_RECT.w / 2;
      const cy = SHOP_RECT.y + SHOP_RECT.h / 2;
      const dx = x - cx;
      const dy = y - cy;
      const absX = Math.abs(dx) / (SHOP_RECT.w * 0.5);
      const absY = Math.abs(dy) / (SHOP_RECT.h * 0.5);
      if (absX > absY) {
        return { x: cx + Math.sign(dx || 1) * (SHOP_RECT.w * 0.5 + 8), y };
      }
      return { x, y: cy + Math.sign(dy || 1) * (SHOP_RECT.h * 0.5 + 8) };
    }
    return { x, y };
  }

  function startPond() {
    stopPond(false);
    overlay.classList.add("pond-mode");
    pondLayer.classList.remove("hidden");
    pondLayer.hidden = false;
    pondLayer.setAttribute("aria-hidden", "false");

    const sceneName = document.getElementById("mung-scene-name");
    if (sceneName) sceneName.textContent = "부산 충렬사 · 의중지~매점";

    player = { x: 800, y: 860, facing: 1, vx: 0, vy: 0, angle: 0 };
    cam = { x: player.x - window.innerWidth / 2, y: player.y - window.innerHeight / 2 };
    heldFood = 0;
    footstepTimer = 0;
    updateHeldFoodUI();
    keys = { up: false, down: false, left: false, right: false };
    stickVec = { x: 0, y: 0 };
    stickActive = false;
    if (pondStickKnob) pondStickKnob.style.transform = "translate(0, 0)";
    if (pondPlayer) pondPlayer.classList.remove("walking");

    fish = Array.from({ length: 10 }, (_, i) => createFish(i));
    foods = [];
    lastPondTick = performance.now();
    updateCamera(1);
    updatePondPrompt();
    if (CloudAudio.startPondAmbient) CloudAudio.startPondAmbient();
    use3D = !!(window.Pond3D && Pond3D.isReady() && Pond3D.start());
    overlay.classList.toggle("pond-3d", use3D);
    if (use3D) syncPond3D(false);
    pondRaf = requestAnimationFrame(tickPond);
    broadcastPondMove(false);
  }

  function ensureRemotePlayer(id, name) {
    if (!pondRemotesEl) return null;
    let entry = remotePlayers.get(id);
    if (entry) {
      if (name && entry.nameEl) entry.nameEl.textContent = name;
      return entry;
    }
    const el = document.createElement("div");
    el.className = "pond-player remote";
    el.innerHTML = `
      <span class="pond-player-shadow"></span>
      <span class="pond-player-figure">
        <span class="pp-head"></span>
        <span class="pp-body"></span>
        <span class="pp-leg l"></span>
        <span class="pp-leg r"></span>
      </span>
      <span class="pond-player-name"></span>
    `;
    const nameEl = el.querySelector(".pond-player-name");
    nameEl.textContent = name || "친구";
    pondRemotesEl.appendChild(el);
    entry = { el, nameEl, x: 800, y: 860, facing: 1 };
    remotePlayers.set(id, entry);
    return entry;
  }

  function syncRemotePlayer(id, data) {
    const entry = ensureRemotePlayer(id, data.name);
    if (!entry) return;
    entry.x = data.x;
    entry.y = data.y;
    entry.facing = data.facing || 1;
    entry.el.style.left = `${entry.x}px`;
    entry.el.style.top = `${entry.y}px`;
    entry.el.style.transform = `scaleX(${entry.facing})`;
    entry.el.classList.toggle("walking", !!data.walking);
  }

  function clearRemotePlayers() {
    remotePlayers.clear();
    if (pondRemotesEl) pondRemotesEl.innerHTML = "";
  }

  function broadcastPondMove(walking) {
    if (!window.GameBridge) return;
    const now = performance.now();
    if (now - lastMoveBroadcast < 90) return;
    lastMoveBroadcast = now;
    window.GameBridge.broadcastMungEvent("pond-move", {
      x: player.x,
      y: player.y,
      facing: player.facing,
      walking: !!walking,
      name: window.Multiplayer?.getPlayerName?.() || "친구",
    });
  }

  function applyRemoteFeed(data) {
    const el = document.createElement("div");
    el.className = "pond-pellet";
    pondFoodEl.appendChild(el);
    foods.push({
      el,
      x: data.sx,
      y: data.sy,
      tx: data.tx,
      ty: data.ty,
      life: 16,
      falling: true,
      splash: false,
      arc: 0,
    });
    fish.forEach((f) => {
      f.excited = 2;
      f.el.classList.add("excited");
    });
  }

  function stopPond(clearMode = true) {
    if (pondRaf) cancelAnimationFrame(pondRaf);
    pondRaf = null;
    fish = [];
    foods = [];
    heldFood = 0;
    footstepTimer = 0;
    keys = { up: false, down: false, left: false, right: false };
    stickVec = { x: 0, y: 0 };
    stickActive = false;
    if (pondPlayer) pondPlayer.classList.remove("walking");
    if (pondFishEl) pondFishEl.innerHTML = "";
    if (pondFoodEl) pondFoodEl.innerHTML = "";
    if (pondRipplesEl) pondRipplesEl.innerHTML = "";
    clearRemotePlayers();
    if (window.GameBridge) window.GameBridge.broadcastMungEvent("pond-leave", {});
    if (pondLayer) {
      pondLayer.classList.add("hidden");
      pondLayer.hidden = true;
      pondLayer.setAttribute("aria-hidden", "true");
    }
    if (CloudAudio.stopPondAmbient) CloudAudio.stopPondAmbient();
    if (window.Pond3D) Pond3D.stop();
    use3D = false;
    overlay.classList.remove("pond-3d");
    if (clearMode) overlay.classList.remove("pond-mode");
  }

  function nearestFood(fishItem) {
    let best = null;
    let bestDist = Infinity;
    foods.forEach((food) => {
      if (food.life <= 0 || food.falling) return;
      const dx = food.x - fishItem.x;
      const dy = food.y - fishItem.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = food;
      }
    });
    return bestDist < 260 ? best : null;
  }

  function tickPond(now) {
    if (!active || activity !== "ripple") return;
    const dt = Math.min(0.05, (now - lastPondTick) / 1000 || 0.016);
    lastPondTick = now;

    let mx = 0;
    let my = 0;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    mx += stickVec.x;
    my += stickVec.y;

    if (use3D && window.Pond3D?.getOrbitYaw) {
      const yaw = Pond3D.getOrbitYaw();
      const sin = Math.sin(yaw);
      const cos = Math.cos(yaw);
      const forward = -my;
      const right = mx;
      mx = (-sin) * forward + cos * right;
      my = (-cos) * forward + (-sin) * right;
    }

    const mag = Math.hypot(mx, my);
    if (mag > 0.08) {
      const nx = mx / mag;
      const ny = my / mag;
      player.vx += nx * PLAYER_ACCEL * dt;
      player.vy += ny * PLAYER_ACCEL * dt;
      if (Math.abs(nx) > 0.15 || Math.abs(ny) > 0.15) {
        player.facing = nx < 0 ? -1 : 1;
        player.angle = Math.atan2(nx, ny);
      }
    } else {
      const damp = Math.exp(-PLAYER_FRICTION * dt / PLAYER_SPEED);
      player.vx *= damp;
      player.vy *= damp;
    }

    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER_SPEED) {
      player.vx = (player.vx / speed) * PLAYER_SPEED;
      player.vy = (player.vy / speed) * PLAYER_SPEED;
    }

    let nextX = player.x + player.vx * dt;
    let nextY = player.y + player.vy * dt;
    nextX = Math.max(WALK_BOUNDS.left, Math.min(WALK_BOUNDS.right, nextX));
    nextY = Math.max(WALK_BOUNDS.top, Math.min(WALK_BOUNDS.bottom, nextY));

    if (isWalkBlocked(nextX, nextY)) {
      if (!isWalkBlocked(nextX, player.y)) {
        nextY = player.y;
        player.vy *= 0.2;
      } else if (!isWalkBlocked(player.x, nextY)) {
        nextX = player.x;
        player.vx *= 0.2;
      } else {
        const pushed = softPushFromWater(nextX, nextY);
        nextX = pushed.x;
        nextY = pushed.y;
        player.vx *= 0.25;
        player.vy *= 0.25;
      }
    }

    player.x = nextX;
    player.y = nextY;

    const moving = Math.hypot(player.vx, player.vy) > 18;
    pondPlayer.classList.toggle("walking", moving);
    pondPlayer.style.left = `${player.x}px`;
    pondPlayer.style.top = `${player.y}px`;
    pondPlayer.style.transform = `scaleX(${player.facing})`;

    if (moving) {
      footstepTimer -= dt;
      if (footstepTimer <= 0) {
        footstepTimer = 0.34;
        if (CloudAudio.playFootstep) CloudAudio.playFootstep();
      }
      broadcastPondMove(true);
    } else {
      footstepTimer = 0;
      broadcastPondMove(false);
    }

    updateCamera(dt);
    updatePondPrompt();
    syncPond3D(moving);

    const bounds = pondInnerBounds();

    foods = foods.filter((food) => {
      if (food.falling) {
        food.arc += dt;
        const t = Math.min(1, food.arc * 2.2);
        food.x = food.x + (food.tx - food.x) * Math.min(1, dt * 3.2);
        food.y = food.y + (food.ty - food.y) * Math.min(1, dt * 2.6) - Math.sin(t * Math.PI) * 18 * dt * 8;
        if (Math.hypot(food.tx - food.x, food.ty - food.y) < 10) {
          food.x = food.tx;
          food.y = food.ty;
          food.falling = false;
          if (!food.splash) {
            food.splash = true;
            spawnPondRipple(food.tx, food.ty, true);
            spawnPondRipple(food.tx + 6, food.ty - 4, false);
            CloudAudio.playRipple();
          }
        }
      }
      food.life -= dt;
      food.el.style.left = `${food.x}px`;
      food.el.style.top = `${food.y}px`;
      food.el.style.opacity = String(Math.max(0, Math.min(1, food.life / 2)));
      if (food.life <= 0) {
        food.el.remove();
        return false;
      }
      return true;
    });

    fish.forEach((f) => {
      if (f.excited > 0) {
        f.excited -= dt;
        if (f.excited <= 0) f.el.classList.remove("excited");
      }

      const target = nearestFood(f);
      if (target) {
        const dx = target.x - f.x;
        const dy = target.y - f.y;
        const dist = Math.hypot(dx, dy) || 1;
        f.vx += (dx / dist) * (2.4 + f.excited) * dt;
        f.vy += (dy / dist) * (2.4 + f.excited) * dt;
        if (dist < 14) {
          target.life = 0;
          f.vx *= 0.3;
          f.vy *= 0.3;
          spawnPondRipple(f.x, f.y, false);
        }
      } else {
        f.turnTimer -= dt;
        if (f.turnTimer <= 0) {
          f.turnTimer = 1.2 + Math.random() * 2.6;
          f.vx += (Math.random() - 0.5) * 0.75;
          f.vy += (Math.random() - 0.5) * 0.5;
        }
      }

      const fSpeed = Math.hypot(f.vx, f.vy);
      const maxSpeed = target ? 110 : (f.excited > 0 ? 70 : 48);
      if (fSpeed > maxSpeed) {
        f.vx = (f.vx / fSpeed) * maxSpeed;
        f.vy = (f.vy / fSpeed) * maxSpeed;
      }

      f.x += f.vx * dt * 60;
      f.y += f.vy * dt * 60;

      if (f.x < bounds.left) {
        f.x = bounds.left;
        f.vx = Math.abs(f.vx);
      }
      if (f.x > bounds.right) {
        f.x = bounds.right;
        f.vx = -Math.abs(f.vx);
      }
      if (f.y < bounds.top) {
        f.y = bounds.top;
        f.vy = Math.abs(f.vy);
      }
      if (f.y > bounds.bottom) {
        f.y = bounds.bottom;
        f.vy = -Math.abs(f.vy);
      }

      f.el.style.left = `${f.x}px`;
      f.el.style.top = `${f.y}px`;
      f.el.style.transform = `translate(-50%, -50%) scaleX(${f.vx < 0 ? -1 : 1})`;
    });

    pondRaf = requestAnimationFrame(tickPond);
  }

  function fadeCanvas() {
    if (!active || activity !== "draw") return;
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    requestAnimationFrame(fadeCanvas);
  }

  function drawLine(x, y) {
    if (!lastPoint) {
      lastPoint = { x, y };
      return;
    }
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 3 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPoint = { x, y };
  }

  function onCanvasDown(event) {
    if (activity !== "draw") return;
    drawing = true;
    lastPoint = null;
    drawLine(event.clientX, event.clientY);
  }

  function onCanvasMove(event) {
    if (!drawing || activity !== "draw") return;
    drawLine(event.clientX, event.clientY);
  }

  function onCanvasUp() {
    drawing = false;
    lastPoint = null;
  }

  function getTouchPoint(event) {
    const t = event.touches[0] || event.changedTouches[0];
    return t ? { clientX: t.clientX, clientY: t.clientY } : null;
  }

  function setKeyFromCode(code, pressed) {
    if (code === "KeyW" || code === "ArrowUp") keys.up = pressed;
    if (code === "KeyS" || code === "ArrowDown") keys.down = pressed;
    if (code === "KeyA" || code === "ArrowLeft") keys.left = pressed;
    if (code === "KeyD" || code === "ArrowRight") keys.right = pressed;
  }

  function onKeyDown(event) {
    if (!active || activity !== "ripple") return;
    if (event.target.matches("input, textarea, select")) return;
    setKeyFromCode(event.code, true);
    if (event.code === "KeyE" || event.code === "Space") {
      event.preventDefault();
      doPondAction();
    }
  }

  function onKeyUp(event) {
    setKeyFromCode(event.code, false);
  }

  function updateStickFromPoint(clientX, clientY) {
    const rect = pondStick.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const max = rect.width * 0.34;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > max) {
      dx = (dx / dist) * max;
      dy = (dy / dist) * max;
    }
    stickVec.x = dx / max;
    stickVec.y = dy / max;
    pondStickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function resetStick() {
    stickActive = false;
    stickVec = { x: 0, y: 0 };
    if (pondStickKnob) pondStickKnob.style.transform = "translate(0, 0)";
  }

  function start() {
    active = true;
    myBubblePops = 0;
    updateBubbleUI();
    setActivity("ripple");
    resizeCanvas();
    requestAnimationFrame(fadeCanvas);
    if (window.Multiplayer) Multiplayer.onMungEnter();
  }

  function stop() {
    active = false;
    overlay.classList.remove("listen-mode", "pond-mode");
    stopBubbles();
    stopPond();
    showBubbleStats(false);
    ripplesEl.innerHTML = "";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.remove("active");
    breathCircle.classList.add("hidden");
    if (window.Multiplayer) Multiplayer.onMungLeave();
  }

  function handleRemoteEvent(type, data) {
    if (type === "ripple") createRipple(data.x, data.y, true);
    if (type === "bubble-pop" && window.Multiplayer) {
      Multiplayer.setPlayerBubblePops(data.playerId, data.total);
    }
    if (type === "pond-move" && data.playerId) {
      if (activity === "ripple") syncRemotePlayer(data.playerId, data);
    }
    if (type === "pond-feed" && activity === "ripple") {
      applyRemoteFeed(data);
    }
    if (type === "pond-leave" && data.playerId) {
      const entry = remotePlayers.get(data.playerId);
      if (entry) {
        entry.el.remove();
        remotePlayers.delete(data.playerId);
      }
    }
  }

  function getBubblePops() {
    return myBubblePops;
  }

  bubbleStatsToggle?.addEventListener("click", () => {
    bubbleStatsPanel.classList.toggle("collapsed");
  });

  if (exitListenBtn) {
    exitListenBtn.addEventListener("click", () => setActivity("cloud"));
  }

  document.querySelectorAll(".mung-activity").forEach((btn) => {
    btn.addEventListener("click", () => setActivity(btn.dataset.activity));
  });

  feedMachine.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (nearMachine) collectFood();
    else {
      pondActionHint.textContent = "자판기 가까이 가서 먹이를 담으세요";
    }
  });

  pondActionBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    doPondAction();
  });

  pondStick.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stickActive = true;
    pondStick.setPointerCapture(event.pointerId);
    updateStickFromPoint(event.clientX, event.clientY);
  });
  pondStick.addEventListener("pointermove", (event) => {
    if (!stickActive) return;
    updateStickFromPoint(event.clientX, event.clientY);
  });
  pondStick.addEventListener("pointerup", resetStick);
  pondStick.addEventListener("pointercancel", resetStick);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  canvas.addEventListener("mousedown", onCanvasDown);
  canvas.addEventListener("mousemove", onCanvasMove);
  window.addEventListener("mouseup", onCanvasUp);
  canvas.addEventListener("touchstart", (e) => {
    const point = getTouchPoint(e);
    if (!point) return;
    e.preventDefault();
    onCanvasDown(point);
  }, { passive: false });
  canvas.addEventListener("touchmove", (e) => {
    const point = getTouchPoint(e);
    if (!point) return;
    e.preventDefault();
    onCanvasMove(point);
  }, { passive: false });
  window.addEventListener("touchend", onCanvasUp);
  window.addEventListener("resize", () => {
    if (active && activity === "draw") resizeCanvas();
    if (active && activity === "ripple") {
      updateCamera(1);
      if (window.Pond3D) Pond3D.resize();
    }
  });

  return {
    start,
    stop,
    setActivity,
    toggleListen,
    handleRemoteEvent,
    getActivity: () => activity,
    getBubblePops,
  };
})();

window.MungPlay = MungPlay;
