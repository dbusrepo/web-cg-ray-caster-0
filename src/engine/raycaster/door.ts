import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import type { WasmNullPtr } from '../wasmEngine/wasmRun';
import { gWasmRun, gWasmView, WASM_NULL_PTR } from '../wasmEngine/wasmRun';

type DoorRef = Door | null;

class Door {
  constructor(
    private doorPtr: number,
    private mPosPtr: number,
    private mPos1Ptr: number,
    private mCodePtr: number,
    private mCode1Ptr: number,
    private colOffsetPtr: number,
    private speedPtr: number,
    private typePtr: number, // xdoor 0, ydoor 1
    private flagsPtr: number,
    private prevPtrPtr: number,
    private nextPtrPtr: number,
  ) {}

  init(
    doorPtr: number,
    mPosPtr: number,
    mPos1Ptr: number,
    mCodePtr: number,
    mCode1Ptr: number,
    colOffsetPtr: number,
    speedPtr: number,
    typePtr: number,
    flagsPtr: number,
    prevPtrPtr: number,
    nextPtrPtr: number,
  ) {
    this.doorPtr = doorPtr;
    this.mPosPtr = mPosPtr;
    this.mPos1Ptr = mPos1Ptr;
    this.mCodePtr = mCodePtr;
    this.mCode1Ptr = mCode1Ptr;
    this.colOffsetPtr = colOffsetPtr;
    this.speedPtr = speedPtr;
    this.typePtr = typePtr;
    this.flagsPtr = flagsPtr;
    this.prevPtrPtr = prevPtrPtr;
    this.nextPtrPtr = nextPtrPtr;
  }

  get WasmPtr(): number {
    return this.doorPtr;
  }

  get Prev(): DoorRef {
    return this.PrevPtr === WASM_NULL_PTR ? null : getDoorView(this.PrevPtr);
  }

  set Prev(prev: DoorRef) {
    this.PrevPtr = prev ? prev.WasmPtr : WASM_NULL_PTR;
  }

  get Next(): DoorRef {
    return this.NextPtr === WASM_NULL_PTR ? null : getDoorView(this.NextPtr);
  }

  set Next(next: DoorRef) {
    this.NextPtr = next ? next.WasmPtr : WASM_NULL_PTR;
  }

  get Mpos(): number {
    return gWasmView.getUint32(this.mPosPtr, true);
  }

  set Mpos(mPos: number) {
    gWasmView.setUint32(this.mPosPtr, mPos, true);
  }

  get Mpos1(): number {
    return gWasmView.getUint32(this.mPos1Ptr, true);
  }

  set Mpos1(mPos1: number) {
    gWasmView.setUint32(this.mPos1Ptr, mPos1, true);
  }

  get Mcode(): number {
    return gWasmView.getUint16(this.mCodePtr, true);
  }

  set Mcode(mCode: number) {
    gWasmView.setUint16(this.mCodePtr, mCode, true);
  }

  get Mcode1(): number {
    return gWasmView.getUint16(this.mCode1Ptr, true);
  }

  set Mcode1(mCode1: number) {
    gWasmView.setUint16(this.mCode1Ptr, mCode1, true);
  }

  get ColOffset(): number {
    return gWasmView.getFloat32(this.colOffsetPtr, true);
  }

  set ColOffset(colOffset: number) {
    gWasmView.setFloat32(this.colOffsetPtr, colOffset, true);
  }

  get Speed(): number {
    return gWasmView.getFloat32(this.speedPtr, true);
  }

  set Speed(speed: number) {
    gWasmView.setFloat32(this.speedPtr, speed, true);
  }

  get Type(): number {
    return gWasmView.getUint8(this.typePtr);
  }

  set Type(type: number) {
    gWasmView.setUint8(this.typePtr, type);
  }

  get Flags(): number {
    return gWasmView.getUint8(this.flagsPtr);
  }

  set Flags(flags: number) {
    gWasmView.setUint8(this.flagsPtr, flags);
  }

  get PrevPtr(): number {
    return gWasmView.getUint32(this.prevPtrPtr, true);
  }

  set PrevPtr(prevPtr: number) {
    gWasmView.setUint32(this.prevPtrPtr, prevPtr, true);
  }

  get NextPtr(): number {
    return gWasmView.getUint32(this.nextPtrPtr, true);
  }

  set NextPtr(nextPtr: number) {
    gWasmView.setUint32(this.nextPtrPtr, nextPtr, true);
  }
}

let freeList: DoorRef = null;

function newDoorView(): Door {
  const wasmEngineModule = gWasmRun.WasmModules.engine;
  let doorView;
  if (freeList) {
    doorView = freeList;
    freeList = freeList.Next;
  } else {
    const doorPtr = wasmEngineModule.allocDoor();
    doorView = getDoorView(doorPtr);
  }
  doorView.Next = doorView.Prev = null;
  return doorView;
}

const freeDoorView = (door: Door) => {
  door.Next = freeList;
  freeList = door;
};

let doorViewMap = new Map<number, Door>();

function getDoorView(doorPtr: number): Door {
  const wasmEngineModule = gWasmRun.WasmModules.engine;
  if (!doorViewMap.has(doorPtr)) {
    doorViewMap.set(
      doorPtr,
      new Door(
        doorPtr,
        wasmEngineModule.getDoorMposPtr(doorPtr),
        wasmEngineModule.getDoorMpos1Ptr(doorPtr),
        wasmEngineModule.getDoorMcodePtr(doorPtr),
        wasmEngineModule.getDoorMcode1Ptr(doorPtr),
        wasmEngineModule.getDoorColOffsetPtr(doorPtr),
        wasmEngineModule.getDoorSpeedPtr(doorPtr),
        wasmEngineModule.getDoorTypePtr(doorPtr),
        wasmEngineModule.getDoorFlagsPtr(doorPtr),
        wasmEngineModule.getDoorPrevPtrPtr(doorPtr),
        wasmEngineModule.getDoorNextPtrPtr(doorPtr),
      ),
    );
  }
  return doorViewMap.get(doorPtr) as Door;
}

export type { Door, DoorRef };

export { newDoorView, freeDoorView, getDoorView };
