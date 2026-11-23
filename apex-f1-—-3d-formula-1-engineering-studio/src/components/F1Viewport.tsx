import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { buildF1Car, F1CarRig } from '../f1/buildF1Car';
import { SelectiveFocusRenderer } from '../f1/focusBlurRenderer';
import { createF1Materials, F1MaterialSet } from '../f1/materials';
import {
  attachPixelRevealToMaterials,
  createPixelRevealRig,
  REVEAL_DURATION_SEC,
} from '../f1/revealEffect';
import { createContactShadowTexture, createStudioFloorTexture } from '../f1/textures';
import {
  CAMERA_PRESETS,
  CameraPresetId,
  LightingPresetId,
  PART_CATALOG,
  SpeedModeId,
  TIRE_COMPOUNDS,
  TireCompoundId,
} from '../f1/types';
import { createWindTunnelRig, WindTunnelRig } from '../f1/windTunnel';

export interface F1ViewportProps {
  tireCompoundId: TireCompoundId;
  lightingId: LightingPresetId;
  cameraPreset: { id: CameraPresetId; nonce: number };
  exploded: boolean;
  drsOpen: boolean;
  windTunnel: boolean;
  speedMode: SpeedModeId;
  autoRotate: boolean;
  selectedPartKey: string | null;
  hoveredPartKey: string | null;
  revealNonce: number;
  skipInitialReveal: boolean;
  onSelectPart: (partKey: string | null) => void;
  onHoverPart: (partKey: string | null) => void;
  onRevealStateChange?: (revealing: boolean) => void;
}

const _camGoalPos = new THREE.Vector3();
const _camGoalTarget = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _partOffset = new THREE.Vector3();
const _heroCamPos = new THREE.Vector3(...CAMERA_PRESETS[0].position);

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? gl.getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const F1Viewport: React.FC<F1ViewportProps> = ({
  tireCompoundId,
  lightingId,
  cameraPreset,
  exploded,
  drsOpen,
  windTunnel,
  speedMode,
  autoRotate,
  selectedPartKey,
  hoveredPartKey,
  revealNonce,
  skipInitialReveal,
  onSelectPart,
  onHoverPart,
  onRevealStateChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const stateRef = useRef({
    tireCompoundId,
    lightingId,
    exploded,
    drsOpen,
    windTunnel,
    speedMode,
    autoRotate,
    selectedPartKey,
    hoveredPartKey,
    skipInitialReveal,
    onSelectPart,
    onHoverPart,
    onRevealStateChange,
  });
  stateRef.current = {
    tireCompoundId,
    lightingId,
    exploded,
    drsOpen,
    windTunnel,
    speedMode,
    autoRotate,
    selectedPartKey,
    hoveredPartKey,
    skipInitialReveal,
    onSelectPart,
    onHoverPart,
    onRevealStateChange,
  };

  const sceneRefs = useRef<{
    materials: F1MaterialSet | null;
    windTunnelRig: WindTunnelRig | null;
    applyLighting: ((id: LightingPresetId) => void) | null;
    triggerCameraPreset: ((id: CameraPresetId) => void) | null;
    focusOnPart: ((key: string | null) => void) | null;
    replayReveal: (() => void) | null;
    wakeLoop: (() => void) | null;
  }>({
    materials: null,
    windTunnelRig: null,
    applyLighting: null,
    triggerCameraPreset: null,
    focusOnPart: null,
    replayReveal: null,
    wakeLoop: null,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL2 context could not be initialized in this browser.');
      return;
    }

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;
    const initPixelRatio = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.setPixelRatio(initPixelRatio);
    renderer.setSize(initW, initH);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const canvas = renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('Graphics context paused. Attempting recovery...');
    };
    const onContextRestored = () => {
      setWebglError(null);
      requestRender();
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    // Dark Studio Background + Fog + PMREM Studio Reflections
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#131820');
    scene.fog = new THREE.FogExp2('#131820', 0.028);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    // Camera & OrbitControls
    const camera = new THREE.PerspectiveCamera(35, initW / initH, 0.1, 120);
    const initialPreset = CAMERA_PRESETS[0];
    if (stateRef.current.skipInitialReveal) {
      camera.position.set(...initialPreset.position);
    } else {
      camera.position.set(-4.22, 1.42, 3.42);
    }

    const controls = new OrbitControls(camera, canvas);
    controls.target.set(...initialPreset.target);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.minDistance = 1.45;
    controls.maxDistance = 12.5;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.enablePan = true;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.85;
    controls.update();

    // Studio Spotlight & 3-Point Lighting Rig
    const hemiLight = new THREE.HemisphereLight('#8ca8cc', '#0e131b', 0.5);
    scene.add(hemiLight);

    // Primary overhead/front-3/4 SpotLight for dramatic dark-studio spotlight pool
    const heroSpotLight = new THREE.SpotLight('#ffffff', 135, 28, Math.PI / 5.2, 0.72, 1.45);
    heroSpotLight.position.set(-2.1, 6.2, 2.7);
    heroSpotLight.target.position.set(0, 0.32, 0);
    heroSpotLight.castShadow = !isSoftwareGl;
    heroSpotLight.shadow.mapSize.width = 2048;
    heroSpotLight.shadow.mapSize.height = 2048;
    heroSpotLight.shadow.camera.near = 1.5;
    heroSpotLight.shadow.camera.far = 20;
    heroSpotLight.shadow.bias = -0.0004;
    heroSpotLight.shadow.normalBias = 0.02;
    heroSpotLight.shadow.focus = 1;
    scene.add(heroSpotLight.target);
    scene.add(heroSpotLight);

    // Secondary rear rim SpotLight sculpting silver stripes and twill carbon silhouette
    const rimSpotLight = new THREE.SpotLight('#d8ecff', 72, 24, Math.PI / 4.2, 0.85, 1.4);
    rimSpotLight.position.set(2.8, 3.8, -5.2);
    rimSpotLight.target.position.set(0, 0.4, -0.4);
    rimSpotLight.castShadow = false;
    scene.add(rimSpotLight.target);
    scene.add(rimSpotLight);

    // Directional keyLight (shadow caster in White Studio preset; soft accent in Spotlight presets)
    const keyLight = new THREE.DirectionalLight('#ffffff', 0.65);
    keyLight.position.set(4.8, 8.2, 5.4);
    keyLight.castShadow = false;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    const d = 4.4;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#b8d4f5', 0.55);
    fillLight.position.set(-5.2, 4.0, 2.8);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#e2e8f0', 1.15);
    rimLight.position.set(-1.5, 5.2, -6.2);
    scene.add(rimLight);

    const rectLights: THREE.RectAreaLight[] = [];
    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const overheadSoftbox = new THREE.RectAreaLight('#ffffff', 1.1, 2.6, 7.2);
      overheadSoftbox.position.set(0, 3.65, 0.05);
      overheadSoftbox.lookAt(0, 0.35, 0.05);
      scene.add(overheadSoftbox);
      rectLights.push(overheadSoftbox);

      const leftStrip = new THREE.RectAreaLight('#ffffff', 0.6, 6.2, 0.65);
      leftStrip.position.set(3.6, 1.5, 0);
      leftStrip.lookAt(0, 0.45, 0);
      scene.add(leftStrip);
      rectLights.push(leftStrip);

      const rightStrip = new THREE.RectAreaLight('#ffffff', 0.55, 6.2, 0.65);
      rightStrip.position.set(-3.6, 1.5, 0);
      rightStrip.lookAt(0, 0.45, 0);
      scene.add(rightStrip);
      rectLights.push(rightStrip);
    }

    // Studio Floor + Soft Contact Shadow + Subtle Floor Ring
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const darkFloorTex = createStudioFloorTexture(false, maxAnisotropy);
    const lightFloorTex = createStudioFloorTexture(true, maxAnisotropy);
    let activeFloorTex = darkFloorTex;

    const floorGeo = new THREE.CircleGeometry(36, 72);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      map: darkFloorTex,
      roughness: 0.24,
      metalness: 0.42,
      envMapIntensity: 0.95,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.002;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const contactShadowTex = createContactShadowTexture();
    const contactShadowGeo = new THREE.PlaneGeometry(3.25, 6.45);
    contactShadowGeo.rotateX(-Math.PI / 2);
    const contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    const contactShadowMesh = new THREE.Mesh(contactShadowGeo, contactShadowMat);
    contactShadowMesh.position.set(0, 0.003, 0.08);
    scene.add(contactShadowMesh);

    const ringGeo = new THREE.RingGeometry(3.32, 3.36, 96);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#2a3444',
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.004;
    scene.add(ringMesh);

    // Build Mercedes-AMG PETRONAS W17 #63 + Wind Tunnel Streamlines
    const initCompound =
      TIRE_COMPOUNDS.find((t) => t.id === stateRef.current.tireCompoundId) || TIRE_COMPOUNDS[0];

    const materials = createF1Materials(initCompound, maxAnisotropy, isSoftwareGl);
    sceneRefs.current.materials = materials;

    const carRig: F1CarRig = buildF1Car(materials);
    scene.add(carRig.root);

    // CAD Wireframe + Glowing Teal Pixel Dissolve Reveal Rig
    const pixelRevealRig = createPixelRevealRig(carRig);
    attachPixelRevealToMaterials(materials.allMaterials, pixelRevealRig.uniforms);
    carRig.root.add(pixelRevealRig.particleMesh);

    const windTunnelRig = createWindTunnelRig();
    windTunnelRig.group.visible = stateRef.current.windTunnel;
    scene.add(windTunnelRig.group);
    sceneRefs.current.windTunnelRig = windTunnelRig;

    // Selective Gaussian Blur Renderer
    const focusBlurRenderer = new SelectiveFocusRenderer(initW, initH, initPixelRatio);

    // =========================================================================
    // Scheduler & Kinematics State
    // =========================================================================
    let frameId = 0;
    let loopActive = false;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();
    let elapsedTotal = 0;
    let disposed = false;

    let revealProgress = stateRef.current.skipInitialReveal ? 1.0 : 0.0;
    let isRevealing = revealProgress < 1.0;
    let revealCameraGlide = isRevealing;
    pixelRevealRig.update(revealProgress, 0);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let currentExplode = stateRef.current.exploded ? 1 : 0;
    let currentDrs = stateRef.current.drsOpen ? 1 : 0;
    let currentRideDrop = 0;
    const initFocusKey = stateRef.current.exploded
      ? stateRef.current.hoveredPartKey
      : stateRef.current.selectedPartKey;
    let currentFocusBlend = initFocusKey ? 1 : 0;
    let activeFocusKey: string | null = initFocusKey;
    let cameraAnimating = false;
    let targetPanOnly = false;
    _camGoalPos.copy(camera.position);
    _camGoalTarget.copy(controls.target);

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext | null;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function getEffectiveFocusKey(): string | null {
      const s = stateRef.current;
      // In Exploded View: hover alone isolates and blurs all other parts without clicking.
      // In Assembled View: click locks focus for persistent inspection.
      return s.exploded ? s.hoveredPartKey : s.selectedPartKey;
    }

    function needsContinuousTick(): boolean {
      const s = stateRef.current;
      const targetExplode = s.exploded ? 1 : 0;
      const targetDrs = s.drsOpen ? 1 : 0;
      const targetFocus = getEffectiveFocusKey() ? 1 : 0;
      return (
        isRevealing ||
        s.windTunnel ||
        s.speedMode !== 'static' ||
        (s.autoRotate && !isSoftwareGl) ||
        cameraAnimating ||
        Math.abs(currentExplode - targetExplode) > 0.001 ||
        Math.abs(currentDrs - targetDrs) > 0.001 ||
        Math.abs(currentFocusBlend - targetFocus) > 0.001
      );
    }

    function advanceKinematics(delta: number) {
      const s = stateRef.current;
      elapsedTotal += delta;

      // 3-Second CAD Wireframe -> Glowing Teal Pixel Dissolve Reveal
      if (isRevealing) {
        revealProgress = Math.min(1.0, revealProgress + delta / REVEAL_DURATION_SEC);
        pixelRevealRig.update(revealProgress, elapsedTotal, currentExplode);

        if (revealCameraGlide && !cameraAnimating) {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _heroCamPos.x, 1.8, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _heroCamPos.y, 1.8, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _heroCamPos.z, 1.8, delta);
        }

        if (revealProgress >= 1.0) {
          isRevealing = false;
          revealCameraGlide = false;
          pixelRevealRig.update(1.0, elapsedTotal, currentExplode);
          s.onRevealStateChange?.(false);
        }
      }

      // Exploded View Toggle Smooth Damping
      const targetExplode = s.exploded ? 1 : 0;
      currentExplode = THREE.MathUtils.damp(currentExplode, targetExplode, 5.2, delta);
      if (Math.abs(currentExplode - targetExplode) < 0.0008) {
        currentExplode = targetExplode;
      }

      const guideAttr = carRig.explosionGuides.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < carRig.explodableParts.length; i++) {
        const p = carRig.explodableParts[i];
        p.group.position.copy(p.basePos).addScaledVector(p.explodeOffset, currentExplode);

        guideAttr.setXYZ(i * 2, p.basePos.x, p.basePos.y + 0.25, p.basePos.z);
        guideAttr.setXYZ(
          i * 2 + 1,
          p.group.position.x,
          p.group.position.y + 0.25,
          p.group.position.z,
        );
      }
      guideAttr.needsUpdate = true;
      carRig.explosionGuides.visible = currentExplode > 0.02;

      // Selective Gaussian Blur Smooth Focus Ramp
      const effectiveKey = getEffectiveFocusKey();
      if (effectiveKey) {
        activeFocusKey = effectiveKey;
      }
      const targetFocus = effectiveKey ? 1 : 0;
      currentFocusBlend = THREE.MathUtils.damp(currentFocusBlend, targetFocus, 9.0, delta);
      if (Math.abs(currentFocusBlend - targetFocus) < 0.001) {
        currentFocusBlend = targetFocus;
        if (!effectiveKey) {
          activeFocusKey = null;
        }
      }

      // DRS Flap Damping
      const targetDrs = s.drsOpen ? 1 : 0;
      currentDrs = THREE.MathUtils.damp(currentDrs, targetDrs, 9.0, delta);
      if (Math.abs(currentDrs - targetDrs) < 0.0008) {
        currentDrs = targetDrs;
      }
      carRig.drsFlapPivot.rotation.x = currentDrs * -0.54;

      // Wheel Rotation + Rolling Road + Downforce Ride Squat + Matrix LED Rain Light
      const speedVal = s.speedMode === 'track' ? 28.0 : s.speedMode === 'pit' ? 7.5 : 0;
      if (speedVal > 0) {
        const wheelSpinDelta = (speedVal / 0.36) * delta;
        for (let i = 0; i < carRig.wheelSpinGroups.length; i++) {
          carRig.wheelSpinGroups[i].rotation.x += wheelSpinDelta;
        }
        activeFloorTex.offset.y += speedVal * 0.28 * delta;

        const strobe = Math.sin(elapsedTotal * 14) > 0.25 ? 2.6 : 0.7;
        carRig.rainLightMat.emissiveIntensity = s.speedMode === 'track' ? strobe : 1.4;
      } else {
        carRig.rainLightMat.emissiveIntensity = 1.6;
      }

      const targetDrop = s.speedMode === 'track' && currentExplode < 0.05 ? -0.012 : 0;
      currentRideDrop = THREE.MathUtils.damp(currentRideDrop, targetDrop, 6.0, delta);
      carRig.root.position.y = currentRideDrop;

      windTunnelRig.update(
        delta,
        s.drsOpen,
        s.speedMode === 'track' ? 1.8 : s.speedMode === 'pit' ? 0.75 : 0.35,
      );

      if (cameraAnimating) {
        if (!targetPanOnly) {
          camera.position.x = THREE.MathUtils.damp(camera.position.x, _camGoalPos.x, 6.0, delta);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, _camGoalPos.y, 6.0, delta);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, _camGoalPos.z, 6.0, delta);
        }

        controls.target.x = THREE.MathUtils.damp(controls.target.x, _camGoalTarget.x, 6.5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _camGoalTarget.y, 6.5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _camGoalTarget.z, 6.5, delta);

        const posDone = targetPanOnly || camera.position.distanceTo(_camGoalPos) < 0.015;
        const tgtDone = controls.target.distanceTo(_camGoalTarget) < 0.01;
        if (posDone && tgtDone) {
          if (!targetPanOnly) camera.position.copy(_camGoalPos);
          controls.target.copy(_camGoalTarget);
          cameraAnimating = false;
        }
      }

      controls.autoRotate = s.autoRotate && !isSoftwareGl && !cameraAnimating;
      controls.update();
    }

    function renderFrame() {
      if (currentFocusBlend > 0.001 && activeFocusKey) {
        const focusedGroups = carRig.partGroupsByKey.get(activeFocusKey) || [];
        const unfocusedObjects: THREE.Object3D[] = [
          floorMesh,
          contactShadowMesh,
          ringMesh,
          windTunnelRig.group,
          carRig.explosionGuides,
          pixelRevealRig.particleMesh,
        ];
        for (const p of carRig.explodableParts) {
          if (p.key !== activeFocusKey) {
            unfocusedObjects.push(p.group);
          }
        }
        const dimFactor = stateRef.current.lightingId === 'studioWhite' ? 0.95 : 0.65;
        focusBlurRenderer.render(
          renderer,
          scene,
          camera,
          focusedGroups,
          unfocusedObjects,
          currentFocusBlend,
          dimFactor,
        );
      } else {
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      }
    }

    function requestRender() {
      if (disposed || loopActive) return;
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        renderDirty = false;
        const now = performance.now();
        const delta = Math.min((now - lastTime) / 1000, 0.05);
        lastTime = now;
        advanceKinematics(delta);
        renderFrame();
        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      advanceKinematics(delta);
      renderFrame();

      if (needsContinuousTick()) {
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
      } else {
        loopActive = false;
      }
    }

    function ensureLoopRunning() {
      if (disposed) return;
      if (!loopActive) {
        loopActive = true;
        lastTime = performance.now();
        if (isSoftwareGl) afterDraw(tick);
        else frameId = requestAnimationFrame(tick);
      }
    }

    sceneRefs.current.wakeLoop = () => {
      if (needsContinuousTick()) {
        ensureLoopRunning();
      } else {
        requestRender();
      }
    };

    const applyLighting = (id: LightingPresetId) => {
      if (id === 'studioWhite') {
        scene.background = new THREE.Color('#f4f5f7');
        scene.fog = new THREE.Fog('#f4f5f7', 14, 38);
        activeFloorTex = lightFloorTex;
        floorMat.map = lightFloorTex;
        floorMat.roughness = 0.78;
        floorMat.metalness = 0.04;
        floorMat.envMapIntensity = 0.25;
        floorMat.needsUpdate = true;

        heroSpotLight.intensity = 0;
        heroSpotLight.castShadow = false;
        rimSpotLight.intensity = 0;

        hemiLight.color.set('#ffffff');
        hemiLight.groundColor.set('#d8dde6');
        hemiLight.intensity = 1.4;
        keyLight.color.set('#ffffff');
        keyLight.intensity = 2.45;
        keyLight.castShadow = !isSoftwareGl;
        fillLight.color.set('#eef4fb');
        fillLight.intensity = 1.25;
        rimLight.color.set('#f8fafc');
        rimLight.intensity = 1.45;
        if (rectLights.length === 3) {
          rectLights[0].intensity = 3.4;
          rectLights[1].intensity = 1.6;
          rectLights[2].intensity = 1.4;
        }
        contactShadowMat.opacity = 0.65;
        ringMat.color.set('#cbd5e1');
        ringMat.opacity = 0.42;
        renderer.toneMappingExposure = 1.06;
      } else if (id === 'darkSpotlight') {
        scene.background = new THREE.Color('#131820');
        scene.fog = new THREE.FogExp2('#131820', 0.028);
        activeFloorTex = darkFloorTex;
        floorMat.map = darkFloorTex;
        floorMat.roughness = 0.24;
        floorMat.metalness = 0.42;
        floorMat.envMapIntensity = 0.95;
        floorMat.needsUpdate = true;

        heroSpotLight.color.set('#ffffff');
        heroSpotLight.intensity = 135;
        heroSpotLight.angle = Math.PI / 5.2;
        heroSpotLight.penumbra = 0.72;
        heroSpotLight.castShadow = !isSoftwareGl;
        rimSpotLight.color.set('#d8ecff');
        rimSpotLight.intensity = 72;

        hemiLight.color.set('#8ca8cc');
        hemiLight.groundColor.set('#0e131b');
        hemiLight.intensity = 0.5;
        keyLight.color.set('#ffffff');
        keyLight.intensity = 0.65;
        keyLight.castShadow = false;
        fillLight.color.set('#b8d4f5');
        fillLight.intensity = 0.55;
        rimLight.color.set('#e2e8f0');
        rimLight.intensity = 1.15;
        if (rectLights.length === 3) {
          rectLights[0].intensity = 1.1;
          rectLights[1].intensity = 0.6;
          rectLights[2].intensity = 0.55;
        }
        contactShadowMat.opacity = 0.82;
        ringMat.color.set('#2a3444');
        ringMat.opacity = 0.52;
        renderer.toneMappingExposure = 1.14;
      } else {
        // nightPit
        scene.background = new THREE.Color('#07090d');
        scene.fog = new THREE.FogExp2('#07090d', 0.038);
        activeFloorTex = darkFloorTex;
        floorMat.map = darkFloorTex;
        floorMat.roughness = 0.28;
        floorMat.metalness = 0.45;
        floorMat.envMapIntensity = 0.9;
        floorMat.needsUpdate = true;

        heroSpotLight.color.set('#fff1db');
        heroSpotLight.intensity = 115;
        heroSpotLight.angle = Math.PI / 5.5;
        heroSpotLight.penumbra = 0.68;
        heroSpotLight.castShadow = !isSoftwareGl;
        rimSpotLight.color.set('#00d2be');
        rimSpotLight.intensity = 65;

        hemiLight.color.set('#64748b');
        hemiLight.groundColor.set('#0f1117');
        hemiLight.intensity = 0.45;
        keyLight.color.set('#ffedd5');
        keyLight.intensity = 0.7;
        keyLight.castShadow = false;
        fillLight.color.set('#00d2be');
        fillLight.intensity = 0.7;
        rimLight.color.set('#f97316');
        rimLight.intensity = 1.3;
        if (rectLights.length === 3) {
          rectLights[0].intensity = 0.85;
          rectLights[1].intensity = 0.45;
          rectLights[2].intensity = 0.45;
        }
        contactShadowMat.opacity = 0.86;
        ringMat.color.set('#0f766e');
        ringMat.opacity = 0.62;
        renderer.toneMappingExposure = 1.12;
      }
      requestRender();
    };
    sceneRefs.current.applyLighting = applyLighting;
    applyLighting(stateRef.current.lightingId);

    const triggerCameraPreset = (id: CameraPresetId) => {
      const preset = CAMERA_PRESETS.find((p) => p.id === id);
      if (!preset) return;
      revealCameraGlide = false;
      _camGoalPos.set(...preset.position);
      _camGoalTarget.set(...preset.target);
      targetPanOnly = false;
      cameraAnimating = true;
      ensureLoopRunning();
    };
    sceneRefs.current.triggerCameraPreset = triggerCameraPreset;

    sceneRefs.current.replayReveal = () => {
      revealProgress = 0.0;
      isRevealing = true;
      revealCameraGlide = false;
      pixelRevealRig.update(0.0, elapsedTotal, currentExplode);
      stateRef.current.onRevealStateChange?.(true);
      ensureLoopRunning();
    };

    const focusOnPart = (key: string | null) => {
      if (key && PART_CATALOG[key]) {
        const meta = PART_CATALOG[key];
        const matching = carRig.explodableParts.find((p) => p.key === key);
        _partOffset.set(0, 0, 0);
        if (matching) {
          _partOffset.copy(matching.explodeOffset).multiplyScalar(currentExplode);
        }
        _camGoalTarget.set(
          meta.focusCenter[0] + _partOffset.x,
          meta.focusCenter[1] + _partOffset.y,
          meta.focusCenter[2] + _partOffset.z,
        );
        targetPanOnly = true;
        cameraAnimating = true;
      } else {
        _camGoalTarget.set(0, 0.38, 0.05);
        targetPanOnly = true;
        cameraAnimating = true;
      }
      ensureLoopRunning();
    };
    sceneRefs.current.focusOnPart = focusOnPart;

    const onControlsStart = () => {
      cameraAnimating = false;
      revealCameraGlide = false;
    };
    const onControlsChange = () => {
      if (!loopActive) {
        requestRender();
      }
    };
    controls.addEventListener('start', onControlsStart);
    controls.addEventListener('change', onControlsChange);

    // Raycasting: Hover Component Inspection & Focus
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;
    let lastHoverKey: string | null = null;

    const updatePointerNdc = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      _pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 28) return;
      lastHoverCheck = now;

      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(carRig.raycastTargets, true);
      const nextKey = hits.length > 0 ? ((hits[0].object.userData.partKey as string) ?? null) : null;

      canvas.style.cursor = nextKey ? 'pointer' : 'grab';
      if (nextKey !== lastHoverKey) {
        lastHoverKey = nextKey;
        stateRef.current.onHoverPart(nextKey);
      }
    };

    const onPointerLeave = () => {
      if (lastHoverKey !== null) {
        lastHoverKey = null;
        stateRef.current.onHoverPart(null);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 5) return;

      // In Exploded View, hover already focuses without clicking; clicking is only for locking in Assembled View.
      if (stateRef.current.exploded) return;

      updatePointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(_pointerNdc, camera);
      const hits = raycaster.intersectObjects(carRig.raycastTargets, true);
      if (hits.length > 0) {
        const key = (hits[0].object.userData.partKey as string | undefined) ?? null;
        const nextSelected = stateRef.current.selectedPartKey === key ? null : key;
        stateRef.current.onSelectPart(nextSelected);
      } else {
        stateRef.current.onSelectPart(null);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointerup', onPointerUp);

    if (isRevealing) {
      stateRef.current.onRevealStateChange?.(true);
      ensureLoopRunning();
    } else {
      requestRender();
    }

    const onResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const pr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(pr);
      focusBlurRenderer.setSize(w, h, pr);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', onControlsStart);
      controls.removeEventListener('change', onControlsChange);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      controls.dispose();
      focusBlurRenderer.dispose();
      pixelRevealRig.dispose();
      carRig.dispose();
      materials.dispose();
      windTunnelRig.dispose();
      floorGeo.dispose();
      lightFloorTex.dispose();
      darkFloorTex.dispose();
      floorMat.dispose();
      contactShadowGeo.dispose();
      contactShadowTex.dispose();
      contactShadowMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      envTex.dispose();
      heroSpotLight.dispose();
      rimSpotLight.dispose();
      rectLights.forEach((l) => l.dispose());
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  useEffect(() => {
    const compound = TIRE_COMPOUNDS.find((t) => t.id === tireCompoundId);
    if (compound && sceneRefs.current.materials) {
      sceneRefs.current.materials.updateTireCompound(compound);
      sceneRefs.current.wakeLoop?.();
    }
  }, [tireCompoundId]);

  useEffect(() => {
    sceneRefs.current.applyLighting?.(lightingId);
  }, [lightingId]);

  useEffect(() => {
    if (cameraPreset.nonce > 0) {
      sceneRefs.current.triggerCameraPreset?.(cameraPreset.id);
    }
  }, [cameraPreset]);

  useEffect(() => {
    if (!exploded) {
      sceneRefs.current.focusOnPart?.(selectedPartKey);
    }
  }, [selectedPartKey, exploded]);

  useEffect(() => {
    if (revealNonce > 0) {
      sceneRefs.current.replayReveal?.();
    }
  }, [revealNonce]);

  useEffect(() => {
    if (sceneRefs.current.windTunnelRig) {
      sceneRefs.current.windTunnelRig.group.visible = windTunnel;
    }
    sceneRefs.current.wakeLoop?.();
  }, [exploded, drsOpen, windTunnel, speedMode, autoRotate, selectedPartKey, hoveredPartKey]);

  const isLight = lightingId === 'studioWhite';

  return (
    <div
      className={`fixed inset-0 w-full h-full overflow-hidden transition-colors duration-300 ${
        isLight ? 'bg-[#f4f5f7]' : 'bg-[#131820]'
      }`}
    >
      <div ref={mountRef} className="w-full h-full" />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0c0f14]/95 p-6 text-center">
          <div className="max-w-md border border-white/15 bg-[#141820] px-6 py-5 rounded-lg">
            <h2 className="font-display text-2xl font-semibold tracking-wide text-white">
              3D Viewport Unavailable
            </h2>
            <p className="mt-2 text-sm text-slate-300">{webglError}</p>
          </div>
        </div>
      )}
    </div>
  );
};
