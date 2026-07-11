const Pond3D = (() => {
  const SCALE = 0.04;
  const ORIGIN_X = 800;
  const ORIGIN_Z = 550;
  const POND_2D = { w: 724, h: 344 };
  const WATER = { cx: -1.2, cz: -3.2, rx: 7.4, rz: 4.6, y: 0.22 };

  let root = null;
  let renderer = null;
  let scene = null;
  let camera = null;
  let clock = null;
  let running = false;
  let raf = null;
  let waterMesh = null;
  let playerMesh = null;
  let machineMesh = null;
  let fishMeshes = [];
  let foodMeshes = [];
  let remoteMeshes = new Map();
  let camTarget = new THREE.Vector3();
  let camPos = new THREE.Vector3(0, 12, 16);
  let orbitYaw = 0.35;
  let orbitPitch = 0.38;
  let orbitDragging = false;
  let orbitLast = { x: 0, y: 0 };

  function to3(x, y, height = 0) {
    return new THREE.Vector3((x - ORIGIN_X) * SCALE, height, (y - ORIGIN_Z) * SCALE);
  }

  function pondLocalTo3(localX, localY, height) {
    const u = (localX / POND_2D.w) * 2 - 1;
    const v = (localY / POND_2D.h) * 2 - 1;
    let x = u * WATER.rx * 0.92;
    let z = v * WATER.rz * 0.92;
    const e = (x * x) / (WATER.rx * WATER.rx) + (z * z) / (WATER.rz * WATER.rz);
    if (e > 0.98) {
      const s = Math.sqrt(0.98 / e);
      x *= s;
      z *= s;
    }
    return new THREE.Vector3(WATER.cx + x, height, WATER.cz + z);
  }

  function makeMat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: opts.roughness ?? 0.85,
      metalness: opts.metalness ?? 0.05,
      transparent: !!opts.transparent,
      opacity: opts.opacity ?? 1,
      flatShading: !!opts.flat,
    });
  }

  function addShadow(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function createTree(x, z, kind) {
    const g = new THREE.Group();
    const trunk = addShadow(new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.18, 1.4, 6),
      makeMat(0x6b4428, { flat: true }),
    ));
    trunk.position.y = 0.7;
    g.add(trunk);

    if (kind === "pine") {
      [1.6, 2.2, 2.8].forEach((y, i) => {
        const cone = addShadow(new THREE.Mesh(
          new THREE.ConeGeometry(1.1 - i * 0.22, 1.3, 7),
          makeMat(0x3f6b45, { flat: true }),
        ));
        cone.position.y = y;
        g.add(cone);
      });
    } else {
      const crown = addShadow(new THREE.Mesh(
        new THREE.SphereGeometry(1.05, 8, 6),
        makeMat(0x6f9a62, { flat: true }),
      ));
      crown.position.y = 2.1;
      g.add(crown);
      for (let i = 0; i < 5; i += 1) {
        const blossom = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 5, 4),
          makeMat(0xf3b6c8, { flat: true }),
        );
        blossom.position.set((Math.random() - 0.5) * 1.4, 2 + Math.random() * 0.8, (Math.random() - 0.5) * 1.4);
        g.add(blossom);
      }
    }
    g.position.set(x, 0, z);
    return g;
  }

  function createPlayerMesh(color = 0x3d6fa0) {
    const g = new THREE.Group();
    const bodyGeo = THREE.CapsuleGeometry
      ? new THREE.CapsuleGeometry(0.28, 0.55, 4, 8)
      : new THREE.CylinderGeometry(0.28, 0.28, 1.1, 8);
    const body = addShadow(new THREE.Mesh(bodyGeo, makeMat(color)));
    body.position.y = 0.85;
    const head = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 6),
      makeMat(0xd4a878),
    ));
    head.position.y = 1.45;
    g.add(body, head);
    return g;
  }

  function createKoi(styleIndex) {
    const styles = [
      { body: 0xfff6ea, spot: 0xe23b2e, fin: 0xffd7c2 },
      { body: 0xf4a04a, spot: 0xffffff, fin: 0xe8893a },
      { body: 0x1f1f22, spot: 0xe23b2e, fin: 0x333338 },
      { body: 0xfff8f0, spot: 0xf08a3a, fin: 0xffe0c8 },
      { body: 0xe04838, spot: 0xfff4e8, fin: 0xc43a2c },
    ];
    const style = styles[styleIndex % styles.length];
    const g = new THREE.Group();
    g.userData.phase = Math.random() * Math.PI * 2;

    const body = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10),
      makeMat(style.body, { roughness: 0.35, metalness: 0.08 }),
    ));
    body.scale.set(2.1, 0.72, 0.95);

    const head = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 10, 8),
      makeMat(style.body, { roughness: 0.35 }),
    ));
    head.scale.set(1.15, 0.85, 0.9);
    head.position.x = 0.42;

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), makeMat(0x111111));
    const eyeR = eyeL.clone();
    eyeL.position.set(0.52, 0.06, 0.12);
    eyeR.position.set(0.52, 0.06, -0.12);

    const spot = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 6),
      makeMat(style.spot, { roughness: 0.4 }),
    ));
    spot.scale.set(1.1, 0.55, 0.8);
    spot.position.set(0.05, 0.08, 0.08);

    const spot2 = spot.clone();
    spot2.position.set(-0.2, 0.05, -0.1);
    spot2.scale.set(0.8, 0.45, 0.65);

    const tail = new THREE.Group();
    tail.name = "tail";
    const tailMat = makeMat(style.fin, { roughness: 0.45, transparent: true, opacity: 0.92 });
    const tailA = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.42, 6), tailMat));
    tailA.rotation.z = Math.PI / 2;
    tailA.rotation.y = 0.35;
    tailA.position.set(-0.55, 0.02, 0.08);
    const tailB = addShadow(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 6), tailMat));
    tailB.rotation.z = Math.PI / 2;
    tailB.rotation.y = -0.35;
    tailB.position.set(-0.52, 0.02, -0.08);
    tail.add(tailA, tailB);

    const dorsal = addShadow(new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.28, 5),
      makeMat(style.fin, { roughness: 0.5, transparent: true, opacity: 0.85 }),
    ));
    dorsal.position.set(0.05, 0.28, 0);
    dorsal.rotation.z = -0.2;

    const pecL = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 4),
      makeMat(style.fin, { roughness: 0.5, transparent: true, opacity: 0.8 }),
    ));
    pecL.scale.set(0.9, 0.2, 1.4);
    pecL.position.set(0.15, -0.02, 0.28);
    pecL.rotation.y = 0.4;
    const pecR = pecL.clone();
    pecR.position.z = -0.28;
    pecR.rotation.y = -0.4;

    g.add(body, head, eyeL, eyeR, spot, spot2, tail, dorsal, pecL, pecR);
    g.scale.setScalar(0.85 + (styleIndex % 3) * 0.12);
    return g;
  }

  function buildScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb9d7e8);
    scene.fog = new THREE.Fog(0xb9d7e8, 28, 70);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
    camera.position.copy(camPos);

    const hemi = new THREE.HemisphereLight(0xe8f4ff, 0x6a8a60, 0.85);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.15);
    sun.position.set(12, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    scene.add(sun);

    const ground = addShadow(new THREE.Mesh(
      new THREE.CircleGeometry(28, 48),
      makeMat(0x8fb392),
    ));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.castShadow = false;
    scene.add(ground);

    const path = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.08, 4.2),
      makeMat(0xc4b396, { roughness: 0.95 }),
    ));
    path.position.set(0, 0.04, 8.5);
    path.receiveShadow = true;
    scene.add(path);

    const rim = addShadow(new THREE.Mesh(
      new THREE.TorusGeometry(7.2, 0.55, 10, 40),
      makeMat(0x7a756c, { roughness: 0.9 }),
    ));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(WATER.cx, 0.2, WATER.cz);
    rim.scale.set(1.35, 1, 0.85);
    scene.add(rim);

    const basin = new THREE.Mesh(
      new THREE.CircleGeometry(6.6, 40),
      makeMat(0x2a6270, { roughness: 1 }),
    );
    basin.rotation.x = -Math.PI / 2;
    basin.position.set(WATER.cx, 0.02, WATER.cz);
    basin.scale.set(1.35, 1, 0.85);
    basin.receiveShadow = true;
    scene.add(basin);

    waterMesh = new THREE.Mesh(
      new THREE.CircleGeometry(6.4, 40),
      makeMat(0x4a9aa0, { roughness: 0.2, metalness: 0.08, transparent: true, opacity: 0.82 }),
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(WATER.cx, WATER.y + 0.06, WATER.cz);
    waterMesh.scale.set(1.35, 1, 0.85);
    scene.add(waterMesh);

    const gate = new THREE.Group();
    const pillarL = addShadow(new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 0.35), makeMat(0xd9c4a0)));
    const pillarR = pillarL.clone();
    pillarL.position.set(-1.4, 1.1, -14);
    pillarR.position.set(1.4, 1.1, -14);
    const roof = addShadow(new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 1.1, 4),
      makeMat(0x5a2f2a, { flat: true }),
    ));
    roof.position.set(0, 2.5, -14);
    roof.rotation.y = Math.PI / 4;
    gate.add(pillarL, pillarR, roof);
    scene.add(gate);

    [
      [-14, -6, "pine"], [-12, -9, "plum"], [-15, 2, "pine"],
      [13, -7, "plum"], [15, -3, "pine"], [12, 4, "plum"],
      [-10, 10, "pine"], [10, 11, "plum"],
    ].forEach(([x, z, kind]) => scene.add(createTree(x, z, kind)));

    const bench = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.25, 0.7),
      makeMat(0x8b5a3c),
    ));
    bench.position.set(-9, 0.45, 6.5);
    scene.add(bench);

    const signPost = addShadow(new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6),
      makeMat(0x5a4030, { flat: true }),
    ));
    signPost.position.set(-8.5, 0.6, -8);
    const signBoard = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.7, 0.1),
      makeMat(0xe8dcc8),
    ));
    signBoard.position.set(-8.5, 1.35, -8);
    scene.add(signPost, signBoard);

    machineMesh = new THREE.Group();
    const cabinet = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.8, 0.8),
      makeMat(0x3a4c60),
    ));
    cabinet.position.y = 0.9;
    const screen = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.35, 0.05),
      makeMat(0x4ec4b0, { roughness: 0.3, metalness: 0.2 }),
    );
    screen.position.set(0, 1.25, 0.42);
    machineMesh.add(cabinet, screen);
    machineMesh.position.copy(to3(1295, 770, 0));
    scene.add(machineMesh);

    playerMesh = createPlayerMesh(0x3d6fa0);
    scene.add(playerMesh);
  }

  function ensureRenderer() {
    if (!root) root = document.getElementById("pond-3d-root");
    if (!root || !window.THREE) return false;
    if (renderer) return true;

    clock = new THREE.Clock();
    buildScene();
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    }
    root.appendChild(renderer.domElement);
    resize();
    return true;
  }

  function resize() {
    if (!renderer || !camera || !root) return;
    const w = root.clientWidth || window.innerWidth;
    const h = root.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function isOrbitBlocked(target) {
    return !!target?.closest?.(
      "button, input, textarea, select, .pond-stick, .pond-action-btn, .mung-top, .mung-activities, .mung-side-panel, .pond-food-bag",
    );
  }

  function onOrbitDown(event) {
    if (!running) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (isOrbitBlocked(event.target)) return;
    orbitDragging = true;
    orbitLast = { x: event.clientX, y: event.clientY };
  }

  function onOrbitMove(event) {
    if (!running || !orbitDragging) return;
    const dx = event.clientX - orbitLast.x;
    const dy = event.clientY - orbitLast.y;
    orbitLast = { x: event.clientX, y: event.clientY };
    orbitYaw -= dx * 0.005;
    orbitPitch = Math.max(0.12, Math.min(1.15, orbitPitch + dy * 0.004));
  }

  function onOrbitUp() {
    orbitDragging = false;
  }

  function bindOrbit(on) {
    const method = on ? "addEventListener" : "removeEventListener";
    window[method]("pointerdown", onOrbitDown);
    window[method]("pointermove", onOrbitMove);
    window[method]("pointerup", onOrbitUp);
    window[method]("pointercancel", onOrbitUp);
  }

  function syncFish(fishList) {
    while (fishMeshes.length < fishList.length) {
      const mesh = createKoi(fishMeshes.length);
      scene.add(mesh);
      fishMeshes.push(mesh);
    }
    while (fishMeshes.length > fishList.length) {
      const mesh = fishMeshes.pop();
      scene.remove(mesh);
    }
    const t = performance.now() * 0.001;
    fishList.forEach((f, i) => {
      const mesh = fishMeshes[i];
      const bob = Math.sin(t * 2.2 + (mesh.userData.phase || 0)) * 0.04;
      const depth = WATER.y - 0.08 + bob;
      const p = pondLocalTo3(f.x, f.y, depth);
      mesh.position.lerp(p, 0.45);
      mesh.rotation.y = Math.atan2(f.vx, f.vy);
      mesh.rotation.z = Math.sin(t * 5 + i) * 0.12;
      mesh.rotation.x = Math.sin(t * 3.5 + i) * 0.08;
      const tail = mesh.getObjectByName("tail");
      if (tail) tail.rotation.y = Math.sin(t * 8 + i) * 0.45;
      mesh.visible = true;
    });
  }

  function syncFood(foodList) {
    while (foodMeshes.length < foodList.length) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 4),
        makeMat(0xe8b84a, { roughness: 0.4 }),
      );
      scene.add(mesh);
      foodMeshes.push(mesh);
    }
    while (foodMeshes.length > foodList.length) {
      const mesh = foodMeshes.pop();
      scene.remove(mesh);
    }
    foodList.forEach((food, i) => {
      const mesh = foodMeshes[i];
      const lift = food.falling
        ? WATER.y + 0.7 + Math.sin((food.arc || 0) * Math.PI) * 1.1
        : WATER.y + 0.05;
      mesh.position.copy(pondLocalTo3(food.x, food.y, lift));
      mesh.visible = food.life > 0;
    });
  }

  function syncRemotes(remoteMap) {
    const live = new Set();
    remoteMap.forEach((entry, id) => {
      live.add(id);
      let mesh = remoteMeshes.get(id);
      if (!mesh) {
        mesh = createPlayerMesh(0xc45a6a);
        scene.add(mesh);
        remoteMeshes.set(id, mesh);
      }
      const p = to3(entry.x, entry.y, 0);
      mesh.position.lerp(p, 0.25);
      mesh.rotation.y = entry.facing < 0 ? Math.PI / 2 : -Math.PI / 2;
    });
    remoteMeshes.forEach((mesh, id) => {
      if (!live.has(id)) {
        scene.remove(mesh);
        remoteMeshes.delete(id);
      }
    });
  }

  function sync(state) {
    if (!running || !playerMesh) return;
    const { player, fish, foods, remotes, nearMachine } = state;
    const p = to3(player.x, player.y, 0);
    playerMesh.position.lerp(p, 0.4);
    playerMesh.rotation.y = player.facing < 0 ? Math.PI / 2 : -Math.PI / 2;
    playerMesh.position.y = Math.abs(Math.sin(performance.now() * 0.012)) * (state.walking ? 0.08 : 0);

    if (machineMesh) machineMesh.scale.setScalar(nearMachine ? 1.06 : 1);

    syncFish(fish || []);
    syncFood((foods || []).filter((f) => f.life > 0));
    if (remotes) syncRemotes(remotes);

    camTarget.set(playerMesh.position.x, 1.2, playerMesh.position.z);
    const dist = 13 + orbitPitch * 2;
    const height = 4.5 + orbitPitch * 8;
    const desired = new THREE.Vector3(
      playerMesh.position.x + Math.sin(orbitYaw) * dist,
      height,
      playerMesh.position.z + Math.cos(orbitYaw) * dist,
    );
    camPos.lerp(desired, orbitDragging ? 0.2 : 0.1);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  function renderLoop() {
    if (!running) return;
    raf = requestAnimationFrame(renderLoop);
    if (waterMesh) {
      waterMesh.position.y = WATER.y + 0.06 + Math.sin(clock.getElapsedTime() * 1.3) * 0.025;
    }
    renderer.render(scene, camera);
  }

  function start() {
    if (!ensureRenderer()) return false;
    running = true;
    orbitYaw = 0.35;
    orbitPitch = 0.38;
    orbitDragging = false;
    root.classList.add("active");
    bindOrbit(true);
    resize();
    if (!raf) renderLoop();
    return true;
  }

  function stop() {
    running = false;
    orbitDragging = false;
    bindOrbit(false);
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (root) root.classList.remove("active");
    fishMeshes.forEach((m) => scene?.remove(m));
    fishMeshes = [];
    foodMeshes.forEach((m) => scene?.remove(m));
    foodMeshes = [];
    remoteMeshes.forEach((m) => scene?.remove(m));
    remoteMeshes.clear();
  }

  function isReady() {
    return !!window.THREE;
  }

  window.addEventListener("resize", () => {
    if (running) resize();
  });

  return { start, stop, sync, resize, isReady };
})();

window.Pond3D = Pond3D;
