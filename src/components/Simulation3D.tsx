import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { PhysicsParams } from '../types.ts';

interface SimulationProps {
  physics: PhysicsParams;
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
  onTelemetryUpdate,
  isPaused
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const physicsRef = useRef(physics);
  physicsRef.current = physics;

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
      // Don't capture keys if typing in an input/textarea
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

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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
    const ambientLight = new THREE.AmbientLight(0x2a3b5c, 1.2);
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
    scene.add(sunLight);

    // Cyan accent light
    const accentLight = new THREE.DirectionalLight(0x00f0ff, 0.8);
    accentLight.position.set(-30, 20, -20);
    scene.add(accentLight);

    // --- TRACK ENVIRONMENT ---
    // 1. Base Ground Plane (Requested: A plane for the track)
    const trackSize = 300;
    const planeGeo = new THREE.PlaneGeometry(trackSize, trackSize, 60, 60);
    planeGeo.rotateX(-Math.PI / 2);

    // High-tech circuit grid shader/canvas texture
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 1024, 1024);

    // Grid lines
    ctx.strokeStyle = '#152238';
    ctx.lineWidth = 2;
    const step = 64;
    for (let x = 0; x <= 1024; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Racing circuit loop lines
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.roundRect(128, 128, 768, 768, 180);
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 20]);
    ctx.beginPath();
    ctx.roundRect(170, 170, 684, 684, 150);
    ctx.stroke();
    ctx.setLineDash([]);

    const trackTexture = new THREE.CanvasTexture(canvas);
    trackTexture.wrapS = THREE.RepeatWrapping;
    trackTexture.wrapT = THREE.RepeatWrapping;
    trackTexture.repeat.set(4, 4);

    const planeMat = new THREE.MeshStandardMaterial({
      map: trackTexture,
      roughness: 0.7,
      metalness: 0.2
    });
    const trackPlane = new THREE.Mesh(planeGeo, planeMat);
    trackPlane.receiveShadow = true;
    scene.add(trackPlane);

    // Surrounding boundary barriers & glowing apex curbs
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x0284c7,
      emissiveIntensity: 0.2,
      roughness: 0.4
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

    // Glowing speed pads on track
    const padGeo = new THREE.PlaneGeometry(8, 20);
    padGeo.rotateX(-Math.PI / 2);
    const padMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const padPositions = [
      [0, 0.05, -50],
      [60, 0.05, 30],
      [-60, 0.05, 30]
    ];
    padPositions.forEach(([px, py, pz]) => {
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(px, py, pz);
      scene.add(pad);
    });

    // Pylons / Checkpoint Gate
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

    // --- GLIDING SHIP (Requested: A rectangle for the ship) ---
    // Root ship container (handles world translation and yaw)
    const shipRoot = new THREE.Group();
    shipRoot.position.set(0, physics.idleHoverHeight, 0);
    scene.add(shipRoot);

    // Ship Visual Model (handles roll banking and pitch tilt)
    const shipVisualMesh = new THREE.Group();
    shipRoot.add(shipVisualMesh);

    // Main rectangular fuselage (as requested: rectangle/box for the ship)
    const shipWidth = 2.2;
    const shipHeight = 0.65;
    const shipLength = 4.2;

    const shipBodyGeo = new THREE.BoxGeometry(shipWidth, shipHeight, shipLength);
    const shipBodyMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9, // Electric cyan
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x0369a1,
      emissiveIntensity: 0.3
    });
    const shipBodyMesh = new THREE.Mesh(shipBodyGeo, shipBodyMat);
    shipBodyMesh.castShadow = true;
    shipBodyMesh.receiveShadow = true;
    shipVisualMesh.add(shipBodyMesh);

    // Aerodynamic details: Cockpit canopy
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
    shipVisualMesh.add(canopyMesh);

    // Aerodynamic forward nose wedge
    const noseGeo = new THREE.ConeGeometry(1.0, 1.4, 4);
    noseGeo.rotateX(-Math.PI / 2);
    noseGeo.rotateZ(Math.PI / 4);
    const noseMesh = new THREE.Mesh(noseGeo, shipBodyMat);
    noseMesh.position.set(0, 0, -shipLength / 2 - 0.5);
    shipVisualMesh.add(noseMesh);

    // Left and Right gliding wings
    const wingGeo = new THREE.BoxGeometry(1.5, 0.12, 2.2);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.8, roughness: 0.3 });
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(-1.6, -0.05, 0.5);
    leftWing.rotation.z = THREE.MathUtils.degToRad(-8);
    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(1.6, -0.05, 0.5);
    rightWing.rotation.z = THREE.MathUtils.degToRad(8);
    shipVisualMesh.add(leftWing, rightWing);

    // Dual Thrusters / Engine Flares
    const thrusterGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 16);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterHousingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 });
    const thrusterL = new THREE.Mesh(thrusterGeo, thrusterHousingMat);
    thrusterL.position.set(-0.7, 0, shipLength / 2);
    const thrusterR = new THREE.Mesh(thrusterGeo, thrusterHousingMat);
    thrusterR.position.set(0.7, 0, shipLength / 2);
    shipVisualMesh.add(thrusterL, thrusterR);

    // Plasma Exhaust Cones
    const plasmaGeo = new THREE.ConeGeometry(0.28, 1.8, 16);
    plasmaGeo.rotateX(-Math.PI / 2);
    const plasmaMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85
    });
    const plasmaL = new THREE.Mesh(plasmaGeo, plasmaMat);
    plasmaL.position.set(-0.7, 0, shipLength / 2 + 0.9);
    const plasmaR = new THREE.Mesh(plasmaGeo, plasmaMat);
    plasmaR.position.set(0.7, 0, shipLength / 2 + 0.9);
    shipVisualMesh.add(plasmaL, plasmaR);

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
    hoverPad.position.set(0, -0.34, 0);
    shipVisualMesh.add(hoverPad);

    // Shadow blob projector under ship
    const shadowGeo = new THREE.PlaneGeometry(3.5, 6.0);
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

    // --- PHYSICS ENGINE STATE (matching Godot CharacterBody3D logic) ---
    const velocity = new THREE.Vector3(0, 0, 0);
    let shipYaw = 0; // facing direction in radians
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

    // Rigid parented camera anchor node (Requested: camera parented to the ship)
    const cameraRigidAnchor = new THREE.Object3D();
    cameraRigidAnchor.position.set(0, physics.cameraHeight, physics.cameraDistance);
    shipRoot.add(cameraRigidAnchor);

    // Orbit mouse controls when in orbit mode
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

    // Smooth follow camera current position
    const smoothCamPos = new THREE.Vector3(0, 10, 20);
    const smoothCamLook = new THREE.Vector3(0, 0, 0);

    let lastTime = performance.now();
    let animId: number;

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);

      const dt = Math.min((time - lastTime) / 1000, 0.05); // cap at 50ms
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
      const steer = (keys.left ? 1.0 : 0.0) - (keys.right ? 1.0 : 0.0); // +1 = turn left
      const rawBoostInput = keys.boost;

      // 1. Nitro Overheat System Logic
      // Boost is only active if boost key held, throttle forward, and engine NOT overheated
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

      // 1. Hover Lift Effect Calculation (Opposing forces: hover vs acceleration)
      const horizontalSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
      const targetSpeedRatio = Math.min(1.0, horizontalSpeed / p.maxSpeed);

      // Smooth speed ratio so transition has aerodynamic inertia
      currentSpeedRatio = THREE.MathUtils.lerp(
        currentSpeedRatio,
        targetSpeedRatio,
        Math.min(1.0, p.hoverTransitionSpeed * dt)
      );

      // Boost lowers it a little further (smoothly)
      const targetBoost = isBoosting ? 1.0 : 0.0;
      currentBoostRatio = THREE.MathUtils.lerp(
        currentBoostRatio,
        targetBoost,
        Math.min(1.0, p.hoverTransitionSpeed * dt)
      );
      const boostDrop = currentBoostRatio * 0.15;

      // Gentle idle bobbing sine wave when slowed or stopped (fades out at speed)
      bobTime += dt * p.idleBobSpeed;
      const bobFactor = Math.max(0.0, 1.0 - currentSpeedRatio);
      const bobOffset = Math.sin(bobTime * Math.PI * 2.0) * p.idleBobAmount * bobFactor;

      // Target hover height smoothly transitions from idle (high) to cruise (low)
      const baseTargetHeight = THREE.MathUtils.lerp(p.idleHoverHeight, p.cruiseHoverHeight, currentSpeedRatio);
      effectiveHoverHeight = Math.max(0.4, baseTargetHeight - boostDrop + bobOffset);

      // 2. Raycast Hover Suspension (downward to track plane at y = 0)
      const currentAltitude = shipRoot.position.y;
      const compression = effectiveHoverHeight - currentAltitude;
      const isHovering = currentAltitude < p.idleHoverHeight + 2.0;

      if (isHovering) {
        const springForce = compression * p.hoverForce;
        const dampingForce = velocity.y * p.hoverDamping;
        velocity.y += (springForce - dampingForce) * dt;
      } else {
        // Fall under gravity if in air
        velocity.y -= 19.8 * dt;
      }

      // Bounce prevention on track plane ground
      if (shipRoot.position.y < 0.35) {
        shipRoot.position.y = 0.35;
        if (velocity.y < 0) velocity.y = 0;
      }

      // 2. Steering & Yaw Rotation
      const targetTurn = steer * p.steeringSpeed;
      turnRate = THREE.MathUtils.lerp(turnRate, targetTurn, 10.0 * dt);
      shipYaw += turnRate * dt;
      shipRoot.rotation.y = shipYaw;

      // Forward and Right vectors (Godot convention: forward is -Z)
      const forwardDir = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), shipYaw);
      const rightDir = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), shipYaw);

      // 3. Forward Thruster Acceleration & Reverse Air-Braking
      const activeAccel = isBoosting ? p.boostAcceleration : p.acceleration;
      const activeMaxSpeed = isBoosting ? p.maxSpeed * p.boostMultiplier : p.maxSpeed;

      const forwardSpeed = velocity.dot(forwardDir);

      if (throttle > 0) {
        if (forwardSpeed < activeMaxSpeed) {
          velocity.addScaledVector(forwardDir, activeAccel * throttle * dt);
        }
      } else if (throttle < 0) {
        // Braking / reverse
        velocity.addScaledVector(forwardDir, -p.brakingForce * Math.abs(throttle) * dt);
      }

      // 4. Gliding Lateral Friction (Arcade Drift Mechanics)
      const forwardComp = forwardDir.clone().multiplyScalar(velocity.dot(forwardDir));
      const lateralComp = rightDir.clone().multiplyScalar(velocity.dot(rightDir));
      const verticalComp = new THREE.Vector3(0, velocity.y, 0);

      // Dampen sideways sliding by lateral grip factor
      const gripDamp = Math.pow(p.lateralGrip, dt * 60.0);
      lateralComp.multiplyScalar(gripDamp);

      // Aerodynamic forward drag
      const dragFactor = Math.pow(p.drag, dt * 60.0);
      forwardComp.multiplyScalar(dragFactor);

      velocity.copy(forwardComp).add(lateralComp).add(verticalComp);

      // Apply movement step
      shipRoot.position.addScaledVector(velocity, dt);

      // Keep ship within track bounds with soft repulsion
      const maxDist = trackSize / 2 - 6;
      if (Math.abs(shipRoot.position.x) > maxDist) {
        shipRoot.position.x = Math.sign(shipRoot.position.x) * maxDist;
        velocity.x *= -0.5;
      }
      if (Math.abs(shipRoot.position.z) > maxDist) {
        shipRoot.position.z = Math.sign(shipRoot.position.z) * maxDist;
        velocity.z *= -0.5;
      }

      // 5. Visual Roll Banking & Pitch Tilt
      const targetRoll = -steer * THREE.MathUtils.degToRad(p.maxRollAngle);
      const targetPitch = throttle * THREE.MathUtils.degToRad(p.pitchTiltAngle);
      currentRoll = THREE.MathUtils.lerp(currentRoll, targetRoll, p.rollSpeed * dt);
      currentPitch = THREE.MathUtils.lerp(currentPitch, targetPitch, p.rollSpeed * dt);

      shipVisualMesh.rotation.z = currentRoll;
      shipVisualMesh.rotation.x = -currentPitch;

      // 6. Thruster plasma pulse & scaling
      const thrusterScale = throttle > 0 ? (isBoosting ? 2.2 : 1.3) : (throttle < 0 ? 0.3 : 0.7);
      plasmaL.scale.set(1, Math.max(0.2, thrusterScale + Math.sin(time * 0.03) * 0.1), 1);
      plasmaR.scale.set(1, Math.max(0.2, thrusterScale + Math.cos(time * 0.03) * 0.1), 1);
      hoverPad.material.opacity = isHovering ? 0.6 + Math.sin(time * 0.01) * 0.15 : 0.2;

      // Update ground shadow blob
      shadowMesh.position.set(shipRoot.position.x, 0.03, shipRoot.position.z);
      shadowMesh.rotation.z = -shipYaw;
      const shadowScale = Math.max(0.4, 1.0 - (shipRoot.position.y - effectiveHoverHeight) * 0.2);
      shadowMesh.scale.set(shadowScale, shadowScale, shadowScale);

      // 7. Dynamic Camera Tracking
      const camMode = p.cameraMode;

      if (camMode === 'rigid') {
        // Direct rigid parenting (exactly as requested: camera child node in Godot!)
        cameraRigidAnchor.position.set(0, p.cameraHeight, p.cameraDistance);
        const worldCamPos = new THREE.Vector3();
        cameraRigidAnchor.getWorldPosition(worldCamPos);
        camera.position.copy(worldCamPos);
        camera.quaternion.copy(shipRoot.quaternion);
        // Tilt slightly down to look at ship forward
        camera.rotateX(-THREE.MathUtils.degToRad(12));
        camera.fov = p.baseFov;
        camera.updateProjectionMatrix();
      } else if (camMode === 'smooth') {
        // High-octane smooth chaser with dynamic FOV stretch (F-Zero / Wipeout style)
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

        // Speed FOV warp
        const targetFov = p.baseFov + speedRatio * p.maxFovBoost;
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, p.cameraLerpWeight * dt);
        camera.updateProjectionMatrix();
      } else if (camMode === 'cockpit') {
        // Nose camera inside cockpit
        const cockpitPos = shipRoot.position.clone().add(new THREE.Vector3(0, 0.45, -0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), shipYaw));
        camera.position.copy(cockpitPos);
        const lookTarget = shipRoot.position.clone().add(forwardDir.clone().multiplyScalar(20.0));
        camera.lookAt(lookTarget);
        camera.fov = p.baseFov + 10;
        camera.updateProjectionMatrix();
      } else if (camMode === 'orbit') {
        // Free orbit camera around ship
        const ox = shipRoot.position.x + orbitDistance * Math.sin(orbitPolar) * Math.sin(orbitAzimuth);
        const oy = shipRoot.position.y + orbitDistance * Math.cos(orbitPolar);
        const oz = shipRoot.position.z + orbitDistance * Math.sin(orbitPolar) * Math.cos(orbitAzimuth);
        camera.position.set(ox, oy, oz);
        camera.lookAt(shipRoot.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
        camera.fov = p.baseFov;
        camera.updateProjectionMatrix();
      }

      // Telemetry emit
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

    // Resize handler
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

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-950">
      <div ref={mountRef} className="w-full h-full" />
    </div>
  );
};
