import assert from 'assert';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { AssetTextureRGBA } from '../assets/assetTextureRGBA';

// TEXTURES INDEX LAYOUT:

// FIRST INDEX:
// for each image:
//  num mipmaps (32bit)
//  ptr to first mipmap descriptor

// SECOND INDEX: (for each mipmap)
// width (32bit)
// height (32bit)
// ptr to mipmap image data (32bit)

// INDEX FIELDS SIZES
const NUM_MIPS_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const PTR_TO_FIRST_MIP_DESC_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const TEX_DESC_SIZE = NUM_MIPS_FIELD_SIZE + PTR_TO_FIRST_MIP_DESC_FIELD_SIZE;

const WIDTH_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const HEIGHT_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const OFFSET_TO_MIP_DATA_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const MIP_DESC_SIZE = WIDTH_FIELD_SIZE + HEIGHT_FIELD_SIZE + OFFSET_TO_MIP_DATA_FIELD_SIZE;

let texDescIndexSize: number; // first index level size

function calcWasmTexturesIndexSize(assetTextures: AssetTextureRGBA[]) {
  texDescIndexSize = assetTextures.length * TEX_DESC_SIZE;
  let size = texDescIndexSize;
  for (let i = 0; i < assetTextures.length; ++i) {
    const { Levels: levels } = assetTextures[i];
    size += levels.length * MIP_DESC_SIZE;
  }
  return size;
}

function copyTextures2WasmMem(
  textures: AssetTextureRGBA[],
  texturesIndex: Uint8Array,
  texturesPixels: Uint8Array,
) {
  assert(texDescIndexSize !== undefined);
  const { length: numTextures } = textures;
  const texsIndexView = new DataView(texturesIndex.buffer, texturesIndex.byteOffset);
  let nextTexDescOffs = 0;
  let nextFirstMipDescOffs = texDescIndexSize;
  let nextMipPixelsOffs = 0;
  for (let i = 0; i < numTextures; ++i) {
    const texture = textures[i];
    const { Levels: levels } = texture;
    const numMips = levels.length;
    texsIndexView.setUint32(nextTexDescOffs, numMips, true);
    texsIndexView.setUint32(nextTexDescOffs + NUM_MIPS_FIELD_SIZE, nextFirstMipDescOffs, true);
    const mipDescView = new DataView(texturesIndex.buffer, texturesIndex.byteOffset + nextFirstMipDescOffs);
    let nextMipDescFieldOffset = 0;
    for (let j = 0; j < numMips; ++j) {
      const level = levels[j];
      const { Width: width, Height: height, Buf8: buf8 } = level;
      mipDescView.setUint32(nextMipDescFieldOffset, width, true);
      nextMipDescFieldOffset += WIDTH_FIELD_SIZE;
      mipDescView.setUint32(nextMipDescFieldOffset, height, true);
      nextMipDescFieldOffset += HEIGHT_FIELD_SIZE;
      mipDescView.setUint32(nextMipDescFieldOffset, nextMipPixelsOffs, true);
      nextMipDescFieldOffset += OFFSET_TO_MIP_DATA_FIELD_SIZE;
      texturesPixels.set(buf8, nextMipPixelsOffs);
      nextMipPixelsOffs += buf8.length;
    }
    nextTexDescOffs += TEX_DESC_SIZE;
    nextFirstMipDescOffs += numMips * MIP_DESC_SIZE;
  }
}

export {
  copyTextures2WasmMem,
  calcWasmTexturesIndexSize,
  TEX_DESC_SIZE,
  MIP_DESC_SIZE,
  NUM_MIPS_FIELD_SIZE,
  WIDTH_FIELD_SIZE, 
  HEIGHT_FIELD_SIZE,
};
