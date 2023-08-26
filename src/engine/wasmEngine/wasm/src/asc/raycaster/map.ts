import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';
import { SArray, newSArray } from '../sarray';

@final @unmanaged class Map {
  private width: u32;
  private height: u32;
  // maps with tex indices
  private xMap: SArray<u8>;
  private yMap: SArray<u8>;
  private xMapWidth: u32;
  private xMapHeight: u32;
  private yMapWidth: u32;
  private yMapHeight: u32;

  init(mapWidth: u32, mapHeight: u32): void {
    this.width = mapWidth;
    this.height = mapHeight;
    this.xMapWidth = mapWidth + 1;
    this.xMapHeight = mapHeight;
    this.yMapWidth = mapWidth + 1;
    this.yMapHeight = mapHeight + 1;
    this.xMap = newSArray<u8>(this.xMapWidth * this.xMapHeight);
    this.yMap = newSArray<u8>(this.yMapWidth * this.yMapHeight);
  }

  get Width(): u32 {
    return this.width;
  }

  get Height(): u32 {
    return this.height;
  }

  get Xmap(): SArray<u8> {
    return this.xMap;
  }

  get Ymap(): SArray<u8> {
    return this.yMap;
  }

  get XmapWidth(): u32 {
    return this.xMapWidth;
  }

  get XmapHeight(): u32 {
    return this.xMapHeight;
  }

  get YmapWidth(): u32 {
    return this.yMapWidth;
  }

  get YmapHeight(): u32 {
    return this.yMapHeight;
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
