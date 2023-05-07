import { myAssert } from './myAssert';
import { alloc, free, assertPtrLowerBound } from './workerHeapManager';
import { PTR_SIZE, PTR_ALIGN_MASK, SIZE_T, MAX_ALLOC_SIZE, 
         PTR_T, NULL_PTR, getTypeSize, getTypeAlignMask } from './memUtils';
import { logi } from './importVars';

// The arena allocs blocks of objects. Free objects are linked in a free list
// Pointers in the free list are stored at the beg of the object mem

// @ts-ignore: decorator
@final @unmanaged class ArenaAlloc {

  private blockPtr: PTR_T; // block ptr
  private nextPtr: PTR_T; // next allocation in block
  private freePtr: PTR_T; // free list head ptr
  private numLeft: SIZE_T; // number of remaining allocable objs in cur block
  private numPerBlock: SIZE_T; // number of allocable objs per block
  private blockSize: SIZE_T; // tot bytes allocated per block
  private objSize: SIZE_T; // total bytes (obj+align pad) per obj, obj are aligned
  private alignMask: SIZE_T; // objects align mask

  private constructor() { 
    this.blockPtr = NULL_PTR;
    this.freePtr = NULL_PTR;
    this.nextPtr = NULL_PTR;
    this.blockSize = 0;
    this.objSize = 0;
    this.numPerBlock = 0;
    this.numLeft = 0;
    this.alignMask = 0;
  }

  init(objSize: SIZE_T, numObjsPerBlock: u32, objAlignLg2: SIZE_T): void {
    myAssert(objSize > 0);
    myAssert(numObjsPerBlock > 0);
    const minObjSize = max(objSize, PTR_SIZE);
    const alignMask: SIZE_T = max(<SIZE_T>(1) << objAlignLg2, PTR_ALIGN_MASK + 1) - 1;
    let objSizeAlign: SIZE_T;
    let blockSize: SIZE_T;
    if ((minObjSize & alignMask) != 0) {
      if (minObjSize < alignMask + 1) {
        objSizeAlign = alignMask + 1;
        blockSize = (objSizeAlign * numObjsPerBlock) + alignMask;
      } else {
        objSizeAlign = minObjSize + alignMask;
        blockSize = objSizeAlign * numObjsPerBlock;
      }
    } else {
      objSizeAlign = minObjSize;
      blockSize = (objSizeAlign * numObjsPerBlock) + alignMask;
    }
    myAssert(objSizeAlign <= MAX_ALLOC_SIZE);
    this.blockSize = blockSize;
    this.objSize = objSizeAlign;
    this.alignMask = alignMask;
    this.numPerBlock = numObjsPerBlock;
    this.blockPtr = NULL_PTR;
    this.freePtr = NULL_PTR;
    this.nextPtr = NULL_PTR;
    this.numLeft = 0;
  }

  @inline private allocBlock(): void {
    // Note: the previous block ptr is lost, its objs are allocable with the free list
    this.blockPtr = alloc(this.blockSize);
    this.nextPtr = this.blockPtr;
    this.numLeft = this.numPerBlock;
  }

  public alloc(): PTR_T {
    let dataPtr: PTR_T;
    if (this.freePtr != NULL_PTR) {
      dataPtr = this.freePtr;
      this.freePtr = load<PTR_T>(this.freePtr);
      myAssert((this.freePtr == NULL_PTR) || ((this.freePtr & this.alignMask) == 0));
    } else {
      if (this.numLeft == 0) {
        this.allocBlock();
      }
      myAssert(this.numLeft > 0 && this.nextPtr !== NULL_PTR);
      dataPtr = (this.nextPtr + this.alignMask) & ~this.alignMask;
      this.nextPtr += this.objSize;
      this.numLeft--;
    }
    myAssert((dataPtr & this.alignMask) == 0);
    return dataPtr;
  }

  @inline public free(ptr: PTR_T): void {
    if (ptr != NULL_PTR) {
      assertPtrLowerBound(ptr);
      myAssert((ptr & this.alignMask) == 0); // add other checks ?
      store<PTR_T>(ptr, this.freePtr);
      this.freePtr = ptr;
    }
  }

}

function newArena(objSize: SIZE_T, numObjPerBlock: u32, objAlignLg2: SIZE_T = alignof<PTR_T>()): ArenaAlloc {
  const arenaSize = getTypeSize<ArenaAlloc>();
  const ptr: PTR_T = alloc(arenaSize);
  const arena = changetype<ArenaAlloc>(ptr);
  arena.init(objSize, numObjPerBlock, objAlignLg2);
  return arena;
}

export { ArenaAlloc, newArena };
