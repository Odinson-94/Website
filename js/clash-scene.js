import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const matSlab        = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.85, metalness: 0.05 });
const matStructure   = new THREE.MeshStandardMaterial({ color: 0xc8ccd3, roughness: 0.95, metalness: 0.0 });
const matPipeA       = new THREE.MeshStandardMaterial({ color: 0x8a9199, roughness: 0.45, metalness: 0.70, side: THREE.DoubleSide });
const matPipeB       = new THREE.MeshStandardMaterial({ color: 0xc43a3a, roughness: 0.30, metalness: 0.78, side: THREE.DoubleSide });
const matPipeC       = new THREE.MeshStandardMaterial({ color: 0xc4923a, roughness: 0.32, metalness: 0.75, side: THREE.DoubleSide });
const matFlange      = new THREE.MeshStandardMaterial({ color: 0x3d434b, roughness: 0.45, metalness: 0.85 });
const matBolt        = new THREE.MeshStandardMaterial({ color: 0x1d2025, roughness: 0.5,  metalness: 0.9 });
const matDuct        = new THREE.MeshStandardMaterial({ color: 0xb6bdc6, roughness: 0.55, metalness: 0.65 });
const matDuctFlange  = new THREE.MeshStandardMaterial({ color: 0x7c8088, roughness: 0.55, metalness: 0.7  });
const matFlue        = new THREE.MeshStandardMaterial({ color: 0x4d525b, roughness: 0.55, metalness: 0.65 });
const matTray        = new THREE.MeshStandardMaterial({ color: 0x4a5562, roughness: 0.55, metalness: 0.75 });
const matGhost       = new THREE.MeshStandardMaterial({ color: 0xe83535, roughness: 0.35, metalness: 0.5,
                                                       transparent: true, opacity: 0.38, depthWrite: false });
const matInsulation  = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.92, metalness: 0.0 });
const matHatch       = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.50, metalness: 0.60 });
const matHatchFrame  = new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.50, metalness: 0.70 });
const matLabelGreen  = new THREE.MeshStandardMaterial({ color: 0x2da84f, roughness: 0.70, metalness: 0.05 });
const matLabelBlue   = new THREE.MeshStandardMaterial({ color: 0x2878b8, roughness: 0.70, metalness: 0.05 });

class ArcCurve3 extends THREE.Curve {
  constructor(center, axis, radius, startVec, totalAngle) {
    super();
    this.center = center.clone(); this.axis = axis.clone().normalize();
    this.radius = radius; this.startVec = startVec.clone().normalize();
    this.totalAngle = totalAngle;
  }
  getPoint(t, target) {
    const out = target || new THREE.Vector3();
    const dir = this.startVec.clone().applyAxisAngle(this.axis, this.totalAngle * t);
    return out.copy(this.center).addScaledVector(dir, this.radius);
  }
}

function drawPipe(scene, pts, pipeR, mat, opts) {
  opts = opts || {};
  const elbowR = (opts.elbowR != null) ? opts.elbowR : Math.max(pipeR * 3.2, 0.10);
  const showStartFlange = !opts.flanges || opts.flanges.start !== false;
  const showEndFlange   = !opts.flanges || opts.flanges.end   !== false;
  const v = pts.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const path = new THREE.CurvePath();
  let cursor = v[0].clone();
  let firstTangent = null, lastTangent = null;
  for (let i = 1; i < v.length - 1; i++) {
    const A = v[i - 1], B = v[i], C = v[i + 1];
    const u = B.clone().sub(A).normalize();
    const w = C.clone().sub(B).normalize();
    const dot = THREE.MathUtils.clamp(u.dot(w), -0.999, 0.999);
    if (dot > 0.998) continue;
    const deflection = Math.acos(dot);
    const trim = elbowR * Math.tan(deflection / 2);
    const elbowStart = B.clone().sub(u.clone().multiplyScalar(trim));
    const elbowEnd   = B.clone().add(w.clone().multiplyScalar(trim));
    path.add(new THREE.LineCurve3(cursor.clone(), elbowStart.clone()));
    const axis = new THREE.Vector3().crossVectors(u, w).normalize();
    const bisect = w.clone().sub(u).normalize();
    const distToCenter = elbowR / Math.sin((Math.PI - deflection) / 2);
    const center = B.clone().add(bisect.multiplyScalar(distToCenter));
    const startVec = elbowStart.clone().sub(center).normalize();
    path.add(new ArcCurve3(center, axis, elbowR, startVec, deflection));
    cursor = elbowEnd.clone();
    if (firstTangent === null) firstTangent = u.clone();
  }
  path.add(new THREE.LineCurve3(cursor.clone(), v[v.length - 1].clone()));
  if (firstTangent === null) firstTangent = v[1].clone().sub(v[0]).normalize();
  lastTangent = v[v.length - 1].clone().sub(v[v.length - 2]).normalize();
  const totalLen = path.getLength();
  const tubularSegments = Math.max(48, Math.round(totalLen * 16));
  const geom = new THREE.TubeGeometry(path, tubularSegments, pipeR, 14, false);
  scene.add(new THREE.Mesh(geom, mat));
  function addFlange(point, tangent) {
    const fr = pipeR * 1.7, ft = pipeR * 0.45;
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(fr, fr, ft, 24), matFlange);
    disk.position.copy(point);
    disk.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), tangent);
    disk.position.add(tangent.clone().multiplyScalar(-ft / 2));
    scene.add(disk);
    const boltR = pipeR * 0.18, boltL = ft * 0.6, br = fr * 0.72;
    const ortho = Math.abs(tangent.y) < 0.9
      ? new THREE.Vector3(0,1,0).cross(tangent).normalize()
      : new THREE.Vector3(1,0,0).cross(tangent).normalize();
    const ortho2 = tangent.clone().cross(ortho).normalize();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      const off = ortho.clone().multiplyScalar(Math.cos(a) * br)
                  .addScaledVector(ortho2, Math.sin(a) * br);
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(boltR, boltR, boltL, 10), matBolt);
      bolt.position.copy(point).add(off);
      bolt.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), tangent);
      bolt.position.add(tangent.clone().multiplyScalar(-boltL / 2));
      scene.add(bolt);
    }
  }
  if (showStartFlange) addFlange(v[0], firstTangent);
  if (showEndFlange)   addFlange(v[v.length - 1], lastTangent.clone().multiplyScalar(-1));
}

function addHanger(scene, x, y, z, slabY, pipeR, pipeAxis) {
  const rodLen = Math.max(0.05, slabY - y - pipeR);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, rodLen, 8), matFlue);
  rod.position.set(x, y + pipeR + rodLen / 2, z); scene.add(rod);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(pipeR * 1.18, 0.022, 8, 20, Math.PI), matFlue);
  strap.position.set(x, y, z);
  if (pipeAxis === 'x') {
    strap.rotation.y = Math.PI / 2;
    strap.rotation.x = Math.PI;
  } else {
    strap.rotation.z = Math.PI;
  }
  scene.add(strap);
}

function addDuctLabel(scene, x, y, z, w, h, mat) {
  const label = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.004), mat);
  label.position.set(x, y, z); scene.add(label);
}

function addPipeLabel(scene, x, y, z, pipeR, mat, axis) {
  const bandW = 0.08;
  const bandR = pipeR + 0.002;
  const geom = new THREE.CylinderGeometry(bandR, bandR, bandW, 20);
  const band = new THREE.Mesh(geom, mat);
  band.position.set(x, y, z);
  if (axis === 'x') band.rotation.z = Math.PI / 2;
  if (axis === 'z') band.rotation.x = Math.PI / 2;
  scene.add(band);
}

function buildClashSolver(scene) {
  const slabY = 3.20;
  const rs = 0.020;
  const us = 0.041;

  const slab = new THREE.Mesh(new THREE.BoxGeometry(8, 0.18, 5), matStructure);
  slab.position.y = slabY; scene.add(slab);
  [-1.8, 1.8].forEach(z => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 0.22, 0.20), matStructure);
    beam.position.set(0, slabY - 0.20, z); scene.add(beam);
  });

  // Fire-boarded downstand beams running across the corridor (in X direction)
  // Sit either side of the ramp, attached to slab, blocking the pipe at that height
  const matFireBoard = new THREE.MeshStandardMaterial({ color: 0xede8df, roughness: 0.92, metalness: 0.0 });
  const fbH = 1.04, fbW = 0.43;
  const slabBot = slabY - 0.09;
  const fbY = slabBot - fbH / 2;
  [-1.3, 1.3].forEach(x => {
    const core = new THREE.Mesh(new THREE.BoxGeometry(fbW - 0.05, fbH - 0.05, 4.98), matStructure);
    core.position.set(x, fbY, 0); scene.add(core);
    const board = new THREE.Mesh(new THREE.BoxGeometry(fbW, fbH, 5), matFireBoard);
    board.position.set(x, fbY, 0); scene.add(board);
  });

  const ceilY = 0.60;
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0xf5f5f0, roughness: 0.95, metalness: 0.0,
    transparent: true, opacity: 0.50, depthWrite: false, side: THREE.DoubleSide
  });
  const ceilGrid = new THREE.MeshStandardMaterial({ color: 0xe0ddd8, roughness: 0.7, metalness: 0.25 });
  const ceilPanel = new THREE.Mesh(new THREE.BoxGeometry(8, 0.012, 5), ceilMat);
  ceilPanel.position.set(0, ceilY, 0); scene.add(ceilPanel);
  for (let x = -3.5; x <= 3.5; x += 0.6) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.025, 5), ceilGrid);
    bar.position.set(x, ceilY + 0.013, 0); scene.add(bar);
  }
  for (let z = -2.5; z <= 2.5; z += 0.6) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(8, 0.025, 0.018), ceilGrid);
    bar.position.set(0, ceilY + 0.013, z); scene.add(bar);
  }

  const csZy = 1.02;
  const csZspan = 1.00;
  const csZrodX = [-(csZspan / 2 - 0.01), (csZspan / 2 - 0.01)];
  const csZposns = [-1.8, -0.4, 1.0, 1.8];
  csZposns.forEach(z => {
    const chan = new THREE.Mesh(new THREE.BoxGeometry(csZspan, us, us), matFlue);
    chan.position.set(0, csZy, z); scene.add(chan);
    csZrodX.forEach(xOff => {
      const rodLen = slabY - csZy - us / 2;
      const rod = new THREE.Mesh(new THREE.BoxGeometry(rs, rodLen, rs), matFlue);
      rod.position.set(xOff, csZy + us / 2 + rodLen / 2, z); scene.add(rod);
    });
  });
  const trayZy = csZy + us / 2 + 0.01;
  const trayZbody = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.018, 4.8), matTray);
  trayZbody.position.set(0, trayZy, 0); scene.add(trayZbody);
  [-0.225, 0.225].forEach(xOff => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.055, 4.8), matTray);
    side.position.set(xOff, trayZy + 0.026, 0); scene.add(side);
  });
  const pipeZy = csZy - 0.14;
  csZposns.forEach(z => {
    [-0.08, 0.08].forEach(xOff => {
      const hangLen = csZy - us / 2 - pipeZy - 0.035;
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.010, Math.max(0.02, hangLen), 0.010), matFlue);
      rod.position.set(xOff, pipeZy + 0.035 + Math.max(0.02, hangLen) / 2, z); scene.add(rod);
    });
  });
  drawPipe(scene, [[-0.08, pipeZy, -2.4], [-0.08, pipeZy, 2.4]], 0.035, matPipeC, { elbowR: 0.07 });
  drawPipe(scene, [[ 0.08, pipeZy, -2.4], [ 0.08, pipeZy, 2.4]], 0.028, matPipeB, { elbowR: 0.06 });

  const csXy = 1.12;
  const csXspan = 0.50;
  const csXrodZ = [-(csXspan / 2 - 0.01), (csXspan / 2 - 0.01)];
  [-2.4, -0.8, 0.95, 2.4].forEach(x => {
    const chan = new THREE.Mesh(new THREE.BoxGeometry(us, us, csXspan), matFlue);
    chan.position.set(x, csXy, -1.20); scene.add(chan);
    csXrodZ.forEach(zOff => {
      const rodLen = slabY - csXy - us / 2;
      const rod = new THREE.Mesh(new THREE.BoxGeometry(rs, rodLen, rs), matFlue);
      rod.position.set(x, csXy + us / 2 + rodLen / 2, -1.20 + zOff); scene.add(rod);
    });
  });
  const trayXy = csXy + us / 2 + 0.01;
  const trayXbody = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.018, 0.35), matTray);
  trayXbody.position.set(0, trayXy, -1.20); scene.add(trayXbody);
  [-0.175, 0.175].forEach(zOff => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.055, 0.015), matTray);
    side.position.set(0, trayXy + 0.026, -1.20 + zOff); scene.add(side);
  });

  const dY = 1.60, dW = 0.70, dH = 0.55;
  const sdW = 0.30, sdH = 0.25;
  const sdX = dW / 2 + sdW / 2 + 0.22;
  const ductBot = dY - dH / 2;
  const leftRodX = -(csZspan / 2 - 0.01);
  const rightRodX = sdX + sdW / 2 + 0.06;
  const ductChanSpan = rightRodX - leftRodX + 0.04;
  const ductChanCx = (leftRodX + rightRodX) / 2;
  [-1.8, -0.4, 1.0, 1.8].forEach(z => {
    const chan = new THREE.Mesh(new THREE.BoxGeometry(ductChanSpan, us, us), matFlue);
    chan.position.set(ductChanCx, ductBot, z); scene.add(chan);
    [leftRodX, rightRodX].forEach(rx => {
      const rodLen = slabY - ductBot - us / 2;
      const rod = new THREE.Mesh(new THREE.BoxGeometry(rs, rodLen, rs), matFlue);
      rod.position.set(rx, ductBot + us / 2 + rodLen / 2, z); scene.add(rod);
    });
  });
  // Main duct — hollow galv shell, full 5m, no near-end flange so you see inside
  const sk = 0.02;
  const dLen = 5.0;
  const top    = new THREE.Mesh(new THREE.BoxGeometry(dW, sk, dLen), matDuct);
  top.position.set(0, dY + dH / 2 - sk / 2, 0); scene.add(top);
  const bot2   = new THREE.Mesh(new THREE.BoxGeometry(dW, sk, dLen), matDuct);
  bot2.position.set(0, dY - dH / 2 + sk / 2, 0); scene.add(bot2);
  const sideL  = new THREE.Mesh(new THREE.BoxGeometry(sk, dH - sk * 2, dLen), matDuct);
  sideL.position.set(-dW / 2 + sk / 2, dY, 0); scene.add(sideL);
  const sideR  = new THREE.Mesh(new THREE.BoxGeometry(sk, dH - sk * 2, dLen), matDuct);
  sideR.position.set(dW / 2 - sk / 2, dY, 0); scene.add(sideR);
  // Insulation lining (visible at the open near end)
  const insT = 0.030;
  const insTop = new THREE.Mesh(new THREE.BoxGeometry(dW - sk * 2, insT, dLen), matInsulation);
  insTop.position.set(0, dY + dH / 2 - sk - insT / 2, 0); scene.add(insTop);
  const insBot = new THREE.Mesh(new THREE.BoxGeometry(dW - sk * 2, insT, dLen), matInsulation);
  insBot.position.set(0, dY - dH / 2 + sk + insT / 2, 0); scene.add(insBot);
  const insL  = new THREE.Mesh(new THREE.BoxGeometry(insT, dH - sk * 2 - insT * 2, dLen), matInsulation);
  insL.position.set(-dW / 2 + sk + insT / 2, dY, 0); scene.add(insL);
  const insR  = new THREE.Mesh(new THREE.BoxGeometry(insT, dH - sk * 2 - insT * 2, dLen), matInsulation);
  insR.position.set(dW / 2 - sk - insT / 2, dY, 0); scene.add(insR);
  // Duct flanges — near end (z=2.5) removed so you see the hollow interior
  [-1.5, 0, 1.5].forEach(z => {
    const fl = new THREE.Mesh(new THREE.BoxGeometry(dW + 0.06, dH + 0.06, 0.04), matDuctFlange);
    fl.position.set(0, dY, z); scene.add(fl);
  });
  const fl_far = new THREE.Mesh(new THREE.BoxGeometry(dW + 0.08, dH + 0.08, 0.04), matDuctFlange);
  fl_far.position.set(0, dY, -2.5); scene.add(fl_far);
  // Access hatch on near side
  const hatchW = 0.30, hatchH = 0.22;
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(hatchW, hatchH, 0.006), matHatch);
  hatch.position.set(0, dY, dW / 2 - sk / 2 + 0.004);
  hatch.rotation.x = 0; hatch.rotation.y = Math.PI / 2;
  scene.add(hatch);
  // Hatch frame
  [[-hatchW / 2, 0], [hatchW / 2, 0]].forEach(([xo]) => {
    const vbar = new THREE.Mesh(new THREE.BoxGeometry(0.018, hatchH + 0.02, 0.008), matHatchFrame);
    vbar.position.set(xo, dY, dW / 2 - sk / 2 + 0.006);
    vbar.rotation.y = Math.PI / 2; scene.add(vbar);
  });
  [[0, -hatchH / 2], [0, hatchH / 2]].forEach(([, yo]) => {
    const hbar = new THREE.Mesh(new THREE.BoxGeometry(hatchW + 0.02, 0.018, 0.008), matHatchFrame);
    hbar.position.set(0, dY + yo, dW / 2 - sk / 2 + 0.006);
    hbar.rotation.y = Math.PI / 2; scene.add(hbar);
  });

  // Small duct (solid — sits on same support)
  const sdY = ductBot + sdH / 2;
  const smallDuct = new THREE.Mesh(new THREE.BoxGeometry(sdW, sdH, 4.5), matDuct);
  smallDuct.position.set(sdX, sdY, 0); scene.add(smallDuct);
  [-2.0, 0, 2.0].forEach(z => {
    const fl = new THREE.Mesh(new THREE.BoxGeometry(sdW + 0.04, sdH + 0.04, 0.03), matDuctFlange);
    fl.position.set(sdX, sdY, z); scene.add(fl);
  });

  // Duct label sticker on small duct only
  addDuctLabel(scene, sdX, sdY + sdH / 2 + 0.003, 0, 0.20, 0.07, matLabelGreen);

  // Upper pipe (runs in Z)
  drawPipe(scene, [[0.70, 2.42, -2.4], [0.70, 2.42, 2.4]], 0.060, matPipeB, { elbowR: 0.12 });
  [-1.4, 0, 1.4].forEach(z => {
    addHanger(scene, 0.70, 2.42, z, slabY, 0.060, 'z');
  });

  // Two grey pipes — no flanges, with label bands and hangers
  const pY = 1.60, pipeR = 0.115;
  const peakY = 2.10, ramp = peakY - pY, flatHalf = 0.80;
  [-0.22, 0.22].forEach(z => {
    const ghost = new THREE.Mesh(new THREE.CylinderGeometry(pipeR, pipeR, 7.0, 24), matGhost);
    ghost.rotation.z = Math.PI / 2;
    ghost.position.set(0, pY, z); scene.add(ghost);
  });
  [-0.22, 0.22].forEach((z, i) => {
    drawPipe(scene, [
      [-3.5,               pY,    z],
      [-(flatHalf + ramp), pY,    z],
      [-flatHalf,          peakY, z],
      [ flatHalf,          peakY, z],
      [ (flatHalf + ramp), pY,    z],
      [ 3.5,               pY,    z],
    ], pipeR, matPipeA, { elbowR: 0.22, flanges: { start: false, end: false } });
    const lmat = i === 0 ? matLabelGreen : matLabelBlue;
    [-2.8, -1.5, 1.5, 2.8].forEach(x => {
      addPipeLabel(scene, x, pY, z, pipeR, lmat, 'x');
    });
    // Hangers on straight runs
    [-2.8, -1.8, 1.8, 2.8].forEach(x => {
      addHanger(scene, x, pY, z, slabY, pipeR, 'x');
    });
    // Supports on the ramp — aligned with containment drop rod X positions
    [-(csZspan / 2 - 0.01), (csZspan / 2 - 0.01)].forEach(x => {
      addHanger(scene, x, peakY, z, slabY, pipeR, 'x');
    });
  });

  // Sprinkler branch off the red pipe — tee, horizontal above duct, then up
  const sprR = 0.020;
  const sprRunY = 2.42;
  const sprTopY = slabY - 0.10;
  drawPipe(scene, [
    [0.70, sprRunY, -0.8],
    [0.0,  sprRunY, -0.8],
    [0.0,  sprTopY, -0.8],
  ], sprR, matPipeB, { elbowR: 0.06, flanges: { start: false, end: false } });
  // Sprinkler branch anchor — support on the horizontal run before the bend
  addHanger(scene, 0.18, sprRunY, -0.8, slabY, sprR, 'x');

  // Void detection sprinkler head — at top of the vertical riser
  const matSprinkler = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.75 });
  const headBody = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 12), matSprinkler);
  headBody.position.set(0.0, sprTopY + 0.02, -0.8); scene.add(headBody);
  const deflector = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.030, 0.008, 16), matSprinkler);
  deflector.position.set(0.0, sprTopY + 0.045, -0.8); scene.add(deflector);
  const rosette = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 16),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.8, metalness: 0.1 }));
  rosette.position.set(0.0, sprTopY - 0.003, -0.8); scene.add(rosette);

  // Fire alarm devices — one in each beam compartment (3 total), on slab soffit
  const matAlarm = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.85, metalness: 0.05 });
  const matAlarmLed = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.4, metalness: 0.3,
    emissive: 0x661111, emissiveIntensity: 0.4 });
  const slabSoffit = slabY - 0.09;
  [-2.5, 0, 2.5].forEach(x => {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.025, 20), matAlarm);
    disc.position.set(x, slabSoffit - 0.013, 1.2); scene.add(disc);
    const led = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.004, 10), matAlarmLed);
    led.position.set(x, slabSoffit - 0.026, 1.2); scene.add(led);
  });

  return { camera: { pos: [6.0, 3.4, 6.0], lookAt: [0, 1.50, 0] } };
}

const SCENES = { 'clash-solver': buildClashSolver };
const TITLES = { 'clash-solver': 'Clash Solver' };

function makeViewer(host, sceneKey, opts = {}) {
  const factory = SCENES[sceneKey];
  if (!factory) return null;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd4e4ef);
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 0.95);
  dir.position.set(6, 10, 6); scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0xaaccff, 0.35);
  dir2.position.set(-6, 4, -3); scene.add(dir2);
  const meta = factory(scene);
  const w = host.clientWidth || 320;
  const h = host.clientHeight || 180;
  const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 200);
  const [cx, cy, cz] = meta.camera.pos;
  camera.position.set(cx, cy, cz);
  const [lx, ly, lz] = meta.camera.lookAt;
  camera.lookAt(lx, ly, lz);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  host.appendChild(renderer.domElement);
  let controls = null;
  if (opts.controls) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(lx, ly, lz);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.minDistance = 3; controls.maxDistance = 25;
  }
  let stop = false; let t0 = performance.now();
  const rmMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rm = rmMq.matches; rmMq.addEventListener('change', e => { rm = e.matches; });
  function tick(now) {
    if (stop) return;
    t0 = now;
    if (!opts.controls && !rm) {
      const ang = now * 0.00018;
      const rad = Math.hypot(cx, cz);
      camera.position.x = Math.cos(ang) * rad;
      camera.position.z = Math.sin(ang) * rad;
      camera.lookAt(lx, ly, lz);
    }
    if (controls) controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  function resize() {
    const w = host.clientWidth || 320;
    const h = host.clientHeight || 180;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  const ro = new ResizeObserver(resize); ro.observe(host);
  return { destroy() { stop = true; ro.disconnect(); try { renderer.dispose(); } catch {} try { renderer.domElement.remove(); } catch {} } };
}

document.querySelectorAll('.scene-3d').forEach(host => {
  const key = host.dataset.scene;
  if (!key || !SCENES[key]) return;
    try { makeViewer(host, key, { controls: false }); } catch (e) { }
});

const modal = document.getElementById('sceneModal');
const modalStage = document.getElementById('sceneModalStage');
const modalTitle = document.getElementById('sceneModalTitle');
const modalClose = document.getElementById('sceneModalClose');
let modalViewer = null;
function openModal(key) {
  if (!SCENES[key]) return;
  modalTitle.textContent = TITLES[key] || '3D preview';
  modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { modalViewer = makeViewer(modalStage, key, { controls: true }); });
}
function closeModal() {
  modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (modalViewer) { modalViewer.destroy(); modalViewer = null; }
}
document.querySelectorAll('.scene-3d').forEach(host => {
  host.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openModal(host.dataset.scene); });
});
if (modalClose) modalClose.addEventListener('click', closeModal);
if (modal) modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
