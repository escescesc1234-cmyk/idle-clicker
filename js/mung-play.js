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

  const FISH_KINDS = ["🐟", "🐠", "🐡", "🐟", "🐠"];

  const overlay = document.getElementById("mung-overlay");
  const center = document.getElementById("mung-center");
  const cloudBtn = document.getElementById("mung-cloud-btn");
  const hint = document.getElementById("mung-hint");
  const ripplesEl = document.getElementById("mung-ripples");
  const bubblesEl = document.getElementById("mung-bubbles");
  const canvas = document.getElementById("mung-draw-canvas");
  const breathCircle = document.getElementById("breath-circle");
  const pondLayer = document.getElementById("pond-layer");
  const pondFishEl = document.getElementById("pond-fish");
  const pondFoodEl = document.getElementById("pond-food");
  const feedMachine = document.getElementById("feed-machine");
  const ctx = canvas.getContext("2d");

  const bubbleStatsPanel = document.getElementById("bubble-stats");
  const bubbleStatsToggle = document.getElementById("bubble-stats-toggle");
  const bubbleStatsBadge = document.getElementById("bubble-stats-badge");
  const myBubbleCountEl = document.getElementById("my-bubble-count");
  const exitListenBtn = document.getElementById("mung-exit-listen");

  const hints = {
    listen: "배경과 소리만 감상해요. 「감상 끝내기」로 나와요",
    cloud: "천천히 눌러도 괜찮아요",
    ripple: "화면을 눌러 물결을 만들고, 자판기로 물고기에게 먹이를 주세요",
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
    const prev = activity;
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
    else if (prev === "ripple") stopPond();

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

  function pondBounds() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    return {
      left: w * 0.06,
      right: w * 0.94,
      top: h * 0.28,
      bottom: h * 0.82,
    };
  }

  function createFish(index) {
    const bounds = pondBounds();
    const el = document.createElement("div");
    el.className = "pond-fish";
    el.textContent = FISH_KINDS[index % FISH_KINDS.length];
    const size = 22 + Math.random() * 18;
    el.style.fontSize = `${size}px`;
    pondFishEl.appendChild(el);

    const x = bounds.left + Math.random() * (bounds.right - bounds.left);
    const y = bounds.top + Math.random() * (bounds.bottom - bounds.top);
    return {
      el,
      x,
      y,
      vx: (Math.random() * 0.6 + 0.25) * (Math.random() < 0.5 ? -1 : 1),
      vy: (Math.random() - 0.5) * 0.35,
      size,
      turnTimer: 1 + Math.random() * 3,
      targetFood: null,
    };
  }

  function startPond() {
    stopPond();
    pondLayer.classList.remove("hidden");
    pondLayer.setAttribute("aria-hidden", "false");
    feedMachine.classList.remove("hidden");

    fish = Array.from({ length: 7 }, (_, i) => createFish(i));
    foods = [];
    lastPondTick = performance.now();
    pondRaf = requestAnimationFrame(tickPond);
  }

  function stopPond() {
    if (pondRaf) cancelAnimationFrame(pondRaf);
    pondRaf = null;
    fish = [];
    foods = [];
    pondFishEl.innerHTML = "";
    pondFoodEl.innerHTML = "";
    pondLayer.classList.add("hidden");
    pondLayer.setAttribute("aria-hidden", "true");
    feedMachine.classList.add("hidden");
  }

  function dispenseFood() {
    if (!active || activity !== "ripple") return;
    const bounds = pondBounds();
    const count = 3 + Math.floor(Math.random() * 3);
    CloudAudio.playFeed();

    for (let i = 0; i < count; i += 1) {
      const el = document.createElement("div");
      el.className = "pond-pellet";
      pondFoodEl.appendChild(el);
      const startX = Math.min(window.innerWidth - 40, Math.max(40, feedMachine.getBoundingClientRect().left + 20));
      const x = bounds.left + 40 + Math.random() * (bounds.right - bounds.left - 80);
      const y = bounds.top + 20 + Math.random() * 40;
      foods.push({
        el,
        x: startX + (Math.random() - 0.5) * 30,
        y: 70 + Math.random() * 20,
        tx: x,
        ty: y + Math.random() * (bounds.bottom - bounds.top) * 0.45,
        life: 12 + Math.random() * 6,
        falling: true,
      });
    }
  }

  function nearestFood(fishItem) {
    let best = null;
    let bestDist = Infinity;
    foods.forEach((food) => {
      if (food.life <= 0) return;
      const dx = food.x - fishItem.x;
      const dy = food.y - fishItem.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = food;
      }
    });
    return bestDist < 280 ? best : null;
  }

  function tickPond(now) {
    if (!active || activity !== "ripple") return;
    const dt = Math.min(0.05, (now - lastPondTick) / 1000 || 0.016);
    lastPondTick = now;
    const bounds = pondBounds();

    foods = foods.filter((food) => {
      if (food.falling) {
        food.x += (food.tx - food.x) * Math.min(1, dt * 2.2);
        food.y += (food.ty - food.y) * Math.min(1, dt * 2.8);
        if (Math.hypot(food.tx - food.x, food.ty - food.y) < 8) food.falling = false;
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
      const target = nearestFood(f);
      f.targetFood = target;

      if (target) {
        const dx = target.x - f.x;
        const dy = target.y - f.y;
        const dist = Math.hypot(dx, dy) || 1;
        f.vx += (dx / dist) * 1.8 * dt;
        f.vy += (dy / dist) * 1.8 * dt;
        if (dist < 18) {
          target.life = 0;
          f.vx *= 0.4;
          f.vy *= 0.4;
        }
      } else {
        f.turnTimer -= dt;
        if (f.turnTimer <= 0) {
          f.turnTimer = 1.5 + Math.random() * 3;
          f.vx += (Math.random() - 0.5) * 0.8;
          f.vy += (Math.random() - 0.5) * 0.5;
        }
      }

      const speed = Math.hypot(f.vx, f.vy);
      const maxSpeed = target ? 95 : 55;
      if (speed > maxSpeed) {
        f.vx = (f.vx / speed) * maxSpeed;
        f.vy = (f.vy / speed) * maxSpeed;
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

      const facingLeft = f.vx < 0;
      f.el.style.transform = `translate(-50%, -50%) scaleX(${facingLeft ? -1 : 1})`;
      f.el.style.left = `${f.x}px`;
      f.el.style.top = `${f.y}px`;
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

  function onOverlayPointer(event) {
    if (!active) return;
    if (activity !== "ripple") return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target.closest("button, .mung-ui, .mung-players, .mung-side-panel, .feed-machine")) return;
    createRipple(event.clientX, event.clientY);
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

  function start() {
    active = true;
    myBubblePops = 0;
    updateBubbleUI();
    setActivity("cloud");
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
  }

  function getBubblePops() {
    return myBubblePops;
  }

  bubbleStatsToggle.addEventListener("click", () => {
    bubbleStatsPanel.classList.toggle("collapsed");
  });

  if (exitListenBtn) {
    exitListenBtn.addEventListener("click", () => setActivity("cloud"));
  }

  feedMachine.addEventListener("click", (event) => {
    event.stopPropagation();
    dispenseFood();
  });

  document.querySelectorAll(".mung-activity").forEach((btn) => {
    btn.addEventListener("click", () => setActivity(btn.dataset.activity));
  });

  overlay.addEventListener("pointerdown", onOverlayPointer);
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
