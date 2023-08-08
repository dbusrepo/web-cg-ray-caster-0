import { myAssert } from './myAssert';
import { alloc, free } from './workerHeapManager';
import { ilog2, nextPowerOfTwo, isPowerOfTwo, PTR_T, NULL_PTR, getTypeSize, getTypeAlignMask, SIZE_T } from './memUtils';
import { Pointer } from './pointer';
import { logi } from './importVars';

// SArray: a contigous block of memory: header + data
// start address | ... | HEADER | ... | objects data (with value objects, no references)
//                     |<- the SArray starts here
// header and obj sizes are rounded to the next power of two (with alignment for the objects)
// for set see comment in DArray file

// @ts-ignore: decorator
@final @unmanaged class Header {
  arrayPtr: PTR_T = NULL_PTR; // address returned by alloc (used for dealloc only)
  dataPtr: PTR_T = NULL_PTR; // address of the first object
  objSizelg2: SIZE_T = 0; // lg2 size array objects
  length: SIZE_T = 0; // physical length of the array, to do some index checks
}

const HEADER_ALIGN_MASK = getTypeAlignMask<Header>();
const HEADER_SIZE = getTypeSize<Header>() + HEADER_ALIGN_MASK;

// @ts-ignore: decorator
@inline function getHeader<T>(arr: SArray<T>): Header {
  return changetype<Header>(changetype<PTR_T>(arr));
};

// @ts-ignore: decorator
@final @unmanaged class SArray<T> {

  private idx2Ptr(idx: SIZE_T): PTR_T {
    const header = getHeader(this);
    // TODO:
    // myAssert(idx < header.length);
    const offset = idx << header.objSizelg2;
    return header.dataPtr + offset;
  }

  @inline ptrAt(idx: SIZE_T): PTR_T {
    return this.idx2Ptr(idx);
  }

  // returns a reference if T is a reference type, otherwise returns a value
  @inline at(idx: SIZE_T): T {
    const ptr = this.idx2Ptr(idx);
    return new Pointer<T>(ptr).value;
  }

  // copies the input value bytes (shallow copy for ref types) in array memory (no reference)
  @inline set(idx: SIZE_T, value: T): void {
    const ptr = this.idx2Ptr(idx);
    // TODO: add copy constructor for ref types ?
    new Pointer<T>(ptr).value = value;
  }

  @inline get Length(): SIZE_T {
    return getHeader(this).length;
  }

  @inline get DataPtr(): PTR_T {
    return getHeader(this).dataPtr;
  }

  @inline get ObjSizeLg2(): SIZE_T {
    return getHeader(this).objSizelg2;
  }

  // TODO:
  // @inline @operator("[]") get(idx: u32): T {
  //   return this.at(idx);
  // }

  // TODO:
  // @inline @operator("[]=") set(idx: u32, value: T): void {
  // }
}

function newSArray<T>(length: SIZE_T, objAlignLg2: SIZE_T = alignof<T>()): SArray<T> {
  myAssert(length > 0);
  let objSizeNoPad = getTypeSize<T>();
  myAssert(objSizeNoPad > 0);
  const objSizePow2 = nextPowerOfTwo(objSizeNoPad);
  const objSize = max(<SIZE_T>(1) << objAlignLg2, objSizePow2);
  myAssert(isPowerOfTwo(objSize));
  const objAlignMask =  objSize - 1;
  const dataSize: SIZE_T = length * objSize + objAlignMask;
  const arraySize = HEADER_SIZE + HEADER_ALIGN_MASK + dataSize;
  const arrayPtr = alloc(arraySize);
  myAssert(arrayPtr != NULL_PTR);
  const headerPtr = (arrayPtr + HEADER_ALIGN_MASK) & ~HEADER_ALIGN_MASK;
  const dataPtr = (headerPtr + HEADER_SIZE + objAlignMask) & ~objAlignMask;
  myAssert((dataPtr & objAlignMask) === 0);
  const header = changetype<Header>(headerPtr);
  header.arrayPtr = arrayPtr;
  header.dataPtr = dataPtr;
  header.objSizelg2 = ilog2(objSize);
  header.length = length;
  const sarray = changetype<SArray<T>>(headerPtr);
  return sarray;
}

function deleteSArray<T>(arr: SArray<T>): void {
  const header = getHeader(arr);
  free(header.arrayPtr);
}

export { SArray, newSArray, deleteSArray };
