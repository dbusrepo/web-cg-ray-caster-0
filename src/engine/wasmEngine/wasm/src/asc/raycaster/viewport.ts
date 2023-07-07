import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

@final @unmanaged class Viewport {
  private startX: u16;
  private startY: u16;
  private width: u16;
  private height: u16;

  get StartX(): u16 {
    return this.startX;
  }
  
  set StartX(startX: u16) {
    this.startX = startX;
  }

  get StartY(): u16 {
    return this.startY;
  }

  set StartY(startY: u16) {
    this.startY = startY;
  }

  get Width(): u16 {
    return this.width;
  }

  set Width(width: u16) {
    this.width = width;
  }

  get Height(): u16 {
    return this.height;
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

function getViewportStartXPtr(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Viewport>("startX");
}

function getViewportStartYPtr(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Viewport>("startY");
}

function getViewportWidthPtr(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Viewport>("width");
}

function getViewportHeightPtr(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Viewport>("height");
}

export { 
  Viewport,
  newViewport,
  getViewportStartXPtr,
  getViewportStartYPtr,
  getViewportWidthPtr,
  getViewportHeightPtr,
};
