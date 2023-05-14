import { myAssert } from '../myAssert';
import { DArray, newDArray, deleteDArray } from '../darray';
// import { GET_PTR, ilog2 } from '../memUtils';
import { Pointer } from '../pointer';
// import { Vec3, vec3Alloc, newVec3 } from '../vec3';
import { logi, logf } from '../importVars';
import {alloc} from '../workerHeapManager';
import { Ref } from '../ref';

function darrayTest(): void {
  logi(-7);

  // const arr = newDArray<u32>(10, 2);
  // arr.push(1);
  // arr.push(2);
  // arr.push(3);
  // logi(arr.at(0));
  // logi(arr.at(1));
  // logi(arr.at(2));
  // // logi(arr.at(3)); // assert fails
  // arr.pop();
  // // logi(arr.at(2)); // assert fails
  // arr.push(4);
  // logi(arr.at(2));

  // const arr = newDArray<Vec3>(3);
  // // arr.pop(); // assert fails
  // const v0 = newVec3(1,2,3);
  // arr.push(v0);
  // logf(arr.at(0).x); // prints 1
  // const v1 = changetype<Vec3>(arr.alloc());
  // logi(arr.count); // prints 2
  // v1.x = 5;
  // logf(arr.at(1).x); // prints 5

  // const arr = newDArray<Vec3>(1); // initial capacity 1
  // const v0 = newVec3(1,2,3);
  // arr.push(v0);
  // const v1 = newVec3(4,5,6);
  // arr.push(v1); // realloc here
  // logf(arr.at(0).x); // prints 1
  // logf(arr.at(1).x); // prints 4

  const arr = newDArray<u32>(3, 2); // initial cap 3
  logi(i32(arr.Capacity));
  arr.push(1);
  logi(arr.at(0));
  deleteDArray(arr);
  // arr.push(2);
  // arr.push(3);
  // arr.push(4); // realloc here
  // arr.push(5);
  // arr.push(6);
  // arr.push(7); // realloc here
  // arr.push(8);
  // logi(arr.capacity);

  logi(-7);
}

export { darrayTest };

