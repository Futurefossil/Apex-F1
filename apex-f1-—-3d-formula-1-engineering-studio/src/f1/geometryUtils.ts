import * as THREE from 'three';

export interface LoftStation {
  z: number;
  cx?: number;
  cy: number;
  rx: number;
  ryTop: number;
  ryBot: number;
  power?: number;
  flatBottomY?: number;
}

/**
 * Smoothly resamples coarse stations along Z using Catmull-Rom spline interpolation
 * so sculpted F1 bodywork flows seamlessly without longitudinal faceting.
 */
export function interpolateStations(
  stations: LoftStation[],
  subdivisionsPerSpan = 3,
): LoftStation[] {
  if (stations.length < 2) return stations;
  const totalOut = (stations.length - 1) * subdivisionsPerSpan + 1;

  const czCurve = new THREE.CatmullRomCurve3(
    stations.map((s) => new THREE.Vector3(s.cx ?? 0, s.cy, s.z)),
  );
  const dimCurve = new THREE.CatmullRomCurve3(
    stations.map((s) => new THREE.Vector3(s.rx, s.ryTop, s.ryBot)),
  );
  const pCurve = new THREE.CatmullRomCurve3(
    stations.map(
      (s, i) =>
        new THREE.Vector3(
          s.power ?? 2.4,
          s.flatBottomY ?? -999,
          i / (stations.length - 1),
        ),
    ),
  );

  const out: LoftStation[] = [];
  for (let i = 0; i < totalOut; i++) {
    const t = i / (totalOut - 1);
    const pos = czCurve.getPoint(t);
    const dims = dimCurve.getPoint(t);
    const extra = pCurve.getPoint(t);

    out.push({
      z: pos.z,
      cx: pos.x,
      cy: pos.y,
      rx: Math.max(0.004, dims.x),
      ryTop: Math.max(0.004, dims.y),
      ryBot: Math.max(0.004, dims.z),
      power: Math.max(1.5, extra.x),
      flatBottomY: extra.y > -500 ? extra.y : undefined,
    });
  }
  return out;
}

/**
 * Generates a watertight, smoothly shaded lofted BufferGeometry from cross-sectional
 * stations along the Z-axis.
 */
export function createLoftedGeometry(
  stations: LoftStation[],
  radialSegments = 40,
  capEnds = true,
  smoothSubdivisions = 2,
): THREE.BufferGeometry {
  const resampled =
    smoothSubdivisions > 1 ? interpolateStations(stations, smoothSubdivisions) : stations;

  const numStations = resampled.length;
  const cols = radialSegments + 1;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let s = 0; s < numStations; s++) {
    const st = resampled[s];
    const cx = st.cx ?? 0;
    const p = st.power ?? 2.2;
    const vCoord = s / (numStations - 1);

    for (let r = 0; r <= radialSegments; r++) {
      const uCoord = r / radialSegments;
      const theta = uCoord * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const signX = Math.sign(cosT);
      const signY = Math.sign(sinT);

      const nx = signX * Math.pow(Math.abs(cosT), 2 / p);
      const ny = signY * Math.pow(Math.abs(sinT), 2 / p);

      const x = cx + nx * st.rx;
      let y = st.cy + ny * (ny >= 0 ? st.ryTop : st.ryBot);

      if (st.flatBottomY !== undefined && y < st.flatBottomY) {
        y = st.flatBottomY;
      }

      positions.push(x, y, st.z);
      uvs.push(uCoord, vCoord);
    }
  }

  for (let s = 0; s < numStations - 1; s++) {
    for (let r = 0; r < radialSegments; r++) {
      const a = s * cols + r;
      const b = (s + 1) * cols + r;
      const c = (s + 1) * cols + (r + 1);
      const d = s * cols + (r + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  if (capEnds && numStations >= 2) {
    const st0 = resampled[0];
    const startCenterIdx = positions.length / 3;
    positions.push(st0.cx ?? 0, st0.cy, st0.z);
    uvs.push(0.5, 0);
    for (let r = 0; r < radialSegments; r++) {
      indices.push(startCenterIdx, r + 1, r);
    }

    const stLast = resampled[numStations - 1];
    const endCenterIdx = positions.length / 3;
    const base = (numStations - 1) * cols;
    positions.push(stLast.cx ?? 0, stLast.cy, stLast.z);
    uvs.push(0.5, 1);
    for (let r = 0; r < radialSegments; r++) {
      indices.push(endCenterIdx, base + r, base + r + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Generates an aerodynamic cambered F1 wing foil with smooth spanwise sweep,
 * gull-wing curvature, dihedral, and chord taper.
 */
export function createAirfoilWingGeometry(options: {
  span: number;
  chord: number;
  thickness: number;
  camber: number;
  angleOfAttackRad: number;
  sweepBack?: number;
  dihedral?: number;
  gullArch?: number;
  taper?: number;
  spanSegments?: number;
  chordSegments?: number;
}): THREE.BufferGeometry {
  const {
    span,
    chord,
    thickness,
    camber,
    angleOfAttackRad,
    sweepBack = 0,
    dihedral = 0,
    gullArch = 0,
    taper = 1,
    spanSegments = 32,
    chordSegments = 20,
  } = options;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const profileCols = chordSegments * 2 + 1;

  for (let s = 0; s <= spanSegments; s++) {
    const uSpan = s / spanSegments;
    const x = (uSpan - 0.5) * span;
    const absNorm = Math.abs(x) / (span * 0.5);

    // Smooth curved planform sweep & gull-wing Y profile
    const smoothSweep = Math.pow(absNorm, 1.55);
    const localChord = chord * (1 - (1 - taper) * smoothSweep);
    const zOffset = -sweepBack * smoothSweep;
    const yOffset = dihedral * absNorm + gullArch * Math.sin(absNorm * Math.PI);

    const cosA = Math.cos(angleOfAttackRad);
    const sinA = Math.sin(angleOfAttackRad);

    for (let p = 0; p < profileCols; p++) {
      const isUpper = p <= chordSegments;
      const t = isUpper
        ? p / chordSegments
        : (profileCols - 1 - p) / chordSegments;

      const yt =
        5 *
        thickness *
        localChord *
        (0.2969 * Math.sqrt(Math.max(0, t)) -
          0.126 * t -
          0.3516 * t * t +
          0.2843 * t * t * t -
          0.1015 * t * t * t * t);

      const yc = -camber * localChord * 4 * t * (1 - t);

      const localZ = (0.5 - t) * localChord;
      const localY = yc + (isUpper ? yt : -yt);

      const rz = localZ * cosA - localY * sinA;
      const ry = localZ * sinA + localY * cosA;

      positions.push(x, yOffset + ry, zOffset + rz);
      uvs.push(uSpan, p / (profileCols - 1));
    }
  }

  for (let s = 0; s < spanSegments; s++) {
    for (let p = 0; p < profileCols - 1; p++) {
      const a = s * profileCols + p;
      const b = (s + 1) * profileCols + p;
      const c = (s + 1) * profileCols + (p + 1);
      const d = s * profileCols + (p + 1);

      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
