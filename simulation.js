import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.js';

const canvas = document.getElementById('brainCanvas');
const daySlider = document.getElementById('daysSlider');
const dayValue = document.getElementById('dayValue');
const cueValue = document.getElementById('cueValue');
const baselineValue = document.getElementById('baselineValue');
const execValue = document.getElementById('execValue');
const stabilityValue = document.getElementById('stabilityValue');
const playButton = document.getElementById('playButton');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x050917, 0.11);

const camera = new THREE.PerspectiveCamera(58, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
camera.position.set(0, 0, 11);

const ambient = new THREE.AmbientLight(0x7ea8ff, 0.56);
scene.add(ambient);

const key = new THREE.PointLight(0x6be8ff, 1.35, 24);
key.position.set(5, 4, 8);
scene.add(key);

const rim = new THREE.PointLight(0xa894ff, 0.9, 24);
rim.position.set(-6, -3, -4);
scene.add(rim);

const brainGroup = new THREE.Group();
scene.add(brainGroup);

const shellGeometry = new THREE.IcosahedronGeometry(3.1, 3);
const shellMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x1e4f88,
  roughness: 0.37,
  metalness: 0.12,
  transmission: 0.5,
  thickness: 0.65,
  emissive: 0x072744,
  emissiveIntensity: 0.35,
  transparent: true,
  opacity: 0.72
});
const shell = new THREE.Mesh(shellGeometry, shellMaterial);
brainGroup.add(shell);

const nodeGeometry = new THREE.SphereGeometry(0.24, 20, 20);
const nodeSet = [];
const nodeContainer = new THREE.Group();
brainGroup.add(nodeContainer);

const lineMaterials = {
  impulsive: new THREE.LineBasicMaterial({ color: 0xff8e66, transparent: true, opacity: 0.95 }),
  balanced: new THREE.LineBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.75 }),
  control: new THREE.LineBasicMaterial({ color: 0x9fff9f, transparent: true, opacity: 0.75 })
};

const pathways = {
  impulsive: [],
  balanced: [],
  control: []
};

function makeNode(position, color) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.38,
    roughness: 0.18,
    metalness: 0.2
  });
  const node = new THREE.Mesh(nodeGeometry, mat);
  node.position.copy(position);
  nodeContainer.add(node);
  nodeSet.push(node);
  return node;
}

const centers = {
  cueHub: makeNode(new THREE.Vector3(-1.55, 0.7, 0.8), 0xff8e66),
  nucleusCore: makeNode(new THREE.Vector3(0.4, 0.25, 0.7), 0xffb273),
  baselineHub: makeNode(new THREE.Vector3(1.3, -0.35, 0.5), 0x7fd4ff),
  executiveHub: makeNode(new THREE.Vector3(0.2, 1.45, -0.2), 0x9fff9f),
  habitHub: makeNode(new THREE.Vector3(-0.7, -1.3, -0.6), 0xb084ff)
};

function createLine(start, end, type) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start.position, end.position]);
  const line = new THREE.Line(geometry, lineMaterials[type]);
  brainGroup.add(line);
  pathways[type].push({ line, start, end });
}

createLine(centers.cueHub, centers.nucleusCore, 'impulsive');
createLine(centers.habitHub, centers.nucleusCore, 'impulsive');
createLine(centers.nucleusCore, centers.baselineHub, 'balanced');
createLine(centers.baselineHub, centers.executiveHub, 'balanced');
createLine(centers.executiveHub, centers.cueHub, 'control');
createLine(centers.executiveHub, centers.habitHub, 'control');

const pulseGeometry = new THREE.SphereGeometry(0.13, 16, 16);
const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pulses = [];
for (let i = 0; i < 15; i += 1) {
  const mesh = new THREE.Mesh(pulseGeometry, pulseMaterial.clone());
  mesh.visible = false;
  brainGroup.add(mesh);
  pulses.push({ mesh, active: false, type: 'impulsive', progress: 0, speed: 0.01, path: null });
}

let pulseCursor = 0;
let running = true;
let timelineDays = Number(daySlider.value);

function normalizedTime(days) {
  return THREE.MathUtils.clamp((days - 1) / 179, 0, 1);
}

function stateFromDays(days) {
  const t = normalizedTime(days);
  return {
    cueReactivity: 1 - 0.78 * t,
    baselineSatisfaction: 0.22 + 0.7 * t,
    executiveRegulation: 0.27 + 0.66 * t,
    rewardStability: 0.18 + 0.77 * t
  };
}

function updateHUD(state) {
  dayValue.textContent = String(timelineDays);
  cueValue.textContent = `${Math.round(state.cueReactivity * 100)}%`;
  baselineValue.textContent = `${Math.round(state.baselineSatisfaction * 100)}%`;
  execValue.textContent = `${Math.round(state.executiveRegulation * 100)}%`;
  stabilityValue.textContent = `${Math.round(state.rewardStability * 100)}%`;
}

function spawnPulse(type) {
  const pool = pathways[type];
  const path = pool[Math.floor(Math.random() * pool.length)];
  const pulse = pulses[pulseCursor % pulses.length];
  pulseCursor += 1;

  pulse.active = true;
  pulse.type = type;
  pulse.path = path;
  pulse.progress = 0;
  pulse.speed = type === 'impulsive' ? 0.016 : type === 'control' ? 0.012 : 0.01;
  pulse.mesh.visible = true;

  const colorMap = {
    impulsive: 0xff8e66,
    balanced: 0x8fdbff,
    control: 0xb5ffb5
  };
  pulse.mesh.material.color.setHex(colorMap[type]);
}

function updatePathways(state) {
  const impulsiveOpacity = THREE.MathUtils.lerp(0.95, 0.25, normalizedTime(timelineDays));
  const balancedOpacity = THREE.MathUtils.lerp(0.45, 0.9, normalizedTime(timelineDays));
  const controlOpacity = THREE.MathUtils.lerp(0.35, 0.95, normalizedTime(timelineDays));

  lineMaterials.impulsive.opacity = impulsiveOpacity;
  lineMaterials.balanced.opacity = balancedOpacity;
  lineMaterials.control.opacity = controlOpacity;

  centers.cueHub.material.emissiveIntensity = 0.2 + state.cueReactivity * 0.72;
  centers.nucleusCore.material.emissiveIntensity = 0.3 + (state.cueReactivity + state.baselineSatisfaction) * 0.28;
  centers.baselineHub.material.emissiveIntensity = 0.22 + state.baselineSatisfaction * 0.8;
  centers.executiveHub.material.emissiveIntensity = 0.25 + state.executiveRegulation * 0.9;
  centers.habitHub.material.emissiveIntensity = 0.2 + (1 - state.rewardStability) * 0.36;
}

function animatePulses() {
  pulses.forEach((pulse) => {
    if (!pulse.active || !pulse.path) {
      return;
    }

    pulse.progress += pulse.speed;
    if (pulse.progress > 1) {
      pulse.active = false;
      pulse.mesh.visible = false;
      return;
    }

    const pos = new THREE.Vector3().lerpVectors(
      pulse.path.start.position,
      pulse.path.end.position,
      pulse.progress
    );
    pulse.mesh.position.copy(pos);
  });
}

let pulseTimer = 0;
const clock = new THREE.Clock();

function tick() {
  const dt = clock.getDelta();
  pulseTimer += dt;

  const state = stateFromDays(timelineDays);
  updateHUD(state);
  updatePathways(state);

  if (running) {
    const impulsiveRate = THREE.MathUtils.lerp(0.08, 0.28, normalizedTime(timelineDays));
    const controlRate = THREE.MathUtils.lerp(0.28, 0.08, normalizedTime(timelineDays));
    const balancedRate = 0.22;

    while (pulseTimer > 0.06) {
      pulseTimer -= 0.06;
      const chance = Math.random();
      if (chance < controlRate) {
        spawnPulse('impulsive');
      } else if (chance < controlRate + balancedRate) {
        spawnPulse('balanced');
      } else if (chance < controlRate + balancedRate + impulsiveRate) {
        spawnPulse('control');
      }
    }

    shell.rotation.y += 0.002;
    shell.rotation.x += 0.0012;
    nodeContainer.rotation.y -= 0.0012;
    brainGroup.rotation.y += 0.001;
  }

  animatePulses();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

function handleResize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', handleResize);

daySlider.addEventListener('input', (event) => {
  timelineDays = Number(event.target.value);
});

playButton.addEventListener('click', () => {
  running = !running;
  playButton.textContent = running ? 'Pause Animation' : 'Resume Animation';
});

updateHUD(stateFromDays(timelineDays));
handleResize();
tick();
