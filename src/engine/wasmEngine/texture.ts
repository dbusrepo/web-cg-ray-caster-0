import assert from 'assert';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import {
  TRANSP_COLOR_RGB,
  ascImportImages,
} from '../../../assets/build/images';
import { gWasmView, gWasmViews } from './wasmRun';
import {
  wasmTexturesIndexFieldSizes,
  wasmTexturesIndexFieldOffsets,
} from './wasmMemInitImages';

class Mipmap {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private wasmIdx: number, // wasm index in mipmaps array
    private image: BitImageRGBA,
  ) {}

  get WasmIdx(): number {
    return this.wasmIdx;
  }

  get Image(): BitImageRGBA {
    return this.image;
  }
}

// view to wasm texture/mipmaps
class Texture {
  public static transpColor: number;

  // eslint-disable-next-line no-useless-constructor
  constructor(
    private key: string,
    private wasmIdx: number,
    private mipmaps: Mipmap[],
  ) {}

  getMipmap(lvl: number): Mipmap {
    // assert(lvl >= 0 && lvl < this.mipmaps.length);
    return this.mipmaps[lvl];
  }

  get Key(): string {
    return this.key;
  }

  get WasmIdx(): number {
    return this.wasmIdx;
  }

  get WallMapIdx(): number {
    return this.WasmIdx + 1;
  }

  get NumMipmaps(): number {
    return this.mipmaps.length;
  }

  makeDarker() {
    this.mipmaps.forEach((mipmap) => {
      // mipmap.Image.makeDarker(Texture.transpColor);
    });
  }
}

function bitImageRGBAViewOnWasmMip(mipmapOffs: number): BitImageRGBA {
  const width = gWasmView.getUint32(mipmapOffs, true);

  const height = gWasmView.getUint32(
    mipmapOffs + wasmTexturesIndexFieldOffsets.MIPMAP_HEIGHT_FIELD_OFFSET,
    true,
  );

  const pitchLg2 = gWasmView.getUint32(
    mipmapOffs + wasmTexturesIndexFieldOffsets.MIPMAP_LG2_PITCH_FIELD_OFFSET,
    true,
  );
  const pitch = 1 << pitchLg2;

  const texelsOffs = gWasmView.getUint32(
    mipmapOffs +
      wasmTexturesIndexFieldOffsets.MIPMAP_OFFSET_TO_TEXELS_FIELD_OFFSET,
    true,
  );

  const imageBuf8 = new Uint8Array(
    gWasmViews.texels.buffer,
    gWasmViews.texels.byteOffset + texelsOffs,
    height * pitch * BPP_RGBA,
  );

  const mipmap = new BitImageRGBA();
  mipmap.initLg2Pitch(width, height, pitchLg2, imageBuf8);

  return mipmap;
}

const initTextureWasmView = (
  texKey: string,
  wasmTexIdx: number,
  wasmMipIdx: number,
): Texture => {
  assert(wasmTexIdx >= 0 && wasmTexIdx < Object.keys(ascImportImages).length);

  const texDescOffs =
    gWasmViews.texturesIndex.byteOffset +
    wasmTexIdx * wasmTexturesIndexFieldSizes.TEX_DESC_SIZE;

  const numMipmaps = gWasmView.getUint32(texDescOffs, true);

  const firstMipDescOffs = gWasmView.getUint32(
    texDescOffs +
      wasmTexturesIndexFieldOffsets.TEX_OFFSET_TO_FIRST_MIP_DESC_FIELD_OFFSET,
    true,
  );

  let mipmapDescOffs = gWasmViews.texturesIndex.byteOffset + firstMipDescOffs;

  const mipmaps: Mipmap[] = new Array(numMipmaps);
  let curWasmIdx = wasmMipIdx;

  for (let i = 0; i < numMipmaps; i++) {
    const image = bitImageRGBAViewOnWasmMip(mipmapDescOffs);
    mipmaps[i] = new Mipmap(curWasmIdx++, image);
    mipmapDescOffs += wasmTexturesIndexFieldSizes.MIPMAP_DESC_SIZE;
  }

  const texture = new Texture(texKey, wasmTexIdx, mipmaps);

  return texture;
};

export { Texture, Mipmap, initTextureWasmView };
