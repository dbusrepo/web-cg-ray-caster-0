import { myAssert } from './myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from './memUtils';
import { ObjectAllocator, newObjectAllocator } from './objectAllocator';
import { texturesPixelsSize, texturesPixelsPtr } from './importVars';
import { logi } from './importVars';

// SECOND INDEX: (for each mipmap/image)
// width (32bit)
// height (32bit)
// ptr to mipmap image data (32bit)

const WIDTH_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const HEIGHT_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const LG2_PITCH_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const OFFSET_TO_MIP_DATA_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;

// @ts-ignore: decorator
@final @unmanaged class BitImageRGBA {

  private descPtr: PTR_T = NULL_PTR;

  init(descPtr: PTR_T): void {
    this.descPtr = descPtr;
  }

  @inline get Ptr(): PTR_T {
    return <PTR_T>(texturesPixelsPtr + load<u32>(this.descPtr + WIDTH_FIELD_SIZE + HEIGHT_FIELD_SIZE + LG2_PITCH_FIELD_SIZE));
  }

  @inline get PitchLg2(): SIZE_T {
    return load<u32>(this.descPtr + WIDTH_FIELD_SIZE + HEIGHT_FIELD_SIZE);
  }

  @inline get Width(): SIZE_T {
    return <SIZE_T>load<u32>(this.descPtr);
  }

  @inline get Height(): SIZE_T {
    return <SIZE_T>load<u32>(this.descPtr + WIDTH_FIELD_SIZE);
  }
}

let bitImageAllocator = changetype<ObjectAllocator<BitImageRGBA>>(NULL_PTR);

function initBitImageAllocator(): void {
  bitImageAllocator = newObjectAllocator<BitImageRGBA>(16);
}

function newBitImageRGBA(descPtr: PTR_T): BitImageRGBA {
  if (changetype<PTR_T>(bitImageAllocator) === NULL_PTR) {
    initBitImageAllocator();
  }
  const bitImage = bitImageAllocator.new();
  bitImage.init(descPtr);
  return bitImage;
}

function deleteBitImageRGBA(bitImage: BitImageRGBA): void {
  bitImageAllocator.delete(bitImage);
}

export { BitImageRGBA, newBitImageRGBA, deleteBitImageRGBA };
