import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';
import { SArray, newSArray } from '../sarray';
import { FrameColorRGBA } from '../frameColorRGBA';
import { BitImageRGBA } from '../bitImageRGBA';
import { Texture } from '../texture';

@final @unmanaged class RaycasterParams {
  public frameColorRGBA: FrameColorRGBA;
  public textures: SArray<Texture>;
  public mipmaps: SArray<BitImageRGBA>;
}

let raycasterParamsAllocator = changetype<ObjectAllocator<RaycasterParams>>(NULL_PTR);

function initRaycasterParamsAllocator(): void {
  raycasterParamsAllocator = newObjectAllocator<RaycasterParams>(1);
}

function newRaycasterParams(): RaycasterParams {
  if (changetype<PTR_T>(raycasterParamsAllocator) === NULL_PTR) {
    initRaycasterParamsAllocator();
  }
  const raycasterParams = raycasterParamsAllocator.new();
  return raycasterParams;
}

function deleteRaycasterParams(raycasterParams: RaycasterParams): void {
  raycasterParamsAllocator.delete(changetype<RaycasterParams>(raycasterParams));
}

export { 
  RaycasterParams,
  newRaycasterParams,
  deleteRaycasterParams,
};
