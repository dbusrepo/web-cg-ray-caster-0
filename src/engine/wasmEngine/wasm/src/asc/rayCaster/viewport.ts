import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { alloc, free } from '../workerHeapManager';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Viewport {
  startX: u16;
  startY: u16;
  width: u16;
  height: u16;
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

function getViewportStartXOffset(): SIZE_T {
  return offsetof<Viewport>("startX");
}

function getViewportStartYOffset(): SIZE_T {
  return offsetof<Viewport>("startY");
}

function getViewportWidthOffset(): SIZE_T {
  return offsetof<Viewport>("width");
}

function getViewportHeightOffset(): SIZE_T {
  return offsetof<Viewport>("height");
}

export { Viewport, newViewport, 
  getViewportStartXOffset, getViewportStartYOffset, 
  getViewportWidthOffset, getViewportHeightOffset};
