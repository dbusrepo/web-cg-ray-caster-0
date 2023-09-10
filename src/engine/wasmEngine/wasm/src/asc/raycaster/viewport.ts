import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Viewport {
  private startX: u32;
  private startY: u32;
  private width: u32;
  private height: u32;

  get StartX(): u32 {
    return this.startX;
  }
  
  set StartX(startX: u32) {
    this.startX = startX;
  }

  get StartY(): u32 {
    return this.startY;
  }

  set StartY(startY: u32) {
    this.startY = startY;
  }

  get Width(): u32 {
    return this.width;
  }

  set Width(width: u32) {
    this.width = width;
  }

  get Height(): u32 {
    return this.height;
  }

  set Height(height: u32) {
    this.height = height;
  }
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

function getViewportStartXPtr(viewportPtr: PTR_T): PTR_T {
  return viewportPtr + offsetof<Viewport>("startX");
}

function getViewportStartYPtr(viewportPtr: PTR_T): PTR_T {
  return viewportPtr + offsetof<Viewport>("startY");
}

function getViewportWidthPtr(viewportPtr: PTR_T): PTR_T {
  return viewportPtr + offsetof<Viewport>("width");
}

function getViewportHeightPtr(viewportPtr: PTR_T): PTR_T {
  return viewportPtr + offsetof<Viewport>("height");
}

export { 
  Viewport,
  newViewport,
  getViewportStartXPtr,
  getViewportStartYPtr,
  getViewportWidthPtr,
  getViewportHeightPtr,
};
