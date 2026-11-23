import * as THREE from 'three';
import { createAirfoilWingGeometry, createLoftedGeometry, LoftStation } from './geometryUtils';
import { F1MaterialSet } from './materials';

export interface ExplodablePart {
  key: string;
  group: THREE.Group;
  basePos: THREE.Vector3;
  explodeOffset: THREE.Vector3;
}

export interface F1CarRig {
  root: THREE.Group;
  explodableParts: ExplodablePart[];
  partGroupsByKey: Map<string, THREE.Group[]>;
  wheelSpinGroups: THREE.Group[];
  drsFlapPivot: THREE.Group;
  rainLightMat: THREE.MeshStandardMaterial;
  explosionGuides: THREE.LineSegments;
  raycastTargets: THREE.Object3D[];
  dispose: () => void;
}

function tagPart(obj: THREE.Object3D, partKey: string, castShadow = true) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      m.userData.partKey = partKey;
      m.castShadow = castShadow;
      m.receiveShadow = true;
      m.layers.enable(1);
    }
  });
}

/**
 * Normalizes ExtrudeGeometry UVs after rotating +90° around Y ((x,y,z)->(z,y,-x))
 * so side sponsor decals read un-mirrored on both Right (+X) and Left (-X) faces.
 */
function normalizeSideExtrudeUVs(geo: THREE.BufferGeometry, flipZ: boolean) {
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (!box) return;
  const spanZ = Math.max(0.001, box.max.z - box.min.z);
  const spanY = Math.max(0.001, box.max.y - box.min.y);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const y = pos.getY(i);
    const uNorm = (z - box.min.z) / spanZ;
    const u = flipZ ? 1 - uNorm : uNorm;
    const v = (y - box.min.y) / spanY;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

function createAeroStrut(
  start: THREE.Vector3,
  end: THREE.Vector3,
  thicknessY: number,
  chordZ: number,
  material: THREE.Material,
): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = Math.max(0.01, dir.length());
  const geo = new THREE.CylinderGeometry(thicknessY, thicknessY, len, 12);
  geo.scale(1, 1, chordZ / thicknessY);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function buildWheelTireAssembly(
  isFront: boolean,
  sideSign: 1 | -1,
  mats: F1MaterialSet,
): {
  wheelGroup: THREE.Group;
  spinGroup: THREE.Group;
} {
  const wheelGroup = new THREE.Group();
  const spinGroup = new THREE.Group();
  wheelGroup.add(spinGroup);

  const outerRadius = 0.36;
  const rimRadius = 0.228;
  const tireWidth = isFront ? 0.315 : 0.405;
  const halfW = tireWidth / 2;

  const profilePoints = [
    new THREE.Vector2(rimRadius + 0.008, -halfW * 0.9),
    new THREE.Vector2(outerRadius - 0.03, -halfW),
    new THREE.Vector2(outerRadius - 0.005, -halfW * 0.84),
    new THREE.Vector2(outerRadius + 0.002, 0),
    new THREE.Vector2(outerRadius - 0.005, halfW * 0.84),
    new THREE.Vector2(outerRadius - 0.03, halfW),
    new THREE.Vector2(rimRadius + 0.008, halfW * 0.9),
  ];
  const treadGeo = new THREE.LatheGeometry(profilePoints, 56);
  treadGeo.rotateZ(Math.PI / 2);
  spinGroup.add(new THREE.Mesh(treadGeo, mats.tireTread));

  const sidewallGeo = new THREE.RingGeometry(rimRadius - 0.004, outerRadius - 0.028, 56, 1);
  const swPos = sidewallGeo.attributes.position;
  const swUv = sidewallGeo.attributes.uv;
  for (let i = 0; i < swPos.count; i++) {
    const px = swPos.getX(i);
    const py = swPos.getY(i);
    swUv.setXY(i, 0.5 + (px / outerRadius) * 0.5, 0.5 + (py / outerRadius) * 0.5);
  }
  swUv.needsUpdate = true;

  const outerSidewall = new THREE.Mesh(sidewallGeo, mats.tireSidewall);
  outerSidewall.rotation.y = sideSign * (Math.PI / 2);
  outerSidewall.position.x = sideSign * (halfW * 0.95);
  spinGroup.add(outerSidewall);

  const innerSidewall = new THREE.Mesh(sidewallGeo, mats.tireSidewall);
  innerSidewall.rotation.y = -sideSign * (Math.PI / 2);
  innerSidewall.position.x = -sideSign * (halfW * 0.95);
  spinGroup.add(innerSidewall);

  const rimBarrelGeo = new THREE.CylinderGeometry(
    rimRadius,
    rimRadius,
    tireWidth * 0.9,
    40,
    1,
    true,
  );
  rimBarrelGeo.rotateZ(Math.PI / 2);
  spinGroup.add(new THREE.Mesh(rimBarrelGeo, mats.wheelRim));

  // Deep Recessed 7-Spoke Forged Hub + Woven Carbon Outer Aero Ring (matching screenshot-004 & screenshot-006)
  const coverGeo = new THREE.CircleGeometry(rimRadius * 0.98, 48);
  const cPos = coverGeo.attributes.position;
  const cUv = coverGeo.attributes.uv;
  for (let i = 0; i < cPos.count; i++) {
    cUv.setXY(
      i,
      0.5 + (cPos.getX(i) / (rimRadius * 0.98)) * 0.5,
      0.5 + (cPos.getY(i) / (rimRadius * 0.98)) * 0.5,
    );
  }
  cUv.needsUpdate = true;

  const recessedFace = new THREE.Mesh(coverGeo, mats.wheelFace);
  recessedFace.rotation.y = sideSign * (Math.PI / 2);
  recessedFace.position.x = sideSign * (halfW * 0.50);
  spinGroup.add(recessedFace);

  // Outer woven carbon aero shroud ring (hollow center revealing 7 spokes inside!)
  const aeroRingGeo = new THREE.RingGeometry(rimRadius * 0.62, rimRadius * 0.98, 48, 1);
  const aeroRing = new THREE.Mesh(aeroRingGeo, mats.carbonFiber);
  aeroRing.rotation.y = sideSign * (Math.PI / 2);
  aeroRing.position.x = sideSign * (halfW * 0.80);
  spinGroup.add(aeroRing);

  const dishLipGeo = new THREE.TorusGeometry(rimRadius * 0.64, 0.014, 12, 40);
  dishLipGeo.rotateY(Math.PI / 2);
  const dishLip = new THREE.Mesh(dishLipGeo, mats.matteCarbon);
  dishLip.position.x = sideSign * (halfW * 0.78);
  spinGroup.add(dishLip);

  // 7 Sculpted Star Spokes inside recessed wheel dish
  for (let s = 0; s < 7; s++) {
    const angle = (s / 7) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.135, 0.022), mats.wheelRim);
    spoke.position.set(
      sideSign * (halfW * 0.58),
      Math.sin(angle) * 0.095,
      Math.cos(angle) * 0.095,
    );
    spoke.rotation.x = -angle + Math.PI / 2;
    spinGroup.add(spoke);
  }

  // Red Inner Hub + Green Center Lock Nose (matching screenshot-004 & screenshot-006)
  const nutGeo = new THREE.CylinderGeometry(0.038, 0.046, 0.04, 12);
  nutGeo.rotateZ(Math.PI / 2);
  const nutMesh = new THREE.Mesh(nutGeo, mats.wheelNut);
  nutMesh.position.x = sideSign * (halfW * 0.60);
  spinGroup.add(nutMesh);

  const hubTipGeo = new THREE.CylinderGeometry(0.016, 0.024, 0.036, 16);
  hubTipGeo.rotateZ(Math.PI / 2);
  const hubTip = new THREE.Mesh(hubTipGeo, mats.wheelHubTip);
  hubTip.position.x = sideSign * (halfW * 0.66);
  spinGroup.add(hubTip);

  // Curved Front Wheel Wake Eyebrow Deflector
  if (isFront) {
    const browCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-sideSign * (halfW * 1.15), 0.12, 0.34),
      new THREE.Vector3(-sideSign * (halfW * 1.10), 0.36, 0.19),
      new THREE.Vector3(-sideSign * (halfW * 0.92), 0.42, -0.05),
      new THREE.Vector3(-sideSign * (halfW * 0.68), 0.34, -0.25),
    ]);
    const browGeo = new THREE.TubeGeometry(browCurve, 28, 0.02, 10, false);
    browGeo.scale(1.85, 0.45, 1.0);
    wheelGroup.add(new THREE.Mesh(browGeo, mats.carbonFiber));
  }

  return { wheelGroup, spinGroup };
}

function buildBrakeAssembly(
  isFront: boolean,
  sideSign: 1 | -1,
  mats: F1MaterialSet,
): THREE.Group {
  const brakeGroup = new THREE.Group();
  const halfW = (isFront ? 0.315 : 0.405) / 2;

  const discGeo = new THREE.CylinderGeometry(0.164, 0.164, 0.028, 36);
  discGeo.rotateZ(Math.PI / 2);
  const disc = new THREE.Mesh(discGeo, mats.brakeDisc);
  disc.position.x = -sideSign * (halfW * 0.25);
  brakeGroup.add(disc);

  const hatGeo = new THREE.CylinderGeometry(0.088, 0.095, 0.048, 24);
  hatGeo.rotateZ(Math.PI / 2);
  const hat = new THREE.Mesh(hatGeo, mats.wheelRim);
  hat.position.x = -sideSign * (halfW * 0.25);
  brakeGroup.add(hat);

  const caliperGeo = new THREE.BoxGeometry(0.068, 0.128, 0.088);
  const caliper = new THREE.Mesh(caliperGeo, mats.brakeCaliper);
  caliper.position.set(-sideSign * (halfW * 0.25), -0.068, isFront ? -0.105 : 0.105);
  caliper.rotation.x = isFront ? -0.55 : 0.55;
  brakeGroup.add(caliper);

  const scoopGeo = new THREE.CylinderGeometry(
    0.172,
    0.186,
    0.046,
    28,
    1,
    false,
    0,
    Math.PI * 1.45,
  );
  scoopGeo.rotateZ(Math.PI / 2);
  const scoop = new THREE.Mesh(scoopGeo, mats.carbonFiber);
  scoop.position.x = -sideSign * (halfW * 0.65);
  brakeGroup.add(scoop);

  return brakeGroup;
}

export function buildF1Car(mats: F1MaterialSet): F1CarRig {
  const root = new THREE.Group();
  const explodableParts: ExplodablePart[] = [];
  const partGroupsByKey = new Map<string, THREE.Group[]>();
  const wheelSpinGroups: THREE.Group[] = [];
  const raycastTargets: THREE.Object3D[] = [];

  const registerPart = (
    key: string,
    group: THREE.Group,
    explodeOffset: THREE.Vector3,
    castShadow = true,
  ) => {
    tagPart(group, key, castShadow);
    explodableParts.push({
      key,
      group,
      basePos: group.position.clone(),
      explodeOffset,
    });
    const list = partGroupsByKey.get(key) || [];
    list.push(group);
    partGroupsByKey.set(key, list);
    root.add(group);
    raycastTargets.push(group);
  };

  // =========================================================================
  // 1. CARBON MONOCOQUE, BUTTERFLY STEERING WHEEL & PETRONAS DRIVER HELMET
  // =========================================================================
  const monocoqueGroup = new THREE.Group();

  const tubStations: LoftStation[] = [
    { z: 0.96, cy: 0.36, rx: 0.22, ryTop: 0.15, ryBot: 0.16, power: 2.8 },
    { z: 0.65, cy: 0.39, rx: 0.258, ryTop: 0.185, ryBot: 0.21, power: 3.0 },
    { z: 0.35, cy: 0.40, rx: 0.28, ryTop: 0.18, ryBot: 0.24, power: 3.1 },
    { z: -0.05, cy: 0.39, rx: 0.28, ryTop: 0.16, ryBot: 0.24, power: 3.0 },
    { z: -0.45, cy: 0.38, rx: 0.26, ryTop: 0.19, ryBot: 0.22, power: 2.8 },
  ];
  monocoqueGroup.add(new THREE.Mesh(createLoftedGeometry(tubStations, 40, true, 2), mats.carbonFiber));

  // Brushed Silver Cockpit Coaming Surround & Harness
  for (const side of [-1, 1] as const) {
    const coamingShape = new THREE.Shape();
    coamingShape.moveTo(-0.38, 0.46);
    coamingShape.lineTo(0.45, 0.48);
    coamingShape.lineTo(0.45, 0.60);
    coamingShape.quadraticCurveTo(0.16, 0.63, -0.08, 0.65);
    coamingShape.lineTo(-0.38, 0.67);
    coamingShape.closePath();

    const coamingGeo = new THREE.ExtrudeGeometry(coamingShape, {
      depth: 0.055,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.014,
      bevelSegments: 3,
    });
    coamingGeo.rotateY(Math.PI / 2);
    const coaming = new THREE.Mesh(coamingGeo, mats.obsidianPaint);
    coaming.position.set(side * 0.245 - 0.027, 0, 0);
    monocoqueGroup.add(coaming);

    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.012), mats.harnessStrap);
    strap.position.set(side * 0.075, 0.45, -0.08);
    strap.rotation.x = 0.48;
    monocoqueGroup.add(strap);
  }

  const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.34, 0.04), mats.matteCarbon);
  seatBack.position.set(0, 0.42, -0.14);
  seatBack.rotation.x = 0.44;
  monocoqueGroup.add(seatBack);

  const headrestGeo = new THREE.CylinderGeometry(
    0.185,
    0.195,
    0.11,
    24,
    1,
    false,
    Math.PI * 0.55,
    Math.PI * 0.9,
  );
  const headrest = new THREE.Mesh(headrestGeo, mats.matteCarbon);
  headrest.position.set(0, 0.60, -0.18);
  monocoqueGroup.add(headrest);

  // Driver Helmet in Petronas Teal with Iridescent Visor (matching screenshot-016 & screenshot-001)
  const helmetGroup = new THREE.Group();
  helmetGroup.position.set(0, 0.625, -0.07);
  const helmetMain = new THREE.Mesh(new THREE.SphereGeometry(0.118, 32, 24), mats.helmetShell);
  helmetMain.scale.set(0.92, 1.0, 1.12);
  helmetGroup.add(helmetMain);

  const visorGeo = new THREE.CylinderGeometry(0.122, 0.122, 0.056, 28, 1, true, -0.95, 1.9);
  const visor = new THREE.Mesh(visorGeo, mats.visorGlass);
  visor.position.set(0, 0.012, 0.018);
  helmetGroup.add(visor);

  const visorStrip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.016, 0.07), mats.obsidianPaint);
  visorStrip.position.set(0, 0.052, 0.072);
  helmetGroup.add(visorStrip);
  monocoqueGroup.add(helmetGroup);

  // Butterfly Steering Wheel + OLED Telemetry Screen
  const steeringWheelGroup = new THREE.Group();
  steeringWheelGroup.position.set(0, 0.525, 0.32);
  steeringWheelGroup.rotation.x = -0.36;

  const steerColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.22, 14),
    mats.matteCarbon,
  );
  steerColumn.rotation.x = Math.PI / 2;
  steerColumn.position.z = 0.11;
  steeringWheelGroup.add(steerColumn);

  steeringWheelGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.135, 0.022), mats.carbonFiber));

  const wheelScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.058), mats.steeringDisplay);
  wheelScreen.position.set(0, 0.024, -0.012);
  wheelScreen.rotation.y = Math.PI;
  steeringWheelGroup.add(wheelScreen);

  monocoqueGroup.add(steeringWheelGroup);

  registerPart('monocoque', monocoqueGroup, new THREE.Vector3(0, 0, 0));

  // =========================================================================
  // 2. W17 #63 SILVER & TEAL NOSE CONE
  // =========================================================================
  const noseGroup = new THREE.Group();

  const noseStations: LoftStation[] = [
    { z: 2.84, cy: 0.145, rx: 0.052, ryTop: 0.022, ryBot: 0.018, power: 2.8 },
    { z: 2.55, cy: 0.175, rx: 0.092, ryTop: 0.042, ryBot: 0.032, power: 2.6 },
    { z: 2.15, cy: 0.24, rx: 0.13, ryTop: 0.068, ryBot: 0.054, power: 2.5 },
    { z: 1.72, cy: 0.32, rx: 0.172, ryTop: 0.105, ryBot: 0.098, power: 2.6 },
    { z: 1.30, cy: 0.37, rx: 0.202, ryTop: 0.138, ryBot: 0.135, power: 2.8 },
    { z: 0.96, cy: 0.39, rx: 0.22, ryTop: 0.15, ryBot: 0.155, power: 2.9 },
  ];
  noseGroup.add(new THREE.Mesh(createLoftedGeometry(noseStations, 44, true, 3), mats.nosePaint));

  for (const side of [-1, 1] as const) {
    const camWing = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.016, 0.075), mats.carbonFiber);
    camWing.position.set(side * 0.14, 0.23, 2.24);
    noseGroup.add(camWing);

    const camTip = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.032, 0.09), mats.matteCarbon);
    camTip.position.set(side * 0.195, 0.23, 2.24);
    noseGroup.add(camTip);
  }

  const pitotMast = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.09, 8), mats.titaniumHalo);
  pitotMast.position.set(0, 0.49, 1.44);
  noseGroup.add(pitotMast);
  const pitotProbe = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.11, 8), mats.titaniumHalo);
  pitotProbe.rotation.x = Math.PI / 2;
  pitotProbe.position.set(0, 0.535, 1.49);
  noseGroup.add(pitotProbe);

  for (const side of [-1, 1] as const) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.11, 0.22), mats.carbonFiber);
    pylon.position.set(side * 0.068, 0.13, 2.54);
    noseGroup.add(pylon);
  }

  registerPart('noseCone', noseGroup, new THREE.Vector3(0, 0.18, 0.58));

  // =========================================================================
  // 3. CARBON HALO WITH TEAL EDGE & AMBER-LED WING MIRRORS
  // =========================================================================
  const haloGroup = new THREE.Group();

  for (const side of [-1, 1] as const) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.62, 0.49),
      new THREE.Vector3(0, 0.78, 0.42),
      new THREE.Vector3(side * 0.145, 0.835, 0.24),
      new THREE.Vector3(side * 0.235, 0.825, -0.02),
      new THREE.Vector3(side * 0.255, 0.72, -0.28),
    ]);
    haloGroup.add(new THREE.Mesh(new THREE.TubeGeometry(armCurve, 36, 0.028, 16, false), mats.obsidianPaint));

    // Signature Petronas Teal upper edge highlight on Halo (matching screenshot-001 & screenshot-016)
    const tealEdgeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.02, 0.798, 0.41),
      new THREE.Vector3(side * 0.15, 0.858, 0.24),
      new THREE.Vector3(side * 0.24, 0.848, -0.02),
    ]);
    haloGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(tealEdgeCurve, 20, 0.007, 8, false), mats.petronasTeal),
    );
  }

  const pillarCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.59, 0.52),
    new THREE.Vector3(0, 0.71, 0.47),
    new THREE.Vector3(0, 0.80, 0.40),
  ]);
  haloGroup.add(new THREE.Mesh(new THREE.TubeGeometry(pillarCurve, 18, 0.024, 14, false), mats.obsidianPaint));

  for (const side of [-1, 1] as const) {
    haloGroup.add(
      createAeroStrut(
        new THREE.Vector3(side * 0.27, 0.61, 0.32),
        new THREE.Vector3(side * 0.52, 0.66, 0.30),
        0.008,
        0.032,
        mats.carbonFiber,
      ),
    );

    const mirrorBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.048, 0.075), mats.obsidianPaint);
    mirrorBox.position.set(side * 0.53, 0.67, 0.30);
    haloGroup.add(mirrorBox);

    // Front mirror face with PETRONAS lettering + amber LED matrix
    const mirrorFront = new THREE.Mesh(new THREE.PlaneGeometry(0.138, 0.046), mats.mirrorPod);
    mirrorFront.position.set(side * 0.53, 0.67, 0.339);
    haloGroup.add(mirrorFront);

    // Iconic Petronas Teal top cap on mirror pod
    const mirrorTealCap = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.012, 0.072), mats.petronasTeal);
    mirrorTealCap.position.set(side * 0.53, 0.696, 0.30);
    haloGroup.add(mirrorTealCap);
  }

  registerPart('halo', haloGroup, new THREE.Vector3(0, 0.62, 0.12));

  // =========================================================================
  // 4. PETRONAS SIDEPODS, MULTI-TIER SIGNIFY FLOOR VANES & RADIATORS
  // =========================================================================
  for (const side of [-1, 1] as const) {
    const podGroup = new THREE.Group();
    const podStations: LoftStation[] = [
      { z: 0.48, cx: side * 0.44, cy: 0.45, rx: 0.19, ryTop: 0.12, ryBot: 0.07, power: 2.9 },
      { z: 0.20, cx: side * 0.48, cy: 0.42, rx: 0.245, ryTop: 0.165, ryBot: 0.145, power: 2.8 },
      { z: -0.25, cx: side * 0.45, cy: 0.37, rx: 0.235, ryTop: 0.16, ryBot: 0.175, power: 2.6 },
      { z: -0.80, cx: side * 0.36, cy: 0.30, rx: 0.185, ryTop: 0.135, ryBot: 0.155, power: 2.4 },
      { z: -1.35, cx: side * 0.24, cy: 0.25, rx: 0.11, ryTop: 0.095, ryBot: 0.115, power: 2.2 },
      { z: -1.68, cx: side * 0.15, cy: 0.23, rx: 0.055, ryTop: 0.05, ryBot: 0.06, power: 2.0 },
    ];
    podGroup.add(
      new THREE.Mesh(
        createLoftedGeometry(podStations, 42, true, 2),
        side === 1 ? mats.sidepodRightPaint : mats.sidepodLeftPaint,
      ),
    );

    const inletRim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.13, 0.07), mats.matteCarbon);
    inletRim.position.set(side * 0.44, 0.435, 0.47);
    inletRim.rotation.y = side * -0.18;
    podGroup.add(inletRim);

    const overbite = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.022, 0.16), mats.obsidianPaint);
    overbite.position.set(side * 0.44, 0.51, 0.52);
    overbite.rotation.y = side * -0.18;
    podGroup.add(overbite);

    const overbiteTeal = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.012, 0.025), mats.petronasTeal);
    overbiteTeal.position.set(side * 0.44, 0.518, 0.59);
    overbiteTeal.rotation.y = side * -0.18;
    podGroup.add(overbiteTeal);

    // Multi-tier Signify Bargeboard Floor Fence (matching screenshot-001 & screenshot-003)
    const fenceShape = new THREE.Shape();
    fenceShape.moveTo(0, 0);
    fenceShape.lineTo(0.48, 0.02);
    fenceShape.lineTo(0.45, 0.30);
    fenceShape.lineTo(0.04, 0.24);
    fenceShape.closePath();

    const fenceGeo = new THREE.ExtrudeGeometry(fenceShape, {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    });
    fenceGeo.rotateY(Math.PI / 2);
    normalizeSideExtrudeUVs(fenceGeo, side === 1);
    const fence = new THREE.Mesh(fenceGeo, mats.signifyFence);
    fence.position.set(side * 0.675 - 0.007, 0.095, 0.34);
    podGroup.add(fence);

    // Horizontal louvre slats protruding from floor fence
    for (let s = 0; s < 3; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.42), mats.carbonFiber);
      slat.position.set(side * 0.68, 0.14 + s * 0.045, 0.12);
      podGroup.add(slat);
    }

    registerPart('sidepods', podGroup, new THREE.Vector3(side * 0.72, 0.08, 0));

    // Internal Angled Radiator Core (exposed in Exploded View)
    const radGroup = new THREE.Group();
    const radCore = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.78), mats.radiatorCore);
    radCore.position.set(side * 0.38, 0.36, 0.02);
    radCore.rotation.z = side * -0.28;
    radCore.rotation.y = side * 0.14;
    radGroup.add(radCore);

    const radFrame = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.275, 0.06), mats.matteCarbon);
    radFrame.position.set(side * 0.41, 0.39, 0.38);
    radFrame.rotation.z = side * -0.28;
    radFrame.rotation.y = side * 0.14;
    radGroup.add(radFrame);

    registerPart('sidepods', radGroup, new THREE.Vector3(side * 0.36, 0.04, 0));
  }

  // =========================================================================
  // 5. TEAL-COLLAR AIRBOX, T-CAM & STAR-MOSAIC #63 DORSAL FIN ENGINE COVER
  // =========================================================================
  const engineCoverGroup = new THREE.Group();

  const coverStations: LoftStation[] = [
    { z: -0.20, cy: 0.65, rx: 0.24, ryTop: 0.31, ryBot: 0.18, power: 2.3 },
    { z: -0.60, cy: 0.58, rx: 0.22, ryTop: 0.28, ryBot: 0.16, power: 2.2 },
    { z: -1.10, cy: 0.50, rx: 0.17, ryTop: 0.22, ryBot: 0.12, power: 2.2 },
    { z: -1.56, cy: 0.41, rx: 0.12, ryTop: 0.15, ryBot: 0.09, power: 2.1 },
    { z: -1.88, cy: 0.36, rx: 0.08, ryTop: 0.095, ryBot: 0.065, power: 2.0 },
  ];
  engineCoverGroup.add(new THREE.Mesh(createLoftedGeometry(coverStations, 42, true, 2), mats.engineCoverPaint));

  // Petronas Teal Collar Ring around Roll-Hoop Airbox Intake (matching screenshot-016 & screenshot-001!)
  const airboxStations: LoftStation[] = [
    { z: -0.14, cy: 0.87, rx: 0.122, ryTop: 0.095, ryBot: 0.085, power: 2.6 },
    { z: -0.32, cy: 0.86, rx: 0.14, ryTop: 0.108, ryBot: 0.092, power: 2.4 },
    { z: -0.54, cy: 0.81, rx: 0.12, ryTop: 0.09, ryBot: 0.08, power: 2.2 },
  ];
  engineCoverGroup.add(new THREE.Mesh(createLoftedGeometry(airboxStations, 30, true, 1), mats.obsidianPaint));

  const airboxCollarGeo = new THREE.TorusGeometry(0.098, 0.014, 12, 28);
  airboxCollarGeo.scale(1.15, 0.88, 1.0);
  const airboxCollar = new THREE.Mesh(airboxCollarGeo, mats.petronasTeal);
  airboxCollar.position.set(0, 0.87, -0.135);
  engineCoverGroup.add(airboxCollar);

  const airboxIntake = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.045, 24), mats.matteCarbon);
  airboxIntake.rotation.x = Math.PI / 2;
  airboxIntake.scale.set(1.12, 1, 0.85);
  airboxIntake.position.set(0, 0.87, -0.145);
  engineCoverGroup.add(airboxIntake);

  // Broadcast Overhead T-Cam Pod
  const tCamStalk = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.09, 0.06), mats.matteCarbon);
  tCamStalk.position.set(0, 1.00, -0.22);
  engineCoverGroup.add(tCamStalk);
  const tCamCross = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.024, 0.065), mats.matteCarbon);
  tCamCross.position.set(0, 1.055, -0.22);
  engineCoverGroup.add(tCamCross);
  for (const side of [-1, 1] as const) {
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.01, 12), mats.visorGlass);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(side * 0.105, 1.055, -0.185);
    engineCoverGroup.add(lens);
  }

  // Swept Dorsal Shark Fin (POSITIVE x -> z' = -x puts fin properly along REAR z = -0.34 .. -1.78!)
  const finShape = new THREE.Shape();
  finShape.moveTo(0.34, 0.96);
  finShape.lineTo(1.52, 0.76);
  finShape.lineTo(1.80, 0.44);
  finShape.lineTo(0.34, 0.64);
  finShape.closePath();

  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  finGeo.rotateY(Math.PI / 2);
  const sharkFin = new THREE.Mesh(finGeo, mats.obsidianPaint);
  sharkFin.position.set(-0.009, 0, 0);
  engineCoverGroup.add(sharkFin);

  for (const side of [-1, 1] as const) {
    const finNum = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.23), mats.sharkFinNumber);
    finNum.position.set(side * 0.015, 0.65, -1.48);
    finNum.rotation.y = side * (Math.PI / 2);
    engineCoverGroup.add(finNum);
  }

  registerPart('engineCover', engineCoverGroup, new THREE.Vector3(0, 0.88, -0.10));

  // =========================================================================
  // 6. INTERNAL 1.6L V6 TURBO-HYBRID POWER UNIT & GEARBOX
  // =========================================================================
  const powerUnitGroup = new THREE.Group();

  const batteryPack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.44), mats.matteCarbon);
  batteryPack.position.set(0, 0.22, -0.48);
  powerUnitGroup.add(batteryPack);
  const goldFoilTop = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.015, 0.38), mats.goldHeatShield);
  goldFoilTop.position.set(0, 0.295, -0.48);
  powerUnitGroup.add(goldFoilTop);

  const crankcase = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.20, 0.56), mats.engineBlockMetal);
  crankcase.position.set(0, 0.29, -1.02);
  powerUnitGroup.add(crankcase);

  for (const side of [-1, 1] as const) {
    const bank = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.52), mats.engineBlockMetal);
    bank.position.set(side * 0.125, 0.40, -1.02);
    bank.rotation.z = side * -0.68;
    powerUnitGroup.add(bank);

    const valveCover = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.045, 0.50), mats.petronasTeal);
    valveCover.position.set(side * 0.175, 0.46, -1.02);
    valveCover.rotation.z = side * -0.68;
    powerUnitGroup.add(valveCover);

    for (let c = 0; c < 3; c++) {
      const zCyl = -0.82 - c * 0.17;
      const headerCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.21, 0.37, zCyl),
        new THREE.Vector3(side * 0.26, 0.34, zCyl - 0.12),
        new THREE.Vector3(side * 0.12, 0.36, -1.36),
        new THREE.Vector3(0, 0.39, -1.46),
      ]);
      powerUnitGroup.add(
        new THREE.Mesh(new THREE.TubeGeometry(headerCurve, 18, 0.018, 10, false), mats.exhaustMetal),
      );
    }
  }

  const plenum = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.10, 0.50, 18), mats.carbonFiber);
  plenum.rotation.x = Math.PI / 2;
  plenum.position.set(0, 0.54, -1.00);
  powerUnitGroup.add(plenum);

  const turboCompressor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.095, 0.09, 24),
    mats.engineBlockMetal,
  );
  turboCompressor.rotation.x = Math.PI / 2;
  turboCompressor.position.set(0, 0.42, -1.36);
  powerUnitGroup.add(turboCompressor);

  const turboTurbine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.10, 24),
    mats.exhaustMetal,
  );
  turboTurbine.rotation.x = Math.PI / 2;
  turboTurbine.position.set(0, 0.40, -1.49);
  powerUnitGroup.add(turboTurbine);

  const mguk = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 16), mats.petronasTeal);
  mguk.rotation.x = Math.PI / 2;
  mguk.position.set(-0.18, 0.24, -1.04);
  powerUnitGroup.add(mguk);

  // Extended Gearbox Casing cleanly reaching rear crash spine
  const gearboxStations: LoftStation[] = [
    { z: -1.32, cy: 0.29, rx: 0.135, ryTop: 0.12, ryBot: 0.11, power: 2.6 },
    { z: -1.62, cy: 0.28, rx: 0.115, ryTop: 0.10, ryBot: 0.10, power: 2.5 },
    { z: -1.92, cy: 0.27, rx: 0.095, ryTop: 0.09, ryBot: 0.09, power: 2.4 },
  ];
  powerUnitGroup.add(new THREE.Mesh(createLoftedGeometry(gearboxStations, 24, true, 1), mats.carbonFiber));

  registerPart('powerUnit', powerUnitGroup, new THREE.Vector3(0, 0.26, -0.22));

  // =========================================================================
  // 7. GROUND-EFFECT VENTURI FLOOR & MULTI-STRAKE DIFFUSER
  // =========================================================================
  const floorGroup = new THREE.Group();

  const floorShape = new THREE.Shape();
  floorShape.moveTo(0, 0.94);
  floorShape.lineTo(0.39, 0.77);
  floorShape.lineTo(0.80, 0.54);
  floorShape.lineTo(0.80, -1.35);
  floorShape.lineTo(0.56, -1.52);
  floorShape.lineTo(0.54, -2.04);
  floorShape.lineTo(-0.54, -2.04);
  floorShape.lineTo(-0.56, -1.52);
  floorShape.lineTo(-0.80, -1.35);
  floorShape.lineTo(-0.80, 0.54);
  floorShape.lineTo(-0.39, 0.77);
  floorShape.closePath();

  const floorGeo = new THREE.ExtrudeGeometry(floorShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 2,
  });
  floorGeo.rotateX(Math.PI / 2);
  const floorDeck = new THREE.Mesh(floorGeo, mats.carbonFiber);
  floorDeck.position.set(0, 0.068, 0);
  floorGroup.add(floorDeck);

  for (const side of [-1, 1] as const) {
    const edgeWing = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.044, 1.56), mats.obsidianPaint);
    edgeWing.position.set(side * 0.80, 0.09, -0.45);
    edgeWing.rotation.z = side * -0.24;
    floorGroup.add(edgeWing);

    const edgeStripe = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.012, 1.48), mats.petronasTeal);
    edgeStripe.position.set(side * 0.81, 0.105, -0.45);
    floorGroup.add(edgeStripe);

    for (let v = 0; v < 5; v++) {
      const strake = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.036, 0.015), mats.carbonFiber);
      strake.position.set(side * 0.82, 0.075, -0.15 - v * 0.14);
      strake.rotation.y = side * -0.52;
      floorGroup.add(strake);
    }

    for (let f = 0; f < 4; f++) {
      const fence = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.135, 0.36), mats.carbonFiber);
      fence.position.set(side * (0.30 + f * 0.145), 0.115, 0.46 - f * 0.045);
      fence.rotation.y = side * (0.12 + f * 0.07);
      floorGroup.add(fence);
    }
  }

  const diffuserRamp = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.025, 0.56), mats.carbonFiber);
  diffuserRamp.position.set(0, 0.145, -1.96);
  diffuserRamp.rotation.x = 0.28;
  floorGroup.add(diffuserRamp);

  for (let i = -3; i <= 3; i++) {
    const strake = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.175, 0.44), mats.matteCarbon);
    strake.position.set(i * 0.155, 0.13, -1.98);
    floorGroup.add(strake);
  }

  const tTray = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.024, 0.48), mats.titaniumHalo);
  tTray.position.set(0, 0.055, 1.05);
  floorGroup.add(tTray);

  registerPart('floor', floorGroup, new THREE.Vector3(0, -0.45, 0));

  // =========================================================================
  // 8. V-SWEPT MULTI-ELEMENT FRONT WING CASCADE (Attached endplates at z=2.72..2.22)
  // =========================================================================
  const frontWingGroup = new THREE.Group();

  const mainplaneGeo = createAirfoilWingGeometry({
    span: 1.96,
    chord: 0.24,
    thickness: 0.12,
    camber: 0.075,
    angleOfAttackRad: 0.10,
    sweepBack: 0.28,
    dihedral: 0.025,
    gullArch: 0.022,
    taper: 0.84,
  });
  const mainplane = new THREE.Mesh(mainplaneGeo, mats.carbonFiber);
  mainplane.position.set(0, 0.095, 2.72);
  frontWingGroup.add(mainplane);

  const flapConfigs = [
    { chord: 0.175, y: 0.132, z: 2.58, aoa: 0.22, mat: mats.frontFlap0 },
    { chord: 0.15, y: 0.174, z: 2.46, aoa: 0.34, mat: mats.frontFlap1 },
    { chord: 0.12, y: 0.215, z: 2.35, aoa: 0.45, mat: mats.frontFlap2 },
  ];
  flapConfigs.forEach((cfg) => {
    const fGeo = createAirfoilWingGeometry({
      span: 1.92,
      chord: cfg.chord,
      thickness: 0.10,
      camber: 0.065,
      angleOfAttackRad: cfg.aoa,
      sweepBack: 0.27,
      dihedral: 0.032,
      gullArch: 0.018,
      taper: 0.72,
    });
    const flap = new THREE.Mesh(fGeo, cfg.mat);
    flap.position.set(0, cfg.y, cfg.z);
    frontWingGroup.add(flap);
  });

  // Curved Outwash Endplates spanning exact outer wing tips (z' = 2.62 back to 2.12)
  for (const side of [-1, 1] as const) {
    for (const bx of [0.34, 0.66]) {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.095, 0.24), mats.titaniumHalo);
      bracket.position.set(side * bx, 0.155, 2.42 - bx * 0.15);
      frontWingGroup.add(bracket);
    }

    const epShape = new THREE.Shape();
    epShape.moveTo(0, 0);
    epShape.lineTo(0.50, 0);
    epShape.quadraticCurveTo(0.47, 0.22, 0.28, 0.25);
    epShape.quadraticCurveTo(0.10, 0.26, 0.02, 0.25);
    epShape.closePath();

    const epGeo = new THREE.ExtrudeGeometry(epShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.005,
      bevelSegments: 3,
    });
    epGeo.rotateY(Math.PI / 2);
    normalizeSideExtrudeUVs(epGeo, side === 1);
    const endplate = new THREE.Mesh(epGeo, mats.frontEndplate);
    endplate.position.set(side * 0.96 - 0.009, 0.085, 2.58);
    endplate.rotation.y = side * -0.09;
    endplate.rotation.z = side * -0.14;
    frontWingGroup.add(endplate);

    const diveplane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.20), mats.carbonFiber);
    diveplane.position.set(side * 1.00, 0.18, 2.33);
    diveplane.rotation.x = 0.24;
    frontWingGroup.add(diveplane);
  }

  registerPart('frontWing', frontWingGroup, new THREE.Vector3(0, -0.05, 0.95));

  // =========================================================================
  // 9. REAR WING ASSEMBLY SEAMLESSLY BOLTED TO GEARBOX & CRASH STRUCTURE
  //    (Aligned tightly at z = -1.78 .. -2.24, zero detached pylons!)
  // =========================================================================
  const rearWingGroup = new THREE.Group();

  // Twin Sculpted Swan-Neck Pylons (built via ExtrudeGeometry with exact z'=-x so they lock onto z=-1.75..-2.02!)
  for (const side of [-1, 1] as const) {
    const pylonShape = new THREE.Shape();
    pylonShape.moveTo(1.74, 0.44);
    pylonShape.lineTo(1.88, 0.44);
    pylonShape.quadraticCurveTo(1.94, 0.72, 2.02, 0.89);
    pylonShape.lineTo(1.92, 0.89);
    pylonShape.quadraticCurveTo(1.83, 0.72, 1.74, 0.44);

    const pylonGeo = new THREE.ExtrudeGeometry(pylonShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    });
    pylonGeo.rotateY(Math.PI / 2);
    const pylon = new THREE.Mesh(pylonGeo, mats.carbonFiber);
    pylon.position.set(side * 0.088 - 0.009, 0, 0);
    rearWingGroup.add(pylon);
  }

  // Bi-plane Beam Wing anchored cleanly around crash box (z = -1.96)
  const beamGeo = createAirfoilWingGeometry({
    span: 0.94,
    chord: 0.18,
    thickness: 0.11,
    camber: 0.06,
    angleOfAttackRad: 0.34,
  });
  const beamWing = new THREE.Mesh(beamGeo, mats.carbonFiber);
  beamWing.position.set(0, 0.42, -1.96);
  rearWingGroup.add(beamWing);

  // Rear Wing Mainplane (z = -1.96)
  const rwMainGeo = createAirfoilWingGeometry({
    span: 1.05,
    chord: 0.24,
    thickness: 0.12,
    camber: 0.08,
    angleOfAttackRad: 0.26,
    dihedral: 0.02,
    gullArch: 0.015,
  });
  const rwMain = new THREE.Mesh(rwMainGeo, mats.carbonFiber);
  rwMain.position.set(0, 0.84, -1.96);
  rearWingGroup.add(rwMain);

  // Active DRS Flap + Central Actuator Pod (z = -2.14)
  const drsFlapPivot = new THREE.Group();
  drsFlapPivot.position.set(0, 0.935, -2.14);

  const drsFlapGeo = createAirfoilWingGeometry({
    span: 1.02,
    chord: 0.18,
    thickness: 0.10,
    camber: 0.055,
    angleOfAttackRad: 0.56,
  });
  const drsFlapMesh = new THREE.Mesh(drsFlapGeo, mats.rearWingDrs);
  drsFlapMesh.position.set(0, -0.028, 0.075);
  drsFlapPivot.add(drsFlapMesh);

  const drsPod = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.045, 0.14), mats.obsidianPaint);
  drsPod.position.set(0, 0.015, 0.09);
  drsFlapPivot.add(drsPod);

  rearWingGroup.add(drsFlapPivot);

  // Rear Wing Endplates aligned seamlessly from z = -1.72 to z = -2.18 + vertical LED rain strips!
  for (const side of [-1, 1] as const) {
    const rEpShape = new THREE.Shape();
    rEpShape.moveTo(0, 0.36);
    rEpShape.lineTo(0.46, 0.36);
    rEpShape.lineTo(0.46, 0.98);
    rEpShape.lineTo(0.06, 0.98);
    rEpShape.quadraticCurveTo(-0.04, 0.68, 0, 0.36);

    const rEpGeo = new THREE.ExtrudeGeometry(rEpShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    rEpGeo.rotateY(Math.PI / 2);
    normalizeSideExtrudeUVs(rEpGeo, side === 1);
    const rEp = new THREE.Mesh(rEpGeo, mats.rearEndplate);
    rEp.position.set(side * 0.528 - 0.009, 0, -1.72);
    rearWingGroup.add(rEp);

    // Glowing Vertical Red LED Strip along Rear Wing Endplate Trailing Edge (screenshot-003 & screenshot-007)
    const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.28, 0.016), mats.endplateLed);
    ledStrip.position.set(side * 0.528, 0.80, -2.182);
    rearWingGroup.add(ledStrip);
  }

  registerPart('rearWing', rearWingGroup, new THREE.Vector3(0, 0.35, -0.78));

  // =========================================================================
  // 10. INCONEL TAILPIPE & FIA REAR CRASH STRUCTURE / RING LED RAIN LIGHT
  // =========================================================================
  const exhaustGroup = new THREE.Group();

  const crashBox = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.16, 0.44), mats.carbonFiber);
  crashBox.position.set(0, 0.24, -1.94);
  exhaustGroup.add(crashBox);

  const rainLight = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.115, 0.024), mats.rainLight);
  rainLight.position.set(0, 0.24, -2.165);
  exhaustGroup.add(rainLight);

  const tailpipeGeo = new THREE.CylinderGeometry(0.062, 0.070, 0.36, 30, 1, true);
  tailpipeGeo.rotateX(Math.PI / 2);
  const tailpipe = new THREE.Mesh(tailpipeGeo, mats.exhaustMetal);
  tailpipe.position.set(0, 0.40, -1.86);
  exhaustGroup.add(tailpipe);

  const bore = new THREE.Mesh(new THREE.CircleGeometry(0.058, 24), mats.matteCarbon);
  bore.position.set(0, 0.40, -2.02);
  bore.rotation.y = Math.PI;
  exhaustGroup.add(bore);

  for (const side of [-1, 1] as const) {
    const wgGeo = new THREE.CylinderGeometry(0.022, 0.025, 0.22, 16);
    wgGeo.rotateX(Math.PI / 2);
    const wg = new THREE.Mesh(wgGeo, mats.exhaustMetal);
    wg.position.set(side * 0.085, 0.35, -1.88);
    exhaustGroup.add(wg);
  }

  registerPart('exhaust', exhaustGroup, new THREE.Vector3(0, 0.12, -0.54));

  // =========================================================================
  // 11. FRONT & REAR DOUBLE-WISHBONE SUSPENSION
  // =========================================================================
  const frontSuspGroup = new THREE.Group();
  const rearSuspGroup = new THREE.Group();

  const fZ = 1.72;
  const fX = 0.78;
  const rZ = -1.78;
  const rX = 0.76;

  const frontRockerBar = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.18), mats.titaniumHalo);
  frontRockerBar.position.set(0, 0.44, fZ);
  frontSuspGroup.add(frontRockerBar);

  for (const side of [-1, 1] as const) {
    const fHubTop = new THREE.Vector3(side * fX, 0.44, fZ);
    const fHubBot = new THREE.Vector3(side * fX, 0.25, fZ);
    frontSuspGroup.add(
      createAeroStrut(new THREE.Vector3(side * 0.16, 0.42, fZ + 0.20), fHubTop, 0.011, 0.036, mats.carbonFiber),
    );
    frontSuspGroup.add(
      createAeroStrut(new THREE.Vector3(side * 0.16, 0.40, fZ - 0.22), fHubTop, 0.011, 0.036, mats.carbonFiber),
    );
    frontSuspGroup.add(
      createAeroStrut(new THREE.Vector3(side * 0.14, 0.21, fZ + 0.22), fHubBot, 0.012, 0.04, mats.carbonFiber),
    );
    frontSuspGroup.add(
      createAeroStrut(new THREE.Vector3(side * 0.14, 0.20, fZ - 0.22), fHubBot, 0.012, 0.04, mats.carbonFiber),
    );
    frontSuspGroup.add(
      createAeroStrut(new THREE.Vector3(side * 0.15, 0.46, fZ + 0.04), fHubBot, 0.009, 0.022, mats.carbonFiber),
    );
    frontSuspGroup.add(
      createAeroStrut(
        new THREE.Vector3(side * 0.15, 0.33, fZ - 0.09),
        new THREE.Vector3(side * fX, 0.35, fZ - 0.09),
        0.008,
        0.018,
        mats.titaniumHalo,
      ),
    );

    const rHubTop = new THREE.Vector3(side * rX, 0.44, rZ);
    const rHubBot = new THREE.Vector3(side * rX, 0.25, rZ);
    rearSuspGroup.add(
      createAeroStrut(new THREE.Vector3(side * 0.11, 0.40, rZ + 0.24), rHubTop, 0.011, 0.036, mats.carbonFiber),
    );
    rearSuspGroup.add(
      createAeroStrut(new THREE.Vector3(side * 0.10, 0.38, rZ - 0.22), rHubTop, 0.011, 0.036, mats.carbonFiber),
    );
    rearSuspGroup.add(
      createAeroStrut(new THREE.Vector3(side * 0.12, 0.20, rZ + 0.24), rHubBot, 0.012, 0.042, mats.carbonFiber),
    );
    rearSuspGroup.add(
      createAeroStrut(new THREE.Vector3(side * 0.10, 0.19, rZ - 0.22), rHubBot, 0.012, 0.042, mats.carbonFiber),
    );
    rearSuspGroup.add(
      createAeroStrut(new THREE.Vector3(side * 0.11, 0.20, rZ + 0.02), rHubTop, 0.009, 0.022, mats.carbonFiber),
    );
    rearSuspGroup.add(
      createAeroStrut(
        new THREE.Vector3(side * 0.09, 0.34, rZ),
        new THREE.Vector3(side * rX, 0.36, rZ),
        0.015,
        0.015,
        mats.titaniumHalo,
      ),
    );
  }

  registerPart('frontSuspension', frontSuspGroup, new THREE.Vector3(0, 0.10, 0.28));
  registerPart('rearSuspension', rearSuspGroup, new THREE.Vector3(0, 0.06, -0.34));

  // =========================================================================
  // 12. CARBON-CERAMIC BRAKES & 18-INCH 7-SPOKE FORGED PIRELLI WHEELS
  // =========================================================================
  const wheelConfigs: Array<{
    isFront: boolean;
    side: 1 | -1;
    pos: [number, number, number];
    brakeExplode: [number, number, number];
    wheelExplode: [number, number, number];
  }> = [
    {
      isFront: true,
      side: 1,
      pos: [0.82, 0.36, 1.72],
      brakeExplode: [0.42, 0.0, 0.08],
      wheelExplode: [0.88, 0.0, 0.16],
    },
    {
      isFront: true,
      side: -1,
      pos: [-0.82, 0.36, 1.72],
      brakeExplode: [-0.42, 0.0, 0.08],
      wheelExplode: [-0.88, 0.0, 0.16],
    },
    {
      isFront: false,
      side: 1,
      pos: [0.80, 0.36, -1.78],
      brakeExplode: [0.42, 0.0, -0.08],
      wheelExplode: [0.88, 0.0, -0.16],
    },
    {
      isFront: false,
      side: -1,
      pos: [-0.80, 0.36, -1.78],
      brakeExplode: [-0.42, 0.0, -0.08],
      wheelExplode: [-0.88, 0.0, -0.16],
    },
  ];

  wheelConfigs.forEach((wc) => {
    const brakeGroup = buildBrakeAssembly(wc.isFront, wc.side, mats);
    brakeGroup.position.set(...wc.pos);
    registerPart('brakes', brakeGroup, new THREE.Vector3(...wc.brakeExplode));

    const { wheelGroup, spinGroup } = buildWheelTireAssembly(wc.isFront, wc.side, mats);
    wheelGroup.position.set(...wc.pos);
    wheelSpinGroups.push(spinGroup);
    registerPart('wheels', wheelGroup, new THREE.Vector3(...wc.wheelExplode));
  });

  // =========================================================================
  // 13. EXPLODED VIEW CAD GUIDE LINES
  // =========================================================================
  const guidePositions = new Float32Array(explodableParts.length * 6);
  const guideGeo = new THREE.BufferGeometry();
  guideGeo.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
  const guideMat = new THREE.LineBasicMaterial({
    color: '#64748b',
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const explosionGuides = new THREE.LineSegments(guideGeo, guideMat);
  explosionGuides.visible = false;
  explosionGuides.frustumCulled = false;
  root.add(explosionGuides);

  return {
    root,
    explodableParts,
    partGroupsByKey,
    wheelSpinGroups,
    drsFlapPivot,
    rainLightMat: mats.rainLight,
    explosionGuides,
    raycastTargets,
    dispose() {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.LineSegments).isLineSegments) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
      guideMat.dispose();
    },
  };
}
