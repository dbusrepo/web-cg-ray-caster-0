import { MemRegionsEnum, WasmMemRegionsData } from './wasmMemUtils';

type WasmViews = {
  memUI8: Uint8Array;
  memUIC8: Uint8ClampedArray;
  memUI16: Uint16Array;
  memUI32: Uint32Array;
  memI8: Int8Array;
  memI16: Int16Array;
  memI32: Int32Array;
  memF32: Float32Array;
  memF64: Float64Array;
  memBUI64: BigUint64Array;
  memBI64: BigInt64Array;
  rgbaSurface0: Uint8ClampedArray;
  rgbaSurface1: Uint8ClampedArray;
  syncArr: Int32Array;
  sleepArr: Int32Array;
  fontChars: Uint8Array;
  strings: Uint8Array;
  imagesIndex: Uint32Array;
  imagesPixels: Uint8Array;
  workersMemCounters: Uint32Array;
  inputKeys: Uint8Array;
  hrTimer: BigUint64Array;
};

function buildWasmMemViews(
  wasmMem: WebAssembly.Memory,
  memOffsets: WasmMemRegionsData,
  memSizes: WasmMemRegionsData,
): WasmViews {
  const startSize = memSizes[MemRegionsEnum.START_MEM];
  const startOffset = memOffsets[MemRegionsEnum.START_MEM];
  const wasmTotalStartSize = startOffset + startSize;
  const memUI8 = new Uint8Array(wasmMem.buffer, 0, wasmTotalStartSize);
  const memUIC8 = new Uint8ClampedArray(wasmMem.buffer, 0, wasmTotalStartSize);
  const memUI16 = new Uint16Array(wasmMem.buffer, 0, wasmTotalStartSize / Uint16Array.BYTES_PER_ELEMENT);
  const memUI32 = new Uint32Array(wasmMem.buffer, 0, wasmTotalStartSize / Uint32Array.BYTES_PER_ELEMENT);
  const memI8 = new Int8Array(wasmMem.buffer, 0, wasmTotalStartSize);
  const memI16 = new Int16Array(wasmMem.buffer, 0, wasmTotalStartSize / Int16Array.BYTES_PER_ELEMENT);
  const memI32 = new Int32Array(wasmMem.buffer, 0, wasmTotalStartSize / Int32Array.BYTES_PER_ELEMENT);
  const memF32 = new Float32Array(wasmMem.buffer, 0, wasmTotalStartSize / Float32Array.BYTES_PER_ELEMENT);
  const memF64 = new Float64Array(wasmMem.buffer, 0, wasmTotalStartSize / Float64Array.BYTES_PER_ELEMENT);
  const memBUI64 = new BigUint64Array(wasmMem.buffer, 0, wasmTotalStartSize / BigUint64Array.BYTES_PER_ELEMENT);
  const memBI64 = new BigInt64Array(wasmMem.buffer, 0, wasmTotalStartSize / BigInt64Array.BYTES_PER_ELEMENT);

  const rgbaSurface0 = new Uint8ClampedArray(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.RGBA_SURFACE_0],
    memSizes[MemRegionsEnum.RGBA_SURFACE_0],
  );

  const rgbaSurface1 = new Uint8ClampedArray(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.RGBA_SURFACE_1],
    memSizes[MemRegionsEnum.RGBA_SURFACE_1],
  );

  const syncArr = new Int32Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.SYNC_ARRAY],
    memSizes[MemRegionsEnum.SYNC_ARRAY] / Int32Array.BYTES_PER_ELEMENT,
  );

  const sleepArr = new Int32Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.SLEEP_ARRAY],
    memSizes[MemRegionsEnum.SLEEP_ARRAY] / Int32Array.BYTES_PER_ELEMENT,
  );

  const fontChars = new Uint8Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.FONT_CHARS],
    memSizes[MemRegionsEnum.FONT_CHARS],
  );

  const strings = new Uint8Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.STRINGS],
    memSizes[MemRegionsEnum.STRINGS],
  );

  const imagesIndex = new Uint32Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.IMAGES_INDEX],
    memSizes[MemRegionsEnum.IMAGES_INDEX] / Uint32Array.BYTES_PER_ELEMENT,
  );

  const imagesPixels = new Uint8Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.IMAGES],
    memSizes[MemRegionsEnum.IMAGES],
  );

  const workersMemCounters = new Uint32Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.MEM_COUNTERS],
    memSizes[MemRegionsEnum.MEM_COUNTERS],
  );

  const inputKeys = new Uint8Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.INPUT_KEYS],
    memSizes[MemRegionsEnum.INPUT_KEYS],
  );

  const hrTimer = new BigUint64Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.HR_TIMER],
    memSizes[MemRegionsEnum.HR_TIMER] / BigUint64Array.BYTES_PER_ELEMENT,
  );

  const memViews: WasmViews = {
      memUI8,
      memUIC8,
      memUI16,
      memUI32,
      memI8,
      memI16,
      memI32,
      memF32,
      memF64,
      memBUI64,
      memBI64,
      rgbaSurface0,
      rgbaSurface1,
      syncArr,
      sleepArr,
      imagesIndex,
      imagesPixels,
      fontChars,
      strings,
      workersMemCounters,
      inputKeys,
      hrTimer,
  };

  return memViews;
}

export type { WasmViews };
export { buildWasmMemViews };
