import { Raycaster } from './raycaster';

// const vec2Norm = (v: Vec2) => {
//   const mag = Math.sqrt(v.x * v.x + v.y * v.y);
//   return { x: v.x / mag, y: v.y / mag };
// };

class CollisionInfo {
  r2VelX: number;
  r2VelY: number;
  r2PosX: number;
  r2PosY: number;
  eRadX: number;
  eRadY: number;
  eVelX: number;
  eVelY: number;
  eNormVelX: number;
  eNormVelY: number;
  eBasePointX: number;
  eBasePointY: number;
  foundCollision: boolean;
  nearestDistance: number;
  nearestX: number;
  nearestY: number;

  constructor(eRadX: number, eRadY: number) {
    this.eRadX = eRadX;
    this.eRadY = eRadY;
  }
}

const collideAndSlide = (raycaster: Raycaster, velX: number, velY: number) => {
  const collInfo = raycaster.CollisionInfo;
  collInfo.r2PosX = raycaster.Player.PosX;
  collInfo.r2PosY = raycaster.Player.PosY;
  collInfo.r2VelX = velX;
  collInfo.r2VelY = velY;
  const ePosX = collInfo.r2PosX / collInfo.eRadX;
  const ePosY = collInfo.r2PosY / collInfo.eRadY;
  const eVelX = collInfo.r2VelX / collInfo.eRadX;
  const eVelY = collInfo.r2VelY / collInfo.eRadY;
  collideWithWorld(raycaster, ePosX, ePosY, eVelX, eVelY);
};

function collideWithWorld(
  raycaster: Raycaster,
  ePosX: number,
  ePosY: number,
  eVelX: number,
  eVelY: number,
) {
  const finalPosX = ePosX + eVelX;
  const finalPosY = ePosY + eVelY;

  // cvt back to r2
  const r2FinalPosX = finalPosX * raycaster.CollisionInfo.eRadX;
  const r2FinalPosY = finalPosY * raycaster.CollisionInfo.eRadY;
  raycaster.movePlayer(r2FinalPosX, r2FinalPosY);
}

// const collideWithWorld = (raycaster: Raycaster, pos: Vec2, vel: Vec2) =>
//   collideWithWorldRec(raycaster, pos, vel, 0);
//
// const MAX_REC_DEPTH = 5;
//
// const collisionInfo = new CollisionInfo();
//
// const collideWithWorldRec = (
//   raycaster: Raycaster,
//   pos: Vec2,
//   vel: Vec2,
//   recDepth: number,
// ) => {
//   if (recDepth > MAX_REC_DEPTH) {
//     return pos;
//   }
// };

// export type {
// };

export { CollisionInfo, collideAndSlide };
