import { Raycaster } from './raycaster';

// const vec2Norm = (v: Vec2) => {
//   const mag = Math.sqrt(v.x * v.x + v.y * v.y);
//   return { x: v.x / mag, y: v.y / mag };
// };

class CollisionInfo {

  r2PosX: number;
  r2PosY: number;
  r2VelX: number;
  r2VelY: number;

  eRadX: number;
  eRadY: number;

  eBasePointX: number;
  eBasePointY: number;
  eVelX: number;
  eVelY: number;
  // eNormVelX: number;
  // eNormVelY: number;

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
  collInfo.eBasePointX = collInfo.r2PosX / collInfo.eRadX;
  collInfo.eBasePointY = collInfo.r2PosY / collInfo.eRadY;
  collInfo.eVelX = collInfo.r2VelX / collInfo.eRadX;
  collInfo.eVelY = collInfo.r2VelY / collInfo.eRadY;
  collideWithWorld(raycaster);
};

function collideWithWorld(raycaster: Raycaster) {
  const collInfo = raycaster.CollisionInfo;

  const finalPosX = collInfo.eBasePointX + collInfo.eVelX;
  const finalPosY = collInfo.eBasePointY + collInfo.eVelY;

  raycaster.CollisionInfo.foundCollision = false;
  raycaster.CollisionInfo.nearestDistance = Number.MAX_VALUE;

  for (let i = 0; i < 2; i++) {
    raycaster.checkXCollisions();
    raycaster.checkYCollisions();
    if (!raycaster.CollisionInfo.foundCollision) {
      break;
    }
    // collision response TODO:
  }

  // cvt back to r2
  const r2FinalPosX = finalPosX * raycaster.CollisionInfo.eRadX;
  const r2FinalPosY = finalPosY * raycaster.CollisionInfo.eRadY;
  raycaster.movePlayer(r2FinalPosX, r2FinalPosY);
}

function checkEdgeCollision(
  raycaster: Raycaster,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const collInfo = raycaster.CollisionInfo;

  const eX0 = x0 / collInfo.eRadX;
  const eY0 = y0 / collInfo.eRadY;
  const eX1 = x1 / collInfo.eRadX;
  const eY1 = y1 / collInfo.eRadY;

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

export { CollisionInfo, collideAndSlide, checkEdgeCollision };
