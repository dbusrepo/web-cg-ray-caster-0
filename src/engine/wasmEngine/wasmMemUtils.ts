// import assert from 'assert';
import * as views from './wasmViews';
import * as initImages from './wasmMemInitImages';
import * as initStrings from './wasmMemInitStrings';
import * as initFontChars from './wasmMemInitFontChars';

type MemConfig = {
  startOffset: number;
  frameBufferRGBASize: number;
  frameBufferPalSize: number;
  numWorkers: number;
  syncArraySize: number;
  paletteSize: number;
  sleepArraySize: number;
  workerHeapSize: number;
  imagesIndexSize: number;
  imagesSize: number;
  sharedHeapSize: number;
  fontCharsSize: number;
  stringsSize: number;
  workersMemCountersSize: number;
  inputKeysSize: number;
  hrTimerSize: number;
};

// all regions have bounds except for the last part, the shared heap that can grow
// enum for mem regions keys used to index their sizes/offsets
const enum MemRegions {
  FRAMEBUFFER_RGBA = 'FRAMEBUFFER_RGBA',
  FRAMEBUFFER_PAL = 'FRAMEBUFFER_PAL',
  PALETTE = 'PALETTE',
  SYNC_ARRAY = 'SYNC_ARRAY',
  SLEEP_ARRAY = 'SLEEP_ARRAY',
  FONT_CHARS = 'FONT_CHARS',
  STRINGS = 'STRINGS',
  IMAGES_INDEX = 'IMAGES_INDEX',
  IMAGES = 'IMAGES',
  WORKERS_HEAPS = 'WORKERS_HEAPS',
  HEAP = 'HEAP',

  INPUT_KEYS = 'INPUT_KEYS',
  MEM_COUNTERS = 'MEM_COUNTERS',
  HR_TIMER = 'HR_TIMER',

  START_MEM = 'START_MEM', // for the size/offset of all previous mem regions
}

type MemRegionKeyType = keyof typeof MemRegions;

type MemRegionsData = {
  -readonly [key in MemRegionKeyType]: number;
};

function getMemRegionsSizes(config: MemConfig): MemRegionsData {
  const {
    frameBufferRGBASize,
    frameBufferPalSize,
    numWorkers,
    imagesIndexSize,
    imagesSize,
    workerHeapSize,
    syncArraySize,
    sleepArraySize,
    paletteSize,
    sharedHeapSize,
    fontCharsSize,
    stringsSize,
    workersMemCountersSize,
    inputKeysSize,
    hrTimerSize,
  } = config;

  const sizes: MemRegionsData = {
    [MemRegions.FRAMEBUFFER_RGBA]: frameBufferRGBASize,
    [MemRegions.FRAMEBUFFER_PAL]: frameBufferPalSize,
    [MemRegions.PALETTE]: paletteSize,
    [MemRegions.SYNC_ARRAY]: syncArraySize,
    [MemRegions.SLEEP_ARRAY]: sleepArraySize,
    [MemRegions.FONT_CHARS]: fontCharsSize,
    [MemRegions.STRINGS]: stringsSize,
    [MemRegions.IMAGES_INDEX]: imagesIndexSize,
    [MemRegions.IMAGES]: imagesSize,
    [MemRegions.WORKERS_HEAPS]: numWorkers * workerHeapSize,
    [MemRegions.HEAP]: sharedHeapSize,
    [MemRegions.MEM_COUNTERS]: workersMemCountersSize,
    [MemRegions.INPUT_KEYS]: inputKeysSize,
    [MemRegions.HR_TIMER]: hrTimerSize,
    [MemRegions.START_MEM]: 0,
  };

  // console.log(JSON.stringify(sizes));
  return sizes;
}

function getMemRegionsOffsets(
  config: MemConfig,
  sizes: Readonly<MemRegionsData>,
): MemRegionsData {
  // for each new section add its alignment here
  // lg of align req
  const memRegLgAlign: MemRegionsData = {
    [MemRegions.FRAMEBUFFER_RGBA]: 2,
    [MemRegions.FRAMEBUFFER_PAL]: 2,
    [MemRegions.PALETTE]: 2,
    [MemRegions.SYNC_ARRAY]: 2,
    [MemRegions.SLEEP_ARRAY]: 2,
    [MemRegions.FONT_CHARS]: 2,
    [MemRegions.STRINGS]: 2,
    [MemRegions.IMAGES_INDEX]: 2,
    [MemRegions.IMAGES]: 2,
    [MemRegions.WORKERS_HEAPS]: 2,
    [MemRegions.HEAP]: 6,
    [MemRegions.MEM_COUNTERS]: 2,
    [MemRegions.INPUT_KEYS]: 4,
    [MemRegions.HR_TIMER]: 3,
    [MemRegions.START_MEM]: 0,
  };

  // for each new section add it in the region alloc order here
  const memRegionsAllocSeq: MemRegionKeyType[] = [
    MemRegions.FRAMEBUFFER_RGBA,
    MemRegions.FRAMEBUFFER_PAL,
    MemRegions.PALETTE,
    MemRegions.INPUT_KEYS,
    MemRegions.HR_TIMER,
    MemRegions.SYNC_ARRAY,
    MemRegions.SLEEP_ARRAY,
    MemRegions.MEM_COUNTERS,
    MemRegions.FONT_CHARS,
    MemRegions.STRINGS,
    MemRegions.IMAGES_INDEX,
    MemRegions.IMAGES,
    MemRegions.WORKERS_HEAPS,
    MemRegions.HEAP,
  ];

  // check seq in memRegionsAllocSeq and no duplicates ?

  const offsets = {} as MemRegionsData;
  let curOffset = config.startOffset;

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
  config: MemConfig,
): [MemRegionsData, MemRegionsData] {
  const regionsSizes = getMemRegionsSizes(config);
  const regionsOffsets = getMemRegionsOffsets(config, regionsSizes);

  const { startOffset } = config;
  regionsOffsets[MemRegions.START_MEM] = startOffset;
  const startSize =
    regionsOffsets[MemRegions.HEAP] +
    regionsSizes[MemRegions.HEAP] - // 0 if the shared heap expands freely
    startOffset;
  regionsSizes[MemRegions.START_MEM] = startSize;

  return [regionsSizes, regionsOffsets];
}

type WasmViews = views.WasmViews;

export {
  MemConfig,
  MemRegions,
  MemRegionsData,
  getMemRegionsSizesAndOffsets,
  views,
  initFontChars,
  initStrings,
  initImages,
};
