import { myAssert } from './myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from './memUtils';
import { ObjectAllocator, newObjectAllocator } from './objectAllocator';
import { logi, texelsPtr } from './importVars';
import {
  MIPMAP_WIDTH_FIELD_SIZE,
  MIPMAP_HEIGHT_FIELD_SIZE,
  MIPMAP_LG2_PITCH_FIELD_SIZE,
  MIPMAP_OFFSET_TO_TEXELS_FIELD_SIZE,
  MIPMAP_DESC_SIZE,
} from './importTexturesIndexFieldSizes';
import {
  MIPMAP_WIDTH_FIELD_OFFSET,
  MIPMAP_HEIGHT_FIELD_OFFSET,
  MIPMAP_LG2_PITCH_FIELD_OFFSET,
  MIPMAP_OFFSET_TO_TEXELS_FIELD_OFFSET,
} from './importTexturesIndexFieldOffsets';

// SECOND INDEX: (for each mipmap/image)
// width (32bit)
// height (32bit)
// lg2Pitch (32bit)
// ptr to mipmap image data (32bit)

// @ts-ignore: decorator
@final @unmanaged class BitImageRGBA {

  private descPtr: PTR_T = NULL_PTR;

  init(descPtr: PTR_T): void {
    this.descPtr = descPtr;
  }

  @inline get Width(): SIZE_T {
    return load<u32>(this.descPtr + MIPMAP_WIDTH_FIELD_OFFSET) as SIZE_T;
  }

  @inline get Lg2Pitch(): SIZE_T {
    return load<u32>(this.descPtr + MIPMAP_LG2_PITCH_FIELD_OFFSET) as SIZE_T;
  }

  @inline get Height(): SIZE_T {
    return load<u32>(this.descPtr + MIPMAP_HEIGHT_FIELD_OFFSET) as SIZE_T;
  }

  @inline get Ptr(): PTR_T {
    const texelsOffset = load<u32>(this.descPtr + MIPMAP_OFFSET_TO_TEXELS_FIELD_OFFSET) as SIZE_T;
    return texelsPtr + texelsOffset;
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
