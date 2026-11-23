import * as THREE from 'three';

export interface WindTunnelRig {
  group: THREE.Group;
  update: (delta: number, drsOpen: boolean, speedMultiplier: number) => void;
  dispose: () => void;
}

function createStreamlineTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);

  // 3 glowing aerodynamic flow streaks per repeat cycle
  const drawStreak = (startX: number, length: number) => {
    const grad = ctx.createLinearGradient(startX, 0, startX + length, 0);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.0)');
    grad.addColorStop(0.55, 'rgba(56, 189, 248, 0.85)');
    grad.addColorStop(0.85, 'rgba(224, 242, 254, 0.95)');
    grad.addColorStop(1, 'rgba(224, 242, 254, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(startX, 4, length, h - 8);
  };

  drawStreak(10, 90);
  drawStreak(135, 105);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(4, 1);
  return tex;
}

export function createWindTunnelRig(): WindTunnelRig {
  const group = new THREE.Group();
  group.visible = false;

  const flowTexture = createStreamlineTexture();
  const baseMat = new THREE.MeshBasicMaterial({
    map: flowTexture,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const warmFlowTex = flowTexture.clone();
  warmFlowTex.needsUpdate = true;
  const wakeMat = new THREE.MeshBasicMaterial({
    map: warmFlowTex,
    color: new THREE.Color('#38bdf8'),
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const geometries: THREE.BufferGeometry[] = [];

  const addRibbon = (points: THREE.Vector3[], radius: number, mat: THREE.Material) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, 64, radius, 8, false);
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 5;
    group.add(mesh);
    return mesh;
  };

  // Centerline flow over nose -> halo -> airbox -> rear wing wake
  addRibbon(
    [
      new THREE.Vector3(0, 0.22, 3.4),
      new THREE.Vector3(0, 0.24, 2.55),
      new THREE.Vector3(0, 0.48, 1.55),
      new THREE.Vector3(0, 0.89, 0.35),
      new THREE.Vector3(0, 1.04, -0.35),
      new THREE.Vector3(0, 0.96, -1.55),
      new THREE.Vector3(0, 1.04, -2.35),
      new THREE.Vector3(0, 1.24, -3.45),
    ],
    0.014,
    baseMat,
  );

  // Symmetric sidepod downwash & outwash streamlines
  for (const side of [-1, 1] as const) {
    // Upper sidepod downwash into diffuser top
    addRibbon(
      [
        new THREE.Vector3(side * 0.28, 0.16, 3.35),
        new THREE.Vector3(side * 0.36, 0.28, 2.35),
        new THREE.Vector3(side * 0.45, 0.56, 0.65),
        new THREE.Vector3(side * 0.44, 0.58, -0.25),
        new THREE.Vector3(side * 0.32, 0.34, -1.45),
        new THREE.Vector3(side * 0.24, 0.44, -2.35),
        new THREE.Vector3(side * 0.28, 0.72, -3.45),
      ],
      0.012,
      baseMat,
    );

    // Front wing outwash around front wheel wake
    addRibbon(
      [
        new THREE.Vector3(side * 0.74, 0.14, 3.35),
        new THREE.Vector3(side * 0.88, 0.22, 2.42),
        new THREE.Vector3(side * 1.08, 0.28, 1.65),
        new THREE.Vector3(side * 0.92, 0.24, 0.45),
        new THREE.Vector3(side * 0.86, 0.18, -0.85),
        new THREE.Vector3(side * 0.96, 0.28, -2.15),
        new THREE.Vector3(side * 1.04, 0.45, -3.35),
      ],
      0.011,
      baseMat,
    );

    // Underbody Venturi floor -> diffuser upwash plume
    addRibbon(
      [
        new THREE.Vector3(side * 0.22, 0.055, 2.95),
        new THREE.Vector3(side * 0.28, 0.045, 1.2),
        new THREE.Vector3(side * 0.34, 0.045, -0.4),
        new THREE.Vector3(side * 0.28, 0.09, -1.85),
        new THREE.Vector3(side * 0.32, 0.32, -2.55),
        new THREE.Vector3(side * 0.36, 0.58, -3.45),
      ],
      0.012,
      wakeMat,
    );
  }

  return {
    group,
    update(delta: number, drsOpen: boolean, speedMultiplier: number) {
      if (!group.visible) return;
      const flowRate = (1.6 + speedMultiplier * 2.2) * delta;
      flowTexture.offset.x -= flowRate;
      warmFlowTex.offset.x -= flowRate * 1.15;

      // Shift wake color subtly brighter cyan when DRS opens (lower drag plume)
      wakeMat.color.setHex(drsOpen ? 0x22d3ee : 0x38bdf8);
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      flowTexture.dispose();
      warmFlowTex.dispose();
      baseMat.dispose();
      wakeMat.dispose();
    },
  };
}
