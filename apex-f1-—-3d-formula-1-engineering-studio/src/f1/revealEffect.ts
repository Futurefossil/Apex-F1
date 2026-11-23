import * as THREE from 'three';
import type { F1CarRig } from './buildF1Car';

export interface RevealUniforms {
  uRevealActive: { value: number };
  uSweepZ: { value: number };
  uPixelSize: { value: number };
  uBandWidth: { value: number };
  uTime: { value: number };
}

export interface PixelRevealRig {
  uniforms: RevealUniforms;
  particleMesh: THREE.InstancedMesh;
  setRevealVisible: (visible: boolean) => void;
  update: (progress: number, elapsed: number, explodeAmount?: number) => void;
  dispose: () => void;
}

export const REVEAL_START_Z = 2.98;
export const REVEAL_END_Z = -2.38;
export const REVEAL_DURATION_SEC = 3.0;

export function createRevealUniforms(): RevealUniforms {
  return {
    uRevealActive: { value: 0 },
    uSweepZ: { value: REVEAL_START_Z },
    uPixelSize: { value: 0.044 },
    uBandWidth: { value: 0.22 },
    uTime: { value: 0 },
  };
}

const REVEAL_GLSL_HELPERS = /* glsl */ `
uniform float uRevealActive;
uniform float uSweepZ;
uniform float uPixelSize;
uniform float uBandWidth;
uniform float uTime;
varying vec3 vRevealWorldPos;

float revealHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
`;

/**
 * Extends every real car material via onBeforeCompile so ahead of uSweepZ
 * pixel blocks are discarded (revealing the CAD wireframe underneath),
 * and along the active sweep edge glowing Petronas-teal pixel cells ignite.
 */
export function attachPixelRevealToMaterials(
  materials: THREE.Material[],
  uniforms: RevealUniforms,
): void {
  materials.forEach((mat) => {
    const prevKey = mat.customProgramCacheKey?.bind(mat);
    mat.customProgramCacheKey = () => {
      const base = prevKey ? prevKey() : '';
      return `${base}-w17-pixel-reveal-v1`;
    };

    const prevCompile = mat.onBeforeCompile?.bind(mat);
    mat.onBeforeCompile = (shader, renderer) => {
      if (prevCompile) {
        prevCompile(shader, renderer);
      }

      shader.uniforms.uRevealActive = uniforms.uRevealActive;
      shader.uniforms.uSweepZ = uniforms.uSweepZ;
      shader.uniforms.uPixelSize = uniforms.uPixelSize;
      shader.uniforms.uBandWidth = uniforms.uBandWidth;
      shader.uniforms.uTime = uniforms.uTime;

      shader.vertexShader = `varying vec3 vRevealWorldPos;\n${shader.vertexShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        /* glsl */ `
        #include <project_vertex>
        vRevealWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        `,
      );

      shader.fragmentShader = `${REVEAL_GLSL_HELPERS}\n${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        /* glsl */ `
        #include <clipping_planes_fragment>
        float _revealEdge = 0.0;
        float _revealCellGlow = 0.0;
        if (uRevealActive > 0.5) {
          vec3 rCell = floor(vRevealWorldPos / uPixelSize);
          float rCellZ = (rCell.z + 0.5) * uPixelSize;
          float rJitter = (revealHash(rCell) - 0.5) * uBandWidth * 1.45;
          float rDist = (rCellZ + rJitter) - uSweepZ;
          if (rDist < 0.0) {
            discard;
          }
          _revealEdge = 1.0 - smoothstep(0.0, uBandWidth * 1.35, rDist);
          vec3 cellFrac = fract(vRevealWorldPos / uPixelSize);
          float gridEdge = max(
            step(0.84, max(max(cellFrac.x, cellFrac.y), cellFrac.z)),
            step(0.84, max(max(1.0 - cellFrac.x, 1.0 - cellFrac.y), 1.0 - cellFrac.z))
          );
          float flicker = 0.72 + 0.55 * revealHash(rCell + vec3(floor(uTime * 15.0)));
          _revealCellGlow = _revealEdge * (1.3 + gridEdge * 1.8) * flicker;
        }
        `,
      );

      if (shader.fragmentShader.includes('#include <emissivemap_fragment>')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `
          #include <emissivemap_fragment>
          if (uRevealActive > 0.5 && _revealEdge > 0.001) {
            vec3 rTeal = mix(vec3(0.0, 0.824, 0.745), vec3(0.70, 1.0, 0.96), _revealEdge * 0.75);
            totalEmissiveRadiance += rTeal * (_revealCellGlow * 2.15);
          }
          `,
        );
      } else {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          /* glsl */ `
          #include <color_fragment>
          if (uRevealActive > 0.5 && _revealEdge > 0.001) {
            vec3 rTeal = mix(vec3(0.0, 0.824, 0.745), vec3(0.75, 1.0, 0.96), _revealEdge * 0.75);
            diffuseColor.rgb = mix(diffuseColor.rgb, rTeal * 2.2, clamp(_revealEdge * 0.9, 0.0, 1.0));
          }
          `,
        );
      }
    };

    mat.needsUpdate = true;
  });
}

function createCadCoreMaterial(uniforms: RevealUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRevealActive: uniforms.uRevealActive,
      uSweepZ: uniforms.uSweepZ,
      uPixelSize: uniforms.uPixelSize,
      uBandWidth: uniforms.uBandWidth,
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRevealActive;
      uniform float uSweepZ;
      uniform float uPixelSize;
      uniform float uBandWidth;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float cadHash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        if (uRevealActive < 0.5) discard;
        vec3 cell = floor(vWorldPos / uPixelSize);
        float cellZ = (cell.z + 0.5) * uPixelSize;
        float jitter = (cadHash(cell) - 0.5) * uBandWidth * 1.45;
        float dist = (cellZ + jitter) - uSweepZ;
        if (dist >= 0.0) discard;

        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, normalize(vWorldNormal)), 0.0), 2.4);
        float topShade = 0.5 + 0.5 * clamp(vWorldNormal.y, -1.0, 1.0);
        float nearWave = 1.0 - smoothstep(0.0, uBandWidth * 1.25, -dist);

        vec3 baseSlate = mix(vec3(0.045, 0.062, 0.088), vec3(0.10, 0.14, 0.19), topShade);
        vec3 rimTeal = vec3(0.0, 0.78, 0.72) * (fresnel * 0.55 + nearWave * 0.65);
        gl_FragColor = vec4(baseSlate + rimTeal, 0.94);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
}

function createCadWireMaterial(uniforms: RevealUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRevealActive: uniforms.uRevealActive,
      uSweepZ: uniforms.uSweepZ,
      uPixelSize: uniforms.uPixelSize,
      uBandWidth: uniforms.uBandWidth,
      uTime: uniforms.uTime,
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uRevealActive;
      uniform float uSweepZ;
      uniform float uPixelSize;
      uniform float uBandWidth;
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;

      float wireHash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.23));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        if (uRevealActive < 0.5) discard;
        vec3 cell = floor(vWorldPos / uPixelSize);
        float cellZ = (cell.z + 0.5) * uPixelSize;
        float jitter = (wireHash(cell) - 0.5) * uBandWidth * 1.45;
        float dist = (cellZ + jitter) - uSweepZ;
        if (dist >= 0.0) discard;

        float nearWave = 1.0 - smoothstep(0.0, uBandWidth * 1.4, -dist);
        float pulse = 0.82 + 0.18 * sin(vWorldPos.z * 3.5 - uTime * 5.0);
        vec3 wireCool = vec3(0.18, 0.72, 0.76);
        vec3 wireHot = vec3(0.65, 1.0, 0.96);
        vec3 finalWire = mix(wireCool, wireHot, nearWave * 0.85) * (1.15 + nearWave * 1.65) * pulse;

        gl_FragColor = vec4(finalWire, 0.82 + nearWave * 0.18);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    wireframe: true,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

interface BurstSeed {
  xNorm: number;
  yOffset: number;
  zJitter: number;
  riseSpeed: number;
  driftBack: number;
  spinSpeed: number;
  size: number;
  phase: number;
}

const PARTICLE_COUNT = 260;
const _dummyMat4 = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyQuat = new THREE.Quaternion();
const _dummyEuler = new THREE.Euler();
const _dummyScale = new THREE.Vector3();

function carHalfWidthAtZ(z: number): number {
  if (z > 2.15) return 0.96; // Front wing
  if (z > 1.25) return 0.88; // Front wheels & suspension
  if (z > 0.60) return 0.34; // Narrow monocoque nose
  if (z > -1.35) return 0.76; // Sidepods & ground-effect floor
  if (z > -2.10) return 0.86; // Rear wheels & diffuser
  return 0.54; // Rear wing
}

function carMaxHeightAtZ(z: number): number {
  if (z > 2.15) return 0.25; // Front wing
  if (z > 0.55) return 0.52; // Nose & front tires
  if (z > -0.55) return 0.98; // Halo & T-cam airbox
  if (z > -1.75) return 0.78; // Engine cover & dorsal fin
  return 0.98; // Rear wing
}

export function createPixelRevealRig(carRig: F1CarRig): PixelRevealRig {
  const uniforms = createRevealUniforms();
  const cadCoreMat = createCadCoreMaterial(uniforms);
  const cadWireMat = createCadWireMaterial(uniforms);

  const cadMeshes: THREE.Mesh[] = [];
  const sourceMeshes: THREE.Mesh[] = [];

  carRig.root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.isRevealOverlay) return;
    // Skip zero-thickness flat decal overlays to avoid Z-fighting
    if (mesh.geometry instanceof THREE.PlaneGeometry) return;
    sourceMeshes.push(mesh);
  });

  for (const mesh of sourceMeshes) {
    const parent = mesh.parent;
    if (!parent) continue;

    const coreMesh = new THREE.Mesh(mesh.geometry, cadCoreMat);
    coreMesh.position.copy(mesh.position);
    coreMesh.rotation.copy(mesh.rotation);
    coreMesh.scale.copy(mesh.scale);
    coreMesh.userData.isRevealOverlay = true;
    coreMesh.visible = false;
    coreMesh.renderOrder = 1;
    parent.add(coreMesh);
    cadMeshes.push(coreMesh);

    const wireMesh = new THREE.Mesh(mesh.geometry, cadWireMat);
    wireMesh.position.copy(mesh.position);
    wireMesh.rotation.copy(mesh.rotation);
    wireMesh.scale.copy(mesh.scale);
    wireMesh.userData.isRevealOverlay = true;
    wireMesh.visible = false;
    wireMesh.renderOrder = 2;
    parent.add(wireMesh);
    cadMeshes.push(wireMesh);
  }

  // Instanced glowing pixel voxels riding along the active wave front
  const cubeGeo = new THREE.BoxGeometry(0.038, 0.038, 0.038);
  const particleMat = new THREE.MeshBasicMaterial({
    color: '#64ffef',
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const particleMesh = new THREE.InstancedMesh(cubeGeo, particleMat, PARTICLE_COUNT);
  particleMesh.frustumCulled = false;
  particleMesh.visible = false;
  particleMesh.renderOrder = 3;

  const seeds: BurstSeed[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const s1 = Math.sin(i * 12.9898) * 43758.5453;
    const s2 = Math.sin(i * 78.233 + 1.3) * 43758.5453;
    const s3 = Math.sin(i * 39.425 + 2.7) * 43758.5453;
    const s4 = Math.sin(i * 91.113 + 4.1) * 43758.5453;
    const r1 = s1 - Math.floor(s1);
    const r2 = s2 - Math.floor(s2);
    const r3 = s3 - Math.floor(s3);
    const r4 = s4 - Math.floor(s4);

    seeds.push({
      xNorm: (r1 - 0.5) * 2.0,
      yOffset: r2,
      zJitter: (r3 - 0.5) * 0.24,
      riseSpeed: 0.14 + r4 * 0.28,
      driftBack: 0.08 + r1 * 0.18,
      spinSpeed: 2.0 + r3 * 4.5,
      size: 0.45 + r4 * 0.95,
      phase: r2 * Math.PI * 2,
    });
  }

  let currentlyVisible = false;
  const setRevealVisible = (visible: boolean) => {
    if (currentlyVisible === visible) return;
    currentlyVisible = visible;
    for (let i = 0; i < cadMeshes.length; i++) {
      cadMeshes[i].visible = visible;
    }
    particleMesh.visible = visible;
    uniforms.uRevealActive.value = visible ? 1.0 : 0.0;
  };

  const update = (progress: number, elapsed: number, explodeAmount = 0) => {
    uniforms.uTime.value = elapsed;

    if (progress >= 1.0) {
      setRevealVisible(false);
      return;
    }

    setRevealVisible(true);

    // 0.00 .. 0.16 -> Hold pure CAD wireframe showcase
    // 0.16 .. 0.92 -> Sweep front-to-rear pixel dissolve wave
    // 0.92 .. 1.00 -> Final glow settle
    let sweepT = 0;
    if (progress > 0.16) {
      const raw = Math.min(1, (progress - 0.16) / 0.76);
      sweepT = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
    }
    const startZ = THREE.MathUtils.lerp(REVEAL_START_Z, 3.85, explodeAmount);
    const endZ = THREE.MathUtils.lerp(REVEAL_END_Z, -3.22, explodeAmount);
    const sweepZ = THREE.MathUtils.lerp(startZ, endZ, sweepT);
    uniforms.uSweepZ.value = sweepZ;

    // Fade burst pixel cubes smoothly during the active sweep window
    const burstEnvelope =
      progress < 0.14
        ? 0
        : progress < 0.24
          ? (progress - 0.14) / 0.10
          : progress > 0.88
            ? Math.max(0, 1 - (progress - 0.88) / 0.12)
            : 1.0;

    particleMesh.visible = burstEnvelope > 0.01;
    if (particleMesh.visible) {
      const hw = carHalfWidthAtZ(sweepZ);
      const mh = carMaxHeightAtZ(sweepZ);

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const s = seeds[i];
        const cycle = (elapsed * 1.45 + s.phase) % 1.0;
        const lifeScale = Math.sin(cycle * Math.PI) * s.size * burstEnvelope;

        const px = s.xNorm * hw * (0.9 + cycle * 0.22);
        const py = 0.06 + s.yOffset * mh + cycle * s.riseSpeed;
        const pz = sweepZ + s.zJitter - cycle * s.driftBack;

        _dummyPos.set(px, py, pz);
        _dummyEuler.set(cycle * s.spinSpeed, cycle * s.spinSpeed * 0.7, 0);
        _dummyQuat.setFromEuler(_dummyEuler);
        _dummyScale.setScalar(Math.max(0.001, lifeScale));
        _dummyMat4.compose(_dummyPos, _dummyQuat, _dummyScale);
        particleMesh.setMatrixAt(i, _dummyMat4);
      }
      particleMesh.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    uniforms,
    particleMesh,
    setRevealVisible,
    update,
    dispose() {
      for (let i = 0; i < cadMeshes.length; i++) {
        const m = cadMeshes[i];
        m.parent?.remove(m);
      }
      cadCoreMat.dispose();
      cadWireMat.dispose();
      cubeGeo.dispose();
      particleMat.dispose();
    },
  };
}
