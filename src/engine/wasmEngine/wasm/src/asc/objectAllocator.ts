import { myAssert } from './myAssert';
import { alloc, dealloc } from './workerHeapManager';
import { PTR_SIZE, PTR_ALIGN_MASK, SIZE_T, MAX_ALLOC_SIZE, 
         PTR_T, NULL_PTR, getTypeSize, getTypeAlignMask } from './memUtils';
import { ArenaAlloc, newArena } from './arenaAlloc';
import { logi } from './importVars';

// @ts-ignore: decorator
@final @unmanaged class ObjectAllocator<T> {
  private arena: ArenaAlloc;

  init(numObjPerBlock: SIZE_T): void {
    this.arena = newArena(getTypeSize<T>(), numObjPerBlock);
  }

  new(): T {
    return changetype<T>(this.arena.alloc());
  }

  delete(v: T): void {
    this.arena.dealloc(changetype<PTR_T>(v));
  }
}

let objectAllocatorsArena = changetype<ArenaAlloc>(NULL_PTR);

function initObjectAllocatorsArena(): void {
  const NUM_OBJ_ALLOC_PER_BLOCK = 16;
  const objSize: SIZE_T = offsetof<ObjectAllocator<Object>>();
  objectAllocatorsArena = newArena(objSize, NUM_OBJ_ALLOC_PER_BLOCK);
}

function newObjectAllocator<T>(numObjPerBlock: SIZE_T): ObjectAllocator<T> {
  if (changetype<PTR_T>(objectAllocatorsArena) == NULL_PTR) {
    initObjectAllocatorsArena();
  }
  const objAlloc = changetype<ObjectAllocator<T>>(objectAllocatorsArena.alloc());
  objAlloc.init(numObjPerBlock);
  return objAlloc;
}

export { ObjectAllocator, newObjectAllocator };
