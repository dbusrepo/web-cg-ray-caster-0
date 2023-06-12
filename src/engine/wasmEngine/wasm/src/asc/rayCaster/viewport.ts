import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { alloc, free } from '../workerHeapManager';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Viewport {
  startX: u8;
  startY: u8;
  width: u8;
  height: u8;
  abc: u8;
}

let viewportAlloc = changetype<ObjectAllocator<Viewport>>(NULL_PTR);

function initViewportAllocator(): void {
  viewportAlloc = newObjectAllocator<Viewport>(1);
}

function newViewport(): Viewport {
  if (changetype<PTR_T>(viewportAlloc) === NULL_PTR) {
    initViewportAllocator();
  }
  const viewport = viewportAlloc.new();
  return viewport;
}

export { Viewport, newViewport };
