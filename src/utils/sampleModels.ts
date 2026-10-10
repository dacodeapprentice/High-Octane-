/**
 * Procedural sample models & GLB exporters for verifying normalization
 * with very different geometries (long/thin vs short/wide/off-center).
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export function createSpeederDartMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'SpeederDart';

  // Needle-thin, long aerodynamic fuselage
  const bodyGeo = new THREE.ConeGeometry(0.5, 8.0, 6);
  bodyGeo.rotateX(-Math.PI / 2); // Point forward along -Z
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4, // Cyan
    metalness: 0.85,
    roughness: 0.2
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Swept delta wings
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(1.4, -2.5);
  wingShape.lineTo(0, -3.5);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: false });
  wingGeo.rotateX(Math.PI / 2);
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.3
  });
  const wings = new THREE.Mesh(wingGeo, wingMat);
  wings.position.set(0, 0, 0);
  group.add(wings);

  // Twin tail stabilizers
  const finGeo = new THREE.BoxGeometry(0.06, 0.9, 1.8);
  const finL = new THREE.Mesh(finGeo, bodyMat);
  finL.position.set(-0.4, 0.45, 2.5);
  finL.rotation.z = -0.2;
  const finR = new THREE.Mesh(finGeo, bodyMat);
  finR.position.set(0.4, 0.45, 2.5);
  finR.rotation.z = 0.2;
  group.add(finL, finR);

  return group;
}

export function createHeavyTankerMesh(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'HeavyIroncladTanker';

  // Intentionally short (length 2.5) and extra wide (width 6.2) with off-center pivot!
  // Shifted off-center: X +1.5, Y +0.8, Z -0.7 to thoroughly test auto-centering!
  const offCenterGroup = new THREE.Group();
  offCenterGroup.position.set(1.5, 0.8, -0.7);
  // Rotated 90 degrees on Y to test orientation normalization
  offCenterGroup.rotation.y = Math.PI / 2;

  // Wide armored core
  const hullGeo = new THREE.BoxGeometry(6.2, 1.1, 2.5);
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xe11d48, // Rose/Red armor
    metalness: 0.7,
    roughness: 0.4
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  offCenterGroup.add(hull);

  // Heavy outrigger nacelles
  const nacelleGeo = new THREE.CylinderGeometry(0.65, 0.65, 2.8, 8);
  nacelleGeo.rotateX(Math.PI / 2);
  const nacelleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.95,
    roughness: 0.15
  });
  const nacelleL = new THREE.Mesh(nacelleGeo, nacelleMat);
  nacelleL.position.set(-3.2, 0, 0);
  const nacelleR = new THREE.Mesh(nacelleGeo, nacelleMat);
  nacelleR.position.set(3.2, 0, 0);
  offCenterGroup.add(nacelleL, nacelleR);

  // Upper cockpit bridge
  const bridgeGeo = new THREE.BoxGeometry(1.8, 0.6, 1.4);
  const bridgeMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24, // Amber canopy
    metalness: 0.9,
    roughness: 0.1
  });
  const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(0, 0.8, -0.2);
  offCenterGroup.add(bridge);

  group.add(offCenterGroup);
  return group;
}

export function exportGroupToGLB(group: THREE.Group): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      group,
      (gltf) => {
        if (gltf instanceof ArrayBuffer) {
          resolve(gltf);
        } else {
          // If returned as object, stringify or handle
          const output = JSON.stringify(gltf, null, 2);
          const blob = new Blob([output], { type: 'application/json' });
          blob.arrayBuffer().then(resolve).catch(reject);
        }
      },
      (error) => {
        reject(error);
      },
      { binary: true }
    );
  });
}
