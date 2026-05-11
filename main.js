// main.js â€” Three.js scene for the my digital crib hero.
// A stylized line-art Macintosh-style computer with a working canvas-textured
// screen, a keyboard that responds to physical key presses, and a mouse that
// follows the user's cursor. Composition matches the brand reference: viewer
// looks at the computer from the front-LEFT, so the textured side panel and
// vents sit on the left of the image and the floppy slot sits on the right
// of the front face.

import * as THREE from 'three';
import { OrbitControls }       from 'three/addons/controls/OrbitControls.js';
import { LineSegments2 }       from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial }        from 'three/addons/lines/LineMaterial.js';
import { createScreenCanvas, drawScreen, setScreenLabel } from './screen.js';

if (window.StageBoot) window.StageBoot.mark('main module loaded');

const WHITE = 0xfafaf6;
const INK   = 0x0a0a0a;

// â”€â”€ canvas / renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const canvas = document.querySelector('#scene');
if (!canvas) {
  throw new Error('Missing #scene canvas element.');
}

function assertWebGLAvailable() {
  const probe = document.createElement('canvas');
  const gl = probe.getContext('webgl2') ||
    probe.getContext('webgl') ||
    probe.getContext('experimental-webgl');

  if (!gl) {
    throw new Error('WebGL is not available in this browser/device. Enable hardware acceleration or try another browser.');
  }

  const loseContext = gl.getExtension('WEBGL_lose_context');
  if (loseContext) loseContext.loseContext();
}

if (window.StageBoot) window.StageBoot.mark('checking WebGL');
assertWebGLAvailable();

if (window.StageBoot) window.StageBoot.mark('starting renderer');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
if (window.StageBoot) window.StageBoot.mark('renderer ready');

const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
camera.position.set(-4.8, 3.8, 6.0);
const target = new THREE.Vector3(0, 1.25, 0.4);
camera.lookAt(target);

// Rotation is allowed but tightly clamped (~7Â° in each direction from the
// reference angle) so the composition always reads correctly and nothing
// ever slides off the canvas. Pan and zoom stay disabled.
const controls = new OrbitControls(camera, canvas);
controls.target.copy(target);
controls.enableDamping = true;
controls.dampingFactor = 0.10;
controls.enablePan     = false;
controls.enableZoom    = false;
controls.rotateSpeed   = 0.45;
const REF_AZ  = Math.atan2(camera.position.x - target.x, camera.position.z - target.z); // initial azimuth
const REF_POL = Math.acos((camera.position.y - target.y) /
                          camera.position.clone().sub(target).length());                 // initial polar
controls.minAzimuthAngle = REF_AZ - THREE.MathUtils.degToRad(7);
controls.maxAzimuthAngle = REF_AZ + THREE.MathUtils.degToRad(7);
controls.minPolarAngle   = REF_POL - THREE.MathUtils.degToRad(5);
controls.maxPolarAngle   = REF_POL + THREE.MathUtils.degToRad(5);

// â”€â”€ shared materials â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const matWhite = new THREE.MeshBasicMaterial({ color: WHITE });
const matInk   = new THREE.MeshBasicMaterial({ color: INK });

function makeNoiseTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // base mid-gray
  ctx.fillStyle = '#cdc6b6';
  ctx.fillRect(0, 0, size, size);
  // dark stipple
  ctx.fillStyle = 'rgba(30,28,24,0.85)';
  const darkCount = Math.floor(size * size * 0.10);
  for (let i = 0; i < darkCount; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 0.5 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // light stipple for grain feel
  ctx.fillStyle = 'rgba(255,250,240,0.45)';
  const lightCount = Math.floor(size * size * 0.05);
  for (let i = 0; i < lightCount; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 0.4 + Math.random() * 1.0;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  return tex;
}
const matSidePanel = new THREE.MeshBasicMaterial({ map: makeNoiseTexture() });

const lineMat = new LineMaterial({
  color: INK, linewidth: 3.2, worldUnits: false,
  resolution: new THREE.Vector2(1, 1),
  alphaToCoverage: true,
});
const lineMatFine = new LineMaterial({
  color: INK, linewidth: 2.0, worldUnits: false,
  resolution: new THREE.Vector2(1, 1),
  alphaToCoverage: true,
});

function outline(mesh, mat = lineMat, threshold = 1) {
  const e = new THREE.EdgesGeometry(mesh.geometry, threshold);
  const positions = Array.from(e.attributes.position.array);
  const g = new LineSegmentsGeometry();
  g.setPositions(positions);
  const ls = new LineSegments2(g, mat);
  ls.computeLineDistances();
  ls.renderOrder = 2;
  mesh.add(ls);
  return ls;
}

// â”€â”€ master rig group â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Everything visible (computer, keyboard, mouse, cable, shadow) goes inside
// this group so resize() can scale + offset the whole composition to keep
// it fully in frame on any viewport.
const rig = new THREE.Group();
scene.add(rig);

// â”€â”€ COMPUTER BODY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Box order in Three.js: [+x, -x, +y, -y, +z, -z]
// Camera sits at -X looking at the body, so the LEFT side panel (the textured
// one in the reference) is the body's -X face.
const computer = new THREE.Group();
rig.add(computer);

const BW = 2.7, BH = 2.7, BD = 2.3;

const bodyMaterials = [
  matWhite, matSidePanel, // +x (right, hidden), -x (left, textured)
  matWhite, matWhite,     // +y (top), -y (bottom)
  matWhite, matWhite,     // +z (front), -z (back)
];
const body = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, BD), bodyMaterials);
body.position.y = BH / 2;
computer.add(body);
outline(body);

// â”€â”€ front face details â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const frontZ = BD / 2 + 0.001;

// Screen â€” big rounded-corner black rect + "my digital crib" white text
// (drawn into the canvas texture). The plane is sized to cover most of the
// front face. Transparency in the canvas reveals the white body at the
// corners, giving the screen its rounded silhouette.
const SW = 2.10, SH = 1.78;
const screenCanvas  = createScreenCanvas();
const screenTexture = new THREE.CanvasTexture(screenCanvas);
screenTexture.colorSpace = THREE.SRGBColorSpace;
screenTexture.minFilter  = THREE.LinearFilter;
screenTexture.magFilter  = THREE.LinearFilter;
screenTexture.anisotropy = 8;
const screenMat = new THREE.MeshBasicMaterial({
  map: screenTexture, transparent: true, alphaTest: 0.02,
});
const screenPlane = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), screenMat);
screenPlane.position.set(0, BH / 2 + 0.30, frontZ + 0.001);
computer.add(screenPlane);

// floppy disk slot â€” small rounded rectangle with a notch
{
  const slotGroup = new THREE.Group();
  slotGroup.position.set(0.60, 0.42, frontZ + 0.002);
  computer.add(slotGroup);

  const slotBody = new THREE.Mesh(
    new THREE.PlaneGeometry(0.62, 0.10),
    matInk
  );
  slotGroup.add(slotBody);
  // tiny notch in the middle (white)
  const notch = new THREE.Mesh(
    new THREE.PlaneGeometry(0.07, 0.05),
    matWhite
  );
  notch.position.set(0.06, 0, 0.001);
  slotGroup.add(notch);
}

// â”€â”€ side vents on the LEFT face (-X), lower-front portion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Positioned lower-front so they sit just above the keyboard and the
// camera can see them clearly past the body's leading edge.
{
  const xLeft = -BW / 2 - 0.003;
  const positions = [];
  for (let i = 0; i < 5; i++) {
    const y = 0.45 + i * 0.13;
    const z0 = BD / 2 - 0.22;     // close to the front
    const z1 = BD / 2 - 0.74;     // toward middle of side panel
    positions.push(xLeft, y, z0,  xLeft, y, z1);
  }
  const g = new LineSegmentsGeometry();
  g.setPositions(positions);
  const lines = new LineSegments2(g, lineMat);
  computer.add(lines);
}

// â”€â”€ KEYBOARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const keyboard = new THREE.Group();
// Sit right against the body's front face, slightly forward and lower.
keyboard.position.set(0.0, 0.05, BD / 2 + 0.78);
keyboard.rotation.x = -0.10;
rig.add(keyboard);

const KB_W = 3.6, KB_H = 0.20, KB_D = 1.55;
const kbBase = new THREE.Mesh(new THREE.BoxGeometry(KB_W, KB_H, KB_D), matWhite);
kbBase.position.y = KB_H / 2;
keyboard.add(kbBase);
outline(kbBase);

// keys layout â€” [label, code, widthUnits]
const KEY_ROWS = [
  [['esc','Escape',1.4], ['F1','F1',0.9], ['F2','F2',0.9], ['F3','F3',0.9], ['F4','F4',0.9]],
  [['~','Backquote',0.9], ['1','Digit1',0.9], ['2','Digit2',0.9], ['3','Digit3',0.9], ['4','Digit4',0.9], ['5','Digit5',0.9], ['6','Digit6',0.9]],
  [['tab','Tab',1.25], ['Q','KeyQ',0.9], ['W','KeyW',0.9], ['E','KeyE',0.9], ['R','KeyR',0.9], ['T','KeyT',0.9], ['Y','KeyY',0.9]],
  [['caps','CapsLock',1.45], ['A','KeyA',0.9], ['S','KeyS',0.9], ['D','KeyD',0.9], ['F','KeyF',0.9], ['G','KeyG',0.9], ['H','KeyH',0.9]],
  [['shift','Shift',1.6], ['Z','KeyZ',0.9], ['X','KeyX',0.9], ['C','KeyC',0.9], ['V','KeyV',0.9], ['B','KeyB',0.9], ['N','KeyN',0.9]],
  [['ctrl','Control',1.05], ['alt','Alt',0.95], ['cmd','Meta',0.95], ['', 'Space', 2.6]],
];

const keys = []; // { mesh, code, restY, pressedAt }

const KEY_UNIT  = 0.34;
const KEY_H     = 0.14;
const KEY_DEPTH = 0.32;
const KEY_GAP   = 0.05;
const ROW_GAP   = 0.05;

const rowsCount   = KEY_ROWS.length;
const totalDepth  = rowsCount * KEY_DEPTH + (rowsCount - 1) * ROW_GAP;
const startZ      = totalDepth / 2 - KEY_DEPTH / 2;

KEY_ROWS.forEach((row, rowIdx) => {
  const widths = row.map(([,,u]) => u * KEY_UNIT);
  const rowW = widths.reduce((s,w) => s + w, 0) + KEY_GAP * (row.length - 1);
  let cx = -rowW / 2;
  row.forEach(([label, code, u], i) => {
    const w = widths[i];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, KEY_H, KEY_DEPTH), matWhite);
    const z = startZ - rowIdx * (KEY_DEPTH + ROW_GAP);
    m.position.set(cx + w / 2, KB_H + KEY_H / 2 + 0.005, z);
    keyboard.add(m);
    outline(m, lineMatFine);

    if (label) {
      const tex = makeKeyLabel(label, label.length > 1);
      const labelMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.78, KEY_DEPTH * 0.62),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02 })
      );
      labelMesh.rotation.x = -Math.PI / 2;
      labelMesh.position.set(0, KEY_H / 2 + 0.003, 0);
      m.add(labelMesh);
    }

    keys.push({ mesh: m, code, restY: m.position.y, pressedAt: -10 });
    cx += w + KEY_GAP;
  });
});

function makeKeyLabel(text, isWord) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#0a0a0a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (isWord) {
    ctx.font = '500 52px "JetBrains Mono", ui-monospace, monospace';
    ctx.fillText(text, c.width/2, c.height/2 + 4);
  } else {
    ctx.font = '700 110px "Inter", system-ui, sans-serif';
    ctx.fillText(text, c.width/2, c.height/2 + 8);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// â”€â”€ MOUSE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// To the right of the keyboard, slightly forward.
const mouseGroup = new THREE.Group();
const MOUSE_REST = new THREE.Vector3(KB_W / 2 + 0.55, 0.05, keyboard.position.z + 0.20);
mouseGroup.position.copy(MOUSE_REST);
rig.add(mouseGroup);

const mouseBody = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.30, 0.95), matWhite);
mouseBody.position.y = 0.15;
mouseGroup.add(mouseBody);
outline(mouseBody);

// click groove on top â€” a thin ink strip running across the front
const groove = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.02), matInk);
groove.rotation.x = -Math.PI / 2;
groove.position.set(0, 0.301, -0.10);
mouseGroup.add(groove);

// â”€â”€ CABLE: mouse â†’ upper-back-right of body (rebuilt each frame) â”€â”€â”€â”€â”€
const cableEnd = new THREE.Vector3(BW / 2 - 0.18, BH * 0.78, -BD / 2 + 0.04);
let cableMesh = new THREE.Mesh(new THREE.BufferGeometry(), matInk);
rig.add(cableMesh);

const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 16), matInk);
plug.rotation.x = Math.PI / 2;
plug.position.copy(cableEnd);
rig.add(plug);

function updateMouseCable() {
  const mp = mouseGroup.position;
  // exit point on the back-LEFT of the mouse (toward the computer)
  const start = new THREE.Vector3(mp.x - 0.30, 0.10, mp.z - 0.50);
  const points = [
    start,
    new THREE.Vector3(start.x + 0.10, 0.05, start.z - 0.50),
    new THREE.Vector3(start.x - 0.10, 0.20, start.z - 1.10),
    new THREE.Vector3(cableEnd.x - 0.05, cableEnd.y - 0.30, cableEnd.z + 0.30),
    cableEnd,
  ];
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.35);
  cableMesh.geometry.dispose();
  cableMesh.geometry = new THREE.TubeGeometry(curve, 56, 0.024, 6, false);
}
updateMouseCable();

// â”€â”€ ground shadow disc (subtle) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Sized + faded so it never reaches the canvas viewport edge â€” otherwise
// the rounded-rect stage clip slices the gradient and shows a hard line.
{
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  // tighter gradient: fully transparent well before the canvas edge
  const grd = ctx.createRadialGradient(128, 128, 12, 128, 128, 100);
  grd.addColorStop(0.00, 'rgba(0,0,0,0.22)');
  grd.addColorStop(0.55, 'rgba(0,0,0,0.07)');
  grd.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  // smaller plane so the visible falloff sits well inside the viewport
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.0), mat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.2, 0.001, 0.6);
  rig.add(shadow);
}

// â”€â”€ default rig offset (resize() may tweak position.x per viewport) â”€â”€
// The composition is asymmetric (mouse + keyboard reach far +X, body has no
// counterweight on -X). Without this offset everything drifts right and gets
// clipped on portrait viewports. Scale + position.x are then applied per-
// viewport in resize() â€” the design itself stays unchanged.
rig.position.set(-0.55, 0, -0.70);
// Target sits a bit below the body's vertical center so the camera tilts
// down slightly and the keyboard stays comfortably inside the bottom of
// the frame instead of clipping the canvas edge.
target.set(0, 1.00, 0);
camera.lookAt(target);
controls.target.copy(target);

// â”€â”€ interactions: keyboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function normalizeCode(c) { return c.replace(/(Left|Right)$/, ''); }
window.addEventListener('keydown', (e) => {
  const wanted = normalizeCode(e.code);
  for (const k of keys) {
    if (normalizeCode(k.code) === wanted) {
      k.pressedAt = clock.getElapsedTime();
    }
  }
}, { passive: true });

// â”€â”€ interactions: 3D mouse follows the user's pointer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
function onPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.tx = ((e.clientX - r.left) / r.width  - 0.5) * 2;
  pointer.ty = ((e.clientY - r.top)  / r.height - 0.5) * 2;
}
window.addEventListener('pointermove', onPointer, { passive: true });

// â”€â”€ resize â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Two responsive levers, applied together so the whole rig always fits:
//   1. camera FOV â€” widens slightly on tall/portrait stages
//   2. rig.scale  â€” shrinks the entire composition for narrower viewports
// The scale is the load-bearing fix; FOV widening is a small assist.
function resize() {
  const w = canvas.clientWidth  || 1;
  const h = canvas.clientHeight || 1;
  renderer.setSize(w, h, false);

  const ratio = h / Math.max(1, w);

  // FOV: slightly wider on portrait so we don't have to shrink as aggressively
  camera.fov = ratio > 1.0 ? 36 + Math.min(8, (ratio - 1.0) * 10) : 34;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  // Rig scale + horizontal offset, plus a viewport-aware lookAt target so
  // the rig fills the canvas without empty cream gutters above or to the
  // sides. On mobile (narrow viewport, any aspect) we drop the target down
  // and shift the rig +X less so the body reaches further left and the
  // top of the body lands near the top of the canvas.
  // Single-column layouts (mobile + tablet) get their own framing:
  // the camera lookAt sits higher and the rig is centred under the text
  // column. The 2-column desktop layout keeps its original framing where
  // the rig is offset left so the body sits beside the title block.
  const ww = window.innerWidth;
  const narrow = ww <= 520;
  const tablet = ww > 520 && ww <= 900;
  controls.target.set(0, (narrow || tablet) ? 1.15 : 1.0, 0);

  let s, offsetX;
  if      (narrow)        { s = 0.92; offsetX = -0.25; } // mobile
  else if (tablet)        { s = 0.92; offsetX = -0.25; } // tablet (single-column)
  else if (ratio > 1.15)  { s = 0.94; offsetX = +0.30; } // narrow desktop window in portrait
  else if (ratio > 0.95)  { s = 0.84; offsetX = -0.55; } // near-square (typical desktop)
  else if (ratio > 0.70)  { s = 0.94; offsetX = -0.55; } // mild landscape
  else                    { s = 1.00; offsetX = -0.55; } // wide landscape
  rig.scale.setScalar(s);
  rig.position.x = offsetX;

  const dpr = Math.min(window.devicePixelRatio, 2);
  lineMat.resolution.set(w * dpr, h * dpr);
  lineMatFine.resolution.set(w * dpr, h * dpr);
}
new ResizeObserver(resize).observe(canvas);
resize();

// â”€â”€ animation loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const clock = new THREE.Clock();
const screenCtx = screenCanvas.getContext('2d');

function tick() {
  const t = clock.getElapsedTime();

  drawScreen(screenCtx, t);
  screenTexture.needsUpdate = true;

  for (const k of keys) {
    const since = t - k.pressedAt;
    let depress = 0;
    if (since >= 0 && since < 0.20) {
      const u = since / 0.20;
      depress = Math.sin(u * Math.PI) * 0.06;
    }
    k.mesh.position.y = k.restY - depress;
  }

  pointer.x += (pointer.tx - pointer.x) * 0.10;
  pointer.y += (pointer.ty - pointer.y) * 0.10;
  mouseGroup.position.set(
    MOUSE_REST.x + pointer.x * 0.40,
    MOUSE_REST.y,
    MOUSE_REST.z + pointer.y * 0.30
  );
  updateMouseCable();

  controls.update();
  renderer.render(scene, camera);
  if (window.StageBoot) window.StageBoot.ready();
  requestAnimationFrame(tick);
}

// â”€â”€ routing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Hash-based routing. The DOM stays mounted; clicking a nav link swaps
// the active <article data-view> and updates the CRT screen label. The
// 3D rig and the topbar stay anchored, so nothing reflows.
const ROUTES = ['home', 'work', 'studio', 'contact'];
const views   = document.querySelectorAll('[data-view]');
const navLinks = document.querySelectorAll('[data-route]');

function readRoute() {
  const h = location.hash.replace(/^#/, '');
  return ROUTES.includes(h) ? h : 'home';
}

function applyRoute(name) {
  if (!ROUTES.includes(name)) name = 'home';

  views.forEach(v => {
    const active = v.dataset.view === name;
    v.toggleAttribute('data-active', active);
    v.setAttribute('aria-hidden', active ? 'false' : 'true');
  });

  navLinks.forEach(a => {
    a.toggleAttribute('data-active', a.dataset.route === name);
  });

  // sync the CRT screen text
  setScreenLabel(name, clock.getElapsedTime());

  // update document title for nice tab labels
  const titles = {
    home:    'my digital crib \u2014 creative digital studio',
    work:    'work \u2014 my digital crib',
    studio:  'studio \u2014 my digital crib',
    contact: 'contact \u2014 my digital crib',
  };
  document.title = titles[name];
}

function navigate(name, push = true) {
  if (!ROUTES.includes(name)) name = 'home';
  applyRoute(name);
  if (push) {
    const target = name === 'home' ? location.pathname + location.search : '#' + name;
    if (location.hash !== (name === 'home' ? '' : '#' + name)) {
      history.pushState({ route: name }, '', target);
    }
  }
}

// click handlers
document.querySelectorAll('a[data-route]').forEach(a => {
  a.addEventListener('click', e => {
    const route = a.dataset.route;
    if (!route) return;
    e.preventDefault();
    navigate(route);
  });
});

// browser back / forward
window.addEventListener('popstate', () => applyRoute(readRoute()));
window.addEventListener('hashchange', () => applyRoute(readRoute()));

// initial state from URL
applyRoute(readRoute());

// â”€â”€ boot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (window.StageBoot) window.StageBoot.mark('scene built');
requestAnimationFrame(tick);
