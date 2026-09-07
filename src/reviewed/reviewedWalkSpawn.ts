import type { FirstPersonCollisionBounds } from '../app/firstPersonCollision';
import type { FirstPersonHorizontalBounds } from '../app/firstPersonMovement';

/** Find a clear spawn near the map centre, without moving authored buildings. */
export function reviewedWalkSpawn(bounds: FirstPersonHorizontalBounds, colliders: readonly FirstPersonCollisionBounds[]): readonly [number, number, number] {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const extent = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
  for (let radius = 0; radius <= extent; radius += 8) {
    const samples = radius === 0 ? 1 : Math.max(8, Math.ceil(2 * Math.PI * radius / 8));
    for (let index = 0; index < samples; index++) {
      const angle = index / samples * Math.PI * 2;
      const x = cx + Math.cos(angle) * radius;
      const z = cz + Math.sin(angle) * radius;
      if (x < bounds.minX + 2 || x > bounds.maxX - 2 || z < bounds.minZ + 2 || z > bounds.maxZ - 2) continue;
      if (!colliders.some(c => x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1)) return [x, 1.8, z];
    }
  }
  throw new Error('The reviewed city has no clear walking spawn.');
}
