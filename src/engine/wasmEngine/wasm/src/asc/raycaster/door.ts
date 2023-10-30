import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Door {
  private mPos: u32;
  private mPos1: u32;
  private mCode: u16;
  private mCode1: u16;
  private colOffset: u16;
  private speed: u8;
  private type: u8;
  private flags: u8;
  private prevPtr: PTR_T = NULL_PTR;
  private nextPtr: PTR_T = NULL_PTR;

  get PrevPtr(): PTR_T {
    return this.prevPtr;
  }

  set PrevPtr(prevPtr: PTR_T) {
    this.prevPtr = prevPtr;
  }

  get NextPtr(): PTR_T {
    return this.nextPtr;
  }

  set NextPtr(nextPtr: PTR_T) {
    this.nextPtr = nextPtr;
  }

  get Pos(): u32 {
    return this.mPos;
  }

  set Pos(pos: u32) {
    this.mPos = pos;
  }

  get Pos1(): u32 {
    return this.mPos1;
  }

  set Pos1(pos1: u32) {
    this.mPos1 = pos1;
  }

  get Code(): u16 {
    return this.mCode;
  }

  set Code(code: u16) {
    this.mCode = code;
  }

  get Code1(): u16 {
    return this.mCode1;
  }

  set Code1(code1: u16) {
    this.mCode1 = code1;
  }

  get Type(): u8 {
    return this.type;
  }

  set Type(type: u8) {
    this.type = type;
  }

  get Flags(): u8 {
    return this.flags;
  }

  set Flags(flags: u8) {
    this.flags = flags;
  }

  get ColOffset(): u16 {
    return this.colOffset;
  }

  set ColOffset(colOffset: u16) {
    this.colOffset = colOffset;
  }

  get Speed(): u8 {
    return this.speed;
  }
}

let doorAllocator = changetype<ObjectAllocator<Door>>(NULL_PTR);

function initDoorAllocator(): void {
  doorAllocator = newObjectAllocator<Door>(1);
}

function newDoor(): Door {
  if (changetype<PTR_T>(doorAllocator) === NULL_PTR) {
    initDoorAllocator();
  }
  return doorAllocator.new();
}

function allocDoor(): PTR_T {
  return changetype<PTR_T>(newDoor());
}

function getDoorMposPtr(doorPtr: PTR_T): PTR_T {
  return doorPtr + offsetof<Door>('mPos');
}

function getDoorMpos1Ptr(doorPtr: PTR_T): PTR_T {
  return doorPtr + offsetof<Door>('mPos1');
}

function getDoorPrevPtrPtr(doorPtr: PTR_T): PTR_T {
  return doorPtr + offsetof<Door>('prevPtr');
}

function getDoorNextPtrPtr(doorPtr: PTR_T): PTR_T {
  return doorPtr + offsetof<Door>('nextPtr');
}

function getDoorMcodePtr(doorPtr: PTR_T): PTR_T {
  return doorPtr + offsetof<Door>('mCode');
}

function getDoorMcode1Ptr(doorPtr: PTR_T): PTR_T {
  return doorPtr + offsetof<Door>('mCode1');
}

function getDoorTypePtr(doorPtr: PTR_T): PTR_T {
  return doorPtr + offsetof<Door>('type');
}

function getDoorFlagsPtr(doorPtr: PTR_T): PTR_T {
  return doorPtr + offsetof<Door>('flags');
}

function getDoorColOffsetPtr(doorPtr: PTR_T): PTR_T {
  return doorPtr + offsetof<Door>('colOffset');
}

function getDoorSpeedPtr(doorPtr: PTR_T): PTR_T {
  return doorPtr + offsetof<Door>('speed');
}

export { 
  Door,
  newDoor,
  allocDoor,
  getDoorMposPtr,
  getDoorMpos1Ptr,
  getDoorMcodePtr,
  getDoorMcode1Ptr,
  getDoorTypePtr,
  getDoorFlagsPtr,
  getDoorColOffsetPtr,
  getDoorSpeedPtr,
  getDoorPrevPtrPtr,
  getDoorNextPtrPtr,
};
