import { myAssert } from '../myAssert';
import { ArenaAlloc, newArena } from '../arenaAlloc';
import { logi } from '../importVars';

function arenaAllocTest(): void {
  logi(-1);
  // const arena = newArena(7, 2);
  // const arena = newArena(4, 2, 4);
  // const arena = newArena(3, 2, 2);
  // const arena = newArena(4, 2, 3);
  // const arena = newArena(5, 2, 2);
  const arena = newArena(8, 2, 3);

  let ptr = arena.alloc();
  logi(<u32>ptr);
  // arena.dealloc(ptr);
  ptr = arena.alloc();
  logi(<u32>ptr);
  arena.free(ptr);
  ptr = arena.alloc();
  logi(<u32>ptr);
  logi(-1);
}

export { arenaAllocTest };

