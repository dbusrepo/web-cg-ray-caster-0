import { myAssert } from './myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from './memUtils';
import { ObjectAllocator, newObjectAllocator } from './objectAllocator';
import { SArray, newSArray } from './sarray';
import { BitImageRGBA } from './bitImageRGBA';
import { texturesIndexPtr, texturesIndexSize, texturesPixelsPtr, texturesPixelsSize, numTextures } from './importVars';
import {
  NUM_MIPS_FIELD_SIZE,
  PTR_TO_FIRST_MIP_DESC_FIELD_SIZE,
  TEX_DESC_SIZE,
  WIDTH_FIELD_SIZE,
  HEIGHT_FIELD_SIZE,
  PITCH_LG2_FIELD_SIZE,
  OFFSET_TO_MIP_DATA_FIELD_SIZE,
  MIP_DESC_SIZE,
} from './importFieldSizes';
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

// @ts-ignore: decorator
@final @unmanaged class Texture {

  private mipMapDescOffs: SIZE_T; // offset to the first mip map descriptor
  private numMipMaps: SIZE_T;
  private mipMapsOffs: SIZE_T; // index of the first mipmap in global mipmaps array

  init(texIdx: SIZE_T): void {
    myAssert(texIdx >= 0 && texIdx < numTextures);
    const numMipMaps = load<u32>(texturesIndexPtr + texIdx * TEX_DESC_SIZE);
    myAssert(numMipMaps > 0);
    const mipMapDescOffs = load<u32>(texturesIndexPtr + texIdx * TEX_DESC_SIZE + NUM_MIPS_FIELD_SIZE);
    this.mipMapDescOffs = texturesIndexPtr + mipMapDescOffs;
    this.numMipMaps = numMipMaps;
  }

  initMipMaps(startOffset: SIZE_T, mipmaps: SArray<BitImageRGBA>): void {
    this.mipMapsOffs = startOffset;
    for (let i: SIZE_T = 0; i < this.numMipMaps; i++) {
      const bitImageRgba = mipmaps.at(this.mipMapsOffs + i);
      bitImageRgba.init(this.mipMapDescOffs + i * MIP_DESC_SIZE);
    }
  }

  @inline mipmapIdx(mipIdx: SIZE_T): SIZE_T {
    // myAssert(mipIdx >= 0 && mipIdx < this.numMipMaps);
    return this.mipMapsOffs + mipIdx;
  }

  @inline get NumMipMaps(): SIZE_T {
    return this.numMipMaps;
  }

  @inline get MipMapsOffs(): SIZE_T {
    return this.mipMapsOffs;
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
    tex.initMipMaps(numMips, mipmaps);
    numMips += tex.NumMipMaps;
  }
}

export { Texture, initTextures, textures, mipmaps };
