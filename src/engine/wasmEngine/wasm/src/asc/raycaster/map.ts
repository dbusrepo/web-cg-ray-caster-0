import { myAssert } from '../myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';
import { SArray, newSArray } from '../sarray';

@final @unmanaged class Map {
  private width: u32;
  private height: u32;

  private xWallMap: SArray<u8>;
  private yWallMap: SArray<u8>;
  private xWallMapWidth: u32;
  private xWallMapHeight: u32;
  private yWallMapWidth: u32;
  private yWallMapHeight: u32;
  private floorMap: SArray<u8>;

  init(mapWidth: u32, mapHeight: u32): void {
    this.width = mapWidth;
    this.height = mapHeight;
    this.xWallMapWidth = mapWidth + 1;
    this.xWallMapHeight = mapHeight;
    this.yWallMapWidth = mapWidth;
    this.yWallMapHeight = mapHeight + 1;
    this.xWallMap = newSArray<u8>(this.xWallMapWidth * this.xWallMapHeight);
    this.yWallMap = newSArray<u8>(this.yWallMapWidth * this.yWallMapHeight);
    this.floorMap = newSArray<u8>(mapWidth * mapHeight);
  }

  get Width(): u32 {
    return this.width;
  }

  get Height(): u32 {
    return this.height;
  }

  get XWallMap(): SArray<u8> {
    return this.xWallMap;
  }

  get YWallMap(): SArray<u8> {
    return this.yWallMap;
  }

  get XWallMapWidth(): u32 {
    return this.xWallMapWidth;
  }

  get XWallMapHeight(): u32 {
    return this.xWallMapHeight;
  }

  get YWallMapWidth(): u32 {
    return this.yWallMapWidth;
  }

  get YWallMapHeight(): u32 {
    return this.yWallMapHeight;
  }

  get FloorMap(): SArray<u8> {
    return this.floorMap;
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
