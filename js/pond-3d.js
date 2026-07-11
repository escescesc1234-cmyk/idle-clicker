const Pond3D = (() => {
  const SCALE = 0.04;
  const ORIGIN_X = 800;
  const ORIGIN_Z = 550;

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
  let camPos = new THREE.Vector3(0, 18, 22);

  function to3(x, y, height = 0) {
    return new THREE.Vector3((x - ORIGIN_X) * SCALE, height, (y - ORIGIN_Z) * SCALE);
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

  function createKoi(color) {
    const g = new THREE.Group();
    const body = addShadow(new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 6),
      makeMat(color, { roughness: 0.45 }),
    ));
    body.scale.set(1.8, 0.7, 0.9);
    const tail = addShadow(new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.28, 5),
      makeMat(color, { roughness: 0.45 }),
    ));
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -0.38;
    g.add(body, tail);
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

    // Pond rim + water
    const rim = addShadow(new THREE.Mesh(
      new THREE.TorusGeometry(7.2, 0.55, 10, 40),
      makeMat(0x7a756c, { roughness: 0.9 }),
    ));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(-1.2, 0.2, -3.2);
    rim.scale.set(1.35, 1, 0.85);
    scene.add(rim);

    const basin = new THREE.Mesh(
      new THREE.CircleGeometry(6.6, 40),
      makeMat(0x2a6270, { roughness: 1 }),
    );
    basin.rotation.x = -Math.PI / 2;
    basin.position.set(-1.2, 0.02, -3.2);
    basin.scale.set(1.35, 1, 0.85);
    basin.receiveShadow = true;
    scene.add(basin);

    waterMesh = new THREE.Mesh(
      new THREE.CircleGeometry(6.4, 40),
      makeMat(0x4a9aa0, { roughness: 0.2, metalness: 0.08, transparent: true, opacity: 0.82 }),
    );
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set(-1.2, 0.28, -3.2);
    waterMesh.scale.set(1.35, 1, 0.85);
    scene.add(waterMesh);

    // Gate
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

    // Trees
    [
      [-14, -6, "pine"], [-12, -9, "plum"], [-15, 2, "pine"],
      [13, -7, "plum"], [15, -3, "pine"], [12, 4, "plum"],
      [-10, 10, "pine"], [10, 11, "plum"],
    ].forEach(([x, z, kind]) => scene.add(createTree(x, z, kind)));

    // Bench
    const bench = addShadow(new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.25, 0.7),
      makeMat(0x8b5a3c),
    ));
    bench.position.set(-9, 0.45, 6.5);
    scene.add(bench);

    // Sign
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

    // Feed machine
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

  function syncFish(fishList) {
    while (fishMeshes.length < fishList.length) {
      const colors = [0xf08a3a, 0xe04838, 0xf0ece4];
      const mesh = createKoi(colors[fishMeshes.length % colors.length]);
      scene.add(mesh);
      fishMeshes.push(mesh);
    }
    while (fishMeshes.length > fishList.length) {
      const mesh = fishMeshes.pop();
      scene.remove(mesh);
    }
    fishList.forEach((f, i) => {
      const mesh = fishMeshes[i];
      // fish coords are relative to pond rect in 2D logic
      const worldX = 398 + f.x;
      const worldY = 318 + f.y;
      const p = to3(worldX, worldY, 0.35 + Math.sin(performance.now() * 0.004 + i) * 0.05);
      mesh.position.lerp(p, 0.35);
      mesh.rotation.y = Math.atan2(f.vx, f.vy) + (f.vx < 0 ? Math.PI : 0);
      mesh.rotation.z = Math.sin(performance.now() * 0.01 + i) * 0.15;
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
      const worldX = 398 + food.x;
      const worldY = 318 + food.y;
      const lift = food.falling ? 0.9 + Math.sin((food.arc || 0) * Math.PI) * 1.2 : 0.38;
      mesh.position.copy(to3(worldX, worldY, lift));
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
        const label = entry.nameEl?.textContent || "친구";
        mesh.userData.name = label;
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

    if (machineMesh) {
      machineMesh.scale.setScalar(nearMachine ? 1.06 : 1);
    }

    syncFish(fish || []);
    syncFood((foods || []).filter((f) => f.life > 0));
    if (remotes) syncRemotes(remotes);

    camTarget.set(playerMesh.position.x, 1.2, playerMesh.position.z);
    const back = player.facing < 0 ? 1 : -1;
    const desired = new THREE.Vector3(
      playerMesh.position.x + back * 0.5,
      11.5,
      playerMesh.position.z + 14,
    );
    camPos.lerp(desired, 0.08);
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  function renderLoop() {
    if (!running) return;
    raf = requestAnimationFrame(renderLoop);
    if (waterMesh) {
      waterMesh.position.y = 0.28 + Math.sin(clock.getElapsedTime() * 1.3) * 0.03;
    }
    renderer.render(scene, camera);
  }

  function start() {
    if (!ensureRenderer()) return false;
    running = true;
    root.classList.add("active");
    resize();
    if (!raf) renderLoop();
    return true;
  }

  function stop() {
    running = false;
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
