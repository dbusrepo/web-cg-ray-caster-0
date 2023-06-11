import { myAssert } from './myAssert';
import { Pointer } from './pointer';
import { PTR_T, NULL_PTR, getTypeSize } from './memUtils';
import { ObjectAllocator, newObjectAllocator } from './objectAllocator';
import { logi } from './importVars';

// non owning reference
// @ts-ignore: decorator
@final @unmanaged class Ref<T> {
  private ptr: Pointer<T>;

  init(ptr: PTR_T = NULL_PTR): void {
    this.Ptr = ptr;
  }

  @inline get Ptr(): PTR_T {
    return this.ptr.offset;
  }

  set Ptr(ptr: PTR_T) {
    this.ptr = new Pointer<T>(ptr);
  }

  @inline get Deref(): T {
    myAssert(!this.IsNull);
    return this.ptr.value;
  }

  set Deref(v: T) {
    myAssert(!this.IsNull);
    this.ptr.value = v;
  }

  @inline get IsNull(): boolean {
    return this.Ptr == NULL_PTR;
  }
}

type RefObject = Ref<Object>;

let refAllocator = changetype<ObjectAllocator<RefObject>>(NULL_PTR);

function initRefAllocator(): void {
  refAllocator = newObjectAllocator<RefObject>(16);
}

function newRef<T>(ptr: PTR_T = NULL_PTR): Ref<T> {
  if (changetype<PTR_T>(refAllocator) == NULL_PTR) {
    initRefAllocator();
  }
  const ref = changetype<Ref<T>>(refAllocator.new());
  ref.init(ptr);
  return ref;
}

function deleteRef<T>(ref: Ref<T>): void {
  refAllocator.delete(changetype<RefObject>(ref));
}

export { Ref, newRef, deleteRef };
