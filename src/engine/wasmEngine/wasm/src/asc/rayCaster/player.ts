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

function getPlayerPosXOffset(): SIZE_T {
  return offsetof<Player>("posX");
}

function getPlayerPosYOffset(): SIZE_T {
  return offsetof<Player>("posY");
}

function getPlayerPosZOffset(): SIZE_T {
  return offsetof<Player>("posZ");
}

function getPlayerDirXOffset(): SIZE_T {
  return offsetof<Player>("dirX");
}

function getPlayerDirYOffset(): SIZE_T {
  return offsetof<Player>("dirY");
}

function getPlayerPlaneXOffset(): SIZE_T {
  return offsetof<Player>("planeX");
}

function getPlayerPlaneYOffset(): SIZE_T {
  return offsetof<Player>("planeY");
}

function getPlayerPitchOffset(): SIZE_T {
  return offsetof<Player>("pitch");
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
