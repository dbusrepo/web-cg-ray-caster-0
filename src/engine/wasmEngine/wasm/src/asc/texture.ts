import { myAssert } from './myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from './memUtils';
import { ObjectAllocator, newObjectAllocator } from './objectAllocator';
import { SArray, newSArray } from './sarray';
import { BitImageRGBA } from './bitImageRGBA';
import { logi, numTextures, texturesIndexPtr } from './importVars';
import {
  TEX_NUM_MIPS_FIELD_SIZE,
  TEX_OFFSET_TO_FIRST_MIP_DESC_FIELD_SIZE,
  TEX_DESC_SIZE,
  MIPMAP_WIDTH_FIELD_SIZE,
  MIPMAP_HEIGHT_FIELD_SIZE,
  MIPMAP_LG2_PITCH_FIELD_SIZE,
  MIPMAP_OFFSET_TO_TEXELS_FIELD_SIZE,
  MIPMAP_DESC_SIZE,
} from './importTexturesIndexFieldSizes';
import {
  TEX_NUM_MIPS_FIELD_OFFSET,
  TEX_OFFSET_TO_FIRST_MIP_DESC_FIELD_OFFSET,
  MIPMAP_WIDTH_FIELD_OFFSET,
  MIPMAP_HEIGHT_FIELD_OFFSET,
  MIPMAP_LG2_PITCH_FIELD_OFFSET,
  MIPMAP_OFFSET_TO_TEXELS_FIELD_OFFSET,
} from './importTexturesIndexFieldOffsets';

// TEXTURES INDEX LAYOUT: (see wasmMemInitImages.ts)

// FIRST INDEX:
// for each image:
//  num mipmaps (32bit)
//  ptr to first mipmap descriptor

// SECOND INDEX: (for each mipmap)
// width (32bit)
// height (32bit)
// ptr to mipmap image data (32bit)

// @ts-ignore: decorator
@final @unmanaged class Texture {

  private descPtr: PTR_T = NULL_PTR;
  private gFirstMipMapIdx: SIZE_T; // index in the global mips array of the first mipmap of this tex

  init(texIdx: SIZE_T): void {
    myAssert(texIdx >= 0 && texIdx < numTextures);
    this.descPtr = texturesIndexPtr + texIdx * TEX_DESC_SIZE;
    myAssert(this.NumMipMaps > 0);
  }

  initMipMaps(mipmaps: SArray<BitImageRGBA>, firstMipIdx: SIZE_T): void {
    this.gFirstMipMapIdx = firstMipIdx;
    for (let i: SIZE_T = 0; i < this.NumMipMaps; i++) {
      const bitImageRgba = mipmaps.at(this.gMipIdx(i));
      bitImageRgba.init(this.FirstMipDescPtr + i * MIPMAP_DESC_SIZE);
    }
  }

  @inline private get FirstMipDescPtr(): SIZE_T {
    const firstMipMapDescOffs = load<u32>(this.descPtr + TEX_OFFSET_TO_FIRST_MIP_DESC_FIELD_OFFSET) as SIZE_T;
    return texturesIndexPtr + firstMipMapDescOffs;
  }

  @inline get NumMipMaps(): SIZE_T {
    return load<u32>(this.descPtr + TEX_NUM_MIPS_FIELD_OFFSET) as SIZE_T;
  }

  @inline gMipIdx(mipIdx: SIZE_T): SIZE_T {
    // myAssert(mipIdx >= 0 && mipIdx < this.numMipMaps);
    return this.gFirstMipMapIdx + mipIdx;
  }
}

let textureAllocator = changetype<ObjectAllocator<Texture>>(NULL_PTR);

function initTextureAllocator(): void {
  textureAllocator = newObjectAllocator<Texture>(16);
}

function newTexture(texIdx: usize): Texture {
  if (changetype<PTR_T>(textureAllocator) === NULL_PTR) {
    initTextureAllocator();
  }
  const tex = textureAllocator.new();
  return tex;
}

function deleteTexture(tex: Texture): void {
  textureAllocator.delete(changetype<Texture>(tex));
}

let textures = changetype<SArray<Texture>>(NULL_PTR);
let mipmaps = changetype<SArray<BitImageRGBA>>(NULL_PTR);

function initTextures(): void {
  textures = newSArray<Texture>(numTextures);
  let numMips = 0 as SIZE_T;
  for (let i: SIZE_T = 0; i < numTextures; i++) {
    const tex = textures.at(i);
    tex.init(i);
    numMips += tex.NumMipMaps;
  }
  mipmaps = newSArray<BitImageRGBA>(numMips);
  numMips = 0 as SIZE_T;
  for (let i: SIZE_T = 0; i < numTextures; i++) {
    const tex = textures.at(i);
    tex.initMipMaps(mipmaps, numMips);
    numMips += tex.NumMipMaps;
  }
}

export { Texture, initTextures, textures, mipmaps };
