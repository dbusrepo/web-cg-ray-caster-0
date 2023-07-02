import { myAssert } from '../myAssert';
import { logi } from '../importVars';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { SArray, newSArray } from '../sarray';
import { Viewport, newViewport } from './viewport';
import { Player, newPlayer } from './player';
import { Map, newMap } from './map';

@final @unmanaged class Raycaster {
  private borderColor: u32;
  private viewport: Viewport;
  private player: Player;
  private zBuffer: SArray<f32>;
  private map: Map;

  postInit(): void {
    this.zBuffer = newSArray<f32>(this.Viewport.Width);
  }

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

  get Map(): Map {
    return this.map;
  }

  set Map(map: Map) {
    this.map = map;
  }

  get ZBuffer(): SArray<f32> {
    return this.zBuffer;
  }

  get ViewportPtr(): PTR_T {
    return changetype<PTR_T>(this.viewport);
  }

  get PlayerPtr(): PTR_T {
    return changetype<PTR_T>(this.player);
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
  return raycaster.ZBuffer.DataPtr;
}

export {
  Raycaster,
  newRaycaster,
  getRaycasterBorderColorOffset,
  getRaycasterZBufferPtr,
};
