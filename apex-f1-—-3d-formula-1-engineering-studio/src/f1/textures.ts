import * as THREE from 'three';

export interface CarbonTextures {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
}

const PETRONAS_TEAL = '#00d2be';
const MERCEDES_SILVER = '#cbd3dc';
const OBSIDIAN_BLACK = '#0e1116';

function drawMicrosoftLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  squareSize: number,
  textColor: string,
  fontSize: number,
) {
  const half = squareSize * 0.46;
  const gap = squareSize * 0.08;
  ctx.fillStyle = '#f25022';
  ctx.fillRect(x, y - half - gap / 2, half, half);
  ctx.fillStyle = '#7fba00';
  ctx.fillRect(x + half + gap, y - half - gap / 2, half, half);
  ctx.fillStyle = '#00a4ef';
  ctx.fillRect(x, y + gap / 2, half, half);
  ctx.fillStyle = '#ffb900';
  ctx.fillRect(x + half + gap, y + gap / 2, half, half);

  ctx.fillStyle = textColor;
  ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Microsoft', x + squareSize + fontSize * 0.32, y + 1);
}

function drawMercedesStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color = '#cbd5e1',
  withRing = true,
) {
  ctx.save();
  if (withRing) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.8, r * 0.13);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
    const aL = a - 0.20;
    const aR = a + 0.20;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(aL) * r * 0.25, cy + Math.sin(aL) * r * 0.25);
    ctx.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
    ctx.lineTo(cx + Math.cos(aR) * r * 0.25, cy + Math.sin(aR) * r * 0.25);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPetronasDrop(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color = PETRONAS_TEAL,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size * 0.85);
  ctx.bezierCurveTo(
    cx + size * 0.65,
    cy - size * 0.15,
    cx + size * 0.62,
    cy + size * 0.65,
    cx,
    cy + size * 0.65,
  );
  ctx.bezierCurveTo(
    cx - size * 0.62,
    cy + size * 0.65,
    cx - size * 0.65,
    cy - size * 0.15,
    cx,
    cy - size * 0.85,
  );
  ctx.fill();

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = Math.max(1.5, size * 0.14);
  ctx.beginPath();
  ctx.arc(cx, cy + size * 0.12, size * 0.24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function createCarbonFiberTextures(maxAnisotropy: number): CarbonTextures {
  const size = 128;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  cCtx.fillStyle = '#0c0e12';
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#505050';
  bCtx.fillRect(0, 0, size, size);

  const cell = 16;
  const cols = size / cell;
  for (let y = 0; y < cols; y++) {
    for (let x = 0; x < cols; x++) {
      const phase = (x + y) % 4;
      const isWarp = phase < 2;

      const grad = isWarp
        ? cCtx.createLinearGradient(x * cell, y * cell, (x + 1) * cell, y * cell)
        : cCtx.createLinearGradient(x * cell, y * cell, x * cell, (y + 1) * cell);

      if (isWarp) {
        grad.addColorStop(0, '#0b0d11');
        grad.addColorStop(0.5, '#252b35');
        grad.addColorStop(1, '#0b0d11');
      } else {
        grad.addColorStop(0, '#13171d');
        grad.addColorStop(0.5, '#2f3643');
        grad.addColorStop(1, '#13171d');
      }
      cCtx.fillStyle = grad;
      cCtx.fillRect(x * cell, y * cell, cell, cell);

      const bGrad = isWarp
        ? bCtx.createLinearGradient(x * cell, y * cell, (x + 1) * cell, y * cell)
        : bCtx.createLinearGradient(x * cell, y * cell, x * cell, (y + 1) * cell);
      bGrad.addColorStop(0, '#363636');
      bGrad.addColorStop(0.5, isWarp ? '#dcdcdc' : '#aeaeae');
      bGrad.addColorStop(1, '#363636');
      bCtx.fillStyle = bGrad;
      bCtx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(26, 26);
  map.anisotropy = maxAnisotropy;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(26, 26);
  bumpMap.anisotropy = maxAnisotropy;

  return { map, bumpMap };
}

/**
 * Exact Mercedes W17 #63 Nose Cone Texture (matching screenshot-010, screenshot-001, screenshot-005):
 * - Brushed silver upper deck tapering to the nose tip
 * - Crisp Petronas teal border stripes
 * - Carbon flanks with AMG bars, FIA circle, Einhell
 * - Top graphics: Star, SAP, AKKODIS, PIRELLI, INEOS, Crowdstrike, Petronas drop, #63, PETRONAS Syntium
 */
export function createW17NoseTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Base exposed twill-black carbon
  ctx.fillStyle = OBSIDIAN_BLACK;
  ctx.fillRect(0, 0, w, h);

  // Brushed metallic silver top deck tapering cleanly forward
  const silverGrad = ctx.createLinearGradient(0, h, 0, 0);
  silverGrad.addColorStop(0, '#b9c2cb');
  silverGrad.addColorStop(0.45, '#dde3ea');
  silverGrad.addColorStop(1, '#c3cbd4');
  ctx.fillStyle = silverGrad;

  ctx.beginPath();
  ctx.moveTo(w * 0.085, 0);
  ctx.lineTo(w * 0.145, h * 0.55);
  ctx.lineTo(w * 0.185, h * 0.96);
  ctx.lineTo(w * 0.25, h);
  ctx.lineTo(w * 0.315, h * 0.96);
  ctx.lineTo(w * 0.355, h * 0.55);
  ctx.lineTo(w * 0.415, 0);
  ctx.closePath();
  ctx.fill();

  // Sharp Petronas Teal border stripes along both edges of the silver deck
  ctx.strokeStyle = PETRONAS_TEAL;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(w * 0.085, 0);
  ctx.lineTo(w * 0.145, h * 0.55);
  ctx.lineTo(w * 0.185, h * 0.96);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(w * 0.415, 0);
  ctx.lineTo(w * 0.355, h * 0.55);
  ctx.lineTo(w * 0.315, h * 0.96);
  ctx.stroke();

  // Left & Right side cheek graphics (AMG stripes + Einhell forward)
  for (const dir of [1, -1] as const) {
    const flankU = dir === 1 ? 0.045 : 0.455;
    ctx.fillStyle = MERCEDES_SILVER;
    ctx.fillRect(w * flankU - 28, h * 0.04, 56, h * 0.32);

    ctx.save();
    ctx.translate(w * flankU, h * 0.20);
    ctx.rotate(dir === 1 ? -Math.PI / 2 : Math.PI / 2);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'italic 800 18px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('//// AMG', 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(w * (dir === 1 ? 0.11 : 0.39), h * 0.72);
    ctx.rotate(dir === 1 ? -Math.PI / 2 : Math.PI / 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Einhell', 0, 0);
    ctx.restore();
  }

  // Top Deck Graphics (flipped horizontally around u=0.25 so front view reads left-to-right!)
  const cx = w * 0.25;
  ctx.save();
  ctx.translate(cx, 0);
  ctx.scale(-1, 1);

  drawMercedesStar(ctx, 0, h * 0.91, 24, '#334155', true);

  ctx.fillStyle = '#0369a1';
  ctx.font = '800 16px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SAP', 0, h * 0.83);

  ctx.fillStyle = '#1e293b';
  ctx.font = '700 14px "Barlow Condensed", sans-serif';
  ctx.fillText('AKKODIS', 0, h * 0.77);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 16px "Barlow Condensed", sans-serif';
  ctx.fillText('PIRELLI', 0, h * 0.71);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 19px "Barlow Condensed", sans-serif';
  ctx.fillText('INEOS', 0, h * 0.64);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 14px "Barlow Condensed", sans-serif';
  ctx.fillText('CROWDSTRIKE', 0, h * 0.57);

  drawPetronasDrop(ctx, 0, h * 0.47, 25, PETRONAS_TEAL);

  // Bold #63 matching screenshot-010 (outlined silver/white numeral)
  ctx.font = 'italic 800 66px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#0b0e14';
  ctx.strokeText('63', 0, h * 0.34);
  ctx.fillStyle = '#f8fafc';
  ctx.fillText('63', 0, h * 0.34);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 17px "Barlow Condensed", sans-serif';
  ctx.fillText('PETRONAS', 0, h * 0.21);
  ctx.fillStyle = '#0d9488';
  ctx.font = '700 15px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Syntium', 0, h * 0.14);

  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Exact Sidepod Texture matching screenshot-010, screenshot-001, screenshot-003:
 * - Swept silver shoulder with bold diagonal carbon stripes
 * - Sweeping Petronas teal wave border separating silver top from obsidian black flank
 * - Large bold metallic-white PETRONAS along lower flank & TeamViewer above
 */
export function createW17SidepodTexture(
  sideSign: 1 | -1,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const w = 1024;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = OBSIDIAN_BLACK;
  ctx.fillRect(0, 0, w, h);

  // Silver shoulder panel visible from top & 3/4 angles
  const shoulderGrad = ctx.createLinearGradient(0, h, 0, 0);
  shoulderGrad.addColorStop(0, '#d8dfe6');
  shoulderGrad.addColorStop(0.55, '#aeb8c2');
  shoulderGrad.addColorStop(1, '#181c24');

  ctx.fillStyle = shoulderGrad;
  const sX1 = sideSign === 1 ? w * 0.14 : w * 0.16;
  const sX2 = sideSign === 1 ? w * 0.36 : w * 0.38;
  ctx.beginPath();
  ctx.moveTo(sX1, h);
  ctx.lineTo(sX1 + 22, h * 0.22);
  ctx.lineTo(w * 0.25, h * 0.06);
  ctx.lineTo(sX2 - 18, h * 0.24);
  ctx.lineTo(sX2, h);
  ctx.closePath();
  ctx.fill();

  // Prominent Swept Diagonal Stripes across silver shoulder (matching screenshot-010 & screenshot-003)
  ctx.fillStyle = '#14171d';
  for (let i = 0; i < 5; i++) {
    const gy = h * (0.76 - i * 0.095);
    ctx.save();
    ctx.translate(w * 0.26, gy);
    ctx.rotate(sideSign * 0.42);
    ctx.fillRect(-75, -15, 150, 26);
    ctx.restore();
  }

  // Sweeping Petronas Teal Wave Ribbon (turning forward cleanly toward inlet)
  const ribbonU = sideSign === 1 ? w * 0.135 : w * 0.375;
  ctx.strokeStyle = PETRONAS_TEAL;
  ctx.lineWidth = 34;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ribbonU + sideSign * 22, h * 0.96);
  ctx.bezierCurveTo(
    ribbonU - sideSign * 26,
    h * 0.74,
    ribbonU + sideSign * 30,
    h * 0.38,
    ribbonU + sideSign * 8,
    h * 0.08,
  );
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.48)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Large Bold PETRONAS along outer sidepod flank
  const textX = sideSign === 1 ? w * 0.055 : w * 0.455;
  ctx.save();
  ctx.translate(textX, h * 0.56);
  ctx.rotate(sideSign === 1 ? -Math.PI / 2 : Math.PI / 2);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '800 58px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PETRONAS', 0, 0);
  ctx.restore();

  // TeamViewer above teal ribbon
  ctx.save();
  ctx.translate(w * (sideSign === 1 ? 0.195 : 0.305), h * 0.62);
  ctx.rotate(sideSign === 1 ? -Math.PI / 2 : Math.PI / 2);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TeamViewer', 0, 0);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Exact Engine Cover Cowling Texture matching screenshot-010, screenshot-003, screenshot-016:
 * - Glossy black cowling
 * - Microsoft (4-color icon + bold white text), SOLERA, TeamViewer, AMD
 * - Iconic Mercedes-Benz 3-pointed silver star mosaic covering the rear cowling taper!
 */
export function createW17EngineCoverTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = OBSIDIAN_BLACK;
  ctx.fillRect(0, 0, w, h);

  // Signature Petronas Teal airbox collar fade at very front top
  ctx.fillStyle = PETRONAS_TEAL;
  ctx.fillRect(w * 0.17, h * 0.94, w * 0.16, h * 0.06);

  // Silver Mercedes-Benz 3-Pointed Star Mosaic Pattern over rear half of engine cover (y = 0..h*0.42)
  const rows = 5;
  const cols = 10;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sy = h * (0.04 + r * 0.085);
      const sx = w * (0.03 + c * 0.048 + (r % 2 === 0 ? 0.022 : 0));
      const radius = 12 + (rows - r) * 1.6;
      const alpha = 0.42 + (rows - r) * 0.1;
      drawMercedesStar(ctx, sx, sy, radius, `rgba(218, 226, 236, ${alpha.toFixed(2)})`, false);
    }
  }

  // Right (+X, u~0.09) and Left (-X, u~0.41) branding
  for (const dir of [1, -1] as const) {
    const cx = dir === 1 ? w * 0.095 : w * 0.405;
    const rot = dir === 1 ? -Math.PI / 2 : Math.PI / 2;

    // Microsoft logo + 4-color icon
    ctx.save();
    ctx.translate(cx, h * 0.78);
    ctx.rotate(rot);
    drawMicrosoftLogo(ctx, -95, 0, 26, '#ffffff', 28);
    ctx.restore();

    // SOLERA
    ctx.save();
    ctx.translate(cx + dir * 22, h * 0.61);
    ctx.rotate(rot);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 22px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SOLERA', 0, 0);
    ctx.restore();

    // TeamViewer
    ctx.save();
    ctx.translate(cx + dir * 40, h * 0.46);
    ctx.rotate(rot);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TeamViewer', 0, 0);
    ctx.restore();

    // AMD near Halo rear collar
    ctx.save();
    ctx.translate(cx - dir * 18, h * 0.90);
    ctx.rotate(rot);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '800 18px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AMD', 0, 0);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createW17SharkFinNumberTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, w, h);

  // Subtle star cluster on lower dorsal fin
  for (let i = 0; i < 4; i++) {
    drawMercedesStar(ctx, 85 + i * 52, 200 - i * 18, 18, 'rgba(203, 213, 225, 0.55)', false);
  }

  // Crisp #63 outlined in white & Petronas Teal (matching screenshot-001 & screenshot-007)
  ctx.font = 'italic 800 156px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#f8fafc';
  ctx.strokeText('63', w * 0.64, h * 0.48);
  ctx.fillStyle = '#0e1116';
  ctx.fillText('63', w * 0.64, h * 0.48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createW17FrontWingFlapTexture(
  flapIndex: 0 | 1 | 2,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const w = 1024;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#11141a';
  ctx.fillRect(0, 0, w, h);

  // Petronas Teal chord stripes matching screenshot-010 & screenshot-001
  if (flapIndex >= 1) {
    ctx.fillStyle = PETRONAS_TEAL;
    ctx.fillRect(w * 0.08, 0, w * 0.04, h);
    ctx.fillRect(w * 0.88, 0, w * 0.04, h);
  }

  for (const cx of [w * 0.26, w * 0.74]) {
    ctx.save();
    ctx.translate(cx, h * 0.72);
    if (flapIndex === 0) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TeamViewer', 0, 0);
    } else if (flapIndex === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 28px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PETRONAS Syntium', 0, 0);
    } else {
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 34px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('INEOS', 0, 0);
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createW17FrontEndplateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#11141a';
  ctx.fillRect(0, 0, w, h);

  // Subtle Petronas Teal inner nose-end edge accent
  ctx.fillStyle = PETRONAS_TEAL;
  ctx.fillRect(0, h * 0.04, w, 10);

  // Crisp 4-color Microsoft logo centered on outer front wing endplate (screenshot-001 & screenshot-005!)
  drawMicrosoftLogo(ctx, w * 0.16, h * 0.62, 34, '#ffffff', 40);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createW17RearWingDrsTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#101319';
  ctx.fillRect(0, 0, w, h);

  // Twin Petronas Teal vertical accent bands near wingtips
  ctx.fillStyle = PETRONAS_TEAL;
  ctx.fillRect(w * 0.06, 0, w * 0.045, h);
  ctx.fillRect(w * 0.895, 0, w * 0.045, h);

  // Forward / Upper face (v=0.12..0.42 -> canvas y=H*0.58..H*0.88): bold PETRONAS (screenshot-010)
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 106px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PETRONAS', w / 2, h * 0.72);

  // Rear trailing face (v=0.58..0.88 -> canvas y=H*0.12..H*0.42): bold CROWDSTRIKE (screenshot-003 & screenshot-007)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic 800 76px "Barlow Condensed", sans-serif';
  ctx.fillText('CROWDSTRIKE', w / 2, h * 0.28);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createW17RearEndplateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#101319';
  ctx.fillRect(0, 0, w, h);

  // Upper Snapdragon (with 'S' badge) & CROWDSTRIKE below (matching screenshot-003 & screenshot-007)
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 44px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Snapdragon', w * 0.50, h * 0.24);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '800 34px "Barlow Condensed", sans-serif';
  ctx.fillText('CROWDSTRIKE', w * 0.50, h * 0.44);

  // Lower PETRONAS PRIMAX & Petronas drop emblem
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '700 22px "Barlow Condensed", sans-serif';
  ctx.fillText('PETRONAS', w * 0.30, h * 0.72);
  ctx.fillStyle = PETRONAS_TEAL;
  ctx.font = '800 24px "Barlow Condensed", sans-serif';
  ctx.fillText('PRIMAX', w * 0.30, h * 0.80);

  drawPetronasDrop(ctx, w * 0.72, h * 0.75, 36, PETRONAS_TEAL);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createW17SignifyFenceTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#14171e';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, w - 12, h - 12);

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(w * 0.22, h * 0.5, 22, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 54px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Signify', w * 0.31, h * 0.52);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createW17ForgedWheelTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#0c0e13';
  ctx.fillRect(0, 0, size, size);

  // Woven carbon outer aero shroud ring (matching screenshot-004 & screenshot-006)
  const ringGrad = ctx.createRadialGradient(cx, cy, 42, cx, cy, 248);
  ringGrad.addColorStop(0, '#0b0d11');
  ringGrad.addColorStop(0.58, '#13161d');
  ringGrad.addColorStop(0.62, '#222732');
  ringGrad.addColorStop(0.86, '#1a1e27');
  ringGrad.addColorStop(0.93, '#101318');
  ringGrad.addColorStop(1, '#090b0f');
  ctx.fillStyle = ringGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 248, 0, Math.PI * 2);
  ctx.fill();

  // Subtle concentric carbon texture ticks
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let r = 152; r < 224; r += 8) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Red inner hub spline ring + green center lock accent (matching screenshot-004 & screenshot-006!)
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createW17MirrorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0e1116';
  ctx.fillRect(0, 0, w, h);

  // White PETRONAS wording on front mirror face
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 32px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PETRONAS', w * 0.36, h * 0.5);

  // Amber/yellow 3-row LED indicator matrix on outer corner (matching screenshot-016!)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(w * 0.68 + col * 14, h * 0.32 + row * 22, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createRainLightMatrixTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#180404';
  ctx.fillRect(0, 0, w, h);

  // Glowing oval LED ring array (matching screenshot-003 & screenshot-007!)
  ctx.strokeStyle = '#ff2222';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.roundRect(22, 34, w - 44, h - 68, 32);
  ctx.stroke();

  ctx.strokeStyle = '#ff9090';
  ctx.lineWidth = 5;
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRadiatorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#252930';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? '#64748b' : '#334155';
    ctx.fillRect(0, y, size, 2);
  }
  for (let x = 0; x < size; x += 16) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
    ctx.fillRect(x, 0, 2, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createSteeringDisplayTexture(): THREE.CanvasTexture {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#070a0f';
  ctx.fillRect(0, 0, w, h);

  const ledColors = ['#22c55e', '#22c55e', '#22c55e', '#ef4444', '#ef4444', '#00d2be', '#00d2be'];
  for (let i = 0; i < ledColors.length; i++) {
    ctx.fillStyle = ledColors[i];
    ctx.beginPath();
    ctx.arc(38 + i * 30, 18, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 58px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('8', w / 2, 74);

  ctx.fillStyle = '#00d2be';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('328', 18, 66);
  ctx.fillStyle = '#22c55e';
  ctx.textAlign = 'right';
  ctx.fillText('-0.18', w - 18, 66);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('STRAT 1', 18, 108);
  ctx.textAlign = 'right';
  ctx.fillText('SOC 92%', w - 18, 108);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createTireSidewallTexture(
  stripeHex: string,
  compoundCode: string,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#131519';
  ctx.fillRect(0, 0, size, size);

  for (let r = 135; r < 252; r += 3) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 6 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Compound colored Pirelli P-Zero bracket arcs + checkered accent (matching screenshot-004 & screenshot-006)
  ctx.strokeStyle = stripeHex;
  ctx.lineWidth = 12;
  ctx.lineCap = 'butt';

  for (const offset of [Math.PI * 0.22, Math.PI * 1.22]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 206, offset, offset + Math.PI * 0.52);
    ctx.stroke();
  }

  const drawArcText = (text: string, radius: number, centerAngle: number, flip: boolean) => {
    ctx.save();
    ctx.font = '800 26px "Barlow Condensed", sans-serif';
    ctx.fillStyle = stripeHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = 0.095;
    const total = (text.length - 1) * step;
    for (let i = 0; i < text.length; i++) {
      const a = centerAngle + (flip ? -1 : 1) * (-total / 2 + i * step);
      ctx.save();
      ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.rotate(a + (flip ? -Math.PI / 2 : Math.PI / 2));
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  drawArcText('PIRELLI', 206, -Math.PI / 2, false);
  drawArcText(`P ZERO ${compoundCode}`, 206, Math.PI / 2, true);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createTireTreadTexture(
  grooved: boolean,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#16181c';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const v = 18 + Math.floor(Math.random() * 16);
    ctx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(w * 0.495, 0, w * 0.01, h);

  if (grooved) {
    ctx.strokeStyle = '#07080a';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (let y = -32; y < h + 64; y += 36) {
      ctx.beginPath();
      ctx.moveTo(18, y + 26);
      ctx.lineTo(w * 0.46, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(w - 18, y + 26);
      ctx.lineTo(w * 0.54, y);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBrakeRotorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = '#2d3036';
  ctx.fillRect(0, 0, size, size);

  for (let r = 48; r < 122; r += 2) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = r % 4 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.24)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.fillStyle = '#090a0d';
  const spokes = 28;
  for (let i = 0; i < spokes; i++) {
    const baseAngle = (i / spokes) * Math.PI * 2;
    for (let j = 0; j < 4; j++) {
      const r = 62 + j * 14;
      const a = baseAngle + j * 0.06;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createStudioFloorTexture(
  isLightStudio: boolean,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isLightStudio ? '#f4f5f7' : '#161b23';
  ctx.fillRect(0, 0, size, size);

  if (isLightStudio) {
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.03)';
    ctx.lineWidth = 1;
    const step = size / 4;
    for (let i = 0; i <= 4; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const shade = 20 + Math.floor(Math.random() * 10);
      ctx.fillStyle = `rgb(${shade}, ${shade + 3}, ${shade + 7})`;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;
    const step = size / 4;
    for (let i = 0; i <= 4; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;

  const grad = ctx.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.48);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.42)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
