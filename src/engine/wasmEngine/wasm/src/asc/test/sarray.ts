import { myAssert } from '../myAssert';
import { SArray, newSArray, deleteSArray } from '../sarray';
import { PTR_T, NULL_PTR } from '../memUtils';
import { Pointer } from '../pointer';
// import { Vec3, vec3Alloc, newVec3 } from '../vec3';
import { logi, logf } from '../importVars';
import {alloc} from '../workerHeapManager';
import { Ref } from '../ref';

// @final @unmanaged class MyArrayType {
//   x: u32;
//   y: u32;
// }

function sarrayTest(): void {
  logi(-7);

  // use these in newSArray
  // logi(objSizeNoPad);
  // logi(objSizePow2);
  // logi(objSize);
  // logi(objAlignMask);
  // logi(-8);
  // logi(getTypeSize<Header>())
  // logi(HEADER_ALIGN_MASK);
  // logi(HEADER_SIZE);
  // logi(-8);
  // logi(arrayPtr);
  // logi(headerPtr);
  // logi(dataPtr);

  // const arr = newSArray<MyArrayType>(3);
  // arr.at(1).x = 1;
  // arr.at(1).y = 2;
  // logi(arr.at(1).x);
  // logi(arr.at(1).y);
  // logi(arr.Length);
  // // deleteSArray(arr);

  // const arr = newSArray<u32>(4);
  // logi(changetype<PTR_T>(arr.DataPtr));
  // arr.set(1, 2);
  // logi(arr.at(1));
  // logi(arr.Length);
  // logi(changetype<PTR_T>(arr.DataPtr) & 2);

  // const arr = newSArray<u32>(4, 3);

  // const arr = newSArray<u32>(4, 4);

  // const arr = newSArray<u32>(4);
  // arr.set(0, 2);
  // logi(arr.at(0)); // prints 2

  // const arr = newSArray<Vec3>(1);
  // const v0 = newVec3(1,2,3);
  // arr.set(0, v0);
  // arr.at(0).x = 2;
  // logf(arr.at(0).x); // prints 2
  // logf(v0.x); // prints 1


  logi(-7);
}

export { sarrayTest };
