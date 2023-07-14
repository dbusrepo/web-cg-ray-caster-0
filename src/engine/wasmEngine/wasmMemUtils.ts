// import assert from 'assert';

type WasmMemParams = {
  // frameBufferPalSize: number;
  // paletteSize: number;
  startOffset: number;
  rgbaSurface0size: number;
  rgbaSurface1size: number;
  numWorkers: number;
  syncArraySize: number;
  sleepArraySize: number;
  workerHeapSize: number;
  texturesIndexSize: number;
  texturesPixelsSize: number;
  sharedHeapSize: number;
  fontCharsSize: number;
  stringsSize: number;
  workersMemCountersSize: number;
  inputKeysSize: number;
  hrTimerSize: number;
};

// all regions have bounds except for the last part, the shared heap that can grow
// enum for mem regions keys used to index their sizes/offsets
const enum MemRegionsEnum {
  // FRAMEBUFFER_PAL = 'FRAMEBUFFER_PAL',
  // PALETTE = 'PALETTE',
  RGBA_SURFACE_0 = 'RGBA_SURFACE_0',
  RGBA_SURFACE_1 = 'RGBA_SURFACE_1',
  SYNC_ARRAY = 'SYNC_ARRAY',
  SLEEP_ARRAY = 'SLEEP_ARRAY',
  FONT_CHARS = 'FONT_CHARS',
  STRINGS = 'STRINGS',
  TEXTURES_INDEX = 'TEXTURES_INDEX',
  TEXTURES = 'TEXTURES',
  WORKERS_HEAPS = 'WORKERS_HEAPS',
  HEAP = 'HEAP',
  INPUT_KEYS = 'INPUT_KEYS',
  MEM_COUNTERS = 'MEM_COUNTERS',
  HR_TIMER = 'HR_TIMER',
  START_MEM = 'START_MEM', // for the size/offset of all previous mem regions
}

type MemRegionKeyType = keyof typeof MemRegionsEnum;

type WasmMemRegionsData = {
  -readonly [key in MemRegionKeyType]: number;
};

function getMemRegionsSizes(params: WasmMemParams): WasmMemRegionsData {
  const {
    // frameBufferPalSize,
    // paletteSize,
    rgbaSurface0size,
    rgbaSurface1size,
    numWorkers,
    texturesIndexSize,
    texturesPixelsSize,
    workerHeapSize,
    syncArraySize,
    sleepArraySize,
    sharedHeapSize,
    fontCharsSize,
    stringsSize,
    workersMemCountersSize,
    inputKeysSize,
    hrTimerSize,
  } = params;

  const sizes: WasmMemRegionsData = {
    // [MemRegionsEnum.FRAMEBUFFER_PAL]: frameBufferPalSize,
    // [MemRegionsEnum.PALETTE]: paletteSize,
    [MemRegionsEnum.RGBA_SURFACE_0]: rgbaSurface0size,
    [MemRegionsEnum.RGBA_SURFACE_1]: rgbaSurface1size,
    [MemRegionsEnum.SYNC_ARRAY]: syncArraySize,
    [MemRegionsEnum.SLEEP_ARRAY]: sleepArraySize,
    [MemRegionsEnum.FONT_CHARS]: fontCharsSize,
    [MemRegionsEnum.STRINGS]: stringsSize,
    [MemRegionsEnum.TEXTURES_INDEX]: texturesIndexSize,
    [MemRegionsEnum.TEXTURES]: texturesPixelsSize,
    [MemRegionsEnum.WORKERS_HEAPS]: numWorkers * workerHeapSize,
    [MemRegionsEnum.HEAP]: sharedHeapSize,
    [MemRegionsEnum.MEM_COUNTERS]: workersMemCountersSize,
    [MemRegionsEnum.INPUT_KEYS]: inputKeysSize,
    [MemRegionsEnum.HR_TIMER]: hrTimerSize,
    [MemRegionsEnum.START_MEM]: 0,
  };

  // console.log(JSON.stringify(sizes));

  return sizes;
}

function getMemRegionsOffsets(
  params: WasmMemParams,
  sizes: Readonly<WasmMemRegionsData>,
): WasmMemRegionsData {
  // for each new section add its alignment here
  // lg of align req
  const memRegLgAlign: WasmMemRegionsData = {
    // [MemRegionsEnum.FRAMEBUFFER_PAL]: 2,
    // [MemRegionsEnum.PALETTE]: 2,
    [MemRegionsEnum.RGBA_SURFACE_0]: 2,
    [MemRegionsEnum.RGBA_SURFACE_1]: 2,
    [MemRegionsEnum.SYNC_ARRAY]: 2,
    [MemRegionsEnum.SLEEP_ARRAY]: 2,
    [MemRegionsEnum.FONT_CHARS]: 2,
    [MemRegionsEnum.STRINGS]: 2,
    [MemRegionsEnum.TEXTURES_INDEX]: 2,
    [MemRegionsEnum.TEXTURES]: 2,
    [MemRegionsEnum.WORKERS_HEAPS]: 2,
    [MemRegionsEnum.HEAP]: 6,
    [MemRegionsEnum.MEM_COUNTERS]: 2,
    [MemRegionsEnum.INPUT_KEYS]: 0,
    [MemRegionsEnum.HR_TIMER]: 3,
    [MemRegionsEnum.START_MEM]: 0,
  };

  // for each new section add it in the region alloc order here
  const memRegionsAllocSeq: MemRegionKeyType[] = [
    // MemRegionsEnum.FRAMEBUFFER_PAL,
    // MemRegionsEnum.PALETTE,
    MemRegionsEnum.RGBA_SURFACE_0,
    MemRegionsEnum.RGBA_SURFACE_1,
    MemRegionsEnum.HR_TIMER,
    MemRegionsEnum.SYNC_ARRAY,
    MemRegionsEnum.SLEEP_ARRAY,
    MemRegionsEnum.MEM_COUNTERS,
    MemRegionsEnum.FONT_CHARS,
    MemRegionsEnum.STRINGS,
    MemRegionsEnum.TEXTURES_INDEX,
    MemRegionsEnum.TEXTURES,
    MemRegionsEnum.INPUT_KEYS,
    MemRegionsEnum.WORKERS_HEAPS,
    MemRegionsEnum.HEAP,
  ];

  // check seq in memRegionsAllocSeq and no duplicates ?

  const offsets = {} as WasmMemRegionsData;
  let curOffset = params.startOffset;

  for (const region of memRegionsAllocSeq) {
    const alignMask = (1 << memRegLgAlign[region]) - 1;
    const nextOffset = (curOffset + alignMask) & ~alignMask;
    offsets[region] = nextOffset;
    curOffset = nextOffset + sizes[region];
  }

  return offsets;
}

// returns sizes and offsets
function getMemRegionsSizesAndOffsets(
  params: WasmMemParams,
): [WasmMemRegionsData, WasmMemRegionsData] {
  const regionsSizes = getMemRegionsSizes(params);
  const regionsOffsets = getMemRegionsOffsets(params, regionsSizes);

  const { startOffset } = params;
  regionsOffsets[MemRegionsEnum.START_MEM] = startOffset;
  const startSize =
    regionsOffsets[MemRegionsEnum.HEAP] +
    regionsSizes[MemRegionsEnum.HEAP] - // 0 if the shared heap expands freely
    startOffset;
  regionsSizes[MemRegionsEnum.START_MEM] = startSize;

  return [regionsSizes, regionsOffsets];
}

export type { WasmMemParams, WasmMemRegionsData };

export { MemRegionsEnum, getMemRegionsSizesAndOffsets };
