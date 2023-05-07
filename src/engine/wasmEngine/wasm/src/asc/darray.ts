import { myAssert } from './myAssert';
import { alloc, free } from './workerHeapManager';
import { ilog2, nextPowerOfTwo, isPowerOfTwo, PTR_T, NULL_PTR, getTypeSize, getTypeAlignMask, SIZE_T } from './memUtils';
import { ArenaAlloc, newArena } from './arenaAlloc';
import { Pointer } from './pointer';
import { logi } from './importVars';

// @ts-ignore: decorator
@final @unmanaged class DArray<T> {
  private array: PTR_T = 0; // physical array start
  private dataStart: PTR_T = 0;  // where data start
  private dataEnd: PTR_T = 0;
  private next: PTR_T = 0;
  private capacity: SIZE_T = 0;
  private objSizeLg2: SIZE_T = 0;
  private alignMask: SIZE_T = 0;
  // private allocSize: SIZE_T; // not used

  init(initialCapacity: SIZE_T, objAlignLg2: SIZE_T = alignof<T>()): void {
    myAssert(initialCapacity > 0);
    const capacity = initialCapacity;
    let objSize = getTypeSize<T>();
    myAssert(objSize > 0);
    objSize = nextPowerOfTwo(objSize);
    const objSizeAlign = max(<SIZE_T>(1) << objAlignLg2, objSize);
    const alignMask =  objSizeAlign - 1;
    // myAssert(isPowerOfTwo(objSizeAlign));
    const numBytesData = capacity * objSizeAlign;
    const allocSize = numBytesData + alignMask;
    this.array = alloc(allocSize);
    this.dataStart = (this.array + alignMask) & ~alignMask;
    this.dataEnd = this.dataStart + numBytesData;
    this.next = this.dataStart;
    this.objSizeLg2 = ilog2(objSizeAlign);
    this.alignMask = alignMask;
    this.capacity = capacity;
    myAssert((this.dataStart & alignMask) === 0);
    myAssert(this.Length == 0);
  }

  @inline get Length(): SIZE_T {
    return <SIZE_T>((this.next - this.dataStart) >> this.objSizeLg2);
  }

  @inline get Capacity(): SIZE_T {
    return <SIZE_T>(this.dataEnd - this.dataStart) >> this.objSizeLg2;
  }

  @inline get ArrayStart(): PTR_T {
    return this.array;
  }

  private idx2Ptr(idx: SIZE_T): PTR_T {
    myAssert(idx < this.Length);
    const offset = idx << this.objSizeLg2;
    return this.dataStart + offset;
  }

  at(idx: SIZE_T): T {
    const ptr = this.idx2Ptr(idx);
    return new Pointer<T>(ptr).value;
  }

  setValue(idx: SIZE_T, value: T): void {
    const ptr = this.idx2Ptr(idx);
    new Pointer<T>(ptr).value = value;
  }

  private checkMem(): void {
    if (this.next >= this.dataEnd) {
      myAssert(this.next == this.dataEnd);
      const newCapacity: SIZE_T = 2 * this.capacity;
      const newNumBytesData = newCapacity << this.objSizeLg2; 
      const newAllocSize = newNumBytesData + this.alignMask;
      const newArray = alloc(newAllocSize);
      const newDataStart = (newArray + this.alignMask) & ~this.alignMask;
      const newArrayEnd = newDataStart + newNumBytesData;
      const numSrcBytes = this.next - this.dataStart;
      const newNext = newDataStart + numSrcBytes;
      memory.copy(newDataStart, this.dataStart, numSrcBytes);
      free(this.array);
      this.array = newArray;
      this.dataStart = newDataStart;
      this.dataEnd = newArrayEnd;
      this.next = newNext;
      this.capacity = newCapacity;
    }
  }

  private get ObjSize(): SIZE_T {
    return 1 << this.objSizeLg2;
  }

  // add a new uninitialized element at the end and returns a pointer to it
  private alloc(): PTR_T {
    this.checkMem();
    const ptr = this.next;
    this.next += this.ObjSize;
    return ptr;
  }

  push(value: T): void {
    const ptr = this.alloc();
    new Pointer<T>(ptr).value = value;
  }

  pop(): void {
    myAssert(this.Length > 0);
    this.next -= this.ObjSize;
  }
}

let arrayArena = changetype<ArenaAlloc>(NULL_PTR);

function initDArrayAllocator(): void {
  const ARR_BLOCK_SIZE = 128;
  const objSize = getTypeSize<DArray<Object>>();
  arrayArena = newArena(objSize, ARR_BLOCK_SIZE);
}

function newDArray<T>(initialCapacity: SIZE_T, alignLg2: SIZE_T = alignof<T>()): DArray<T> {
  if (changetype<PTR_T>(arrayArena) === NULL_PTR) {
    initDArrayAllocator();
  }
  const arr = changetype<DArray<T>>(arrayArena.alloc());
  arr.init(initialCapacity, alignLg2);
  return arr;
}

function deleteDArray<T>(arr: DArray<T>): void {
  free(arr.ArrayStart);
  arrayArena.free(changetype<PTR_T>(arr));
}

export { DArray, newDArray, deleteDArray };
