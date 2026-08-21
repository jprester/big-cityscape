import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  resolveFirstPersonHorizontalMovement,
  type FirstPersonCollisionIndex,
} from './firstPersonCollision';
import {
  calculateFirstPersonLook,
  calculateFirstPersonTravel,
  clampFirstPersonPosition,
  type FirstPersonHorizontalBounds,
} from './firstPersonMovement';

const MOVEMENT_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowDown',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);
const MOUSE_SENSITIVITY = 0.002;
const MAXIMUM_PITCH_RADIANS = Math.PI / 2 - 0.01;

export type FirstPersonController = Readonly<{
  enter: () => void;
  exit: () => void;
  isActive: () => boolean;
  update: (deltaSeconds: number) => boolean;
  dispose: () => void;
}>;

export type FirstPersonControllerConfig = Readonly<{
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  orbitControls: OrbitControls;
  bounds: FirstPersonHorizontalBounds;
  spawnPosition: readonly [xMetres: number, yMetres: number, zMetres: number];
  spawnTarget: readonly [xMetres: number, yMetres: number, zMetres: number];
  eyeHeightMetres: number;
  walkSpeedMetresPerSecond: number;
  fastMultiplier: number;
  boundaryInsetMetres: number;
  collisionIndex: FirstPersonCollisionIndex;
  collisionRadiusMetres: number;
  collisionSubstepMetres: number;
  nearPlaneMetres: number;
  onActiveChange: (active: boolean) => void;
  onChange: () => void;
}>;

export function createFirstPersonController(
  config: FirstPersonControllerConfig,
): FirstPersonController {
  if (
    !Number.isFinite(config.nearPlaneMetres) ||
    config.nearPlaneMetres <= 0 ||
    config.nearPlaneMetres >= config.collisionRadiusMetres
  ) {
    throw new RangeError(
      'The first-person near plane must be positive and smaller than the collision radius.',
    );
  }

  const pressedCodes = new Set<string>();
  const forwardDirection = new THREE.Vector3();
  const rightDirection = new THREE.Vector3();
  const cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  let active = false;
  let lockRequested = false;
  let pointerLockObserved = false;
  let lockFailureTimeoutId: number | undefined;
  let disposed = false;
  let inspectionNearPlaneMetres: number | undefined;

  const clearLockFailureTimeout = (): void => {
    if (lockFailureTimeoutId !== undefined) {
      window.clearTimeout(lockFailureTimeoutId);
      lockFailureTimeoutId = undefined;
    }
  };

  const activate = (): void => {
    if (disposed || active) {
      return;
    }

    config.orbitControls.enabled = false;
    inspectionNearPlaneMetres = config.camera.near;
    config.camera.near = config.nearPlaneMetres;
    config.camera.updateProjectionMatrix();
    config.camera.position.set(...config.spawnPosition);
    config.camera.lookAt(...config.spawnTarget);
    config.camera.position.y = config.eyeHeightMetres;
    config.camera.updateMatrixWorld();
    active = true;
    config.onActiveChange(true);
    config.onChange();
  };
  const deactivate = (): void => {
    pressedCodes.clear();

    if (!active) {
      return;
    }

    active = false;
    clearLockFailureTimeout();
    lockRequested = false;
    pointerLockObserved = false;
    config.orbitControls.enabled = true;

    if (inspectionNearPlaneMetres !== undefined) {
      config.camera.near = inspectionNearPlaneMetres;
      inspectionNearPlaneMetres = undefined;
      config.camera.updateProjectionMatrix();
    }

    config.camera.getWorldDirection(forwardDirection);
    forwardDirection.y = 0;

    if (forwardDirection.lengthSq() < 1e-6) {
      forwardDirection.set(0, 0, -1);
    } else {
      forwardDirection.normalize();
    }

    config.orbitControls.target
      .copy(config.camera.position)
      .addScaledVector(forwardDirection, 30);
    config.orbitControls.target.y = config.camera.position.y;
    config.orbitControls.update();
    config.onActiveChange(false);
    config.onChange();
  };
  const onPointerLockChange = (): void => {
    if (document.pointerLockElement === config.canvas) {
      clearLockFailureTimeout();
      lockRequested = false;
      pointerLockObserved = true;
      activate();
      return;
    }

    if (lockRequested) {
      return;
    }

    deactivate();
  };
  const onPointerLockError = (): void => {
    if (!lockRequested) {
      deactivate();
    }
  };
  const onMouseMove = (event: MouseEvent): void => {
    if (!active || document.pointerLockElement !== config.canvas) {
      return;
    }

    cameraEuler.setFromQuaternion(config.camera.quaternion);
    const look = calculateFirstPersonLook(
      cameraEuler.y,
      cameraEuler.x,
      event.movementX,
      event.movementY,
      MOUSE_SENSITIVITY,
      MAXIMUM_PITCH_RADIANS,
    );
    cameraEuler.y = look.yawRadians;
    cameraEuler.x = look.pitchRadians;
    config.camera.quaternion.setFromEuler(cameraEuler);
    config.onChange();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!active || !MOVEMENT_CODES.has(event.code)) {
      return;
    }

    event.preventDefault();
    pressedCodes.add(event.code);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    if (!MOVEMENT_CODES.has(event.code)) {
      return;
    }

    pressedCodes.delete(event.code);

    if (active) {
      event.preventDefault();
    }
  };
  const clearPressedCodes = (): void => pressedCodes.clear();

  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearPressedCodes);

  return {
    enter: () => {
      if (disposed) {
        throw new Error('A disposed first-person controller cannot be entered.');
      }

      config.canvas.focus();
      lockRequested = true;
      pointerLockObserved = false;
      activate();
      void config.canvas.requestPointerLock().catch(onPointerLockError);
      lockFailureTimeoutId = window.setTimeout(() => {
        lockFailureTimeoutId = undefined;

        if (document.pointerLockElement === config.canvas) {
          lockRequested = false;
          pointerLockObserved = true;
        } else {
          deactivate();
        }
      }, 1_000);
    },
    exit: () => {
      if (document.pointerLockElement === config.canvas) {
        void document.exitPointerLock();
      }

      deactivate();
    },
    isActive: () => active,
    update: (deltaSeconds) => {
      if (!active) {
        return false;
      }

      if (document.pointerLockElement === config.canvas) {
        pointerLockObserved = true;
        lockRequested = false;
      } else if (pointerLockObserved) {
        deactivate();
        return true;
      }

      const forwardAxis =
        Number(pressedCodes.has('KeyW') || pressedCodes.has('ArrowUp')) -
        Number(pressedCodes.has('KeyS') || pressedCodes.has('ArrowDown'));
      const rightAxis =
        Number(pressedCodes.has('KeyD') || pressedCodes.has('ArrowRight')) -
        Number(pressedCodes.has('KeyA') || pressedCodes.has('ArrowLeft'));

      if (forwardAxis === 0 && rightAxis === 0) {
        return false;
      }

      const fast =
        pressedCodes.has('ShiftLeft') || pressedCodes.has('ShiftRight');
      const travel = calculateFirstPersonTravel(
        forwardAxis,
        rightAxis,
        config.walkSpeedMetresPerSecond * (fast ? config.fastMultiplier : 1),
        Math.min(deltaSeconds, 0.1),
      );
      config.camera.getWorldDirection(forwardDirection);
      forwardDirection.y = 0;
      forwardDirection.normalize();
      rightDirection.crossVectors(forwardDirection, config.camera.up).normalize();
      const resolvedPosition = resolveFirstPersonHorizontalMovement(
        [config.camera.position.x, config.camera.position.z],
        [
          forwardDirection.x * travel.forwardMetres +
            rightDirection.x * travel.rightMetres,
          forwardDirection.z * travel.forwardMetres +
            rightDirection.z * travel.rightMetres,
        ],
        config.collisionIndex,
        config.collisionRadiusMetres,
        config.collisionSubstepMetres,
      );
      config.camera.position.x = resolvedPosition[0];
      config.camera.position.z = resolvedPosition[1];
      const clamped = clampFirstPersonPosition(
        [
          config.camera.position.x,
          config.camera.position.y,
          config.camera.position.z,
        ],
        config.bounds,
        config.eyeHeightMetres,
        config.boundaryInsetMetres,
      );
      config.camera.position.set(...clamped);
      return true;
    },
    dispose: () => {
      if (disposed) {
        return;
      }

      if (document.pointerLockElement === config.canvas) {
        void document.exitPointerLock();
      }

      deactivate();
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('pointerlockerror', onPointerLockError);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearPressedCodes);
      pressedCodes.clear();
      disposed = true;
    },
  };
}
