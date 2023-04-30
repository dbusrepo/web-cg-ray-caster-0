import { PTR_T, SIZE_T, getTypeSize } from './memUtils';

const NANO_IN_MS: i64 = 1000000;

// @ts-ignore: decorator
@inline function getArrElPtr<T>(base: PTR_T, idx: SIZE_T): PTR_T {
  // return base + idx * getTypeSize<T>();
  return base + (idx << alignof<T>());
}

// @ts-ignore: decorator
@inline function sleep(loc: usize, timeoutMs: i64): void {
  const timeout = max(NANO_IN_MS, timeoutMs * NANO_IN_MS); // min 1 ms
  atomic.wait<i32>(loc, 0, timeout);
}

function gcd(m: i32, n: i32): i32 {
  let tmp: i32;
  while (m != 0) {
    tmp = m;
    m = n % m;
    n = tmp;
  }
  return n;
}

function lcm(m: i32, n: i32): i32 {
    return Math.floor(m / gcd(m, n)) * n;
} 

// split [0..numTasks-1] between [0..numWorkers-1] and get the index
// range for worker workerIdx in a 64 bit var. Workers on head get one more task if needed.
function range(workerIdx: usize, numWorkers: usize, numTasks: usize): u64 {
  const numTaskPerWorker = numTasks / numWorkers;
  const numTougherThreads = numTasks % numWorkers;
  const isTougher = workerIdx < numTougherThreads;

  const start = isTougher ?
    workerIdx * (numTaskPerWorker + 1) :
    numTasks - (numWorkers - workerIdx) * numTaskPerWorker;

  const end = start + numTaskPerWorker + (isTougher ? 1 : 0);
  // TODO
  return (start as u64) << 32 | end;
}

export { getArrElPtr, sleep, gcd, lcm, range };
