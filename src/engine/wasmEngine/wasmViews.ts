import { MemRegionsEnum, WasmMemRegionsData } from './wasmMemUtils';

type WasmViews = {
  view: DataView;
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
  texturesIndex: Uint8Array;
  texturesPixels: Uint8Array;
  workersMemCounters: Uint32Array;
  inputKeys: Uint8Array;
  hrTimer: BigUint64Array;
};

function buildWasmMemViews(
  wasmMem: WebAssembly.Memory,
  memOffsets: WasmMemRegionsData,
  memSizes: WasmMemRegionsData,
): WasmViews {
  // const startSize = memSizes[MemRegionsEnum.START_MEM];
  // const startOffset = memOffsets[MemRegionsEnum.START_MEM];
  // const wasmTotalStartSize = startOffset + startSize;

  const view = new DataView(wasmMem.buffer);
  const memUI8 = new Uint8Array(wasmMem.buffer);
  const memUIC8 = new Uint8ClampedArray(wasmMem.buffer);
  const memUI16 = new Uint16Array(wasmMem.buffer);
  const memUI32 = new Uint32Array(wasmMem.buffer);
  const memI8 = new Int8Array(wasmMem.buffer);
  const memI16 = new Int16Array(wasmMem.buffer);
  const memI32 = new Int32Array(wasmMem.buffer);
  const memF32 = new Float32Array(wasmMem.buffer);
  const memF64 = new Float64Array(wasmMem.buffer);
  const memBUI64 = new BigUint64Array(wasmMem.buffer);
  const memBI64 = new BigInt64Array(wasmMem.buffer);

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

  const texturesIndex = new Uint8Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.TEXTURES_INDEX],
    memSizes[MemRegionsEnum.TEXTURES_INDEX],
  );

  const texturesPixels = new Uint8Array(
    wasmMem.buffer,
    memOffsets[MemRegionsEnum.TEXTURES],
    memSizes[MemRegionsEnum.TEXTURES],
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
    view,
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
    texturesIndex,
    texturesPixels,
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
