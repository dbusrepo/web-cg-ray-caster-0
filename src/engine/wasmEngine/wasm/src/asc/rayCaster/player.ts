import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Player {
  posX: f64;
  posY: f64;
  posZ: f64;
  dirX: f64;
  dirY: f64;
  planeX: f64;
  planeY: f64;
  pitch: f64;
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
