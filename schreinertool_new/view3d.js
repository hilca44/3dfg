import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

let scene, camera, renderer;

export function init3D() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
  camera.position.set(300, 300, 300);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(300, 500, 300);
  scene.add(light);

  const grid = new THREE.GridHelper(1000, 20);
  scene.add(grid);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

export function clearScene() {
  scene.children = scene.children.filter(obj =>
    obj.type === "GridHelper" || obj.type === "DirectionalLight"
  );
}

export function addBox(b) {
  const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const mesh = new THREE.Mesh(geo, mat);

  mesh.position.set(
    b.x + b.w / 2,
    b.z + b.h / 2,
    b.y + b.d / 2
  );

  scene.add(mesh);
}