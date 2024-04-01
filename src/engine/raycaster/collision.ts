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

  // if (b < 0) {
  //   r1 = (2 * c) / (-b + sqrtD);
  //   r2 = (-b + sqrtD) / (2 * a);
  // } else {
  //   r1 = (-b - sqrtD) / (2 * a);
  //   r2 = (2 * c) / (-b - sqrtD);
  // }

  r1 = (-b - sqrtD) / (2 * a);
  r2 = (-b + sqrtD) / (2 * a);

  console.log('r1: ', r1, ' r2: ', r2, ' maxR: ', maxR);

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
  // console.log('check with edge', x0, y0, x1, y1);

  console.log('');

  const collInfo = raycaster.CollisionInfo;
  const { eRadX, eRadY, eBasePointX, eBasePointY, eVelX, eVelY } = collInfo;
  const { r2PosX, r2PosY, r2VelX, r2VelY } = collInfo;

  // swap x0,y0 with x1,y1 if player is on the negative side of the edge
  if (x0 * (r2PosY - y0) + y0 * (x0 - r2PosX) < 0) {
    console.log('player on negative side of edge ', x0, y0, x1, y1, ' swap...');
    let temp = x0;
    x0 = x1;
    x1 = temp;
    temp = y0;
    y0 = y1;
    y1 = temp;
  }

  const eX0 = x0 / eRadX;
  const eY0 = y0 / eRadY;
  const eX1 = x1 / eRadX;
  const eY1 = y1 / eRadY;

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

  console.log('pos: ', r2PosX, r2PosY, ' espace: ', eBasePointX, eBasePointY);
  console.log('vel: ', r2VelX, r2VelY, ' espace: ', eVelX, eVelY);
  console.log(
    'check with edge',
    x0,
    y0,
    x1,
    y1,
    'in e space:',
    eX0,
    eY0,
    eX1,
    eY1,
  );
  console.log('dist: ', dist);
  console.log('normal: ', a, b);
  // console.log('inv normal: ', invNormLen);

  let t0, t1;
  let embedded = false;

  // normal dot vel
  const normalDotVel = a * eVelX + b * eVelY;
  // console.log('vel: ', eVelX, eVelY);
  // console.log('normal dot vel: ', normalDotVel);

  if (Math.abs(normalDotVel) < 1e-3) {
    if (dist >= 1) {
      console.log('no collision with edge ', x0, y0, x1, y1);
      return;
    }
    // console.log('embedded in edge ', x0, y0, x1, y1);
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

    console.log('t0: ', t0, ' t1: ', t1);

    if (t0 > 1 || t1 < 0) {
      console.log('no collision cur vel with edge ', x0, y0, x1, y1);
      return;
    }

    t0 = Math.max(t0, 0);
    t1 = Math.min(t1, 1);

    console.log(
      'collision cur vel with edge ',
      eX0,
      eY0,
      eX1,
      eY1,
      ' at t0:',
      t0,
      ' t1:',
      t1,
    );
  }

  let foundCollision = false;
  let collisionX, collisionY;
  let t = 1.0;

  if (!embedded) {
    const intersectX = eBasePointX + eVelX * t0 - a * dist; // TODO * dist ?
    const intersectY = eBasePointY + eVelY * t0 - b * dist;

    // check if intersection point is on edge
    const dot0 =
      (intersectX - eX0) * (eX1 - eX0) + (intersectY - eY0) * (eY1 - eY0);
    const dot1 =
      (intersectX - eX1) * (eX0 - eX1) + (intersectY - eY1) * (eY0 - eY1);
    if (dot0 >= 0 && dot1 >= 0) {
      console.log(
        'collision point ',
        intersectX,
        intersectY,
        ' inside edge ',
        eX0,
        eY0,
        eX1,
        eY1,
        ' at t0: ',
        t0,
      );
      foundCollision = true;
      t = t0;
      collisionX = intersectX;
      collisionY = intersectY;
    } else {
      console.log(
        'collision point ',
        intersectX,
        intersectY,
        ' outside edge ',
        eX0,
        eY0,
        eX1,
        eY1,
      );
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
    console.log('closest end point ', closestX, closestY);

    // now check if collision with closest end point
    const a0 = eVelX * eVelX + eVelY * eVelY;
    const b0 =
      2 * ((eBasePointX - closestX) * eVelX + (eBasePointY - closestY) * eVelY);
    const c0 =
      (eBasePointX - closestX) * (eBasePointX - closestX) +
      (eBasePointY - closestY) * (eBasePointY - closestY) -
      1;

    const root = getLowestRoot(a0, b0, c0, t);
    console.log('root: ', root);
    if (root !== null) {
      console.log(
        'collision with end point ',
        closestX,
        closestY,
        ' at ',
        root,
      );
      foundCollision = true;
      t = root;
      collisionX = closestX;
      collisionY = closestY;
    }
  }

  if (foundCollision) {
    const collisionDist = t * Math.sqrt(eVelX * eVelX + eVelY * eVelY);

    if (collisionDist < collInfo.nearestDistance) {
      console.log(
        'collision with edge ',
        eX0,
        eY0,
        eX1,
        eY1,
        ' at ',
        collisionX,
        collisionY,
        ' distance: ',
        collisionDist,
      );
      // collInfo.foundCollision = true;
      // collInfo.nearestDistance = collisionDist;
      // collInfo.nearestX = collisionX!;
      // collInfo.nearestY = collisionY!;
    }
  }
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
