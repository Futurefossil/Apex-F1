import * as THREE from 'three';

const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// 13-tap Separable Gaussian Blur Shader
const GAUSSIAN_BLUR_FRAG = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uTexelOffset;
  varying vec2 vUv;

  void main() {
    vec4 sum = texture2D(tInput, vUv) * 0.145;
    sum += texture2D(tInput, vUv + uTexelOffset * 1.3846) * 0.132;
    sum += texture2D(tInput, vUv - uTexelOffset * 1.3846) * 0.132;
    sum += texture2D(tInput, vUv + uTexelOffset * 3.2307) * 0.098;
    sum += texture2D(tInput, vUv - uTexelOffset * 3.2307) * 0.098;
    sum += texture2D(tInput, vUv + uTexelOffset * 5.0769) * 0.062;
    sum += texture2D(tInput, vUv - uTexelOffset * 5.0769) * 0.062;
    sum += texture2D(tInput, vUv + uTexelOffset * 6.9230) * 0.036;
    sum += texture2D(tInput, vUv - uTexelOffset * 6.9230) * 0.036;
    sum += texture2D(tInput, vUv + uTexelOffset * 8.7692) * 0.018;
    sum += texture2D(tInput, vUv - uTexelOffset * 8.7692) * 0.018;
    gl_FragColor = sum / 0.837;
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tSharpBg;
  uniform sampler2D tBlurBg;
  uniform sampler2D tFocus;
  uniform float uFocusBlend;
  uniform float uDimFactor;
  varying vec2 vUv;

  void main() {
    vec4 sharpBg = texture2D(tSharpBg, vUv);
    vec4 blurBg = texture2D(tBlurBg, vUv);
    vec4 focus = texture2D(tFocus, vUv);

    // Subtle dimming on unfocused scene (minimal in white studio so cyclorama stays clean)
    vec3 dimmedBlur = blurBg.rgb * mix(1.0, uDimFactor, uFocusBlend);
    vec3 bgMixed = mix(sharpBg.rgb, dimmedBlur, uFocusBlend);

    // Alpha-composite razor-sharp focused component over Gaussian-blurred rest of car
    float focusAlpha = clamp(focus.a, 0.0, 1.0) * uFocusBlend;
    vec3 finalColor = mix(bgMixed, focus.rgb, focusAlpha);

    gl_FragColor = vec4(finalColor, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class SelectiveFocusRenderer {
  private bgRT: THREE.WebGLRenderTarget;
  private blurRT1: THREE.WebGLRenderTarget;
  private blurRT2: THREE.WebGLRenderTarget;
  private focusRT: THREE.WebGLRenderTarget;

  private quadScene: THREE.Scene;
  private quadCamera: THREE.OrthographicCamera;
  private quadMesh: THREE.Mesh;

  private blurMat: THREE.ShaderMaterial;
  private compositeMat: THREE.ShaderMaterial;
  private depthOnlyMat: THREE.MeshBasicMaterial;

  private width = 1;
  private height = 1;

  constructor(width: number, height: number, pixelRatio: number) {
    const w = Math.max(2, Math.floor(width * pixelRatio));
    const h = Math.max(2, Math.floor(height * pixelRatio));
    this.width = w;
    this.height = h;

    const rtOptions: THREE.RenderTargetOptions = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    };

    this.bgRT = new THREE.WebGLRenderTarget(w, h, rtOptions);
    this.focusRT = new THREE.WebGLRenderTarget(w, h, rtOptions);

    const bw = Math.max(2, Math.floor(w / 2));
    const bh = Math.max(2, Math.floor(h / 2));
    this.blurRT1 = new THREE.WebGLRenderTarget(bw, bh, { ...rtOptions, depthBuffer: false });
    this.blurRT2 = new THREE.WebGLRenderTarget(bw, bh, { ...rtOptions, depthBuffer: false });

    this.blurMat = new THREE.ShaderMaterial({
      uniforms: {
        tInput: { value: null },
        uTexelOffset: { value: new THREE.Vector2(1 / bw, 0) },
      },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: GAUSSIAN_BLUR_FRAG,
      depthTest: false,
      depthWrite: false,
    });

    this.compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tSharpBg: { value: this.bgRT.texture },
        tBlurBg: { value: this.blurRT2.texture },
        tFocus: { value: this.focusRT.texture },
        uFocusBlend: { value: 0 },
        uDimFactor: { value: 0.94 },
      },
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });

    this.depthOnlyMat = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
    });

    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quadScene = new THREE.Scene();
    this.quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blurMat);
    this.quadScene.add(this.quadMesh);
  }

  public setSize(width: number, height: number, pixelRatio: number) {
    const w = Math.max(2, Math.floor(width * pixelRatio));
    const h = Math.max(2, Math.floor(height * pixelRatio));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.bgRT.setSize(w, h);
    this.focusRT.setSize(w, h);
    const bw = Math.max(2, Math.floor(w / 2));
    const bh = Math.max(2, Math.floor(h / 2));
    this.blurRT1.setSize(bw, bh);
    this.blurRT2.setSize(bw, bh);
  }

  public render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    focusedGroups: THREE.Group[],
    unfocusedObjects: THREE.Object3D[],
    focusBlend: number,
    dimFactor = 0.94,
  ) {
    if (focusBlend <= 0.001 || focusedGroups.length === 0) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }

    const prevAutoClear = renderer.autoClear;
    const prevClearAlpha = renderer.getClearAlpha();
    const prevClearColor = new THREE.Color();
    renderer.getClearColor(prevClearColor);

    // 1. Render unfocused scene (focused component hidden to prevent color bleeding into blur)
    for (const g of focusedGroups) g.visible = false;
    renderer.setRenderTarget(this.bgRT);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    for (const g of focusedGroups) g.visible = true;

    // 2. Two-iteration Separable Gaussian Blur at half resolution
    const bw = Math.max(2, Math.floor(this.width / 2));
    const bh = Math.max(2, Math.floor(this.height / 2));
    const r1 = 1.35 * focusBlend;
    const r2 = 2.35 * focusBlend;

    this.quadMesh.material = this.blurMat;

    // Iteration 1
    this.blurMat.uniforms.tInput.value = this.bgRT.texture;
    this.blurMat.uniforms.uTexelOffset.value.set(r1 / bw, 0);
    renderer.setRenderTarget(this.blurRT1);
    renderer.render(this.quadScene, this.quadCamera);

    this.blurMat.uniforms.tInput.value = this.blurRT1.texture;
    this.blurMat.uniforms.uTexelOffset.value.set(0, r1 / bh);
    renderer.setRenderTarget(this.blurRT2);
    renderer.render(this.quadScene, this.quadCamera);

    // Iteration 2
    this.blurMat.uniforms.tInput.value = this.blurRT2.texture;
    this.blurMat.uniforms.uTexelOffset.value.set(r2 / bw, 0);
    renderer.setRenderTarget(this.blurRT1);
    renderer.render(this.quadScene, this.quadCamera);

    this.blurMat.uniforms.tInput.value = this.blurRT1.texture;
    this.blurMat.uniforms.uTexelOffset.value.set(0, r2 / bh);
    renderer.setRenderTarget(this.blurRT2);
    renderer.render(this.quadScene, this.quadCamera);

    // 3. Render ONLY focused component into focusRT with transparent background
    //    and a depth pre-pass of unfocused objects so occlusion remains accurate.
    const savedBg = scene.background;
    const savedFog = scene.fog;
    const prevVisibilities = unfocusedObjects.map((o) => o.visible);

    scene.background = null;
    scene.fog = null;

    renderer.setRenderTarget(this.focusRT);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);

    // Depth pre-pass of unfocused parts
    for (const g of focusedGroups) g.visible = false;
    scene.overrideMaterial = this.depthOnlyMat;
    renderer.render(scene, camera);
    scene.overrideMaterial = null;

    // Color pass of ONLY focused component
    for (const g of focusedGroups) g.visible = true;
    for (const o of unfocusedObjects) o.visible = false;
    renderer.render(scene, camera);

    // Restore scene visibility & atmosphere
    for (let i = 0; i < unfocusedObjects.length; i++) {
      unfocusedObjects[i].visible = prevVisibilities[i];
    }
    scene.background = savedBg;
    scene.fog = savedFog;

    // 4. Composite blurred scene + sharp focused component onto main screen
    this.quadMesh.material = this.compositeMat;
    this.compositeMat.uniforms.tSharpBg.value = this.bgRT.texture;
    this.compositeMat.uniforms.tBlurBg.value = this.blurRT2.texture;
    this.compositeMat.uniforms.tFocus.value = this.focusRT.texture;
    this.compositeMat.uniforms.uFocusBlend.value = focusBlend;
    this.compositeMat.uniforms.uDimFactor.value = dimFactor;

    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    renderer.setClearColor(prevClearColor, prevClearAlpha);
    renderer.render(this.quadScene, this.quadCamera);
    renderer.autoClear = prevAutoClear;
  }

  public dispose() {
    this.bgRT.dispose();
    this.blurRT1.dispose();
    this.blurRT2.dispose();
    this.focusRT.dispose();
    this.quadMesh.geometry.dispose();
    this.blurMat.dispose();
    this.compositeMat.dispose();
    this.depthOnlyMat.dispose();
  }
}
