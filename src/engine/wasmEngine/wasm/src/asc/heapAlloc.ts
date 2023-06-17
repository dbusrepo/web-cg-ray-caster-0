import { myAssert } from './myAssert';
import { LOCK_T, lock, unlock } from './mutex';
import { logi, heapPtr } from './importVars';
import { PTR_SIZE, PTR_ALIGN_MASK, SIZE_T, MAX_ALLOC_SIZE, MEM_BLOCK_USAGE_BIT_MASK,
         PTR_T, NULL_PTR, getTypeSize, getTypeAlignMask } from './memUtils';

const LOCK_SIZE = getTypeSize<LOCK_T>();
const MUTEX_ALIGN_MASK = getTypeAlignMask<LOCK_T>();

const HEAP_BASE: PTR_T = heapPtr;
const MUTEX_PTR: PTR_T = (heapPtr + MUTEX_ALIGN_MASK) & ~MUTEX_ALIGN_MASK; // align to 4 bytes
const ALLOC_PTR_PTR: PTR_T = (MUTEX_PTR + LOCK_SIZE + PTR_ALIGN_MASK) & ~PTR_ALIGN_MASK; // after the mutex, align to X bytes
const FREE_PTR_PTR: PTR_T = ALLOC_PTR_PTR + PTR_SIZE; // after the offset pointer, the free list ptr
const START_ALLOC_PTR: PTR_T = FREE_PTR_PTR  + PTR_SIZE; // after the free block ptr ptr, the alloc area

// each block has a header with the size stored before the data, the rest
// is 'shared' with the data but used only when the block is unused/in the free
// list
// @ts-ignore: decorator
@final @unmanaged class Block {
  size: SIZE_T; // header before data
  next: PTR_T; // 'shared' with data
}

const HEADER_SIZE = getTypeSize<SIZE_T>(); // only size field for the header...
const BLOCK_SIZE = getTypeSize<Block>();

// @ts-ignore: decorator
@inline function setBlockUsed(blockPtr: PTR_T): void {
  const block = changetype<Block>(blockPtr);
  block.size |= MEM_BLOCK_USAGE_BIT_MASK;
}

// @ts-ignore: decorator
@inline function setBlockUnused(blockPtr: PTR_T): void {
  const block = changetype<Block>(blockPtr);
  block.size &= ~MEM_BLOCK_USAGE_BIT_MASK;
}

// @ts-ignore: decorator
@inline function isBlockUsed(blockPtr: PTR_T): boolean {
  const block = changetype<Block>(blockPtr);
  return (block.size & MEM_BLOCK_USAGE_BIT_MASK) !== 0;
}

// @ts-ignore: decorator
@inline function setBlockSize(blockPtr: PTR_T, size: SIZE_T): void {
  const block = changetype<Block>(blockPtr);
  const usageBit = block.size & MEM_BLOCK_USAGE_BIT_MASK;
  myAssert(size <= MAX_ALLOC_SIZE);
  block.size = usageBit | size;
}

// @ts-ignore: decorator
@inline function getBlockSize(blockPtr: PTR_T): SIZE_T {
  const block = changetype<Block>(blockPtr);
  return block.size & ~MEM_BLOCK_USAGE_BIT_MASK;
}

// @ts-ignore: decorator
@inline function atomicGetAllocPtr(): PTR_T {
  return atomic.load<PTR_T>(ALLOC_PTR_PTR);
}

// @ts-ignore: decorator
@inline function heapAllocSetOffset(curOffset: PTR_T, newOffset: PTR_T): PTR_T {
  return atomic.cmpxchg<PTR_T>(ALLOC_PTR_PTR, curOffset, newOffset);
}

// // thread safe?
// function checkGrowMemory(curOffset: PTR_T, nextOffset: PTR_T): void {
//   let numPages = memory.size();
//   if (nextOffset > (<PTR_T>numPages) << 16) {
//     let pagesNeeded = <i32>(((nextOffset - curOffset  + 0xffff) & ~0xffff) >>> 16);
//     let pagesWanted = <i32>max(numPages, pagesNeeded); // double memory
//     if (memory.grow(pagesWanted) < 0) {
//       if (memory.grow(pagesNeeded) < 0) {
//         // logi(curPages);
//         unreachable(); // out of memory
//       }
//     }
//   }
// }

function checkMemoryLimit(curOffset: PTR_T, nextOffset: PTR_T): void {
  // logi(curOffset);
  // logi(nextOffset);
  let numPages = memory.size();
  if (nextOffset > ((<PTR_T>numPages) << 16)) {
    unreachable(); // out of memory
  }
}


function allocNewBlock(reqSize: SIZE_T): PTR_T {
  let curOffset: PTR_T;
  let newOffset: PTR_T;
  let blockPtr: PTR_T;
  let dataSize: SIZE_T;
  do {
    curOffset = atomicGetAllocPtr();
    // align data (and the block next field)
    blockPtr = ((curOffset + HEADER_SIZE + PTR_ALIGN_MASK) & ~PTR_ALIGN_MASK) - HEADER_SIZE;
    dataSize = max(BLOCK_SIZE - HEADER_SIZE, reqSize);
    newOffset = blockPtr + HEADER_SIZE + dataSize;
    // checkGrowMemory(curOffset, newOffset);
    checkMemoryLimit(curOffset, newOffset);
  } while (
    heapAllocSetOffset(curOffset, newOffset) != curOffset
  );
  setBlockUsed(blockPtr);
  setBlockSize(blockPtr, dataSize);
  let dataPtr = blockPtr + HEADER_SIZE;
  return dataPtr;
}

function searchFreeList(reqSize: SIZE_T): PTR_T {
  let blockPtrPtr = FREE_PTR_PTR;
  let blockPtr = atomic.load<PTR_T>(blockPtrPtr);
  while (blockPtr != NULL_PTR) {
    const block = changetype<Block>(blockPtr);
    const size = block.size;
    if (size >= reqSize) {
      break;
    }
    blockPtrPtr = blockPtr + HEADER_SIZE;
    blockPtr = atomic.load<PTR_T>(blockPtrPtr);
  }
  return blockPtrPtr;
}

function heapAlloc(reqSize: SIZE_T): PTR_T {
  myAssert(reqSize > 0);
  myAssert(reqSize <= MAX_ALLOC_SIZE);
  let dataPtr: PTR_T = NULL_PTR;
  const freePtr = atomic.load<PTR_T>(FREE_PTR_PTR);
  if (freePtr != NULL_PTR) {
    // search+remove from free list: coarse gain sync, assume low contention...
    lock(MUTEX_PTR);
    const prevPtrPtr = searchFreeList(reqSize);
    let blockPtr = atomic.load<PTR_T>(prevPtrPtr);
    if (blockPtr != NULL_PTR) {
      myAssert(!isBlockUsed(blockPtr));
      setBlockUsed(blockPtr);
      dataPtr = blockPtr + HEADER_SIZE;
      const nextPtr = atomic.load<PTR_T>(dataPtr);
      atomic.store<PTR_T>(prevPtrPtr, nextPtr);
    }
    unlock(MUTEX_PTR);
  }
  if (dataPtr == NULL_PTR) {
    dataPtr = allocNewBlock(reqSize);
  }
  return dataPtr;
}

function heapFree(ptr: PTR_T): void {
  myAssert(ptr >= START_ALLOC_PTR);
  lock(MUTEX_PTR);
  const blockPtr = ptr - HEADER_SIZE;
  myAssert(isBlockUsed(blockPtr));
  setBlockUnused(blockPtr);
  const freePtr = atomic.load<PTR_T>(FREE_PTR_PTR);
  atomic.store<PTR_T>(ptr, freePtr);
  atomic.store<PTR_T>(FREE_PTR_PTR, blockPtr);
  unlock(MUTEX_PTR);
}

function initSharedHeap(): void {
  // logi(START_ALLOC_PTR);
  store<PTR_T>(ALLOC_PTR_PTR, START_ALLOC_PTR);
  store<PTR_T>(FREE_PTR_PTR, NULL_PTR);
}

export { initSharedHeap, heapAlloc, heapFree };
