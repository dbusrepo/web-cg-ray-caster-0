import { myAssert } from './myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from './memUtils';
import { ObjectAllocator, newObjectAllocator } from './objectAllocator';
import { SArray, newSArray } from './sarray';
import { BitImageRGBA } from './bitImageRGBA';
import { texturesIndexPtr, texturesIndexSize, texturesPixelsPtr, texturesPixelsSize, numTextures } from './importVars';
import { logi } from './importVars';

// TEXTURES INDEX LAYOUT: (see wasmMemInitImages.ts)

// FIRST INDEX:
// for each image:
//  num mipmaps (32bit)
//  ptr to first mipmap descriptor

// SECOND INDEX: (for each mipmap)
// width (32bit)
// height (32bit)
// ptr to mipmap image data (32bit)

const NUM_MIPS_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const PTR_TO_FIRST_MIP_DESC_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const TEX_DESC_SIZE = NUM_MIPS_FIELD_SIZE + PTR_TO_FIRST_MIP_DESC_FIELD_SIZE;

const WIDTH_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const HEIGHT_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const PITCH_LG2_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const OFFSET_TO_MIP_DATA_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const MIP_DESC_SIZE = WIDTH_FIELD_SIZE + HEIGHT_FIELD_SIZE + PITCH_LG2_FIELD_SIZE + OFFSET_TO_MIP_DATA_FIELD_SIZE;

// @ts-ignore: decorator
@final @unmanaged class Texture {

  private mipmaps: SArray<BitImageRGBA>;

  init(texIdx: SIZE_T): void {
    myAssert(texIdx >= 0 && texIdx < numTextures);
    const numMipmaps = load<u32>(texturesIndexPtr + texIdx * TEX_DESC_SIZE);
    myAssert(numMipmaps > 0);
    const mipMapDescOffs = load<u32>(texturesIndexPtr + texIdx * TEX_DESC_SIZE + NUM_MIPS_FIELD_SIZE);
    let nextMipDescPtr = texturesIndexPtr + mipMapDescOffs; // next mip map descriptor ptr
    this.mipmaps = newSArray<BitImageRGBA>(numMipmaps);
    for (let i: u32 = 0; i < numMipmaps; i++) {
      const bitImageRgba = this.mipmaps.at(i);
      bitImageRgba.init(nextMipDescPtr);
      nextMipDescPtr += MIP_DESC_SIZE;
    }
  }

  getMipmap(i: SIZE_T): BitImageRGBA {
    myAssert(i >= 0 && i < this.mipmaps.Length);
    return this.mipmaps.at(i);
  }

  get Mipmaps(): SArray<BitImageRGBA> {
    return this.mipmaps;
  }

  get NumMipmaps(): SIZE_T {
    return this.mipmaps.Length;
  }
}

let textureAlloc = changetype<ObjectAllocator<Texture>>(NULL_PTR);

function initTextureAllocator(): void {
  textureAlloc = newObjectAllocator<Texture>(16);
}

function newTexture(texIdx: usize): Texture {
  if (changetype<PTR_T>(textureAlloc) === NULL_PTR) {
    initTextureAllocator();
  }
  const tex = textureAlloc.new();
  tex.init(texIdx);
  return tex;
}

function deleteTexture(tex: Texture): void {
  textureAlloc.delete(changetype<Texture>(tex));
}

export { Texture, newTexture, deleteTexture };
