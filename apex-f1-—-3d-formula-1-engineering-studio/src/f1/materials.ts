import * as THREE from 'three';
import {
  createBrakeRotorTexture,
  createCarbonFiberTextures,
  createRadiatorTexture,
  createRainLightMatrixTexture,
  createSteeringDisplayTexture,
  createTireSidewallTexture,
  createTireTreadTexture,
  createW17EngineCoverTexture,
  createW17ForgedWheelTexture,
  createW17FrontEndplateTexture,
  createW17FrontWingFlapTexture,
  createW17MirrorTexture,
  createW17NoseTexture,
  createW17RearEndplateTexture,
  createW17RearWingDrsTexture,
  createW17SharkFinNumberTexture,
  createW17SidepodTexture,
  createW17SignifyFenceTexture,
} from './textures';
import { TireCompound } from './types';

export interface F1MaterialSet {
  obsidianPaint: THREE.MeshPhysicalMaterial;
  brushedSilver: THREE.MeshPhysicalMaterial;
  petronasTeal: THREE.MeshPhysicalMaterial;
  ineosRed: THREE.MeshPhysicalMaterial;
  nosePaint: THREE.MeshPhysicalMaterial;
  sidepodRightPaint: THREE.MeshPhysicalMaterial;
  sidepodLeftPaint: THREE.MeshPhysicalMaterial;
  engineCoverPaint: THREE.MeshPhysicalMaterial;
  sharkFinNumber: THREE.MeshPhysicalMaterial;
  frontFlap0: THREE.MeshPhysicalMaterial;
  frontFlap1: THREE.MeshPhysicalMaterial;
  frontFlap2: THREE.MeshPhysicalMaterial;
  frontEndplate: THREE.MeshPhysicalMaterial;
  rearWingDrs: THREE.MeshPhysicalMaterial;
  rearEndplate: THREE.MeshPhysicalMaterial;
  signifyFence: THREE.MeshPhysicalMaterial;
  mirrorPod: THREE.MeshPhysicalMaterial;
  carbonFiber: THREE.MeshPhysicalMaterial;
  matteCarbon: THREE.MeshStandardMaterial;
  whiteTrim: THREE.MeshStandardMaterial;
  titaniumHalo: THREE.MeshPhysicalMaterial;
  exhaustMetal: THREE.MeshPhysicalMaterial;
  engineBlockMetal: THREE.MeshStandardMaterial;
  goldHeatShield: THREE.MeshPhysicalMaterial;
  radiatorCore: THREE.MeshStandardMaterial;
  tireTread: THREE.MeshStandardMaterial;
  tireSidewall: THREE.MeshStandardMaterial;
  wheelFace: THREE.MeshPhysicalMaterial;
  wheelRim: THREE.MeshStandardMaterial;
  wheelNut: THREE.MeshStandardMaterial;
  wheelHubTip: THREE.MeshStandardMaterial;
  brakeDisc: THREE.MeshStandardMaterial;
  brakeCaliper: THREE.MeshStandardMaterial;
  visorGlass: THREE.MeshPhysicalMaterial;
  helmetShell: THREE.MeshPhysicalMaterial;
  rainLight: THREE.MeshStandardMaterial;
  endplateLed: THREE.MeshStandardMaterial;
  steeringDisplay: THREE.MeshBasicMaterial;
  harnessStrap: THREE.MeshStandardMaterial;
  allMaterials: THREE.Material[];
  updateTireCompound: (compound: TireCompound) => void;
  dispose: () => void;
}

export function createF1Materials(
  initialCompound: TireCompound,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): F1MaterialSet {
  const carbonTex = createCarbonFiberTextures(maxAnisotropy);
  const radiatorTex = createRadiatorTexture(maxAnisotropy);
  const steerTex = createSteeringDisplayTexture();
  const rotorTex = createBrakeRotorTexture(maxAnisotropy);
  const rainTex = createRainLightMatrixTexture();

  const noseTex = createW17NoseTexture(maxAnisotropy);
  const sidepodRightTex = createW17SidepodTexture(1, maxAnisotropy);
  const sidepodLeftTex = createW17SidepodTexture(-1, maxAnisotropy);
  const engineCoverTex = createW17EngineCoverTexture(maxAnisotropy);
  const sharkFinTex = createW17SharkFinNumberTexture(maxAnisotropy);
  const flap0Tex = createW17FrontWingFlapTexture(0, maxAnisotropy);
  const flap1Tex = createW17FrontWingFlapTexture(1, maxAnisotropy);
  const flap2Tex = createW17FrontWingFlapTexture(2, maxAnisotropy);
  const frontEpTex = createW17FrontEndplateTexture(maxAnisotropy);
  const rearDrsTex = createW17RearWingDrsTexture(maxAnisotropy);
  const rearEpTex = createW17RearEndplateTexture(maxAnisotropy);
  const signifyTex = createW17SignifyFenceTexture(maxAnisotropy);
  const wheelFaceTex = createW17ForgedWheelTexture(maxAnisotropy);
  const mirrorTex = createW17MirrorTexture(maxAnisotropy);

  let sidewallTex = createTireSidewallTexture(
    initialCompound.stripeHex,
    initialCompound.code,
    maxAnisotropy,
  );
  let treadTex = createTireTreadTexture(initialCompound.grooved, maxAnisotropy);

  const obsidianPaint = new THREE.MeshPhysicalMaterial({
    color: '#0e1116',
    roughness: 0.16,
    metalness: 0.25,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.35,
  });

  const brushedSilver = new THREE.MeshPhysicalMaterial({
    color: '#ccd3db',
    roughness: 0.15,
    metalness: 0.88,
    clearcoat: 0.9,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.4,
  });

  const petronasTeal = new THREE.MeshPhysicalMaterial({
    color: '#00d2be',
    roughness: 0.16,
    metalness: 0.35,
    clearcoat: 0.95,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.25,
  });

  const ineosRed = new THREE.MeshPhysicalMaterial({
    color: '#c8102e',
    roughness: 0.2,
    metalness: 0.2,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
  });

  const nosePaint = new THREE.MeshPhysicalMaterial({
    map: noseTex,
    roughness: 0.18,
    metalness: 0.48,
    clearcoat: 0.96,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.35,
  });

  const sidepodRightPaint = new THREE.MeshPhysicalMaterial({
    map: sidepodRightTex,
    roughness: 0.16,
    metalness: 0.32,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.35,
  });

  const sidepodLeftPaint = new THREE.MeshPhysicalMaterial({
    map: sidepodLeftTex,
    roughness: 0.16,
    metalness: 0.32,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.35,
  });

  const engineCoverPaint = new THREE.MeshPhysicalMaterial({
    map: engineCoverTex,
    roughness: 0.14,
    metalness: 0.24,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.38,
  });

  const sharkFinNumber = new THREE.MeshPhysicalMaterial({
    map: sharkFinTex,
    transparent: true,
    roughness: 0.2,
    clearcoat: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const frontFlap0 = new THREE.MeshPhysicalMaterial({
    map: flap0Tex,
    roughness: 0.22,
    metalness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
  });

  const frontFlap1 = new THREE.MeshPhysicalMaterial({
    map: flap1Tex,
    roughness: 0.22,
    metalness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
  });

  const frontFlap2 = new THREE.MeshPhysicalMaterial({
    map: flap2Tex,
    roughness: 0.22,
    metalness: 0.2,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
  });

  const frontEndplate = new THREE.MeshPhysicalMaterial({
    map: frontEpTex,
    roughness: 0.24,
    metalness: 0.2,
    clearcoat: 0.85,
  });

  const rearWingDrs = new THREE.MeshPhysicalMaterial({
    map: rearDrsTex,
    roughness: 0.2,
    metalness: 0.22,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
  });

  const rearEndplate = new THREE.MeshPhysicalMaterial({
    map: rearEpTex,
    roughness: 0.24,
    metalness: 0.22,
    clearcoat: 0.85,
  });

  const signifyFence = new THREE.MeshPhysicalMaterial({
    map: signifyTex,
    roughness: 0.26,
    metalness: 0.2,
    clearcoat: 0.8,
  });

  const mirrorPod = new THREE.MeshPhysicalMaterial({
    map: mirrorTex,
    roughness: 0.2,
    metalness: 0.22,
    clearcoat: 0.9,
  });

  const carbonFiber = new THREE.MeshPhysicalMaterial({
    map: carbonTex.map,
    bumpMap: carbonTex.bumpMap,
    bumpScale: 0.004,
    roughness: 0.34,
    metalness: 0.2,
    clearcoat: 0.65,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.05,
  });

  const matteCarbon = new THREE.MeshStandardMaterial({
    map: carbonTex.map,
    bumpMap: carbonTex.bumpMap,
    bumpScale: 0.006,
    color: '#1b1f26',
    roughness: 0.72,
    metalness: 0.12,
    envMapIntensity: 0.75,
  });

  const whiteTrim = new THREE.MeshStandardMaterial({
    color: '#f1f5f9',
    roughness: 0.28,
    metalness: 0.1,
  });

  const titaniumHalo = new THREE.MeshPhysicalMaterial({
    color: '#7c8592',
    roughness: 0.22,
    metalness: 0.94,
    anisotropy: 0.75,
    clearcoat: 0.35,
    envMapIntensity: 1.25,
  });

  const exhaustMetal = new THREE.MeshPhysicalMaterial({
    color: '#a3917e',
    roughness: 0.18,
    metalness: 0.96,
    iridescence: isSoftwareGl ? 0 : 0.7,
    iridescenceIOR: 1.35,
    envMapIntensity: 1.45,
  });

  const engineBlockMetal = new THREE.MeshStandardMaterial({
    color: '#a9b2bd',
    roughness: 0.28,
    metalness: 0.88,
    envMapIntensity: 1.2,
  });

  const goldHeatShield = new THREE.MeshPhysicalMaterial({
    color: '#d4a024',
    roughness: 0.24,
    metalness: 0.92,
    clearcoat: 0.25,
    envMapIntensity: 1.35,
  });

  const radiatorCore = new THREE.MeshStandardMaterial({
    map: radiatorTex,
    roughness: 0.42,
    metalness: 0.75,
    envMapIntensity: 0.9,
  });

  const tireTread = new THREE.MeshStandardMaterial({
    map: treadTex,
    roughness: 0.78,
    metalness: 0.04,
    envMapIntensity: 0.5,
  });

  const tireSidewall = new THREE.MeshStandardMaterial({
    map: sidewallTex,
    roughness: 0.68,
    metalness: 0.05,
    envMapIntensity: 0.55,
  });

  const wheelFace = new THREE.MeshPhysicalMaterial({
    map: wheelFaceTex,
    roughness: 0.28,
    metalness: 0.65,
    clearcoat: 0.65,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.15,
  });

  const wheelRim = new THREE.MeshStandardMaterial({
    color: '#12151b',
    roughness: 0.28,
    metalness: 0.85,
    envMapIntensity: 1.1,
  });

  const wheelNut = new THREE.MeshStandardMaterial({
    color: '#dc2626',
    roughness: 0.2,
    metalness: 0.88,
    envMapIntensity: 1.2,
  });

  const wheelHubTip = new THREE.MeshStandardMaterial({
    color: '#22c55e',
    roughness: 0.22,
    metalness: 0.75,
  });

  const brakeDisc = new THREE.MeshStandardMaterial({
    map: rotorTex,
    roughness: 0.46,
    metalness: 0.68,
  });

  const brakeCaliper = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    roughness: 0.24,
    metalness: 0.88,
  });

  const visorGlass = new THREE.MeshPhysicalMaterial({
    color: '#0e1928',
    roughness: 0.05,
    metalness: 0.2,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    iridescence: isSoftwareGl ? 0 : 0.92,
    iridescenceIOR: 1.4,
    envMapIntensity: 1.5,
  });

  const helmetShell = new THREE.MeshPhysicalMaterial({
    color: '#00d2be',
    roughness: 0.1,
    metalness: 0.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.4,
  });

  const rainLight = new THREE.MeshStandardMaterial({
    map: rainTex,
    emissiveMap: rainTex,
    emissive: '#ff1a1a',
    emissiveIntensity: 2.5,
    roughness: 0.2,
    metalness: 0.1,
  });

  const endplateLed = new THREE.MeshStandardMaterial({
    color: '#ff2222',
    emissive: '#ff1414',
    emissiveIntensity: 2.8,
    roughness: 0.2,
  });

  const steeringDisplay = new THREE.MeshBasicMaterial({
    map: steerTex,
  });

  const harnessStrap = new THREE.MeshStandardMaterial({
    color: '#15803d',
    roughness: 0.7,
    metalness: 0.05,
  });

  const ownedTextures = [
    carbonTex.map,
    carbonTex.bumpMap,
    radiatorTex,
    steerTex,
    rotorTex,
    rainTex,
    noseTex,
    sidepodRightTex,
    sidepodLeftTex,
    engineCoverTex,
    sharkFinTex,
    flap0Tex,
    flap1Tex,
    flap2Tex,
    frontEpTex,
    rearDrsTex,
    rearEpTex,
    signifyTex,
    wheelFaceTex,
    mirrorTex,
  ];

  const allMaterials: THREE.Material[] = [
    obsidianPaint,
    brushedSilver,
    petronasTeal,
    ineosRed,
    nosePaint,
    sidepodRightPaint,
    sidepodLeftPaint,
    engineCoverPaint,
    sharkFinNumber,
    frontFlap0,
    frontFlap1,
    frontFlap2,
    frontEndplate,
    rearWingDrs,
    rearEndplate,
    signifyFence,
    mirrorPod,
    carbonFiber,
    matteCarbon,
    whiteTrim,
    titaniumHalo,
    exhaustMetal,
    engineBlockMetal,
    goldHeatShield,
    radiatorCore,
    tireTread,
    tireSidewall,
    wheelFace,
    wheelRim,
    wheelNut,
    wheelHubTip,
    brakeDisc,
    brakeCaliper,
    visorGlass,
    helmetShell,
    rainLight,
    endplateLed,
    steeringDisplay,
    harnessStrap,
  ];

  return {
    obsidianPaint,
    brushedSilver,
    petronasTeal,
    ineosRed,
    nosePaint,
    sidepodRightPaint,
    sidepodLeftPaint,
    engineCoverPaint,
    sharkFinNumber,
    frontFlap0,
    frontFlap1,
    frontFlap2,
    frontEndplate,
    rearWingDrs,
    rearEndplate,
    signifyFence,
    mirrorPod,
    carbonFiber,
    matteCarbon,
    whiteTrim,
    titaniumHalo,
    exhaustMetal,
    engineBlockMetal,
    goldHeatShield,
    radiatorCore,
    tireTread,
    tireSidewall,
    wheelFace,
    wheelRim,
    wheelNut,
    wheelHubTip,
    brakeDisc,
    brakeCaliper,
    visorGlass,
    helmetShell,
    rainLight,
    endplateLed,
    steeringDisplay,
    harnessStrap,
    allMaterials,
    updateTireCompound(compound: TireCompound) {
      const nextSidewall = createTireSidewallTexture(
        compound.stripeHex,
        compound.code,
        maxAnisotropy,
      );
      tireSidewall.map = nextSidewall;
      tireSidewall.needsUpdate = true;
      sidewallTex.dispose();
      sidewallTex = nextSidewall;

      const nextTread = createTireTreadTexture(compound.grooved, maxAnisotropy);
      tireTread.map = nextTread;
      tireTread.needsUpdate = true;
      treadTex.dispose();
      treadTex = nextTread;
    },
    dispose() {
      ownedTextures.forEach((t) => t.dispose());
      sidewallTex.dispose();
      treadTex.dispose();
      allMaterials.forEach((m) => m.dispose());
    },
  };
}
