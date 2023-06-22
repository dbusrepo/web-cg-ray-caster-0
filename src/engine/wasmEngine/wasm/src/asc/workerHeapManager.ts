import { myAssert } from './myAssert';
import { heapAlloc, heapFree } from './heapAlloc';
import { logi, workerIdx, workersHeapPtr, workerHeapSize } from './importVars';
import { MEM_BLOCK_USAGE_BIT_MASK, SIZE_T, MAX_ALLOC_SIZE, PTR_T, NULL_PTR, getTypeSize, getTypeAlignMask, } from './memUtils';
// import { memCountersPtr } from './importVars';

// Mem mananger: worker (private) heap mem handling:
// list of blocks
// uses the shared heap (see heapAlloc) when no blocks are available

// const MEM_COUNTER_PTR: PTR_T = memCountersPtr + workerIdx * Uint32Array.BYTES_PER_ELEMENT;

const WORKER_HEAP_BASE: PTR_T = workersHeapPtr + workerIdx * workerHeapSize;
const WORKER_HEAP_LIMIT: PTR_T = WORKER_HEAP_BASE + workerHeapSize;

let freeBlockPtr: PTR_T;
let whmInitialized = false;

// @ts-ignore: decorator
@unmanaged class Block {
  size: SIZE_T;
}

const H_SIZE = getTypeSize<HeaderBlock>();
const F_SIZE = getTypeSize<FooterBlock>();
const HF_SIZE = H_SIZE + F_SIZE;

// @ts-ignore: decorator
@final @unmanaged class HeaderBlock extends Block {
  next: PTR_T;
  prev: PTR_T;
}

// @ts-ignore: decorator
@final @unmanaged class FooterBlock extends Block {}

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

function searchFreeList(reqSize: SIZE_T): PTR_T {
  // use first fit
  if (freeBlockPtr == NULL_PTR) {
    return NULL_PTR;
  }
  let found = false;
  let ptr = freeBlockPtr;
  do {
    if (getBlockSize(ptr) - HF_SIZE >= reqSize) {
      found = true;
    } else {
      ptr = changetype<HeaderBlock>(ptr).next;
    }
  } while (!found && ptr != freeBlockPtr);
  return found ? ptr : NULL_PTR;
}

// remove node from the free list or subst it with newNode if newNode is not null
function removeOrReplaceFromFreeList(nodePtr: PTR_T, newNodePtr: PTR_T = NULL_PTR): void {
  myAssert(nodePtr != NULL_PTR);
  const node = changetype<HeaderBlock>(nodePtr);
  const single = (node.next == nodePtr);
  if (single) {
    myAssert(freeBlockPtr == nodePtr);
    if (newNodePtr != NULL_PTR) {
      const newNode = changetype<HeaderBlock>(newNodePtr);
      freeBlockPtr = newNode.prev = newNode.next = newNodePtr;
    } else {
      freeBlockPtr = NULL_PTR;
    }
  } else {
    const prevNext = newNodePtr != NULL_PTR ? newNodePtr : node.next;
    const nextPrev = newNodePtr != NULL_PTR ? newNodePtr : node.prev;
    changetype<HeaderBlock>(node.prev).next = prevNext;
    changetype<HeaderBlock>(node.next).prev = nextPrev;
    if (nodePtr == freeBlockPtr) {
      freeBlockPtr = prevNext;
    }
    if (newNodePtr != NULL_PTR) {
      const newNode = changetype<HeaderBlock>(newNodePtr);
      newNode.prev = node.prev;
      newNode.next = node.next;
    }
  }
  node.next = node.prev = NULL_PTR;
}

function alloc(reqSize: SIZE_T): PTR_T {
  myAssert(whmInitialized);
  // print();
  // logi(reqSize);
  myAssert(reqSize > 0);
  myAssert(reqSize <= MAX_ALLOC_SIZE);
  // return heapAlloc(reqSize); // TODO REMOVE
  const headerPtr = searchFreeList(reqSize);
  if (headerPtr == NULL_PTR) {
    // if no empty blocks no compaction here but we alloc from the shared heap...
    const sharedHeapAllocated = heapAlloc(reqSize);
    // check allocatedHeapPtr ?
    return sharedHeapAllocated;
  }
  myAssert(!isBlockUsed(headerPtr));
  const header = changetype<HeaderBlock>(headerPtr);
  const blockSize = getBlockSize(headerPtr);
  const footerPtr = headerPtr + blockSize - F_SIZE;
  const footer = changetype<FooterBlock>(footerPtr);
  const allocated = headerPtr + H_SIZE;
  const exactFit: boolean = blockSize == (reqSize - HF_SIZE);
  const splitBlock: boolean = blockSize >= (reqSize + 2 * HF_SIZE);
  if (exactFit || !splitBlock) {
    setBlockUsed(headerPtr);
    setBlockUsed(footerPtr);
    removeOrReplaceFromFreeList(headerPtr);
  } else {
    const usedHeaderPtr = headerPtr;
    const usedFooterPtr = headerPtr + H_SIZE + reqSize;
    const freeHeaderPtr = usedFooterPtr + F_SIZE;
    const freeFooterPtr = footerPtr;
    setBlockUsed(usedHeaderPtr);
    setBlockUsed(usedFooterPtr);
    setBlockUnused(freeHeaderPtr);
    setBlockUnused(freeFooterPtr);
    // const usedHeader = changetype<HeaderBlock>(usedHeaderPtr);
    // const usedFooter = changetype<FooterBlock>(usedFooterPtr);
    const usedSize = reqSize + HF_SIZE;
    setBlockSize(usedHeaderPtr, usedSize);
    setBlockSize(usedFooterPtr, usedSize);
    setBlockSize(freeHeaderPtr, blockSize - usedSize);
    setBlockSize(freeFooterPtr, blockSize - usedSize);
    // const freeFooter = changetype<HeaderBlock>(freeFooterPtr);
    removeOrReplaceFromFreeList(headerPtr, freeHeaderPtr);
  }
  // incMemCounter(getBlockSize(headerPtr));
  return allocated;
}

function free(ptr: PTR_T): void {
  myAssert(whmInitialized);
  myAssert(ptr != NULL_PTR);
  if (ptr >= WORKER_HEAP_LIMIT) {
    return heapFree(ptr);
  }
  myAssert(ptr >= WORKER_HEAP_BASE + H_SIZE &&  ptr < WORKER_HEAP_LIMIT - F_SIZE);
  let headerPtr = ptr - H_SIZE;
  myAssert(isBlockUsed(headerPtr));
  let blockSize = getBlockSize(headerPtr);
  myAssert(blockSize > 0);
  // decMemCounter(blockSize);
  const footerPtr = headerPtr + blockSize - F_SIZE;
  myAssert(isBlockUsed(footerPtr));
  setBlockUnused(headerPtr);
  setBlockUnused(footerPtr);

  let header = changetype<HeaderBlock>(headerPtr);

  if (freeBlockPtr == NULL_PTR) {
    header.next = header.prev = headerPtr;
    freeBlockPtr = headerPtr;
    return;
  }

  // const footer = changetype<FooterBlock>(footerPtr);

  // coalesce with the left neightbor if unused
  const leftFooterPtr = headerPtr - F_SIZE;
  if (leftFooterPtr >= WORKER_HEAP_BASE && !isBlockUsed(leftFooterPtr)) {
    const leftBlockSize = getBlockSize(leftFooterPtr);
    const leftHeaderPtr = headerPtr - leftBlockSize;
    myAssert(leftHeaderPtr >= WORKER_HEAP_BASE);
    const leftHeader = changetype<HeaderBlock>(leftHeaderPtr);

    blockSize += leftBlockSize;
    setBlockSize(leftHeaderPtr, blockSize);
    setBlockSize(footerPtr, blockSize);

    // remove the coalesced block from the free list. This makes the current
    // block appear to be used, which sets up for coalescing with the right
    // block and/or for adding the coalesced block back to the free list
    removeOrReplaceFromFreeList(leftHeaderPtr);
    headerPtr = leftHeaderPtr;
    header = leftHeader;
  }
  
  // coalesce with the right neightbor if unused
  const rightHeaderPtr = headerPtr + blockSize;
  if (rightHeaderPtr < WORKER_HEAP_LIMIT && !isBlockUsed(rightHeaderPtr)) {
    const rightHeader = changetype<HeaderBlock>(rightHeaderPtr);
    const rightSize = getBlockSize(rightHeaderPtr);
    myAssert(rightHeaderPtr + rightSize <= WORKER_HEAP_LIMIT);
    const rightFooterPtr = rightHeaderPtr + rightSize - F_SIZE;
    // const rightFooter = changetype<FooterBlock>(rightFooterPtr);

    blockSize += rightSize;
    setBlockSize(headerPtr, blockSize);
    setBlockSize(rightFooterPtr, blockSize);

    // remove the right block from the free list
    removeOrReplaceFromFreeList(rightHeaderPtr);
  }

  // add the free (coalesced) block to the free list
  if (freeBlockPtr == NULL_PTR) {
    header.next = header.prev = headerPtr;
  } else {
    const freeBlock = changetype<HeaderBlock>(freeBlockPtr);
    header.prev = freeBlock.prev;
    header.next = freeBlockPtr;
    changetype<HeaderBlock>(freeBlock.prev).next = headerPtr;
    freeBlock.prev = headerPtr;
  }
  freeBlockPtr = headerPtr;
  // logi(freeBlockPtr);
  // logi(getBlockSize(freeBlockPtr));
}

// @ts-ignore: decorator
// TODO: not used
// @inline function incMemCounter(value: usize): void {
//   // TODO: use 64-bit counter ?
//   const counter = load<i32>(MEM_COUNTER_PTR);
//   store<u32>(MEM_COUNTER_PTR, counter + (value as u32));
// }

// @ts-ignore: decorator
// TODO: not used
// @inline function decMemCounter(value: usize): void {
//   const counter = load<i32>(MEM_COUNTER_PTR);
//   store<u32>(MEM_COUNTER_PTR, counter - (value as u32));
// }

// pre: ptr != NULL_PTR
// @ts-ignore: decorator
@inline function assertPtrLowerBound(ptr: PTR_T): void {
  myAssert(ptr >= WORKER_HEAP_BASE + H_SIZE);
}

function initMemManager(): void {

  // print();

  const headerPtr = WORKER_HEAP_BASE;
  setBlockUnused(headerPtr);
  const startFreeSpace = workerHeapSize - HF_SIZE;
  myAssert(WORKER_HEAP_LIMIT - WORKER_HEAP_BASE - HF_SIZE == startFreeSpace);
  setBlockSize(headerPtr, startFreeSpace);

  const footerPtr = WORKER_HEAP_LIMIT - F_SIZE;
  setBlockUnused(footerPtr);
  setBlockSize(footerPtr, startFreeSpace);

  // free list of blocks as a doubly linked cyclic list
  const header = changetype<HeaderBlock>(headerPtr);
  header.next = header.prev = headerPtr;

  freeBlockPtr = headerPtr;

  whmInitialized = true;
}

// function print(): void {
//   logi(workerIdx);
//   logi(workersHeapPtr);
//   logi(WORKER_HEAP_BASE);
//   logi(WORKER_HEAP_LIMIT);
// }

export { initMemManager, alloc, free, assertPtrLowerBound };
