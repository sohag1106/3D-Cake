import { useId } from 'react';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Miniature 3D previews inside the swatch grid.
// A shared WebGL context draws many small canvases, one at a time, on demand —
// so the rail can show real geometry without paying for 14 renderers.
// ─────────────────────────────────────────────────────────────────────────────

const W = 96, H = 84;

let renderer, scene, camera;
let queue = Promise.resolve();
const registry = new Map(); // canvas -> draw fn

function ensure() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
  camera.position.set(1.9, 1.75, 2.75);
  camera.lookAt(0, 0.28, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xfff0da, 2.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9a24b, 1.5);
  rim.position.set(-4, 2, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x8fb0ff, 0.6);
  fill.position.set(-3, 1, 3);
  scene.add(fill);
}

/** Render one cached preview into a target canvas. */
function paint(entry) {
  ensure();
  const { canvas, build } = entry;
  const root = build();
  scene.add(root);
  renderer.setSize(W, H, false);
  renderer.render(scene, camera);
  const dst = canvas.getContext('2d');
  dst.clearRect(0, 0, canvas.width, canvas.height);
  dst.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
  scene.remove(root);
  disposeTree(root);
}

function disposeTree(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        ['map', 'normalMap', 'bumpMap'].forEach((k) => m[k]?.dispose?.());
        m.dispose?.();
      });
    }
  });
}

/** Re-render everything currently mounted (called after a paint flush). */
function flush() {
  queue = queue.then(async () => {
    for (const entry of registry.values()) paint(entry);
  }).catch(() => {});
  return queue;
}

export function requestPreview() {
  return flush();
}

// ── shape silhouettes ─────────────────────────────────────────────────────

const SHAPE_MESH = {
  round: () => new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 0.62, 40),
    new THREE.MeshStandardMaterial({ color: '#f3e3cc', roughness: 0.55 }),
  ),
  square: () => {
    const pts = [];
    const s = 0.66, c = 0.14, n = 6;
    const corners = [[-s, -s], [s, -s], [s, s], [-s, s]];
    for (let i = 0; i < 4; i++) {
      const [x0, y0] = corners[i];
      const [x1, y1] = corners[(i + 1) % 4];
      for (let t = 0; t < n; t++) {
        const k = t / n;
        pts.push(new THREE.Vector2(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k));
      }
    }
    const shape = new THREE.Shape(pts);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.62, bevelEnabled: true, bevelSize: c * 0.5, bevelThickness: 0.04, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f3e3cc', roughness: 0.55 }));
  },
  hexagon: () => {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const a1 = ((i + 1) / 6) * Math.PI * 2 + Math.PI / 6;
      for (let t = 0; t < 7; t++) {
        const k = t / 7;
        pts.push(new THREE.Vector2(
          Math.cos(a) * 0.7 + (Math.cos(a1) * 0.7 - Math.cos(a) * 0.7) * k,
          Math.sin(a) * 0.7 + (Math.sin(a1) * 0.7 - Math.sin(a) * 0.7) * k,
        ));
      }
    }
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.62, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f3e3cc', roughness: 0.55 }));
  },
  heart: () => {
    const pts = [];
    for (let i = 0; i < 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3;
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push(new THREE.Vector2((x / 17) * 0.72, (y / 17) * 0.72));
    }
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.6, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.035, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f3e3cc', roughness: 0.55 }));
  },
  drum: () => {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: '#f3e3cc', roughness: 0.55 });
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.8, 40), m));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.035, 8, 40), new THREE.MeshStandardMaterial({ color: '#c9a24b', metalness: 0.9, roughness: 0.2 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.4;
    g.add(rim);
    return g;
  },
  petal: () => {
    const pts = [];
    for (let i = 0; i < 140; i++) {
      const t = (i / 140) * Math.PI * 2;
      const r = 0.72 * (0.86 + 0.14 * Math.abs(Math.cos(3 * t)));
      pts.push(new THREE.Vector2(Math.cos(t) * r, Math.sin(t) * r));
    }
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.6, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.035, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f3e3cc', roughness: 0.55 }));
  },
  sculpt: () => {
    const geo = new THREE.CylinderGeometry(0.7, 0.7, 0.62, 40);
    geo.scale(1, 1, 0.7);
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f3e3cc', roughness: 0.55 }));
  },
};

// ── tier silhouettes ──────────────────────────────────────────────────────

export function shapeBuildFn(shapeId) {
  return SHAPE_MESH[shapeId] || SHAPE_MESH.round;
}

export function tierBuildFn(count) {
  return () => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: '#f3e3cc', roughness: 0.55 });
    const specs = count === 1
      ? [{ r: 0.72, h: 0.8, y: 0.4 }]
      : count === 2
        ? [{ r: 0.78, h: 0.5, y: 0.25 }, { r: 0.52, h: 0.48, y: 0.74 }]
        : [{ r: 0.82, h: 0.42, y: 0.21 }, { r: 0.6, h: 0.4, y: 0.62 }, { r: 0.4, h: 0.38, y: 1.01 }];
    specs.forEach((s) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(s.r, s.r, s.h, 36), mat);
      m.position.y = s.y - 0.42;
      g.add(m);
      const border = new THREE.Mesh(
        new THREE.TorusGeometry(s.r * 0.94, 0.035, 6, 36),
        new THREE.MeshStandardMaterial({ color: '#e8d6b8', roughness: 0.6 }),
      );
      border.rotation.x = Math.PI / 2;
      border.position.y = s.y - 0.42 + s.h / 2;
      g.add(border);
    });
    return g;
  };
}

/** Small 3D preview canvas that paints itself from the shared renderer. */
export function MiniPreview({ build, className, style }) {
  const id = useId();
  return (
    <canvas
      className={className}
      style={style}
      width={W}
      height={H}
      data-preview={id}
      ref={(el) => {
        if (!el) {
          registry.delete(id);
          return;
        }
        if (el.dataset.built) return;
        el.dataset.built = '1';
        registry.set(id, { canvas: el, build });
        flush();
      }}
    />
  );
}
