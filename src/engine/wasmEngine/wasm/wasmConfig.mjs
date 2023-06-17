const PAGE_SIZE = 65536;

const startOffset = 0;
const initialMemoryPages = 320; // 20 MB
const maximumMemoryPages = 320;

// bound memoryBase to all memory
const memoryBase = initialMemoryPages * PAGE_SIZE;

export {
  startOffset,
  initialMemoryPages,
  maximumMemoryPages,
  memoryBase,
};
