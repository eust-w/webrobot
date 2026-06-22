import * as CANNON from "cannon-es";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { getLanguage, LANGUAGE_OPTIONS, setLanguage, t } from "./i18n.js";
import "./style.css";

const stage = document.getElementById("stage");
const RENDER_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, 1.25);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(RENDER_PIXEL_RATIO);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1;
stage.appendChild(renderer.domElement);

const publicBaseUrl = new URL(import.meta.env.BASE_URL, window.location.href);
function assetUrl(path) {
  return new URL(path.replace(/^\/+/, ""), publicBaseUrl).toString();
}

const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const hdrLoader = new HDRLoader();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnvironment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
let glasshouseEnvironment = null;
hdrLoader.load(assetUrl("hdris/polyhaven/glasshouse_interior/glasshouse_interior_1k.hdr"), (texture) => {
  glasshouseEnvironment = pmremGenerator.fromEquirectangular(texture).texture;
  texture.dispose();
  stage.dataset.hdriReady = "true";
  if (state.sceneMode === "rich") scene.environment = glasshouseEnvironment;
});

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none";
stage.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf1f3ee);
scene.fog = new THREE.Fog(0xf1f3ee, 18, 42);

const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.05, 100);
camera.position.set(6.8, 4.2, 7.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.78, 0);
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 2.4;
controls.maxDistance = 18;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const mouseDown = new THREE.Vector2();
const bootTime = performance.now();
let lastFrameTime = bootTime;

const mat = {
  floor: new THREE.MeshStandardMaterial({ color: 0xdedfd7, roughness: 0.78, metalness: 0.02 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xf4f1e9, roughness: 0.82 }),
  rug: new THREE.MeshStandardMaterial({ color: 0x6f8f86, roughness: 0.88 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x9c7554, roughness: 0.52, metalness: 0.05 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x4c4238, roughness: 0.58, metalness: 0.04 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x6f7e84, roughness: 0.92 }),
  fabricLight: new THREE.MeshStandardMaterial({ color: 0xb7c2bd, roughness: 0.9 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x737d79, roughness: 0.42, metalness: 0.45 }),
  robotWhite: new THREE.MeshStandardMaterial({ color: 0xf4f6ef, roughness: 0.45, metalness: 0.2 }),
  robotBlack: new THREE.MeshStandardMaterial({ color: 0x151a1a, roughness: 0.52, metalness: 0.12 }),
  joint: new THREE.MeshStandardMaterial({ color: 0x2b3130, roughness: 0.38, metalness: 0.25 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x9fd7ce,
    roughness: 0.1,
    metalness: 0,
    transparent: true,
    opacity: 0.34,
    transmission: 0.35
  })
};

const richTextures = createRichTextures();
const pbrTextures = createPbrTextures();
const objectTextures = createObjectTextures();
const surfaceMaps = createSurfaceMaps();
const richOnlyObjects = [];
const simpleOnlyObjects = [];
const richFurnitureFallbacks = {
  coffeeTable: [],
  sofa: []
};
const contactShadowTexture = makeContactShadowTexture();
const richAssetModels = {
  pottedPlant: null,
  pottedPlantLoading: false,
  coffeeTable: null,
  coffeeTableLoading: false,
  sofa: null,
  sofaLoading: false,
  gamepad: null,
  gamepadLoading: false,
  brassGoblets: null,
  brassGobletsLoading: false,
  football: null,
  footballLoading: false
};
const modelBounds = new THREE.Box3();
const modelSize = new THREE.Vector3();
const modelCenter = new THREE.Vector3();
const SOFA_POSITION = new THREE.Vector3(-5.32, 0.6, -0.92);
const SOFA_SIZE = new THREE.Vector3(3.08, 1.16, 1.14);
const COFFEE_TABLE_POSITION = new THREE.Vector3(-0.4, 0.31, -0.55);
const COFFEE_TABLE_SIZE = new THREE.Vector3(2.2, 0.16, 1.05);

const richMat = {
  cupCeramic: new THREE.MeshPhysicalMaterial({ color: 0xe9fff8, roughness: 0.24, metalness: 0.02, clearcoat: 0.82, clearcoatRoughness: 0.18 }),
  cupCoffee: new THREE.MeshStandardMaterial({ color: 0x3a2115, roughness: 0.52, metalness: 0.02 }),
  remoteRubber: new THREE.MeshStandardMaterial({ color: 0x1e262b, roughness: 0.64, metalness: 0.08 }),
  remoteButton: new THREE.MeshStandardMaterial({ color: 0xdce4e7, roughness: 0.38, metalness: 0.02 }),
  bookPages: new THREE.MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.78, metalness: 0.01 }),
  bookPagesPbr: new THREE.MeshStandardMaterial({ color: 0xf4ead7, roughness: 0.86, metalness: 0.01, map: pbrTextures.bookPages.map }),
  bookCoverPbr: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.7,
    metalness: 0.01,
    map: pbrTextures.bookCover.map,
    normalMap: pbrTextures.bookCover.normalMap,
    roughnessMap: pbrTextures.bookCover.roughnessMap,
    normalScale: new THREE.Vector2(0.55, 0.55),
    side: THREE.DoubleSide
  }),
  bookLine: new THREE.MeshStandardMaterial({ color: 0x7d5d46, roughness: 0.82, metalness: 0.01 }),
  plantLeaf: new THREE.MeshPhysicalMaterial({ color: 0x2f7c45, roughness: 0.44, metalness: 0.03, clearcoat: 0.36, clearcoatRoughness: 0.28 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x302116, roughness: 0.9, metalness: 0.01 }),
  ballStripe: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.02, clearcoat: 0.78, clearcoatRoughness: 0.18 }),
  robotPanel: new THREE.MeshPhysicalMaterial({ color: 0xe7ece7, roughness: 0.28, metalness: 0.32, clearcoat: 0.62, clearcoatRoughness: 0.18 }),
  robotRubber: new THREE.MeshStandardMaterial({ color: 0x101313, roughness: 0.7, metalness: 0.06 }),
  robotScrew: new THREE.MeshStandardMaterial({ color: 0x59605e, roughness: 0.38, metalness: 0.72 }),
  robotLens: new THREE.MeshPhysicalMaterial({ color: 0x58d0ff, roughness: 0.12, metalness: 0.02, transparent: true, opacity: 0.72, emissive: 0x143b55, emissiveIntensity: 0.7, clearcoat: 0.8, clearcoatRoughness: 0.08 }),
  robotLed: new THREE.MeshBasicMaterial({ color: 0x5ff5d6, transparent: true, opacity: 0.82 }),
  curtain: new THREE.MeshStandardMaterial({ color: 0xd7d2c1, roughness: 0.92, metalness: 0.01, transparent: true, opacity: 0.76, side: THREE.DoubleSide }),
  frame: new THREE.MeshStandardMaterial({ color: 0x2c2722, roughness: 0.45, metalness: 0.08 }),
  matBoard: new THREE.MeshStandardMaterial({ color: 0xe8dfcf, roughness: 0.84, metalness: 0.01 }),
  rugFringe: new THREE.MeshStandardMaterial({ color: 0xd9cfb7, roughness: 0.96, metalness: 0.01 }),
  warmBulb: new THREE.MeshBasicMaterial({ color: 0xffd49a }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb78345, roughness: 0.34, metalness: 0.72 })
};

const SPEED_CONFIG = {
  min: 0.65,
  default: 1.35,
  max: 2,
  taskMultiplier: 1.06,
  sceneScale: 1.85,
  nominalStepLength: 0.46,
  turnStepRadius: 0.16,
  turnRate: 2.25,
  humanoidVisualGaitRatio: 0.42,
  humanoidSideStepRatio: 0
};
const AUTO_FACE_CONFIG = {
  turnRate: 0.8,
  minFrameStep: 0.006,
  maxFrameStep: 0.026,
  settleAngle: 0.025
};
const HUMANOID_SQUAT_CONFIG = {
  hipPitch: -0.5,
  kneePitch: 0.74,
  anklePitch: -0.32,
  rootDrop: 0.16
};
const NAV_CONFIG = {
  minX: -9.35,
  maxX: 9.35,
  minZ: -6.35,
  maxZ: 6.35,
  cellSize: 0.3,
  clearance: 0.58,
  obstacleMargin: 0.2,
  waypointReach: 0.34,
  turnSlowdownAngle: 0.78,
  turnStopAngle: 1.18
};
const ROBOT_MODEL_SOURCE = "URDF 导入模型";
const SHOW_PROCEDURAL_ROBOT_FALLBACK = false;
const ROBOT_FORWARD_YAW_OFFSET = -Math.PI / 2;
const ROBOT_VARIANTS = {
  "g1-29dof": {
    id: "g1-29dof",
    name: "Humanoid 29DOF Preset",
    profile: "Unitree G1 29DOF URDF / 1320mm 级",
    badge: "H29",
    kind: "humanoid",
    armCapable: true,
    waistLocked: false,
    heightScale: 1,
    torsoWidth: 1,
    depthScale: 1,
    shoulderWidth: 1,
    hipWidth: 1,
    limbScale: 1,
    footWidth: 1,
    footLength: 1,
    color: 0xe8eeea,
    accent: 0x151a1a,
    lens: 0x58d0ff
  },
  "g1-23dof": {
    id: "g1-23dof",
    name: "Humanoid 23DOF Preset",
    profile: "通用人形 23DOF 固腰近似 / 1320mm 级",
    badge: "H23",
    kind: "humanoid",
    armCapable: true,
    waistLocked: true,
    heightScale: 0.97,
    torsoWidth: 0.94,
    depthScale: 0.96,
    shoulderWidth: 0.94,
    hipWidth: 0.94,
    limbScale: 0.96,
    footWidth: 0.96,
    footLength: 0.98,
    color: 0xf0f4f0,
    accent: 0x202626,
    lens: 0x7cc8ff
  },
  "g1-dual-arm": {
    id: "g1-dual-arm",
    name: "Dual-arm Humanoid Preset",
    profile: "通用双臂人形操作近似 / 灵巧手轮廓",
    badge: "DA",
    kind: "humanoid",
    armCapable: true,
    waistLocked: false,
    heightScale: 1.03,
    torsoWidth: 1.08,
    depthScale: 1.04,
    shoulderWidth: 1.13,
    hipWidth: 1.02,
    limbScale: 1.05,
    footWidth: 1.04,
    footLength: 1.06,
    color: 0xe1e7e5,
    accent: 0x111616,
    lens: 0x4ff0d4
  },
  "h1-humanoid": {
    id: "h1-humanoid",
    name: "Full-size Humanoid Preset",
    profile: "通用全尺寸人形近似 / 1805mm 级",
    badge: "FH",
    kind: "humanoid",
    armCapable: true,
    waistLocked: false,
    heightScale: 1.24,
    torsoWidth: 1.18,
    depthScale: 1.05,
    shoulderWidth: 1.22,
    hipWidth: 1.08,
    limbScale: 1.18,
    footWidth: 1.12,
    footLength: 1.18,
    bodyCenterY: 0.9,
    collisionHalfExtents: new THREE.Vector3(0.34, 0.92, 0.29),
    color: 0xe6ebe8,
    accent: 0x101615,
    lens: 0x6bdfff
  },
  "r1-humanoid": {
    id: "r1-humanoid",
    name: "Lightweight Humanoid Preset",
    profile: "通用轻量人形近似 / 1230mm 级",
    badge: "LH",
    kind: "humanoid",
    armCapable: true,
    waistLocked: false,
    heightScale: 0.93,
    torsoWidth: 0.86,
    depthScale: 0.9,
    shoulderWidth: 0.88,
    hipWidth: 0.9,
    limbScale: 0.9,
    footWidth: 0.88,
    footLength: 0.9,
    bodyCenterY: 0.66,
    collisionHalfExtents: new THREE.Vector3(0.24, 0.64, 0.22),
    color: 0xf1f4f0,
    accent: 0x202625,
    lens: 0x8fe8ff
  },
  "go1-quadruped": {
    id: "go1-quadruped",
    name: "Compact Quadruped Preset",
    profile: "通用紧凑四足近似 / 645x280x400mm 级",
    badge: "CQ",
    kind: "quadruped",
    armCapable: false,
    heightScale: 0.68,
    torsoWidth: 0.94,
    depthScale: 0.92,
    shoulderWidth: 0.94,
    hipWidth: 0.94,
    limbScale: 0.94,
    footWidth: 0.9,
    footLength: 0.9,
    bodyWidth: 0.3,
    bodyHeight: 0.2,
    bodyLength: 0.66,
    legSpreadX: 0.21,
    legSpreadZ: 0.25,
    legScale: 0.92,
    bodyCenterY: 0.42,
    hasLidar: false,
    wheelRadius: 0,
    collisionHalfExtents: new THREE.Vector3(0.28, 0.25, 0.39),
    color: 0xf0f2ec,
    accent: 0x181c1b,
    lens: 0x69dbff
  },
  "go2-quadruped": {
    id: "go2-quadruped",
    name: "Agile Quadruped Preset",
    profile: "Unitree Go2 URDF / 700x310x400mm 级",
    badge: "AQ",
    kind: "quadruped",
    armCapable: false,
    heightScale: 0.72,
    torsoWidth: 1,
    depthScale: 1,
    shoulderWidth: 1,
    hipWidth: 1,
    limbScale: 1,
    footWidth: 1,
    footLength: 1,
    bodyWidth: 0.34,
    bodyHeight: 0.22,
    bodyLength: 0.76,
    legSpreadX: 0.23,
    legSpreadZ: 0.28,
    legScale: 1,
    bodyCenterY: 0.46,
    hasLidar: true,
    wheelRadius: 0,
    collisionHalfExtents: new THREE.Vector3(0.32, 0.28, 0.46),
    color: 0xe8ece7,
    accent: 0x151a1a,
    lens: 0x52e1ff
  },
  "aliengo-quadruped": {
    id: "aliengo-quadruped",
    name: "Industrial Quadruped Preset",
    profile: "通用工业四足近似 / 650x310x600mm 级",
    badge: "IQ",
    kind: "quadruped",
    armCapable: false,
    heightScale: 0.78,
    torsoWidth: 1.02,
    depthScale: 0.98,
    shoulderWidth: 1.03,
    hipWidth: 1.02,
    limbScale: 1.05,
    footWidth: 1.02,
    footLength: 1.08,
    bodyWidth: 0.34,
    bodyHeight: 0.24,
    bodyLength: 0.72,
    legSpreadX: 0.24,
    legSpreadZ: 0.28,
    legScale: 1.08,
    bodyCenterY: 0.5,
    hasLidar: true,
    wheelRadius: 0,
    collisionHalfExtents: new THREE.Vector3(0.31, 0.31, 0.43),
    color: 0xe7e4de,
    accent: 0x171412,
    lens: 0x5de7ff
  },
  "b2-quadruped": {
    id: "b2-quadruped",
    name: "Heavy Quadruped Preset",
    profile: "通用重载四足近似 / 1098x450x645mm 级",
    badge: "HQ",
    kind: "quadruped",
    armCapable: false,
    heightScale: 0.84,
    torsoWidth: 1,
    depthScale: 1.08,
    shoulderWidth: 1.18,
    hipWidth: 1.12,
    limbScale: 1.12,
    footWidth: 1.18,
    footLength: 1.16,
    bodyWidth: 0.42,
    bodyHeight: 0.26,
    bodyLength: 0.92,
    legSpreadX: 0.29,
    legSpreadZ: 0.34,
    legScale: 1.14,
    bodyCenterY: 0.5,
    hasLidar: false,
    wheelRadius: 0,
    collisionHalfExtents: new THREE.Vector3(0.39, 0.31, 0.55),
    color: 0xdfe6e4,
    accent: 0x111716,
    lens: 0x7cc8ff
  },
  "b2w-quadruped": {
    id: "b2w-quadruped",
    name: "Wheeled Quadruped Preset",
    profile: "通用轮足四足近似 / 1098x550x758mm 级",
    badge: "WQ",
    kind: "quadruped",
    armCapable: false,
    heightScale: 0.92,
    torsoWidth: 1.15,
    depthScale: 1.12,
    shoulderWidth: 1.28,
    hipWidth: 1.2,
    limbScale: 1.2,
    footWidth: 1.22,
    footLength: 1.18,
    bodyWidth: 0.48,
    bodyHeight: 0.3,
    bodyLength: 0.98,
    legSpreadX: 0.33,
    legSpreadZ: 0.36,
    legScale: 1.22,
    bodyCenterY: 0.58,
    hasLidar: true,
    wheelRadius: 0.085,
    collisionHalfExtents: new THREE.Vector3(0.44, 0.36, 0.6),
    color: 0xd9e2df,
    accent: 0x0f1514,
    lens: 0x86d9ff
  },
  "mobile-base": {
    id: "mobile-base",
    name: "Autonomous Mobile Base Preset",
    profile: "通用 AMR 移动底盘近似 / 650x520mm 级",
    badge: "AMR",
    kind: "mobile",
    armCapable: false,
    mobileStyle: "mecanum",
    mobileWidth: 0.62,
    mobileLength: 0.74,
    mobileHeight: 0.22,
    mobileDeckY: 0.28,
    mobileMastHeight: 0.18,
    mobileArmLayout: "none",
    bodyCenterY: 0.32,
    collisionHalfExtents: new THREE.Vector3(0.42, 0.32, 0.48),
    color: 0xe5ece8,
    accent: 0x151b1a,
    lens: 0x5ed8ff
  },
  "mobile-single-arm": {
    id: "mobile-single-arm",
    name: "Mobile Manipulator Preset",
    profile: "通用移动单臂操作平台 / AMR + 6DOF 臂",
    badge: "M1",
    kind: "mobile",
    armCapable: true,
    mobileStyle: "mecanum",
    mobileWidth: 0.66,
    mobileLength: 0.82,
    mobileHeight: 0.24,
    mobileDeckY: 0.3,
    mobileMastHeight: 0.64,
    mobileArmLayout: "right",
    mobileArmY: 0.92,
    mobileArmZ: -0.12,
    mobileArmScale: 1.08,
    bodyCenterY: 0.42,
    collisionHalfExtents: new THREE.Vector3(0.44, 0.44, 0.52),
    color: 0xe8eee9,
    accent: 0x131918,
    lens: 0x62e5ff
  },
  "mobile-dual-arm": {
    id: "mobile-dual-arm",
    name: "Mobile Dual-arm Preset",
    profile: "通用移动双臂操作平台 / 双臂抓取与放置",
    badge: "M2",
    kind: "mobile",
    armCapable: true,
    mobileStyle: "omni",
    mobileWidth: 0.76,
    mobileLength: 0.88,
    mobileHeight: 0.26,
    mobileDeckY: 0.32,
    mobileMastHeight: 0.72,
    mobileArmLayout: "dual",
    mobileArmOffsetX: 0.23,
    mobileArmY: 0.96,
    mobileArmZ: -0.13,
    mobileArmScale: 1.04,
    bodyCenterY: 0.46,
    collisionHalfExtents: new THREE.Vector3(0.48, 0.5, 0.56),
    color: 0xe0e9e6,
    accent: 0x111817,
    lens: 0x78dbff
  },
  "cobot-arm": {
    id: "cobot-arm",
    name: "Collaborative Arm Preset",
    profile: "通用协作机械臂近似 / 桌面与固定工位",
    badge: "CO",
    kind: "mobile",
    armCapable: true,
    mobileStyle: "station",
    mobileWidth: 0.5,
    mobileLength: 0.5,
    mobileHeight: 0.16,
    mobileDeckY: 0.22,
    mobileMastHeight: 0.46,
    mobileArmLayout: "right",
    mobileArmY: 0.78,
    mobileArmZ: -0.04,
    mobileArmScale: 1.22,
    bodyCenterY: 0.34,
    collisionHalfExtents: new THREE.Vector3(0.34, 0.42, 0.34),
    color: 0xf2f4ef,
    accent: 0x161b1a,
    lens: 0x6ee8ff
  },
  "tracked-rescue": {
    id: "tracked-rescue",
    name: "Tracked Inspection Preset",
    profile: "通用履带巡检平台近似 / 低矮越障底盘",
    badge: "TRK",
    kind: "mobile",
    armCapable: false,
    mobileStyle: "tracked",
    mobileWidth: 0.72,
    mobileLength: 0.92,
    mobileHeight: 0.2,
    mobileDeckY: 0.26,
    mobileMastHeight: 0.38,
    mobileArmLayout: "none",
    bodyCenterY: 0.31,
    collisionHalfExtents: new THREE.Vector3(0.46, 0.32, 0.58),
    color: 0xdde5e2,
    accent: 0x101716,
    lens: 0x89dfff
  }
};
const ROBOT_URDF_PACKAGES = {
  g1_description: assetUrl("robots/urdf/unitree/g1_description"),
  r1_description: assetUrl("robots/urdf/unitree/r1_description"),
  go2_description: assetUrl("robots/urdf/unitree/go2_description")
};
let urdfLoaderPromise = null;

function getUrdfLoader() {
  if (!urdfLoaderPromise) {
    urdfLoaderPromise = import("urdf-loader").then(({ default: URDFLoader }) => {
      const loader = new URDFLoader();
      loader.packages = ROBOT_URDF_PACKAGES;
      return loader;
    });
  }
  return urdfLoaderPromise;
}

function disposeObject3D(root) {
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value?.isTexture) value.dispose();
      }
      material.dispose?.();
    }
  });
}

const ROBOT_URDF_ASSETS = {
  "g1-29dof": {
    path: "robots/urdf/unitree/g1_description/g1_29dof.urdf",
    source: "Unitree G1 官方 URDF / g1_29dof",
    scale: 1,
    kind: "humanoid"
  },
  "g1-23dof": {
    path: "robots/urdf/unitree/g1_description/g1_23dof.urdf",
    source: "Unitree G1 官方 URDF / g1_23dof",
    scale: 1,
    kind: "humanoid"
  },
  "g1-dual-arm": {
    path: "robots/urdf/unitree/g1_description/g1_29dof.urdf",
    source: "Unitree G1 官方 URDF / g1_29dof 双臂",
    scale: 1.02,
    kind: "humanoid"
  },
  "h1-humanoid": {
    path: "robots/urdf/unitree/g1_description/g1_29dof.urdf",
    source: "Unitree G1 官方 URDF / 全尺寸缩放显示",
    scale: 1.18,
    kind: "humanoid"
  },
  "r1-humanoid": {
    path: "robots/urdf/unitree/r1_description/R1.urdf",
    source: "Unitree R1 官方 URDF",
    scale: 1,
    kind: "humanoid"
  },
  "go1-quadruped": {
    path: "robots/urdf/unitree/go2_description/go2_description.urdf",
    source: "Unitree Go2 官方 URDF / Go1 尺寸映射",
    scale: 0.9,
    kind: "quadruped"
  },
  "go2-quadruped": {
    path: "robots/urdf/unitree/go2_description/go2_description.urdf",
    source: "Unitree Go2 官方 URDF",
    scale: 1,
    kind: "quadruped"
  },
  "aliengo-quadruped": {
    path: "robots/urdf/unitree/go2_description/go2_description.urdf",
    source: "Unitree Go2 官方 URDF / Aliengo 尺寸映射",
    scale: 1.08,
    kind: "quadruped"
  },
  "b2-quadruped": {
    path: "robots/urdf/unitree/go2_description/go2_description.urdf",
    source: "Unitree Go2 官方 URDF / B2 尺寸映射",
    scale: 1.2,
    kind: "quadruped"
  },
  "b2w-quadruped": {
    path: "robots/urdf/unitree/go2_description/go2_description.urdf",
    source: "Unitree Go2 官方 URDF / B2-W 轮足交互映射",
    scale: 1.22,
    kind: "quadruped"
  },
  "mobile-base": {
    path: "robots/urdf/generic/mobile_base.urdf",
    source: "Generic AMR URDF / 本仓库",
    scale: 1,
    kind: "mobile"
  },
  "mobile-single-arm": {
    path: "robots/urdf/generic/mobile_manipulator.urdf",
    source: "Generic mobile manipulator URDF / 本仓库",
    scale: 1,
    kind: "mobile"
  },
  "mobile-dual-arm": {
    path: "robots/urdf/generic/mobile_dual_arm.urdf",
    source: "Generic dual-arm mobile URDF / 本仓库",
    scale: 1,
    kind: "mobile"
  },
  "cobot-arm": {
    path: "robots/urdf/generic/cobot_arm.urdf",
    source: "Generic collaborative arm URDF / 本仓库",
    scale: 1,
    kind: "mobile"
  },
  "tracked-rescue": {
    path: "robots/urdf/generic/tracked_inspection.urdf",
    source: "Generic tracked inspection URDF / 本仓库",
    scale: 1,
    kind: "mobile"
  }
};
const ROBOT_BODY_HALF_HEIGHT = 0.72;
const ROBOT_FOOT_VISUAL_OFFSET = 0.18;
const ROBOT_FOOT_LOCAL_Y = -0.325;
const ROBOT_FOOT_GROUND_CLEARANCE = 0.055;
const ROBOT_FOOT_DECOR_CLEARANCE = 0.044;
const ROBOT_FOOT_CLEARANCE_SLOP = 0.003;
const ROBOT_FOOT_LIFT_RELEASE_SPEED = 1.4;
const ROBOT_VISUAL_GROUND_LAYERS = [
  { name: "rug", type: "box", minX: -2.6, maxX: 3.0, minZ: -1.5, maxZ: 1.9, y: 0.03 },
  { name: "rug-border", type: "box", minX: -2.75, maxX: 3.15, minZ: -1.65, maxZ: 2.05, y: 0.034 },
  { name: "home-ring", type: "ring", x: 0, z: 2.55, inner: 0.46, outer: 0.66, y: 0.03 },
  { name: "target-marker", type: "dynamic-target", inner: 0.31, outer: 0.48, y: 0.063 }
];
const robotFootBounds = new THREE.Box3();
const robotUrdfVisualBounds = new THREE.Box3();
const ROBOT_URDF_CONTACT_LINK_PATTERNS = {
  humanoid: [/foot/i, /ankle_roll_link/i, /ankle_pitch_link/i],
  quadruped: [/foot/i],
  mobile: [/wheel/i, /track/i, /^base_link$/i]
};
const UI_FRAME_UPDATE_INTERVAL_MS = 120;
let robotSurfaceLift = 0;
let lastFrameUiUpdate = 0;
const robotMotionTracker = {
  initialized: false,
  x: 0,
  z: 0,
  yaw: 0
};
const navPlannerStats = {
  status: "idle",
  reason: "",
  iterations: 0,
  expanded: 0,
  generated: 0,
  openMax: 0,
  lastPathLength: 0
};

class MinPriorityQueue {
  constructor(compare) {
    this.compare = compare;
    this.items = [];
  }

  get length() {
    return this.items.length;
  }

  push(item) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop() {
    if (!this.items.length) return null;
    const top = this.items[0];
    const tail = this.items.pop();
    if (this.items.length && tail) {
      this.items[0] = tail;
      this.sinkDown(0);
    }
    return top;
  }

  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[parent], this.items[index]) <= 0) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  sinkDown(index) {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let best = index;
      if (left < this.items.length && this.compare(this.items[left], this.items[best]) < 0) best = left;
      if (right < this.items.length && this.compare(this.items[right], this.items[best]) < 0) best = right;
      if (best === index) break;
      [this.items[index], this.items[best]] = [this.items[best], this.items[index]];
      index = best;
    }
  }
}

function createRichTextures() {
  return {
    floor: makeCanvasTexture(512, 512, 5, 4, (ctx, size) => {
      ctx.fillStyle = "#d8d8ca";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 64) {
        ctx.fillStyle = y % 128 === 0 ? "#c9c9ba" : "#e1dfd0";
        ctx.fillRect(0, y, size, 58);
        ctx.strokeStyle = "#a9ad9f";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y + 60);
        ctx.lineTo(size, y + 60);
        ctx.stroke();
      }
      for (let x = 0; x < size; x += 128) {
        ctx.strokeStyle = "rgba(92,96,84,0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 12, 0);
        ctx.lineTo(x + 12, size);
        ctx.stroke();
      }
    }),
    wall: makeCanvasTexture(512, 512, 3, 2, (ctx, size) => {
      ctx.fillStyle = "#f4efe4";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 18) {
        ctx.strokeStyle = y % 36 === 0 ? "rgba(164,150,129,0.2)" : "rgba(164,150,129,0.1)";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y + 7);
        ctx.stroke();
      }
    }),
    rug: makeCanvasTexture(512, 512, 2, 1.4, (ctx, size) => {
      ctx.fillStyle = "#66857f";
      ctx.fillRect(0, 0, size, size);
      for (let x = 0; x < size; x += 18) {
        ctx.strokeStyle = x % 36 === 0 ? "rgba(238,245,235,0.22)" : "rgba(39,70,66,0.22)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
      for (let y = 0; y < size; y += 18) {
        ctx.strokeStyle = "rgba(20,42,40,0.16)";
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
      }
    }),
    wood: makeCanvasTexture(512, 512, 2.5, 1, (ctx, size) => {
      ctx.fillStyle = "#a77854";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 14) {
        ctx.strokeStyle = y % 42 === 0 ? "rgba(66,45,30,0.32)" : "rgba(241,204,159,0.2)";
        ctx.lineWidth = y % 42 === 0 ? 2 : 1;
        ctx.beginPath();
        for (let x = 0; x <= size; x += 24) {
          const wobble = Math.sin((x + y) * 0.035) * 5;
          if (x === 0) ctx.moveTo(x, y + wobble);
          else ctx.lineTo(x, y + wobble);
        }
        ctx.stroke();
      }
    }),
    darkWood: makeCanvasTexture(512, 512, 2.2, 1, (ctx, size) => {
      ctx.fillStyle = "#4c4136";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 16) {
        ctx.strokeStyle = y % 48 === 0 ? "rgba(20,16,13,0.38)" : "rgba(144,116,84,0.24)";
        ctx.beginPath();
        ctx.moveTo(0, y + Math.sin(y * 0.05) * 4);
        ctx.lineTo(size, y + Math.cos(y * 0.05) * 4);
        ctx.stroke();
      }
    }),
    fabric: makeCanvasTexture(512, 512, 2.5, 2.5, (ctx, size) => {
      ctx.fillStyle = "#718187";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < size; i += 10) {
        ctx.strokeStyle = i % 20 === 0 ? "rgba(231,236,229,0.14)" : "rgba(35,43,43,0.18)";
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
    }),
    fabricLight: makeCanvasTexture(512, 512, 2.5, 2.5, (ctx, size) => {
      ctx.fillStyle = "#b7c5be";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < size; i += 12) {
        ctx.strokeStyle = i % 24 === 0 ? "rgba(255,255,255,0.2)" : "rgba(75,95,87,0.16)";
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }
    })
  };
}

function createPbrTextures() {
  const floorBase = assetUrl("textures/polyhaven/laminate_floor_02/");
  const wallBase = assetUrl("textures/polyhaven/beige_wall_001/");
  const fabricBase = assetUrl("textures/polyhaven/fabric_pattern_07/");
  const sofaBase = assetUrl("textures/polyhaven/wool_boucle/");
  const rugBase = assetUrl("textures/ambientcg/carpet016/");
  const bookBase = assetUrl("textures/polyhaven/book_pattern/");
  return {
    floor: createPbrTextureSet(floorBase, {
      map: "laminate_floor_02_diff_1k.jpg",
      normalMap: "laminate_floor_02_nor_gl_1k.jpg",
      roughnessMap: "laminate_floor_02_rough_1k.jpg"
    }, 5.4, 3.7),
    wall: createPbrTextureSet(wallBase, {
      map: "beige_wall_001_diff_1k.jpg",
      normalMap: "beige_wall_001_nor_gl_1k.jpg",
      roughnessMap: "beige_wall_001_rough_1k.jpg"
    }, 4.8, 2.2),
    wood: createPbrTextureSet(floorBase, {
      map: "laminate_floor_02_diff_1k.jpg",
      normalMap: "laminate_floor_02_nor_gl_1k.jpg",
      roughnessMap: "laminate_floor_02_rough_1k.jpg"
    }, 1.7, 1.1),
    darkWood: createPbrTextureSet(floorBase, {
      map: "laminate_floor_02_diff_1k.jpg",
      normalMap: "laminate_floor_02_nor_gl_1k.jpg",
      roughnessMap: "laminate_floor_02_rough_1k.jpg"
    }, 1.35, 0.9),
    fabricLight: createPbrTextureSet(fabricBase, {
      map: "fabric_pattern_07_col_2_1k.jpg",
      normalMap: "fabric_pattern_07_nor_gl_1k.jpg",
      roughnessMap: "fabric_pattern_07_rough_1k.jpg"
    }, 2.2, 1.8),
    sofaFabric: createPbrTextureSet(sofaBase, {
      map: "wool_boucle_diff_1k.jpg",
      normalMap: "wool_boucle_nor_gl_1k.jpg",
      roughnessMap: "wool_boucle_rough_1k.jpg"
    }, 2.4, 1.8),
    rugCarpet: createPbrTextureSet(rugBase, {
      map: "Carpet016_1K-JPG_Color.jpg",
      normalMap: "Carpet016_1K-JPG_NormalGL.jpg",
      roughnessMap: "Carpet016_1K-JPG_Roughness.jpg"
    }, 3.3, 2),
    bookCover: createPbrTextureSet(bookBase, {
      map: "book_pattern_col1_1k.jpg",
      normalMap: "book_pattern_nor_gl_1k.jpg",
      roughnessMap: "book_pattern_rough_1k.jpg"
    }, 1, 1),
    bookPages: {
      map: loadImageTexture(`${bookBase}/book_pattern_page_1k.jpg`, 1, 1, THREE.SRGBColorSpace)
    }
  };
}

function createObjectTextures() {
  return {
    ceramic: createObjectTextureSet(0xe9fff8, 0xc2e9df, "speckle", 0.024, 1),
    rubber: createObjectTextureSet(0x1d262c, 0x35414a, "groove", 0.05, 1),
    bookCover: createObjectTextureSet(0xa63e2b, 0x6e221b, "weave", 0.035, 1),
    terracotta: createObjectTextureSet(0xc97925, 0x6e3819, "grain", 0.055, 1),
    toyBall: createObjectTextureSet(0x0f7c8a, 0x94dde4, "speckle", 0.018, 1),
    sofaFiber: createObjectTextureSet(0x586b70, 0x87979b, "fineFiber", 0.032, 3.2),
    rugFiber: createObjectTextureSet(0x526b63, 0x8ca194, "fineFiber", 0.06, 5.4)
  };
}

function createObjectTextureSet(baseColor, accentColor, pattern, bumpScale, repeat = 1) {
  return {
    map: makeObjectAlbedoTexture(baseColor, accentColor, pattern, repeat),
    bumpMap: makeObjectValueTexture(pattern, repeat, false),
    roughnessMap: makeObjectValueTexture(pattern, repeat, true),
    bumpScale
  };
}

function makeObjectAlbedoTexture(baseColor, accentColor, pattern, repeat) {
  const base = hexToRgb(baseColor);
  const accent = hexToRgb(accentColor);
  return makeCanvasTexture(256, 256, repeat, repeat, (ctx, size) => {
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = materialNoise(x, y, pattern === "grain" ? 7 : 3);
        const line = patternLineValue(pattern, x, y, size);
        const mix = THREE.MathUtils.clamp(n * 0.18 + line, 0, 1);
        const offset = (materialNoise(x, y, 19) - 0.5) * 16;
        const i = (y * size + x) * 4;
        image.data[i] = THREE.MathUtils.clamp(base.r * (1 - mix) + accent.r * mix + offset, 0, 255);
        image.data[i + 1] = THREE.MathUtils.clamp(base.g * (1 - mix) + accent.g * mix + offset, 0, 255);
        image.data[i + 2] = THREE.MathUtils.clamp(base.b * (1 - mix) + accent.b * mix + offset, 0, 255);
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  });
}

function makeObjectValueTexture(pattern, repeat, roughness) {
  return makeCanvasTexture(256, 256, repeat, repeat, (ctx, size) => {
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const n = materialNoise(x, y, roughness ? 29 : 11);
        const line = patternLineValue(pattern, x, y, size);
        const value = roughness ? 162 + n * 48 + line * 42 : 112 + n * 52 + line * 82;
        const i = (y * size + x) * 4;
        image.data[i] = value;
        image.data[i + 1] = value;
        image.data[i + 2] = value;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, THREE.NoColorSpace);
}

function patternLineValue(pattern, x, y, size) {
  if (pattern === "groove") {
    return (Math.sin((x + y * 0.42) * 0.22) > 0.86 ? 0.55 : 0) + (Math.sin(y * 0.48) > 0.94 ? 0.2 : 0);
  }
  if (pattern === "weave") {
    return (Math.sin(x * 0.42) > 0.82 ? 0.34 : 0) + (Math.sin(y * 0.42) > 0.82 ? 0.34 : 0);
  }
  if (pattern === "grain") {
    return Math.sin((x + Math.sin(y * 0.08) * 18) * 0.18) > 0.88 ? 0.42 : 0;
  }
  if (pattern === "fineFiber") {
    return (Math.sin(x * 1.15) > 0.92 ? 0.22 : 0) + (Math.sin((y + x * 0.08) * 1.35) > 0.94 ? 0.26 : 0);
  }
  const center = Math.abs((x % (size / 8)) - size / 16) + Math.abs((y % (size / 8)) - size / 16);
  return center < 4 ? 0.26 : 0;
}

function materialNoise(x, y, seed) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function hexToRgb(hex) {
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255
  };
}

function createPbrTextureSet(basePath, files, repeatX, repeatY) {
  const prefix = basePath.endsWith("/") ? basePath : `${basePath}/`;
  return {
    map: loadImageTexture(`${prefix}${files.map}`, repeatX, repeatY, THREE.SRGBColorSpace),
    normalMap: loadImageTexture(`${prefix}${files.normalMap}`, repeatX, repeatY, THREE.NoColorSpace),
    roughnessMap: loadImageTexture(`${prefix}${files.roughnessMap}`, repeatX, repeatY, THREE.NoColorSpace)
  };
}

function loadImageTexture(url, repeatX, repeatY, colorSpace) {
  const texture = textureLoader.load(url);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 12);
  return texture;
}

function createSurfaceMaps() {
  return {
    floorBump: makeSurfaceMap("floor-bump", 6, 5),
    floorRoughness: makeSurfaceMap("floor-roughness", 6, 5),
    wallBump: makeSurfaceMap("wall-bump", 3, 2),
    rugBump: makeSurfaceMap("rug-bump", 2, 1.4),
    woodBump: makeSurfaceMap("wood-bump", 2.5, 1),
    fabricBump: makeSurfaceMap("fabric-bump", 2.5, 2.5)
  };
}

function makeSurfaceMap(kind, repeatX, repeatY) {
  return makeCanvasTexture(
    512,
    512,
    repeatX,
    repeatY,
    (ctx, size) => {
      ctx.fillStyle = kind.includes("roughness") ? "#b8b8b8" : "#808080";
      ctx.fillRect(0, 0, size, size);

      if (kind.startsWith("floor")) {
        for (let y = 0; y < size; y += 64) {
          ctx.fillStyle = kind.includes("roughness") ? "#cfcfcf" : "#9a9a9a";
          ctx.fillRect(0, y + 59, size, 3);
        }
        for (let x = 0; x < size; x += 128) {
          ctx.fillStyle = kind.includes("roughness") ? "#9f9f9f" : "#686868";
          ctx.fillRect(x + 10, 0, 3, size);
        }
      } else if (kind.startsWith("wall")) {
        for (let y = 0; y < size; y += 14) {
          ctx.strokeStyle = y % 28 === 0 ? "#9b9b9b" : "#777";
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(size, y + 5);
          ctx.stroke();
        }
      } else if (kind.startsWith("rug") || kind.startsWith("fabric")) {
        for (let i = 0; i < size; i += 8) {
          ctx.strokeStyle = i % 16 === 0 ? "#a2a2a2" : "#696969";
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, size);
          ctx.moveTo(0, i);
          ctx.lineTo(size, i);
          ctx.stroke();
        }
      } else if (kind.startsWith("wood")) {
        for (let y = 0; y < size; y += 10) {
          ctx.strokeStyle = y % 30 === 0 ? "#5f5f5f" : "#a6a6a6";
          ctx.beginPath();
          for (let x = 0; x <= size; x += 22) {
            const wobble = Math.sin((x + y) * 0.04) * 4;
            if (x === 0) ctx.moveTo(x, y + wobble);
            else ctx.lineTo(x, y + wobble);
          }
          ctx.stroke();
        }
      }
    },
    THREE.NoColorSpace
  );
}

function makeContactShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 124);
  gradient.addColorStop(0, "rgba(0,0,0,0.42)");
  gradient.addColorStop(0.48, "rgba(0,0,0,0.18)");
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function makeCanvasTexture(width, height, repeatX, repeatY, draw, colorSpace = THREE.SRGBColorSpace) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function applySceneMode(mode, announce = false) {
  state.sceneMode = mode;
  const rich = mode === "rich";

  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = rich ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
  renderer.toneMappingExposure = rich ? 0.78 : 1;
  scene.background.set(rich ? 0xdfe6df : 0xf1f3ee);
  scene.fog.color.set(rich ? 0xdfe6df : 0xf1f3ee);
  scene.fog.near = rich ? 16 : 18;
  scene.fog.far = rich ? 38 : 42;
  lights.hemi.intensity = rich ? 0.92 : 1.48;
  lights.sun.intensity = rich ? 1.35 : 2.15;
  lights.windowGlow.intensity = rich ? 2.85 : 3.1;
  lights.lamp.visible = rich;
  lights.lamp.intensity = rich ? 1.55 : 0;
  document.body.classList.toggle("rich-scene", rich);

  setMaterialSurface(mat.floor, pbrTextures.floor, rich ? 0xf2eadc : 0xdedfd7, rich ? 0.52 : 0.78, { normalScale: 0.72 });
  setMaterialSurface(mat.wall, pbrTextures.wall, rich ? 0xf1e4d2 : 0xf4f1e9, rich ? 0.84 : 0.82, { normalScale: 0.34 });
  setMaterialSurface(mat.rug, rich ? pbrTextures.rugCarpet : objectTextures.rugFiber, rich ? 0xffffff : 0x6f8f86, rich ? 0.96 : 0.88, { normalScale: 0.78 });
  stage.dataset.rugTexture = rich ? "ambientcg_carpet016_1k" : "procedural";
  setMaterialSurface(mat.wood, pbrTextures.wood, rich ? 0x9d7552 : 0x9c7554, rich ? 0.38 : 0.52, { normalScale: 0.42 });
  setMaterialSurface(mat.darkWood, pbrTextures.darkWood, rich ? 0x6f533b : 0x4c4238, rich ? 0.42 : 0.58, { normalScale: 0.38 });
  setMaterialSurface(mat.fabric, pbrTextures.sofaFabric, rich ? 0x92a09a : 0x6f7e84, rich ? 0.94 : 0.92, { normalScale: 0.9 });
  setMaterialSurface(mat.fabricLight, pbrTextures.fabricLight, rich ? 0xb7c7bd : 0xb7c2bd, rich ? 0.88 : 0.9, { normalScale: 0.95 });
  mat.glass.opacity = rich ? 0.42 : 0.34;
  mat.glass.roughness = rich ? 0.06 : 0.1;
  mat.glass.needsUpdate = true;
  scene.environment = rich ? glasshouseEnvironment || roomEnvironment : null;
  for (const object of richOnlyObjects) object.visible = rich && !object.userData.suppressed;
  for (const object of simpleOnlyObjects) object.visible = !rich;
  updateRichFurnitureFallbacks(rich);
  applyItemRenderMode(rich);

  updateUi();
  if (announce) toast(rich ? t("toast.sceneRich") : t("toast.sceneSimple"));
}

function setMaterialSurface(material, textureSet, color, roughness, options = {}) {
  const rich = state.sceneMode === "rich";
  const pbrSet = textureSet?.map ? textureSet : null;
  material.map = rich ? pbrSet?.map || textureSet : null;
  material.normalMap = rich ? pbrSet?.normalMap || null : null;
  material.bumpMap = rich ? pbrSet?.bumpMap || (!pbrSet ? options.bumpMap || null : null) : null;
  material.bumpScale = rich ? pbrSet?.bumpScale || (!pbrSet ? options.bumpScale || 0 : 0) : 0;
  material.roughnessMap = rich ? pbrSet?.roughnessMap || options.roughnessMap || null : null;
  if (!material.normalScale) material.normalScale = new THREE.Vector2(1, 1);
  material.normalScale.setScalar(rich ? options.normalScale || 1 : 1);
  material.color.set(color);
  material.roughness = roughness;
  material.needsUpdate = true;
}

function registerRichOnly(object) {
  object.userData.richOnly = true;
  object.visible = state.sceneMode === "rich" && !object.userData.suppressed;
  richOnlyObjects.push(object);
  return object;
}

function registerSimpleOnly(object) {
  object.userData.simpleOnly = true;
  object.visible = state.sceneMode !== "rich";
  simpleOnlyObjects.push(object);
  return object;
}

function updateRichFurnitureFallbacks(rich = state.sceneMode === "rich") {
  const hideCoffeeTableFallback = rich && !!richAssetModels.coffeeTable;
  const hideSofaFallback = rich && !!richAssetModels.sofa;
  for (const mesh of richFurnitureFallbacks.sofa) mesh.visible = !hideSofaFallback;
  for (const mesh of richFurnitureFallbacks.coffeeTable) mesh.visible = !hideCoffeeTableFallback;
}

function createSoftShadow(width, depth, opacity = 0.22) {
  const material = new THREE.MeshBasicMaterial({
    map: contactShadowTexture,
    transparent: true,
    opacity,
    depthWrite: false,
    color: 0x000000
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = -1;
  return registerRichOnly(shadow);
}

function softBoxGeometry(size, radiusFactor = 0.08, segments = 3) {
  const minSide = Math.min(size.x, size.y, size.z);
  const radius = Math.min(minSide * radiusFactor, 0.045);
  return new RoundedBoxGeometry(size.x, size.y, size.z, segments, radius);
}

function applyItemRenderMode(rich) {
  for (const item of items) {
    const maps = rich ? item.richMaps : null;
    const hiddenVisualProxy = rich && !!item.loadedModel;
    item.material.map = maps?.map || null;
    item.material.bumpMap = maps?.bumpMap || null;
    item.material.bumpScale = maps?.bumpScale || 0;
    item.material.roughnessMap = maps?.roughnessMap || null;
    item.material.roughness = rich ? item.richRoughness : 0.44;
    item.material.metalness = rich ? item.richMetalness : 0.08;
    item.material.color.set(rich ? item.richColor : item.color);
    item.material.transparent = hiddenVisualProxy;
    item.material.opacity = hiddenVisualProxy ? 0.035 : 1;
    item.material.depthWrite = !hiddenVisualProxy;
    item.mesh.castShadow = !hiddenVisualProxy;
    item.mesh.visible = !hiddenVisualProxy;
    if (item.contactShadow) item.contactShadow.visible = rich && !hiddenVisualProxy;
    item.material.needsUpdate = true;
  }
}

const state = {
  selected: null,
  task: null,
  language: getLanguage(),
  activeArm: "right",
  sceneMode: "simple",
  robotVariant: "g1-29dof",
  sidebarHidden: false,
  fullscreen: false,
  fullscreenFallback: false,
  held: { left: null, right: null },
  follow: false,
  walk: 0,
  gaitSpeed: 0,
  gaitCommandSpeed: 0,
  gaitActualSpeed: 0,
  moveSpeed: SPEED_CONFIG.default,
  autoFace: true,
  pendingFaceTarget: null,
  lastTarget: null,
  currentTarget: null,
  selectedDropSpot: null,
  home: {
    entered: false,
    entering: false,
    elapsed: 0,
    duration: 1.65,
    previewMode: "rich",
    view: "overview",
    fromPosition: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toPosition: new THREE.Vector3(),
    toTarget: new THREE.Vector3()
  },
  arms: {
    left: { lift: 0, reach: 0, grip: 0.05 },
    right: { lift: 0, reach: 0, grip: 0.05 }
  },
  legs: {
    crouch: 0,
    leftLift: 0,
    rightLift: 0
  }
};

const keys = new Set();
const holds = new Set();
const impulses = new Map();
const clickableMeshes = [];
const items = [];
const dropSpots = [];
const navObstacles = [];
const DROP_SPOT_KEYS = {
  "茶几": "drop.coffeeTable",
  "边桌": "drop.sideTable",
  "电视柜": "drop.tvConsole",
  "书架中层": "drop.bookshelf",
  "餐岛台": "drop.kitchenIsland",
  "地毯": "drop.rug"
};
const physics = {
  world: null,
  robotBody: null,
  itemBodies: new Map(),
  material: null
};
const lights = {};

initPhysics();
initLights();
let world;
let robot;

function itemLabel(itemOrId) {
  const id = typeof itemOrId === "string" ? itemOrId : itemOrId?.id;
  return t(`item.${id}`);
}

function dropSpotLabel(spotOrName) {
  const name = typeof spotOrName === "string" ? spotOrName : spotOrName?.name;
  return t(DROP_SPOT_KEYS[name] || name);
}

function targetLabel(targetOrName) {
  const name = typeof targetOrName === "string" ? targetOrName : targetOrName?.name;
  return dropSpotLabel(name);
}

function robotVariantLabel(variantOrId) {
  const id = typeof variantOrId === "string" ? variantOrId : variantOrId?.id;
  return t(`robot.${id}.name`);
}

function robotProfileLabel(variantOrId) {
  const id = typeof variantOrId === "string" ? variantOrId : variantOrId?.id;
  return t(`profile.${id}`);
}

function robotSourceLabel(variantOrId) {
  const id = typeof variantOrId === "string" ? variantOrId : variantOrId?.id;
  return t(`source.${id}`);
}

function urdfStatusLabel(status) {
  const statusKeys = {
    "URDF 待加载": "urdf.pending",
    "URDF 加载中": "urdf.loading",
    "URDF 已加载": "urdf.loaded",
    "URDF 加载失败": "urdf.failed",
    "URDF 进入后加载": "urdf.deferred"
  };
  return t(statusKeys[status] || status);
}

function initPhysics() {
  physics.material = new CANNON.Material("home-contact");
  physics.world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
    allowSleep: true
  });
  physics.world.broadphase = new CANNON.SAPBroadphase(physics.world);
  physics.world.defaultContactMaterial.friction = 0.72;
  physics.world.defaultContactMaterial.restitution = 0.08;
  physics.world.addContactMaterial(
    new CANNON.ContactMaterial(physics.material, physics.material, {
      friction: 0.78,
      restitution: 0.05
    })
  );
}

function initLights() {
  lights.hemi = new THREE.HemisphereLight(0xffffff, 0x8b9189, 1.48);
  scene.add(lights.hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 2.15);
  sun.position.set(5.4, 8.2, 4.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 28;
  sun.shadow.camera.left = -11;
  sun.shadow.camera.right = 11;
  sun.shadow.camera.top = 11;
  sun.shadow.camera.bottom = -11;
  lights.sun = sun;
  scene.add(sun);

  const windowGlow = new THREE.RectAreaLight(0xdff5ff, 3.1, 5.5, 2.6);
  windowGlow.position.set(-4.8, 2.6, -5.65);
  windowGlow.rotation.x = Math.PI * -0.5;
  lights.windowGlow = windowGlow;
  scene.add(windowGlow);

  const lamp = new THREE.PointLight(0xffc88e, 1.6, 7, 1.9);
  lamp.position.set(-6.8, 1.55, -2.05);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(256, 256);
  lamp.visible = false;
  lights.lamp = lamp;
  scene.add(lamp);
}

function createWorld() {
  const group = new THREE.Group();
  scene.add(group);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 14), mat.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const floorBody = new CANNON.Body({ mass: 0, material: physics.material });
  floorBody.addShape(new CANNON.Plane());
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  physics.world.addBody(floorBody);

  addWall(group, new THREE.Vector3(0, 1.45, -6.95), new THREE.Vector3(20, 2.9, 0.16));
  addWall(group, new THREE.Vector3(-9.95, 1.45, 0), new THREE.Vector3(0.16, 2.9, 14));

  const grid = new THREE.GridHelper(20, 20, 0x9ca39c, 0xbfc5bd);
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  grid.position.y = 0.006;
  group.add(grid);

  const rug = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(5.6, 0.026, 3.4), 0.22, 5), mat.rug);
  rug.position.set(0.2, 0.017, 0.2);
  rug.receiveShadow = true;
  group.add(rug);

  createHomeFurniture(group);

  const homeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.52, 0.58, 64),
    new THREE.MeshBasicMaterial({ color: 0x11896f, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  );
  homeRing.name = "home-ring";
  homeRing.rotation.x = -Math.PI / 2;
  homeRing.position.set(0, 0.03, 2.55);
  group.add(homeRing);

  const targetMarker = new THREE.Mesh(
    new THREE.RingGeometry(0.36, 0.43, 64),
    new THREE.MeshBasicMaterial({ color: 0xd98b23, transparent: true, opacity: 0.76, side: THREE.DoubleSide })
  );
  targetMarker.rotation.x = -Math.PI / 2;
  targetMarker.visible = false;
  group.add(targetMarker);

  const navPath = new THREE.Line(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0x0b6dff, transparent: true, opacity: 0.75 })
  );
  navPath.name = "nav-path";
  navPath.visible = false;
  group.add(navPath);

  return { group, homeRing, targetMarker, navPath };
}

function addWall(group, position, size) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat.wall);
  wall.position.copy(position);
  wall.receiveShadow = true;
  group.add(wall);
  addStaticBox(position, size, "wall");
}

function createHomeFurniture(group) {
  richFurnitureFallbacks.sofa.push(furnitureBox(group, "沙发座", new THREE.Vector3(-5.3, 0.32, -0.8), new THREE.Vector3(2.8, 0.64, 1.05), mat.fabric));
  richFurnitureFallbacks.sofa.push(furnitureBox(group, "沙发靠背", new THREE.Vector3(-5.3, 0.92, -1.38), new THREE.Vector3(2.9, 1.0, 0.25), mat.fabric));
  richFurnitureFallbacks.sofa.push(furnitureBox(group, "沙发贵妃位", new THREE.Vector3(-6.15, 0.32, 0.55), new THREE.Vector3(1.1, 0.64, 2.0), mat.fabric));
  for (const x of [-6.0, -5.25, -4.5]) {
    const pillow = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.52, 0.28, 0.12), 0.28, 5), mat.fabricLight);
    pillow.position.set(x, 0.86, -1.2);
    pillow.rotation.x = -0.18;
    pillow.castShadow = true;
    group.add(pillow);
    richFurnitureFallbacks.sofa.push(pillow);
  }

  richFurnitureFallbacks.coffeeTable.push(furnitureBox(group, "茶几", COFFEE_TABLE_POSITION, COFFEE_TABLE_SIZE, mat.darkWood));
  for (const x of [-1.25, 0.45]) {
    for (const z of [-0.95, -0.15]) {
      richFurnitureFallbacks.coffeeTable.push(furnitureBox(group, "茶几腿", new THREE.Vector3(x, 0.16, z), new THREE.Vector3(0.08, 0.3, 0.08), mat.darkWood));
    }
  }
  registerDropSpot("茶几", new THREE.Vector3(-0.4, 0.43, -0.55), 0.55, new THREE.Vector3(0, 0, 0.92));

  furnitureBox(group, "边桌", new THREE.Vector3(-7.2, 0.42, -2.2), new THREE.Vector3(0.72, 0.16, 0.72), mat.wood);
  furnitureBox(group, "边桌柱", new THREE.Vector3(-7.2, 0.22, -2.2), new THREE.Vector3(0.16, 0.4, 0.16), mat.wood);
  registerDropSpot("边桌", new THREE.Vector3(-7.2, 0.55, -2.2), 0.24, new THREE.Vector3(0.7, 0, 0.62));

  furnitureBox(group, "电视柜", new THREE.Vector3(3.9, 0.32, -5.65), new THREE.Vector3(3.2, 0.58, 0.48), mat.darkWood);
  const tv = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(2.4, 1.25, 0.08), 0.18, 3), mat.robotBlack);
  tv.position.set(3.9, 1.35, -5.94);
  tv.castShadow = true;
  group.add(tv);
  registerDropSpot("电视柜", new THREE.Vector3(3.2, 0.64, -5.65), 0.32, new THREE.Vector3(0, 0, 0.78));

  furnitureBox(group, "书架", new THREE.Vector3(-8.15, 0.95, 2.55), new THREE.Vector3(0.58, 1.9, 2.5), mat.wood);
  for (const y of [0.55, 1.0, 1.45]) {
    furnitureBox(group, "书架层板", new THREE.Vector3(-7.83, y, 2.55), new THREE.Vector3(0.12, 0.06, 2.35), mat.darkWood);
  }
  registerDropSpot("书架中层", new THREE.Vector3(-7.56, 1.08, 2.2), 0.22, new THREE.Vector3(0.72, 0, 0.35));

  furnitureBox(group, "餐岛台", new THREE.Vector3(5.3, 0.48, 1.85), new THREE.Vector3(2.8, 0.28, 1.28), mat.wood);
  furnitureBox(group, "餐岛台基座", new THREE.Vector3(5.3, 0.24, 1.85), new THREE.Vector3(2.35, 0.48, 0.86), mat.wood);
  registerDropSpot("餐岛台", new THREE.Vector3(5.3, 0.66, 1.85), 0.54, new THREE.Vector3(-1.75, 0, 0.2));

  furnitureBox(group, "坐凳", new THREE.Vector3(3.25, 0.36, 2.4), new THREE.Vector3(0.62, 0.12, 0.62), mat.fabricLight);
  furnitureBox(group, "坐凳腿", new THREE.Vector3(3.25, 0.18, 2.4), new THREE.Vector3(0.22, 0.36, 0.22), mat.metal);

  registerDropSpot("地毯", new THREE.Vector3(1.65, 0.05, 0.95), 0.78, new THREE.Vector3(-0.72, 0, 0.45));
  createHomeDecorDetails(group);
}

function createHomeDecorDetails(group) {
  const details = new THREE.Group();
  const furnitureShadows = [
    { x: -5.45, z: -0.45, w: 3.4, d: 2.8, o: 0.18 },
    { x: -0.4, z: -0.55, w: 2.55, d: 1.35, o: 0.2 },
    { x: -7.2, z: -2.2, w: 0.9, d: 0.9, o: 0.17 },
    { x: 3.9, z: -5.65, w: 3.45, d: 0.75, o: 0.18 },
    { x: -8.15, z: 2.55, w: 0.9, d: 2.7, o: 0.16 },
    { x: 5.3, z: 1.85, w: 3.1, d: 1.55, o: 0.18 }
  ];
  for (const shadowConfig of furnitureShadows) {
    const shadow = createSoftShadow(shadowConfig.w, shadowConfig.d, shadowConfig.o);
    shadow.position.set(shadowConfig.x, 0.012, shadowConfig.z);
    details.add(shadow);
  }

  const windowPane = new THREE.Mesh(
    new THREE.BoxGeometry(4.8, 1.75, 0.035),
    new THREE.MeshPhysicalMaterial({ color: 0xdff5ff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.46, transmission: 0.28 })
  );
  windowPane.position.set(-4.8, 1.82, -6.86);
  details.add(windowPane);
  for (const x of [-6, -4.8, -3.6]) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.86, 0.055), mat.metal);
    mullion.position.set(x, 1.82, -6.82);
    mullion.castShadow = true;
    details.add(mullion);
  }
  for (const y of [1.05, 2.58]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.045, 0.055), mat.metal);
    rail.position.set(-4.8, y, -6.82);
    rail.castShadow = true;
    details.add(rail);
  }

  const tvReflection = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 0.72),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 })
  );
  tvReflection.position.set(3.58, 1.48, -5.985);
  tvReflection.rotation.z = -0.16;
  details.add(tvReflection);

  for (let i = 0; i < 12; i++) {
    const book = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.12, 0.42 + (i % 3) * 0.08, 0.3), 0.18, 3), i % 2 ? mat.darkWood : mat.fabricLight);
    book.position.set(-7.55, 0.72 + Math.floor(i / 4) * 0.45, 1.64 + (i % 4) * 0.28);
    book.rotation.x = (i % 3 - 1) * 0.06;
    book.castShadow = true;
    details.add(book);
  }

  const rugBorder = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.05, 4),
    new THREE.MeshStandardMaterial({ color: 0xe2d7bf, roughness: 0.82, metalness: 0.02, side: THREE.DoubleSide })
  );
  rugBorder.scale.set(2.85, 1.75, 1);
  rugBorder.position.set(0.2, 0.034, 0.2);
  rugBorder.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
  details.add(rugBorder);
  addRugFringe(details);

  const tableSheen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 0.76),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, side: THREE.DoubleSide })
  );
  tableSheen.position.set(-0.38, 0.395, -0.57);
  tableSheen.rotation.x = -Math.PI / 2;
  details.add(tableSheen);

  addBaseboards(details);
  addWindowCurtains(details);
  addWallArt(details);
  addLampDetails(details);
  addKitchenAccents(details);

  group.add(registerRichOnly(details));
}

function addRugFringe(group) {
  const fringeGroup = new THREE.Group();
  fringeGroup.name = "rug-fringe";
  const count = 34;
  const startX = 0.2 - 2.64;
  const step = 5.28 / (count - 1);
  for (let i = 0; i < count; i += 1) {
    const x = startX + i * step;
    for (const side of [-1, 1]) {
      const strand = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, 0.28), richMat.rugFringe);
      strand.position.set(x, 0.052, 0.2 + side * 1.82);
      strand.rotation.y = side * (0.03 + (i % 5 - 2) * 0.012);
      strand.castShadow = true;
      strand.receiveShadow = true;
      fringeGroup.add(strand);
    }
  }
  group.add(fringeGroup);
  stage.dataset.rugFringeCount = String(count * 2);
}

function addBaseboards(group) {
  const back = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(19.5, 0.16, 0.075), 0.18, 3), richMat.matBoard);
  back.position.set(0, 0.12, -6.83);
  back.castShadow = true;
  group.add(back);

  const left = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.075, 0.16, 13.4), 0.18, 3), richMat.matBoard);
  left.position.set(-9.83, 0.12, 0);
  left.castShadow = true;
  group.add(left);
}

function addWindowCurtains(group) {
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 5.35, 24), richMat.brass);
  rod.position.set(-4.8, 2.82, -6.72);
  rod.rotation.z = Math.PI / 2;
  rod.castShadow = true;
  group.add(rod);

  for (const x of [-7.28, -2.32]) {
    const panel = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.46, 1.86, 0.042), 0.16, 4), richMat.curtain);
    panel.position.set(x, 1.82, -6.71);
    panel.castShadow = true;
    group.add(panel);
    for (let i = 0; i < 5; i++) {
      const pleat = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 1.72, 10), richMat.curtain);
      pleat.position.set(x - 0.18 + i * 0.09, 1.76, -6.67);
      pleat.castShadow = true;
      group.add(pleat);
    }
  }

  for (const x of [-7.52, -2.08]) {
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 12), richMat.brass);
    finial.position.set(x, 2.82, -6.72);
    finial.castShadow = true;
    group.add(finial);
  }
}

function addWallArt(group) {
  const artConfigs = [
    { x: 1.75, y: 1.78, w: 0.82, h: 0.54, seed: 1 },
    { x: 2.75, y: 1.78, w: 0.68, h: 0.54, seed: 2 }
  ];
  for (const config of artConfigs) {
    const frame = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(config.w + 0.1, config.h + 0.1, 0.04), 0.12, 3), richMat.frame);
    frame.position.set(config.x, config.y, -6.815);
    frame.castShadow = true;
    group.add(frame);

    const board = new THREE.Mesh(new THREE.PlaneGeometry(config.w, config.h), richMat.matBoard);
    board.position.set(config.x, config.y, -6.788);
    group.add(board);

    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(config.w * 0.82, config.h * 0.72),
      new THREE.MeshStandardMaterial({ map: createArtTexture(config.seed), roughness: 0.74, metalness: 0.01 })
    );
    art.position.set(config.x, config.y, -6.775);
    group.add(art);
  }
}

function addLampDetails(group) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.055, 28), richMat.brass);
  base.position.set(-7.2, 0.61, -2.2);
  base.castShadow = true;
  group.add(base);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.55, 18), richMat.brass);
  stem.position.set(-7.2, 0.9, -2.2);
  stem.castShadow = true;
  group.add(stem);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 12), richMat.warmBulb);
  bulb.position.set(-7.2, 1.16, -2.2);
  group.add(bulb);

  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.38, 0.36, 36, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe2c7a3, roughness: 0.86, metalness: 0.01, transparent: true, opacity: 0.82, side: THREE.DoubleSide })
  );
  shade.position.set(-7.2, 1.18, -2.2);
  shade.castShadow = true;
  group.add(shade);
}

function addKitchenAccents(group) {
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), mat.glass);
  bowl.position.set(5.98, 0.82, 1.8);
  bowl.rotation.x = Math.PI;
  bowl.castShadow = true;
  group.add(bowl);

  for (let i = 0; i < 4; i++) {
    const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 12), new THREE.MeshPhysicalMaterial({ color: i % 2 ? 0xd98b23 : 0xa63e2b, roughness: 0.38, metalness: 0.02, clearcoat: 0.45, clearcoatRoughness: 0.24 }));
    fruit.position.set(5.91 + (i % 2) * 0.12, 0.82 + Math.floor(i / 2) * 0.055, 1.74 + (i % 3) * 0.08);
    fruit.castShadow = true;
    group.add(fruit);
  }
}

function furnitureBox(group, name, position, size, material) {
  const mesh = new THREE.Mesh(softBoxGeometry(size, 0.1), material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  addStaticBox(position, size, name);
  return mesh;
}

function addStaticBox(position, size, label) {
  const body = new CANNON.Body({ mass: 0, material: physics.material });
  body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
  body.position.set(position.x, position.y, position.z);
  body.userData = { label };
  physics.world.addBody(body);
  registerNavObstacle(position, size, label);
  return body;
}

function registerNavObstacle(position, size, label) {
  if (size.y < 0.18) return;
  navObstacles.push({
    label,
    minX: position.x - size.x / 2,
    maxX: position.x + size.x / 2,
    minZ: position.z - size.z / 2,
    maxZ: position.z + size.z / 2
  });
}

function registerDropSpot(name, position, radius, standOffset) {
  dropSpots.push({ name, position, radius, standOffset });
}

function createItems() {
  addItem({
    id: "cup",
    name: "水杯",
    kind: "cylinder",
    color: 0x11896f,
    size: new THREE.Vector3(0.24, 0.32, 0.24),
    position: new THREE.Vector3(-0.75, 0.64, -0.62)
  });
  addItem({
    id: "remote",
    name: "遥控器",
    kind: "box",
    color: 0x425a75,
    size: new THREE.Vector3(0.42, 0.08, 0.18),
    position: new THREE.Vector3(0.18, 0.53, -0.38)
  });
  addItem({
    id: "book",
    name: "书本",
    kind: "box",
    color: 0xa63e2b,
    size: new THREE.Vector3(0.48, 0.08, 0.36),
    position: new THREE.Vector3(0.42, 0.53, -0.86)
  });
  addItem({
    id: "plant",
    name: "小盆栽",
    kind: "cylinder",
    color: 0xd98b23,
    size: new THREE.Vector3(0.32, 0.32, 0.32),
    position: new THREE.Vector3(-1.08, 0.64, -0.12)
  });
  addItem({
    id: "ball",
    name: "玩具球",
    kind: "sphere",
    color: 0x0f7c8a,
    size: new THREE.Vector3(0.3, 0.3, 0.3),
    position: new THREE.Vector3(1.55, 0.22, 1.05)
  });
}

function addItem(config) {
  const group = new THREE.Group();
  group.name = config.name;
  group.position.copy(config.position);
  group.userData.initial = config.position.clone();

  const material = new THREE.MeshStandardMaterial({
    color: config.color,
    roughness: 0.44,
    metalness: 0.08,
    emissive: 0x000000
  });

  let mesh;
  if (config.kind === "sphere") {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(config.size.x / 2, 32, 18), material);
  } else if (config.kind === "cylinder") {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(config.size.x / 2, config.size.z / 2, config.size.y, 32), material);
  } else {
    mesh = new THREE.Mesh(softBoxGeometry(config.size, 0.16), material);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.itemId = config.id;
  group.add(mesh);

  const richDetails = createItemDetails(config);
  if (richDetails) group.add(registerRichOnly(richDetails));
  const contactShadow = createSoftShadow(config.size.x * 1.7, config.size.z * 1.7, 0.2);
  contactShadow.position.y = -config.size.y / 2 - 0.006;
  group.add(contactShadow);

  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.24 })
  );
  group.add(registerSimpleOnly(edge));

  const label = makeLabel(itemLabel(config.id));
  label.position.set(0, Math.max(config.size.y * 0.72 + 0.18, config.size.y / 2 + 0.32), 0);
  group.add(label);

  const item = {
    ...config,
    group,
    mesh,
    richDetails,
    contactShadow,
    label: label.element,
    material,
    richColor: richItemColor(config),
    richRoughness: richItemRoughness(config),
    richMetalness: richItemMetalness(config),
    richMaps: richItemTextureSet(config),
    height: config.size.y,
    heldBy: null,
    placed: false,
    body: createItemBody(config)
  };
  items.push(item);
  clickableMeshes.push(mesh);
  scene.add(group);
  physics.itemBodies.set(item.body, item);
}

function richItemColor(config) {
  if (config.id === "cup") return 0xdcfff6;
  if (config.id === "remote") return 0x1e2a33;
  if (config.id === "book") return 0x9c3227;
  if (config.id === "plant") return 0xc97925;
  if (config.id === "ball") return 0x097987;
  return config.color;
}

function richItemRoughness(config) {
  if (config.id === "cup") return 0.22;
  if (config.id === "remote") return 0.55;
  if (config.id === "book") return 0.62;
  if (config.id === "plant") return 0.68;
  if (config.id === "ball") return 0.28;
  return 0.42;
}

function richItemMetalness(config) {
  if (config.id === "remote") return 0.12;
  return 0.02;
}

function richItemTextureSet(config) {
  if (config.id === "cup") return objectTextures.ceramic;
  if (config.id === "remote") return objectTextures.rubber;
  if (config.id === "book") return objectTextures.bookCover;
  if (config.id === "plant") return objectTextures.terracotta;
  if (config.id === "ball") return objectTextures.toyBall;
  return null;
}

function createItemBody(config) {
  const body = new CANNON.Body({
    mass: config.kind === "sphere" ? 0.35 : 0.48,
    material: physics.material,
    linearDamping: 0.28,
    angularDamping: 0.38,
    allowSleep: true
  });
  if (config.kind === "sphere") {
    body.addShape(new CANNON.Sphere(config.size.x / 2));
  } else {
    body.addShape(new CANNON.Box(new CANNON.Vec3(config.size.x / 2, config.size.y / 2, config.size.z / 2)));
  }
  body.position.set(config.position.x, config.position.y, config.position.z);
  physics.world.addBody(body);
  return body;
}

function loadRichAssetModels() {
  loadPottedPlantModel();
  loadCoffeeTableModel();
  loadSofaModel();
  loadGamepadModel();
  loadBrassGobletsModel();
  loadFootballModel();
}

function loadPottedPlantModel() {
  if (richAssetModels.pottedPlant || richAssetModels.pottedPlantLoading) return;
  richAssetModels.pottedPlantLoading = true;
  stage.dataset.pottedPlantModel = "loading";
  gltfLoader.load(
    assetUrl("models/polyhaven/potted_plant_01/potted_plant_01_1k.gltf"),
    (gltf) => {
      richAssetModels.pottedPlant = gltf.scene;
      prepareLoadedRichModel(richAssetModels.pottedPlant);
      attachLoadedPottedPlantModel();
      stage.dataset.pottedPlantModel = "ready";
    },
    undefined,
    (error) => {
      console.warn("Unable to load rich potted plant model", error);
      stage.dataset.pottedPlantModel = "error";
    }
  );
}

function loadCoffeeTableModel() {
  if (richAssetModels.coffeeTable || richAssetModels.coffeeTableLoading) return;
  richAssetModels.coffeeTableLoading = true;
  stage.dataset.coffeeTableModel = "loading";
  gltfLoader.load(
    assetUrl("models/polyhaven/modern_coffee_table_01/modern_coffee_table_01_1k.gltf"),
    (gltf) => {
      richAssetModels.coffeeTable = gltf.scene;
      prepareLoadedRichModel(richAssetModels.coffeeTable);
      attachLoadedCoffeeTableModel();
      stage.dataset.coffeeTableModel = "ready";
    },
    undefined,
    (error) => {
      console.warn("Unable to load rich coffee table model", error);
      stage.dataset.coffeeTableModel = "error";
    }
  );
}

function loadSofaModel() {
  if (richAssetModels.sofa || richAssetModels.sofaLoading) return;
  richAssetModels.sofaLoading = true;
  stage.dataset.sofaModel = "loading";
  gltfLoader.load(
    assetUrl("models/polyhaven/sofa_03/sofa_03_1k.gltf"),
    (gltf) => {
      richAssetModels.sofa = gltf.scene;
      prepareLoadedRichModel(richAssetModels.sofa);
      attachLoadedSofaModel();
      stage.dataset.sofaModel = "ready";
    },
    undefined,
    (error) => {
      console.warn("Unable to load rich sofa model", error);
      stage.dataset.sofaModel = "error";
    }
  );
}

function loadGamepadModel() {
  if (richAssetModels.gamepad || richAssetModels.gamepadLoading) return;
  richAssetModels.gamepadLoading = true;
  stage.dataset.gamepadModel = "loading";
  gltfLoader.load(
    assetUrl("models/polyhaven/gamepad/gamepad_1k.gltf"),
    (gltf) => {
      richAssetModels.gamepad = gltf.scene;
      prepareLoadedRichModel(richAssetModels.gamepad);
      attachLoadedGamepadModel();
      stage.dataset.gamepadModel = "ready";
    },
    undefined,
    (error) => {
      console.warn("Unable to load rich gamepad model", error);
      stage.dataset.gamepadModel = "error";
    }
  );
}

function loadBrassGobletsModel() {
  if (richAssetModels.brassGoblets || richAssetModels.brassGobletsLoading) return;
  richAssetModels.brassGobletsLoading = true;
  stage.dataset.cupModel = "loading";
  gltfLoader.load(
    assetUrl("models/polyhaven/brass_goblets/brass_goblets_1k.gltf"),
    (gltf) => {
      richAssetModels.brassGoblets = gltf.scene;
      prepareLoadedRichModel(richAssetModels.brassGoblets);
      attachLoadedCupModel();
      stage.dataset.cupModel = "ready";
    },
    undefined,
    (error) => {
      console.warn("Unable to load rich brass goblet model", error);
      stage.dataset.cupModel = "error";
    }
  );
}

function loadFootballModel() {
  if (richAssetModels.football || richAssetModels.footballLoading) return;
  richAssetModels.footballLoading = true;
  stage.dataset.ballModel = "loading";
  gltfLoader.load(
    assetUrl("models/polyhaven/football/football_1k.gltf"),
    (gltf) => {
      richAssetModels.football = gltf.scene;
      prepareLoadedRichModel(richAssetModels.football);
      attachLoadedBallModel();
      stage.dataset.ballModel = "ready";
    },
    undefined,
    (error) => {
      console.warn("Unable to load rich football model", error);
      stage.dataset.ballModel = "error";
    }
  );
}

function prepareLoadedRichModel(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material) continue;
      material.envMapIntensity = 0.82;
      if (material.name?.includes("leaves")) material.side = THREE.DoubleSide;
      for (const key of ["map", "normalMap", "roughnessMap", "metalnessMap"]) {
        if (material[key]) material[key].anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 12);
      }
      material.needsUpdate = true;
    }
  });
}

function attachLoadedPottedPlantModel() {
  const item = items.find((candidate) => candidate.id === "plant");
  if (!item || !richAssetModels.pottedPlant || item.loadedModel) return;
  const model = richAssetModels.pottedPlant.clone(true);
  fitLoadedModelToItem(model, item, 0.78);
  model.name = "real-potted-plant-01";
  item.loadedModel = registerRichOnly(model);
  if (item.richDetails) {
    item.richDetails.userData.suppressed = true;
    item.richDetails.visible = false;
  }
  item.group.add(item.loadedModel);
  updateLoadedPlantDataset(item);
  applyItemRenderMode(state.sceneMode === "rich");
}

function updateLoadedPlantDataset(item) {
  let meshCount = 0;
  item.loadedModel.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  item.group.updateWorldMatrix(true, true);
  modelBounds.setFromObject(item.loadedModel);
  modelBounds.getSize(modelSize);
  stage.dataset.pottedPlantMeshCount = String(meshCount);
  stage.dataset.pottedPlantVisualHeight = modelSize.y.toFixed(2);
}

function attachLoadedCupModel() {
  const item = items.find((candidate) => candidate.id === "cup");
  if (!item || !richAssetModels.brassGoblets || item.loadedModel) return;
  const source = richAssetModels.brassGoblets.getObjectByName("brass_goblet_01") || richAssetModels.brassGoblets.children[0];
  if (!source) return;
  const model = source.clone(true);
  fitLoadedCupToItem(model, item);
  model.name = "real-brass-goblet";
  item.loadedModel = registerRichOnly(model);
  if (item.richDetails) {
    item.richDetails.userData.suppressed = true;
    item.richDetails.visible = false;
  }
  item.group.add(item.loadedModel);
  updateLoadedCupDataset(item);
  applyItemRenderMode(state.sceneMode === "rich");
}

function updateLoadedCupDataset(item) {
  let meshCount = 0;
  item.loadedModel.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  item.group.updateWorldMatrix(true, true);
  modelBounds.setFromObject(item.loadedModel);
  modelBounds.getSize(modelSize);
  stage.dataset.cupMeshCount = String(meshCount);
  stage.dataset.cupVisualSize = `${modelSize.x.toFixed(2)}x${modelSize.y.toFixed(2)}x${modelSize.z.toFixed(2)}`;
}

function attachLoadedBallModel() {
  const item = items.find((candidate) => candidate.id === "ball");
  if (!item || !richAssetModels.football || item.loadedModel) return;
  const source = richAssetModels.football.getObjectByName("football_inflated") || richAssetModels.football.children[0];
  if (!source) return;
  const model = source.clone(true);
  fitLoadedBallToItem(model, item);
  model.name = "real-football";
  item.loadedModel = registerRichOnly(model);
  if (item.richDetails) {
    item.richDetails.userData.suppressed = true;
    item.richDetails.visible = false;
  }
  item.group.add(item.loadedModel);
  updateLoadedBallDataset(item);
  applyItemRenderMode(state.sceneMode === "rich");
}

function updateLoadedBallDataset(item) {
  let meshCount = 0;
  item.loadedModel.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  item.group.updateWorldMatrix(true, true);
  modelBounds.setFromObject(item.loadedModel);
  modelBounds.getSize(modelSize);
  stage.dataset.ballMeshCount = String(meshCount);
  stage.dataset.ballVisualSize = `${modelSize.x.toFixed(2)}x${modelSize.y.toFixed(2)}x${modelSize.z.toFixed(2)}`;
}

function attachLoadedGamepadModel() {
  const item = items.find((candidate) => candidate.id === "remote");
  if (!item || !richAssetModels.gamepad || item.loadedModel) return;
  const model = richAssetModels.gamepad.clone(true);
  fitLoadedGamepadToItem(model, item);
  model.name = "real-gamepad";
  item.loadedModel = registerRichOnly(model);
  if (item.richDetails) {
    item.richDetails.userData.suppressed = true;
    item.richDetails.visible = false;
  }
  item.group.add(item.loadedModel);
  updateLoadedGamepadDataset(item);
  applyItemRenderMode(state.sceneMode === "rich");
}

function updateLoadedGamepadDataset(item) {
  let meshCount = 0;
  item.loadedModel.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  item.group.updateWorldMatrix(true, true);
  modelBounds.setFromObject(item.loadedModel);
  modelBounds.getSize(modelSize);
  stage.dataset.gamepadMeshCount = String(meshCount);
  stage.dataset.gamepadVisualSize = `${modelSize.x.toFixed(2)}x${modelSize.y.toFixed(2)}x${modelSize.z.toFixed(2)}`;
}

function attachLoadedSofaModel() {
  if (!world?.group || !richAssetModels.sofa || richAssetModels.sofa.userData.attached) return;
  const model = richAssetModels.sofa.clone(true);
  fitLoadedFurnitureToBox(model, SOFA_POSITION, SOFA_SIZE, { heightMultiplier: 1 });
  model.name = "real-sofa-03";
  world.group.add(registerRichOnly(model));
  richAssetModels.sofa.userData.attached = true;
  updateRichFurnitureFallbacks(state.sceneMode === "rich");
  updateLoadedSofaDataset(model);
}

function updateLoadedSofaDataset(model) {
  let meshCount = 0;
  model.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getSize(modelSize);
  stage.dataset.sofaMeshCount = String(meshCount);
  stage.dataset.sofaVisualSize = `${modelSize.x.toFixed(2)}x${modelSize.y.toFixed(2)}x${modelSize.z.toFixed(2)}`;
}

function attachLoadedCoffeeTableModel() {
  if (!world?.group || !richAssetModels.coffeeTable || richAssetModels.coffeeTable.userData.attached) return;
  const model = richAssetModels.coffeeTable.clone(true);
  fitLoadedFurnitureToBox(model, COFFEE_TABLE_POSITION, COFFEE_TABLE_SIZE);
  model.name = "real-modern-coffee-table-01";
  world.group.add(registerRichOnly(model));
  richAssetModels.coffeeTable.userData.attached = true;
  updateRichFurnitureFallbacks(state.sceneMode === "rich");
  updateLoadedCoffeeTableDataset(model);
}

function updateLoadedCoffeeTableDataset(model) {
  let meshCount = 0;
  model.traverse((object) => {
    if (object.isMesh) meshCount += 1;
  });
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getSize(modelSize);
  stage.dataset.coffeeTableMeshCount = String(meshCount);
  stage.dataset.coffeeTableVisualSize = `${modelSize.x.toFixed(2)}x${modelSize.y.toFixed(2)}x${modelSize.z.toFixed(2)}`;
}

function fitLoadedFurnitureToBox(model, position, targetSize, options = {}) {
  const footprintMultiplier = options.footprintMultiplier ?? 0.96;
  const heightMultiplier = options.heightMultiplier ?? 1.45;
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getSize(modelSize);
  if (modelSize.x <= 0 || modelSize.y <= 0 || modelSize.z <= 0) return;

  model.scale.set(
    (targetSize.x * footprintMultiplier) / modelSize.x,
    (targetSize.y * heightMultiplier) / modelSize.y,
    (targetSize.z * footprintMultiplier) / modelSize.z
  );
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getCenter(modelCenter);

  const bottomY = position.y - targetSize.y / 2;
  model.position.set(
    position.x - modelCenter.x,
    bottomY - modelBounds.min.y,
    position.z - modelCenter.z
  );
}

function fitLoadedModelToItem(model, item, targetHeight) {
  model.position.set(0, 0, 0);
  model.rotation.set(0, -0.28, 0);
  model.scale.setScalar(1);
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getSize(modelSize);
  if (modelSize.y > 0) model.scale.setScalar(targetHeight / modelSize.y);
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getCenter(modelCenter);
  model.position.x -= modelCenter.x;
  model.position.z -= modelCenter.z;
  model.position.y += -item.size.y / 2 - modelBounds.min.y;
}

function fitLoadedCupToItem(model, item) {
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0.22, 0);
  model.scale.setScalar(1);
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getSize(modelSize);
  if (modelSize.y > 0) model.scale.setScalar((item.size.y * 1.08) / modelSize.y);
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getCenter(modelCenter);
  model.position.x -= modelCenter.x;
  model.position.z -= modelCenter.z;
  model.position.y += -item.size.y / 2 - modelBounds.min.y;
}

function fitLoadedBallToItem(model, item) {
  model.position.set(0, 0, 0);
  model.rotation.set(0.32, -0.42, 0.18);
  model.scale.setScalar(1);
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getSize(modelSize);
  const maxAxis = Math.max(modelSize.x, modelSize.y, modelSize.z);
  if (maxAxis > 0) model.scale.setScalar((item.size.x * 1.02) / maxAxis);
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getCenter(modelCenter);
  model.position.x -= modelCenter.x;
  model.position.z -= modelCenter.z;
  model.position.y += -item.size.y / 2 - modelBounds.min.y;
}

function fitLoadedGamepadToItem(model, item) {
  model.position.set(0, 0, 0);
  model.rotation.set(0, -0.16, 0);
  model.scale.setScalar(1);
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getSize(modelSize);
  if (modelSize.x <= 0 || modelSize.y <= 0 || modelSize.z <= 0) return;

  const scale = (item.size.x * 1.3) / modelSize.x;
  model.scale.setScalar(scale);
  model.updateWorldMatrix(true, true);
  modelBounds.setFromObject(model);
  modelBounds.getCenter(modelCenter);
  model.position.x -= modelCenter.x;
  model.position.z -= modelCenter.z;
  model.position.y += item.size.y / 2 - modelBounds.min.y + 0.006;
}

function createItemDetails(config) {
  if (config.id === "cup") return createCupDetails(config);
  if (config.id === "remote") return createRemoteDetails(config);
  if (config.id === "book") return createBookDetails(config);
  if (config.id === "plant") return createPlantDetails(config);
  if (config.id === "ball") return createBallDetails(config);
  return null;
}

function createCupDetails(config) {
  const group = new THREE.Group();
  const radius = config.size.x / 2;
  const topY = config.size.y / 2 + 0.006;

  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.9, 0.012, 12, 48), richMat.cupCeramic);
  rim.position.y = topY;
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  group.add(rim);

  const coffee = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.72, 48), richMat.cupCoffee);
  coffee.position.y = topY + 0.004;
  coffee.rotation.x = -Math.PI / 2;
  group.add(coffee);

  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(radius * 0.72, 0.08, 0),
    new THREE.Vector3(radius * 1.4, 0.07, 0),
    new THREE.Vector3(radius * 1.42, -0.06, 0),
    new THREE.Vector3(radius * 0.72, -0.07, 0)
  ]);
  const handle = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 28, 0.018, 10, false), richMat.cupCeramic);
  handle.castShadow = true;
  group.add(handle);

  return group;
}

function createRemoteDetails(config) {
  const group = new THREE.Group();
  const topY = config.size.y / 2 + 0.008;

  const screen = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.22, 0.012, 0.07), 0.2, 3), mat.robotBlack);
  screen.position.set(-0.06, topY, -0.035);
  screen.castShadow = true;
  group.add(screen);

  const power = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.014, 20), richMat.remoteButton);
  power.position.set(0.15, topY + 0.004, -0.04);
  power.rotation.x = Math.PI / 2;
  power.castShadow = true;
  group.add(power);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const button = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.052, 0.014, 0.032), 0.22, 3), richMat.remoteButton);
      button.position.set(-0.12 + col * 0.085, topY + 0.003, 0.02 + row * 0.045);
      button.castShadow = true;
      group.add(button);
    }
  }

  const dpad = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.012, 8, 28), richMat.remoteRubber);
  dpad.position.set(0.145, topY + 0.006, 0.07);
  dpad.rotation.x = Math.PI / 2;
  dpad.castShadow = true;
  group.add(dpad);
  return group;
}

function createBookDetails(config) {
  const group = new THREE.Group();
  const topY = config.size.y / 2 + 0.006;

  const pageBlock = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(config.size.x * 0.82, 0.018, config.size.z * 0.76), 0.16, 3), richMat.bookPagesPbr);
  pageBlock.position.set(0.028, topY + 0.002, 0);
  pageBlock.castShadow = true;
  group.add(pageBlock);

  const cover = new THREE.Mesh(new THREE.PlaneGeometry(config.size.x * 0.96, config.size.z * 0.92), richMat.bookCoverPbr);
  cover.position.y = topY + 0.016;
  cover.rotation.x = -Math.PI / 2;
  cover.castShadow = true;
  group.add(cover);

  for (const z of [-0.045, 0.045]) {
    const foilLine = new THREE.Mesh(new THREE.PlaneGeometry(config.size.x * 0.48, 0.012), richMat.brass);
    foilLine.position.set(0.018, topY + 0.018, z);
    foilLine.rotation.x = -Math.PI / 2;
    group.add(foilLine);
  }

  for (let i = 0; i < 8; i++) {
    const line = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(config.size.x * 0.72, 0.004, 0.006), 0.2, 2), richMat.bookLine);
    line.position.set(0.04, topY + 0.021, -0.12 + i * 0.034);
    group.add(line);
  }

  const spine = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.035, 0.028, config.size.z * 0.92), 0.18, 3), richMat.bookLine);
  spine.position.set(-config.size.x * 0.45, 0.012, 0);
  spine.castShadow = true;
  group.add(spine);
  return group;
}

function createPlantDetails(config) {
  const group = new THREE.Group();

  const soil = new THREE.Mesh(new THREE.CircleGeometry(config.size.x * 0.38, 36), richMat.soil);
  soil.position.y = config.size.y / 2 + 0.01;
  soil.rotation.x = -Math.PI / 2;
  group.add(soil);

  for (let i = 0; i < 12; i++) {
    const leaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.16, 6, 10), richMat.plantLeaf);
    const angle = (i / 12) * Math.PI * 2;
    leaf.position.set(Math.cos(angle) * 0.045, config.size.y / 2 + 0.105, Math.sin(angle) * 0.045);
    leaf.rotation.z = Math.cos(angle) * 0.9;
    leaf.rotation.x = 0.95 + Math.sin(angle) * 0.32;
    leaf.rotation.y = -angle;
    leaf.castShadow = true;
    group.add(leaf);
  }
  return group;
}

function createBallDetails(config) {
  const group = new THREE.Group();
  const r = config.size.x / 2;
  for (const rot of [0, Math.PI / 2, Math.PI / 4]) {
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.012, 10, 64), richMat.ballStripe);
    stripe.rotation.x = Math.PI / 2;
    stripe.rotation.y = rot;
    stripe.castShadow = true;
    group.add(stripe);
  }
  return group;
}

function makeLabel(text) {
  const el = document.createElement("div");
  el.className = "scene-label";
  el.textContent = text;
  return new CSS2DObject(el);
}

function createTextTexture(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f4f6ef";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#13201b";
  ctx.font = "800 72px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createArtTexture(seed) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, seed === 1 ? "#cdd9d1" : "#d9cfbf");
  sky.addColorStop(0.56, seed === 1 ? "#eef0e6" : "#f1e7d6");
  sky.addColorStop(1, seed === 1 ? "#9ca886" : "#b68f67");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = seed === 1 ? "rgba(84,106,82,0.52)" : "rgba(116,78,52,0.45)";
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    const y = 112 + i * 13;
    ctx.moveTo(-20, y);
    for (let x = -20; x <= canvas.width + 20; x += 22) {
      ctx.lineTo(x, y + Math.sin((x + seed * 47) * 0.028 + i) * (9 + i));
    }
    ctx.lineTo(canvas.width + 20, canvas.height);
    ctx.lineTo(-20, canvas.height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function createRobotRichDetails() {
  const group = new THREE.Group();
  group.name = "rich-g1-detail-kit";

  const chestPlate = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.28, 0.022, 0.16), 0.22, 4), richMat.robotPanel);
  chestPlate.position.set(0, 1.12, -0.151);
  chestPlate.castShadow = true;
  group.add(chestPlate);

  const abdomenPlate = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.2, 0.018, 0.12), 0.22, 4), richMat.robotPanel);
  abdomenPlate.position.set(0, 0.9, -0.137);
  abdomenPlate.castShadow = true;
  group.add(abdomenPlate);

  const visorGlow = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.18, 0.018, 0.012), 0.32, 4), richMat.robotLens);
  visorGlow.position.set(0, 1.45, -0.141);
  group.add(visorGlow);

  const visorLed = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.145, 0.012, 0.008), 0.32, 4), richMat.robotLed);
  visorLed.position.set(0, 1.45, -0.158);
  group.add(visorLed);

  for (const side of [-1, 1]) {
    const sideCamera = new THREE.Mesh(new THREE.SphereGeometry(0.028, 18, 12), richMat.robotLens);
    sideCamera.name = side > 0 ? "right_depth_side_lens" : "left_depth_side_lens";
    sideCamera.position.set(0.092 * side, 1.425, -0.142);
    sideCamera.scale.set(1, 0.72, 0.52);
    group.add(sideCamera);
  }

  for (const y of [1.17, 1.01, 0.87]) {
    const seam = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.25, 0.007, 0.008), 0.24, 2), richMat.robotRubber);
    seam.position.set(0, y, -0.17);
    group.add(seam);
  }

  for (const x of [-0.085, 0.085]) {
    const chestLed = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.022, 0.1, 0.01), 0.28, 3), richMat.robotLed);
    chestLed.position.set(x, 1.085, -0.174);
    group.add(chestLed);
  }

  for (const x of [-0.105, 0.105]) {
    for (const y of [1.16, 1.07, 0.93]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.008, 18), richMat.robotScrew);
      screw.position.set(x, y, -0.165);
      screw.rotation.x = Math.PI / 2;
      screw.castShadow = true;
      group.add(screw);
    }
  }

  for (const side of [-1, 1]) {
    const shoulderRing = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.008, 8, 36), richMat.robotScrew);
    shoulderRing.position.set(0.31 * side, 1.16, 0);
    shoulderRing.rotation.y = Math.PI / 2;
    shoulderRing.castShadow = true;
    group.add(shoulderRing);

    const shoulderPod = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.09, 0.075, 0.12), 0.28, 4), richMat.robotPanel);
    shoulderPod.name = side > 0 ? "right_shoulder_motor_cover" : "left_shoulder_motor_cover";
    shoulderPod.position.set(0.315 * side, 1.16, -0.018);
    shoulderPod.castShadow = true;
    group.add(shoulderPod);

    const hipRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.007, 8, 32), richMat.robotScrew);
    hipRing.name = side > 0 ? "right_hip_roll_motor_ring" : "left_hip_roll_motor_ring";
    hipRing.position.set(0.12 * side, 0.62, 0);
    hipRing.rotation.y = Math.PI / 2;
    hipRing.castShadow = true;
    group.add(hipRing);

    const kneeRing = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.006, 8, 32), richMat.robotScrew);
    kneeRing.position.set(0.12 * side, 0.23, 0);
    kneeRing.rotation.y = Math.PI / 2;
    kneeRing.castShadow = true;
    group.add(kneeRing);

    const shinShell = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.095, 0.18, 0.07), 0.25, 4), richMat.robotPanel);
    shinShell.name = side > 0 ? "right_calf_outer_shell" : "left_calf_outer_shell";
    shinShell.position.set(0.12 * side, 0.125, -0.018);
    shinShell.castShadow = true;
    group.add(shinShell);

    const anklePlate = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.16, 0.018, 0.06), 0.2, 3), richMat.robotScrew);
    anklePlate.position.set(0.12 * side, 0.255, -0.02);
    anklePlate.castShadow = true;
    group.add(anklePlate);

    const toeCap = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.13, 0.026, 0.045), 0.2, 3), richMat.robotScrew);
    toeCap.name = side > 0 ? "right_toe_collision_cap" : "left_toe_collision_cap";
    toeCap.position.set(0.12 * side, -0.095, -0.165);
    toeCap.castShadow = true;
    group.add(toeCap);
  }

  return registerRichOnly(group);
}

function makeRobotPanel(size, name) {
  const panel = new THREE.Mesh(softBoxGeometry(size, 0.24, 4), richMat.robotPanel);
  panel.name = name;
  panel.castShadow = true;
  panel.receiveShadow = true;
  return registerRichOnly(panel);
}

function makeRobotLed(size, name) {
  const led = new THREE.Mesh(softBoxGeometry(size, 0.3, 3), richMat.robotLed);
  led.name = name;
  return registerRichOnly(led);
}

function makeRobotRing(radius, tube, name) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 40), richMat.robotScrew);
  ring.name = name;
  ring.castShadow = true;
  return registerRichOnly(ring);
}

function setRichSuppressed(object, suppressed) {
  object.userData.suppressed = suppressed;
  object.visible = state.sceneMode === "rich" && !suppressed;
}

class Robot {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "Humanoid 29DOF Preset";
    this.group.position.set(0, ROBOT_FOOT_VISUAL_OFFSET, 2.55);
    this.group.rotation.y = Math.PI;
    this.parts = {};
    this.variant = ROBOT_VARIANTS[state.robotVariant];
    this.urdfRequestId = 0;
    this.urdfStatus = "URDF 待加载";
    this.urdfSource = ROBOT_MODEL_SOURCE;
    this.urdfVariantId = null;
    this.urdfAssetPath = null;
    this.urdfLoadingAssetPath = null;
    this.urdfPendingVariant = null;
    this.urdfModelCache = new Map();
    this.phase = 0;
    this.pose = "idle";
    this.build();
    this.setVariant(state.robotVariant);
  }

  build() {
    const root = this.group;

    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.22), mat.robotBlack);
    pelvis.name = "pelvis_link";
    pelvis.position.y = 0.68;
    pelvis.castShadow = true;
    root.add(pelvis);

    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.16, 32), mat.joint);
    waist.name = "waist_yaw_link";
    waist.position.y = 0.82;
    waist.castShadow = true;
    root.add(waist);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.36, 8, 24), mat.robotWhite);
    torso.name = "torso_link";
    torso.position.set(0, 1.04, 0);
    torso.scale.set(0.88, 1, 0.62);
    torso.castShadow = true;
    root.add(torso);

    const chest = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.12),
      new THREE.MeshStandardMaterial({ map: createTextTexture("RBT"), roughness: 0.5, metalness: 0.04 })
    );
    chest.name = "chest_badge_visual";
    chest.position.set(0, 1.08, -0.143);
    root.add(chest);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.08, 24), mat.joint);
    neck.name = "head_yaw_link";
    neck.position.y = 1.3;
    neck.castShadow = true;
    root.add(neck);

    const head = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.12, 8, 24), mat.robotWhite);
    head.name = "head_link";
    head.position.set(0, 1.43, -0.02);
    head.scale.set(1.05, 1, 0.82);
    head.castShadow = true;
    root.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.025), mat.robotBlack);
    visor.name = "depth_camera_window";
    visor.position.set(0, 1.45, -0.125);
    visor.castShadow = true;
    root.add(visor);

    this.parts.pelvis = pelvis;
    this.parts.waist = waist;
    this.parts.torso = torso;
    this.parts.chest = chest;
    this.parts.neck = neck;
    this.parts.head = head;
    this.parts.visor = visor;

    this.parts.leftArm = this.createArm(-1);
    this.parts.rightArm = this.createArm(1);
    root.add(this.parts.leftArm.shoulder, this.parts.rightArm.shoulder);

    this.parts.leftLeg = this.createLeg(-1);
    this.parts.rightLeg = this.createLeg(1);
    root.add(this.parts.leftLeg.hip, this.parts.rightLeg.hip);
    this.parts.richDetails = createRobotRichDetails();
    root.add(this.parts.richDetails);
    this.parts.quadruped = this.createQuadruped();
    root.add(this.parts.quadruped.group);
    this.parts.mobile = this.createMobilePlatform();
    root.add(this.parts.mobile.group);

    this.parts.urdfMount = new THREE.Group();
    this.parts.urdfMount.name = "active_urdf_robot_model";
    root.add(this.parts.urdfMount);
  }

  createArm(side) {
    const prefix = side > 0 ? "right" : "left";
    const shoulder = new THREE.Group();
    shoulder.name = `${prefix}_shoulder_pitch_link`;
    shoulder.position.set(0.31 * side, 1.16, 0);

    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), mat.joint);
    joint.name = `${prefix}_shoulder_roll_motor`;
    joint.castShadow = true;
    shoulder.add(joint);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 8, 16), mat.robotWhite);
    upper.name = `${prefix}_upper_arm_link`;
    upper.position.y = -0.16;
    upper.castShadow = true;
    shoulder.add(upper);

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 12), mat.joint);
    elbow.name = `${prefix}_elbow_pitch_link`;
    elbow.position.y = -0.32;
    elbow.castShadow = true;
    shoulder.add(elbow);

    const forearm = new THREE.Group();
    forearm.name = `${prefix}_forearm_link`;
    forearm.position.y = -0.32;
    shoulder.add(forearm);

    const forearmMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.23, 8, 16), mat.robotWhite);
    forearmMesh.name = `${prefix}_wrist_roll_parent`;
    forearmMesh.position.y = -0.16;
    forearmMesh.castShadow = true;
    forearm.add(forearmMesh);

    const forearmShell = makeRobotPanel(new THREE.Vector3(0.088, 0.16, 0.064), `${prefix}_forearm_service_panel`);
    forearmShell.position.set(0, -0.16, -0.035);
    forearmShell.rotation.x = 0.08;
    forearm.add(forearmShell);

    const forearmLed = makeRobotLed(new THREE.Vector3(0.012, 0.11, 0.009), `${prefix}_forearm_status_led`);
    forearmLed.position.set(0.032 * side, -0.16, -0.074);
    forearm.add(forearmLed);

    const wrist = new THREE.Group();
    wrist.name = `${prefix}_wrist_yaw_link`;
    wrist.position.y = -0.34;
    forearm.add(wrist);

    const wristMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), mat.joint);
    wristMesh.name = `${prefix}_wrist_pitch_motor`;
    wristMesh.castShadow = true;
    wrist.add(wristMesh);

    const wristRing = makeRobotRing(0.052, 0.006, `${prefix}_wrist_motor_ring`);
    wristRing.rotation.x = Math.PI / 2;
    wrist.add(wristRing);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.055, 0.075), mat.joint);
    palm.name = `${prefix}_hand_palm_link`;
    palm.position.set(0, -0.035, -0.02);
    palm.castShadow = true;
    wrist.add(palm);

    const palmPad = makeRobotPanel(new THREE.Vector3(0.082, 0.014, 0.052), `${prefix}_hand_service_pad`);
    palmPad.position.set(0, -0.038, -0.063);
    wrist.add(palmPad);

    const leftFinger = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.025), mat.robotBlack);
    const rightFinger = leftFinger.clone();
    leftFinger.name = `${prefix}_left_gripper_finger`;
    rightFinger.name = `${prefix}_right_gripper_finger`;
    leftFinger.position.set(-0.04, -0.09, -0.055);
    rightFinger.position.set(0.04, -0.09, -0.055);
    leftFinger.castShadow = true;
    rightFinger.castShadow = true;
    wrist.add(leftFinger, rightFinger);

    return { shoulder, joint, upper, elbow, forearm, forearmMesh, wrist, wristMesh, palm, leftFinger, rightFinger, side };
  }

  createLeg(side) {
    const prefix = side > 0 ? "right" : "left";
    const hip = new THREE.Group();
    hip.name = `${prefix}_hip_pitch_link`;
    hip.position.set(0.12 * side, 0.62, 0);
    const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 12), mat.joint);
    hipJoint.name = `${prefix}_hip_roll_motor`;
    hipJoint.castShadow = true;
    hip.add(hipJoint);

    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.28, 8, 16), mat.robotWhite);
    thigh.name = `${prefix}_thigh_link`;
    thigh.position.y = -0.19;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12), mat.joint);
    knee.name = `${prefix}_knee_link`;
    knee.position.y = -0.39;
    knee.castShadow = true;
    hip.add(knee);

    const shin = new THREE.Group();
    shin.name = `${prefix}_calf_link`;
    shin.position.y = -0.39;
    hip.add(shin);

    const shinMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.28, 8, 16), mat.robotWhite);
    shinMesh.name = `${prefix}_ankle_pitch_parent`;
    shinMesh.position.y = -0.18;
    shinMesh.castShadow = true;
    shin.add(shinMesh);

    const shinPanel = makeRobotPanel(new THREE.Vector3(0.078, 0.16, 0.05), `${prefix}_calf_service_panel`);
    shinPanel.position.set(0, -0.18, -0.032);
    shin.add(shinPanel);

    const ankleRing = makeRobotRing(0.048, 0.005, `${prefix}_ankle_motor_ring`);
    ankleRing.position.y = -0.32;
    ankleRing.rotation.y = Math.PI / 2;
    shin.add(ankleRing);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.26), mat.robotBlack);
    foot.name = `${prefix}_ankle_roll_link`;
    foot.position.set(0, ROBOT_FOOT_LOCAL_Y, -0.045);
    foot.castShadow = true;
    shin.add(foot);
    const toePlate = makeRobotPanel(new THREE.Vector3(0.13, 0.018, 0.052), `${prefix}_toe_bumper_plate`);
    toePlate.material = richMat.robotScrew;
    toePlate.position.set(0, 0.036, -0.09);
    foot.add(toePlate);
    const treads = new THREE.Group();
    for (const z of [-0.085, 0, 0.085]) {
      const tread = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.13, 0.014, 0.026), 0.2, 2), richMat.robotRubber);
      tread.position.set(0, -0.036, z);
      tread.castShadow = true;
      treads.add(tread);
    }
    foot.add(registerRichOnly(treads));
    return { hip, hipJoint, thigh, knee, shin, shinMesh, foot };
  }

  createQuadruped() {
    const group = new THREE.Group();
    group.name = "generic_quadruped_procedural";
    group.visible = false;

    const body = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.34, 0.22, 0.76), 0.16, 5), mat.robotWhite);
    body.name = "quadruped_base_link";
    body.position.y = 0.46;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const topPanel = makeRobotPanel(new THREE.Vector3(0.26, 0.018, 0.48), "quadruped_top_service_panel");
    topPanel.position.set(0, 0.59, 0.02);
    group.add(topPanel);

    const spineLed = makeRobotLed(new THREE.Vector3(0.028, 0.014, 0.56), "quadruped_spine_status_led");
    spineLed.position.set(0, 0.612, 0);
    group.add(spineLed);

    const head = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.28, 0.17, 0.2), 0.18, 5), mat.robotWhite);
    head.name = "quadruped_head_link";
    head.position.set(0, 0.5, -0.48);
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);

    const face = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.21, 0.075, 0.018), 0.26, 4), mat.robotBlack);
    face.name = "quadruped_depth_camera_window";
    face.position.set(0, 0.505, -0.588);
    face.castShadow = true;
    group.add(face);

    const faceLed = makeRobotLed(new THREE.Vector3(0.13, 0.014, 0.01), "quadruped_front_led_bar");
    faceLed.position.set(0, 0.53, -0.602);
    group.add(faceLed);

    const frontLenses = [];
    for (const side of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 12), richMat.robotLens);
      lens.name = side > 0 ? "quadruped_right_stereo_lens" : "quadruped_left_stereo_lens";
      lens.position.set(0.055 * side, 0.505, -0.604);
      lens.scale.set(1, 0.72, 0.38);
      lens.castShadow = true;
      frontLenses.push(lens);
      group.add(lens);
    }

    const sidePanels = [];
    const sideCameras = [];
    for (const side of [-1, 1]) {
      const panel = makeRobotPanel(new THREE.Vector3(0.022, 0.13, 0.5), side > 0 ? "quadruped_right_side_shell" : "quadruped_left_side_shell");
      panel.position.set(0.185 * side, 0.47, 0.02);
      sidePanels.push(panel);
      group.add(panel);

      for (const z of [-0.18, -0.04, 0.1, 0.24]) {
        const vent = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.011, 0.036, 0.055), 0.18, 2), richMat.robotRubber);
        vent.name = side > 0 ? "quadruped_right_side_vent" : "quadruped_left_side_vent";
        vent.position.set(0.2 * side, 0.485, z);
        vent.castShadow = true;
        group.add(registerRichOnly(vent));
      }

      const camera = new THREE.Mesh(new THREE.SphereGeometry(0.018, 18, 10), richMat.robotLens);
      camera.name = side > 0 ? "quadruped_right_side_camera" : "quadruped_left_side_camera";
      camera.position.set(0.204 * side, 0.515, -0.23);
      camera.scale.set(0.55, 1, 1);
      sideCameras.push(camera);
      group.add(camera);
    }

    const payloadDeck = makeRobotPanel(new THREE.Vector3(0.2, 0.018, 0.32), "quadruped_payload_mount_deck");
    payloadDeck.position.set(0, 0.618, 0.06);
    group.add(payloadDeck);

    const railGroup = new THREE.Group();
    railGroup.name = "quadruped_top_handle_rails";
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.48, 14), richMat.robotScrew);
      rail.position.set(0.12 * side, 0.65, 0.04);
      rail.rotation.x = Math.PI / 2;
      rail.castShadow = true;
      railGroup.add(rail);
    }
    for (const z of [-0.16, 0.22]) {
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.24, 14), richMat.robotScrew);
      bridge.position.set(0, 0.65, z);
      bridge.rotation.z = Math.PI / 2;
      bridge.castShadow = true;
      railGroup.add(bridge);
    }
    group.add(registerRichOnly(railGroup));

    const lidar = new THREE.Group();
    lidar.name = "quadruped_top_lidar_module";
    const lidarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.028, 28), richMat.robotScrew);
    lidarBase.position.y = 0.642;
    lidarBase.castShadow = true;
    const lidarDome = new THREE.Mesh(new THREE.SphereGeometry(0.052, 24, 12), richMat.robotLens);
    lidarDome.position.y = 0.67;
    lidarDome.scale.y = 0.42;
    lidar.add(lidarBase, lidarDome);
    group.add(registerRichOnly(lidar));

    const rearLight = makeRobotLed(new THREE.Vector3(0.16, 0.018, 0.012), "quadruped_rear_status_light");
    rearLight.position.set(0, 0.515, 0.474);
    group.add(rearLight);

    const batteryDoor = makeRobotPanel(new THREE.Vector3(0.22, 0.11, 0.018), "quadruped_rear_battery_door");
    batteryDoor.position.set(0, 0.47, 0.455);
    group.add(batteryDoor);

    const legs = [];
    for (const config of [
      ["frontLeft", -1, -1],
      ["frontRight", 1, -1],
      ["rearLeft", -1, 1],
      ["rearRight", 1, 1]
    ]) {
      const leg = this.createQuadrupedLeg(...config);
      legs.push(leg);
      group.add(leg.hip);
    }

    return {
      group,
      body,
      topPanel,
      spineLed,
      head,
      face,
      faceLed,
      frontLenses,
      sidePanels,
      sideCameras,
      payloadDeck,
      railGroup,
      lidar,
      rearLight,
      batteryDoor,
      legs
    };
  }

  createQuadrupedLeg(name, side, end) {
    const hip = new THREE.Group();
    hip.name = `${name}_hip_link`;
    hip.position.set(0.23 * side, 0.42, 0.28 * end);

    const hipMotor = new THREE.Mesh(new THREE.SphereGeometry(0.055, 22, 14), mat.joint);
    hipMotor.name = `${name}_hip_motor`;
    hipMotor.castShadow = true;
    hip.add(hipMotor);

    const hipRing = makeRobotRing(0.064, 0.006, `${name}_hip_motor_ring`);
    hipRing.rotation.y = Math.PI / 2;
    hip.add(hipRing);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.038, 0.18, 8, 16), mat.robotWhite);
    upper.name = `${name}_upper_leg_link`;
    upper.position.y = -0.12;
    upper.rotation.z = side * 0.08;
    upper.castShadow = true;
    hip.add(upper);

    const knee = new THREE.Group();
    knee.name = `${name}_knee_link`;
    knee.position.y = -0.25;
    hip.add(knee);

    const kneeMotor = new THREE.Mesh(new THREE.SphereGeometry(0.047, 20, 12), mat.joint);
    kneeMotor.name = `${name}_knee_motor`;
    kneeMotor.castShadow = true;
    knee.add(kneeMotor);

    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.2, 8, 16), mat.robotWhite);
    lower.name = `${name}_lower_leg_link`;
    lower.position.y = -0.13;
    lower.rotation.z = -side * 0.05;
    lower.castShadow = true;
    knee.add(lower);

    const shinPanel = makeRobotPanel(new THREE.Vector3(0.056, 0.13, 0.036), `${name}_shin_service_cover`);
    shinPanel.position.set(0, -0.13, -0.022);
    knee.add(shinPanel);

    const foot = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.12, 0.034, 0.16), 0.22, 3), mat.robotBlack);
    foot.name = `${name}_foot_link`;
    foot.position.set(0, -0.265, -0.02);
    foot.castShadow = true;
    knee.add(foot);

    const tread = makeRobotPanel(new THREE.Vector3(0.105, 0.012, 0.13), `${name}_foot_rubber_tread`);
    tread.material = richMat.robotRubber;
    tread.position.y = -0.022;
    foot.add(tread);

    const wheel = new THREE.Group();
    wheel.name = `${name}_wheel_module`;
    wheel.visible = false;
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.052, 32), richMat.robotRubber);
    tire.name = `${name}_rubber_wheel_tire`;
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.058, 24), richMat.robotScrew);
    hub.name = `${name}_wheel_hub_motor`;
    hub.rotation.z = Math.PI / 2;
    hub.castShadow = true;
    wheel.add(tire, hub);
    wheel.position.set(0, -0.006, 0);
    foot.add(registerRichOnly(wheel));

    return { name, side, end, hip, hipMotor, upper, knee, kneeMotor, lower, shinPanel, foot, tread, wheel, tire, hub };
  }

  createMobilePlatform() {
    const group = new THREE.Group();
    group.name = "generic_mobile_platform_procedural";
    group.visible = false;

    const base = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.66, 0.22, 0.82), 0.16, 5), mat.robotWhite);
    base.name = "mobile_base_link";
    base.position.y = 0.2;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const bumperFront = makeRobotPanel(new THREE.Vector3(0.5, 0.05, 0.035), "mobile_front_safety_bumper");
    bumperFront.position.set(0, 0.18, -0.44);
    bumperFront.material = richMat.robotRubber;
    group.add(bumperFront);

    const bumperRear = makeRobotPanel(new THREE.Vector3(0.5, 0.05, 0.035), "mobile_rear_safety_bumper");
    bumperRear.position.set(0, 0.18, 0.44);
    bumperRear.material = richMat.robotRubber;
    group.add(bumperRear);

    const deck = makeRobotPanel(new THREE.Vector3(0.52, 0.025, 0.58), "mobile_top_payload_deck");
    deck.position.set(0, 0.33, 0.03);
    group.add(deck);

    const shellPanels = [];
    for (const side of [-1, 1]) {
      const sidePanel = makeRobotPanel(new THREE.Vector3(0.018, 0.13, 0.48), side > 0 ? "mobile_right_side_service_panel" : "mobile_left_side_service_panel");
      sidePanel.position.set(0.35 * side, 0.23, 0);
      shellPanels.push(sidePanel);
      group.add(sidePanel);

      for (const z of [-0.24, 0, 0.24]) {
        const vent = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.012, 0.026, 0.072), 0.18, 2), richMat.robotRubber);
        vent.name = side > 0 ? "mobile_right_cooling_louver" : "mobile_left_cooling_louver";
        vent.position.set(0.365 * side, 0.245, z);
        vent.castShadow = true;
        shellPanels.push(vent);
        group.add(registerRichOnly(vent));
      }

      const deckRail = new THREE.Group();
      deckRail.name = side > 0 ? "mobile_right_payload_rail" : "mobile_left_payload_rail";
      deckRail.position.set(0.24 * side, 0.365, 0.03);
      for (const z of [-0.22, 0.22]) {
        const standoff = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.075, 12), richMat.robotScrew);
        standoff.name = "mobile_payload_rail_standoff";
        standoff.position.set(0, 0, z);
        standoff.castShadow = true;
        deckRail.add(standoff);
      }
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.48, 12), richMat.robotScrew);
      rail.name = "mobile_payload_longitudinal_rail";
      rail.rotation.x = Math.PI / 2;
      rail.castShadow = true;
      deckRail.add(rail);
      shellPanels.push(deckRail);
      group.add(registerRichOnly(deckRail));
    }

    const bodyBadge = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.16, 0.006, 0.055), 0.18, 3), richMat.bookCoverPbr.clone());
    bodyBadge.name = "mobile_platform_badge";
    bodyBadge.position.set(0, 0.29, -0.463);
    bodyBadge.rotation.x = -0.04;
    bodyBadge.material.map = createTextTexture("AMR");
    bodyBadge.material.needsUpdate = true;
    shellPanels.push(bodyBadge);
    group.add(registerRichOnly(bodyBadge));

    const emergencyStop = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.036, 0.022, 24), new THREE.MeshStandardMaterial({ color: 0xd2392f, roughness: 0.32, metalness: 0.08 }));
    emergencyStop.name = "mobile_emergency_stop";
    emergencyStop.position.set(-0.18, 0.37, -0.22);
    emergencyStop.castShadow = true;
    group.add(registerRichOnly(emergencyStop));

    const dockContacts = [];
    for (const x of [-0.08, 0.08]) {
      const contact = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.055, 0.035, 0.011), 0.24, 3), richMat.brass);
      contact.name = "mobile_charging_contact";
      contact.position.set(x, 0.18, 0.462);
      contact.castShadow = true;
      dockContacts.push(contact);
      group.add(registerRichOnly(contact));
    }

    const mast = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.12, 0.58, 0.14), 0.18, 4), mat.robotWhite);
    mast.name = "mobile_sensor_mast";
    mast.position.set(0, 0.62, 0.12);
    mast.castShadow = true;
    group.add(mast);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.064, 0.07, 24), mat.joint);
    neck.name = "mobile_pan_tilt_neck";
    neck.position.set(0, 0.93, -0.02);
    neck.castShadow = true;
    group.add(neck);

    const head = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.22, 0.13, 0.12), 0.22, 5), mat.robotWhite);
    head.name = "mobile_sensor_head";
    head.position.set(0, 1.02, -0.08);
    head.castShadow = true;
    group.add(head);

    const screen = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.18, 0.075, 0.012), 0.18, 3), mat.robotBlack);
    screen.name = "mobile_status_screen";
    screen.position.set(0, 1.02, -0.151);
    group.add(screen);

    const lensBar = makeRobotLed(new THREE.Vector3(0.14, 0.012, 0.01), "mobile_depth_camera_bar");
    lensBar.position.set(0, 1.04, -0.162);
    group.add(lensBar);

    const lidar = new THREE.Group();
    lidar.name = "mobile_lidar_module";
    const lidarBase = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.068, 0.035, 32), richMat.robotScrew);
    lidarBase.castShadow = true;
    const lidarGlass = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 12), richMat.robotLens);
    lidarGlass.position.y = 0.03;
    lidarGlass.scale.y = 0.42;
    lidar.add(lidarBase, lidarGlass);
    lidar.position.set(0, 1.115, -0.02);
    group.add(registerRichOnly(lidar));

    const statusLeds = [];
    for (const [x, colorScale] of [[-0.18, 0.92], [0, 1], [0.18, 0.85]]) {
      const led = makeRobotLed(new THREE.Vector3(0.045 * colorScale, 0.012, 0.01), "mobile_front_status_led");
      led.position.set(x, 0.265, -0.43);
      statusLeds.push(led);
      group.add(led);
    }

    const wheels = [];
    const wheelRollers = [];
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.name = `${side > 0 ? "right" : "left"}_${end > 0 ? "rear" : "front"}_wheel_module`;
        wheel.position.set(0.36 * side, 0.14, 0.31 * end);
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.065, 32), richMat.robotRubber);
        tire.name = "mobile_wheel_tire";
        tire.rotation.z = Math.PI / 2;
        tire.castShadow = true;
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.072, 24), richMat.robotScrew);
        hub.name = "mobile_wheel_hub";
        hub.rotation.z = Math.PI / 2;
        hub.castShadow = true;
        const rollers = [];
        for (let i = 0; i < 8; i += 1) {
          const angle = (i / 8) * Math.PI * 2;
          const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.052, 10), richMat.robotScrew);
          roller.name = "mobile_mecanum_roller";
          roller.rotation.set(Math.PI / 2, angle, side * end * 0.62);
          roller.position.set(0, Math.sin(angle) * 0.057, Math.cos(angle) * 0.057);
          roller.castShadow = true;
          rollers.push(roller);
          wheelRollers.push(roller);
          wheel.add(roller);
        }
        wheel.userData.rollers = rollers;
        wheel.add(tire, hub);
        wheels.push(wheel);
        group.add(registerRichOnly(wheel));
      }
    }

    const tracks = [];
    const trackRollers = [];
    for (const side of [-1, 1]) {
      const track = new THREE.Group();
      track.name = side > 0 ? "right_track_module" : "left_track_module";
      track.position.set(0.36 * side, 0.12, 0);
      const belt = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.11, 0.13, 0.74), 0.28, 5), richMat.robotRubber);
      belt.name = "mobile_track_belt";
      belt.castShadow = true;
      track.add(belt);
      for (const z of [-0.28, 0.28]) {
        const sprocket = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.122, 28), richMat.robotScrew);
        sprocket.name = side > 0 ? "right_track_sprocket" : "left_track_sprocket";
        sprocket.rotation.z = Math.PI / 2;
        sprocket.position.set(0, 0.012, z);
        sprocket.castShadow = true;
        trackRollers.push(sprocket);
        track.add(sprocket);
      }
      for (const z of [-0.28, -0.14, 0, 0.14, 0.28]) {
        const lug = new THREE.Mesh(softBoxGeometry(new THREE.Vector3(0.118, 0.028, 0.045), 0.18, 2), richMat.robotScrew);
        lug.position.set(0, 0.075, z);
        lug.castShadow = true;
        track.add(lug);
      }
      tracks.push(track);
      group.add(registerRichOnly(track));
    }

    const caster = new THREE.Mesh(new THREE.SphereGeometry(0.052, 18, 12), richMat.robotRubber);
    caster.name = "mobile_rear_caster";
    caster.position.set(0, 0.085, 0.37);
    caster.scale.set(1.2, 0.45, 1.2);
    group.add(registerRichOnly(caster));

    return {
      group,
      base,
      deck,
      mast,
      neck,
      head,
      screen,
      lensBar,
      lidar,
      statusLeds,
      wheels,
      wheelRollers,
      tracks,
      trackRollers,
      caster,
      bumperFront,
      bumperRear,
      shellPanels,
      bodyBadge,
      emergencyStop,
      dockContacts
    };
  }

  robotUrdfAsset(variant = this.variant) {
    return ROBOT_URDF_ASSETS[variant.id] || ROBOT_URDF_ASSETS["g1-29dof"];
  }

  showProceduralRig() {
    if (!SHOW_PROCEDURAL_ROBOT_FALLBACK) {
      this.hideProceduralRig();
      return;
    }
    this.setRobotKind(this.variant.kind);
  }

  hideProceduralRig() {
    for (const key of [
      "pelvis",
      "waist",
      "torso",
      "chest",
      "neck",
      "head",
      "visor",
      "richDetails"
    ]) {
      if (this.parts[key]) this.parts[key].visible = false;
    }
    this.parts.leftArm.shoulder.visible = false;
    this.parts.rightArm.shoulder.visible = false;
    this.parts.leftLeg.hip.visible = false;
    this.parts.rightLeg.hip.visible = false;
    this.parts.quadruped.group.visible = false;
    this.parts.mobile.group.visible = false;
  }

  loadUrdfVariant(variant) {
    const asset = this.robotUrdfAsset(variant);
    if (this.parts.urdfModel && this.urdfAssetPath === asset.path) {
      const requestId = ++this.urdfRequestId;
      this.activateUrdfModel(this.parts.urdfModel, variant, asset, requestId);
      return;
    }
    const cachedModel = this.urdfModelCache.get(asset.path);
    if (cachedModel) {
      const requestId = ++this.urdfRequestId;
      this.cacheActiveUrdfModel();
      this.parts.urdfMount.add(cachedModel);
      this.activateUrdfModel(cachedModel, variant, asset, requestId);
      return;
    }
    if (this.urdfStatus === "URDF 加载中" && this.urdfLoadingAssetPath === asset.path) {
      this.urdfPendingVariant = variant;
      this.urdfSource = asset.source;
      return;
    }
    const requestId = ++this.urdfRequestId;
    this.urdfStatus = "URDF 加载中";
    this.urdfSource = asset.source;
    this.urdfLoadingAssetPath = asset.path;
    this.urdfPendingVariant = variant;
    this.hideProceduralRig();
    const stage = document.getElementById("stage");
    if (stage) {
      stage.dataset.robotSource = asset.source;
      stage.dataset.robotUrdfStatus = this.urdfStatus;
      stage.dataset.robotUrdfPath = asset.path;
      stage.dataset.robotUrdfJointCount = "0";
    }

    getUrdfLoader()
      .then((loader) => {
        if (requestId !== this.urdfRequestId) return;
        loader.load(
          assetUrl(asset.path),
          (urdfRobot) => {
            if (requestId !== this.urdfRequestId) {
              disposeObject3D(urdfRobot);
              return;
            }
            const activeVariant = this.urdfPendingVariant || variant;
            const activeAsset = this.robotUrdfAsset(activeVariant);
            urdfRobot.traverse((node) => {
              node.castShadow = true;
              node.receiveShadow = true;
              if (node.isMesh && node.material) {
                if (Array.isArray(node.material)) {
                  for (const material of node.material) material.needsUpdate = true;
                } else {
                  node.material.needsUpdate = true;
                }
              }
            });
            this.cacheActiveUrdfModel();
            this.parts.urdfMount.add(urdfRobot);
            this.activateUrdfModel(urdfRobot, activeVariant, activeAsset, requestId);
          },
          undefined,
          (error) => this.handleUrdfLoadError(requestId, asset, error)
        );
      })
      .catch((error) => this.handleUrdfLoadError(requestId, asset, error));
  }

  cacheActiveUrdfModel() {
    if (this.parts.urdfModel && this.urdfAssetPath) {
      this.urdfModelCache.set(this.urdfAssetPath, this.parts.urdfModel);
      this.parts.urdfMount.remove(this.parts.urdfModel);
    } else {
      this.parts.urdfMount.clear();
    }
    this.parts.urdfModel = null;
    this.urdfVariantId = null;
    this.urdfAssetPath = null;
  }

  activateUrdfModel(urdfRobot, variant, asset, requestId = this.urdfRequestId) {
    if (requestId !== this.urdfRequestId) return;
    urdfRobot.name = `${variant.id}_urdf_model`;
    urdfRobot.rotation.x = -Math.PI / 2;
    urdfRobot.scale.setScalar(asset.scale || 1);
    urdfRobot.position.set(0, 0, 0);
    this.parts.urdfModel = urdfRobot;
    this.urdfVariantId = variant.id;
    this.urdfAssetPath = asset.path;
    this.urdfModelCache.delete(asset.path);
    this.urdfLoadingAssetPath = null;
    this.urdfPendingVariant = null;
    this.urdfStatus = "URDF 已加载";
    this.urdfSource = asset.source;
    urdfRobot.userData.contactObjects = collectUrdfContactObjects(urdfRobot, variant);
    this.alignUrdfToControlRig(urdfRobot, variant);
    this.hideProceduralRig();
    this.syncUrdfPose(0, performance.now() * 0.001);
    const stage = document.getElementById("stage");
    if (stage) {
      stage.dataset.robotSource = asset.source;
      stage.dataset.robotUrdfStatus = this.urdfStatus;
      stage.dataset.robotUrdfPath = asset.path;
      stage.dataset.robotUrdfJointCount = String(Object.keys(urdfRobot.joints || {}).length);
    }
    updateUi();
  }

  handleUrdfLoadError(requestId, asset, error) {
    if (requestId !== this.urdfRequestId) return;
    this.urdfStatus = "URDF 加载失败";
    this.urdfLoadingAssetPath = null;
    this.urdfPendingVariant = null;
    this.urdfSource = `${asset.source} / 加载失败`;
    console.error("URDF load failed", asset.path, error);
    const stage = document.getElementById("stage");
    if (stage) {
      stage.dataset.robotSource = this.urdfSource;
      stage.dataset.robotUrdfStatus = this.urdfStatus;
      stage.dataset.robotUrdfPath = asset.path;
      stage.dataset.robotUrdfJointCount = "0";
    }
    if (!this.parts.urdfModel) this.showProceduralRig();
    updateUi();
  }

  alignUrdfToControlRig(urdfRobot, variant = this.variant) {
    this.group.updateWorldMatrix(true, true);
    urdfRobot.updateWorldMatrix(true, true);
    const contactObjects = urdfRobot.userData.contactObjects || collectUrdfContactObjects(urdfRobot, variant);
    let lowestClearance = Infinity;
    let targetClearance = ROBOT_FOOT_GROUND_CLEARANCE;

    for (const object of contactObjects) {
      const bounds = urdfContactBoundsForObject(object, variant);
      if (!bounds) continue;
      const ground = visualGroundForFootBounds(bounds);
      const target = ground.y > 0 ? ROBOT_FOOT_DECOR_CLEARANCE : ROBOT_FOOT_GROUND_CLEARANCE;
      const clearance = bounds.min.y - ground.y;
      if (clearance < lowestClearance) {
        lowestClearance = clearance;
        targetClearance = target;
      }
    }

    if (!Number.isFinite(lowestClearance)) {
      robotUrdfVisualBounds.setFromObject(urdfRobot);
      if (robotUrdfVisualBounds.isEmpty()) return;
      const ground = visualGroundForFootBounds(robotUrdfVisualBounds);
      lowestClearance = robotUrdfVisualBounds.min.y - ground.y;
      targetClearance = ground.y > 0 ? ROBOT_FOOT_DECOR_CLEARANCE : ROBOT_FOOT_GROUND_CLEARANCE;
    }

    urdfRobot.position.y += targetClearance - lowestClearance;
    urdfRobot.userData.stanceBaseY = urdfRobot.position.y;
    urdfRobot.updateWorldMatrix(true, true);
  }

  deferUrdfVariant(variant) {
    const asset = this.robotUrdfAsset(variant);
    this.urdfRequestId += 1;
    this.urdfVariantId = null;
    this.urdfAssetPath = null;
    this.urdfLoadingAssetPath = null;
    this.urdfPendingVariant = null;
    this.urdfStatus = "URDF 进入后加载";
    this.urdfSource = asset.source;
    disposeObject3D(this.parts.urdfMount);
    this.parts.urdfMount.clear();
    this.parts.urdfModel = null;
    this.hideProceduralRig();
    const stage = document.getElementById("stage");
    if (stage) {
      stage.dataset.robotSource = asset.source;
      stage.dataset.robotUrdfStatus = this.urdfStatus;
      stage.dataset.robotUrdfPath = asset.path;
      stage.dataset.robotUrdfJointCount = "0";
    }
  }

  ensureUrdfLoaded() {
    if (this.parts.urdfModel && this.urdfVariantId === this.variant.id) return;
    if (this.urdfStatus === "URDF 加载中") return;
    this.loadUrdfVariant(this.variant);
  }

  setUrdfJoint(name, value) {
    const model = this.parts.urdfModel;
    if (!model?.joints?.[name]) return;
    model.setJointValue(name, value);
  }

  syncUrdfPose(walkSwing, time) {
    const model = this.parts.urdfModel;
    if (!model) return;
    if (this.variant.kind === "quadruped") {
      this.syncQuadrupedUrdfPose();
    } else if (this.variant.kind === "humanoid") {
      this.syncHumanoidUrdfPose(walkSwing, time);
    } else {
      this.syncMobileUrdfPose(time);
    }
  }

  syncHumanoidUrdfPose(walkSwing, time) {
    const crouch = state.legs.crouch;
    const leftLift = state.legs.leftLift;
    const rightLift = state.legs.rightLift;
    const armPose = {
      left: this.armPose("left", this.pose, walkSwing * 0.12, time),
      right: this.armPose("right", this.pose, -walkSwing * 0.12, time)
    };
    const leftHip = walkSwing * 0.42 + crouch * HUMANOID_SQUAT_CONFIG.hipPitch - leftLift * 0.58;
    const rightHip = -walkSwing * 0.42 + crouch * HUMANOID_SQUAT_CONFIG.hipPitch - rightLift * 0.58;
    const leftKnee = Math.max(0, -walkSwing) * 0.38 + crouch * HUMANOID_SQUAT_CONFIG.kneePitch + leftLift * 0.82;
    const rightKnee = Math.max(0, walkSwing) * 0.38 + crouch * HUMANOID_SQUAT_CONFIG.kneePitch + rightLift * 0.82;

    this.setUrdfJoint("left_hip_pitch_joint", leftHip);
    this.setUrdfJoint("right_hip_pitch_joint", rightHip);
    this.setUrdfJoint("left_knee_joint", leftKnee);
    this.setUrdfJoint("right_knee_joint", rightKnee);
    this.setUrdfJoint("left_ankle_pitch_joint", crouch * HUMANOID_SQUAT_CONFIG.anklePitch + leftLift * 0.24);
    this.setUrdfJoint("right_ankle_pitch_joint", crouch * HUMANOID_SQUAT_CONFIG.anklePitch + rightLift * 0.24);
    this.setUrdfJoint("waist_yaw_joint", Math.sin(time * 0.8) * 0.03);
    this.setUrdfJoint("waist_roll_joint", -walkSwing * 0.04);
    this.setUrdfJoint("head_joint", Math.sin(time * 0.7) * 0.08);
    this.setUrdfJoint("head_yaw_joint", Math.sin(time * 0.7) * 0.08);

    for (const sideName of ["left", "right"]) {
      if (!robotArmEnabled(sideName)) continue;
      const side = sideName === "left" ? -1 : 1;
      const pose = armPose[sideName];
      this.setUrdfJoint(`${sideName}_shoulder_pitch_joint`, pose.sx * 0.82 - 0.16);
      this.setUrdfJoint(`${sideName}_shoulder_roll_joint`, side * (0.18 + pose.sz * 0.9));
      this.setUrdfJoint(`${sideName}_shoulder_yaw_joint`, -side * pose.sz * 0.72);
      this.setUrdfJoint(`${sideName}_elbow_joint`, -0.32 - pose.fx * 0.75);
      this.setUrdfJoint(`${sideName}_wrist_roll_joint`, side * 0.08);
      this.setUrdfJoint(`${sideName}_wrist_pitch_joint`, -pose.fx * 0.2);
      this.setUrdfJoint(`${sideName}_wrist_yaw_joint`, side * pose.grip * 0.18);
    }
    this.lockHumanoidUrdfFeet(crouch);
  }

  lockHumanoidUrdfFeet(crouch) {
    const model = this.parts.urdfModel;
    if (!model) return;
    const baseY = Number.isFinite(model.userData.stanceBaseY) ? model.userData.stanceBaseY : model.position.y;
    model.userData.stanceBaseY = baseY;
    model.position.y = baseY - crouch * HUMANOID_SQUAT_CONFIG.rootDrop;
    model.updateWorldMatrix(true, true);

    let lowestClearance = Infinity;
    let targetClearance = ROBOT_FOOT_GROUND_CLEARANCE;
    const contactObjects = model.userData.contactObjects || [model];
    for (const object of contactObjects) {
      const bounds = urdfContactBoundsForObject(object, this.variant);
      if (!bounds) continue;
      const ground = visualGroundForFootBounds(bounds);
      const target = ground.y > 0 ? ROBOT_FOOT_DECOR_CLEARANCE : ROBOT_FOOT_GROUND_CLEARANCE;
      const clearance = bounds.min.y - ground.y;
      if (clearance < lowestClearance) {
        lowestClearance = clearance;
        targetClearance = target;
      }
    }
    if (!Number.isFinite(lowestClearance)) return;
    model.position.y += targetClearance - lowestClearance;
    model.updateWorldMatrix(true, true);
  }

  syncQuadrupedUrdfPose() {
    const crouch = state.legs.crouch;
    for (const [prefix, side, end] of [
      ["FL", -1, -1],
      ["FR", 1, -1],
      ["RL", -1, 1],
      ["RR", 1, 1]
    ]) {
      const diagonalPhase = (side * end > 0 ? 0 : Math.PI) + this.phase;
      const gait = Math.sin(diagonalPhase) * state.walk;
      const lift = Math.max(0, Math.sin(diagonalPhase)) * state.walk;
      this.setUrdfJoint(`${prefix}_hip_joint`, side * 0.08 + crouch * side * 0.05);
      this.setUrdfJoint(`${prefix}_thigh_joint`, gait * 0.34 + crouch * 0.22);
      this.setUrdfJoint(`${prefix}_calf_joint`, Math.max(0, -gait) * 0.55 + crouch * 0.54 + lift * 0.26);
    }
  }

  syncMobileUrdfPose(time) {
    const sweep = Math.sin(time * 0.7) * 0.08;
    this.setUrdfJoint("sensor_head_pan_joint", sweep);
    this.setUrdfJoint("lidar_spin_joint", time * 0.8);
    for (const sideName of ["left", "right"]) {
      if (!robotArmEnabled(sideName)) continue;
      const side = sideName === "left" ? -1 : 1;
      const pose = this.armPose(sideName, this.pose, 0, time);
      this.setUrdfJoint(`${sideName}_shoulder_pitch_joint`, pose.sx * 0.82 - 0.16);
      this.setUrdfJoint(`${sideName}_shoulder_roll_joint`, side * (0.18 + pose.sz * 0.72));
      this.setUrdfJoint(`${sideName}_elbow_joint`, -0.32 - pose.fx * 0.72);
      this.setUrdfJoint(`${sideName}_wrist_pitch_joint`, -pose.fx * 0.22);
    }
  }

  setVariant(id) {
    const variant = ROBOT_VARIANTS[id] || ROBOT_VARIANTS["g1-29dof"];
    this.variant = variant;
    state.robotVariant = variant.id;
    this.group.name = variant.name;
    this.group.userData.robotVariant = variant;

    mat.robotWhite.color.setHex(variant.color);
    mat.robotBlack.color.setHex(variant.accent);
    richMat.robotPanel.color.setHex(variant.color);
    richMat.robotLens.color.setHex(variant.lens);
    updateRobotBodyCollision(physics.robotBody, variant);
    if (physics.robotBody) physics.robotBody.position.y = variant.bodyCenterY || ROBOT_BODY_HALF_HEIGHT;
    this.setRobotKind(variant.kind);
    this.applyQuadrupedVariant(variant);
    this.applyMobileVariant(variant);
    this.hideProceduralRig();

    const h = variant.heightScale;
    this.parts.pelvis.position.y = 0.68 * h;
    this.parts.pelvis.scale.set(variant.hipWidth, 1, variant.depthScale);
    this.parts.waist.position.y = 0.82 * h;
    this.parts.waist.scale.set(variant.hipWidth, variant.waistLocked ? 0.72 : 1, variant.depthScale);
    this.parts.torso.position.y = 1.04 * h;
    this.parts.torso.scale.set(0.88 * variant.torsoWidth, h, 0.62 * variant.depthScale);
    this.parts.chest.position.set(0, 1.08 * h, -0.143 * variant.depthScale);
    this.parts.neck.position.y = 1.3 * h;
    this.parts.head.position.set(0, 1.43 * h, -0.02);
    this.parts.head.scale.set(1.05 * variant.torsoWidth, h, 0.82 * variant.depthScale);
    this.parts.visor.position.set(0, 1.45 * h, -0.125 * variant.depthScale);
    this.parts.visor.scale.set(variant.torsoWidth, 1, variant.depthScale);

    const shoulderX = 0.31 * variant.shoulderWidth;
    const hipX = 0.12 * variant.hipWidth;
    this.parts.leftArm.shoulder.position.set(-shoulderX, 1.16 * h, 0);
    this.parts.rightArm.shoulder.position.set(shoulderX, 1.16 * h, 0);
    this.parts.leftArm.shoulder.scale.setScalar(variant.limbScale);
    this.parts.rightArm.shoulder.scale.setScalar(variant.limbScale);
    this.parts.leftLeg.hip.position.set(-hipX, 0.62 * h, 0);
    this.parts.rightLeg.hip.position.set(hipX, 0.62 * h, 0);
    this.parts.leftLeg.hip.scale.setScalar(variant.limbScale);
    this.parts.rightLeg.hip.scale.setScalar(variant.limbScale);
    this.parts.leftLeg.foot.scale.set(variant.footWidth, 1, variant.footLength);
    this.parts.rightLeg.foot.scale.set(variant.footWidth, 1, variant.footLength);
    this.parts.richDetails.scale.set(variant.shoulderWidth, h, variant.depthScale);
    if (variant.kind === "mobile") this.applyMobileArmMount(variant);

    const oldMap = this.parts.chest.material.map;
    this.parts.chest.material.map = createTextTexture(variant.badge);
    this.parts.chest.material.needsUpdate = true;
    oldMap?.dispose?.();

    this.hideProceduralRig();
    if (state.home.entered || state.home.entering) this.loadUrdfVariant(variant);
    else this.deferUrdfVariant(variant);

    const stage = document.getElementById("stage");
    if (stage) {
      stage.dataset.robotVariant = variant.id;
      stage.dataset.robotProfile = variant.profile;
      stage.dataset.robotKind = variant.kind;
      stage.dataset.robotSource = this.urdfSource;
      stage.dataset.robotHasLidar = String(!!variant.hasLidar);
      stage.dataset.robotWheelRadius = String(variant.wheelRadius || 0);
      stage.dataset.robotArmCapable = String(!!variant.armCapable);
    }
  }

  setRobotKind(kind) {
    const quadruped = kind === "quadruped";
    const mobile = kind === "mobile";
    this.parts.quadruped.group.visible = quadruped;
    this.parts.mobile.group.visible = mobile;
    for (const key of [
      "pelvis",
      "waist",
      "torso",
      "chest",
      "neck",
      "head",
      "visor",
      "richDetails"
    ]) {
      if (this.parts[key]) this.parts[key].visible = !quadruped && !mobile;
    }
    const armLayout = this.variant?.mobileArmLayout || "dual";
    this.parts.leftArm.shoulder.visible = !quadruped && (!mobile || armLayout === "dual");
    this.parts.rightArm.shoulder.visible = !quadruped && (!mobile || armLayout === "right" || armLayout === "dual");
    this.parts.leftLeg.hip.visible = !quadruped && !mobile;
    this.parts.rightLeg.hip.visible = !quadruped && !mobile;
    if (this.parts.urdfModel) this.hideProceduralRig();
  }

  applyQuadrupedVariant(variant) {
    const dog = this.parts.quadruped;
    if (!dog) return;
    const bodyWidth = variant.bodyWidth || 0.34;
    const bodyHeight = variant.bodyHeight || 0.22;
    const bodyLength = variant.bodyLength || 0.76;
    dog.body.scale.set(bodyWidth / 0.34, bodyHeight / 0.22, bodyLength / 0.76);
    dog.body.position.y = variant.bodyCenterY || 0.46;
    dog.topPanel.scale.set(bodyWidth / 0.34, 1, bodyLength / 0.76);
    dog.topPanel.position.y = dog.body.position.y + bodyHeight * 0.58;
    dog.spineLed.scale.set(1, 1, bodyLength / 0.76);
    dog.spineLed.position.y = dog.body.position.y + bodyHeight * 0.66;
    dog.head.position.set(0, dog.body.position.y + bodyHeight * 0.12, -bodyLength * 0.62);
    dog.head.scale.set(bodyWidth / 0.34, bodyHeight / 0.22, 1);
    dog.face.position.set(0, dog.head.position.y + 0.005, dog.head.position.z - 0.108);
    dog.faceLed.position.set(0, dog.head.position.y + 0.03, dog.head.position.z - 0.12);
    for (const lens of dog.frontLenses) {
      lens.position.y = dog.head.position.y + 0.005;
      lens.position.z = dog.head.position.z - 0.124;
      lens.scale.set(bodyWidth / 0.34, 0.72, 0.38);
    }
    for (const panel of dog.sidePanels) {
      const side = panel.position.x < 0 ? -1 : 1;
      panel.position.set((bodyWidth * 0.5 + 0.015) * side, dog.body.position.y, 0.02);
      panel.scale.set(1, bodyHeight / 0.22, bodyLength / 0.76);
    }
    for (const camera of dog.sideCameras) {
      const side = camera.position.x < 0 ? -1 : 1;
      camera.position.set((bodyWidth * 0.5 + 0.03) * side, dog.body.position.y + bodyHeight * 0.2, -bodyLength * 0.3);
    }
    dog.payloadDeck.scale.set(bodyWidth / 0.34, 1, bodyLength / 0.76);
    dog.payloadDeck.position.set(0, dog.body.position.y + bodyHeight * 0.72, 0.06);
    dog.railGroup.scale.set(bodyWidth / 0.34, 1, bodyLength / 0.76);
    dog.railGroup.position.y = dog.body.position.y + bodyHeight * 0.2;
    setRichSuppressed(dog.lidar, !variant.hasLidar);
    dog.lidar.position.set(0, dog.body.position.y + bodyHeight * 0.25, -bodyLength * 0.12);
    dog.rearLight.position.set(0, dog.body.position.y + bodyHeight * 0.25, bodyLength * 0.62);
    dog.rearLight.scale.set(bodyWidth / 0.34, 1, 1);
    dog.batteryDoor.position.set(0, dog.body.position.y, bodyLength * 0.6);
    dog.batteryDoor.scale.set(bodyWidth / 0.34, bodyHeight / 0.22, 1);

    for (const leg of dog.legs) {
      leg.hip.position.set(
        (variant.legSpreadX || 0.23) * leg.side,
        dog.body.position.y - bodyHeight * 0.18,
        (variant.legSpreadZ || 0.28) * leg.end
      );
      leg.hip.scale.setScalar(variant.legScale || 1);
      leg.foot.scale.set(variant.footWidth || 1, 1, variant.footLength || 1);
      const wheelRadius = variant.wheelRadius || 0;
      setRichSuppressed(leg.wheel, wheelRadius <= 0);
      leg.wheel.scale.setScalar(wheelRadius > 0 ? wheelRadius / 0.085 : 1);
      setRichSuppressed(leg.tread, wheelRadius > 0);
    }
  }

  applyMobileVariant(variant) {
    const mobile = this.parts.mobile;
    if (!mobile) return;
    const width = variant.mobileWidth || 0.66;
    const length = variant.mobileLength || 0.82;
    const height = variant.mobileHeight || 0.22;
    const deckY = variant.mobileDeckY || 0.3;
    const mastHeight = variant.mobileMastHeight || 0.58;
    const widthScale = width / 0.66;
    const lengthScale = length / 0.82;
    const heightScale = height / 0.22;

    mobile.base.scale.set(widthScale, heightScale, lengthScale);
    mobile.base.position.y = height * 0.85;
    mobile.deck.scale.set(widthScale, 1, lengthScale);
    mobile.deck.position.set(0, deckY, 0.03);
    mobile.bumperFront.scale.set(widthScale, 1, 1);
    mobile.bumperRear.scale.set(widthScale, 1, 1);
    mobile.bumperFront.position.set(0, height * 0.78, -length * 0.55);
    mobile.bumperRear.position.set(0, height * 0.78, length * 0.55);
    if (mobile.bodyBadge) {
      mobile.bodyBadge.position.set(0, height + 0.08, -length * 0.565);
      mobile.bodyBadge.scale.set(variant.mobileStyle === "station" ? 0.72 : 1, 1, 1);
      const oldMap = mobile.bodyBadge.material.map;
      mobile.bodyBadge.material.map = createTextTexture(variant.badge || "BOT");
      mobile.bodyBadge.material.needsUpdate = true;
      oldMap?.dispose?.();
    }
    if (mobile.emergencyStop) {
      mobile.emergencyStop.position.set(-width * 0.24, deckY + 0.05, -length * 0.28);
      setRichSuppressed(mobile.emergencyStop, !(variant.armCapable || variant.mobileStyle !== "tracked"));
    }
    for (const contact of mobile.dockContacts || []) {
      const x = contact.position.x < 0 ? -1 : 1;
      contact.position.set(width * 0.11 * x, height * 0.78, length * 0.56);
    }
    for (const detail of mobile.shellPanels || []) {
      if (detail.name.includes("side")) {
        const side = detail.position.x < 0 ? -1 : 1;
        detail.position.set((width * 0.5 + 0.02) * side, height * 0.98, 0);
        detail.scale.set(1, height / 0.22, length / 0.82);
      } else if (detail.name.includes("louver")) {
        const side = detail.position.x < 0 ? -1 : 1;
        detail.position.x = (width * 0.5 + 0.035) * side;
        detail.position.y = height + 0.02;
      } else if (detail.name.includes("rail")) {
        const side = detail.position.x < 0 ? -1 : 1;
        detail.position.set(width * 0.36 * side, deckY + 0.06, 0.03);
        detail.scale.z = length / 0.82;
        setRichSuppressed(detail, variant.mobileStyle === "tracked");
      }
    }

    mobile.mast.scale.set(widthScale * 0.86, mastHeight / 0.58, 1);
    mobile.mast.position.set(0, deckY + mastHeight * 0.5, 0.12);
    mobile.neck.position.set(0, deckY + mastHeight + 0.035, -0.02);
    mobile.head.position.set(0, deckY + mastHeight + 0.12, -0.08);
    mobile.screen.position.set(0, mobile.head.position.y, -0.151);
    mobile.lensBar.position.set(0, mobile.head.position.y + 0.02, -0.162);
    mobile.lidar.position.set(0, mobile.head.position.y + 0.095, -0.02);
    setRichSuppressed(mobile.lidar, variant.mobileStyle === "station");

    for (const led of mobile.statusLeds) {
      led.position.y = height + 0.06;
      led.position.z = -length * 0.54;
    }

    const wheelVisible = variant.mobileStyle !== "tracked" && variant.mobileStyle !== "station";
    for (const wheel of mobile.wheels) {
      const side = wheel.position.x < 0 ? -1 : 1;
      const end = wheel.position.z < 0 ? -1 : 1;
      wheel.position.set((width * 0.52) * side, height * 0.55, (length * 0.38) * end);
      wheel.scale.setScalar(variant.mobileStyle === "omni" ? 1.08 : 1);
      setRichSuppressed(wheel, !wheelVisible);
      for (const roller of wheel.userData.rollers || []) {
        roller.visible = variant.mobileStyle === "mecanum" || variant.mobileStyle === "omni";
      }
    }

    const trackVisible = variant.mobileStyle === "tracked";
    for (const track of mobile.tracks) {
      const side = track.position.x < 0 ? -1 : 1;
      track.position.set((width * 0.52) * side, height * 0.48, 0);
      track.scale.set(1, height / 0.2, length / 0.82);
      setRichSuppressed(track, !trackVisible);
    }
    setRichSuppressed(mobile.caster, variant.mobileStyle !== "station");
    mobile.caster.position.set(0, height * 0.42, length * 0.34);

    if (variant.mobileStyle === "station") {
      mobile.base.scale.set(widthScale, heightScale * 0.72, lengthScale);
      mobile.mast.position.y = deckY + mastHeight * 0.5;
    }
  }

  applyMobileArmMount(variant) {
    const layout = variant.mobileArmLayout || "none";
    const y = variant.mobileArmY || 0.9;
    const z = variant.mobileArmZ || -0.1;
    const offsetX = variant.mobileArmOffsetX || 0.19;
    const scale = variant.mobileArmScale || 1;

    this.parts.leftArm.shoulder.position.set(-offsetX, y, z);
    this.parts.rightArm.shoulder.position.set(layout === "dual" ? offsetX : 0, y, z);
    this.parts.leftArm.shoulder.scale.setScalar(scale);
    this.parts.rightArm.shoulder.scale.setScalar(scale);
    this.parts.leftArm.shoulder.rotation.set(0.48, -0.12, -0.16);
    this.parts.rightArm.shoulder.rotation.set(0.48, 0.12, 0.16);
  }

  update(dt, time) {
    const cadenceHz = state.walk > 0.03
      ? THREE.MathUtils.clamp(state.gaitSpeed / SPEED_CONFIG.nominalStepLength, 1.15, 3.15)
      : 0.55;
    this.phase += dt * cadenceHz * Math.PI * 2;
    const moving = state.walk > 0.03;
    const swing = Math.sin(this.phase) * state.walk;
    this.group.position.y += moving ? Math.abs(Math.sin(this.phase)) * 0.0025 : 0;

    if (this.variant.kind === "quadruped") {
      this.applyQuadrupedPose(dt);
      this.syncUrdfPose(swing, time);
      return;
    }

    if (this.variant.kind === "mobile") {
      this.applyMobilePose(swing, dt, time);
      this.syncUrdfPose(swing, time);
      return;
    }

    this.applyLegPose(swing, dt);

    const pose = this.pose;
    const armSwing = moving && pose === "idle" ? swing * 0.34 : 0;
    this.applyArm("left", this.armPose("left", pose, armSwing, time), dt);
    this.applyArm("right", this.armPose("right", pose, -armSwing, time), dt);
    this.syncUrdfPose(swing, time);
  }

  applyMobilePose(walkSwing, dt, time) {
    const variant = this.variant || ROBOT_VARIANTS[state.robotVariant];
    const mobile = this.parts.mobile;
    const k = 1 - Math.exp(-dt * 10);
    const moving = state.walk > 0.03;
    const deckY = variant.mobileDeckY || 0.3;
    const mastHeight = variant.mobileMastHeight || 0.58;
    const bodyY = (variant.mobileHeight || 0.22) * 0.85 + (moving ? Math.abs(Math.sin(this.phase * 2)) * 0.004 : 0);
    mobile.base.position.y = THREE.MathUtils.lerp(mobile.base.position.y, bodyY, k);
    mobile.deck.position.y = THREE.MathUtils.lerp(mobile.deck.position.y, deckY + (moving ? Math.abs(walkSwing) * 0.002 : 0), k);
    mobile.mast.rotation.z = THREE.MathUtils.lerp(mobile.mast.rotation.z, moving ? walkSwing * 0.025 : 0, k);
    mobile.head.rotation.y = THREE.MathUtils.lerp(mobile.head.rotation.y, Math.sin(time * 0.7) * 0.08, k);
    mobile.screen.rotation.y = mobile.head.rotation.y;
    mobile.lensBar.rotation.y = mobile.head.rotation.y;
    mobile.lidar.rotation.y += dt * (variant.mobileStyle === "station" ? 0.2 : 0.7);

    this.applyMobileArmMount(variant);
    const pose = this.pose;
    const armSwing = moving && pose === "idle" ? walkSwing * 0.12 : 0;
    if (robotArmEnabled("left")) this.applyArm("left", this.armPose("left", pose, armSwing, time), dt);
    if (robotArmEnabled("right")) this.applyArm("right", this.armPose("right", pose, -armSwing, time), dt);

    if (variant.mobileStyle !== "tracked") {
      for (const wheel of mobile.wheels) {
        wheel.rotation.x += dt * state.walk * 9;
        for (const roller of wheel.userData.rollers || []) roller.rotation.y += dt * state.walk * 13;
      }
    }
    for (const track of mobile.tracks) {
      track.rotation.x = THREE.MathUtils.lerp(track.rotation.x, moving ? walkSwing * 0.02 : 0, k);
    }
    for (const roller of mobile.trackRollers || []) roller.rotation.x += dt * state.walk * 7;
  }

  applyQuadrupedPose(dt) {
    const variant = this.variant || ROBOT_VARIANTS[state.robotVariant];
    const dog = this.parts.quadruped;
    const k = 1 - Math.exp(-dt * 10);
    const moving = state.walk > 0.03;
    const crouch = state.legs.crouch;
    const bodyY = (variant.bodyCenterY || 0.46) - crouch * 0.07 + (moving ? Math.abs(Math.sin(this.phase * 2)) * 0.008 : 0);
    dog.body.position.y = THREE.MathUtils.lerp(dog.body.position.y, bodyY, k);
    dog.topPanel.position.y = THREE.MathUtils.lerp(dog.topPanel.position.y, bodyY + (variant.bodyHeight || 0.22) * 0.58, k);
    dog.spineLed.position.y = THREE.MathUtils.lerp(dog.spineLed.position.y, bodyY + (variant.bodyHeight || 0.22) * 0.66, k);
    dog.head.position.y = THREE.MathUtils.lerp(dog.head.position.y, bodyY + (variant.bodyHeight || 0.22) * 0.12, k);
    dog.face.position.y = THREE.MathUtils.lerp(dog.face.position.y, dog.head.position.y + 0.005, k);
    dog.faceLed.position.y = THREE.MathUtils.lerp(dog.faceLed.position.y, dog.head.position.y + 0.03, k);

    for (let index = 0; index < dog.legs.length; index += 1) {
      const leg = dog.legs[index];
      const diagonalPhase = (leg.side * leg.end > 0 ? 0 : Math.PI) + this.phase;
      const gait = Math.sin(diagonalPhase) * state.walk;
      const lift = Math.max(0, Math.sin(diagonalPhase)) * state.walk;
      leg.hip.position.y = THREE.MathUtils.lerp(leg.hip.position.y, bodyY - (variant.bodyHeight || 0.22) * 0.18, k);
      leg.hip.rotation.x = THREE.MathUtils.lerp(leg.hip.rotation.x, gait * 0.34 + crouch * 0.22, k);
      leg.knee.rotation.x = THREE.MathUtils.lerp(leg.knee.rotation.x, Math.max(0, -gait) * 0.55 + crouch * 0.54 + lift * 0.26, k);
      leg.foot.rotation.x = THREE.MathUtils.lerp(leg.foot.rotation.x, -gait * 0.16, k);
    }
  }

  footMeshes() {
    if (this.variant.kind === "quadruped") return this.parts.quadruped.legs.map((leg) => leg.foot);
    if (this.variant.kind === "mobile") {
      const mobile = this.parts.mobile;
      return this.variant.mobileStyle === "tracked" ? mobile.tracks : mobile.wheels;
    }
    return [this.parts.leftLeg.foot, this.parts.rightLeg.foot];
  }

  applyLegPose(walkSwing, dt) {
    const variant = this.variant || ROBOT_VARIANTS[state.robotVariant];
    const h = variant.heightScale;
    const crouch = state.legs.crouch;
    const leftLift = state.legs.leftLift;
    const rightLift = state.legs.rightLift;
    const upperDrop = crouch * HUMANOID_SQUAT_CONFIG.rootDrop;
    const k = 1 - Math.exp(-dt * 10);

    this.parts.pelvis.position.y = THREE.MathUtils.lerp(this.parts.pelvis.position.y, 0.68 * h - upperDrop, k);
    this.parts.waist.position.y = THREE.MathUtils.lerp(this.parts.waist.position.y, 0.82 * h - upperDrop, k);
    this.parts.torso.position.y = THREE.MathUtils.lerp(this.parts.torso.position.y, 1.04 * h - upperDrop, k);
    this.parts.chest.position.y = THREE.MathUtils.lerp(this.parts.chest.position.y, 1.08 * h - upperDrop, k);
    this.parts.neck.position.y = THREE.MathUtils.lerp(this.parts.neck.position.y, 1.3 * h - upperDrop, k);
    this.parts.head.position.y = THREE.MathUtils.lerp(this.parts.head.position.y, 1.43 * h - upperDrop, k);
    this.parts.visor.position.y = THREE.MathUtils.lerp(this.parts.visor.position.y, 1.45 * h - upperDrop, k);

    const shoulderX = 0.31 * variant.shoulderWidth;
    this.parts.leftArm.shoulder.position.x = -shoulderX;
    this.parts.rightArm.shoulder.position.x = shoulderX;
    this.parts.leftArm.shoulder.position.y = THREE.MathUtils.lerp(this.parts.leftArm.shoulder.position.y, 1.16 * h - upperDrop, k);
    this.parts.rightArm.shoulder.position.y = THREE.MathUtils.lerp(this.parts.rightArm.shoulder.position.y, 1.16 * h - upperDrop, k);

    const hipX = 0.12 * variant.hipWidth;
    this.parts.leftLeg.hip.position.set(-hipX, 0.62 * h, 0);
    this.parts.rightLeg.hip.position.set(hipX, 0.62 * h, 0);

    const leftHipTarget = walkSwing * 0.42 + crouch * HUMANOID_SQUAT_CONFIG.hipPitch - leftLift * 0.58;
    const rightHipTarget = -walkSwing * 0.42 + crouch * HUMANOID_SQUAT_CONFIG.hipPitch - rightLift * 0.58;
    const leftShinTarget = Math.max(0, -walkSwing) * 0.38 + crouch * HUMANOID_SQUAT_CONFIG.kneePitch + leftLift * 0.82;
    const rightShinTarget = Math.max(0, walkSwing) * 0.38 + crouch * HUMANOID_SQUAT_CONFIG.kneePitch + rightLift * 0.82;
    this.parts.leftLeg.hip.rotation.x = THREE.MathUtils.lerp(this.parts.leftLeg.hip.rotation.x, leftHipTarget, k);
    this.parts.rightLeg.hip.rotation.x = THREE.MathUtils.lerp(this.parts.rightLeg.hip.rotation.x, rightHipTarget, k);
    this.parts.leftLeg.shin.rotation.x = THREE.MathUtils.lerp(this.parts.leftLeg.shin.rotation.x, leftShinTarget, k);
    this.parts.rightLeg.shin.rotation.x = THREE.MathUtils.lerp(this.parts.rightLeg.shin.rotation.x, rightShinTarget, k);
    this.parts.leftLeg.foot.rotation.x = THREE.MathUtils.lerp(this.parts.leftLeg.foot.rotation.x, crouch * HUMANOID_SQUAT_CONFIG.anklePitch + leftLift * 0.28, k);
    this.parts.rightLeg.foot.rotation.x = THREE.MathUtils.lerp(this.parts.rightLeg.foot.rotation.x, crouch * HUMANOID_SQUAT_CONFIG.anklePitch + rightLift * 0.28, k);
  }

  armPose(name, pose, armSwing, time) {
    const side = name === "left" ? -1 : 1;
    const manual = state.arms[name];
    const carrying = !!state.held[name];
    let base = { sx: 0.08 + armSwing, sz: 0.12 * side, fx: 0.08 };

    if (pose === "pregrasp" && name === state.activeArm) base = { sx: 0.9, sz: 0.08 * side, fx: 0.5 };
    else if (pose === "grasp" && name === state.activeArm) base = { sx: 1.08, sz: 0.06 * side, fx: 0.78 };
    else if (pose === "reach" && name === state.activeArm) base = { sx: 1.02, sz: 0.08 * side, fx: 0.72 };
    else if (pose === "place" && name === activeHeldArm()) base = { sx: 0.82, sz: 0.05 * side, fx: 0.55 };
    else if (carrying) base = { sx: 0.72, sz: 0.08 * side, fx: 0.45 };
    else {
      const idlePulse = Math.sin(time * 1.4 + (side > 0 ? 0.4 : 0)) * 0.018;
      base.sx += idlePulse;
    }

    return {
      sx: base.sx + manual.reach * 0.62 - manual.lift * 0.42,
      sz: base.sz - manual.lift * 0.22 * side,
      fx: base.fx + manual.reach * 0.26,
      grip: carrying ? 1 : manual.grip
    };
  }

  applyArm(name, target, dt) {
    const arm = this.parts[`${name}Arm`];
    const k = 1 - Math.exp(-dt * 10);
    arm.shoulder.rotation.x = THREE.MathUtils.lerp(arm.shoulder.rotation.x, target.sx, k);
    arm.shoulder.rotation.z = THREE.MathUtils.lerp(arm.shoulder.rotation.z, target.sz, k);
    arm.forearm.rotation.x = THREE.MathUtils.lerp(arm.forearm.rotation.x, target.fx, k);
    this.setFinger(arm, target.grip);
  }

  setFinger(arm, close) {
    const spread = THREE.MathUtils.lerp(0.056, 0.024, close);
    arm.leftFinger.position.x = -spread;
    arm.rightFinger.position.x = spread;
  }

  handWorld(name, out = new THREE.Vector3()) {
    this.parts[`${name}Arm`].wrist.updateWorldMatrix(true, false);
    return this.parts[`${name}Arm`].wrist.getWorldPosition(out);
  }
}

function createRobotBody() {
  const body = new CANNON.Body({
    mass: 5.8,
    material: physics.material,
    linearDamping: 0.48,
    angularDamping: 1,
    fixedRotation: true,
    allowSleep: false
  });
  updateRobotBodyCollision(body, ROBOT_VARIANTS[state.robotVariant]);
  body.position.set(0, ROBOT_BODY_HALF_HEIGHT, 2.55);
  body.updateMassProperties();
  physics.world.addBody(body);
  physics.robotBody = body;
}

function updateRobotBodyCollision(body = physics.robotBody, variant = ROBOT_VARIANTS[state.robotVariant]) {
  if (!body || !variant) return;
  body.shapes.length = 0;
  body.shapeOffsets.length = 0;
  body.shapeOrientations.length = 0;
  const halfExtents = variant.collisionHalfExtents || new THREE.Vector3(
    0.26 * Math.max(variant.torsoWidth, variant.shoulderWidth * 0.86),
    0.72 * variant.heightScale,
    0.24 * variant.depthScale
  );
  body.addShape(new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z)));
  body.updateBoundingRadius();
  body.aabbNeedsUpdate = true;
  body.updateMassProperties();
}

function setElementText(selector, key) {
  const element = document.querySelector(selector);
  if (element) element.textContent = t(key);
}

function setElementTitle(selector, key) {
  const element = document.querySelector(selector);
  if (element) element.title = t(key);
}

function setElementTextAt(selector, index, key) {
  const element = document.querySelectorAll(selector)[index];
  if (element) element.textContent = t(key);
}

function setupLanguageControls() {
  for (const select of document.querySelectorAll("[data-language-select]")) {
    if (!select.options.length) {
      for (const language of LANGUAGE_OPTIONS) {
        const option = document.createElement("option");
        option.value = language.code;
        option.textContent = language.label;
        select.appendChild(option);
      }
    }
    select.value = state.language;
    select.addEventListener("change", () => {
      state.language = setLanguage(select.value);
      applyTranslations();
      updateUi();
    });
  }
}

function syncLanguageControls() {
  for (const select of document.querySelectorAll("[data-language-select]")) {
    select.value = state.language;
  }
}

function applyTranslations() {
  document.title = t("app.title");
  setElementText(".home-brand", "home.nav");
  setElementText(".home-kicker", "home.kicker");
  setElementText(".home-hero h1", "home.title");
  setElementText(".home-copy", "home.copy");
  setElementText("#enter-lab", "home.enterLab");
  setElementText("#enter-objects", "home.objects");
  setElementTextAt(".home-panel span", 0, "home.platforms");
  setElementText(".home-panel strong", "home.speed");
  setElementTextAt(".home-panel span", 1, "home.scene");

  setElementText(".brand strong", "app.title");
  setElementText(".brand span", "app.subtitle");
  setElementText("#view-overview", "top.overview");
  setElementTitle("#view-overview", "top.overviewTitle");
  setElementText("#view-workbench", "top.living");
  setElementTitle("#view-workbench", "top.livingTitle");
  setElementText("#view-objects", "top.objects");
  setElementTitle("#view-objects", "top.objectsTitle");
  setElementText("#view-follow", "top.follow");
  setElementTitle("#view-follow", "top.followTitle");
  setElementText("#reset-scene", "top.reset");
  setElementTitle("#reset-scene", "top.resetTitle");

  for (const label of document.querySelectorAll(".language-control span")) label.textContent = t("language.label");
  setElementText("#status-panel .panel-title", "panel.robot");
  setElementText("#command-panel .panel-title", "panel.commands");
  [
    "status.robotVariant",
    "status.profile",
    "status.modelSource",
    "status.selected",
    "status.held",
    "status.activeArm",
    "status.legPose",
    "status.dropTarget",
    "status.sceneStyle"
  ].forEach((key, index) => setElementTextAt("#status-panel dt", index, key));
  ["meter.leftGrip", "meter.rightGrip", "meter.speed"].forEach((key, index) => setElementTextAt("#status-panel .meter span", index, key));

  setElementText("#grab-btn", "command.grab");
  setElementText("#place-btn", "command.place");
  setElementText("#release-btn", "command.release");
  setElementText("#home-btn", "command.home");
  setElementText("#arms-reset-btn", "command.resetArms");
  setElementText("#random-target-btn", "command.randomTarget");
  setElementText("#scatter-items-btn", "command.scatterItems");
  ["panel.sceneStyle", "panel.robotConfig", "panel.arm", "panel.leftArm", "panel.rightArm", "panel.legs", "panel.targets", "panel.items"]
    .forEach((key, index) => setElementTextAt("#command-panel .panel-subtitle", index, key));

  document.querySelector("[data-scene-mode='simple']").textContent = t("scene.simple");
  document.querySelector("[data-scene-mode='rich']").textContent = t("scene.rich");
  const fineButton = document.querySelector("[data-scene-upgrade='fine']");
  fineButton.textContent = t("scene.fine");
  fineButton.title = t("scene.fineTitle");

  for (const btn of document.querySelectorAll("#robot-variant-buttons [data-robot-variant]")) {
    btn.textContent = robotVariantLabel(btn.dataset.robotVariant).replace(/\sPreset$/i, "");
  }
  for (const btn of document.querySelectorAll("[data-arm-select]")) btn.textContent = t(`arm.${btn.dataset.armSelect}`);
  const armActionKeys = {
    "lift-up": "arm.liftUp",
    "lift-down": "arm.liftDown",
    "reach-out": "arm.reachOut",
    "reach-in": "arm.reachIn",
    "grip-close": "arm.gripClose",
    "grip-open": "arm.gripOpen"
  };
  for (const btn of document.querySelectorAll("[data-arm][data-arm-action]")) btn.textContent = t(armActionKeys[btn.dataset.armAction]);
  const legActionKeys = {
    stand: "leg.stand",
    "half-squat": "leg.halfSquat",
    "deep-squat": "leg.deepSquat",
    "left-step": "leg.leftStep",
    "right-step": "leg.rightStep",
    "legs-reset": "leg.reset"
  };
  for (const btn of document.querySelectorAll("[data-leg-action]")) btn.textContent = t(legActionKeys[btn.dataset.legAction]);

  setElementText(".toggle-line span", "toggle.autoFace");
  setElementText(".range-line span", "range.speed");
  const holdTitles = {
    "turn-left": "move.turnLeft",
    forward: "move.forward",
    "turn-right": "move.turnRight",
    left: "move.left",
    backward: "move.backward",
    right: "move.right"
  };
  for (const btn of document.querySelectorAll("[data-hold]")) btn.title = t(holdTitles[btn.dataset.hold]);

  setElementText("#contact-modal-title", "modal.fineTitle");
  setElementText("#contact-modal p", "modal.fineCopy");
  setElementText("#contact-modal-close", "modal.ok");

  for (const item of items) {
    if (item.label) item.label.textContent = itemLabel(item);
  }
  document.querySelectorAll("#item-list button").forEach((btn) => {
    const item = items.find((candidate) => candidate.id === btn.dataset.item);
    const nameEl = btn.querySelector(".item-name");
    if (item && nameEl) nameEl.textContent = itemLabel(item);
  });
  document.querySelectorAll("#target-list button").forEach((btn) => {
    const nameEl = btn.querySelector(".target-name");
    if (nameEl) nameEl.textContent = dropSpotLabel(btn.dataset.target);
  });
  syncLanguageControls();
}

function bindUi() {
  setupLanguageControls();
  applyTranslations();
  bindHomeScreen();
  document.getElementById("grab-btn").addEventListener("click", commandGrab);
  document.getElementById("place-btn").addEventListener("click", commandPlace);
  document.getElementById("release-btn").addEventListener("click", () => commandRelease(state.activeArm));
  document.getElementById("home-btn").addEventListener("click", () => moveRobotTo(new THREE.Vector3(0, 0, 2.55), Math.PI));
  document.getElementById("reset-scene").addEventListener("click", resetScene);
  document.getElementById("sidebar-toggle").addEventListener("click", () => setSidebarHidden(!state.sidebarHidden));
  document.getElementById("fullscreen-toggle").addEventListener("click", toggleFullscreen);
  document.getElementById("view-overview").addEventListener("click", () => setView("overview"));
  document.getElementById("view-workbench").addEventListener("click", () => setView("workbench"));
  document.getElementById("view-objects").addEventListener("click", () => setView("objects"));
  document.getElementById("view-follow").addEventListener("click", () => {
    state.follow = !state.follow;
    document.getElementById("view-follow").classList.toggle("active", state.follow);
    if (state.follow) setView("follow");
  });
  document.getElementById("auto-face").addEventListener("change", (event) => {
    state.autoFace = event.target.checked;
    if (!state.autoFace) state.pendingFaceTarget = null;
  });
  document.getElementById("speed-input").addEventListener("input", (event) => {
    state.moveSpeed = THREE.MathUtils.clamp(Number(event.target.value), SPEED_CONFIG.min, SPEED_CONFIG.max);
  });
  document.getElementById("arms-reset-btn").addEventListener("click", resetArms);
  document.getElementById("scatter-items-btn").addEventListener("click", scatterItems);
  for (const btn of document.querySelectorAll("[data-scene-mode]")) {
    btn.addEventListener("click", () => applySceneMode(btn.dataset.sceneMode, true));
  }
  for (const btn of document.querySelectorAll("[data-scene-upgrade]")) {
    btn.addEventListener("click", openContactModal);
  }
  document.getElementById("contact-modal-close").addEventListener("click", closeContactModal);
  document.getElementById("contact-modal").addEventListener("click", (event) => {
    if (event.target.id === "contact-modal") closeContactModal();
  });
  for (const btn of document.querySelectorAll("#robot-variant-buttons [data-robot-variant]")) {
    btn.addEventListener("click", () => setRobotVariant(btn.dataset.robotVariant));
  }
  document.getElementById("random-target-btn").addEventListener("click", () => {
    const target = pickRandomTarget();
    setTargetMarker(target);
    toast(t("toast.randomTarget", { target: targetLabel(target) }));
  });

  for (const btn of document.querySelectorAll("[data-arm-select]")) {
    btn.addEventListener("click", () => {
      state.activeArm = btn.dataset.armSelect;
      updateUi();
    });
  }

  for (const btn of document.querySelectorAll("[data-arm][data-arm-action]")) {
    btn.addEventListener("click", () => handleArmAction(btn.dataset.arm, btn.dataset.armAction));
  }

  for (const btn of document.querySelectorAll("[data-leg-action]")) {
    btn.addEventListener("click", () => handleLegAction(btn.dataset.legAction));
  }

  for (const btn of document.querySelectorAll("[data-hold]")) {
    const action = btn.dataset.hold;
    const start = (event) => {
      event.preventDefault();
      holds.add(action);
      btn.classList.add("active");
      btn.setPointerCapture?.(event.pointerId);
    };
    const stop = () => {
      holds.delete(action);
      btn.classList.remove("active");
    };
    btn.addEventListener("pointerdown", start);
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointercancel", stop);
    btn.addEventListener("pointerleave", stop);
    btn.addEventListener("click", () => {
      impulses.set(action, performance.now() + 650);
      wakeManualControl(action);
    });
  }

  window.addEventListener("keydown", (event) => {
    if (!state.home.entered) {
      if (event.code === "Enter" || event.code === "Space") {
        event.preventDefault();
        startExperience("rich", "overview");
      }
      return;
    }
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === "Space") {
      event.preventDefault();
      if (state.held[state.activeArm]) commandPlace();
      else commandGrab();
    }
    if (event.code === "Escape") {
      if (state.fullscreen) {
        event.preventDefault();
        exitFullscreenMode();
        return;
      }
      state.task = null;
      clearNavPath();
      robot.pose = "idle";
      toast(t("toast.cancelled"));
    }
    if (event.code === "KeyF") {
      event.preventDefault();
      toggleFullscreen();
    }
  });
  window.addEventListener("keyup", (event) => keys.delete(event.code));
  document.addEventListener("fullscreenchange", syncFullscreenState);

  renderer.domElement.addEventListener("pointerdown", (event) => mouseDown.set(event.clientX, event.clientY));
  renderer.domElement.addEventListener("pointerup", onCanvasPick);
  window.addEventListener("resize", onResize);
}

function bindHomeScreen() {
  const launch = (mode, view) => () => startExperience(mode, view);
  document.getElementById("enter-lab").addEventListener("click", launch("rich", "overview"));
  document.getElementById("enter-objects").addEventListener("click", launch("rich", "objects"));
}

function startExperience(mode = "simple", view = "overview") {
  if (state.home.entered || state.home.entering) return;
  if (mode !== state.sceneMode) applySceneMode(mode, false);
  const frame = viewFrame(view);
  state.home.entering = true;
  state.home.elapsed = 0;
  state.home.view = view;
  state.home.fromPosition.copy(camera.position);
  state.home.fromTarget.copy(controls.target);
  state.home.toPosition.copy(frame.position);
  state.home.toTarget.copy(frame.target);
  keys.clear();
  holds.clear();
  impulses.clear();
  controls.enabled = false;
  document.body.classList.add("home-entering");
  robot?.ensureUrdfLoaded();
}

function updateHomeCamera(dt, time) {
  if (!state.home.entered && !state.home.entering) {
    const orbit = time * 0.16;
    camera.position.set(
      Math.cos(orbit) * 7.4,
      4.35 + Math.sin(time * 0.38) * 0.12,
      7.1 + Math.sin(orbit) * 0.64
    );
    controls.target.lerp(new THREE.Vector3(-0.52, 0.84, -0.18), 1 - Math.exp(-dt * 1.5));
    return;
  }
  if (!state.home.entering) return;

  state.home.elapsed += dt;
  const progress = THREE.MathUtils.clamp(state.home.elapsed / state.home.duration, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  camera.position.lerpVectors(state.home.fromPosition, state.home.toPosition, eased);
  controls.target.lerpVectors(state.home.fromTarget, state.home.toTarget, eased);
  if (progress < 1) return;

  state.home.entering = false;
  state.home.entered = true;
  document.body.classList.remove("home-active", "home-entering");
  document.body.classList.add("app-entered");
  controls.enabled = true;
  setView(state.home.view);
  toast(state.sceneMode === "rich" ? t("toast.enterRich") : t("toast.enterSimple"));
}

function openContactModal() {
  const modal = document.getElementById("contact-modal");
  if (typeof modal.showModal === "function") {
    modal.showModal();
  } else {
    modal.setAttribute("open", "");
  }
  toast(t("toast.fineMode"));
}

function closeContactModal() {
  const modal = document.getElementById("contact-modal");
  if (typeof modal.close === "function") {
    modal.close();
  } else {
    modal.removeAttribute("open");
  }
}

function setSidebarHidden(hidden) {
  state.sidebarHidden = hidden;
  document.body.classList.toggle("sidebar-hidden", hidden);
  updateUi();
}

async function toggleFullscreen() {
  if (state.fullscreen) {
    await exitFullscreenMode();
  } else {
    await enterFullscreenMode();
  }
}

async function enterFullscreenMode() {
  state.fullscreenFallback = false;
  const target = document.getElementById("app") || document.documentElement;
  try {
    if (target.requestFullscreen) {
      await target.requestFullscreen({ navigationUI: "hide" });
    } else {
      state.fullscreenFallback = true;
    }
  } catch (error) {
    state.fullscreenFallback = true;
    console.warn("Fullscreen API unavailable, using immersive fallback", error);
  }
  state.fullscreen = true;
  applyFullscreenState();
  toast(state.fullscreenFallback ? t("toast.immersive") : t("toast.fullscreen"));
}

async function exitFullscreenMode() {
  const hadNativeFullscreen = !!document.fullscreenElement;
  try {
    if (hadNativeFullscreen) await document.exitFullscreen();
  } catch (error) {
    console.warn("Fullscreen exit failed", error);
  }
  state.fullscreenFallback = false;
  state.fullscreen = false;
  applyFullscreenState();
  toast(t("toast.exitFullscreen"));
}

function syncFullscreenState() {
  state.fullscreen = !!document.fullscreenElement || state.fullscreenFallback;
  if (!document.fullscreenElement) state.fullscreenFallback = false;
  applyFullscreenState();
}

function applyFullscreenState() {
  document.body.classList.toggle("fullscreen-active", state.fullscreen);
  if (stage) {
    stage.dataset.fullscreen = String(state.fullscreen);
    stage.dataset.fullscreenFallback = String(state.fullscreenFallback);
  }
  updateUi();
  onResize();
}

function setRobotVariant(id) {
  if (!robot) return;
  const nextVariant = ROBOT_VARIANTS[id] || ROBOT_VARIANTS["g1-29dof"];
  if (robot.variant?.id === nextVariant.id && ["URDF 加载中", "URDF 已加载"].includes(robot.urdfStatus)) {
    updateUi();
    return;
  }
  if (nextVariant.armCapable === false && anyHeld()) {
    for (const arm of ["left", "right"]) {
      if (state.held[arm]) releaseArmAtHand(arm);
    }
    state.task = null;
    clearNavPath();
  }
  if (nextVariant.mobileArmLayout === "right" && state.activeArm === "left") state.activeArm = "right";
  robot.setVariant(id);
  keepRobotFeetAboveFloor();
  updateUi();
  toast(t("toast.robotVariant", { name: robotVariantLabel(robot.variant), profile: robotProfileLabel(robot.variant) }));
}

function handleArmAction(arm, action) {
  if (!robotCanManipulate()) {
    toast(t("toast.noGripper"));
    return;
  }
  if (!robotArmEnabled(arm)) {
    toast(t("toast.armUnavailable"));
    return;
  }
  state.activeArm = arm;
  const ctl = state.arms[arm];
  if (action === "lift-up") ctl.lift = clamp01(ctl.lift + 0.22);
  if (action === "lift-down") ctl.lift = clamp01(ctl.lift - 0.22);
  if (action === "reach-out") ctl.reach = clamp01(ctl.reach + 0.22);
  if (action === "reach-in") ctl.reach = clamp01(ctl.reach - 0.22);
  if (action === "grip-close") {
    ctl.grip = clamp01(ctl.grip + 0.35);
    tryManualGrab(arm);
  }
  if (action === "grip-open") {
    ctl.grip = clamp01(ctl.grip - 0.35);
    if (state.held[arm] && ctl.grip < 0.35) releaseArmAtHand(arm);
  }
  updateUi();
}

function handleLegAction(action) {
  state.task = null;
  clearNavPath();
  if (action === "stand") {
    state.legs.crouch = 0;
    state.legs.leftLift = 0;
    state.legs.rightLift = 0;
  }
  if (action === "half-squat") {
    state.legs.crouch = 0.45;
    state.legs.leftLift = 0;
    state.legs.rightLift = 0;
  }
  if (action === "deep-squat") {
    state.legs.crouch = 0.85;
    state.legs.leftLift = 0;
    state.legs.rightLift = 0;
  }
  if (action === "left-step") {
    state.legs.leftLift = state.legs.leftLift > 0.1 ? 0 : 0.72;
    state.legs.rightLift = 0;
    state.legs.crouch = Math.max(state.legs.crouch, 0.22);
  }
  if (action === "right-step") {
    state.legs.rightLift = state.legs.rightLift > 0.1 ? 0 : 0.72;
    state.legs.leftLift = 0;
    state.legs.crouch = Math.max(state.legs.crouch, 0.22);
  }
  if (action === "legs-reset") {
    state.legs.crouch = 0;
    state.legs.leftLift = 0;
    state.legs.rightLift = 0;
  }
  robot.pose = anyHeld() ? "carry" : "idle";
  updateUi();
  toast(t("toast.legPose", { pose: legPoseLabel() }));
}

function resetArms() {
  if (!robotCanManipulate()) {
    toast(t("toast.noDualArm"));
    return;
  }
  for (const arm of ["left", "right"]) {
    if (!state.held[arm]) state.arms[arm].grip = 0.05;
    state.arms[arm].lift = 0;
    state.arms[arm].reach = 0;
  }
  robot.pose = anyHeld() ? "carry" : "idle";
  updateUi();
}

function tryManualGrab(arm) {
  if (!robotCanManipulate()) return;
  if (!robotArmEnabled(arm)) return;
  if (state.held[arm]) return;
  const item = nearestItemToHand(arm, 0.55);
  if (item) {
    attachItem(item, arm);
    selectItem(item);
    toast(t("toast.manualGrab", { arm: armLabel(arm), item: itemLabel(item) }));
  }
}

function onCanvasPick(event) {
  if (!state.home.entered) return;
  if (mouseDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 4) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickableMeshes, false);
  if (!hits.length) return;
  const item = items.find((candidate) => candidate.id === hits[0].object.userData.itemId);
  if (item) {
    selectItem(item);
    if (state.autoFace) queueAutoFace(item.group.position);
  }
}

function selectItem(item) {
  if (state.selected === item) return;
  state.selected = item;
  for (const candidate of items) {
    candidate.label.classList.toggle("selected", candidate === item);
    candidate.material.emissive.set(candidate === item ? 0x0b3329 : 0x000000);
  }
  updateUi();
}

function commandGrab() {
  if (!robotCanManipulate()) {
    toast(t("toast.unsupportedGrab"));
    return;
  }
  const arm = state.activeArm;
  if (!robotArmEnabled(arm)) {
    toast(t("toast.armUnavailable"));
    return;
  }
  if (state.held[arm]) {
    toast(t("toast.armOccupied", { arm: armLabel(arm) }));
    return;
  }
  if (!state.selected || state.selected.heldBy) selectItem(nearestFreeItem());
  if (!state.selected) {
    toast(t("toast.noGrabbable"));
    return;
  }
  state.task = {
    type: "grab",
    phase: "approach",
    arm,
    item: state.selected,
    stand: standPointForItem(state.selected),
    t: 0,
    path: null,
    waypoint: 0,
    pathGoalKey: ""
  };
  toast(t("toast.grab", { arm: armLabel(arm), item: itemLabel(state.selected) }));
}

function commandPlace() {
  if (!robotCanManipulate()) {
    toast(t("toast.unsupportedPlace"));
    return;
  }
  const arm = state.activeArm;
  if (!robotArmEnabled(arm)) {
    toast(t("toast.armUnavailable"));
    return;
  }
  if (!state.held[arm]) {
    toast(t("toast.armEmpty", { arm: armLabel(arm) }));
    return;
  }
  const item = state.held[arm];
  const target = state.selectedDropSpot ? targetFromDropSpot(state.selectedDropSpot, item, false) : pickRandomTarget(item);
  setTargetMarker(target);
  state.task = { type: "place", phase: "approach", arm, item, target, t: 0, path: null, waypoint: 0, pathGoalKey: "" };
  toast(t("toast.place", { arm: armLabel(arm), target: targetLabel(target) }));
}

function commandRelease(arm) {
  if (!robotCanManipulate()) {
    toast(t("toast.noRelease"));
    return;
  }
  if (!robotArmEnabled(arm)) {
    toast(t("toast.armUnavailable"));
    return;
  }
  if (!state.held[arm]) {
    toast(t("toast.emptyArm", { arm: armLabel(arm) }));
    return;
  }
  releaseArmAtHand(arm);
  state.task = null;
  clearNavPath();
  robot.pose = anyHeld() ? "carry" : "idle";
  toast(t("toast.released", { arm: armLabel(arm) }));
}

function nearestFreeItem() {
  let best = null;
  let bestDist = Infinity;
  for (const item of items) {
    if (item.heldBy) continue;
    const dist = item.group.position.distanceTo(robot.group.position);
    if (dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  return best;
}

function nearestItemToHand(arm, maxDist) {
  const hand = robot.handWorld(arm);
  let best = null;
  let bestDist = maxDist;
  for (const item of items) {
    if (item.heldBy) continue;
    const dist = item.group.position.distanceTo(hand);
    if (dist < bestDist) {
      best = item;
      bestDist = dist;
    }
  }
  return best;
}

function standPointForItem(item) {
  const p = item.group.position;
  if (item.id === "cup" || item.id === "remote" || item.id === "ball") {
    return new THREE.Vector3(p.x, 0, 0.42);
  }
  if (item.id === "book") {
    return new THREE.Vector3(p.x + 0.72, 0, p.z + 0.5);
  }
  if (item.id === "plant") {
    return new THREE.Vector3(p.x + 0.78, 0, p.z + 0.55);
  }
  const fromItem = robot.group.position.clone().sub(p);
  fromItem.y = 0;
  if (fromItem.lengthSq() < 0.01) fromItem.set(0, 0, 1);
  return p.clone().add(fromItem.normalize().multiplyScalar(0.82));
}

function attachItem(item, arm) {
  if (item.heldBy) return;
  item.heldBy = arm;
  state.held[arm] = item;
  state.arms[arm].grip = 1;
  physics.world.removeBody(item.body);
  robot.parts[`${arm}Arm`].wrist.attach(item.group);
  item.group.position.set(0, -0.09, -0.095);
  item.group.rotation.set(0, 0, 0);
  item.group.scale.setScalar(0.96);
  robot.pose = "carry";
  updateUi();
}

function releaseArmAtHand(arm, explicitPosition = null) {
  const item = state.held[arm];
  if (!item) return;
  const worldPos = explicitPosition || robot.handWorld(arm).add(new THREE.Vector3(0, 0.08, 0));
  const isFreeRelease = !explicitPosition;
  scene.attach(item.group);
  item.group.scale.setScalar(1);
  item.group.position.copy(worldPos);
  item.group.rotation.set(0, robot.group.rotation.y, 0);
  item.heldBy = null;
  item.placed = true;
  state.held[arm] = null;
  state.arms[arm].grip = Math.min(state.arms[arm].grip, 0.2);

  activateItemBody(item, worldPos, item.group.rotation, {
    velocityY: isFreeRelease ? -0.35 : 0
  });
  selectItem(item);
  updateUi();
}

function activateItemBody(item, position, rotation = null, options = {}) {
  const body = item.body;
  if (!physics.world.bodies.includes(body)) physics.world.addBody(body);
  body.position.set(position.x, position.y, position.z);
  body.previousPosition?.set(position.x, position.y, position.z);
  body.interpolatedPosition?.set(position.x, position.y, position.z);
  if (rotation) body.quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
  body.velocity.set(0, options.velocityY ?? 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.force.set(0, 0, 0);
  body.torque.set(0, 0, 0);
  body.aabbNeedsUpdate = true;
  body.wakeUp();
}

function updateTask(dt) {
  if (!state.task) {
    robot.pose = anyHeld() ? "carry" : "idle";
    return;
  }

  const task = state.task;
  task.t += dt;

  if (task.type === "grab") {
    if (!task.item || task.item.heldBy) {
      state.task = null;
      return;
    }
    const target = task.item.group.position.clone();
    const stop = navigateToward(task, task.stand, dt, 0.18);
    if (task.phase === "approach") {
      robot.pose = "idle";
      state.arms[task.arm].grip = THREE.MathUtils.damp(state.arms[task.arm].grip, 0.02, 8, dt);
      if (stop) {
        facePoint(target, dt);
        task.phase = "pregrasp";
        task.t = 0;
      }
      return;
    }
    if (task.phase === "pregrasp") {
      facePoint(target, dt);
      robot.pose = "pregrasp";
      state.activeArm = task.arm;
      state.arms[task.arm].reach = THREE.MathUtils.damp(state.arms[task.arm].reach, 0.48, 8, dt);
      state.arms[task.arm].lift = THREE.MathUtils.damp(state.arms[task.arm].lift, 0.06, 8, dt);
      state.arms[task.arm].grip = THREE.MathUtils.damp(state.arms[task.arm].grip, 0.02, 10, dt);
      if (task.t > 0.34) {
        task.phase = "close";
        task.t = 0;
      }
      return;
    }
    if (task.phase === "close") {
      facePoint(target, dt);
      robot.pose = "grasp";
      state.activeArm = task.arm;
      state.arms[task.arm].reach = THREE.MathUtils.damp(state.arms[task.arm].reach, 0.72, 9, dt);
      state.arms[task.arm].lift = THREE.MathUtils.damp(state.arms[task.arm].lift, 0.02, 8, dt);
      state.arms[task.arm].grip = THREE.MathUtils.damp(state.arms[task.arm].grip, 1, 9, dt);
      const handDistance = robot.handWorld(task.arm).distanceTo(task.item.group.position);
      if (task.t > 0.46 || (task.t > 0.25 && handDistance < 0.62)) {
        attachItem(task.item, task.arm);
        task.phase = "lift";
        task.t = 0;
      }
      return;
    }
    if (task.phase === "lift") {
      state.arms[task.arm].reach = THREE.MathUtils.damp(state.arms[task.arm].reach, 0.36, 8, dt);
      state.arms[task.arm].lift = THREE.MathUtils.damp(state.arms[task.arm].lift, 0.45, 8, dt);
      robot.pose = "carry";
      if (task.t > 0.45) {
        state.task = null;
        clearNavPath(task);
        toast(t("toast.grabbed", { item: itemLabel(task.item) }));
      }
    }
  }

  if (task.type === "place") {
    const stand = task.target.position.clone().add(task.target.standOffset);
    if (task.phase === "approach") {
      const arrived = navigateToward(task, stand, dt, 0.34);
      robot.pose = "carry";
      if (arrived) {
        facePoint(task.target.position, dt);
        task.phase = "lower";
        task.t = 0;
      }
      return;
    }
    if (task.phase === "lower") {
      facePoint(task.target.position, dt);
      robot.pose = "place";
      state.arms[task.arm].reach = THREE.MathUtils.damp(state.arms[task.arm].reach, 0.7, 8, dt);
      state.arms[task.arm].lift = THREE.MathUtils.damp(state.arms[task.arm].lift, 0.15, 8, dt);
      if (task.t > 0.55) {
        releaseArmAtHand(task.arm, task.target.position.clone());
        task.phase = "done";
        task.t = 0;
      }
      return;
    }
    if (task.phase === "done" && task.t > 0.32) {
      state.task = null;
      clearNavPath(task);
      robot.pose = anyHeld() ? "carry" : "idle";
      toast(t("toast.placed", { target: targetLabel(task.target) }));
    }
  }
}

function pickRandomTarget(item = null) {
  const options = dropSpots.filter((spot) => spot.name !== state.lastTarget);
  const base = options[Math.floor(Math.random() * options.length)] || dropSpots[0];
  state.selectedDropSpot = null;
  return targetFromDropSpot(base, item, true);
}

function scatterItems() {
  const freeItems = items.filter((item) => !item.heldBy);
  if (!freeItems.length || !dropSpots.length) {
    toast(t("toast.noScatter"));
    return;
  }
  const shuffledSpots = [...dropSpots].sort(() => Math.random() - 0.5);
  freeItems.forEach((item, index) => {
    const spot = shuffledSpots[index % shuffledSpots.length];
    const target = randomPointOnDropSpot(spot, item);
    item.group.position.copy(target.position);
    item.group.rotation.set(0, Math.random() * Math.PI * 2, 0);
    item.group.quaternion.normalize();
    item.placed = false;
    activateItemBody(item, target.position, item.group.rotation);
  });
  if (freeItems[0]) selectItem(freeItems[0]);
  state.task = null;
  clearNavPath();
  robot.pose = anyHeld() ? "carry" : "idle";
  updateUi();
  toast(t("toast.scatter"));
}

function randomPointOnDropSpot(base, item) {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * base.radius;
  return {
    name: base.name,
    surfaceY: base.position.y,
    position: new THREE.Vector3(
      base.position.x + Math.cos(angle) * radius,
      base.position.y + item.height / 2 + 0.04,
      base.position.z + Math.sin(angle) * radius
    ),
    standOffset: base.standOffset.clone()
  };
}

function selectDropSpot(name) {
  const spot = dropSpots.find((candidate) => candidate.name === name);
  if (!spot) return;
  state.selectedDropSpot = spot;
  const target = targetFromDropSpot(spot, state.held[state.activeArm], false);
  setTargetMarker(target);
  toast(t("toast.targetSelected", { target: targetLabel(target) }));
}

function targetFromDropSpot(base, item = null, randomize = false) {
  const angle = Math.random() * Math.PI * 2;
  const radius = randomize ? Math.sqrt(Math.random()) * base.radius : 0;
  const centerY = base.position.y + (item ? item.height / 2 + 0.035 : 0.08);
  const target = {
    name: base.name,
    surfaceY: base.position.y,
    position: new THREE.Vector3(
      base.position.x + Math.cos(angle) * radius,
      centerY,
      base.position.z + Math.sin(angle) * radius
    ),
    standOffset: base.standOffset.clone()
  };
  state.lastTarget = base.name;
  state.currentTarget = target;
  updateUi();
  return target;
}

function setTargetMarker(target) {
  if (!world?.targetMarker) return;
  world.targetMarker.visible = true;
  world.targetMarker.position.set(target.position.x, Math.max(0.045, target.surfaceY + 0.018), target.position.z);
}

function approachPoint(point, distance, dt) {
  const to = point.clone().sub(robot.group.position);
  to.y = 0;
  const d = to.length();
  if (d > distance + 0.06) {
    const dest = point.clone().sub(to.normalize().multiplyScalar(distance));
    moveToward(dest, dt);
    facePoint(point, dt);
    return false;
  }
  setRobotPlanarVelocity(new THREE.Vector3());
  facePoint(point, dt);
  updateGait(0, dt);
  return true;
}

function moveToward(dest, dt, arriveDistance = 0.06) {
  const to = dest.clone().sub(robot.group.position);
  to.y = 0;
  const dist = to.length();
  if (dist < arriveDistance) {
    setRobotPlanarVelocity(new THREE.Vector3());
    updateGait(0, dt);
    return true;
  }
  const dir = to.normalize();
  const desiredYaw = yawForDirection(dir);
  robot.group.rotation.y = dampAngle(robot.group.rotation.y, desiredYaw, 10, dt);
  const yawError = Math.abs(angleDelta(robot.group.rotation.y, desiredYaw));
  const targetSpeed = state.moveSpeed * SPEED_CONFIG.taskMultiplier;
  const turnScale = THREE.MathUtils.clamp(
    (NAV_CONFIG.turnStopAngle - yawError) / (NAV_CONFIG.turnStopAngle - NAV_CONFIG.turnSlowdownAngle),
    0,
    1
  );
  const speedScale = yawError > NAV_CONFIG.turnSlowdownAngle ? turnScale * 0.55 : 1;
  const moveSpeed = targetSpeed * speedScale;
  const forward = robotForward();
  setRobotPlanarVelocity(forward.multiplyScalar(sceneVelocityForSpeed(moveSpeed)));
  updateGait(yawError > 0.04 ? Math.max(moveSpeed, SPEED_CONFIG.min) : moveSpeed, dt);
  return false;
}

function navigateToward(task, dest, dt, arriveDistance = 0.08) {
  const planarDest = dest.clone();
  planarDest.y = 0;
  const reachableDest = nearestFreeNavPoint(clampNavPoint(planarDest));
  const planarRobot = robot.group.position.clone();
  planarRobot.y = 0;
  if (planarRobot.distanceTo(reachableDest) < arriveDistance) {
    clearNavPath(task);
    setRobotPlanarVelocity(new THREE.Vector3());
    updateGait(0, dt);
    return true;
  }

  const goalKey = `${reachableDest.x.toFixed(2)},${reachableDest.z.toFixed(2)}`;
  if (!task.path || task.pathGoalKey !== goalKey || task.waypoint >= task.path.length) {
    task.path = planPath(planarRobot, reachableDest);
    task.pathGoalKey = goalKey;
    task.waypoint = 0;
    updateNavPathVisual(task.path);
  }

  if (!task.path?.length) {
    setRobotPlanarVelocity(new THREE.Vector3());
    updateGait(0, dt);
    updateNavPathVisual([]);
    return false;
  }
  if (hasLineOfSight(planarRobot, reachableDest)) {
    task.path = [reachableDest.clone()];
    task.waypoint = 0;
    updateNavPathVisual(task.path);
  }

  let waypoint = task.path[task.waypoint] || reachableDest;
  while (task.waypoint < task.path.length - 1 && planarRobot.distanceTo(waypoint) < NAV_CONFIG.waypointReach) {
    task.waypoint += 1;
    waypoint = task.path[task.waypoint];
  }
  if (!hasLineOfSight(planarRobot, waypoint)) {
    task.path = planPath(planarRobot, reachableDest);
    task.waypoint = 0;
    updateNavPathVisual(task.path);
    waypoint = task.path[0] || reachableDest;
  }
  const arrivedAtWaypoint = moveToward(waypoint, dt, task.waypoint === task.path.length - 1 ? arriveDistance : NAV_CONFIG.waypointReach);
  if (arrivedAtWaypoint && task.waypoint < task.path.length - 1) task.waypoint += 1;
  if (arrivedAtWaypoint && task.waypoint >= task.path.length - 1) {
    clearNavPath(task);
    return true;
  }
  return false;
}

function clearNavPath(task = null) {
  if (task) {
    task.path = null;
    task.waypoint = 0;
  }
  if (world?.navPath) world.navPath.visible = false;
}

function planPath(start, goal) {
  const clampedStart = clampNavPoint(start);
  const clampedGoal = nearestFreeNavPoint(clampNavPoint(goal));
  resetNavPlannerStats("searching");
  if (hasLineOfSight(clampedStart, clampedGoal)) {
    updateNavPlannerStats({
      status: "direct",
      reason: "line-of-sight",
      lastPathLength: 1
    });
    return [clampedGoal];
  }

  const startCell = nearestFreeCell(worldToNavCell(clampedStart));
  const goalCell = nearestFreeCell(worldToNavCell(clampedGoal));
  const startNode = { ...startCell, g: 0, f: navHeuristic(startCell, goalCell), parent: null };
  const open = new MinPriorityQueue((a, b) => a.f - b.f || a.g - b.g);
  open.push(startNode);
  const best = new Map([[navCellKey(startCell.x, startCell.z), startNode]]);
  const closed = new Set();
  const maxIterations = 2400;
  const dirs = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1]
  ];
  navPlannerStats.openMax = 1;

  for (let i = 0; open.length && i < maxIterations; i += 1) {
    navPlannerStats.iterations = i + 1;
    const current = open.pop();
    if (!current) break;
    const key = navCellKey(current.x, current.z);
    if (closed.has(key)) continue;
    if (current.x === goalCell.x && current.z === goalCell.z) {
      const path = smoothNavPath(reconstructNavPath(current));
      updateNavPlannerStats({
        status: "planned",
        reason: "astar",
        lastPathLength: path.length
      });
      return path;
    }
    closed.add(key);
    navPlannerStats.expanded += 1;

    for (const [dx, dz] of dirs) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      const nextKey = navCellKey(nx, nz);
      if (closed.has(nextKey) || isNavCellBlocked(nx, nz)) continue;
      if (dx && dz && (isNavCellBlocked(current.x + dx, current.z) || isNavCellBlocked(current.x, current.z + dz))) continue;
      const stepCost = dx && dz ? Math.SQRT2 : 1;
      const g = current.g + stepCost;
      const known = best.get(nextKey);
      if (known && g >= known.g) continue;
      const node = { x: nx, z: nz, g, f: g + navHeuristic({ x: nx, z: nz }, goalCell), parent: current };
      best.set(nextKey, node);
      open.push(node);
      navPlannerStats.generated += 1;
      navPlannerStats.openMax = Math.max(navPlannerStats.openMax, open.length);
    }
  }

  updateNavPlannerStats({
    status: "failed",
    reason: open.length ? "iteration-limit" : "no-open-nodes",
    lastPathLength: 0
  });
  return [];
}

function resetNavPlannerStats(status = "idle") {
  navPlannerStats.status = status;
  navPlannerStats.reason = "";
  navPlannerStats.iterations = 0;
  navPlannerStats.expanded = 0;
  navPlannerStats.generated = 0;
  navPlannerStats.openMax = 0;
  navPlannerStats.lastPathLength = 0;
}

function updateNavPlannerStats(patch) {
  Object.assign(navPlannerStats, patch);
}

function navPlannerStatsSnapshot() {
  return {
    status: navPlannerStats.status,
    reason: navPlannerStats.reason,
    iterations: navPlannerStats.iterations,
    expanded: navPlannerStats.expanded,
    generated: navPlannerStats.generated,
    openMax: navPlannerStats.openMax,
    lastPathLength: navPlannerStats.lastPathLength
  };
}

function reconstructNavPath(node) {
  const path = [];
  let current = node;
  while (current) {
    path.push(navCellToWorld(current));
    current = current.parent;
  }
  return path.reverse();
}

function smoothNavPath(path) {
  if (path.length <= 2) return path;
  const smoothed = [path[0]];
  let anchor = 0;
  while (anchor < path.length - 1) {
    let next = path.length - 1;
    while (next > anchor + 1 && !hasLineOfSight(path[anchor], path[next])) next -= 1;
    smoothed.push(path[next]);
    anchor = next;
  }
  return smoothed;
}

function updateNavPathVisual(path = []) {
  if (!world?.navPath) return;
  if (!path.length) {
    world.navPath.visible = false;
    return;
  }
  const points = [robot.group.position.clone(), ...path].map((point) => new THREE.Vector3(point.x, 0.075, point.z));
  world.navPath.geometry.dispose();
  world.navPath.geometry = new THREE.BufferGeometry().setFromPoints(points);
  world.navPath.visible = true;
}

function hasLineOfSight(from, to) {
  const a = clampNavPoint(from);
  const b = clampNavPoint(to);
  if (!pointInNavBounds(a) || !pointInNavBounds(b)) return false;
  const clearance = robotNavClearance();
  return !navObstacles.some((obstacle) => segmentIntersectsInflatedBox(a, b, obstacle, clearance));
}

function segmentIntersectsInflatedBox(from, to, obstacle, padding) {
  const minX = obstacle.minX - padding;
  const maxX = obstacle.maxX + padding;
  const minZ = obstacle.minZ - padding;
  const maxZ = obstacle.maxZ + padding;
  if (pointInsideBox2(from, minX, maxX, minZ, maxZ) || pointInsideBox2(to, minX, maxX, minZ, maxZ)) return true;
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let tMin = 0;
  let tMax = 1;
  for (const [origin, direction, min, max] of [
    [from.x, dx, minX, maxX],
    [from.z, dz, minZ, maxZ]
  ]) {
    if (Math.abs(direction) < 1e-6) {
      if (origin < min || origin > max) return false;
      continue;
    }
    const t1 = (min - origin) / direction;
    const t2 = (max - origin) / direction;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }
  return true;
}

function robotNavClearance() {
  const variant = robot?.variant || ROBOT_VARIANTS[state.robotVariant];
  const halfExtents = variant?.collisionHalfExtents;
  const robotRadius = halfExtents ? Math.max(halfExtents.x, halfExtents.z) : NAV_CONFIG.clearance;
  return Math.max(NAV_CONFIG.clearance, robotRadius + NAV_CONFIG.obstacleMargin);
}

function pointInsideBox2(point, minX, maxX, minZ, maxZ) {
  return point.x >= minX && point.x <= maxX && point.z >= minZ && point.z <= maxZ;
}

function worldToNavCell(point) {
  return {
    x: Math.round((point.x - NAV_CONFIG.minX) / NAV_CONFIG.cellSize),
    z: Math.round((point.z - NAV_CONFIG.minZ) / NAV_CONFIG.cellSize)
  };
}

function navCellToWorld(cell) {
  return new THREE.Vector3(
    NAV_CONFIG.minX + cell.x * NAV_CONFIG.cellSize,
    0,
    NAV_CONFIG.minZ + cell.z * NAV_CONFIG.cellSize
  );
}

function navCellKey(x, z) {
  return `${x}:${z}`;
}

function navHeuristic(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function isNavCellBlocked(x, z) {
  const point = navCellToWorld({ x, z });
  if (!pointInNavBounds(point)) return true;
  const clearance = robotNavClearance();
  return navObstacles.some((obstacle) =>
    point.x >= obstacle.minX - clearance &&
    point.x <= obstacle.maxX + clearance &&
    point.z >= obstacle.minZ - clearance &&
    point.z <= obstacle.maxZ + clearance
  );
}

function nearestFreeCell(cell) {
  if (!isNavCellBlocked(cell.x, cell.z)) return cell;
  for (let radius = 1; radius <= 8; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (Math.abs(dx) !== radius && Math.abs(dz) !== radius) continue;
        const candidate = { x: cell.x + dx, z: cell.z + dz };
        if (!isNavCellBlocked(candidate.x, candidate.z)) return candidate;
      }
    }
  }
  return cell;
}

function nearestFreeNavPoint(point) {
  return navCellToWorld(nearestFreeCell(worldToNavCell(point)));
}

function clampNavPoint(point) {
  return new THREE.Vector3(
    THREE.MathUtils.clamp(point.x, NAV_CONFIG.minX, NAV_CONFIG.maxX),
    0,
    THREE.MathUtils.clamp(point.z, NAV_CONFIG.minZ, NAV_CONFIG.maxZ)
  );
}

function pointInNavBounds(point) {
  return point.x >= NAV_CONFIG.minX && point.x <= NAV_CONFIG.maxX && point.z >= NAV_CONFIG.minZ && point.z <= NAV_CONFIG.maxZ;
}

function updateManual(dt) {
  if (!state.home.entered) return;
  if (state.task) return;
  let forwardAxis = 0;
  let strafeAxis = 0;

  if (keys.has("KeyW") || keys.has("ArrowUp") || controlActive("forward")) forwardAxis += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown") || controlActive("backward")) forwardAxis -= 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft") || controlActive("left")) strafeAxis -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight") || controlActive("right")) strafeAxis += 1;

  const humanoid = robot.variant.kind === "humanoid";
  const lateralTurnAxis = humanoid ? -strafeAxis : 0;
  const turnLeft = keys.has("KeyQ") || controlActive("turn-left") || lateralTurnAxis > 0;
  const turnRight = keys.has("KeyE") || controlActive("turn-right") || lateralTurnAxis < 0;
  if (turnLeft) robot.group.rotation.y += dt * SPEED_CONFIG.turnRate;
  if (turnRight) robot.group.rotation.y -= dt * SPEED_CONFIG.turnRate;
  if (humanoid) strafeAxis *= SPEED_CONFIG.humanoidSideStepRatio;

  const move = robotLocalMoveVector(forwardAxis, strafeAxis);
  let gaitTarget = 0;
  if (move.lengthSq() > 0) {
    move.normalize();
    setRobotPlanarVelocity(move.multiplyScalar(sceneVelocityForSpeed(state.moveSpeed)));
    gaitTarget = state.moveSpeed;
  } else {
    setRobotPlanarVelocity(new THREE.Vector3());
  }

  const moving = move.lengthSq() > 0 || turnLeft || turnRight;
  if (!gaitTarget && moving) gaitTarget = SPEED_CONFIG.min;
  updateGait(gaitTarget, dt);
  robot.pose = anyHeld() ? "carry" : "idle";
}

function sceneVelocityForSpeed(realMetersPerSecond) {
  return realMetersPerSecond * SPEED_CONFIG.sceneScale;
}

function updateGait(realMetersPerSecond, dt) {
  state.gaitCommandSpeed = realMetersPerSecond;
}

function updateGaitFromActualMotion(dt) {
  if (!robot || dt <= 0) return;
  const x = robot.group.position.x;
  const z = robot.group.position.z;
  const yaw = robot.group.rotation.y;
  if (!robotMotionTracker.initialized) {
    robotMotionTracker.initialized = true;
    robotMotionTracker.x = x;
    robotMotionTracker.z = z;
    robotMotionTracker.yaw = yaw;
    state.gaitSpeed = 0;
    state.walk = 0;
    return;
  }

  const sceneDistance = Math.hypot(x - robotMotionTracker.x, z - robotMotionTracker.z);
  const yawDelta = Math.abs(angleDelta(robotMotionTracker.yaw, yaw));
  robotMotionTracker.x = x;
  robotMotionTracker.z = z;
  robotMotionTracker.yaw = yaw;

  const moveSpeed = sceneDistance / dt / SPEED_CONFIG.sceneScale;
  const turnSpeed = (yawDelta / dt) * SPEED_CONFIG.turnStepRadius;
  const measuredSpeed = Math.max(moveSpeed, turnSpeed);
  const commandedSpeed = Math.max(0, state.gaitCommandSpeed || 0);
  const hasActualMotion = measuredSpeed > 0.035;
  const visualFloor = robot.variant.kind === "humanoid" && hasActualMotion
    ? commandedSpeed * SPEED_CONFIG.humanoidVisualGaitRatio
    : 0;
  const targetSpeed = commandedSpeed > 0 ? Math.min(Math.max(measuredSpeed, visualFloor), commandedSpeed) : 0;
  state.gaitActualSpeed = targetSpeed;
  state.gaitSpeed = THREE.MathUtils.damp(state.gaitSpeed, targetSpeed, 10, dt);
  state.walk = THREE.MathUtils.clamp(state.gaitSpeed / SPEED_CONFIG.max, 0, 1);
}

function robotLocalMoveVector(forwardAxis, strafeAxis) {
  const forward = robotForward();
  const right = robotRight();
  return forward.multiplyScalar(forwardAxis).add(right.multiplyScalar(strafeAxis));
}

function controlActive(action) {
  if (holds.has(action)) return true;
  const until = impulses.get(action) || 0;
  if (until > performance.now()) return true;
  if (until) impulses.delete(action);
  return false;
}

function wakeManualControl(action) {
  if (!physics.robotBody || state.task || !state.home.entered) return;
  if (action === "turn-left") robot.group.rotation.y += 0.16;
  if (action === "turn-right") robot.group.rotation.y -= 0.16;
  physics.robotBody.wakeUp();
  syncRobotFromPhysics();
}

function setRobotPlanarVelocity(velocity) {
  const body = physics.robotBody;
  body.wakeUp();
  const maxVelocity = sceneVelocityForSpeed(SPEED_CONFIG.max * SPEED_CONFIG.taskMultiplier);
  if (velocity.length() > maxVelocity) velocity.setLength(maxVelocity);
  body.velocity.x = velocity.x;
  body.velocity.z = velocity.z;
}

function syncRobotFromPhysics() {
  const body = physics.robotBody;
  const visualBaseY = Math.max(
    ROBOT_FOOT_VISUAL_OFFSET,
    body.position.y - ROBOT_BODY_HALF_HEIGHT + ROBOT_FOOT_VISUAL_OFFSET
  );
  robot.group.position.set(
    body.position.x,
    visualBaseY + robotSurfaceLift,
    body.position.z
  );
  const q = new CANNON.Quaternion();
  q.setFromEuler(0, robot.group.rotation.y, 0);
  body.quaternion.copy(q);
}

function clampToRange(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function projectedBoundsOverlapBox(box, layer) {
  return box.max.x >= layer.minX && box.min.x <= layer.maxX && box.max.z >= layer.minZ && box.min.z <= layer.maxZ;
}

function projectedBoundsOverlapRing(box, layer) {
  const closestX = clampToRange(layer.x, box.min.x, box.max.x);
  const closestZ = clampToRange(layer.z, box.min.z, box.max.z);
  const closestDistSq = (closestX - layer.x) ** 2 + (closestZ - layer.z) ** 2;
  if (closestDistSq > layer.outer ** 2) return false;

  const corners = [
    [box.min.x, box.min.z],
    [box.min.x, box.max.z],
    [box.max.x, box.min.z],
    [box.max.x, box.max.z]
  ];
  const farthestDistSq = corners.reduce((maxDist, [x, z]) => {
    const distSq = (x - layer.x) ** 2 + (z - layer.z) ** 2;
    return Math.max(maxDist, distSq);
  }, 0);

  return farthestDistSq >= layer.inner ** 2;
}

function resolvedVisualGroundLayer(layer) {
  if (layer.type !== "dynamic-target") return layer;
  if (!world?.targetMarker?.visible) return null;
  if (world.targetMarker.position.y > 0.1) return null;
  return {
    ...layer,
    type: "ring",
    x: world.targetMarker.position.x,
    z: world.targetMarker.position.z,
    y: world.targetMarker.position.y
  };
}

function visualGroundForFootBounds(box) {
  let ground = { y: 0, name: "floor" };
  for (const rawLayer of ROBOT_VISUAL_GROUND_LAYERS) {
    const layer = resolvedVisualGroundLayer(rawLayer);
    if (!layer) continue;
    const overlaps = layer.type === "ring" ? projectedBoundsOverlapRing(box, layer) : projectedBoundsOverlapBox(box, layer);
    if (overlaps && layer.y > ground.y) ground = { y: layer.y, name: layer.name };
  }
  return ground;
}

function isUrdfContactLinkName(name, variant) {
  const patterns = ROBOT_URDF_CONTACT_LINK_PATTERNS[variant?.kind] || [];
  return patterns.some((pattern) => pattern.test(name));
}

function collectUrdfContactObjects(urdfModel, variant) {
  const contactObjects = [];
  const contactLinkNames = new Set();
  const linkEntries = urdfModel.links ? Object.values(urdfModel.links) : [];
  for (const link of linkEntries) {
    const name = link?.name || link?.urdfName || "";
    if (isUrdfContactLinkName(name, variant)) contactLinkNames.add(name);
  }

  for (const link of linkEntries) {
    const name = link?.name || link?.urdfName || "";
    if (!contactLinkNames.has(name)) continue;
    let addedFromLink = false;
    for (const child of link.children) {
      if (!child.isURDFVisual && !child.isMesh) continue;
      contactObjects.push(child);
      addedFromLink = true;
    }
    if (!addedFromLink) contactObjects.push(link);
  }

  return contactObjects.length ? contactObjects : [urdfModel];
}

function urdfContactBoundsForObject(object, variant) {
  if (!object) return null;
  robotUrdfVisualBounds.setFromObject(object);
  if (!robotUrdfVisualBounds.isEmpty()) return robotUrdfVisualBounds.clone();
  if (!object.isObject3D) return null;

  const center = new THREE.Vector3();
  object.getWorldPosition(center);
  const radius = variant?.kind === "mobile" ? 0.07 : 0.035;
  return new THREE.Box3().setFromCenterAndSize(
    center,
    new THREE.Vector3(radius * 2, radius * 2, radius * 2)
  );
}

function addUrdfContactBounds(contactBounds, urdfModel) {
  if (!urdfModel) return;
  const contactObjects = urdfModel.userData.contactObjects || [urdfModel];
  for (const object of contactObjects) {
    const bounds = urdfContactBoundsForObject(object, robot?.variant);
    if (bounds) contactBounds.push(bounds);
  }
}

function robotFootGroundState() {
  if (!robot?.parts) return;
  robot.group.updateWorldMatrix(true, true);
  const contactBounds = [];
  let lowestFootY = Infinity;
  let lowestClearance = Infinity;
  let lowestTargetClearance = Infinity;
  let excessClearance = Infinity;
  let requiredLift = 0;
  let highestSurfaceY = 0;
  let contactLayer = "floor";

  for (const foot of robot.footMeshes()) {
    if (!foot) continue;
    robotFootBounds.setFromObject(foot);
    if (!robotFootBounds.isEmpty()) contactBounds.push(robotFootBounds.clone());
  }

  addUrdfContactBounds(contactBounds, robot.parts.urdfModel);

  for (const bounds of contactBounds) {
    const ground = visualGroundForFootBounds(bounds);
    const targetClearance = ground.y > 0 ? ROBOT_FOOT_DECOR_CLEARANCE : ROBOT_FOOT_GROUND_CLEARANCE;
    const clearance = bounds.min.y - ground.y;
    lowestFootY = Math.min(lowestFootY, bounds.min.y);
    if (clearance < lowestClearance) {
      lowestClearance = clearance;
      lowestTargetClearance = targetClearance;
    }
    excessClearance = Math.min(excessClearance, clearance - targetClearance);
    requiredLift = Math.max(requiredLift, targetClearance - clearance);
    if (ground.y >= highestSurfaceY) {
      highestSurfaceY = ground.y;
      contactLayer = ground.name;
    }
  }

  if (!Number.isFinite(lowestFootY)) return null;
  return {
    lowestFootY,
    lowestClearance,
    lowestTargetClearance,
    excessClearance,
    requiredLift: Math.max(0, requiredLift),
    highestSurfaceY,
    contactLayer
  };
}

function lowestRobotFootY() {
  return robotFootGroundState()?.lowestFootY ?? null;
}

function keepRobotFeetAboveFloor(dt = 1 / 60) {
  let footState = robotFootGroundState();
  if (footState && footState.requiredLift > 0) {
    robotSurfaceLift += footState.requiredLift;
    robot.group.position.y += footState.requiredLift;
    robot.group.updateWorldMatrix(true, true);
    footState = robotFootGroundState();
  } else if (footState && robotSurfaceLift > 0) {
    const releasableLift = Math.max(0, footState.excessClearance - ROBOT_FOOT_CLEARANCE_SLOP);
    const releaseStep = Math.min(robotSurfaceLift, releasableLift, ROBOT_FOOT_LIFT_RELEASE_SPEED * dt);
    if (releaseStep > 0) {
      robotSurfaceLift -= releaseStep;
      robot.group.position.y -= releaseStep;
      robot.group.updateWorldMatrix(true, true);
      footState = robotFootGroundState();
    }
  }
  const stage = document.getElementById("stage");
  if (stage && footState) {
    stage.dataset.robotLowestFootY = footState.lowestFootY.toFixed(3);
    stage.dataset.robotFootClearance = footState.lowestClearance.toFixed(3);
    stage.dataset.robotFootTargetClearance = footState.lowestTargetClearance.toFixed(3);
    stage.dataset.robotFootSurfaceY = footState.highestSurfaceY.toFixed(3);
    stage.dataset.robotFootSurface = footState.contactLayer;
    stage.dataset.robotSurfaceLift = robotSurfaceLift.toFixed(3);
  }
}

function syncItemsFromPhysics() {
  for (const item of items) {
    if (item.heldBy) continue;
    item.group.position.set(item.body.position.x, item.body.position.y, item.body.position.z);
    item.group.quaternion.set(item.body.quaternion.x, item.body.quaternion.y, item.body.quaternion.z, item.body.quaternion.w);
  }
}

function robotHeadingYaw() {
  return robot.group.rotation.y + ROBOT_FORWARD_YAW_OFFSET;
}

function robotForward() {
  const yaw = robotHeadingYaw();
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)).normalize();
}

function robotRight() {
  const yaw = robotHeadingYaw();
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
}

function yawForDirection(dir) {
  return Math.atan2(-dir.x, -dir.z) - ROBOT_FORWARD_YAW_OFFSET;
}

function facePoint(point, dt = 0.016, options = {}) {
  const dir = point.clone().sub(robot.group.position);
  dir.y = 0;
  if (dir.lengthSq() < 0.0001) return;
  const desiredYaw = yawForDirection(dir.normalize());
  const delta = angleDelta(robot.group.rotation.y, desiredYaw);
  const turnRate = options.turnRate ?? SPEED_CONFIG.turnRate * 1.2;
  const minFrameStep = options.minFrameStep ?? 0.015;
  const maxFrameStep = options.maxFrameStep ?? Infinity;
  const maxStep = THREE.MathUtils.clamp(turnRate * dt, minFrameStep, maxFrameStep);
  robot.group.rotation.y += THREE.MathUtils.clamp(delta, -maxStep, maxStep);
}

function queueAutoFace(point) {
  state.pendingFaceTarget = point.clone();
}

function manualControlIntentActive() {
  if (state.task) return true;
  if (
    keys.has("KeyW") || keys.has("ArrowUp") ||
    keys.has("KeyS") || keys.has("ArrowDown") ||
    keys.has("KeyA") || keys.has("ArrowLeft") ||
    keys.has("KeyD") || keys.has("ArrowRight") ||
    keys.has("KeyQ") || keys.has("KeyE")
  ) return true;
  for (const action of ["forward", "backward", "left", "right", "turn-left", "turn-right"]) {
    if (controlActive(action)) return true;
  }
  return false;
}

function updateQueuedAutoFace(dt) {
  if (!state.pendingFaceTarget || !state.autoFace || !state.home.entered) return;
  if (manualControlIntentActive()) return;
  const dir = state.pendingFaceTarget.clone().sub(robot.group.position);
  dir.y = 0;
  if (dir.lengthSq() < 0.0001) {
    state.pendingFaceTarget = null;
    return;
  }
  const desiredYaw = yawForDirection(dir.normalize());
  const remaining = Math.abs(angleDelta(robot.group.rotation.y, desiredYaw));
  facePoint(state.pendingFaceTarget, dt, AUTO_FACE_CONFIG);
  if (remaining < AUTO_FACE_CONFIG.settleAngle) state.pendingFaceTarget = null;
}

function angleDelta(current, target) {
  return THREE.MathUtils.euclideanModulo(target - current + Math.PI, Math.PI * 2) - Math.PI;
}

function dampAngle(current, target, lambda, dt) {
  const delta = angleDelta(current, target);
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function moveRobotTo(position, yaw) {
  robotSurfaceLift = 0;
  robotMotionTracker.initialized = false;
  physics.robotBody.position.set(position.x, ROBOT_BODY_HALF_HEIGHT, position.z);
  physics.robotBody.velocity.set(0, 0, 0);
  robot.group.rotation.y = yaw;
  robot.pose = anyHeld() ? "carry" : "idle";
  syncRobotFromPhysics();
  controls.target.copy(robot.group.position).add(new THREE.Vector3(0, 0.78, 0));
  updateUi();
}

function focusObject(position) {
  const target = position.clone();
  target.y = Math.max(0.45, target.y);
  controls.target.lerp(target, 0.8);
}

function viewFrame(view) {
  if (view === "workbench") {
    return {
      position: new THREE.Vector3(2.8, 2.4, 4.3),
      target: new THREE.Vector3(-0.5, 0.72, -0.4)
    };
  }
  if (view === "objects") {
    return {
      position: new THREE.Vector3(1.08, 1.0, 0.76),
      target: new THREE.Vector3(-0.08, 0.5, -0.5)
    };
  }
  if (view === "follow") {
    const back = robotForward().multiplyScalar(-3.2);
    return {
      position: robot.group.position.clone().add(back).add(new THREE.Vector3(0, 1.85, 0)),
      target: robot.group.position.clone().add(new THREE.Vector3(0, 0.8, 0))
    };
  }
  return {
    position: new THREE.Vector3(6.8, 4.2, 7.2),
    target: new THREE.Vector3(0, 0.78, 0)
  };
}

function setView(view) {
  const frame = viewFrame(view);
  if (view === "overview") {
    state.follow = false;
  }
  if (view === "workbench") {
    state.follow = false;
  }
  if (view === "objects") {
    state.follow = false;
  }
  if (view === "follow") {
    state.follow = true;
  }
  camera.position.copy(frame.position);
  controls.target.copy(frame.target);
  document.getElementById("view-follow").classList.toggle("active", state.follow);
}

function updateFollowCamera(dt) {
  if (!state.follow) return;
  const desired = robot.group.position.clone().add(robotForward().multiplyScalar(-3.1)).add(new THREE.Vector3(0, 1.65, 0));
  camera.position.lerp(desired, 1 - Math.exp(-dt * 3.4));
  controls.target.lerp(robot.group.position.clone().add(new THREE.Vector3(0, 0.75, 0)), 1 - Math.exp(-dt * 5));
}

function resetScene() {
  for (const arm of ["left", "right"]) {
    if (state.held[arm]) {
      scene.attach(state.held[arm].group);
      state.held[arm].heldBy = null;
      if (!physics.world.bodies.includes(state.held[arm].body)) physics.world.addBody(state.held[arm].body);
    }
    state.held[arm] = null;
  }
  state.task = null;
  clearNavPath();
  state.lastTarget = null;
  state.currentTarget = null;
  state.selectedDropSpot = null;
  state.legs.crouch = 0;
  state.legs.leftLift = 0;
  state.legs.rightLift = 0;
  if (world?.targetMarker) world.targetMarker.visible = false;
  resetArms();
  moveRobotTo(new THREE.Vector3(0, 0, 2.55), Math.PI);

  for (const item of items) {
    item.heldBy = null;
    item.placed = false;
    scene.add(item.group);
    item.group.position.copy(item.group.userData.initial);
    item.group.rotation.set(0, 0, 0);
    item.group.scale.setScalar(1);
    activateItemBody(item, item.group.position, item.group.rotation);
  }
  selectItem(items[0]);
  setView("overview");
  toast(t("toast.resetScene"));
}

function createItemButtons() {
  const root = document.getElementById("item-list");
  root.innerHTML = "";
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.item = item.id;
    btn.innerHTML = `<span class="item-dot"></span><span class="item-name">${itemLabel(item)}</span><span class="item-state">${t("state.ready")}</span>`;
    btn.setAttribute("aria-label", t("a11y.itemStatus", { item: itemLabel(item), state: t("state.ready") }));
    btn.querySelector(".item-dot").style.background = `#${item.color.toString(16).padStart(6, "0")}`;
    btn.addEventListener("click", () => {
      selectItem(item);
      focusObject(item.group.position);
    });
    root.appendChild(btn);
  }
}

function createTargetButtons() {
  const root = document.getElementById("target-list");
  root.innerHTML = "";
  for (const spot of dropSpots) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.target = spot.name;
    btn.innerHTML = `<span class="target-dot"></span><span class="target-name">${dropSpotLabel(spot)}</span><span class="target-state">${t("state.available")}</span>`;
    btn.setAttribute("aria-label", t("a11y.targetStatus", { target: dropSpotLabel(spot), state: t("state.available") }));
    btn.addEventListener("click", () => selectDropSpot(spot.name));
    root.appendChild(btn);
  }
}

function updateUi() {
  const variant = robot?.variant || ROBOT_VARIANTS[state.robotVariant];
  const canManipulate = robotCanManipulate();
  if (stage) {
    stage.dataset.robotGaitCommandSpeed = state.gaitCommandSpeed.toFixed(3);
    stage.dataset.robotGaitActualSpeed = state.gaitActualSpeed.toFixed(3);
    stage.dataset.robotWalkBlend = state.walk.toFixed(3);
    stage.dataset.robotNavClearance = robotNavClearance().toFixed(3);
    stage.dataset.robotNavPlannerStatus = navPlannerStats.status;
    stage.dataset.robotNavPlannerReason = navPlannerStats.reason;
    stage.dataset.robotNavPlannerIterations = String(navPlannerStats.iterations);
    stage.dataset.robotNavPlannerPathLength = String(navPlannerStats.lastPathLength);
    stage.dataset.robotX = robot.group.position.x.toFixed(3);
    stage.dataset.robotZ = robot.group.position.z.toFixed(3);
    stage.dataset.robotYaw = robot.group.rotation.y.toFixed(3);
    stage.dataset.robotUrdfVisible = String(!!robot?.parts.urdfModel?.visible);
    stage.dataset.robotProceduralProxyVisible = String(robotProceduralProxyVisible());
    const forward = robotForward();
    const right = robotRight();
    stage.dataset.robotForwardX = forward.x.toFixed(3);
    stage.dataset.robotForwardZ = forward.z.toFixed(3);
    stage.dataset.robotRightX = right.x.toFixed(3);
    stage.dataset.robotRightZ = right.z.toFixed(3);
    const ball = items.find((item) => item.id === "ball");
    if (ball) {
      stage.dataset.ballProxyVisible = String(!!ball.mesh.visible);
      stage.dataset.ballContactShadowVisible = String(!!ball.contactShadow?.visible);
      stage.dataset.ballLoadedModelVisible = String(!!ball.loadedModel?.visible);
    }
  }
  document.getElementById("robot-variant-name").textContent = robotVariantLabel(variant);
  document.getElementById("robot-profile-name").textContent = robotProfileLabel(variant);
  document.getElementById("robot-source-name").textContent = robot?.urdfStatus
    ? `${robotSourceLabel(variant)} / ${urdfStatusLabel(robot.urdfStatus)}`
    : t("robot.modelSource");
  document.getElementById("selected-name").textContent = state.selected ? itemLabel(state.selected) : t("state.notSelected");
  document.getElementById("held-name").textContent = heldSummary();
  document.getElementById("active-arm-name").textContent = canManipulate ? armLabel(state.activeArm) : t("arm.none");
  document.getElementById("leg-pose-name").textContent = legPoseLabel();
  document.getElementById("target-name").textContent = state.currentTarget ? targetLabel(state.currentTarget) : t("state.random");
  document.getElementById("scene-style-name").textContent = sceneModeLabel(state.sceneMode);
  document.getElementById("robot-mode").textContent = state.task ? t("state.running") : anyHeld() ? t("state.holding") : t("state.idle");
  document.getElementById("task-status").textContent = state.task ? taskLabel(state.task) : t("state.noTask");
  document.getElementById("robot-coord").textContent =
    `${robot.group.position.x.toFixed(2)}, ${robot.group.position.z.toFixed(2)}`;
  document.getElementById("left-grip-meter").style.width = `${Math.round(state.arms.left.grip * 100)}%`;
  document.getElementById("right-grip-meter").style.width = `${Math.round(state.arms.right.grip * 100)}%`;
  document.getElementById("speed-meter").style.width = `${Math.round((state.moveSpeed / SPEED_CONFIG.max) * 100)}%`;

  for (const id of ["grab-btn", "place-btn", "release-btn", "arms-reset-btn"]) {
    document.getElementById(id).disabled = !canManipulate;
  }
  document.querySelectorAll("[data-arm-select], [data-arm][data-arm-action]").forEach((btn) => {
    const arm = btn.dataset.armSelect || btn.dataset.arm;
    btn.disabled = !canManipulate || !robotArmEnabled(arm);
  });

  document.querySelectorAll("[data-arm-select]").forEach((btn) => {
    btn.classList.toggle("active", canManipulate && btn.dataset.armSelect === state.activeArm);
  });
  document.querySelectorAll("[data-scene-mode]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.sceneMode === state.sceneMode);
  });
  document.querySelectorAll("#robot-variant-buttons [data-robot-variant]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.robotVariant === state.robotVariant);
  });
  document.querySelectorAll("[data-leg-action]").forEach((btn) => {
    const action = btn.dataset.legAction;
    const active =
      (action === "stand" && state.legs.crouch < 0.08 && !state.legs.leftLift && !state.legs.rightLift) ||
      (action === "half-squat" && state.legs.crouch >= 0.3 && state.legs.crouch < 0.7) ||
      (action === "deep-squat" && state.legs.crouch >= 0.7) ||
      (action === "left-step" && state.legs.leftLift > 0.1) ||
      (action === "right-step" && state.legs.rightLift > 0.1);
    btn.classList.toggle("active", active);
  });
  const sidebarToggle = document.getElementById("sidebar-toggle");
  sidebarToggle.textContent = state.sidebarHidden ? t("top.showSidebar") : t("top.hideSidebar");
  sidebarToggle.title = state.sidebarHidden ? t("top.showSidebarTitle") : t("top.hideSidebarTitle");
  sidebarToggle.classList.toggle("active", state.sidebarHidden);
  const fullscreenToggle = document.getElementById("fullscreen-toggle");
  fullscreenToggle.textContent = state.fullscreen ? t("top.exitFullscreen") : t("top.fullscreen");
  fullscreenToggle.title = state.fullscreen ? t("top.exitFullscreenTitle") : t("top.enterFullscreenTitle");
  fullscreenToggle.classList.toggle("active", state.fullscreen);
  document.querySelectorAll("#item-list button").forEach((btn) => {
    const item = items.find((candidate) => candidate.id === btn.dataset.item);
    btn.classList.toggle("active", item === state.selected);
    const stateEl = btn.querySelector(".item-state");
    const nameEl = btn.querySelector(".item-name");
    const itemState = item.heldBy ? armLabel(item.heldBy) : item.placed ? t("state.placed") : t("state.ready");
    if (nameEl) nameEl.textContent = itemLabel(item);
    stateEl.textContent = itemState;
    btn.setAttribute("aria-label", t("a11y.itemStatus", { item: itemLabel(item), state: itemState }));
  });
  document.querySelectorAll("#target-list button").forEach((btn) => {
    const selected = state.selectedDropSpot?.name === btn.dataset.target;
    btn.classList.toggle("active", selected);
    const stateEl = btn.querySelector(".target-state");
    const nameEl = btn.querySelector(".target-name");
    const targetName = dropSpotLabel(btn.dataset.target);
    const targetState = selected ? t("state.selected") : t("state.available");
    if (nameEl) nameEl.textContent = targetName;
    stateEl.textContent = targetState;
    btn.setAttribute("aria-label", t("a11y.targetStatus", { target: targetName, state: targetState }));
  });
}

function taskLabel(task) {
  if (task.type === "grab") {
    const phase = {
      approach: t("task.approach"),
      pregrasp: t("task.pregrasp"),
      close: t("task.close"),
      lift: t("task.lift")
    }[task.phase] || t("task.grab");
    return `${armLabel(task.arm)} ${phase} ${itemLabel(task.item)}`;
  }
  if (task.type === "place") return t("task.placeTo", { target: targetLabel(task.target) });
  return t("task.running");
}

function heldSummary() {
  const entries = [];
  if (state.held.left) entries.push(`${t("arm.leftShort")}:${itemLabel(state.held.left)}`);
  if (state.held.right) entries.push(`${t("arm.rightShort")}:${itemLabel(state.held.right)}`);
  return entries.length ? entries.join(" / ") : t("state.none");
}

function activeHeldArm() {
  if (state.held[state.activeArm]) return state.activeArm;
  if (state.held.right) return "right";
  if (state.held.left) return "left";
  return null;
}

function anyHeld() {
  return !!(state.held.left || state.held.right);
}

function robotCanManipulate() {
  return robot?.variant?.armCapable !== false;
}

function robotArmEnabled(arm) {
  if (!robotCanManipulate()) return false;
  const variant = robot?.variant;
  if (variant?.kind !== "mobile") return true;
  const layout = variant.mobileArmLayout || "none";
  if (layout === "dual") return arm === "left" || arm === "right";
  if (layout === "right") return arm === "right";
  return false;
}

function robotProceduralProxyVisible() {
  if (!robot?.parts) return false;
  return [
    robot.parts.pelvis,
    robot.parts.waist,
    robot.parts.torso,
    robot.parts.head,
    robot.parts.leftArm?.shoulder,
    robot.parts.rightArm?.shoulder,
    robot.parts.leftLeg?.hip,
    robot.parts.rightLeg?.hip,
    robot.parts.quadruped?.group,
    robot.parts.mobile?.group
  ].some((part) => !!part?.visible);
}

function armLabel(arm) {
  return arm === "left" ? t("arm.left") : t("arm.right");
}

function sceneModeLabel(mode) {
  return mode === "rich" ? t("scene.rich") : t("scene.simple");
}

function legPoseLabel() {
  if (state.legs.leftLift > 0.1) return t("leg.leftStep");
  if (state.legs.rightLift > 0.1) return t("leg.rightStep");
  if (state.legs.crouch >= 0.7) return t("leg.deepSquat");
  if (state.legs.crouch >= 0.25) return t("leg.halfSquat");
  return t("leg.stand");
}

function clamp01(value) {
  return THREE.MathUtils.clamp(value, 0, 1);
}

let toastTimer = 0;
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.add("hidden"), 2200);
}

function onResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  labelRenderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const frameDt = Math.max(0, (now - lastFrameTime) / 1000);
  const dt = Math.min(frameDt, 0.04);
  const transitionDt = Math.min(frameDt, 0.25);
  lastFrameTime = now;
  const time = (now - bootTime) / 1000;

  updateManual(dt);
  updateTask(dt);
  updateQueuedAutoFace(dt);
  physics.world.step(1 / 60, dt, 4);
  syncRobotFromPhysics();
  updateGaitFromActualMotion(dt);
  syncItemsFromPhysics();
  robot.update(dt, time);
  keepRobotFeetAboveFloor(dt);
  updateFollowCamera(dt);
  updateHomeCamera(transitionDt, time);
  updateTargetPulse(time);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
  if (now - lastFrameUiUpdate >= UI_FRAME_UPDATE_INTERVAL_MS) {
    lastFrameUiUpdate = now;
    updateUi();
  }
}

function exposeDebugApi() {
  const debugApi = {
    snapshot: () => {
      const footState = robotFootGroundState();
      return {
        robot: {
          x: Number(robot.group.position.x.toFixed(3)),
          y: Number(robot.group.position.y.toFixed(3)),
          z: Number(robot.group.position.z.toFixed(3)),
          yaw: Number(robot.group.rotation.y.toFixed(3)),
          headingYaw: Number(robotHeadingYaw().toFixed(3)),
          forwardX: Number(robotForward().x.toFixed(3)),
          forwardZ: Number(robotForward().z.toFixed(3)),
          rightX: Number(robotRight().x.toFixed(3)),
          rightZ: Number(robotRight().z.toFixed(3)),
          lowestFootY: footState ? Number(footState.lowestFootY.toFixed(3)) : null,
          footClearance: footState ? Number(footState.lowestClearance.toFixed(3)) : null,
          footTargetClearance: footState ? Number(footState.lowestTargetClearance.toFixed(3)) : null,
          footSurfaceY: footState ? Number(footState.highestSurfaceY.toFixed(3)) : null,
          footSurface: footState?.contactLayer || null,
          surfaceLift: Number(robotSurfaceLift.toFixed(3))
        },
        camera: {
          x: Number(camera.position.x.toFixed(3)),
          y: Number(camera.position.y.toFixed(3)),
          z: Number(camera.position.z.toFixed(3)),
          targetX: Number(controls.target.x.toFixed(3)),
          targetY: Number(controls.target.y.toFixed(3)),
          targetZ: Number(controls.target.z.toFixed(3))
        },
        home: {
          entered: state.home.entered,
          entering: state.home.entering,
          elapsed: Number(state.home.elapsed.toFixed(3)),
          duration: Number(state.home.duration.toFixed(3)),
          view: state.home.view
        },
        activeArm: state.activeArm,
        sceneMode: state.sceneMode,
        robotVariant: state.robotVariant,
        robotProfile: robot.variant.profile,
        robotKind: robot.variant.kind,
        robotSource: robot.urdfSource,
        robotUrdfStatus: robot.urdfStatus,
        robotUrdfPath: robot.robotUrdfAsset().path,
        robotUrdfJointCount: robot.parts.urdfModel ? Object.keys(robot.parts.urdfModel.joints || {}).length : 0,
        robotUrdfVisible: !!robot.parts.urdfModel?.visible,
        proceduralProxyVisible: robotProceduralProxyVisible(),
        armCapable: robot.variant.armCapable,
        quadrupedDetails: robot.variant.kind === "quadruped"
          ? {
              lidarVisible: !!robot.parts.quadruped.lidar.visible,
              wheelModulesVisible: robot.parts.quadruped.legs.filter((leg) => leg.wheel.visible).length,
              legCount: robot.parts.quadruped.legs.length
            }
          : null,
        sidebarHidden: state.sidebarHidden,
        fullscreen: state.fullscreen,
        fullscreenFallback: state.fullscreenFallback,
        speedMps: Number(state.moveSpeed.toFixed(2)),
        gaitSpeedMps: Number(state.gaitSpeed.toFixed(2)),
        gaitCommandSpeedMps: Number(state.gaitCommandSpeed.toFixed(2)),
        gaitActualSpeedMps: Number(state.gaitActualSpeed.toFixed(2)),
        sceneVelocityScale: SPEED_CONFIG.sceneScale,
        held: {
          left: state.held.left?.name || null,
          right: state.held.right?.name || null
        },
        arms: {
          left: { ...state.arms.left },
          right: { ...state.arms.right }
        },
        legs: { ...state.legs, label: legPoseLabel() },
        navigation: state.task?.path
          ? {
              waypoint: state.task.waypoint,
              waypoints: state.task.path.length,
              obstacles: navObstacles.length,
              clearance: Number(robotNavClearance().toFixed(2)),
              planner: navPlannerStatsSnapshot()
            }
          : {
              waypoint: 0,
              waypoints: 0,
              obstacles: navObstacles.length,
              clearance: Number(robotNavClearance().toFixed(2)),
              planner: navPlannerStatsSnapshot()
            },
        target: state.currentTarget
          ? {
              name: state.currentTarget.name,
              x: Number(state.currentTarget.position.x.toFixed(3)),
              y: Number(state.currentTarget.position.y.toFixed(3)),
              z: Number(state.currentTarget.position.z.toFixed(3))
            }
          : null,
        selectedDropSpot: state.selectedDropSpot?.name || null,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          heldBy: item.heldBy,
          placed: item.placed,
          proxyVisible: !!item.mesh.visible,
          contactShadowVisible: !!item.contactShadow?.visible,
          loadedModelVisible: !!item.loadedModel?.visible,
          x: Number(item.group.position.x.toFixed(3)),
          y: Number(item.group.position.y.toFixed(3)),
          z: Number(item.group.position.z.toFixed(3))
        }))
      };
    },
    planPath: (start, goal) => {
      const startPoint = new THREE.Vector3(start.x, 0, start.z);
      const goalPoint = new THREE.Vector3(goal.x, 0, goal.z);
      const path = planPath(startPoint, goalPoint);
      return {
        points: path.map((point) => ({
          x: Number(point.x.toFixed(3)),
          z: Number(point.z.toFixed(3))
        })),
        stats: navPlannerStatsSnapshot()
      };
    }
  };
  window.webRobotDebug = debugApi;
  globalThis.webRobotDebug = debugApi;
  stage.dataset.debugApi = "ready";
}

function updateTargetPulse(time) {
  if (world?.homeRing) world.homeRing.material.opacity = 0.33 + Math.sin(time * 2.5) * 0.1;
  if (world?.targetMarker?.visible) world.targetMarker.scale.setScalar(1 + Math.sin(time * 3.2) * 0.08);
}

function boot() {
  world = createWorld();
  robot = new Robot();
  scene.add(robot.group);
  createRobotBody();
  robot.ensureUrdfLoaded();
  createItems();
  loadRichAssetModels();
  createItemButtons();
  createTargetButtons();
  bindUi();
  applySceneMode(state.home.previewMode);
  exposeDebugApi();
  setIntroView();
  selectItem(items[0]);
  animate();
}

function setIntroView() {
  camera.position.set(7.4, 4.35, 7.1);
  controls.target.set(-0.52, 0.84, -0.18);
  controls.enabled = false;
}

boot();
