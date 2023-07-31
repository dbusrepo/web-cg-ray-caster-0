import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';
import { SArray, newSArray } from '../sarray';

@final @unmanaged class Map {
  private width: u32;
  private height: u32;
  private xGrid: SArray<u8>;
  private yGrid: SArray<u8>;

  init(mapWidth: u32, mapHeight: u32): void {
    this.width = mapWidth;
    this.height = mapHeight;
    this.xGrid = newSArray<u8>((mapWidth + 1) * mapHeight);
    this.yGrid = newSArray<u8>((mapWidth + 1) * (mapHeight + 1));
  }

  get Width(): u32 {
    return this.width;
  }

  get Height(): u32 {
    return this.height;
  }

  get xGridPtr(): SArray<u8> {
    return this.xGrid;
  }

  get yGridPtr(): SArray<u8> {
    return this.yGrid;
  }

}

let mapAlloc = changetype<ObjectAllocator<Map>>(NULL_PTR);

function initMapAllocator(): void {
  mapAlloc = newObjectAllocator<Map>(1);
}

function newMap(mapWidth: u32, mapHeight: u32): Map {
  if (changetype<PTR_T>(mapAlloc) === NULL_PTR) {
    initMapAllocator();
  }
  const map = mapAlloc.new();
  map.init(mapWidth, mapHeight);
  return map;
}

export {
  Map,
  newMap,
};
