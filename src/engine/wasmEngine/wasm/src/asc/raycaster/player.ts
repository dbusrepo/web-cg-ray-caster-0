import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Player {
  private posX: f64;
  private posY: f64;
  private posZ: f64;
  private dirX: f64;
  private dirY: f64;
  private planeX: f64;
  private planeY: f64;
  private pitch: f64;

  get PosX(): f64 {
    return this.posX;
  }
  
  set PosX(posX: f64) {
    this.posX = posX;
  }

  get PosY(): f64 {
    return this.posY;
  }

  set PosY(posY: f64) {
    this.posY = posY;
  }

  get PosZ(): f64 {
    return this.posZ;
  }

  set PosZ(posZ: f64) {
    this.posZ = posZ;
  }

  get DirX(): f64 {
    return this.dirX;
  }

  set DirX(dirX: f64) {
    this.dirX = dirX;
  }

  get DirY(): f64 {
    return this.dirY;
  }

  set DirY(dirY: f64) {
    this.dirY = dirY;
  }

  get PlaneX(): f64 {
    return this.planeX;
  }

  set PlaneX(planeX: f64) {
    this.planeX = planeX;
  }

  get PlaneY(): f64 {
    return this.planeY;
  }

  set PlaneY(planeY: f64) {
    this.planeY = planeY;
  }

  get Pitch(): f64 {
    return this.pitch;
  }

  set Pitch(pitch: f64) {
    this.pitch = pitch;
  }
}

let playerAllocator = changetype<ObjectAllocator<Player>>(NULL_PTR);

function initPlayerAllocator(): void {
  playerAllocator = newObjectAllocator<Player>(1);
}

function newPlayer(): Player {
  if (changetype<PTR_T>(playerAllocator) === NULL_PTR) {
    initPlayerAllocator();
  }
  const player = playerAllocator.new();
  return player;
}

function getPlayerPosXOffset(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Player>("posX");
}

function getPlayerPosYOffset(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Player>("posY");
}

function getPlayerPosZOffset(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Player>("posZ");
}

function getPlayerDirXOffset(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Player>("dirX");
}

function getPlayerDirYOffset(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Player>("dirY");
}

function getPlayerPlaneXOffset(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Player>("planeX");
}

function getPlayerPlaneYOffset(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Player>("planeY");
}

function getPlayerPitchOffset(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Player>("pitch");
}

export { 
  Player,
  newPlayer,
  getPlayerPosXOffset,
  getPlayerPosYOffset,
  getPlayerDirXOffset,
  getPlayerDirYOffset,
  getPlayerPlaneXOffset,
  getPlayerPlaneYOffset,
  getPlayerPitchOffset,
  getPlayerPosZOffset,
};
