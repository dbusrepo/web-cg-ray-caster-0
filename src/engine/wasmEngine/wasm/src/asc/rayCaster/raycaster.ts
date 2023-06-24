import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';
import { Viewport, newViewport } from './viewport';
import { Player, newPlayer } from './player';

@final @unmanaged class RayCaster {
  public borderColor: u32;
  public viewport: Viewport;
  public player: Player;

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
}

let rayCasterAlloc = changetype<ObjectAllocator<RayCaster>>(NULL_PTR);

function initRayCasterAllocator(): void {
  rayCasterAlloc = newObjectAllocator<RayCaster>(1);
}

function newRayCaster(): RayCaster {
  if (changetype<PTR_T>(rayCasterAlloc) === NULL_PTR) {
    initRayCasterAllocator();
  }
  const rayCaster = rayCasterAlloc.new();
  return rayCaster;
}

function getRayCasterBorderColorOffset(basePtr: PTR_T): SIZE_T {
  return basePtr + offsetof<RayCaster>("borderColor");
}

export { 
  RayCaster,
  newRayCaster,
  getRayCasterBorderColorOffset,
};
