import assert from 'assert';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { AssetTextureRGBA } from '../assets/assetTextureRGBA';

// TEXTURES INDEX LAYOUT:

// FIRST INDEX:
// for each image:
//  num mipmaps (32bit)
//  offset first mipmap descriptor (32 bit) (wrt to first index start)

// SECOND INDEX: (for each mipmap)
// width (32bit)
// height (32bit)
// lg2Pitch (32bit)
// offset to mipmap image data (32bit) (wrt to texels region start)

// TEXTURES INDEX FIELDS SIZES
const TEX_NUM_MIPS_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const TEX_OFFSET_TO_FIRST_MIP_DESC_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const TEX_DESC_SIZE =
  TEX_NUM_MIPS_FIELD_SIZE + TEX_OFFSET_TO_FIRST_MIP_DESC_FIELD_SIZE;

// MIPMAPS INDEX FIELDS SIZES
const MIPMAP_WIDTH_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const MIPMAP_HEIGHT_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const MIPMAP_LG2_PITCH_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const MIPMAP_OFFSET_TO_TEXELS_FIELD_SIZE = Uint32Array.BYTES_PER_ELEMENT;

const MIPMAP_DESC_SIZE =
  MIPMAP_WIDTH_FIELD_SIZE +
  MIPMAP_HEIGHT_FIELD_SIZE +
  MIPMAP_LG2_PITCH_FIELD_SIZE +
  MIPMAP_OFFSET_TO_TEXELS_FIELD_SIZE;

// TEXTURES INDEX FIELD OFFSETS
const TEX_NUM_MIPS_FIELD_OFFSET = 0;
const TEX_OFFSET_TO_FIRST_MIP_DESC_FIELD_OFFSET =
  TEX_NUM_MIPS_FIELD_OFFSET + TEX_NUM_MIPS_FIELD_SIZE;

// MIPMAPS INDEX FIELD OFFSETS
const MIPMAP_WIDTH_FIELD_OFFSET = 0;
const MIPMAP_HEIGHT_FIELD_OFFSET =
  MIPMAP_WIDTH_FIELD_OFFSET + MIPMAP_WIDTH_FIELD_SIZE;
const MIPMAP_LG2_PITCH_FIELD_OFFSET =
  MIPMAP_HEIGHT_FIELD_OFFSET + MIPMAP_HEIGHT_FIELD_SIZE;
const MIPMAP_OFFSET_TO_TEXELS_FIELD_OFFSET =
  MIPMAP_LG2_PITCH_FIELD_OFFSET + MIPMAP_LG2_PITCH_FIELD_SIZE;

const wasmTexturesIndexFieldSizes = {
  TEX_NUM_MIPS_FIELD_SIZE,
  TEX_OFFSET_TO_FIRST_MIP_DESC_FIELD_SIZE,
  TEX_DESC_SIZE,
  MIPMAP_WIDTH_FIELD_SIZE,
  MIPMAP_HEIGHT_FIELD_SIZE,
  MIPMAP_LG2_PITCH_FIELD_SIZE,
  MIPMAP_OFFSET_TO_TEXELS_FIELD_SIZE,
  MIPMAP_DESC_SIZE,
};

const wasmTexturesIndexFieldOffsets = {
  TEX_NUM_MIPS_FIELD_OFFSET,
  TEX_OFFSET_TO_FIRST_MIP_DESC_FIELD_OFFSET,
  MIPMAP_WIDTH_FIELD_OFFSET,
  MIPMAP_HEIGHT_FIELD_OFFSET,
  MIPMAP_LG2_PITCH_FIELD_OFFSET,
  MIPMAP_OFFSET_TO_TEXELS_FIELD_OFFSET,
};

let texDescIndexSize: number; // first index level size

function calcWasmTexturesIndexSize(assetTextures: AssetTextureRGBA[]) {
  texDescIndexSize = assetTextures.length * TEX_DESC_SIZE;
  let size = texDescIndexSize;
  for (let i = 0; i < assetTextures.length; ++i) {
    const { Levels: levels } = assetTextures[i];
    size += levels.length * MIPMAP_DESC_SIZE;
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
  const texsIndexView = new DataView(
    texturesIndex.buffer,
    texturesIndex.byteOffset,
  );
  let curTexDescOffs = 0;
  let curFirstMipDescOffs = texDescIndexSize; // start of second mips desc index just after first textures desc index
  let curMipTexelsOffs = 0; // start from 0, offsets to texels are relative to the start of the texels region
  for (let i = 0; i < numTextures; ++i) {
    const texture = textures[i];
    const { Levels: levels } = texture;
    const numMips = levels.length;
    texsIndexView.setUint32(
      curTexDescOffs + TEX_NUM_MIPS_FIELD_OFFSET,
      numMips,
      true,
    );
    texsIndexView.setUint32(
      curTexDescOffs + TEX_OFFSET_TO_FIRST_MIP_DESC_FIELD_OFFSET,
      curFirstMipDescOffs,
      true,
    );
    const mipDescView = new DataView(
      texturesIndex.buffer,
      texturesIndex.byteOffset + curFirstMipDescOffs,
    );
    let curMipDescOffs = 0;
    // fill mipmaps descs index
    for (let j = 0; j < numMips; ++j) {
      const level = levels[j];
      const {
        Width: width,
        Height: height,
        Lg2Pitch: lg2Pitch,
        Buf8: buf8,
      } = level;
      mipDescView.setUint32(
        curMipDescOffs + MIPMAP_WIDTH_FIELD_OFFSET,
        width,
        true,
      );
      mipDescView.setUint32(
        curMipDescOffs + MIPMAP_HEIGHT_FIELD_OFFSET,
        height,
        true,
      );
      mipDescView.setUint32(
        curMipDescOffs + MIPMAP_LG2_PITCH_FIELD_OFFSET,
        lg2Pitch,
        true,
      );
      mipDescView.setUint32(
        curMipDescOffs + MIPMAP_OFFSET_TO_TEXELS_FIELD_OFFSET,
        curMipTexelsOffs,
        true,
      );
      texturesPixels.set(buf8, curMipTexelsOffs);
      curMipTexelsOffs += buf8.length;
      curMipDescOffs += MIPMAP_DESC_SIZE;
    }
    // move to next texture and mipmaps descs
    curTexDescOffs += TEX_DESC_SIZE;
    curFirstMipDescOffs += numMips * MIPMAP_DESC_SIZE;
  }
}

export {
  copyTextures2WasmMem,
  calcWasmTexturesIndexSize,
  wasmTexturesIndexFieldSizes,
  wasmTexturesIndexFieldOffsets,
};
