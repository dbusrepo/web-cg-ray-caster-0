import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
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

function getWasmPlayerView(wasmEngineModule: WasmEngineModule, wasmRaycasterPtr: number): Player {
  const playerPtr = wasmEngineModule.getPlayerPtr(wasmRaycasterPtr);
  const posXPtr = wasmEngineModule.getPlayerPosXPtr(playerPtr);
  const posYPtr = wasmEngineModule.getPlayerPosYPtr(playerPtr);
  const posZPtr = wasmEngineModule.getPlayerPosZPtr(playerPtr);
  const dirXPtr = wasmEngineModule.getPlayerDirXPtr(playerPtr);
  const dirYPtr = wasmEngineModule.getPlayerDirYPtr(playerPtr);
  const planeXPtr = wasmEngineModule.getPlayerPlaneXPtr(playerPtr);
  const planeYPtr = wasmEngineModule.getPlayerPlaneYPtr(playerPtr);
  const pitchPtr = wasmEngineModule.getPlayerPitchPtr(playerPtr);
  const player = new Player(
    playerPtr,
    posXPtr,
    posYPtr,
    posZPtr,
    dirXPtr,
    dirYPtr,
    planeXPtr,
    planeYPtr,
    pitchPtr,
  );
  return player;
}

export { Player, getWasmPlayerView };
