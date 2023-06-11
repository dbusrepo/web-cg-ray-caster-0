import { myAssert } from '../myAssert';
import { DArray, newDArray, deleteDArray } from '../darray';
import { GET_PTR, ilog2 } from '../memUtils';
import { Pointer } from '../pointer';
// import { Vec3, vec3Alloc, newVec3 } from '../vec3';
import { logi, logf } from '../importVars';
import {alloc} from '../workerHeapManager';
import { Ref, newRef, deleteRef } from '../ref';
import { TestClass, newTestClass, deleteTestClass } from './testClass';

function darrayTest(): void {
  logi(-7);

  // const arr = newDArray<u32>(1);
  // arr.reserveNext().value = 10; // in place construction, with Pointer set
  // logi(arr.at(0));

  // const arr = newDArray<TestClass<u32>>(1);
  // arr.reserveNext().value.a = 11; // in place construction, with Pointer get + props/methods (init...) access
  // logi(arr.at(0).a);

  // const arr = newDArray<u32>(1);
  // arr.push(10);
  // logi(arr.at(0));
  // logi(arr.Capacity);
  // arr.push(20);
  // logi(arr.at(1));
  // logi(arr.Capacity);
  // arr.push(30);
  // logi(arr.at(2));
  // logi(arr.Capacity);
  // arr.push(40);
  // logi(arr.at(3));
  // logi(arr.Capacity);
  // arr.push(50);
  // logi(arr.at(4));
  // logi(arr.Capacity);

  // const arr = newDArray<u32>(1);
  // logi(arr.Capacity);
  // logi(arr.DataPtr);
  // arr.push(1);
  // logi(arr.at(0));
  // logi(arr.Capacity);
  // logi(arr.DataPtr);
  // arr.push(2);
  // logi(arr.at(1));
  // logi(arr.Capacity);
  // logi(arr.DataPtr);
  // arr.push(3);
  // logi(arr.at(2));
  // logi(arr.Capacity);
  // logi(arr.DataPtr);
  // logi(arr.at(0));
  // arr.set(0, 15);
  // logi(arr.at(0));
  // deleteDArray(arr);

  // const testObj = newTestClass<u32>();
  // const arr = newDArray<TestClass<u32>>(1);
  // testObj.a = 10;
  // // logi(testObj.a);
  // arr.push(testObj); // push a copy here
  // logi(arr.at(0).a);
  // testObj.a = 11;
  // logi(testObj.a);
  // logi(arr.at(0).a);
  // // arr.at(0).a = 15;
  // // logi(arr.at(0).a);
  // // const val = arr.at(0); // get a reference here
  // // logi(val.a);
  // // val.a = 20;
  // // logi(arr.at(0).a);
  // deleteDArray(arr);

  // const testObj = newTestClass<u32>();
  // const ref = newRef<TestClass<u32>>(GET_PTR(testObj));
  // const arr = newDArray<Ref<TestClass<u32>>>(1);
  // arr.push(ref);

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

  // const arr = newDArray<u32>(3, 2); // initial cap 3
  // logi(i32(arr.Capacity));
  // arr.push(1);
  // logi(arr.at(0));
  // deleteDArray(arr);

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

