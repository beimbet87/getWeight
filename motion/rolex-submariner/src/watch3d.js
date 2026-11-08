// Three.js part: 2.5D flat layers, real 3D watch, exploded view, gold crown logo, depth-of-field post.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { W, H, clamp, lerp, seg, smooth, eOut, eIn, eInOut, eOutBack, spring, track, watchTime } from './common.js';
import * as g from './geom.js';
import { flatLayer } from './watch2d.js';

const V = (x, y) => new THREE.Vector2(x, -y); // canvas -> three (y up)
const shapeFrom = (pts, holes = []) => { const s = new THREE.Shape(pts.map(([x, y]) => V(x, y))); for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => V(x, y)))); return s; };

// Dark studio with a few soft boxes: contrasty reflections on polished steel.
function studioEnv() {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x1c2128);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, vertexShader: 'varying vec3 p; void main(){ p=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'varying vec3 p; void main(){ float k=smoothstep(-0.6,0.9,p.y); gl_FragColor=vec4(mix(vec3(0.05,0.07,0.1),vec3(0.55,0.6,0.66),k),1.); }' })); sc.add(dome);
  const box = (w, h, k, col, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(...look); sc.add(m); };
  box(6, 3, 4.0, 0xffffff, [0, 5, 3], [0, 0, 0]);      // top-front softbox
  box(1.2, 7, 3.0, 0xdfeeff, [-5, 1, 1], [0, 0, 0]);   // left strip
  box(1.0, 6, 2.2, 0xffffff, [5, 0, -1], [0, 0, 0]);   // right strip
  box(8, 1.2, 0.9, 0x6aa8ff, [0, -4, 2], [0, 0, 0]);   // cool floor bounce
  box(3, 3, 1.4, 0xffe2b0, [2, 3, -5], [0, 0, 0]);     // warm back kicker
  return sc;
}

export class Watch3D {
  constructor() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
    r.setSize(W, H, false); r.setPixelRatio(1);
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    this.env = pm.fromScene(studioEnv(), 0.02).texture;
    this.scene.environment = this.env;
    this.cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 60);
    this.key = new THREE.DirectionalLight(0xffffff, 1.6); this.key.position.set(-3, 4, 5); this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight(0x7fc8ff, 1.2); this.rim.position.set(4, -2, -3); this.scene.add(this.rim);
    this.sweep = new THREE.PointLight(0xffffff, 0, 6, 1.6); this.scene.add(this.sweep);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.buildLayers(); this.buildModel(); this.buildLogo(); this.buildPost();
  }

  // ---------- 2.5D flat layers ----------
  layerTexture(layer, x0, y0, x1, y1, ppu, opts = {}) {
    const c = document.createElement('canvas'); c.width = Math.round((x1 - x0) * ppu); c.height = Math.round((y1 - y0) * ppu);
    const x = c.getContext('2d'); x.setTransform(ppu, 0, 0, ppu, -x0 * ppu, -y0 * ppu);
    flatLayer(x, layer, 32, opts);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  buildLayers() {
    const L = this.layers = new THREE.Group(); this.root.add(L);
    const mk = (layer, box, z, ppu = 900, opts) => {
      const [x0, y0, x1, y1] = box; const tex = this.layerTexture(layer, x0, y0, x1, y1, ppu, opts);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: layer === 'crystal' ? 0 : 0.03, depthWrite: layer !== 'crystal', toneMapped: false, side: THREE.DoubleSide }));
      const piv = new THREE.Group(); m.position.set((x0 + x1) / 2, -(y0 + y1) / 2, 0); piv.add(m); piv.userData = { z, layer }; L.add(piv); return piv;
    };
    this.lay = {
      bracelet: mk('bracelet', [-0.42, -3.9, 0.42, 3.9], -0.55, 520),
      case: mk('case', [-1.35, -1.32, 1.35, 1.32], -0.30),
      dial: mk('dial', [-0.82, -0.82, 0.82, 0.82], -0.14, 1100),
      markers: mk('markers', [-0.82, -0.82, 0.82, 0.82], -0.05, 1100),
      bezel: mk('bezel', [-1.02, -1.02, 1.02, 1.02], 0.10, 1100, { bezel: 0 }),
      hour: mk('hour', [-0.1, -0.46, 0.1, 0.1], 0.20, 1600, { angle: 0 }),
      min: mk('min', [-0.06, -0.73, 0.06, 0.1], 0.28, 1600, { angle: 0 }),
      sec: mk('sec', [-0.05, -0.76, 0.05, 0.22], 0.36, 1600, { angle: 0 }),
      crystal: mk('crystal', [-0.82, -0.82, 0.82, 0.82], 0.52, 900),
    };
    // the hands' meshes must pivot at the watch centre: plane centre offsets already handle that.
  }

  // ---------- real 3D model ----------
  buildModel() {
    const M = this.model = new THREE.Group(); this.root.add(M);
    const steel = new THREE.MeshStandardMaterial({ color: 0xd4d8dc, metalness: 1, roughness: 0.16 });
    const brushed = new THREE.MeshStandardMaterial({ color: 0xc9cdd2, metalness: 1, roughness: 0.38 });
    const whiteGold = new THREE.MeshStandardMaterial({ color: 0xe6e8ea, metalness: 1, roughness: 0.12 });
    const lume = new THREE.MeshStandardMaterial({ color: 0xf1eee4, roughness: 0.55, metalness: 0, emissive: 0x2a5d7a, emissiveIntensity: 0 });
    this.mats = { steel, brushed, whiteGold, lume };
    const P = this.parts = {};
    const part = (name, obj, out) => { const gq = new THREE.Group(); gq.add(obj); gq.userData.out = out; P[name] = gq; M.add(gq); return gq; };

    // case with lugs + crown guard
    const cg = new THREE.ExtrudeGeometry(shapeFrom(g.caseOutline()), { depth: 0.24, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 4, curveSegments: 24 });
    cg.translate(0, 0, -0.15);
    const caseMesh = new THREE.Mesh(cg, steel);
    part('case', caseMesh, new THREE.Vector3(0, 0, 0));

    // crown
    const crg = new THREE.CylinderGeometry(0.15, 0.15, 0.17, 96, 1, false);
    const pos = crg.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z); if (r > 0.1) { const k = 1 + 0.035 * Math.sign(Math.sin(a * 24)); pos.setX(i, x * k); pos.setZ(i, z * k); } }
    crg.computeVertexNormals(); crg.rotateZ(Math.PI / 2);
    const crown = new THREE.Mesh(crg, steel); crown.position.set(1.215, 0, -0.02);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.01, 48).rotateZ(Math.PI / 2), whiteGold); cap.position.set(1.302, 0, -0.02);
    const crownG = new THREE.Group(); crownG.add(crown, cap);
    part('crown', crownG, new THREE.Vector3(0.8, 0, 0));

    // case back
    const back = new THREE.Mesh(new THREE.LatheGeometry([[0, -0.255], [0.6, -0.245], [0.82, -0.22], [0.87, -0.19], [0.88, -0.16]].map(([r, z]) => new THREE.Vector2(r, z)), 128).rotateX(Math.PI / 2), brushed);
    part('caseback', back, new THREE.Vector3(0, 0, -1.45));

    // movement
    const mv = new THREE.Group();
    const rhod = new THREE.MeshStandardMaterial({ color: 0xc3c7cc, metalness: 1, roughness: 0.3 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xd7b56d, metalness: 1, roughness: 0.28 });
    const ruby = new THREE.MeshPhysicalMaterial({ color: 0xb0122e, roughness: 0.1, metalness: 0, clearcoat: 1 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x3d6fe0, metalness: 0.6, roughness: 0.25 });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.07, 96).rotateX(Math.PI / 2), rhod); plate.position.z = 0; mv.add(plate);
    const bridgeShape = shapeFrom([[-0.62, 0.1], [-0.5, -0.32], [-0.1, -0.5], [0.3, -0.42], [0.52, -0.1], [0.4, 0.12], [0.05, 0.05], [-0.3, 0.25], [-0.62, 0.1]]);
    const br = new THREE.Mesh(new THREE.ExtrudeGeometry(bridgeShape, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 }), rhod); br.position.z = -0.08; br.rotation.y = Math.PI; mv.add(br);
    for (const [x, y] of [[-0.45, -0.1], [-0.2, -0.32], [0.2, -0.3], [0.35, -0.05], [-0.05, -0.12]]) { const j = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), ruby); j.position.set(x, -y, -0.125); mv.add(j); }
    const gearG = new THREE.Group();
    for (const [x, y, r] of [[0.28, 0.32, 0.16], [-0.02, 0.4, 0.11], [0.45, 0.22, 0.08]]) {
      const gs = new THREE.Shape(); const n = Math.round(r * 220);
      for (let i = 0; i <= n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, rr = i % 2 ? r : r * 0.9; i ? gs.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : gs.moveTo(rr, 0); }
      const gm = new THREE.Mesh(new THREE.ExtrudeGeometry(gs, { depth: 0.012, bevelEnabled: false }), brass); gm.position.set(x, y, -0.06); gm.rotation.y = Math.PI; gearG.add(gm);
    }
    mv.add(gearG); this.gears = gearG;
    const bal = this.balance = new THREE.Group(); bal.position.set(-0.36, 0.3, -0.1);
    bal.add(new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.014, 12, 64), brass));
    for (let i = 0; i < 2; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.014, 0.01), brass); s.rotation.z = i * Math.PI / 2; bal.add(s); }
    const hs = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.004, 6, 48), blue); bal.add(hs);
    mv.add(bal);
    const rotorShape = new THREE.Shape(); rotorShape.absarc(0, 0, 0.7, Math.PI * 0.05, Math.PI * 0.95, false); rotorShape.absarc(0, 0, 0.22, Math.PI * 0.95, Math.PI * 0.05, true);
    const rotor = this.rotor = new THREE.Mesh(new THREE.ExtrudeGeometry(rotorShape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 }), rhod);
    const rotorPiv = this.rotorPiv = new THREE.Group(); rotor.position.z = -0.2; rotorPiv.add(rotor);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 32).rotateX(Math.PI / 2), brass); axle.position.z = -0.18; rotorPiv.add(axle);
    mv.add(rotorPiv);
    mv.position.z = 0.0; mv.scale.setScalar(0.98);
    part('movement', mv, new THREE.Vector3(0, 0, -0.8));

    // dial + markers
    const dialTex = this.texFromLayer('dial', 0.8, 1600);
    const dialMat = new THREE.MeshPhysicalMaterial({ map: dialTex, roughness: 0.28, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.1 });
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.8, 128), dialMat); dial.position.z = 0.135;
    const dialG = new THREE.Group(); dialG.add(dial);
    for (const m of g.dialMarkers()) {
      const cx = m.pts.reduce((a, p) => a + p[0], 0) / m.pts.length, cy = m.pts.reduce((a, p) => a + p[1], 0) / m.pts.length;
      const rimPts = m.pts.map(([x, y]) => [cx + (x - cx) * 1.2 + Math.sign(x - cx) * 0.004, cy + (y - cy) * 1.2 + Math.sign(y - cy) * 0.004]);
      const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeFrom(rimPts), { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 }), whiteGold); rim.position.z = 0.136;
      const lm = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeFrom(m.pts), { depth: 0.02, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2 }), lume); lm.position.z = 0.138;
      dialG.add(rim, lm);
    }
    part('dial', dialG, new THREE.Vector3(0, 0, 0.36));

    // hands
    const handMesh = (hd, z) => {
      const gH = new THREE.Group();
      for (const p of hd.metal) { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeFrom(p), { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1 }), whiteGold); gH.add(m); }
      for (const p of hd.lume) { const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeFrom(p), { depth: 0.004, bevelEnabled: false }), lume); m.position.z = 0.009; gH.add(m); }
      gH.position.z = z; return gH;
    };
    this.hands = { h: handMesh(g.hourHand(), 0.17), m: handMesh(g.minuteHand(), 0.185), s: handMesh(g.secondsHand(), 0.2) };
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.08, 32).rotateX(Math.PI / 2), whiteGold); pin.position.z = 0.17;
    part('hour', this.hands.h, new THREE.Vector3(0, 0, 0.6));
    part('min', this.hands.m, new THREE.Vector3(0, 0, 0.7));
    part('sec', this.hands.s, new THREE.Vector3(0, 0, 0.8)).add(pin);

    // bezel: steel ring with coin edge + glossy ceramic insert
    const prof = [[0.80, 0.115], [0.80, 0.2], [0.815, 0.235], [0.83, 0.245], [0.97, 0.245], [0.99, 0.235], [1.003, 0.21], [1.006, 0.15], [1.0, 0.12], [0.96, 0.11], [0.80, 0.115]];
    const bz = new THREE.LatheGeometry(prof.map(([r, z]) => new THREE.Vector2(r, z)), 480).rotateX(Math.PI / 2);
    const bp = bz.attributes.position;
    for (let i = 0; i < bp.count; i++) { const x = bp.getX(i), y = bp.getY(i), r = Math.hypot(x, y); if (r > 0.995) { const a = Math.atan2(y, x), k = 1 + 0.008 * Math.sign(Math.sin(a * 120)); bp.setX(i, x * k); bp.setY(i, y * k); } }
    bz.computeVertexNormals();
    const bezelG = new THREE.Group(); bezelG.add(new THREE.Mesh(bz, steel));
    const insTex = this.texFromLayer('insert', 0.968, 2048);
    const ins = new THREE.Mesh(new THREE.RingGeometry(0.83, 0.968, 240, 1), new THREE.MeshPhysicalMaterial({ map: insTex, roughness: 0.12, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05 }));
    ins.position.z = 0.247; bezelG.add(ins);
    part('bezel', bezelG, new THREE.Vector3(0, 0, 1.05));

    // crystal + cyclops
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.07, clearcoat: 1, depthWrite: false, envMapIntensity: 0.9 });
    const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.805, 0.805, 0.03, 128).rotateX(Math.PI / 2), glass); cr.position.z = 0.255;
    const cyc = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), glass); cyc.scale.set(0.145, 0.125, 0.04); cyc.position.set(0.645, 0, 0.27);
    const crystalG = new THREE.Group(); crystalG.add(cr, cyc); cr.renderOrder = 5; cyc.renderOrder = 6;
    part('crystal', crystalG, new THREE.Vector3(0, 0, 1.4));

    // bracelet
    const brace = (side) => {
      const bg = new THREE.Group();
      for (const r of g.braceletRows(side)) {
        const d = Math.abs((r.ya + r.yb) / 2) - 1.16, yc = -(r.ya + r.yb) / 2;
        const z = -0.07 - 0.07 * d * d, slope = -0.14 * d;
        const row = new THREE.Group(); row.position.set(0, yc, z); row.rotation.x = side * Math.atan(0.14 * d);
        const h = r.yb - r.ya, ow = (r.w - r.cw) / 2 - 0.006;
        for (const sx of [-1, 1]) { const o = new THREE.Mesh(new RoundedBoxGeometry(ow, h, 0.1, 2, 0.022), brushed); o.position.x = sx * (r.cw / 2 + 0.006 + ow / 2); row.add(o); }
        const c = new THREE.Mesh(new RoundedBoxGeometry(r.cw, h, 0.11, 2, 0.02), steel); c.position.z = 0.006; row.add(c);
        bg.add(row);
      }
      return bg;
    };
    part('braceTop', brace(-1), new THREE.Vector3(0, 0.9, -0.15));
    part('braceBot', brace(1), new THREE.Vector3(0, -0.9, -0.15));

    this.partOrder = ['crystal', 'bezel', 'sec', 'min', 'hour', 'dial', 'crown', 'movement', 'caseback', 'braceTop', 'braceBot', 'case'];
  }
  texFromLayer(layer, R, px) {
    const c = document.createElement('canvas'); c.width = c.height = px; const x = c.getContext('2d');
    const s = px / (2 * R); x.setTransform(s, 0, 0, s, px / 2, px / 2);
    if (layer === 'insert') {
      x.fillStyle = '#0d0e10'; x.fillRect(-R, -R, 2 * R, 2 * R);
      flatLayer(x, 'bezel', 40, { bezel: 0 });
    } else flatLayer(x, layer, 40, {});
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }

  // ---------- gold crown logo ----------
  buildLogo() {
    const LG = this.logo = new THREE.Group(); this.scene.add(LG); LG.visible = false;
    const gold = this.gold = new THREE.MeshPhysicalMaterial({ color: 0xe9bf5f, metalness: 1, roughness: 0.2, clearcoat: 0.4, envMapIntensity: 1.25 });
    const c = g.crownLogo(); const ex = { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 4, curveSegments: 16 };
    const center = v => v;
    this.logoBand = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeFrom(c.band), ex), gold);
    this.logoBand.geometry.translate(0, 0, -0.035);
    LG.add(this.logoBand);
    this.tines = c.tines.map((tp, i) => {
      const bx = (tp[0][0] + tp[3][0]) / 2, by = (tp[0][1] + tp[3][1]) / 2;
      const dx = c.tips[i][0] - bx, dy = -(c.tips[i][1] - by), L = Math.hypot(dx, dy), th = Math.atan2(-dx, dy);
      const geo = new THREE.ExtrudeGeometry(shapeFrom(tp.map(([x, y]) => [x - bx, y - by])), ex); geo.translate(0, 0, -0.035); geo.rotateZ(-th);
      const piv = new THREE.Group(); piv.position.set(bx, -by, 0);
      const inner = new THREE.Group(); inner.rotation.z = th; piv.add(inner);
      const m = new THREE.Mesh(geo, gold); inner.add(m);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(c.balls[i].r, 48, 32), gold); inner.add(ball);
      piv.userData = { mesh: m, ball, L: L + 0.03 }; LG.add(piv);
      return piv;
    });
    LG.position.set(0, 0, 0);
  }

  // ---------- depth of field post ----------
  buildPost() {
    const rt = this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    rt.depthTexture = new THREE.DepthTexture(W, H); rt.depthTexture.type = THREE.UnsignedIntType;
    this.post = new THREE.ShaderMaterial({
      uniforms: { tColor: { value: rt.texture }, tDepth: { value: rt.depthTexture }, near: { value: 0.05 }, far: { value: 60 }, focus: { value: 6 }, aperture: { value: 0 }, maxBlur: { value: 14 }, res: { value: new THREE.Vector2(W, H) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `
        uniform sampler2D tColor, tDepth; uniform float near, far, focus, aperture, maxBlur; uniform vec2 res; varying vec2 vUv;
        float lin(float d){ float z=d*2.-1.; return 2.*near*far/(far+near-z*(far-near)); }
        float coc(float z){ return clamp(aperture*abs(z-focus)/max(z,1e-3), 0., maxBlur); }
        void main(){
          vec4 c0 = texture2D(tColor, vUv); float z0 = lin(texture2D(tDepth, vUv).r); float r0 = coc(z0);
          vec4 acc = c0; float wsum = 1.;
          if (maxBlur > 0.5 && aperture > 0.) {
            const int N = 36; float ga = 2.39996323;
            for (int i=1;i<N;i++){
              float fi=float(i); float rr = sqrt(fi/float(N))*maxBlur; float a = fi*ga;
              vec2 o = vec2(cos(a),sin(a))*rr/res;
              float zs = lin(texture2D(tDepth, vUv+o).r); float rs = coc(zs);
              if (zs > z0) rs = min(rs, r0*1.5+0.5);
              float w = smoothstep(rr-1.5, rr+0.5, rs);
              acc += texture2D(tColor, vUv+o)*w; wsum += w;
            }
          }
          vec4 c = acc/wsum;
          float a = c.a; vec3 col = a>0.0001 ? c.rgb/a : vec3(0.);
          gl_FragColor = vec4(col, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          gl_FragColor = vec4(gl_FragColor.rgb*a, a);
        }`,
      toneMapped: true, transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true, blending: THREE.NoBlending,
    });
    this.postScene = new THREE.Scene(); this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.post));
  }

  // ---------- per-frame ----------
  setCamera({ az, el, dist, tx = 0, ty = 0, tz = 0, roll = 0, offX = 0, offY = 0, fov = 30 }) {
    const c = this.cam; c.fov = fov;
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    c.position.set(tx + dist * Math.cos(e) * Math.sin(a), ty + dist * Math.sin(e), tz + dist * Math.cos(e) * Math.cos(a));
    c.up.set(Math.sin(roll * Math.PI / 180), Math.cos(roll * Math.PI / 180), 0);
    c.lookAt(tx, ty, tz);
    c.setViewOffset(W, H, -offX, -offY, W, H); c.updateProjectionMatrix();
  }
  // pixels per world unit at the target distance
  static distFor(pxPerUnit, fov = 30) { return H / (2 * Math.tan(fov / 2 * Math.PI / 180) * pxPerUnit); }

  update(t, st) {
    // st: {mode:'layers'|'model'|'logo', sep, thick, planeFade, explode:{name:0..1}, ...}
    const ang = g.handAngles(watchTime(t));
    this.layers.visible = st.mode === 'layers' || st.planeFade > 0;
    this.model.visible = st.mode !== 'layers' && st.mode !== 'logo';
    this.logo.visible = st.mode === 'logo';
    // layers
    for (const k in this.lay) {
      const p = this.lay[k]; p.position.z = p.userData.z * st.sep + (Object.keys(this.lay).indexOf(k)) * 0.004;
      const mat = p.children[0].material;
      if (st.mode !== 'layers') { mat.opacity = st.planeFade; mat.depthTest = false; p.children[0].renderOrder = 10 + Object.keys(this.lay).indexOf(k); } else { mat.opacity = 1; mat.depthTest = true; p.children[0].renderOrder = 0; }
    }
    this.lay.hour.rotation.z = -ang.h * Math.PI / 180; this.lay.min.rotation.z = -ang.m * Math.PI / 180; this.lay.sec.rotation.z = -ang.s * Math.PI / 180;
    // model
    this.model.scale.set(1, 1, Math.max(0.02, st.thick ?? 1));
    this.hands.h.rotation.z = -ang.h * Math.PI / 180; this.hands.m.rotation.z = -ang.m * Math.PI / 180; this.hands.s.rotation.z = -ang.s * Math.PI / 180;
    for (const n in this.parts) {
      const p = this.parts[n], e = (st.explode && st.explode[n]) || 0;
      p.position.copy(p.userData.out).multiplyScalar(e);
    }
    this.balance.rotation.z = Math.sin(t * Math.PI * 2 * 4) * 1.6;
    this.rotorPiv.rotation.z = Math.sin(t * 0.9) * 1.2 + t * 0.3;
    this.gears.children.forEach((gq, i) => gq.rotation.z = t * (i % 2 ? -0.6 : 0.9) * (1 + i * 0.3));
    this.mats.lume.emissiveIntensity = st.lumeGlow || 0;
    // logo
    if (st.mode === 'logo' && st.logo) this.applyLogo(st.logo);
    this.sweep.intensity = st.sweep?.i || 0; if (st.sweep) this.sweep.position.set(st.sweep.x, st.sweep.y, st.sweep.z);
    this.scene.environmentRotation && st.envRot != null && this.scene.environmentRotation.set(0, st.envRot, 0);
  }
  applyLogo(L) {
    this.logo.position.set(L.x, L.y, 0); this.logo.scale.setScalar(L.s); this.logo.rotation.set(L.rx, L.ry, 0);
    this.logoBand.scale.set(L.band, 1, 1);
    this.tines.forEach((tn, i) => {
      const p = L.tines[i], u = tn.userData;
      u.mesh.scale.set(1, Math.max(0.001, p.h), 1); tn.rotation.z = p.spread;
      u.ball.position.set(0, u.L * p.h, 0); u.ball.scale.setScalar(Math.max(0.001, p.ball)); u.ball.visible = p.ball > 0.01;
    });
  }
  render(dof) {
    const r = this.renderer;
    this.post.uniforms.focus.value = dof?.focus ?? 6; this.post.uniforms.aperture.value = dof?.aperture ?? 0; this.post.uniforms.maxBlur.value = dof?.maxBlur ?? 12;
    r.setRenderTarget(this.rt); r.clear(); r.render(this.scene, this.cam);
    r.setRenderTarget(null); r.clear(); r.render(this.postScene, this.postCam);
    return r.domElement;
  }
  project(obj, local = new THREE.Vector3()) {
    const v = local.clone(); obj.localToWorld(v); v.project(this.cam);
    return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z];
  }
}
