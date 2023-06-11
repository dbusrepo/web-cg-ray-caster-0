import { myAssert } from '../myAssert';
import { PTR_T, NULL_PTR, getTypeSize } from '../memUtils';
import { ObjectAllocator, newObjectAllocator } from '../objectAllocator';
import { logi } from '../importVars';

// @ts-ignore: decorator
@final @unmanaged class TestClass<T> {
  a: u32;
  b: u32;
  // c: T;

  init(): void {
    this.a = 0;
    this.b = 0;
  }
}

type TestClassObject = TestClass<Object>;

let testClassAllocator = changetype<ObjectAllocator<TestClassObject>>(NULL_PTR);

function initTestClassAllocator(): void {
  testClassAllocator = newObjectAllocator<TestClassObject>(16);
}

function newTestClass<T>(ptr: PTR_T = NULL_PTR): TestClass<T> {
  if (changetype<PTR_T>(testClassAllocator) == NULL_PTR) {
    initTestClassAllocator();
  }
  const testObj = testClassAllocator.new();
  testObj.init();
  return changetype<TestClass<T>>(testObj);
}

function deleteTestClass<T>(testObj: TestClass<T>): void {
  testClassAllocator.delete(changetype<TestClassObject>(testObj));
}

export { TestClass, newTestClass, deleteTestClass };
