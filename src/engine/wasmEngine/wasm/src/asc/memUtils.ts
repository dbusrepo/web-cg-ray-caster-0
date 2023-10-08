import { myAssert } from './myAssert';

export type PTR_T = usize; // raw pointer type
export type SIZE_T = usize;
export const NULL_PTR: PTR_T = 0; // TODO: note
export const PTR_SIZE: SIZE_T = getTypeSize<PTR_T>();
export const PTR_ALIGN_MASK: SIZE_T = getTypeAlignMask<PTR_T>();

// @ts-ignore: decorator
@inline function GET_PTR<T>(v: T): PTR_T {
  return changetype<PTR_T>(v);
}

// Max alloc size for blocks allocated by the mem manager
export const MAX_ALLOC_SIZE: SIZE_T = <SIZE_T>(1) << 30; // 1GB

const CHAR_BIT = 8;

// for mem manager blocks, use the bit 31 or 63 as the 'usage' bit in block size field
// @ts-ignore: decorator
@inline function getUsageBitMask(): SIZE_T {
  const bitPos = getTypeSize<SIZE_T>() * CHAR_BIT - 1;
  const usageBitMask = <SIZE_T>(1) << bitPos;
  myAssert(MAX_ALLOC_SIZE < usageBitMask);
  return usageBitMask;
}

// @ts-ignore: decorator
@inline function isPowerOfTwo(n: SIZE_T): boolean {
  return n != 0 && ((n & (n - 1)) == 0);
}

// @ts-ignore: decorator
@inline function ilog2(n: SIZE_T): SIZE_T {
  return getValueSize(n) * CHAR_BIT - clz(n) - 1;
}

// next greater power of two, ex: 3 -> 4, 4 -> 8
// @ts-ignore: decorator
@inline function nextGreaterPowerOfTwo(n: SIZE_T): SIZE_T {
  const numBits = getValueSize(n) * CHAR_BIT;
  myAssert(n < (1 << (numBits - 1)));
  return 1 << (numBits - clz(n));
}

// next greater power of two, ex: 3 -> 4, 4 -> 4
// @ts-ignore: decorator
@inline function nextPowerOfTwo(n: SIZE_T): SIZE_T {
  if (!isPowerOfTwo(n)) {
    n = nextGreaterPowerOfTwo(n);
  }
  return n;
}

// @ts-ignore: decorator
@inline function getTypeSize<T>(): SIZE_T {
  return <SIZE_T>(isReference<T>() ? offsetof<T>() : sizeof<T>());
}

// @ts-ignore: decorator
@inline function getValueSize<T>(x: T): SIZE_T {
  return getTypeSize<T>();
}

// @ts-ignore: decorator
@inline function getTypeAlignMask<T>(): SIZE_T {
  let align: SIZE_T = 0;
  if (isReference<T>()) {
    const objSize = nextPowerOfTwo(getTypeSize<T>());
    align = ilog2(objSize);
  } else {
    align = alignof<T>();
  }
  return <SIZE_T>((1 << align) - 1);
}

// @ts-ignore: decorator
@inline function getValueAlignMask<T>(x: T): SIZE_T {
  return getTypeAlignMask<T>();
}

const MEM_BLOCK_USAGE_BIT_MASK = getUsageBitMask();

export { MEM_BLOCK_USAGE_BIT_MASK, GET_PTR, ilog2, nextPowerOfTwo, isPowerOfTwo, getTypeSize, getValueSize, getTypeAlignMask, getValueAlignMask };
