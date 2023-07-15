import type { Range, TypedArray } from './ctypes';

// split [0..numTasks-1] between [0..numWorkers-1] workers and get the index
// range for worker workerIdx. Workers on head get one more task if needed.
// Returns worker tasks [start, end)
function range(workerIdx: number, numWorkers: number, numTasks: number): Range {
  const numTaskPerWorker = (numTasks / numWorkers) | 0;
  const numTougherThreads = numTasks % numWorkers;
  const isTougher = workerIdx < numTougherThreads;
  const start = isTougher
    ? workerIdx * (numTaskPerWorker + 1)
    : numTasks - (numWorkers - workerIdx) * numTaskPerWorker;
  const end = start + numTaskPerWorker + (isTougher ? 1 : 0);
  return [start, end];
}

function randColor(): number {
  const r = (Math.random() * 255) | 0;
  const g = (Math.random() * 255) | 0;
  const b = (Math.random() * 255) | 0;
  const color = (0xff << 24) | (b << 16) | (g << 8) | r; // abgr
  return color;
}

const arrAvg = (values: Float32Array | Float64Array, count: number) => {
  let acc = 0;
  const numIter = Math.min(count, values.length);
  if (numIter === 0) return 0;
  for (let i = 0; i < numIter; i++) {
    acc += values[i];
  }
  return acc / numIter;
};

function sleep(sleepArr: Int32Array, idx: number, timeoutMs: number): void {
  Atomics.wait(sleepArr, idx, 0, Math.max(1, timeoutMs | 0));
}

function isPowerOf2(value: number): boolean {
  return value !== 0 && (value & (value - 1)) === 0;
}

function nextPowerOf2(value: number): number {
  return 2 ** Math.ceil(Math.log2(value));
}

function nextGreaterPowerOf2(value: number): number {
  return 2 ** Math.ceil(Math.log2(value + 1));
}

export {
  arrAvg,
  range,
  Range,
  randColor,
  sleep,
  isPowerOf2,
  nextPowerOf2,
  nextGreaterPowerOf2,
};
