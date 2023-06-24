import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';

class Player {
  constructor(
    private playerPtr: number,
    private posXoffset: number,
    private posYoffset: number,
    private posZoffset: number,
    private dirXoffset: number,
    private dirYoffset: number,
    private planeXoffset: number,
    private planeYoffset: number,
    private pitchOffset: number,
  ) {
    this.posXoffset = playerPtr + posXoffset;
    this.posYoffset = playerPtr + posYoffset;
    this.posZoffset = playerPtr + posZoffset;
    this.dirXoffset = playerPtr + dirXoffset;
    this.dirYoffset = playerPtr + dirYoffset;
    this.planeXoffset = playerPtr + planeXoffset;
    this.planeYoffset = playerPtr + planeYoffset;
    this.pitchOffset = playerPtr + pitchOffset;
  }

  get Ptr(): number {
    return this.playerPtr;
  }

  get PosX(): number {
    return gWasmView.getFloat32(this.posXoffset, true);
  }

  set PosX(value: number) {
    gWasmView.setFloat32(this.posXoffset, value, true);
  }

  get PosY(): number {
    return gWasmView.getFloat32(this.posYoffset, true);
  }

  set PosY(value: number) {
    gWasmView.setFloat32(this.posYoffset, value, true);
  }

  get PosZ(): number {
    return gWasmView.getFloat32(this.posZoffset, true);
  }

  set PosZ(value: number) {
    gWasmView.setFloat32(this.posZoffset, value, true);
  }

  get DirX(): number {
    return gWasmView.getFloat32(this.dirXoffset, true);
  }
  
  set DirX(value: number) {
    gWasmView.setFloat32(this.dirXoffset, value, true);
  }

  get DirY(): number {
    return gWasmView.getFloat32(this.dirYoffset, true);
  }

  set DirY(value: number) {
    gWasmView.setFloat32(this.dirYoffset, value, true);
  }

  get PlaneX(): number {
    return gWasmView.getFloat32(this.planeXoffset, true);
  }

  set PlaneX(value: number) {
    gWasmView.setFloat32(this.planeXoffset, value, true);
  }

  get PlaneY(): number {
    return gWasmView.getFloat32(this.planeYoffset, true);
  }

  set PlaneY(value: number) {
    gWasmView.setFloat32(this.planeYoffset, value, true);
  }

  get Pitch(): number {
    return gWasmView.getFloat32(this.pitchOffset, true);
  }

  set Pitch(value: number) {
    gWasmView.setFloat32(this.pitchOffset, value, true);
  }
}

function getWasmPlayer(): Player {
  const wasmEngine = gWasmRun.WasmModules.engine;
  const playerPtr = wasmEngine.getPlayerPtr();
  const posXoffset = wasmEngine.getPlayerPosXOffset();
  const posYoffset = wasmEngine.getPlayerPosYOffset();
  const posZoffset = wasmEngine.getPlayerPosZOffset();
  const dirXoffset = wasmEngine.getPlayerDirXOffset();
  const dirYoffset = wasmEngine.getPlayerDirYOffset();
  const planeXoffset = wasmEngine.getPlayerPlaneXOffset();
  const planeYoffset = wasmEngine.getPlayerPlaneYOffset();
  const pitchOffset = wasmEngine.getPlayerPitchOffset();
  const player = new Player(
    playerPtr,
    posXoffset,
    posYoffset,
    posZoffset,
    dirXoffset,
    dirYoffset,
    planeXoffset,
    planeYoffset,
    pitchOffset,
  );
  return player;
}


export type { Player };
export { getWasmPlayer };

