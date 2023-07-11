import assert from 'assert';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { ascImportImages } from '../../../assets/build/images';
import type { WasmViews } from '../wasmEngine/wasmViews';
import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';
import {
  TEX_DESC_SIZE,
  MIP_DESC_SIZE,
  NUM_MIPS_FIELD_SIZE,
  WIDTH_FIELD_SIZE,
  HEIGHT_FIELD_SIZE,
} from '../wasmEngine/wasmMemInitImages';

class Texture {
  constructor(
    private mipmaps: BitImageRGBA[],
  ) {}

  getMipmap(lvl: number): BitImageRGBA {
    assert(lvl >= 0 && lvl < this.mipmaps.length);
    return this.mipmaps[lvl];
  }

  get Mipmaps(): BitImageRGBA[] {
    return this.mipmaps;
  }
  
  get NumMipmaps(): number {
    return this.mipmaps.length;
  }
}

const initTexture = (wasmViews: WasmViews, texId: number): Texture => {
  assert(texId >= 0 && texId < Object.keys(ascImportImages).length);

  const texMipMapIdxOffs = wasmViews.texturesIndex.byteOffset + texId * TEX_DESC_SIZE;
  const numMipmaps = gWasmView.getUint32(texMipMapIdxOffs, true);
  let nextMipmapDescOffs = wasmViews.texturesIndex.byteOffset + gWasmView.getUint32(texMipMapIdxOffs + NUM_MIPS_FIELD_SIZE, true);

  const mipmaps = new Array(numMipmaps);

  for (let i = 0; i < numMipmaps; i++) {
    const width = gWasmView.getUint32(nextMipmapDescOffs, true);
    const height = gWasmView.getUint32(nextMipmapDescOffs + WIDTH_FIELD_SIZE, true);
    const pixelsOffs = gWasmView.getUint32(nextMipmapDescOffs + WIDTH_FIELD_SIZE + HEIGHT_FIELD_SIZE, true);
    const imageBuf8 = new Uint8Array(wasmViews.texturesPixels.buffer,
                         wasmViews.texturesPixels.byteOffset + pixelsOffs,
                         width * height * BPP_RGBA);
    const mipmap = new BitImageRGBA();
    mipmap.init(width, height, imageBuf8);
    mipmaps[i] = mipmap;
    nextMipmapDescOffs += MIP_DESC_SIZE;
  }

  const texture = new Texture(mipmaps);
  return texture;
};

export { Texture, initTexture };
