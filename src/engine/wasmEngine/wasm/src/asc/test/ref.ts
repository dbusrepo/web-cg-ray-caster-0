import { myAssert } from '../myAssert';
import { SArray, newSArray, deleteSArray } from '../sarray';
import { Pointer } from '../pointer';
// import { Vec3, vec3Alloc, newVec3 } from '../vec3';
import { logi, logf } from '../importVars';
import {alloc} from '../workerHeapManager';
import { Ref, newRef } from '../ref';

function refTest(): void {
  logi(-8);

  // // TEST REFS ALONE (no arrays of refs)
  // const v0 = newVec3(1,2,3);
  // const ref = newRef<Vec3>();
  // ref.ptr = GET_PTR(v0);
  // // logi(ref.ptr);
  // logi(ref.ptr);
  // logf(ref.deref.x); // prints 1

  // test init with newRef param
  // const v0 = newVec3(1,2,3);
  // const ref = newRef<Vec3>(GET_PTR(v0));
  // logi(ref.ptr);
  // logf(ref.deref.x); // prints 1

  // test is null
  // const ref = newRef<Vec3>(NULL_PTR);
  // or
  // const v0 = newVec3(1,2,3);
  // const ref = newRef<Vec3>(GET_PTR(v0));
  // logi(ref.isNull);

  // TEST REFS WITH ARRAYS

  // // sarray of refs to object types (Vec3)
  // const v0 = newVec3(1,2,3);
  // const sarr = newSArray<Ref<Vec3>>(2);
  // // Note: don't use sarr.set(0, GET_PTR(..)) 'cause we want to change the
  // existing ref, not creating a new one..
  // sarr.at(0).ptr = GET_PTR(v0);
  // const v = sarr.at(0).deref;
  // logf(v.x); // prints 1
  // const v1 = newVec3(4,5,6);
  // sarr.at(0).deref = v1;
  // logf(v.x); // prints 4

  // // refs to primitives 
  // const values = newSArray<u32>(1); // take the address from an array element
  // values.set(0, 1); // set value 1
  // logi(values.at(0));
  // const ptr2u32 = values.ptrAt(0);
  // logi(ptr2u32); // prints the address
  // const ptrArr = newSArray<Ref<u32>>(1);
  // ptrArr.at(0).ptr = ptr2u32;
  // logi(ptrArr.at(0).ptr); // prints the same address
  // logi(ptrArr.at(0).deref); // prints 1
  // ptrArr.at(0).deref = 2;
  // logi(ptrArr.at(0).deref); // prints 2
  // // logi(ptrArr.at(0).deref);


  logi(-8);
}

export { refTest };
