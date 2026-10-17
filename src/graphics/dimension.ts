import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import type { Quality } from '../quality'
import { clampParams, type Arrangement, type Mode3D, type Params3D } from './params3d'

// Quality changes real cost: resolution, particle/instance budgets and the (expensive) bloom pass.
const CFG: Record<Quality, { dpr: number; nebula: number; kinetic: number; bloom: boolean }> = {
  performance: { dpr: 1, nebula: 3000, kinetic: 90, bloom: false },
  balanced: { dpr: 1.5, nebula: 9000, kinetic: 220, bloom: false },
  high: { dpr: 2, nebula: 20000, kinetic: 400, bloom: true },
}
const CAMERA: Record<Mode3D, [number, number, number]> = { sculpture: [0, 0, 12], nebula: [0, 6, 14], kinetic: [0, 3, 11] }
const GA = 2.399963 // golden angle
const hsl = (h: number, s: number, l: number) => new THREE.Color().setHSL((((h % 360) + 360) % 360) / 360, s, l)

/** One 3D experience: owns its objects and frees them in dispose(). */
interface Part {
  root: THREE.Object3D
  update(t: number, p: Params3D, pointer: THREE.Vector3 | null, viewportH: number): void
  dispose(): void
}

interface Ring { pivot: THREE.Group; sat: THREE.Mesh; r: number; rx: number; ry: number; sx: number; sy: number; ph: number }

function buildSculpture(): Part {
  const root = new THREE.Group(), rings: Ring[] = [], mats: THREE.MeshStandardMaterial[] = [], geos: THREE.BufferGeometry[] = []
  for (let i = 0; i < 12; i++) {
    const r = 1.4 + i * 0.55
    const g = new THREE.TorusGeometry(r, 0.035 + i * 0.004, 12, 128), sg = new THREE.SphereGeometry(0.09 + i * 0.01, 16, 12)
    const m = new THREE.MeshStandardMaterial({ metalness: 0.7, roughness: 0.25 }), sm = new THREE.MeshStandardMaterial({ metalness: 0.2, roughness: 0.3 })
    const pivot = new THREE.Group(), sat = new THREE.Mesh(sg, sm)
    pivot.add(new THREE.Mesh(g, m), sat); root.add(pivot)
    rings.push({ pivot, sat, r, rx: i * 0.5, ry: i * 0.37, sx: 0.12 + (i % 4) * 0.07, sy: 0.1 + (i % 3) * 0.06, ph: i * 1.7 })
    geos.push(g, sg); mats.push(m, sm)
  }
  const coreMat = new THREE.MeshStandardMaterial({ metalness: 0.3, roughness: 0.2, flatShading: true })
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), coreMat)
  root.add(core); geos.push(core.geometry); mats.push(coreMat)
  let lastHue = -1
  return {
    root,
    update(t, p) {
      const n = Math.round(4 + p.density * 8)
      root.scale.setScalar(p.size)
      if (p.hue !== lastHue) {
        lastHue = p.hue
        mats.forEach((m, i) => { const c = hsl(p.hue + i * 7, 0.8, 0.55); m.color.copy(c); m.emissive.copy(c) })
      }
      mats.forEach((m) => { m.emissiveIntensity = 0.15 + p.glow * 0.35 })
      rings.forEach((o, i) => {
        o.pivot.visible = i < n
        o.pivot.rotation.set(o.rx + t * o.sx, o.ry + t * o.sy, 0)
        const a = t * (0.8 + i * 0.08) + o.ph
        o.sat.position.set(Math.cos(a) * o.r, Math.sin(a) * o.r, 0) // ring lies in its local XY plane
      })
      core.rotation.y = t * 0.5
      core.scale.setScalar(0.8 + 0.12 * Math.sin(t * 2))
    },
    dispose() { geos.forEach((g) => g.dispose()); mats.forEach((m) => m.dispose()) },
  }
}

const NEBULA_VS = `
uniform float uTime; uniform float uHue; uniform float uSize; uniform float uScale; uniform vec3 uPointer;
attribute float aT; varying vec3 vColor;
vec3 hsl2rgb(vec3 c){ vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); return c.z + c.y*(rgb-0.5)*(1.0-abs(2.0*c.z-1.0)); }
void main(){
  vec3 p = position;
  float r = length(p.xz);
  float ang = uTime * 0.35 / (1.0 + r * 0.35);          // differential rotation: inner stars orbit faster
  float cs = cos(ang), sn = sin(ang);
  p.xz = mat2(cs, -sn, sn, cs) * p.xz;
  vec3 d = p - uPointer;
  p += normalize(d + vec3(0.0001)) * exp(-dot(d, d) / 4.0) * 1.6; // particles part around the pointer
  p.y += sin(uTime * 0.8 + aT * 6.2831) * 0.08;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * 0.06 * (1.5 + aT * 2.0) * uScale / -mv.z;
  vColor = hsl2rgb(vec3(fract(uHue / 360.0 + aT * 0.18 + r * 0.01), 0.85, 0.6));
}`
const NEBULA_FS = `
varying vec3 vColor;
void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vColor * a * 1.2, a); }`

function buildNebula(max: number): Part {
  const pos = new Float32Array(max * 3), rnd = new Float32Array(max)
  for (let i = 0; i < max; i++) {
    const r = Math.pow(Math.random(), 0.6) * 9 + 0.3, a = ((i % 3) / 3) * Math.PI * 2 + r * 0.55 + (Math.random() - 0.5) * 0.6
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (Math.random() - 0.5) * 1.8 * Math.exp(-r * 0.15); pos[i * 3 + 2] = Math.sin(a) * r
    rnd[i] = Math.random()
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aT', new THREE.BufferAttribute(rnd, 1))
  const mat = new THREE.ShaderMaterial({
    vertexShader: NEBULA_VS, fragmentShader: NEBULA_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uHue: { value: 260 }, uSize: { value: 1 }, uScale: { value: 400 }, uPointer: { value: new THREE.Vector3(999, 999, 999) } },
  })
  const points = new THREE.Points(geo, mat)
  points.frustumCulled = false
  const far = new THREE.Vector3(999, 999, 999)
  return {
    root: points,
    update(t, p, pt, vh) {
      const u = mat.uniforms
      u.uTime.value = t; u.uHue.value = p.hue; u.uSize.value = p.size; u.uScale.value = vh / 2
      ;(u.uPointer.value as THREE.Vector3).copy(pt ?? far)
      geo.setDrawRange(0, Math.max(100, Math.floor(max * p.density)))
    },
    dispose() { geo.dispose(); mat.dispose() },
  }
}

function buildKinetic(max: number): Part {
  const geo = new THREE.OctahedronGeometry(0.3), mat = new THREE.MeshStandardMaterial({ metalness: 0.5, roughness: 0.3 })
  const mesh = new THREE.InstancedMesh(geo, mat, max)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false
  const base = new Float32Array(max * 3), dummy = new THREE.Object3D(), tint = new THREE.Color()
  let key = '', lastHue = -1
  const layout = (a: Arrangement, n: number) => {
    const side = Math.max(1, Math.ceil(Math.cbrt(n)))
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0, z = 0
      if (a === 'grid') {
        x = ((i % side) - (side - 1) / 2) * 1.1; y = ((Math.floor(i / side) % side) - (side - 1) / 2) * 1.1; z = (Math.floor(i / (side * side)) - (side - 1) / 2) * 1.1
      } else if (a === 'spiral') {
        const r = 0.24 * Math.sqrt(i + 1), th = i * GA
        x = Math.cos(th) * r; z = Math.sin(th) * r; y = Math.sin(i * 0.12) * 0.9
      } else {
        const yy = 1 - (2 * (i + 0.5)) / n, rr = Math.sqrt(Math.max(0, 1 - yy * yy)), th = i * GA
        x = Math.cos(th) * rr * 3.6; y = yy * 3.6; z = Math.sin(th) * rr * 3.6
      }
      base[i * 3] = x; base[i * 3 + 1] = y; base[i * 3 + 2] = z
    }
  }
  return {
    root: mesh,
    update(t, p, pt) {
      const n = Math.max(12, Math.min(max, Math.floor(max * p.density)))
      const k = `${p.arrangement}|${n}`
      if (k !== key) { key = k; layout(p.arrangement, n); lastHue = -1 }
      if (p.hue !== lastHue) {
        lastHue = p.hue
        for (let i = 0; i < n; i++) mesh.setColorAt(i, tint.setHSL((((p.hue + (i / n) * 120) % 360) / 360), 0.8, 0.55))
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        mat.emissive.setHSL(p.hue / 360, 0.8, 0.25)
      }
      mat.emissiveIntensity = 0.1 + p.glow * 0.3
      const c = Math.cos(t * 0.15), s = Math.sin(t * 0.15)
      for (let i = 0; i < n; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2]
        const x = bx * c - bz * s, z = bx * s + bz * c
        let sc = p.size * (0.7 + 0.5 * Math.sin(t * 2 + Math.hypot(bx, by, bz) * 1.3 + i * 0.05)) // travelling wave
        if (pt) { const dx = x - pt.x, dy = by - pt.y, dz = z - pt.z; sc += 1.4 * Math.exp(-(dx * dx + dy * dy + dz * dz) / 3) }
        dummy.position.set(x, by + Math.sin(t + i) * 0.05, z)
        dummy.rotation.set(t * 0.6 + i * 0.1, t * 0.4 + i * 0.07, 0)
        dummy.scale.setScalar(Math.max(0.05, sc)); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true
    },
    dispose() { geo.dispose(); mat.dispose(); mesh.dispose() },
  }
}

/** Framework-free 3D engine: one renderer, one rAF loop, swappable experiences. Call dispose() on unmount. */
export class DimensionEngine {
  paused = false
  onAdapt: ((q: Quality) => void) | null = null // called when the frame rate forced a quality downgrade
  onError: ((e: unknown) => void) | null = null
  readonly canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
  private controls: OrbitControls
  private composer: EffectComposer | null = null
  private bloom: UnrealBloomPass | null = null
  private part: Part | null = null
  private lights: THREE.PointLight[]
  private dust: THREE.Points
  private ray = new THREE.Raycaster()
  private plane = new THREE.Plane()
  private ndc = new THREE.Vector2()
  private hit = new THREE.Vector3()
  private dir = new THREE.Vector3()
  private zero = new THREE.Vector3()
  private hasPointer = false
  private raf = 0
  private last = 0
  private t = 0
  private slow = 0
  private ro: ResizeObserver
  private reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  constructor(private host: HTMLElement, private mode: Mode3D, private quality: Quality, private params: Params3D) {
    // preserveDrawingBuffer keeps the last frame readable so PNG export works.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' })
    this.canvas = this.renderer.domElement
    host.appendChild(this.canvas)
    this.scene.background = new THREE.Color(0x080810)
    this.scene.fog = new THREE.FogExp2(0x080810, 0.018)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45))
    this.lights = [new THREE.PointLight(0xffffff, 80, 0, 2), new THREE.PointLight(0xffffff, 60, 0, 2)]
    this.lights[0].position.set(8, 6, 8); this.lights[1].position.set(-8, -5, 6)
    this.scene.add(...this.lights)
    const N = 600, pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) { // ambient dust: random points on a large shell
      const r = 12 + Math.random() * 18, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1)
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th); pos[i * 3 + 2] = r * Math.cos(ph)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.06, transparent: true, opacity: 0.55, depthWrite: false }))
    this.scene.add(this.dust)
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true; this.controls.enablePan = false; this.controls.minDistance = 4; this.controls.maxDistance = 30
    this.canvas.addEventListener('pointermove', this.onMove)
    this.canvas.addEventListener('pointerleave', this.onLeave)
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host)
    this.applyQuality(); this.build(); this.resetCamera()
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  setMode(m: Mode3D) { if (m === this.mode) return; this.mode = m; this.build(); this.resetCamera() }
  setParams(p: Partial<Params3D>) { this.params = clampParams(p) }
  setQuality(q: Quality) { if (q === this.quality) return; this.quality = q; this.applyQuality(); this.build() }
  resetCamera() {
    this.camera.position.set(...CAMERA[this.mode]); this.controls.target.set(0, 0, 0); this.controls.update()
  }
  renderNow() { this.renderFrame() }

  private applyQuality() {
    const c = CFG[this.quality]
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, c.dpr))
    this.composer?.dispose(); this.composer = null; this.bloom = null
    if (c.bloom) {
      this.composer = new EffectComposer(this.renderer)
      this.composer.addPass(new RenderPass(this.scene, this.camera))
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.6, 0.25) // real size is set by resize()
      this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass())
    }
    this.resize()
  }
  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix()
    this.composer?.setSize(w, h)
  }
  private build() {
    this.disposePart()
    const c = CFG[this.quality]
    this.part = this.mode === 'sculpture' ? buildSculpture() : this.mode === 'nebula' ? buildNebula(c.nebula) : buildKinetic(c.kinetic)
    this.scene.add(this.part.root)
  }
  private disposePart() { if (this.part) { this.scene.remove(this.part.root); this.part.dispose(); this.part = null } }
  private renderFrame() { if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera) }

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect()
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)); this.hasPointer = true
  }
  private onLeave = () => { this.hasPointer = false }

  private loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now
    if (document.hidden) return
    try { this.step(dt) } catch (e) { cancelAnimationFrame(this.raf); this.onError?.(e) }
  }
  private step(dt: number) {
    // Adaptive quality: sustained slow frames (>50 ms) step the quality down one level.
    if (dt > 0.05) this.slow++; else this.slow = Math.max(0, this.slow - 1)
    if (this.slow > 90 && this.quality !== 'performance') {
      this.slow = 0
      const next: Quality = this.quality === 'high' ? 'balanced' : 'performance'
      this.setQuality(next); this.onAdapt?.(next)
    }
    const p = this.params
    if (!this.paused) this.t += dt * p.speed * (this.reduce ? 0.3 : 1)
    this.dust.rotation.y = this.t * 0.02
    this.lights[0].color.setHSL(p.hue / 360, 0.8, 0.6); this.lights[1].color.setHSL(((p.hue + 160) % 360) / 360, 0.8, 0.6)
    this.lights[0].intensity = 80 * p.light; this.lights[1].intensity = 60 * p.light
    let pt: THREE.Vector3 | null = null
    if (this.hasPointer) { // pointer ray intersected with a plane through the origin facing the camera
      this.ray.setFromCamera(this.ndc, this.camera); this.camera.getWorldDirection(this.dir)
      this.plane.setFromNormalAndCoplanarPoint(this.dir.negate(), this.zero)
      pt = this.ray.ray.intersectPlane(this.plane, this.hit)
    }
    this.part?.update(this.t, p, pt, this.canvas.height)
    if (this.bloom) this.bloom.strength = p.glow * 0.9
    this.controls.update()
    this.renderFrame()
  }

  dispose() {
    cancelAnimationFrame(this.raf); this.ro.disconnect()
    this.canvas.removeEventListener('pointermove', this.onMove); this.canvas.removeEventListener('pointerleave', this.onLeave)
    this.disposePart(); this.controls.dispose(); this.composer?.dispose()
    this.dust.geometry.dispose(); (this.dust.material as THREE.Material).dispose()
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.canvas.remove()
  }
}
