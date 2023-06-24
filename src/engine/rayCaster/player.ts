import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';

class Player {
  constructor(
    private playerPtr: number,
    private posXPtr: number,
    private posYPtr: number,
    private posZPtr: number,
    private dirXPtr: number,
    private dirYPtr: number,
    private planeXPtr: number,
    private planeYPtr: number,
    private pitchPtr: number,
  ) {}

  get WasmPtr(): number {
    return this.playerPtr;
  }

  get PosX(): number {
    return gWasmView.getFloat64(this.posXPtr, true);
  }

  set PosX(value: number) {
    gWasmView.setFloat64(this.posXPtr, value, true);
  }

  get PosY(): number {
    return gWasmView.getFloat64(this.posYPtr, true);
  }

  set PosY(value: number) {
    gWasmView.setFloat64(this.posYPtr, value, true);
  }

  get PosZ(): number {
    return gWasmView.getFloat64(this.posZPtr, true);
  }

  set PosZ(value: number) {
    gWasmView.setFloat64(this.posZPtr, value, true);
  }

  get DirX(): number {
    return gWasmView.getFloat64(this.dirXPtr, true);
  }
  
  set DirX(value: number) {
    gWasmView.setFloat64(this.dirXPtr, value, true);
  }

  get DirY(): number {
    return gWasmView.getFloat64(this.dirYPtr, true);
  }

  set DirY(value: number) {
    gWasmView.setFloat64(this.dirYPtr, value, true);
  }

  get PlaneX(): number {
    return gWasmView.getFloat64(this.planeXPtr, true);
  }

  set PlaneX(value: number) {
    gWasmView.setFloat64(this.planeXPtr, value, true);
  }

  get PlaneY(): number {
    return gWasmView.getFloat64(this.planeYPtr, true);
  }

  set PlaneY(value: number) {
    gWasmView.setFloat64(this.planeYPtr, value, true);
  }

  get Pitch(): number {
    return gWasmView.getFloat64(this.pitchPtr, true);
  }

  set Pitch(value: number) {
    gWasmView.setFloat64(this.pitchPtr, value, true);
  }
}

function getWasmPlayer(): Player {
  const wasmEngine = gWasmRun.WasmModules.engine;
  const playerPtr = wasmEngine.getPlayerPtr();
  const posXPtr = wasmEngine.getPlayerPosXOffset(playerPtr);
  const posYPtr = wasmEngine.getPlayerPosYOffset(playerPtr);
  const posZPtr = wasmEngine.getPlayerPosZOffset(playerPtr);
  const dirXPtr = wasmEngine.getPlayerDirXOffset(playerPtr);
  const dirYPtr = wasmEngine.getPlayerDirYOffset(playerPtr);
  const planeXPtr = wasmEngine.getPlayerPlaneXOffset(playerPtr);
  const planeYPtr = wasmEngine.getPlayerPlaneYOffset(playerPtr);
  const pitchOffset = wasmEngine.getPlayerPitchOffset(playerPtr);
  const player = new Player(
    playerPtr,
    posXPtr,
    posYPtr,
    posZPtr,
    dirXPtr,
    dirYPtr,
    planeXPtr,
    planeYPtr,
    pitchOffset,
  );
  return player;
}


export type { Player };
export { getWasmPlayer };

