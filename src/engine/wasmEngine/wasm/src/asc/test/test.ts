import { workerHeapManagerTest } from './workerHeapManager';
import { arenaAllocTest } from './arenaAlloc';
import { sarrayTest } from './sarray';
import { darrayTest } from './darray';
import { refTest } from './ref';

function test(): void {
  // memManagerTest();
  // arenaAllocTest();
  // refTest();
  sarrayTest();
  darrayTest();
}

export { test };
