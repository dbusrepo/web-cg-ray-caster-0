import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';
import { Viewport, newViewport } from './viewport';
import { Player, newPlayer } from './player';
import { SArray, newSArray } from '../sarray';

@final @unmanaged class Raycaster {
  public borderColor: u32;
  public viewport: Viewport;
  public player: Player;
  public zBuffer: SArray<f32>;

  postInit(): void {
    this.zBuffer = newSArray<f32>(this.Viewport.Width);
  }

  // constructor() {
  //   this.viewport = newViewport();
  //   this.player = newPlayer();
  // }

  get Viewport(): Viewport {
    return this.viewport;
  }

  set Viewport(viewport: Viewport) {
    this.viewport = viewport;
  }

  get Player(): Player {
    return this.player;
  }

  set Player(player: Player) {
    this.player = player;
  }

  get ViewportPtr(): PTR_T {
    return changetype<PTR_T>(this.viewport);
  }

  get PlayerPtr(): PTR_T {
    return changetype<PTR_T>(this.player);
  }

  get ZBufferPtr(): SArray<f32> {
    return this.zBuffer;
  }
}

let raycasterAlloc = changetype<ObjectAllocator<Raycaster>>(NULL_PTR);

function initRaycasterAllocator(): void {
  raycasterAlloc = newObjectAllocator<Raycaster>(1);
}

function newRaycaster(): Raycaster {
  if (changetype<PTR_T>(raycasterAlloc) === NULL_PTR) {
    initRaycasterAllocator();
  }
  const raycaster = raycasterAlloc.new();
  return raycaster;
}

function getRaycasterBorderColorOffset(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<Raycaster>("borderColor");
}

function getRaycasterZBufferPtr(basePtr: PTR_T): SIZE_T {
  const raycaster = changetype<Raycaster>(basePtr);
  return raycaster.zBuffer.DataPtr;
}

export {
  Raycaster,
  newRaycaster,
  getRaycasterBorderColorOffset,
  getRaycasterZBufferPtr,
};
