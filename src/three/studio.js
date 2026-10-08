import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

import { buildTier, pipedBorder, makeDrips, makeRibbon, makeCandles, radiusAtAngle } from './shapes.js';
import { buildTopper, setTopperQuality } from './toppers.js';
import * as TX from '../lib/textures.js';
import { resolve } from '../lib/pricing.js';
import { makeRng, shade, hexToInt, clamp, lerp } from '../lib/utils.js';

const TAU = Math.PI * 2;

// Albedo/detail texture sizes, per quality tier. These are the single
// biggest lever on how crisp the frosting surface reads up close.
//
// The high tier is 2048 rather than 1024 because the piped finish is a
// high-contrast line pattern viewed at a grazing angle, which is the worst case
// for any texture filter: at 1024 over a 4-unit tile the crease lines land near
// a pixel wide at the far rim of a tier and the mip chain softens them to a
// gradient. Doubling the texels puts the cost where it is not felt (one canvas
// per finish, generated once and cached) and the detail where it is seen.
// The detail tier stays at 512 — the normal map is a smooth field derived from
// the albedo, so it gains far less from extra texels than the lines do.
const TEX = {
  high: { albedo: 2048, detail: 512 },
  medium: { albedo: 1024, detail: 384 },
  low: { albedo: 512, detail: 256 },
};

/**
 * Unsharp mask — a light 5-tap sharpen run on the final composite.
 * Post-processing softens the image twice over (the composer's half-float
 * round trip, then SMAA's edge blending), so this hands back the micro
 * contrast that makes piped detail and sugar grains read as sharp.
 */
const UnsharpShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    amount: { value: 0.35 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      vec2 px = 1.0 / resolution;
      vec4 c = texture2D(tDiffuse, vUv);
      vec4 blur = texture2D(tDiffuse, vUv + vec2(-px.x, -px.y))
                + texture2D(tDiffuse, vUv + vec2( px.x, -px.y))
                + texture2D(tDiffuse, vUv + vec2(-px.x,  px.y))
                + texture2D(tDiffuse, vUv + vec2( px.x,  px.y));
      blur *= 0.25;
      gl_FragColor = vec4(c.rgb + (c.rgb - blur.rgb) * amount, c.a);
    }`,
};

// ─────────────────────────────────────────────────────────────────────────────
// CakeStudio — owns the renderer, the scene and the live cake model.
// The rest of the app talks to it only through setDesign() and a few verbs.
// ─────────────────────────────────────────────────────────────────────────────

export class CakeStudio {
  constructor(canvas, { onReady } = {}) {
    this.canvas = canvas;
    this.onReady = onReady;
    this.disposed = false;
    this.design = null;
    this.cakeRoot = null;
    this.disposables = [];
    this.clock = new THREE.Clock();
    this.spin = 0.06;
    this.turntable = true;
    this.quality = 'high';
    this.textureCache = new Map();
    this._cachedTextures = new Set();
    this._texGen = 0;
    this._slowDebt = 0;
    this._degraded = false;

    this._initRenderer();
    this._initScene();
    this._initPost();
    this._initLights();
    this._initControls();
    this._initKnobs();
    setTopperQuality(this.quality);

    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._resize();

    this._lastDesignKey = null;
    this._animate = this._animate.bind(this);
    this._raf = requestAnimationFrame(this._animate);
    this.onReady?.();
  }

  // ── setup ────────────────────────────────────────────────────────────────

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      // The default framebuffer is only ever blitted to; the scene is drawn
      // into the composer's target, so MSAA has to live there (see _initPost).
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this._targetDpr());
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Superseded at boot by setBackdrop(), which owns the exposure; this is
    // only the value a studio constructed without a backdrop would start from.
    this.renderer.toneMappingExposure = 0.80;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    const gl = this.renderer.getContext();
    this.caps = {
      float: !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float'),
      aniso: this.renderer.capabilities.getMaxAnisotropy(),
      maxSamples: gl.getParameter(gl.MAX_SAMPLES) || 0,
    };
  }

  /**
   * Device pixel ratio for the current quality tier. 'high' asks for a true
   * retina buffer (up to 2.5x) rather than the 2x ceiling that was capping
   * the whole studio below the display's own resolution on 3x screens.
   */
  _targetDpr() {
    const q = this.quality;
    if (q === 'high') return Math.min(devicePixelRatio || 1, 2.5);
    if (q === 'medium') return Math.min(devicePixelRatio || 1, 1.5);
    return 1;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
    this.camera.position.set(0.4, 5.2, 11.2);

    // Studio backdrop: a large gradient dome the cake sits inside.
    const domeGeo = new THREE.SphereGeometry(60, 64, 48);
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: { value: new THREE.Color('#1a1420') },
        mid: { value: new THREE.Color('#2a1f2b') },
        bottom: { value: new THREE.Color('#0d0b12') },
        glow: { value: new THREE.Color('#c9a24b') },
      },
      vertexShader: `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 glow;
        varying vec3 vPos;
        void main() {
          float h = normalize(vPos).y;
          vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.7)) : mix(mid, bottom, pow(-h, 0.55));
          // soft warm pool of light behind the cake
          float back = smoothstep(0.2, 1.0, -normalize(vPos).z) * smoothstep(0.55, -0.25, h);
          c += glow * back * 0.10;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.dome = new THREE.Mesh(domeGeo, domeMat);
    this.scene.add(this.dome);

    // Environment for reflections — generated, never fetched.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envRT = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.75;
    room.dispose?.();
    pmrem.dispose();

    // Ground — dark, softly reflective, so the cake reads as a product shot.
    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(30, 128),
      new THREE.MeshStandardMaterial({
        color: '#17131c', roughness: 0.55, metalness: 0.15,
      }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.02;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.cakeRoot = new THREE.Group();
    this.scene.add(this.cakeRoot);
  }

  _initPost() {
    // MSAA lives on the composer's render target: the scene never touches the
    // default framebuffer, so `antialias: true` on the renderer did nothing
    // while post-processing was active (it only ever applied to the final blit).
    // 4x MSAA is the sweet spot: it resolves the tier silhouettes and the
    // stand's hard edges, and going to 8x nearly doubles the resolve cost for
    // detail SMAA already covers.
    const samples = Math.min(4, this.caps.maxSamples || 0);
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples,
    });
    rt.texture.name = 'CakeStudio.scene';

    this.composer = new EffectComposer(this.renderer, rt);
    // Keep the composer's own ratio in sync — it multiplies by this internally.
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Bloom runs at half resolution. It is a wide, low-frequency glow, so the
    // downsample is invisible but the pass costs a quarter as much.
    //
    // Threshold 0.92 sat INSIDE the lit frosting — a 0.97-albedo ivory under a
    // bright key exceeds that almost everywhere, so bloom was laying a white
    // veil over the whole surface instead of catching only the speculars. At
    // 1.05 it fires just on candle flames, sugar crystals and the metal glaze.
    // Strength comes down with it, since what is left is all highlight.
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(0.5, 0.5), 0.26, 0.62, 1.05,
    );
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    // SMAA still earns its place on top of MSAA: it cleans up the shader-driven
    // alpha edges on foliage and drips that MSAA alone misses. It also runs
    // before the final blit, which is where the old code's sizing bug bit.
    this.smaa = new SMAAPass(1, 1);
    this.composer.addPass(this.smaa);
    this._unsharp = new ShaderPass(UnsharpShader);
    this._unsharp.uniforms.resolution.value.set(1, 1);
    this._unsharp.uniforms.amount.value = 0.35;
    this.composer.addPass(this._unsharp);
  }

  _initLights() {
    // Light budget. Six lights at the old intensities summed to roughly 5.5x
    // irradiance on a 0.97-albedo frosting, which clipped the relief flat (see
    // toneMappingExposure). These are scaled down ~1.5x as a set so the RATIO
    // — and therefore the modelling, the rim and the raking micro-shadows — is
    // unchanged; only the absolute level moves back below the clip point.
    //
    // Fill light stays low: ambient and hemispheric light are what flatten
    // modelling and read as "washed out". Contrast comes from the key.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.08));

    const key = new THREE.DirectionalLight(0xfff2dd, 1.75);
    key.position.set(6, 11, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 40;
    const S = 9;
    Object.assign(key.shadow.camera, { left: -S, right: S, top: S, bottom: -S });
    // Tightened from -0.0012/0.022: the old bias was pushing contact shadows
    // off the tiers, so the stack floated instead of sitting on the stand.
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.008;
    key.shadow.radius = 2;
    this.scene.add(key);
    this.keyLight = key;

    // Raking left kicker — at a grazing angle to the tiers so piping and
    // crumb throw micro-shadows that make the surface read as textured.
    const rake = new THREE.DirectionalLight(0xffffff, 0.58);
    rake.position.set(-7.5, 2.2, 3.2);
    this.scene.add(rake);
    this.rakeLight = rake;

    const fill = new THREE.DirectionalLight(0xa9c4ff, 0.37);
    fill.position.set(-8, 5, -4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffd9a0, 0.78);
    rim.position.set(-3, 4, -9);
    this.scene.add(rim);

    const bounce = new THREE.PointLight(0xffe4c0, 0.27, 18, 2);
    bounce.position.set(0, 0.6, 6);
    this.scene.add(bounce);
    this.bounceLight = bounce;
  }

  _initControls() {
    const c = new OrbitControls(this.camera, this.canvas);
    c.enableDamping = true;
    c.dampingFactor = 0.06;
    c.enablePan = false;
    c.minDistance = 5.2;
    c.maxDistance = 20;
    c.minPolarAngle = 0.22;
    c.maxPolarAngle = Math.PI * 0.495;
    c.target.set(0, 1.5, 0);
    c.autoRotate = false;
    this.controls = c;
    this._homeTarget = c.target.clone();
  }

  /** Visual knobs driven from the UI: backdrop, filming frame, bloom. */
  _initKnobs() {
    this.backdrops = {
      atelier: { top: '#1a1420', mid: '#2a1f2b', bottom: '#0d0b12', glow: '#c9a24b', floor: '#17131c' },
      marble:  { top: '#2b2b30', mid: '#3a3a42', bottom: '#141418', glow: '#e8e2d8', floor: '#232328' },
      blush:   { top: '#3a2531', mid: '#4a2f3a', bottom: '#1c1218', glow: '#f0b7c6', floor: '#2a1c22' },
      garden:  { top: '#1b2a24', mid: '#24382d', bottom: '#0e1613', glow: '#b8c4a8', floor: '#16201b' },
      studio:  { top: '#f2efe9', mid: '#e6e1d8', bottom: '#cfc8bd', glow: '#ffffff', floor: '#ded8ce' },
    };
    this.stagePresets = {
      hero:      { pos: [0.4, 5.2, 11.2], target: [0, 1.5, 0] },
      close:     { pos: [0.2, 3.2, 6.6],  target: [0, 1.7, 0] },
      table:     { pos: [0.0, 2.0, 8.4],  target: [0, 1.2, 0] },
      overhead:  { pos: [0.01, 12.5, 0.4], target: [0, 1.0, 0] },
      editorial: { pos: [-6.5, 4.4, 7.0], target: [0, 1.5, 0] },
    };
    this.setBackdrop('atelier');
  }

  setBackdrop(id) {
    const b = this.backdrops[id] || this.backdrops.atelier;
    const u = this.dome.material.uniforms;
    u.top.value.set(b.top);
    u.mid.value.set(b.mid);
    u.bottom.value.set(b.bottom);
    u.glow.value.set(b.glow);
    this.floor.material.color.set(b.floor);
    const light = ['studio', 'marble'].includes(id);
    // Exposure lives HERE, not in _initRenderer: setBackdrop runs at boot (via
    // _initKnobs) and would overwrite anything set earlier. Single source.
    // The bright 'studio' dome already lifts the cake through the environment,
    // so it needs less gain again — otherwise the ivory frosting clips under
    // that backdrop and nowhere else. Ratios from the measured histograms.
    this.scene.environmentIntensity = light ? 0.95 : 0.66;
    this.renderer.toneMappingExposure = light ? 0.72 : 0.80;
  }

  /** One of: hero | close | table | overhead | editorial */
  setStage(id) {
    const p = this.stagePresets[id] || this.stagePresets.hero;
    this._flyTo(new THREE.Vector3(...p.pos), new THREE.Vector3(...p.target));
  }

  _flyTo(pos, target) {
    this._flight = {
      t: 0,
      fromPos: this.camera.position.clone(),
      toPos: pos,
      fromTarget: this.controls.target.clone(),
      toTarget: target,
    };
  }

  setTurntable(on) {
    this.turntable = on;
    this.spin = on ? 0.14 : 0;
  }

  setQuality(q) {
    const prev = this.quality;
    this.quality = q;
    const dpr = this._targetDpr();
    this.renderer.setPixelRatio(dpr);
    this.composer?.setPixelRatio?.(dpr);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.bloom.enabled = q !== 'low';
    if (this._unsharp) this._unsharp.enabled = q !== 'low';
    const shadowSize = q === 'high' ? 4096 : q === 'medium' ? 2048 : 1024;
    if (this.keyLight) {
      this.keyLight.shadow.mapSize.set(shadowSize, shadowSize);
      // the shadow map only reallocates when the old one is dropped
      this.keyLight.shadow.map?.dispose();
      this.keyLight.shadow.map = null;
    }
    // Texture resolution is baked in when a map is generated, so a quality
    // change has to invalidate the cache and rebuild the cake.
    if (prev !== q) {
      this._texGen++;
      for (const t of this._cachedTextures) t.dispose?.();
      this._cachedTextures.clear();
      this.textureCache.clear();
      // Topper geometry is built from these segment counts, so it has to be
      // set before the cake rebuilds.
      setTopperQuality(q);
      if (this.design) this._build();
    }
    this._resize();
  }

  // ── texture + material factory ────────────────────────────────────────────

  _frostingMaps(frosting, baseColor, flavorColor) {
    const B = baseColor;
    const light = shade(B, 0.45);
    const dark = shade(B, -0.55);
    let albedoDraw;
    let bumpDraw;

    switch (frosting.style) {
      case 'buttercream':
        albedoDraw = (c, s) => TX.pipedTexture(c, s, B);
        // null, not a second pipedTexture pass — see below.
        bumpDraw = null;
        break;
      case 'chocolate':
        albedoDraw = (c, s) => TX.speckle(c, s, { base: B, dots: 2200, dotAlpha: 0.05, mottle: 0.05 });
        bumpDraw = (c, s) => TX.crumbTexture(c, s, '#808080');
        break;
      case 'fondant':
        albedoDraw = (c, s) => TX.fondantTexture(c, s, B);
        bumpDraw = (c, s) => TX.fondantTexture(c, s, '#808080');
        break;
      case 'mirror':
        albedoDraw = (c, s) => TX.speckle(c, s, { base: B, dots: 500, dotAlpha: 0.02, mottle: 0.03 });
        // No normal map: a mirror glaze is glass-flat, and the leftover pinhole
        // speckle is so fine that a map derived from it is pure noise.
        bumpDraw = null;
        break;
      case 'stucco':
        albedoDraw = (c, s) => TX.stuccoTexture(c, s, B);
        bumpDraw = (c, s) => TX.stuccoTexture(c, s, '#808080');
        break;
      case 'semi-naked':
        albedoDraw = (c, s) => TX.semiNakedTexture(c, s, B, shade(flavorColor || '#e8c9a0', 0.25));
        bumpDraw = (c, s) => TX.speckle(c, s, { base: '#808080', dots: 3000, dotAlpha: 0.15, mottle: 0.1 });
        break;
      case 'textured':
        albedoDraw = (c, s) => TX.crumbTexture(c, s, B);
        bumpDraw = (c, s) => TX.crumbTexture(c, s, '#808080');
        break;
      case 'marble':
        albedoDraw = (c, s) => TX.marbleTexture(c, s, B);
        bumpDraw = (c, s) => TX.marbleTexture(c, s, '#808080');
        break;
      case 'gelato':
        albedoDraw = (c, s) => TX.stripedTexture(c, s, B);
        bumpDraw = null;
        break;
      case 'crystal':
        albedoDraw = (c, s) => TX.crystalTexture(c, s, B);
        bumpDraw = (c, s) => TX.crystalTexture(c, s, '#808080');
        break;
      case 'gold-drip':
        albedoDraw = (c, s) => TX.speckle(c, s, { base: B, dots: 1800, dotAlpha: 0.05, mottle: 0.04 });
        bumpDraw = (c, s) => TX.speckle(c, s, { base: '#808080', dots: 2600, dotAlpha: 0.18, mottle: 0.08 });
        break;
      case 'velvet-matte':
        albedoDraw = (c, s) => TX.velvetTexture(c, s, B);
        bumpDraw = (c, s) => TX.velvetTexture(c, s, '#808080');
        break;
      case 'marzipan':
        albedoDraw = (c, s) => TX.crumbTexture(c, s, B);
        bumpDraw = (c, s) => TX.crumbTexture(c, s, '#808080');
        break;
      case 'pearl':
        albedoDraw = (c, s) => TX.pearlTexture(c, s, B);
        bumpDraw = (c, s) => TX.pearlTexture(c, s, '#808080');
        break;
      default:
        albedoDraw = (c, s) => TX.speckle(c, s, { base: B, dots: 1600, dotAlpha: 0.035, mottle: 0.035 });
        bumpDraw = null;
    }

    const sizes = TEX[this.quality] || TEX.high;
    const key = `${frosting.style}|${B}|${flavorColor}|${this._texGen}`;
    let entry = this.textureCache.get(key);
    if (!entry) {
      // One painting drives both maps, so the relief lines up with the colour.
      // UVs already arrive in tile units (see FROST_TILE in shapes.js), so no
      // repeat multiplier here — it would shrink every tile into speckle-mush.
      const { map, normal } = TX.frostingTextures(
        albedoDraw, bumpDraw, sizes.albedo, sizes.detail, 2.6,
      );
      const maxAniso = this.caps.aniso || 1;
      // Full anisotropic filtering. The old cap of 8 (and 4 on the bump map)
      // was smearing the grazing-angle tiers — exactly where a cake is read.
      map.anisotropy = maxAniso;
      map.minFilter = THREE.LinearMipmapLinearFilter;
      normal.anisotropy = maxAniso;
      normal.minFilter = THREE.LinearMipmapLinearFilter;

      entry = { map, normal };
      this.textureCache.set(key, entry);
      this._cachedTextures.add(map);
      this._cachedTextures.add(normal);
    }
    return entry;
  }

  _frostingMaterial(frosting, baseColor, flavorColor) {
    const { map, normal } = this._frostingMaps(frosting, baseColor, flavorColor);

    const style = frosting.style;
    const params = {
      map,
      color: 0xffffff,
      roughness: frosting.roughness,
      metalness: 0.02,
      normalMap: normal,
      // Piped rosettes are described almost entirely by their normal map, so
      // the default buttercream needs more relief than the other finishes or
      // the swirls wash out under the studio light.
      normalScale: new THREE.Vector2(style === 'buttercream' ? 1.3 : 0.65, style === 'buttercream' ? 1.3 : 0.65),
      envMapIntensity: 0.7,
    };

    let mat;
    if (style === 'mirror') {
      mat = new THREE.MeshPhysicalMaterial({
        ...params, map: null, normalMap: null,
        roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03,
        metalness: 0.32, envMapIntensity: 1.6,
      });
    } else if (style === 'pearl') {
      mat = new THREE.MeshPhysicalMaterial({
        ...params, clearcoat: 1, clearcoatRoughness: 0.12,
        metalness: 0.35, iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [120, 460],
        sheen: 0.6, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 1.35,
        roughness: 0.22,
      });
    } else if (style === 'crystal') {
      mat = new THREE.MeshPhysicalMaterial({
        ...params, roughness: 0.16, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06,
        iridescence: 0.85, iridescenceIOR: 1.9, iridescenceThicknessRange: [200, 700],
        transmission: 0.12, thickness: 0.4, envMapIntensity: 1.7,
      });
    } else if (style === 'gold-drip') {
      mat = new THREE.MeshPhysicalMaterial({
        ...params, roughness: 0.2, metalness: 0.82, clearcoat: 0.8, clearcoatRoughness: 0.14,
        envMapIntensity: 1.5,
      });
    } else if (style === 'velvet-matte') {
      mat = new THREE.MeshPhysicalMaterial({
        ...params, roughness: 0.94, metalness: 0,
        sheen: 1, sheenRoughness: 0.85, sheenColor: new THREE.Color(shade(baseColor, 0.5)),
        envMapIntensity: 0.45,
      });
    } else if (style === 'fondant') {
      mat = new THREE.MeshPhysicalMaterial({
        ...params, roughness: 0.46, metalness: 0.02, clearcoat: 0.45, clearcoatRoughness: 0.4,
        sheen: 0.5, sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.85,
      });
    } else if (style === 'gelato') {
      mat = new THREE.MeshPhysicalMaterial({
        ...params, roughness: 0.5, sheen: 0.7, sheenRoughness: 0.5,
        sheenColor: new THREE.Color(0xffffff), envMapIntensity: 0.8,
      });
    } else if (style === 'marble') {
      mat = new THREE.MeshPhysicalMaterial({
        ...params, roughness: 0.3, metalness: 0.08, clearcoat: 0.85, clearcoatRoughness: 0.14,
        envMapIntensity: 1.15,
      });
    } else if (style === 'semi-naked') {
      mat = new THREE.MeshStandardMaterial({ ...params, roughness: 0.72, bumpScale: 0.03 });
    } else {
      mat = new THREE.MeshStandardMaterial({ ...params, bumpScale: style === 'textured' || style === 'marzipan' ? 0.028 : 0.014 });
    }
    return mat;
  }

  // ── cake assembly ─────────────────────────────────────────────────────────

  setDesign(design, { force = false } = {}) {
    const key = JSON.stringify(design);
    if (!force && key === this._lastDesignKey) return;
    this._lastDesignKey = key;
    this.design = design;
    this._build();
  }

  _clearCake() {
    const disposeTree = (root) => {
      root.traverse((o) => {
        if (o.isMesh || o.isLine || o.isPoints) {
          o.geometry?.dispose?.();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (!m) return;
            for (const k of ['map', 'bumpMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap']) {
              const tex = m[k];
              // Textures are cached and shared across rebuilds — disposing one
              // here would leave the cache handing out dead maps.
              if (tex && !this._cachedTextures.has(tex)) tex.dispose?.();
            }
            m.dispose?.();
          });
        }
      });
    };
    [...this.cakeRoot.children].forEach((c) => {
      disposeTree(c);
      this.cakeRoot.remove(c);
    });
    this.disposables.length = 0;
    this.cakeRoot.clear();
  }

  _build() {
    const design = this.design;
    if (!design) return;
    const {
      shape, size, tierDef, flavor, filling, frosting, board, toppers,
      color, boardColor, ribbonColor, messageColor, dripColor: resolvedDrip,
    } = resolve(design);

    this._clearCake();

    const rng = makeRng(hashString(JSON.stringify(design)));
    const count = tierDef.count;
    const baseRadius = shape.radius * size.scale;
    const baseHeight = shape.height * lerp(0.9, 1.1, clamp(size.scale - 0.7, 0, 1));

    // tier stack: bottom is widest
    const tiers = [];
    const shrink = count === 1 ? 1 : 0.68;
    let cursorY = 0;
    const standH = board.id === 'pedestal' ? 0.75 : board.id === 'riser' ? 0.42 : board.id === 'cake' ? 0.14 : 0;
    cursorY = standH;

    for (let i = 0; i < count; i++) {
      const k = count === 1 ? 1 : lerp(1, shrink, i / (count - 1 || 1));
      const radius = baseRadius * (count === 1 ? 1 : 0.6 + 0.4 * k);
      const height = baseHeight * (count === 1 ? 1 : 0.82);
      const carve = ['petal', 'heart'].includes(shape.id) ? 0 : shape.id === 'drum' ? 0.03 : 0.055;
      tiers.push({ radius, height, y: cursorY, index: i });
      cursorY += height;
    }

    const topTier = tiers[tiers.length - 1];
    const topY = topTier.y + topTier.height;
    const topRadius = topTier.radius;

    // ── stand ──
    if (standH > 0) {
      this.cakeRoot.add(this._buildStand(board, { color: boardColor }, baseRadius, standH, tiers[0]));
    }

    // ── tiers ──
    const frostingMat = this._frostingMaterial(frosting, color, flavor.color);
    this.disposables.push(frostingMat);

    for (const t of tiers) {
      const geo = buildTier({
        shapeId: shape.id,
        radius: t.radius,
        height: t.height,
        depth: shape.depth ? shape.depth * size.scale * (t.radius / baseRadius) : null,
        carve: ['petal', 'heart'].includes(shape.id) ? 0 : 0.05,
        bevel: 0.08,
      });
      const mesh = new THREE.Mesh(geo, frostingMat);
      mesh.position.y = t.y;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.cakeRoot.add(mesh);

      // ── filling seam between tiers ──
      if (filling.color && t.index < tiers.length - 1) {
        const seamGeo = new THREE.CylinderGeometry(t.radius * 1.005, t.radius * 1.005, 0.075, 96, 1, true);
        const seamMat = new THREE.MeshStandardMaterial({
          color: filling.color, roughness: 0.38, metalness: 0.03,
          side: THREE.DoubleSide, emissive: hexToInt(filling.color) ? new THREE.Color(filling.color).multiplyScalar(0.05) : 0x000000,
        });
        const seam = new THREE.Mesh(seamGeo, seamMat);
        seam.position.y = t.y + t.height;
        this.cakeRoot.add(seam);
      }

      // ── piped border on each ledge ──
      const border = pipedBorder({
        radius: t.radius * 0.965,
        y: t.y + t.height + 0.035,
        count: Math.max(20, Math.round(t.radius * 17)),
        size: 0.1,
        color: shade(color, 0.12),
        rough: frosting.roughness,
      });
      this.cakeRoot.add(border);
    }

    // ── unified drip over the whole stack ──
    if (frosting.style === 'gold-drip' || design.toppers.includes('choco-drip')) {
      const drip = design.toppers.includes('choco-drip')
        ? '#3a2415'
        : (resolvedDrip || '#e8c56a');
      tiers.forEach((t) => {
        const drips = makeDrips({
          radius: t.radius * 0.995,
          y: t.y + t.height,
          shapeId: shape.id,
          count: Math.max(26, Math.round(t.radius * 22)),
          color: drip,
          rough: frosting.style === 'gold-drip' ? 0.18 : 0.3,
          metal: frosting.style === 'gold-drip' ? 0.9 : 0.1,
        });
        this.cakeRoot.add(drips);
      });
    }

    // ── ribbon (always wrapped on the bottom tier when chosen) ──
    if (design.toppers.includes('ribbon')) {
      const t = tiers[0];
      const ribbon = makeRibbon({
        radius: t.radius * 0.99,
        y: t.y + t.height * 0.42,
        height: 0.19,
        color: ribbonColor,
        shapeId: shape.id,
        bow: count === 1,
      });
      this.cakeRoot.add(ribbon);
    }

    // ── lace collar sits at the base of the top tier ──
    // (handled by topper builder using topRadius)

    // ── toppers ──
    const ctx = { topY, topRadius, shapeId: shape.id, dripColor: design.dripColor };
    for (const id of design.toppers) {
      if (id === 'candles') continue;
      const g = buildTopper(id, ctx);
      if (g) {
        // lace & cage hug the top tier; everything else sits on the lid
        if (id === 'lace') g.position.y = topTier.y + 0.1;
        this.cakeRoot.add(g);
      }
    }

    // ── candles ──
    if (design.candles > 0) {
      const positions = [];
      const n = design.candles;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + 0.4;
        const rr = topRadius * (n === 1 ? 0 : 0.5);
        positions.push({ x: Math.cos(a) * rr, y: topY, z: Math.sin(a) * rr });
      }
      const candles = makeCandles({ positions });
      this.cakeRoot.add(candles);
      this.candleGroup = candles;
    } else {
      this.candleGroup = null;
    }

    // ── inscription plaque ──
    if (design.message?.trim()) {
      const plaque = this._makeInscription(design.message.trim(), messageColor, topRadius);
      plaque.position.set(0, topY + 0.62, topRadius * 0.58);
      plaque.rotation.y = -0.35;
      this.cakeRoot.add(plaque);
    }

    // frame the camera on the finished cake
    const totalH = topY + (design.candles ? 0.9 : 0.5);
    const fit = Math.max(topRadius * 2.9, totalH * 1.5);
    this._fit = { h: totalH, w: fit };
    this._applyHomeFor(totalH, fit, rng);
  }

  _applyHomeFor(height, width, rng) {
    const d = Math.max(width * 1.55, height * 1.7, 6.4);
    const target = new THREE.Vector3(0, height * 0.46, 0);
    this.controls.minDistance = d * 0.45;
    this.controls.maxDistance = d * 2.4;
    const preset = { pos: [d * 0.06, height * 0.62 + d * 0.34, d], target: target.toArray() };
    this.stagePresets.stage = preset;
    if (!this._userMovedCamera) {
      this._flyTo(new THREE.Vector3(...preset.pos), target);
      this._userMovedCamera = true;
    }
  }

  _buildStand(board, { color: boardColor = '#c9a24b' } = {}, baseRadius, standH) {
    const g = new THREE.Group();
    const isGold = ['#c9a24b', '#e8cf9b', '#b06a3c', '#c8c8cc'].includes(boardColor);

    if (board.id === 'cake') {
      const geo = new THREE.CylinderGeometry(baseRadius * 1.16, baseRadius * 1.16, standH * 0.55, 96);
      const mat = new THREE.MeshPhysicalMaterial({
        color: boardColor, roughness: isGold ? 0.22 : 0.5,
        metalness: isGold ? 0.85 : 0.1, clearcoat: 0.6, clearcoatRoughness: 0.25,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.y = standH * 0.28;
      m.receiveShadow = true;
      m.castShadow = true;
      g.add(m);
      // gold foil rim
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry(baseRadius * 1.16, 0.035, 8, 96),
        new THREE.MeshPhysicalMaterial({ color: '#d9a441', roughness: 0.16, metalness: 1, clearcoat: 1 }),
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = standH * 0.55;
      g.add(rim);
    } else if (board.id === 'pedestal') {
      const mat = new THREE.MeshPhysicalMaterial({
        color: boardColor, roughness: isGold ? 0.2 : 0.42,
        metalness: isGold ? 0.9 : 0.15, clearcoat: 0.7, clearcoatRoughness: 0.2,
      });
      // lathe profile: foot → stem → plate
      const pts = [
        new THREE.Vector2(0.02, 0),
        new THREE.Vector2(baseRadius * 0.62, 0),
        new THREE.Vector2(baseRadius * 0.66, 0.07),
        new THREE.Vector2(baseRadius * 0.42, 0.14),
        new THREE.Vector2(baseRadius * 0.2, 0.34),
        new THREE.Vector2(baseRadius * 0.14, 0.52),
        new THREE.Vector2(baseRadius * 0.34, 0.64),
        new THREE.Vector2(baseRadius * 0.9, 0.7),
        new THREE.Vector2(baseRadius * 1.14, standH * 0.94),
        new THREE.Vector2(baseRadius * 1.14, standH),
        new THREE.Vector2(0.02, standH),
      ];
      const geo = new THREE.LatheGeometry(pts, 96);
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    } else if (board.id === 'riser') {
      const mat = new THREE.MeshPhysicalMaterial({
        color: boardColor, roughness: 0.18, metalness: 0.95, clearcoat: 1, clearcoatRoughness: 0.1,
      });
      const geo = new THREE.CylinderGeometry(baseRadius * 1.18, baseRadius * 1.1, standH * 0.9, 96);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = standH * 0.45;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(baseRadius * 1.2, baseRadius * 1.2, standH * 0.14, 96),
        mat,
      );
      top.position.y = standH * 0.93;
      g.add(top);
    }
    return g;
  }

  _makeInscription(text, color, radius) {
    const g = new THREE.Group();
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, 1024, 256);
    ctx.font = '600 108px "Fraunces", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 18;
    ctx.fillText(text.slice(0, 28), 512, 132);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshPhysicalMaterial({
      map: tex, transparent: true, roughness: 0.2, metalness: 0.8,
      clearcoat: 1, side: THREE.DoubleSide, alphaTest: 0.05,
    });
    const geo = new THREE.PlaneGeometry(Math.min(2.6, radius * 1.5), Math.min(0.65, radius * 0.38), 2, 2);
    const m = new THREE.Mesh(geo, mat);
    g.add(m);
    return g;
  }

  // ── verbs ────────────────────────────────────────────────────────────────

  /** Screenshot the current framebuffer as a data URL. */
  snapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  resetView() {
    this.controls.target.copy(this._homeTarget);
    const p = this.stagePresets.stage || this.stagePresets.hero;
    this._flyTo(new THREE.Vector3(...p.pos), new THREE.Vector3(...p.target));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    this._clearCake();
    for (const t of this._cachedTextures) t.dispose?.();
    this._cachedTextures.clear();
    this.textureCache.clear();
    this.controls.dispose();
    this.envRT?.dispose();
    this.composer?.dispose?.();
    this.renderer.dispose();
  }

  // ── loop ─────────────────────────────────────────────────────────────────

  _resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    // EffectComposer.setSize already multiplies by its internal pixel ratio
    // AND resizes every pass. The old code then called bloom.setSize(w, h) and
    // smaa.setSize(w, h) with CSS pixels afterwards, stomping that with
    // half-size buffers on a 2x display — that was the blur.
    this.composer.setSize(w, h);
    const dpr = this.renderer.getPixelRatio();
    this._unsharp?.uniforms.resolution.value.set(w * dpr, h * dpr);
  }

  _animate() {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    // Adaptive quality: if the machine can't hold a usable frame rate, shed
    // the expensive passes before it becomes a slideshow. Only ever steps
    // down, and only once the frame time has been bad for a sustained stretch
    // — a single hitch won't do it. Measured as accumulated overrun debt
    // rather than a frame count, so it triggers just as fast on a machine
    // doing 2 fps as on one doing 40.
    if (this.quality === 'high' && !this._degraded) {
      const budget = 1 / 30;
      this._slowDebt = Math.max(0, this._slowDebt + (dt > budget ? dt - budget : -budget * 2));
      if (this._slowDebt > 1.5) {
        this._degraded = true;
        this.bloom.enabled = false;
        this._unsharp.enabled = false;
        this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
        this.composer.setPixelRatio(this.renderer.getPixelRatio());
        this._resize();
        console.info('[studio] frame rate low — shed bloom + sharpen and dropped to 1.5x');
      }
    }

    if (this._flight) {
      const f = this._flight;
      f.t = Math.min(1, f.t + dt * 1.7);
      const e = 1 - (1 - f.t) ** 3;
      this.camera.position.lerpVectors(f.fromPos, f.toPos, e);
      this.controls.target.lerpVectors(f.fromTarget, f.toTarget, e);
      if (f.t >= 1) {
        this._homeTarget.copy(f.toTarget);
        this._flight = null;
      }
    }

    if (this.turntable && !this._flight) this.cakeRoot.rotation.y += this.spin * dt;

    // candle flicker
    if (this.candleGroup) {
      this.candleGroup.traverse((o) => {
        if (o.userData.flicker !== undefined) {
          const n = Math.sin(t * 9 + o.userData.flicker) * 0.5 + Math.sin(t * 21.3 + o.userData.flicker * 2) * 0.5;
          if (o.isLight) o.intensity = 0.5 + n * 0.14;
          else o.scale.set(0.7 + n * 0.06, 1.7 + n * 0.16, 0.7 + n * 0.06);
        }
      });
    }

    this.controls.update();
    this.composer.render();
  }
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
