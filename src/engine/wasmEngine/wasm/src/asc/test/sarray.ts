import { myAssert } from '../myAssert';
import { SArray, newSArray, deleteSArray } from '../sarray';
// import { PTR_T, NULL_PTR } from '../memUtils';
import { Pointer } from '../pointer';
// import { Vec3, vec3Alloc, newVec3 } from '../vec3';
import { logi, logf } from '../importVars';
import {alloc} from '../workerHeapManager';
import { Ref } from '../ref';

function sarrayTest(): void {
  logi(-7);

  // const arr = newSArray<u32>(4);
  // logi(changetype<PTR_T>(arr));
  // logi(changetype<PTR_T>(arr) & 3);

  // const arr = newSArray<u32>(4, 3);
  // logi(changetype<PTR_T>(arr));
  // logi(changetype<PTR_T>(arr) & 7);

  // const arr = newSArray<u32>(4, 4);
  // logi(changetype<PTR_T>(arr));
  // logi(changetype<PTR_T>(arr) & 15);

  // const arr = newSArray<u32>(4);
  // logi(changetype<PTR_T>(arr));
  // logi(changetype<PTR_T>(arr) & 3);
  // arr.set(0, 2);
  // logi(arr.at(0)); // prints 2

  // const arr = newSArray<Vec3>(1);
  // // logi(changetype<PTR_T>(arr));
  // // logi(changetype<PTR_T>(arr) & 3);
  // const v0 = newVec3(1,2,3);
  // arr.set(0, v0);
  // arr.at(0).x = 2;
  // logf(arr.at(0).x); // prints 2
  // logf(v0.x); // prints 1


  logi(-7);
}

export { sarrayTest };
