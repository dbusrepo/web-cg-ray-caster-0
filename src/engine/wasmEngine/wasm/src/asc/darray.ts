import { myAssert } from './myAssert';
import { alloc, free } from './workerHeapManager';
import { ilog2, nextPowerOfTwo, isPowerOfTwo, PTR_T, NULL_PTR, getTypeSize, getTypeAlignMask, SIZE_T } from './memUtils';
import { ObjectAllocator, newObjectAllocator } from './objectAllocator';
import { Pointer } from './pointer';
import { logi } from './importVars';

// DArray: dynamic array, descriptor object + array data (with value objects, no references)
// Note: set and push do a shallow copy of the input value (ok for value types, 
// but for ref types -> risk sharing with ref fields in ref objs, we need to support copy constructor ?)
// see also pop with zeroing mem (destructor needed for ref types ?)

// @ts-ignore: decorator
@final @unmanaged class DArray<T> {
  private arrayPtr: PTR_T = NULL_PTR; // ptr to the allocated array
  private dataPtr: PTR_T = NULL_PTR;  // ptr to the start of the data in the array
  private next: PTR_T = NULL_PTR;
  private capacity: SIZE_T = 0;
  private alignLg2: SIZE_T = 0;

  init(startCapacity: SIZE_T, objAlignLg2: SIZE_T = alignof<T>()): void {
    myAssert(startCapacity > 0);
    const capacity = startCapacity;
    let objSizeNoPad = getTypeSize<T>();
    myAssert(objSizeNoPad > 0);
    const objSizePow2 = nextPowerOfTwo(objSizeNoPad);
    const objSize = max(<SIZE_T>(1) << objAlignLg2, objSizePow2);
    myAssert(isPowerOfTwo(objSize));
    const objAlignMask =  objSize - 1;
    const objSizeLg2 = ilog2(objSize);
    const dataSize = capacity << objSizeLg2;
    const allocSize = dataSize + objAlignMask;
    const arrayPtr = alloc(allocSize);
    myAssert(arrayPtr != NULL_PTR);
    memory.fill(arrayPtr, 0, allocSize);
    this.arrayPtr = arrayPtr;
    this.dataPtr = (this.arrayPtr + objAlignMask) & ~objAlignMask;
    this.next = this.dataPtr;
    this.alignLg2 = objSizeLg2;
    this.capacity = capacity;
    myAssert((this.dataPtr & objAlignMask) === 0);
    myAssert(this.Length == 0);
  }

  @inline get Length(): SIZE_T {
    return <SIZE_T>((this.next - this.dataPtr) >> this.alignLg2);
  }

  @inline get Capacity(): SIZE_T {
    return this.capacity;
  }

  @inline get endPtr(): PTR_T {
    return this.dataPtr + (this.capacity << this.alignLg2);
  }

  @inline get ArrayPtr(): PTR_T {
    return this.arrayPtr;
  }

  @inline get DataPtr(): PTR_T {
    return this.dataPtr;
  }

  @inline private idx2ptr(idx: SIZE_T): PTR_T {
    myAssert(idx < this.Length);
    const offset = idx << this.alignLg2;
    return this.DataPtr + offset;
  }

  // returns a reference if T is a reference type, otherwise returns a value
  @inline at(idx: SIZE_T): T {
    const ptr = this.idx2ptr(idx);
    return new Pointer<T>(ptr).value;
  }

  // copies the input value bytes (shallow copy for ref types) in array memory (no reference)
  @inline set(idx: SIZE_T, value: T): void {
    const ptr = this.idx2ptr(idx);
    // TODO: add copy constructor for ref types ?
    new Pointer<T>(ptr).value = value;
  }

  private checkAvailableMem(): void {
    // myAssert(this.arrayPtr != NULL_PTR);
    if (this.Length >= this.capacity) {
      myAssert(this.Length == this.capacity);
      const newCapacity: SIZE_T = 2 * this.capacity;
      const newNumBytesData = newCapacity << this.alignLg2; 
      const alignMask = (1 << this.alignLg2) - 1;
      const newAllocSize = newNumBytesData + alignMask;
      const newArrayPtr = alloc(newAllocSize);
      const newDataPtr = (newArrayPtr + alignMask) & ~alignMask;
      const numSrcBytes = this.next - this.dataPtr;
      const newNext = newDataPtr + numSrcBytes;
      memory.copy(newDataPtr, this.dataPtr, numSrcBytes);
      memory.fill(newDataPtr + numSrcBytes, 0, newNumBytesData - numSrcBytes);
      free(this.arrayPtr);
      this.arrayPtr = newArrayPtr;
      this.dataPtr = newDataPtr;
      this.next = newNext;
      this.capacity = newCapacity;
    }
  }

  @inline private get ObjSize(): SIZE_T {
    return (1 << this.alignLg2);
  }

  // add a new uninitialized element at the end and returns a pointer to it
  @inline private allocNext(): PTR_T {
    this.checkAvailableMem();
    myAssert(this.Length < this.capacity);
    const allocPtr = this.next;
    this.next += this.ObjSize;
    return allocPtr;
  }

  // add a new uninitialized element at the end and returns a pointer to it.
  // for in place construction
  @inline reserveNext(): Pointer<T> {
    const allocPtr = this.allocNext();
    return new Pointer<T>(allocPtr);
  }

  // value is copied in array mem, see set method comment
  push(value: T): void {
    const ptr = this.reserveNext();
    ptr.value = value;
  }

  pop(): void {
    myAssert(this.Length > 0);
    this.next -= this.ObjSize;
    // TODO: zero element memory, check if needed (or call destructor ?)
    // memory.fill(this.next, 0, this.ObjSize);
    memory.fill(this.next, 0, offsetof<T>());
  }
}

type DArrayObject = DArray<Object>;

let darrayAllocator = changetype<ObjectAllocator<DArrayObject>>(NULL_PTR);

function initDArrayAllocator(): void {
  darrayAllocator = newObjectAllocator<DArrayObject>(16);
}

function newDArray<T>(startCapacity: SIZE_T, alignLg2: SIZE_T = alignof<T>()): DArray<T> {
  if (changetype<PTR_T>(darrayAllocator) === NULL_PTR) {
    initDArrayAllocator();
  }
  const arr = changetype<DArray<T>>(darrayAllocator.new());
  arr.init(startCapacity, alignLg2);
  return arr;
}

function deleteDArray<T>(darray: DArray<T>): void {
  free(darray.ArrayPtr);
  darrayAllocator.delete(changetype<DArrayObject>(darray));
}

export { DArray, newDArray, deleteDArray };
