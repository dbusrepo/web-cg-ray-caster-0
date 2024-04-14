import { Raycaster } from './raycaster';

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
  eNormVelX: number;
  eNormVelY: number;

  foundCollision: boolean;
  eCollisionDist: number;
  eCollisionX: number;
  eCollisionY: number;

  // eSlidePlaneA: number;
  // eSlidePlaneB: number;
  // eSlidePlaneC: number;

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

  let ePosX = collInfo.eBasePointX;
  let ePosY = collInfo.eBasePointY;

  const veryCloseDistance = 1e-3;
  const longRadius = 1.0 + veryCloseDistance;

  for (let i = 0; i < 5; i++) {
    let { eVelX, eVelY } = collInfo;
    let eDestX = ePosX + eVelX;
    let eDestY = ePosY + eVelY;
    collInfo.foundCollision = false;
    collInfo.eCollisionDist = Number.MAX_VALUE;
    raycaster.checkCollisions();
    if (!raycaster.CollisionInfo.foundCollision) {
      ePosX = eDestX;
      ePosY = eDestY;
      break;
    }
    const dist = raycaster.CollisionInfo.eCollisionDist;
    const shortDist = Math.max(dist - veryCloseDistance, 0);
    ePosX += shortDist * collInfo.eNormVelX;
    ePosY += shortDist * collInfo.eNormVelY;

    // slide plane

    let slidePlaneA = ePosX - collInfo.eCollisionX;
    let slidePlaneB = ePosY - collInfo.eCollisionY;
    const slidePlaneNormalLen =
      1 / Math.sqrt(slidePlaneA * slidePlaneA + slidePlaneB * slidePlaneB);
    slidePlaneA *= slidePlaneNormalLen;
    slidePlaneB *= slidePlaneNormalLen;
    const slidePlaneC =
      -slidePlaneA * collInfo.eCollisionX - slidePlaneB * collInfo.eCollisionY;

    // project dest to slide plane
    const destDist = slidePlaneA * eDestX + slidePlaneB * eDestY + slidePlaneC;
    eDestX -= (destDist - longRadius) * slidePlaneA;
    eDestY -= (destDist - longRadius) * slidePlaneB;
    eVelX = eDestX - ePosX;
    eVelY = eDestY - ePosY;

    const newVelLen = Math.sqrt(eVelX * eVelX + eVelY * eVelY);
    if (newVelLen < veryCloseDistance) {
      ePosX = eDestX;
      ePosY = eDestY;
      break;
    }

    collInfo.eBasePointX = ePosX;
    collInfo.eBasePointY = ePosY;
    collInfo.eVelX = eVelX; // TODO:
    collInfo.eVelY = eVelY;
    collInfo.r2PosX = ePosX * collInfo.eRadX;
    collInfo.r2PosY = ePosY * collInfo.eRadY;
    collInfo.r2VelX = eVelX * collInfo.eRadX;
    collInfo.r2VelY = eVelY * collInfo.eRadY;
  }

  // cvt back to r2
  const r2FinalPosX = ePosX * collInfo.eRadX;
  const r2FinalPosY = ePosY * collInfo.eRadY;
  raycaster.movePlayer(r2FinalPosX, r2FinalPosY);
}

function getLowestRoot(
  a: number,
  b: number,
  c: number,
  maxR: number,
): number | null {
  const determinant = b * b - 4 * a * c;

  if (determinant < 0) {
    return null;
  }

  const sqrtD = Math.sqrt(determinant);
  let r1, r2;

  // r1 = (-b - sqrtD) / (2 * a);
  // r2 = (-b + sqrtD) / (2 * a);

  if (b < 0) {
    r1 = (2 * c) / (-b + sqrtD);
    r2 = (-b + sqrtD) / (2 * a);
  } else {
    r1 = (-b - sqrtD) / (2 * a);
    r2 = (2 * c) / (-b - sqrtD);
  }

  if (r1 > r2) {
    const temp = r1;
    r1 = r2;
    r2 = temp;
  }

  if (r1 > 0 && r1 < maxR) {
    return r1;
  }

  if (r2 > 0 && r2 < maxR) {
    return r2;
  }

  return null;
}

function checkEdgeCollision(
  raycaster: Raycaster,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  const collInfo = raycaster.CollisionInfo;
  const { eRadX, eRadY, eBasePointX, eBasePointY, eVelX, eVelY } = collInfo;

  let eX0 = x0 / eRadX;
  let eY0 = y0 / eRadY;
  let eX1 = x1 / eRadX;
  let eY1 = y1 / eRadY;

  // swap eX0,eY0 with eX1,eY1 if player is on the negative side of the edge
  if (
    (eBasePointX - eX0) * (eY0 - eY1) + (eBasePointY - eY0) * (eX1 - eX0) <
    0
  ) {
    let temp = eX0;
    eX0 = eX1;
    eX1 = temp;
    temp = eY0;
    eY0 = eY1;
    eY1 = temp;
  }

  // edge line eq
  let a = eY0 - eY1;
  let b = eX1 - eX0;
  const invNormLen = 1 / Math.sqrt(a * a + b * b);
  a *= invNormLen;
  b *= invNormLen;
  const c = (eX0 * eY1 - eX1 * eY0) * invNormLen;

  // const invNormLen = 1 / normLen;
  // a *= invNormLen;
  // b *= invNormLen;
  // const c = -a * eX0 - b * eY0;

  // distance from edge
  const dist = a * eBasePointX + b * eBasePointY + c;
  let t0, t1;
  let embedded = false;

  // normal dot vel
  const normalDotVel = a * eVelX + b * eVelY;

  if (Math.abs(normalDotVel) < 1e-3) {
    if (dist >= 1) {
      return;
    }
    embedded = true;
    t0 = 0;
    t1 = 1;
  } else {
    // compute intersection points
    const invNormalDotVel = 1 / normalDotVel;
    t0 = (-1 - dist) * invNormalDotVel;
    t1 = (1 - dist) * invNormalDotVel;

    if (t0 > t1) {
      const temp = t0;
      t0 = t1;
      t1 = temp;
    }

    if (t0 > 1 || t1 < 0) {
      return;
    }

    t0 = Math.max(t0, 0);
    t1 = Math.min(t1, 1);
  }

  let foundCollision = false;
  let collisionX, collisionY;
  let t = 1.0;

  if (!embedded) {
    // get the intersection point on the edge
    const intersectX = eBasePointX + eVelX * t0 - a;
    const intersectY = eBasePointY + eVelY * t0 - b;

    // check if intersection point is on edge
    const dot0 =
      (intersectX - eX0) * (eX1 - eX0) + (intersectY - eY0) * (eY1 - eY0);
    const dot1 =
      (intersectX - eX1) * (eX0 - eX1) + (intersectY - eY1) * (eY0 - eY1);
    if (dot0 >= 0 && dot1 >= 0) {
      foundCollision = true;
      t = t0;
      collisionX = intersectX;
      collisionY = intersectY;
    }
  }

  if (!foundCollision) {
    // check collision with end points

    // find the closest end point
    let dist0 =
      (eBasePointX - eX0) * (eBasePointX - eX0) +
      (eBasePointY - eY0) * (eBasePointY - eY0);
    let dist1 =
      (eBasePointX - eX1) * (eBasePointX - eX1) +
      (eBasePointY - eY1) * (eBasePointY - eY1);
    let closestX, closestY;
    if (dist0 < dist1) {
      closestX = eX0;
      closestY = eY0;
    } else {
      closestX = eX1;
      closestY = eY1;
    }

    // now check if collision with closest end point
    const a0 = eVelX * eVelX + eVelY * eVelY;
    const b0 =
      2 * ((eBasePointX - closestX) * eVelX + (eBasePointY - closestY) * eVelY);
    const c0 =
      (eBasePointX - closestX) * (eBasePointX - closestX) +
      (eBasePointY - closestY) * (eBasePointY - closestY) -
      1;

    const root = getLowestRoot(a0, b0, c0, t);
    if (root !== null) {
      foundCollision = true;
      t = root;
      collisionX = closestX;
      collisionY = closestY;
    }
  }

  if (foundCollision) {
    const velLen = Math.sqrt(eVelX * eVelX + eVelY * eVelY);
    const collisionDist = t * velLen;

    if (collisionDist < collInfo.eCollisionDist) {
      collInfo.foundCollision = true; // TODO:
      collInfo.eCollisionDist = collisionDist;
      collInfo.eCollisionX = collisionX!;
      collInfo.eCollisionY = collisionY!;
      collInfo.eNormVelX = eVelX / velLen;
      collInfo.eNormVelY = eVelY / velLen;
    }
  }
}

export { CollisionInfo, collideAndSlide, checkEdgeCollision };
