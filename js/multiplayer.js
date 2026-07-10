const Multiplayer = (() => {
  const PEER_PREFIX = "cloudmung-";
  const SYNC_MS = 2500;
  const MAX_CHAT_MESSAGES = 80;
  const JOIN_MAX_ATTEMPTS = 10;
  const JOIN_RETRY_MS = 2000;

  const PEER_OPTIONS = {
    host: "0.peerjs.com",
    port: 443,
    path: "/",
    secure: true,
    debug: 1,
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
    },
  };

  let peer = null;
  let conn = null;
  let connections = [];
  let isHost = false;
  let roomCode = null;
  let playerId = null;
  let playerName = "멍멍이";
  let syncTimer = null;
  let joinRetryTimer = null;
  let joinAttempt = 0;
  let players = {};
  let chatMessages = [];
  let localIps = [];

  const roomBtn = document.getElementById("room-btn");
  const roomModal = document.getElementById("room-modal");
  const roomClose = document.getElementById("room-close");
  const playerNameInput = document.getElementById("player-name");
  const createRoomBtn = document.getElementById("create-room");
  const joinRoomBtn = document.getElementById("join-room");
  const roomCodeInput = document.getElementById("room-code-input");
  const roomInfo = document.getElementById("room-info");
  const roomCodeDisplay = document.getElementById("room-code-display");
  const roomStatus = document.getElementById("room-status");
  const playersList = document.getElementById("players-list");
  const copyLinkBtn = document.getElementById("copy-room-link");
  const copyCodeBtn = document.getElementById("copy-room-code");
  const shareWarning = document.getElementById("share-warning");
  const hostNotice = document.getElementById("host-notice");
  const lanLinkHint = document.getElementById("lan-link-hint");
  const mungPlayersEl = document.getElementById("mung-players");

  const mungChat = document.getElementById("mung-chat");
  const mungChatToggle = document.getElementById("mung-chat-toggle");
  const mungChatMessages = document.getElementById("mung-chat-messages");
  const mungChatForm = document.getElementById("mung-chat-form");
  const mungChatInput = document.getElementById("mung-chat-input");
  const roomBubbleStats = document.getElementById("room-bubble-stats");

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function setStatus(msg) {
    roomStatus.textContent = msg;
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function createPeer(id) {
    return new Peer(id, PEER_OPTIONS);
  }

  function peerErrorMessage(err) {
    const type = err?.type || err?.message || "unknown";
    const map = {
      "peer-unavailable": "방을 찾을 수 없어요. 방장이 방을 만들고 창을 켜 뒀는지 확인해주세요.",
      unavailable: "방을 찾을 수 없어요. 방장이 방을 만들고 창을 켜 뒀는지 확인해주세요.",
      "unavailable-id": "방 코드가 이미 사용 중이에요. 다시 만들어주세요.",
      network: "네트워크 오류예요. 인터넷 연결을 확인해주세요.",
      "server-error": "연결 서버 오류예요. 잠시 후 다시 시도해주세요.",
      "browser-incompatible": "이 브라우저는 같이 멍하기를 지원하지 않아요. Chrome/Edge를 써보세요.",
    };
    return map[type] || `연결 오류: ${type}`;
  }

  async function detectLocalIps() {
    if (localIps.length > 0) return localIps;
    if (!window.RTCPeerConnection) return [];

    return new Promise((resolve) => {
      const ips = new Set();
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel("ip");
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => resolve([]));

      pc.onicecandidate = (event) => {
        if (!event.candidate) {
          pc.close();
          localIps = [...ips];
          resolve(localIps);
          return;
        }
        const match = event.candidate.candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})/);
        if (match && !match[1].startsWith("127.")) ips.add(match[1]);
      };

      window.setTimeout(() => {
        try { pc.close(); } catch { /* noop */ }
        localIps = [...ips];
        resolve(localIps);
      }, 1200);
    });
  }

  function buildInviteLink(hostname) {
    const url = new URL(window.location.href);
    url.hostname = hostname;
    url.port = window.location.port;
    url.searchParams.set("room", roomCode);
    return url.toString();
  }

  async function updateShareHints() {
    if (!roomCode) return;

    const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    await detectLocalIps();

    if (isHost) hostNotice.classList.remove("hidden");
    else hostNotice.classList.add("hidden");

    if (isLocalhost) {
      shareWarning.classList.remove("hidden", "ok");
      shareWarning.innerHTML = [
        "<strong>localhost 링크는 친구 PC에서 안 열려요.</strong>",
        "같은 와이파이면 아래 LAN 주소를 보내거나,",
        "방 코드만 보내서 친구가 직접 입력하게 하세요.",
      ].join("<br>");
    } else {
      shareWarning.classList.remove("hidden");
      shareWarning.classList.add("ok");
      shareWarning.textContent = "이 주소는 친구도 접속할 수 있어요. 초대 링크를 보내세요.";
    }

    const hints = [];
    if (isLocalhost && localIps.length > 0) {
      localIps.forEach((ip) => {
        hints.push(`같은 와이파이: ${buildInviteLink(ip)}`);
      });
    }
    hints.push(`방 코드만 보내기: ${roomCode} (친구도 같은 게임 주소에서 참가)`);
    lanLinkHint.innerHTML = hints.map((h) => escapeHtml(h)).join("<br>");
  }

  function getPlayerSnapshot() {
    const bridge = window.GameBridge;
    const bubblePops = window.MungPlay ? MungPlay.getBubblePops() : 0;
    if (!bridge) {
      return {
        id: playerId,
        name: playerName,
        clouds: 0,
        perSecond: 0,
        inMung: false,
        activity: "cloud",
        bubblePops,
      };
    }
    const s = bridge.getSnapshot();
    return {
      id: playerId,
      name: playerName,
      clouds: s.clouds,
      perSecond: s.perSecond,
      inMung: s.inMung,
      activity: s.mungActivity,
      bubblePops: s.mungActivity === "bubble" ? bubblePops : (players[playerId]?.bubblePops || 0),
    };
  }

  function renderPlayers() {
    const list = Object.values(players);
    playersList.innerHTML = list.map((p) => `
      <li>
        <span class="player-dot ${p.inMung ? "munging" : ""}"></span>
        ${escapeHtml(p.name)} · ${formatClouds(p.clouds)}
        ${p.inMung ? `<em>(${activityLabel(p.activity)} 멍 중)</em>` : ""}
      </li>
    `).join("");

    mungPlayersEl.innerHTML = list
      .filter((p) => p.id !== playerId)
      .map((p) => `
        <div class="mung-player-card ${p.inMung ? "active" : ""}">
          <span class="player-dot ${p.inMung ? "munging" : ""}"></span>
          <strong>${escapeHtml(p.name)}</strong>
          <span>${formatClouds(p.clouds)}</span>
          ${p.inMung ? `<small>${activityLabel(p.activity)}</small>` : ""}
        </div>
      `).join("");

    updateBubbleStats();
  }

  function updateBubbleStats() {
    if (!roomBubbleStats) return;
    const others = Object.values(players).filter((p) => p.id !== playerId && p.inMung && p.activity === "bubble");
    if (!roomCode || others.length === 0) {
      roomBubbleStats.innerHTML = "";
      return;
    }
    roomBubbleStats.innerHTML = others.map((p) => `
      <div class="room-bubble-row">
        <span>${escapeHtml(p.name)}</span>
        <span>${p.bubblePops || 0}</span>
      </div>
    `).join("");
  }

  function setPlayerBubblePops(id, total) {
    if (!players[id]) return;
    players[id].bubblePops = total;
    updateBubbleStats();
  }

  function formatClouds(n) {
    if (n < 1000) return `${Math.floor(n)} 구름`;
    if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
    return `${(n / 1_000_000).toFixed(1)}M`;
  }

  function activityLabel(a) {
    const map = { cloud: "구름", ripple: "물결", bubble: "거품", draw: "낙서", breath: "호흡" };
    return map[a] || "멍";
  }

  function broadcast(data) {
    if (isHost) {
      connections.forEach((c) => {
        if (c.open) c.send(data);
      });
    } else if (conn && conn.open) {
      conn.send(data);
    }
  }

  function relayFromHost(data, fromConn) {
    if (!isHost) return;
    connections.forEach((c) => {
      if (c.open && c !== fromConn) c.send(data);
    });
  }

  function renderChat() {
    mungChatMessages.innerHTML = chatMessages.map((msg) => {
      if (msg.system) {
        return `<div class="mung-chat-msg system">${escapeHtml(msg.text)}</div>`;
      }
      return `<div class="mung-chat-msg"><strong>${escapeHtml(msg.name)}</strong>${escapeHtml(msg.text)}</div>`;
    }).join("");
    mungChatMessages.scrollTop = mungChatMessages.scrollHeight;
  }

  function appendChatMessage(msg) {
    chatMessages.push(msg);
    if (chatMessages.length > MAX_CHAT_MESSAGES) {
      chatMessages = chatMessages.slice(-MAX_CHAT_MESSAGES);
    }
    renderChat();
  }

  function addSystemChat(text) {
    appendChatMessage({ system: true, text });
  }

  function sendChat(text) {
    if (!roomCode) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const msg = {
      type: "chat",
      playerId,
      name: playerName,
      text: trimmed,
      time: Date.now(),
    };

    appendChatMessage({ name: playerName, text: trimmed });
    broadcast(msg);
  }

  function handleMessage(data, fromConn) {
    if (data.type === "sync") {
      players[data.player.id] = { ...players[data.player.id], ...data.player };
      renderPlayers();
      return;
    }
    if (data.type === "roster" && !isHost) {
      players = data.players;
      renderPlayers();
      return;
    }
    if (data.type === "chat") {
      if (data.system) {
        appendChatMessage({ system: true, text: data.text });
      } else if (data.playerId !== playerId) {
        appendChatMessage({ name: data.name, text: data.text });
      }
      relayFromHost(data, fromConn);
      return;
    }
    if (data.type === "mung-event" && data.playerId !== playerId) {
      if (window.MungPlay) {
        MungPlay.handleRemoteEvent(data.eventType, { ...data.payload, playerId: data.playerId });
      }
      if (data.eventType === "bubble-pop") {
        setPlayerBubblePops(data.playerId, data.payload.total);
      }
      relayFromHost(data, fromConn);
      return;
    }
    if (data.type === "join" && isHost) {
      players[data.player.id] = data.player;
      broadcastRoster();
      const joinMsg = {
        type: "chat",
        playerId: "system",
        system: true,
        text: `${data.player.name}님이 들어왔어요.`,
        time: Date.now(),
      };
      addSystemChat(`${data.player.name}님이 들어왔어요.`);
      connections.forEach((c) => {
        if (c.open && c !== fromConn) c.send(joinMsg);
      });
      setStatus(`${data.player.name}님이 들어왔어요!`);
      return;
    }
  }

  function broadcastRoster() {
    if (!isHost) return;
    const payload = { type: "roster", players };
    connections.forEach((c) => { if (c.open) c.send(payload); });
    renderPlayers();
  }

  function sendSync() {
    const player = getPlayerSnapshot();
    players[player.id] = { ...players[player.id], ...player };
    broadcast({ type: "sync", player });
    if (isHost) broadcastRoster();
    else renderPlayers();
  }

  function setupConnection(connection) {
    connection.on("data", (data) => handleMessage(data, connection));
    connection.on("close", () => {
      connections = connections.filter((c) => c !== connection);
      if (isHost) broadcastRoster();
    });
  }

  function startSyncLoop() {
    if (syncTimer) window.clearInterval(syncTimer);
    syncTimer = window.setInterval(sendSync, SYNC_MS);
    sendSync();
  }

  function stopSync() {
    if (syncTimer) window.clearInterval(syncTimer);
    syncTimer = null;
  }

  function clearJoinRetry() {
    if (joinRetryTimer) window.clearTimeout(joinRetryTimer);
    joinRetryTimer = null;
    joinAttempt = 0;
  }

  function updateMungChatVisibility() {
    const inMung = window.GameBridge?.getSnapshot().inMung;
    const show = !!roomCode && inMung;
    mungChat.classList.toggle("hidden", !show);
    if (!show) mungChat.classList.add("collapsed");
  }

  function onMungEnter() {
    updateMungChatVisibility();
    if (roomCode) addSystemChat("같은 방 사람들과 멍 채팅을 할 수 있어요.");
  }

  function onMungLeave() {
    mungChat.classList.add("hidden", "collapsed");
  }

  function cleanup() {
    stopSync();
    clearJoinRetry();
    connections.forEach((c) => { try { c.close(); } catch { /* noop */ } });
    connections = [];
    if (conn) { try { conn.close(); } catch { /* noop */ } conn = null; }
    if (peer) { try { peer.destroy(); } catch { /* noop */ } peer = null; }
    isHost = false;
    roomCode = null;
    players = {};
    chatMessages = [];
    roomInfo.classList.add("hidden");
    hostNotice.classList.add("hidden");
    shareWarning.classList.add("hidden");
    shareWarning.classList.remove("ok");
    lanLinkHint.textContent = "";
    roomBtn.classList.remove("connected");
    roomBtn.textContent = "👥 같이 멍";
    mungPlayersEl.innerHTML = "";
    playersList.innerHTML = "";
    mungChat.classList.add("hidden", "collapsed");
    mungChatMessages.innerHTML = "";
    roomBubbleStats.innerHTML = "";
  }

  function openModal() {
    roomModal.classList.remove("hidden");
    roomModal.setAttribute("aria-hidden", "false");
    const saved = localStorage.getItem("cloud-mung-name");
    if (saved) playerNameInput.value = saved;
  }

  function closeModal() {
    roomModal.classList.add("hidden");
    roomModal.setAttribute("aria-hidden", "true");
  }

  function getInviteLink() {
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    return url.toString();
  }

  function onRoomReady(code) {
    roomCode = code;
    roomInfo.classList.remove("hidden");
    roomCodeDisplay.textContent = code;
    roomBtn.classList.add("connected");
    roomBtn.textContent = `👥 ${code}`;
    setStatus(isHost
      ? `방 ${code} 생성됨! 친구가 참가할 때까지 이 창을 켜 두세요.`
      : `방 ${code}에 참가했어요!`);
    chatMessages = [];
    addSystemChat(`방 ${code}에 연결됐어요.`);
    startSyncLoop();
    updateMungChatVisibility();
    updateShareHints();
    const url = new URL(window.location.href);
    url.searchParams.set("room", code);
    window.history.replaceState({}, "", url);
  }

  function connectToHost(code) {
    const targetId = `${PEER_PREFIX}${code}`;
    if (conn) {
      try { conn.close(); } catch { /* noop */ }
      conn = null;
    }

    joinAttempt += 1;
    setStatus(`방 연결 중… (${joinAttempt}/${JOIN_MAX_ATTEMPTS})`);

    conn = peer.connect(targetId, { reliable: true });
    setupConnection(conn);

    const failTimer = window.setTimeout(() => {
      if (!conn || conn.open) return;
      try { conn.close(); } catch { /* noop */ }
      conn = null;
      if (joinAttempt < JOIN_MAX_ATTEMPTS) {
        joinRetryTimer = window.setTimeout(() => connectToHost(code), JOIN_RETRY_MS);
      } else {
        setStatus("방을 찾을 수 없어요. 방장이 방을 만들고 창을 켜 뒀는지, 방 코드가 맞는지 확인해주세요.");
      }
    }, 3500);

    conn.on("open", () => {
      window.clearTimeout(failTimer);
      clearJoinRetry();
      onRoomReady(code);
      conn.send({ type: "join", player: getPlayerSnapshot() });
    });

    conn.on("error", () => {
      window.clearTimeout(failTimer);
      if (joinAttempt < JOIN_MAX_ATTEMPTS) {
        joinRetryTimer = window.setTimeout(() => connectToHost(code), JOIN_RETRY_MS);
      }
    });
  }

  function createRoom() {
    cleanup();
    playerName = playerNameInput.value.trim() || "멍멍이";
    localStorage.setItem("cloud-mung-name", playerName);
    playerId = `p-${Math.random().toString(36).slice(2, 9)}`;
    const code = randomCode();
    isHost = true;

    setStatus("방 만드는 중…");
    peer = createPeer(`${PEER_PREFIX}${code}`);

    peer.on("open", () => {
      players[playerId] = getPlayerSnapshot();
      onRoomReady(code);
    });

    peer.on("connection", (connection) => {
      connections.push(connection);
      setupConnection(connection);
      connection.on("open", () => {
        connection.send({ type: "roster", players });
      });
    });

    peer.on("error", (err) => {
      if (err.type === "unavailable-id") {
        createRoom();
        return;
      }
      setStatus(peerErrorMessage(err));
    });
  }

  function joinRoom(code) {
    cleanup();
    playerName = playerNameInput.value.trim() || "멍멍이";
    localStorage.setItem("cloud-mung-name", playerName);
    playerId = `p-${Math.random().toString(36).slice(2, 9)}`;
    const normalized = (code || "").trim().toUpperCase();
    if (normalized.length < 4) {
      setStatus("방 코드를 입력해주세요.");
      return;
    }

    isHost = false;
    clearJoinRetry();
    setStatus("연결 준비 중…");

    peer = createPeer();

    peer.on("open", () => {
      connectToHost(normalized);
    });

    peer.on("error", (err) => {
      setStatus(peerErrorMessage(err));
    });
  }

  function broadcastMungEvent(eventType, payload) {
    if (!roomCode) return;
    broadcast({ type: "mung-event", playerId, eventType, payload });
  }

  function copyText(text, successMsg) {
    navigator.clipboard.writeText(text).then(() => {
      setStatus(successMsg);
    }).catch(() => {
      prompt("복사해서 보내세요:", text);
    });
  }

  function copyInviteLink() {
    if (!roomCode) return;
    copyText(getInviteLink(), "초대 링크가 복사됐어요!");
  }

  function copyRoomCode() {
    if (!roomCode) return;
    copyText(roomCode, "방 코드가 복사됐어요! 친구에게 보내세요.");
  }

  function tryAutoJoin() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("room");
    if (!code) return;
    openModal();
    roomCodeInput.value = code.toUpperCase();
    const saved = localStorage.getItem("cloud-mung-name");
    if (saved) playerNameInput.value = saved;
    window.setTimeout(() => joinRoom(code), 800);
  }

  roomBtn.addEventListener("click", openModal);
  roomClose.addEventListener("click", closeModal);
  createRoomBtn.addEventListener("click", createRoom);
  joinRoomBtn.addEventListener("click", () => joinRoom(roomCodeInput.value));
  copyLinkBtn.addEventListener("click", copyInviteLink);
  copyCodeBtn.addEventListener("click", copyRoomCode);
  roomModal.addEventListener("click", (e) => {
    if (e.target === roomModal) closeModal();
  });

  mungChatToggle.addEventListener("click", () => {
    mungChat.classList.toggle("collapsed");
  });

  mungChatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    sendChat(mungChatInput.value);
    mungChatInput.value = "";
  });

  window.addEventListener("beforeunload", cleanup);

  return {
    broadcastMungEvent,
    tryAutoJoin,
    isConnected: () => !!roomCode,
    onMungEnter,
    onMungLeave,
    updateBubbleStats,
    setPlayerBubblePops,
  };
})();

window.Multiplayer = Multiplayer;
