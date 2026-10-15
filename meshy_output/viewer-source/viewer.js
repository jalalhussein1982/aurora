import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const stage = document.querySelector('#stage');
const status = document.querySelector('#status');
const buttons = [...document.querySelectorAll('button')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function start() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Aurora Production 3D logo. Drag to rotate, scroll or pinch to zoom. Arrow keys rotate; Home resets the view.');
  stage.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.autoRotateSpeed = 0.7;
  controls.minDistance = 2.2;
  controls.maxDistance = 15;
  controls.target.set(0, 0, 0);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.8;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe5f7ff, 0x252143, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 6);
  scene.add(key);
  const cyan = new THREE.DirectionalLight(0x72e8ff, 1.3);
  cyan.position.set(-4, 1, 2);
  scene.add(cyan);
  const violet = new THREE.DirectionalLight(0xb390ff, 1.2);
  violet.position.set(4, 1, -2);
  scene.add(violet);

  const data = document.querySelector('#model-data').textContent.trim();
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, '');
  const model = gltf.scene;
  model.name = 'Aurora Production — smooth 3D relief v2';
  const originalBox = new THREE.Box3().setFromObject(model);
  const size = originalBox.getSize(new THREE.Vector3());
  if (size.length() === 0) throw new Error('The model has no visible geometry.');
  const scale = 3.4 / Math.max(size.x, size.y, size.z);
  model.scale.multiplyScalar(scale);
  const scaledBox = new THREE.Box3().setFromObject(model);
  model.position.sub(scaledBox.getCenter(new THREE.Vector3()));
  scene.add(model);

  const materials = new Set();
  let triangles = 0;
  model.traverse(object => {
    if (!object.isMesh) return;
    (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });

  function distanceToFit() {
    const bounds = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    return Math.max(bounds.y / 2 / Math.tan(halfFov), bounds.x / 2 / (Math.tan(halfFov) * camera.aspect)) * 1.2 + bounds.z / 2;
  }
  function reset() {
    controls.autoRotate = false;
    document.querySelector('#rotate').setAttribute('aria-pressed', 'false');
    const distance = distanceToFit();
    camera.position.set(distance * 0.22, distance * 0.035, distance * 0.976);
    controls.target.set(0, 0, 0);
    controls.update();
    controls.saveState();
  }
  let previousAspect = 0;
  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!previousAspect || Math.abs(previousAspect - camera.aspect) > 0.2) reset();
    previousAspect = camera.aspect;
  }
  new ResizeObserver(resize).observe(stage);
  resize();
  reset();

  document.querySelector('#rotate').addEventListener('click', event => {
    controls.autoRotate = !controls.autoRotate;
    event.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate));
  });
  document.querySelector('#reset').addEventListener('click', reset);
  document.querySelector('#wireframe').addEventListener('click', event => {
    const enabled = event.currentTarget.getAttribute('aria-pressed') !== 'true';
    materials.forEach(material => { material.wireframe = enabled; });
    event.currentTarget.setAttribute('aria-pressed', String(enabled));
  });
  document.querySelector('#save').addEventListener('click', () => {
    renderer.render(scene, camera);
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'aurora-logo-3d.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, 'image/png');
  });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Home') { event.preventDefault(); reset(); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-'].includes(event.key)) return;
    event.preventDefault();
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    if (event.key === 'ArrowLeft') spherical.theta -= 0.12;
    if (event.key === 'ArrowRight') spherical.theta += 0.12;
    if (event.key === 'ArrowUp') spherical.phi -= 0.12;
    if (event.key === 'ArrowDown') spherical.phi += 0.12;
    if (event.key === '+' || event.key === '=') spherical.radius *= 0.9;
    if (event.key === '-') spherical.radius *= 1.1;
    spherical.makeSafe();
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    status.hidden = false;
    status.textContent = 'The graphics connection was interrupted. Reload this file to continue.';
  });
  status.hidden = true;
  buttons.forEach(button => { button.disabled = false; });
  document.querySelector('#loading-label').textContent = 'Drag to rotate · Scroll or pinch to zoom';
  let previousTime = 0;
  renderer.setAnimationLoop(time => {
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.1) : 0;
    previousTime = time;
    controls.update(delta);
    renderer.render(scene, camera);
  });
  window.aurora3D = { renderer, scene, camera, controls, model, triangles, reset, originalSize: size.toArray() };
}

start().catch(error => {
  console.error(error);
  status.hidden = false;
  status.textContent = 'The 3D viewer could not start. Open this HTML in a recent Chrome, Edge, Firefox, or Safari browser with WebGL enabled. ' + error.message;
});
