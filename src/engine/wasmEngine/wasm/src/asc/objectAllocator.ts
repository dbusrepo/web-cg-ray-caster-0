import { myAssert } from './myAssert';
import { alloc, free } from './workerHeapManager';
import { PTR_SIZE, PTR_ALIGN_MASK, SIZE_T, MAX_ALLOC_SIZE, 
         PTR_T, NULL_PTR, getTypeSize, getTypeAlignMask } from './memUtils';
import { ArenaAlloc, newArena } from './arenaAlloc';
import { logi } from './importVars';

// @ts-ignore: decorator
@final @unmanaged class ObjectAllocator<T> {
  private arena: ArenaAlloc;

  init(numObjsBlock: SIZE_T): void {
    this.arena = newArena(getTypeSize<T>(), numObjsBlock);
  }

  new(): T {
    const ptr = this.arena.alloc();
    return changetype<T>(ptr);
  }

  delete(v: T): void {
    const ptr = changetype<PTR_T>(v);
    this.arena.free(ptr);
  }
}

let objectAllocatorsArena = changetype<ArenaAlloc>(NULL_PTR);

function initObjectAllocatorsArena(): void {
  const NUM_OBJ_ALLOC_PER_BLOCK = 16;
  const objSize: SIZE_T = offsetof<ObjectAllocator<Object>>();
  objectAllocatorsArena = newArena(objSize, NUM_OBJ_ALLOC_PER_BLOCK);
}

function newObjectAllocator<T>(numObjsBlock: SIZE_T): ObjectAllocator<T> {
  if (changetype<PTR_T>(objectAllocatorsArena) == NULL_PTR) {
    initObjectAllocatorsArena();
  }
  const objAlloc = changetype<ObjectAllocator<T>>(objectAllocatorsArena.alloc());
  objAlloc.init(numObjsBlock);
  return objAlloc;
}

export { ObjectAllocator, newObjectAllocator };
