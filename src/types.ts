export interface PhysicsParams {
  hoverHeight: number;
  hoverForce: number;
  hoverDamping: number;
  maxSpeed: number;
  acceleration: number;
  brakingForce: number;
  steeringSpeed: number;
  lateralGrip: number;
  maxRollAngle: number;
  rollSpeed: number;
  pitchTiltAngle: number;
  boostMultiplier: number;
  cameraDistance: number;
  cameraHeight: number;
  cameraFov: number;
  cameraMode: 'rigid' | 'smooth' | 'cockpit' | 'orbit';
}

export const DEFAULT_PHYSICS: PhysicsParams = {
  hoverHeight: 1.3,
  hoverForce: 48.0,
  hoverDamping: 6.5,
  maxSpeed: 70.0,
  acceleration: 48.0,
  brakingForce: 35.0,
  steeringSpeed: 2.6,
  lateralGrip: 0.86,
  maxRollAngle: 30.0,
  rollSpeed: 7.0,
  pitchTiltAngle: 10.0,
  boostMultiplier: 1.55,
  cameraDistance: 6.0,
  cameraHeight: 2.5,
  cameraFov: 75.0,
  cameraMode: 'smooth'
};
