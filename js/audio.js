const CloudAudio = (() => {
  let ctx = null;
  let bgmNodes = null;
  let mungBgmNodes = null;
  let bgmEnabled = false;
  let mungBgmEnabled = false;
  let mungBgmVolume = 0.7;
  const MUNG_BGM_MAX_VOLUME = 0.12;
  let sfxEnabled = true;
  let mainBgmWasOn = false;

  function getContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    return ctx;
  }

  function playCloudPuff() {
    if (!sfxEnabled) return;

    const audio = getContext();
    const now = audio.currentTime;

    const bufferSize = audio.sampleRate * 0.12;
    const buffer = audio.createBuffer(1, bufferSize, audio.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const source = audio.createBufferSource();
    source.buffer = buffer;

    const filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(520 + Math.random() * 180, now);
    filter.Q.value = 0.6;

    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.22 + Math.random() * 0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    const tone = audio.createOscillator();
    tone.type = "sine";
    tone.frequency.setValueAtTime(180 + Math.random() * 60, now);
    tone.frequency.exponentialRampToValueAtTime(90, now + 0.1);

    const toneGain = audio.createGain();
    toneGain.gain.setValueAtTime(0.06, now);
    toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(audio.destination);

    tone.connect(toneGain);
    toneGain.connect(audio.destination);

    source.start(now);
    source.stop(now + 0.15);
    tone.start(now);
    tone.stop(now + 0.13);
  }

  function playSoftPop() {
    if (!sfxEnabled) return;
    const audio = getContext();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(320 + Math.random() * 80, now);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  function playRipple() {
    if (!sfxEnabled) return;
    const audio = getContext();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.25);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  function buildAmbientBgm({ volume, freqs, noiseLevel }) {
    const audio = getContext();
    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(volume, now + 2.5);

    const oscillators = freqs.map((freq, i) => {
      const osc = audio.createOscillator();
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime((Math.random() - 0.5) * 6, now);

      const gain = audio.createGain();
      gain.gain.setValueAtTime(0.1 / freqs.length, now);

      const lfo = audio.createOscillator();
      lfo.frequency.setValueAtTime(0.02 + i * 0.008, now);
      const lfoGain = audio.createGain();
      lfoGain.gain.setValueAtTime(0.035, now);
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);

      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      lfo.start(now);
      return { osc, lfo };
    });

    const noiseBuffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noise = audio.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    const noiseFilter = audio.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 350;

    const noiseGain = audio.createGain();
    noiseGain.gain.value = noiseLevel;

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    master.connect(audio.destination);

    return { oscillators, noise, master };
  }

  function startBgm() {
    if (bgmEnabled) return;
    bgmNodes = buildAmbientBgm({
      volume: 0.07,
      freqs: [130.81, 164.81, 196.0, 246.94],
      noiseLevel: 0.012,
    });
    bgmEnabled = true;
  }

  function stopBgmNodes(nodes, onDone) {
    if (!nodes) return;
    const audio = getContext();
    const now = audio.currentTime;
    nodes.master.gain.cancelScheduledValues(now);
    nodes.master.gain.setValueAtTime(nodes.master.gain.value, now);
    nodes.master.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    window.setTimeout(() => {
      nodes.oscillators.forEach(({ osc, lfo }) => {
        try { osc.stop(); lfo.stop(); } catch { /* noop */ }
      });
      try { nodes.noise.stop(); } catch { /* noop */ }
      onDone();
    }, 1600);
  }

  function stopBgm() {
    if (!bgmEnabled) return;
    stopBgmNodes(bgmNodes, () => { bgmNodes = null; });
    bgmEnabled = false;
  }

  function getMungMasterVolume() {
    return MUNG_BGM_MAX_VOLUME * mungBgmVolume;
  }

  function applyMungMasterVolume() {
    if (!mungBgmNodes?.master) return;
    const audio = getContext();
    const now = audio.currentTime;
    const target = mungBgmEnabled ? getMungMasterVolume() : 0.0001;
    mungBgmNodes.master.gain.cancelScheduledValues(now);
    mungBgmNodes.master.gain.setValueAtTime(mungBgmNodes.master.gain.value, now);
    mungBgmNodes.master.gain.linearRampToValueAtTime(Math.max(target, 0.0001), now + 0.15);
  }

  function setMungBgmVolume(level) {
    mungBgmVolume = Math.max(0, Math.min(1, level));
    applyMungMasterVolume();
    return mungBgmVolume;
  }

  function getMungBgmVolume() {
    return mungBgmVolume;
  }

  function startMungBgm() {
    if (mungBgmEnabled) {
      applyMungMasterVolume();
      return;
    }
    mungBgmNodes = buildAmbientBgm({
      volume: getMungMasterVolume(),
      freqs: [110.0, 146.83, 174.61, 220.0, 261.63],
      noiseLevel: 0.022,
    });
    mungBgmEnabled = true;
  }

  function stopMungBgm() {
    if (!mungBgmEnabled) return;
    stopBgmNodes(mungBgmNodes, () => { mungBgmNodes = null; });
    mungBgmEnabled = false;
  }

  function enterMungAudio() {
    mainBgmWasOn = bgmEnabled;
    if (bgmEnabled) stopBgm();
    startMungBgm();
  }

  function exitMungAudio() {
    stopMungBgm();
    if (mainBgmWasOn) startBgm();
  }

  function toggleBgm() {
    if (bgmEnabled) stopBgm();
    else startBgm();
    return bgmEnabled;
  }

  function toggleMungBgm() {
    if (mungBgmEnabled) stopMungBgm();
    else startMungBgm();
    return mungBgmEnabled;
  }

  function toggleSfx() {
    sfxEnabled = !sfxEnabled;
    return sfxEnabled;
  }

  function setSfxEnabled(value) {
    sfxEnabled = value;
  }

  function isBgmEnabled() { return bgmEnabled; }
  function isMungBgmEnabled() { return mungBgmEnabled; }
  function isSfxEnabled() { return sfxEnabled; }

  function unlock() {
    getContext();
  }

  return {
    playCloudPuff,
    playSoftPop,
    playRipple,
    startBgm,
    stopBgm,
    startMungBgm,
    stopMungBgm,
    enterMungAudio,
    exitMungAudio,
    toggleBgm,
    toggleMungBgm,
    setMungBgmVolume,
    getMungBgmVolume,
    toggleSfx,
    setSfxEnabled,
    isBgmEnabled,
    isMungBgmEnabled,
    isSfxEnabled,
    unlock,
  };
})();
