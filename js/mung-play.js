const MungPlay = (() => {
  let active = false;
  let activity = "cloud";
  let bubbleTimer = null;
  let drawing = false;
  let lastPoint = null;
  let myBubblePops = 0;

  const overlay = document.getElementById("mung-overlay");
  const center = document.getElementById("mung-center");
  const cloudBtn = document.getElementById("mung-cloud-btn");
  const hint = document.getElementById("mung-hint");
  const ripplesEl = document.getElementById("mung-ripples");
  const bubblesEl = document.getElementById("mung-bubbles");
  const canvas = document.getElementById("mung-draw-canvas");
  const breathCircle = document.getElementById("breath-circle");
  const ctx = canvas.getContext("2d");

  const bubbleStatsPanel = document.getElementById("bubble-stats");
  const bubbleStatsToggle = document.getElementById("bubble-stats-toggle");
  const bubbleStatsBadge = document.getElementById("bubble-stats-badge");
  const myBubbleCountEl = document.getElementById("my-bubble-count");

  const hints = {
    listen: "배경과 소리만 감상해요. V 키로도 전환할 수 있어요",
    cloud: "천천히 눌러도 괜찮아요",
    ripple: "화면 아무 곳이나 눌러 물결을 만들어요",
    bubble: "떠오르는 거품을 톡톡 터뜨려요",
    draw: "마우스로 천천히 그려보세요. 사라져도 괜찮아요",
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

    overlay.classList.toggle("listen-mode", isListen);
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
    bubble.addEventListener("click", (event) => {
      event.stopPropagation();
      bubble.classList.add("pop");
      CloudAudio.playSoftPop();
      onBubblePop();
      window.setTimeout(() => bubble.remove(), 300);
    });
    bubblesEl.appendChild(bubble);
    bubble.addEventListener("animationend", () => bubble.remove());
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

  function onOverlayClick(event) {
    if (!active) return;
    if (activity !== "ripple") return;
    if (event.target.closest("button, .mung-ui, .mung-players, .mung-side-panel")) return;
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
    overlay.classList.remove("listen-mode");
    stopBubbles();
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

  document.querySelectorAll(".mung-activity").forEach((btn) => {
    btn.addEventListener("click", () => setActivity(btn.dataset.activity));
  });

  overlay.addEventListener("click", onOverlayClick);
  canvas.addEventListener("mousedown", onCanvasDown);
  canvas.addEventListener("mousemove", onCanvasMove);
  window.addEventListener("mouseup", onCanvasUp);
  canvas.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    onCanvasDown({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: true });
  canvas.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    onCanvasMove({ clientX: t.clientX, clientY: t.clientY });
  }, { passive: true });
  window.addEventListener("touchend", onCanvasUp);
  window.addEventListener("resize", () => {
    if (active && activity === "draw") resizeCanvas();
  });

  return {
    start,
    stop,
    setActivity,
    handleRemoteEvent,
    getActivity: () => activity,
    getBubblePops,
  };
})();

window.MungPlay = MungPlay;
