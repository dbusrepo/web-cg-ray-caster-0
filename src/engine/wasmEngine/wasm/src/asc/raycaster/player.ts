import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Player {
  private posX: f32;
  private posY: f32;
  private posZ: f32;
  private dirX: f32;
  private dirY: f32;
  private planeX: f32;
  private planeY: f32;
  private pitch: f32;

  get PosX(): f32 {
    return this.posX;
  }
  
  set PosX(posX: f32) {
    this.posX = posX;
  }

  get PosY(): f32 {
    return this.posY;
  }

  set PosY(posY: f32) {
    this.posY = posY;
  }

  get PosZ(): f32 {
    return this.posZ;
  }

  set PosZ(posZ: f32) {
    this.posZ = posZ;
  }

  get DirX(): f32 {
    return this.dirX;
  }

  set DirX(dirX: f32) {
    this.dirX = dirX;
  }

  get DirY(): f32 {
    return this.dirY;
  }

  set DirY(dirY: f32) {
    this.dirY = dirY;
  }

  get PlaneX(): f32 {
    return this.planeX;
  }

  set PlaneX(planeX: f32) {
    this.planeX = planeX;
  }

  get PlaneY(): f32 {
    return this.planeY;
  }

  set PlaneY(planeY: f32) {
    this.planeY = planeY;
  }

  get Pitch(): f32 {
    return this.pitch;
  }

  set Pitch(pitch: f32) {
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

function getPlayerPosXPtr(playerPtr: PTR_T): PTR_T {
  return playerPtr + offsetof<Player>("posX");
}

function getPlayerPosYPtr(playerPtr: PTR_T): PTR_T {
  return playerPtr + offsetof<Player>("posY");
}

function getPlayerPosZPtr(playerPtr: PTR_T): PTR_T {
  return playerPtr + offsetof<Player>("posZ");
}

function getPlayerDirXPtr(playerPtr: PTR_T): PTR_T {
  return playerPtr + offsetof<Player>("dirX");
}

function getPlayerDirYPtr(playerPtr: PTR_T): PTR_T {
  return playerPtr + offsetof<Player>("dirY");
}

function getPlayerPlaneXPtr(playerPtr: PTR_T): PTR_T {
  return playerPtr + offsetof<Player>("planeX");
}

function getPlayerPlaneYPtr(playerPtr: PTR_T): PTR_T {
  return playerPtr + offsetof<Player>("planeY");
}

function getPlayerPitchPtr(playerPtr: PTR_T): PTR_T {
  return playerPtr + offsetof<Player>("pitch");
}

export { 
  Player,
  newPlayer,
  getPlayerPosXPtr,
  getPlayerPosYPtr,
  getPlayerDirXPtr,
  getPlayerDirYPtr,
  getPlayerPlaneXPtr,
  getPlayerPlaneYPtr,
  getPlayerPitchPtr,
  getPlayerPosZPtr,
};
