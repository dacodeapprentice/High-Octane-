/**
 * Model normalization, GLB loading, validation, and IndexedDB persistence.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface ModelOrientationSettings {
  forwardAxis: '-Z' | '+Z' | '-X' | '+X';
  flip180: boolean;
  rotationYDeg: number;
  scaleMultiplier: number;
  targetLength: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

export const DEFAULT_MODEL_SETTINGS: ModelOrientationSettings = {
  forwardAxis: '-Z',
  flip180: false,
  rotationYDeg: 0,
  scaleMultiplier: 1.0,
  targetLength: 4.0,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0
};

export interface ModelMeta {
  fileName: string;
  fileSize: number;
  triangleCount: number;
  vertexCount: number;
  originalDimensions: { x: number; y: number; z: number };
  normalizedDimensions: { x: number; y: number; z: number };
  settings: ModelOrientationSettings;
  isCustom: boolean;
  warning?: string;
}

const DB_NAME = 'HighOctane0G_ModelDB';
const STORE_NAME = 'ship_models';
const MODEL_KEY = 'active_custom_ship_model';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveModelToStorage(
  fileBuffer: ArrayBuffer,
  fileName: string,
  settings: ModelOrientationSettings
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        fileName,
        fileBuffer,
        settings,
        savedAt: Date.now()
      };
      const req = store.put(record, MODEL_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to save model to IndexedDB:', err);
  }
}

export async function loadModelFromStorage(): Promise<{
  fileBuffer: ArrayBuffer;
  fileName: string;
  settings: ModelOrientationSettings;
} | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(MODEL_KEY);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to load model from IndexedDB:', err);
    return null;
  }
}

export async function clearModelFromStorage(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(MODEL_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to clear model from IndexedDB:', err);
  }
}

/**
 * Pre-checks binary array buffer for unsupported extensions like Draco or Meshopt.
 */
export function checkGLBCompression(buffer: ArrayBuffer): { isCompressed: boolean; extensionName?: string } {
  try {
    const decoder = new TextDecoder('utf-8');
    // Read the first 4KB to find glTF json header
    const chunk = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8192));
    const text = decoder.decode(chunk);
    if (text.includes('KHR_draco_mesh_compression')) {
      return { isCompressed: true, extensionName: 'KHR_draco_mesh_compression' };
    }
    if (text.includes('EXT_meshopt_compression')) {
      return { isCompressed: true, extensionName: 'EXT_meshopt_compression' };
    }
  } catch {}
  return { isCompressed: false };
}

/**
 * Recursively disposes geometries, materials, and textures to prevent memory leaks.
 */
export function disposeThreeHierarchy(node: THREE.Object3D) {
  node.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => disposeMaterial(mat));
        } else {
          disposeMaterial(mesh.material);
        }
      }
    }
  });
}

function disposeMaterial(mat: THREE.Material) {
  Object.keys(mat).forEach((prop) => {
    const value = (mat as unknown as Record<string, unknown>)[prop];
    if (value && typeof value === 'object' && (value as THREE.Texture).isTexture) {
      (value as THREE.Texture).dispose();
    }
  });
  mat.dispose();
}

export interface NormalizedModelResult {
  rootGroup: THREE.Group;
  meta: ModelMeta;
}

/**
 * Normalizes an imported glTF scene into a standardized ship visual pivot.
 */
export function processAndNormalizeModel(
  gltfScene: THREE.Group | THREE.Scene,
  fileName: string,
  fileSize: number,
  settings: ModelOrientationSettings = DEFAULT_MODEL_SETTINGS
): NormalizedModelResult {
  let triangleCount = 0;
  let vertexCount = 0;

  // Fallback material for meshes without materials
  const fallbackMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    metalness: 0.8,
    roughness: 0.25
  });

  gltfScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (!mesh.material) {
        mesh.material = fallbackMat;
      }

      if (mesh.geometry) {
        const geo = mesh.geometry;
        if (geo.index) {
          triangleCount += geo.index.count / 3;
        } else if (geo.attributes.position) {
          triangleCount += geo.attributes.position.count / 3;
        }
        if (geo.attributes.position) {
          vertexCount += geo.attributes.position.count;
        }
      }
    }
  });

  triangleCount = Math.round(triangleCount);

  // Compute raw bounding box before normalization
  const rawBox = new THREE.Box3().setFromObject(gltfScene);
  const rawSize = new THREE.Vector3();
  rawBox.getSize(rawSize);
  const rawCenter = new THREE.Vector3();
  rawBox.getCenter(rawCenter);

  // Determine primary dimension for target length scaling based on selected forward axis
  let modelLength = rawSize.z;
  if (settings.forwardAxis === '-X' || settings.forwardAxis === '+X') {
    modelLength = rawSize.x;
  }
  if (modelLength <= 0.001) modelLength = Math.max(rawSize.x, rawSize.y, rawSize.z, 1.0);

  const baseScale = settings.targetLength / modelLength;
  const finalScale = baseScale * settings.scaleMultiplier;

  // Outer ShipModel Pivot
  const shipModelPivot = new THREE.Group();
  shipModelPivot.name = 'ShipModelPivot';

  // Inner normalized wrapper to center pivot horizontally and set bottom at Y = 0
  const innerWrapper = new THREE.Group();
  innerWrapper.name = 'InnerCenteredModel';

  // Re-center horizontally, place bottom (min.y) at 0
  innerWrapper.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z);
  innerWrapper.add(gltfScene);

  // Orientation container
  const orientationWrapper = new THREE.Group();
  orientationWrapper.name = 'OrientationWrapper';
  orientationWrapper.add(innerWrapper);

  // Apply Forward Axis Rotation
  let axisYRot = 0;
  switch (settings.forwardAxis) {
    case '-Z': // Standard glTF forward (-Z)
      axisYRot = 0;
      break;
    case '+Z': // Inverted forward (+Z)
      axisYRot = Math.PI;
      break;
    case '+X': // Right is forward (+X)
      axisYRot = -Math.PI / 2;
      break;
    case '-X': // Left is forward (-X)
      axisYRot = Math.PI / 2;
      break;
  }

  if (settings.flip180) {
    axisYRot += Math.PI;
  }

  const customRot = THREE.MathUtils.degToRad(settings.rotationYDeg);
  orientationWrapper.rotation.y = axisYRot + customRot;

  // Apply uniform scale
  orientationWrapper.scale.set(finalScale, finalScale, finalScale);

  // Apply manual offsets
  orientationWrapper.position.set(settings.offsetX, settings.offsetY, settings.offsetZ);

  shipModelPivot.add(orientationWrapper);

  // Calculate final normalized bounding dimensions
  const finalBox = new THREE.Box3().setFromObject(shipModelPivot);
  const finalSize = new THREE.Vector3();
  finalBox.getSize(finalSize);

  let warning: string | undefined;
  if (triangleCount > 200000) {
    warning = `High polygon count (${triangleCount.toLocaleString()} triangles). Performance may be impacted on lower-end hardware.`;
  } else if (fileSize > 20 * 1024 * 1024) {
    warning = `Large file size (${(fileSize / (1024 * 1024)).toFixed(1)} MB). Exporting with fewer embedded textures is recommended.`;
  }

  const meta: ModelMeta = {
    fileName,
    fileSize,
    triangleCount,
    vertexCount,
    originalDimensions: {
      x: parseFloat(rawSize.x.toFixed(2)),
      y: parseFloat(rawSize.y.toFixed(2)),
      z: parseFloat(rawSize.z.toFixed(2))
    },
    normalizedDimensions: {
      x: parseFloat(finalSize.x.toFixed(2)),
      y: parseFloat(finalSize.y.toFixed(2)),
      z: parseFloat(finalSize.z.toFixed(2))
    },
    settings,
    isCustom: true,
    warning
  };

  return { rootGroup: shipModelPivot, meta };
}

/**
 * Loads a GLB file from ArrayBuffer using GLTFLoader.
 */
export function loadGLBFromBuffer(buffer: ArrayBuffer): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const compression = checkGLBCompression(buffer);
    if (compression.isCompressed) {
      reject(
        new Error(
          `Model uses ${compression.extensionName}. Please re-export your GLB from Blender or 3D software without Draco or Meshopt compression.`
        )
      );
      return;
    }

    const loader = new GLTFLoader();
    loader.parse(
      buffer,
      '',
      (gltf) => {
        resolve(gltf.scene);
      },
      (error) => {
        reject(new Error(`Failed to parse GLB: ${error?.message || 'Invalid or corrupted file'}`));
      }
    );
  });
}
