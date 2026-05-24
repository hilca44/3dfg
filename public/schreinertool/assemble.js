/* =========================================================
   C3CAD ASSEMBLE – browser first
   - rendert A aus URL
   - nutzt Server-Projektberechnung (kein test-geo)
   - nullpunkt flb
========================================================= */

import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js"
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js"
import { Proj } from "./proj-client.js"

/* ---------------------------------------------------------
   THREE globals
--------------------------------------------------------- */
let scene, camera, renderer, controls
let animating = false

/* ---------------------------------------------------------
   init renderer
--------------------------------------------------------- */
function initRenderer() {
  const box = document.getElementById("view")
  box.innerHTML = ""

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)

  camera = new THREE.PerspectiveCamera(
    45,
    box.clientWidth / box.clientHeight,
    1,
    5000
  )
  camera.position.set(180, -220, 160)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(box.clientWidth, box.clientHeight)
  box.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)

  scene.add(new THREE.AmbientLight(0xffffff, 0.6))

  const dl = new THREE.DirectionalLight(0xffffff, 0.6)
  dl.position.set(300, -300, 400)
  scene.add(dl)

  /* boden */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  )
  ground.rotation.x = Math.PI / 2
  scene.add(ground)

  if (!animating) {
    animating = true
    animate()
  }
}

/* ---------------------------------------------------------
   render loop
--------------------------------------------------------- */
function animate() {
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}

/* ---------------------------------------------------------
   decode t= aus URL (_S_)
--------------------------------------------------------- */
function decodeT(url) {
  const m = url.match(/[?&]t=([^&]+)/)
  if (!m) return ""
  return decodeURIComponent(m[1]).replace(/_S_/g, " ")
}

/* ---------------------------------------------------------
   RENDER A AUS URL (ECHT)
--------------------------------------------------------- */
window.renderSingleFromUrl = function () {
  initRenderer()

  const url = document.getElementById("baseA").value.trim()
  if (!url) return

  const t = decodeT(url)
  if (!t) {
    alert("keine gültige t= url")
    return
  }

  /* ---- echtes C3CAD ---- */
  const proj = new Proj(t)

  /*
     WICHTIG:
     proj.drawproj() ist das,
     was auch dein Editor benutzt.
  */
  const group = proj.drawproj()

  scene.add(group)

  /* fokus auf bbox */
  const box3 = new THREE.Box3().setFromObject(group)
  const size = box3.getSize(new THREE.Vector3())
  const center = box3.getCenter(new THREE.Vector3())

  controls.target.copy(center)
  camera.position.set(
    center.x + size.x * 1.5,
    center.y - size.y * 1.8,
    center.z + size.z * 1.5
  )
  controls.update()
}
