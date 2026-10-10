import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PhysicsParams } from '../types.ts';
import {
  ModelMeta,
  ModelOrientationSettings,
  DEFAULT_MODEL_SETTINGS,
  loadGLBFromBuffer,
  processAndNormalizeModel,
  disposeThreeHierarchy
} from '../utils/modelStorage.ts';

interface SimulationProps {
  physics: PhysicsParams;
  customModelBuffer: ArrayBuffer | null;
  customModelFileName?: string;
  modelSettings: ModelOrientationSettings;
  onModelMetaChange?: (meta: ModelMeta) => void;
  onModelLoadError?: (error: string) => void;
  onFileDropped?: (buffer: ArrayBuffer, fileName: string) => void;
  onTelemetryUpdate: (telemetry: {
    speedKmh: number;
    altitude: number;
    effectiveHoverHeight: number;
    targetHoverHeight: number;
    rollDeg: number;
    driftPercent: number;
    isHovering: boolean;
    isBoosting: boolean;
    heat: number;
    isOverheated: boolean;
  }) => void;
  isPaused: boolean;
}

export const Simulation3D: React.FC<SimulationProps> = ({
  physics,
  customModelBuffer,
  customModelFileName = 'custom_model.glb',
  modelSettings,
  onModelMetaChange,
  onModelLoadError,
  onFileDropped,
  onTelemetryUpdate,
  isPaused
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const physicsRef = useRef(physics);
  physicsRef.current = physics;

  const [isDragOver, setIsDragOver] = useState(false);

  // Model references to update dynamically without rebuilding the entire Three scene
  const modelSlotRef = useRef<THREE.Group | null>(null);
  const thrustersGroupRef = useRef<THREE.Group | null>(null);
  const plasmaLeftRef = useRef<THREE.Mesh | null>(null);
  const plasmaRightRef = useRef<THREE.Mesh | null>(null);
  const shadowMeshRef = useRef<THREE.Mesh | null>(null);

  // Key states
  const keysRef = useRef<{
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    boost: boolean;
  }>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    boost: false
  });

  const resetSignalRef = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') keysRef.current.boost = true;
      if (code === 'KeyR') resetSignalRef.current = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') keysRef.current.boost = false;
    };

    const handleResetKeys = () => {
      keysRef.current.forward = false;
      keysRef.current.backward = false;
      keysRef.current.left = false;
      keysRef.current.right = false;
      keysRef.current.boost = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleResetKeys);
    document.addEventListener('visibilitychange', handleResetKeys);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleResetKeys);
      document.removeEventListener('visibilitychange', handleResetKeys);
    };
  }, []);

  // Creation of the AI-crafted default fallback procedural ship
  const createDefaultProceduralShip = (): { group: THREE.Group; meta: ModelMeta } => {
    const group = new THREE.Group();
    group.name = 'DefaultShipVisual';

    const shipWidth = 2.2;
    const shipHeight = 0.65;
    const shipLength = 4.2;

    const shipBodyGeo = new THREE.BoxGeometry(shipWidth, shipHeight, shipLength);
    const shipBodyMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x0369a1,
      emissiveIntensity: 0.3
    });
    const shipBodyMesh = new THREE.Mesh(shipBodyGeo, shipBodyMat);
    shipBodyMesh.castShadow = true;
    shipBodyMesh.receiveShadow = true;
    group.add(shipBodyMesh);

    // Cockpit canopy
    const canopyGeo = new THREE.BoxGeometry(1.2, 0.45, 1.8);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x030712,
      metalness: 0.95,
      roughness: 0.05,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.15
    });
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.set(0, 0.45, -0.4);
    group.add(canopyMesh);

    // Forward nose wedge
    const noseGeo = new THREE.ConeGeometry(1.0, 1.4, 4);
    noseGeo.rotateX(-Math.PI / 2);
    noseGeo.rotateZ(Math.PI / 4);
    const noseMesh = new THREE.Mesh(noseGeo, shipBodyMat);
    noseMesh.position.set(0, 0, -shipLength / 2 - 0.5);
    group.add(noseMesh);

    // Left and Right gliding wings
    const wingGeo = new THREE.BoxGeometry(1.5, 0.12, 2.2);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.3 });
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-1.6, -0.05, 0.5);
    leftWing.rotation.z = THREE.MathUtils.degToRad(-8);
    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(1.6, -0.05, 0.5);
    rightWing.rotation.z = THREE.MathUtils.degToRad(8);
    group.add(leftWing, rightWing);

    const meta: ModelMeta = {
      fileName: 'Default High-Octane Glider',
      fileSize: 0,
      triangleCount: 48,
      vertexCount: 96,
      originalDimensions: { x: 4.7, y: 1.1, z: 4.9 },
      normalizedDimensions: { x: 4.7, y: 1.1, z: 4.9 },
      settings: DEFAULT_MODEL_SETTINGS,
      isCustom: false
    };

    return { group, meta };
  };

  // Three.js main initialization
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // --- THREE.JS SETUP ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    scene.fog = new THREE.FogExp2(0x060913, 0.007);

    const camera = new THREE.PerspectiveCamera(
      physics.baseFov,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // --- LIGHTS ---
    const ambientLight = new THREE.AmbientLight(0x2a3b5c, 1.3);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xa5c9ff, 2.0);
    sunLight.position.set(40, 70, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 250;
    const shadowD = 80;
    sunLight.shadow.camera.left = -shadowD;
    sunLight.shadow.camera.right = shadowD;
    sunLight.shadow.camera.top = shadowD;
    sunLight.shadow.camera.bottom = -shadowD;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const cyanPointLight = new THREE.PointLight(0x00f0ff, 2.5, 30);
    cyanPointLight.position.set(0, 4, 0);
    scene.add(cyanPointLight);

    // --- RACING TRACK ARENA ---
    const trackSize = 250;
    const gridTextureCanvas = document.createElement('canvas');
    gridTextureCanvas.width = 512;
    gridTextureCanvas.height = 512;
    const ctx = gridTextureCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, 512, 512);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 512; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 512);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(512, i);
        ctx.stroke();
      }
    }
    const trackTexture = new THREE.CanvasTexture(gridTextureCanvas);
    trackTexture.wrapS = THREE.RepeatWrapping;
    trackTexture.wrapT = THREE.RepeatWrapping;
    trackTexture.repeat.set(50, 50);

    const trackGeo = new THREE.PlaneGeometry(trackSize, trackSize);
    trackGeo.rotateX(-Math.PI / 2);
    const trackMat = new THREE.MeshStandardMaterial({
      map: trackTexture,
      roughness: 0.8,
      metalness: 0.2
    });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Outer Boundary Barriers
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.5,
      metalness: 0.8
    });
    const boundaryBoxGeo = new THREE.BoxGeometry(trackSize, 2, 4);
    const northWall = new THREE.Mesh(boundaryBoxGeo, barrierMat);
    northWall.position.set(0, 1, -trackSize / 2);
    scene.add(northWall);
    const southWall = new THREE.Mesh(boundaryBoxGeo, barrierMat);
    southWall.position.set(0, 1, trackSize / 2);
    scene.add(southWall);

    const boundaryBoxGeoSide = new THREE.BoxGeometry(4, 2, trackSize);
    const eastWall = new THREE.Mesh(boundaryBoxGeoSide, barrierMat);
    eastWall.position.set(trackSize / 2, 1, 0);
    scene.add(eastWall);
    const westWall = new THREE.Mesh(boundaryBoxGeoSide, barrierMat);
    westWall.position.set(-trackSize / 2, 1, 0);
    scene.add(westWall);

    // Speed boost pads on track
    const padGeo = new THREE.PlaneGeometry(8, 20);
    padGeo.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    [[0, 0.05, -50], [60, 0.05, 30], [-60, 0.05, 30]].forEach(([px, py, pz]) => {
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(px, py, pz);
      scene.add(pad);
    });

    // Checkpoint Gate
    const archGroup = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 12, 1.5), pillarMat);
    pillarL.position.set(-14, 6, 0);
    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 12, 1.5), pillarMat);
    pillarR.position.set(14, 6, 0);
    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(30, 1.5, 2), beamMat);
    topBeam.position.set(0, 12, 0);
    archGroup.add(pillarL, pillarR, topBeam);
    archGroup.position.set(0, 0, -25);
    scene.add(archGroup);

    // --- DECOUPLED ARCHITECTURE: PHYSICS BODY vs SHIPMODEL PIVOT ---
    // 1. Root ship physics container (position, velocity, yaw, collision anchor)
    const shipRoot = new THREE.Group();
    shipRoot.name = 'ShipPhysicsRoot';
    shipRoot.position.set(0, physics.idleHoverHeight, 0);
    scene.add(shipRoot);

    // 2. Visual Pivot (ShipModel): handles roll banking, pitch tilt, and visual bobbing
    const shipVisualMesh = new THREE.Group();
    shipVisualMesh.name = 'ShipModelPivot';
    shipRoot.add(shipVisualMesh);

    // 3. Swappable Model Slot (holds either default procedural ship or imported GLB)
    const modelSlot = new THREE.Group();
    modelSlot.name = 'ModelSlot';
    shipVisualMesh.add(modelSlot);
    modelSlotRef.current = modelSlot;

    // 4. Adaptive Thrusters & Plasma Emitters (child of ShipModel visual pivot)
    const thrustersGroup = new THREE.Group();
    thrustersGroup.name = 'AdaptiveThrusters';
    shipVisualMesh.add(thrustersGroup);
    thrustersGroupRef.current = thrustersGroup;

    const thrusterGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.7, 16);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterHousingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const thrusterL = new THREE.Mesh(thrusterGeo, thrusterHousingMat);
    const thrusterR = new THREE.Mesh(thrusterGeo, thrusterHousingMat);
    thrustersGroup.add(thrusterL, thrusterR);

    // Plasma Exhaust Cones
    const plasmaGeo = new THREE.ConeGeometry(0.25, 1.8, 16);
    plasmaGeo.rotateX(-Math.PI / 2);
    const plasmaMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85
    });
    const plasmaL = new THREE.Mesh(plasmaGeo, plasmaMat);
    const plasmaR = new THREE.Mesh(plasmaGeo, plasmaMat);
    thrustersGroup.add(plasmaL, plasmaR);
    plasmaLeftRef.current = plasmaL;
    plasmaRightRef.current = plasmaR;

    // Underbody Hover Repulsor Glow
    const hoverPadGeo = new THREE.RingGeometry(0.2, 0.8, 16);
    hoverPadGeo.rotateX(Math.PI / 2);
    const hoverPadMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65
    });
    const hoverPad = new THREE.Mesh(hoverPadGeo, hoverPadMat);
    hoverPad.position.set(0, -0.1, 0);
    shipVisualMesh.add(hoverPad);

    // Ground Shadow Blob Projector
    const shadowGeo = new THREE.PlaneGeometry(3.5, 5.5);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.set(0, 0.04, 0);
    scene.add(shadowMesh);
    shadowMeshRef.current = shadowMesh;

    // Load initial default model
    const initialDefault = createDefaultProceduralShip();
    modelSlot.add(initialDefault.group);
    if (onModelMetaChange) onModelMetaChange(initialDefault.meta);

    // Rigid camera anchor parented directly to physics shipRoot
    const cameraRigidAnchor = new THREE.Object3D();
    cameraRigidAnchor.position.set(0, physics.cameraHeight, physics.cameraDistance);
    shipRoot.add(cameraRigidAnchor);

    // Orbit mouse controls
    let isMouseDown = false;
    let orbitAzimuth = 0;
    let orbitPolar = Math.PI / 4;
    let orbitDistance = 15;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      orbitAzimuth -= dx * 0.008;
      orbitPolar = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, orbitPolar + dy * 0.008));
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };
    const onMouseUp = () => {
      isMouseDown = false;
    };
    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Smooth follow camera
    const smoothCamPos = new THREE.Vector3(0, 10, 20);
    const smoothCamLook = new THREE.Vector3(0, 0, 0);

    // --- PHYSICS ENGINE STATE (matching Godot CharacterBody3D logic) ---
    const velocity = new THREE.Vector3(0, 0, 0);
    let shipYaw = 0;
    let currentRoll = 0;
    let currentPitch = 0;
    let turnRate = 0;
    let currentSpeedRatio = 0;
    let currentBoostRatio = 0;
    let bobTime = 0;
    let effectiveHoverHeight = physics.idleHoverHeight;
    let heat = 0.0;
    let isOverheated = false;
    let timeSinceBoost = 0.0;

    let lastTime = performance.now();
    let animId: number;

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);

      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      if (isPaused) {
        renderer.render(scene, camera);
        return;
      }

      const p = physicsRef.current;
      const keys = keysRef.current;

      // Handle reset
      if (resetSignalRef.current) {
        resetSignalRef.current = false;
        shipRoot.position.set(0, p.idleHoverHeight, 0);
        velocity.set(0, 0, 0);
        shipYaw = 0;
        currentRoll = 0;
        currentPitch = 0;
        turnRate = 0;
        currentSpeedRatio = 0;
        currentBoostRatio = 0;
        bobTime = 0;
        effectiveHoverHeight = p.idleHoverHeight;
        heat = 0.0;
        isOverheated = false;
        timeSinceBoost = 0.0;
      }

      // Input calculation
      const throttle = (keys.forward ? 1.0 : 0.0) - (keys.backward ? 1.0 : 0.0);
      const steer = (keys.left ? 1.0 : 0.0) - (keys.right ? 1.0 : 0.0);
      const rawBoostInput = keys.boost;

      // 1. Nitro Overheat System Logic
      const isBoosting = rawBoostInput && throttle > 0.0 && !isOverheated;

      if (isBoosting) {
        timeSinceBoost = 0.0;
        heat = Math.min(p.overheatThreshold, heat + p.boostHeatRate * dt);
        if (heat >= p.overheatThreshold) {
          isOverheated = true;
        }
      } else {
        timeSinceBoost += dt;
        if (timeSinceBoost >= p.cooldownDelay) {
          heat = Math.max(0.0, heat - p.coolRate * dt);
          if (isOverheated && heat <= p.recoverThreshold) {
            isOverheated = false;
          }
        }
      }

      // 2. Hover Lift Effect Calculation
      const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
      const targetSpeedRatio = Math.min(1.0, horizontalSpeed / p.maxSpeed);

      currentSpeedRatio = THREE.MathUtils.lerp(
        currentSpeedRatio,
        targetSpeedRatio,
        Math.min(1.0, p.hoverTransitionSpeed * dt)
      );

      const targetBoost = isBoosting ? 1.0 : 0.0;
      currentBoostRatio = THREE.MathUtils.lerp(
        currentBoostRatio,
        targetBoost,
        Math.min(1.0, p.hoverTransitionSpeed * dt)
      );
      const boostDrop = currentBoostRatio * 0.15;

      // Idle bobbing oscillation
      bobTime += dt * p.idleBobSpeed;
      const bobFactor = Math.max(0.0, 1.0 - currentSpeedRatio);
      const bobOffset = Math.sin(bobTime * Math.PI * 2.0) * p.idleBobAmount * bobFactor;

      const baseTargetHeight = THREE.MathUtils.lerp(p.idleHoverHeight, p.cruiseHoverHeight, currentSpeedRatio);
      effectiveHoverHeight = Math.max(0.4, baseTargetHeight - boostDrop + bobOffset);

      // 3. Ground Raycast Hover Suspension
      const currentAltitude = shipRoot.position.y;
      const compression = effectiveHoverHeight - currentAltitude;
      const isHovering = currentAltitude < p.idleHoverHeight + 2.0;

      if (isHovering) {
        const springForce = compression * p.hoverForce;
        const dampingForce = velocity.y * p.hoverDamping;
        velocity.y += (springForce - dampingForce) * dt;
      } else {
        velocity.y -= 19.8 * dt;
      }

      // Track floor protection
      if (shipRoot.position.y < 0.35) {
        shipRoot.position.y = 0.35;
        if (velocity.y < 0) velocity.y = 0;
      }

      // 4. Steering & Yaw Rotation (applied to physics body shipRoot)
      const targetTurn = steer * p.steeringSpeed;
      turnRate = THREE.MathUtils.lerp(turnRate, targetTurn, 10.0 * dt);
      shipYaw += turnRate * dt;
      shipRoot.rotation.y = shipYaw;

      // Directions
      const forwardDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), shipYaw);
      const rightDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), shipYaw);

      // 5. Thruster Acceleration & Braking
      const activeAccel = isBoosting ? p.boostAcceleration : p.acceleration;
      const activeMaxSpeed = isBoosting ? p.maxSpeed * p.boostMultiplier : p.maxSpeed;
      const forwardSpeed = velocity.dot(forwardDir);

      if (throttle > 0) {
        if (forwardSpeed < activeMaxSpeed) {
          velocity.addScaledVector(forwardDir, activeAccel * throttle * dt);
        }
      } else if (throttle < 0) {
        velocity.addScaledVector(forwardDir, -p.brakingForce * Math.abs(throttle) * dt);
      }

      // 6. Gliding Aerodynamics & Lateral Drift
      const forwardComp = forwardDir.clone().multiplyScalar(velocity.dot(forwardDir));
      const lateralComp = rightDir.clone().multiplyScalar(velocity.dot(rightDir));
      const verticalComp = new THREE.Vector3(0, velocity.y, 0);

      const gripDamp = Math.pow(p.lateralGrip, dt * 60.0);
      lateralComp.multiplyScalar(gripDamp);

      const dragFactor = Math.pow(p.drag, dt * 60.0);
      forwardComp.multiplyScalar(dragFactor);

      velocity.copy(forwardComp).add(lateralComp).add(verticalComp);

      // Apply movement step
      shipRoot.position.addScaledVector(velocity, dt);

      // Arena boundary repulsion
      const maxDist = trackSize / 2 - 6;
      if (Math.abs(shipRoot.position.x) > maxDist) {
        shipRoot.position.x = Math.sign(shipRoot.position.x) * maxDist;
        velocity.x *= -0.3;
      }
      if (Math.abs(shipRoot.position.z) > maxDist) {
        shipRoot.position.z = Math.sign(shipRoot.position.z) * maxDist;
        velocity.z *= -0.3;
      }

      // 7. Visual Roll Banking & Pitch Tilt (applied ONLY to ShipModel visual pivot!)
      const targetRoll = -steer * THREE.MathUtils.degToRad(p.maxRollAngle);
      const targetPitch = throttle * THREE.MathUtils.degToRad(p.pitchTiltAngle);
      currentRoll = THREE.MathUtils.lerp(currentRoll, targetRoll, p.rollSpeed * dt);
      currentPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, p.rollSpeed * dt);

      shipVisualMesh.rotation.z = currentRoll;
      shipVisualMesh.rotation.x = -currentPitch;

      // 8. Visual Thruster Flame Scaling
      const thrusterScale = throttle > 0 ? (isBoosting ? 2.2 : 1.3) : (throttle < 0 ? 0.3 : 0.7);
      if (plasmaLeftRef.current && plasmaRightRef.current) {
        plasmaLeftRef.current.scale.set(1, Math.max(0.2, thrusterScale + Math.sin(time * 0.03) * 0.1), 1);
        plasmaRightRef.current.scale.set(1, Math.max(0.2, thrusterScale + Math.cos(time * 0.03) * 0.1), 1);
      }
      hoverPad.material.opacity = isHovering ? 0.6 + Math.sin(time * 0.01) * 0.15 : 0.2;

      // Shadow blob follows ship horizontally
      if (shadowMeshRef.current) {
        shadowMeshRef.current.position.set(shipRoot.position.x, 0.03, shipRoot.position.z);
        shadowMeshRef.current.rotation.z = -shipYaw;
        const shadowScale = Math.max(0.4, 1.0 - (shipRoot.position.y - effectiveHoverHeight) * 0.2);
        shadowMeshRef.current.scale.set(shadowScale, shadowScale, shadowScale);
      }

      // 9. Camera Tracking (Tracks physics shipRoot directly, decoupled from visual mesh!)
      const camMode = p.cameraMode;

      if (camMode === 'rigid') {
        cameraRigidAnchor.position.set(0, p.cameraHeight, p.cameraDistance);
        const worldCamPos = new THREE.Vector3();
        cameraRigidAnchor.getWorldPosition(worldCamPos);
        camera.position.copy(worldCamPos);
        camera.quaternion.copy(shipRoot.quaternion);
        camera.rotateX(-THREE.MathUtils.degToRad(12));
        camera.fov = p.baseFov;
        camera.updateProjectionMatrix();
      } else if (camMode === 'smooth') {
        const speedRatio = Math.min(velocity.length() / p.maxSpeed, 1.8);
        const dynamicDistance = p.cameraDistance + speedRatio * 1.5;
        const dynamicHeight = p.cameraHeight + (keys.forward ? -0.2 : 0.0);

        const idealOffset = new THREE.Vector3(0, dynamicHeight, dynamicDistance).applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          shipYaw
        );
        const idealPos = shipRoot.position.clone().add(idealOffset);

        smoothCamPos.lerp(idealPos, Math.min(1.0, 12.0 * dt));
        camera.position.copy(smoothCamPos);

        const lookTarget = shipRoot.position.clone().add(forwardDir.clone().multiplyScalar(4.0));
        lookTarget.y += 0.8;
        smoothCamLook.lerp(lookTarget, Math.min(1.0, 15.0 * dt));
        camera.lookAt(smoothCamLook);

        const targetFov = p.baseFov + speedRatio * p.maxFovBoost;
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, p.cameraLerpWeight * dt);
        camera.updateProjectionMatrix();
      } else if (camMode === 'cockpit') {
        const cockpitPos = shipRoot.position.clone().add(new THREE.Vector3(0, 0.45, -0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), shipYaw));
        camera.position.copy(cockpitPos);
        const lookTarget = shipRoot.position.clone().add(forwardDir.clone().multiplyScalar(20.0));
        camera.lookAt(lookTarget);
        camera.fov = p.baseFov + 10;
        camera.updateProjectionMatrix();
      } else if (camMode === 'orbit') {
        const ox = shipRoot.position.x + orbitDistance * Math.sin(orbitPolar) * Math.sin(orbitAzimuth);
        const oy = shipRoot.position.y + orbitDistance * Math.cos(orbitPolar);
        const oz = shipRoot.position.z + orbitDistance * Math.sin(orbitPolar) * Math.cos(orbitAzimuth);
        camera.position.set(ox, oy, oz);
        camera.lookAt(shipRoot.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
        camera.fov = p.baseFov;
        camera.updateProjectionMatrix();
      }

      // Telemetry update
      const speedKmh = Math.round(velocity.length() * 3.6);
      const lateralSpeed = Math.abs(velocity.dot(rightDir));
      const driftPercent = Math.min(100, Math.round((lateralSpeed / (velocity.length() + 0.001)) * 100));

      onTelemetryUpdate({
        speedKmh,
        altitude: parseFloat(shipRoot.position.y.toFixed(2)),
        effectiveHoverHeight: parseFloat(effectiveHoverHeight.toFixed(2)),
        targetHoverHeight: parseFloat(baseTargetHeight.toFixed(2)),
        rollDeg: Math.round(THREE.MathUtils.radToDeg(currentRoll)),
        driftPercent,
        isHovering,
        isBoosting,
        heat: parseFloat(heat.toFixed(1)),
        isOverheated
      });

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Effect to load / swap 3D model inside the decoupled visual ShipModel slot
  useEffect(() => {
    const slot = modelSlotRef.current;
    if (!slot) return;

    let isCancelled = false;

    const updateModel = async () => {
      // Dispose previous model hierarchy
      while (slot.children.length > 0) {
        const child = slot.children[0];
        disposeThreeHierarchy(child);
        slot.remove(child);
      }

      if (!customModelBuffer) {
        // Fallback default procedural ship
        const def = createDefaultProceduralShip();
        if (isCancelled) return;
        slot.add(def.group);
        if (onModelMetaChange) onModelMetaChange(def.meta);
        alignThrustersToDimensions(def.meta.normalizedDimensions);
        return;
      }

      try {
        const gltfScene = await loadGLBFromBuffer(customModelBuffer);
        if (isCancelled) return;

        const normalized = processAndNormalizeModel(
          gltfScene,
          customModelFileName,
          customModelBuffer.byteLength,
          modelSettings
        );

        slot.add(normalized.rootGroup);
        if (onModelMetaChange) onModelMetaChange(normalized.meta);
        alignThrustersToDimensions(normalized.meta.normalizedDimensions);
      } catch (err: unknown) {
        if (isCancelled) return;
        const msg = (err as Error)?.message || 'Failed to load GLB model';
        if (onModelLoadError) onModelLoadError(msg);

        // Fallback to default on error
        const def = createDefaultProceduralShip();
        slot.add(def.group);
        if (onModelMetaChange) onModelMetaChange(def.meta);
        alignThrustersToDimensions(def.meta.normalizedDimensions);
      }
    };

    updateModel();

    return () => {
      isCancelled = true;
    };
  }, [customModelBuffer, customModelFileName, modelSettings]);

  // Adjust thruster housings and plasma flames to fit the rear of any imported mesh
  const alignThrustersToDimensions = (dims: { x: number; y: number; z: number }) => {
    const group = thrustersGroupRef.current;
    const plasmaL = plasmaLeftRef.current;
    const plasmaR = plasmaRightRef.current;
    const shadow = shadowMeshRef.current;

    const halfLength = dims.z / 2;
    const halfWidth = Math.max(0.5, dims.x * 0.32);
    const height = Math.max(0.15, dims.y * 0.3);

    if (group) {
      const thrusters = group.children.filter((c) => c !== plasmaL && c !== plasmaR);
      if (thrusters[0]) thrusters[0].position.set(-halfWidth, height, halfLength);
      if (thrusters[1]) thrusters[1].position.set(halfWidth, height, halfLength);
    }

    if (plasmaL) plasmaL.position.set(-halfWidth, height, halfLength + 0.9);
    if (plasmaR) plasmaR.position.set(halfWidth, height, halfLength + 0.9);

    if (shadow) {
      shadow.scale.set(Math.max(1.0, dims.x / 2.2), Math.max(1.0, dims.z / 4.2), 1.0);
    }
  };

  // Drag-and-drop onto simulation canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith('.glb')) {
        const buffer = await file.arrayBuffer();
        if (onFileDropped) {
          onFileDropped(buffer, file.name);
        }
      } else if (onModelLoadError) {
        onModelLoadError('Please drop a valid .glb file.');
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative w-full h-full select-none overflow-hidden bg-slate-950"
    >
      <div ref={mountRef} className="w-full h-full" />

      {/* Drag & drop visual feedback */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 bg-cyan-950/60 backdrop-blur-sm border-4 border-dashed border-cyan-400 flex flex-col items-center justify-center gap-2 pointer-events-none animate-pulse text-cyan-200">
          <span className="font-bold text-base tracking-wide">Drop .GLB file to load custom ship</span>
          <span className="text-xs text-cyan-300">Physics body stays 100% stable</span>
        </div>
      )}
    </div>
  );
};
