import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

let scene, camera, renderer;

export function init3D() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 5000);
  camera.position.set(300, 300, 300);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambient);

  const light = new THREE.DirectionalLight(0xffffff, 1.35);
  light.position.set(300, 500, 700);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.camera.left = -1200;
  light.shadow.camera.right = 1200;
  light.shadow.camera.top = 1200;
  light.shadow.camera.bottom = -1200;
  light.shadow.camera.near = 10;
  light.shadow.camera.far = 2500;
  scene.add(light);

  const shadowFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(3000, 3000),
    new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.18 })
  );
  shadowFloor.name = "shadowFloor";
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

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
    obj.type === "GridHelper" || obj.type === "DirectionalLight" ||
    obj.type === "AmbientLight" || obj.name === "shadowFloor"
  );
}

export function addBox(b) {
  const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
  const mat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.position.set(
    b.x + b.w / 2,
    b.z + b.h / 2,
    b.y + b.d / 2
  );

  scene.add(mesh);
}
