import assert from 'assert';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { ascImportImages } from '../../../assets/build/images';
import { gWasmView, gWasmViews } from './wasmRun';
import { wasmTexFieldSizes } from './wasmMemInitImages';

class Mipmap {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private mipMapWasmIdx: number, // wasm index in mipmaps array
    private image: BitImageRGBA,
  ) {}

  get WasmIdx(): number {
    return this.mipMapWasmIdx;
  }

  get Image(): BitImageRGBA {
    return this.image;
  }
}

// view to wasm texture/mipmaps
class Texture {
  // eslint-disable-next-line no-useless-constructor
  constructor(
    private texName: string,
    private texIdx: number,
    private mipmaps: Mipmap[],
  ) {}

  getMipmap(lvl: number): Mipmap {
    // assert(lvl >= 0 && lvl < this.mipmaps.length);
    return this.mipmaps[lvl];
  }

  get NumMipmaps(): number {
    return this.mipmaps.length;
  }

  get WasmIdx(): number {
    return this.texIdx;
  }

  get Name(): string {
    return this.texName;
  }

  makeDarker() {
    this.mipmaps.forEach((mipmap) => {
      mipmap.Image.makeDarker();
    });
  }
}

function wasmMipmap2BitImageRGBAView(mipmapOffs: number): BitImageRGBA {
  const width = gWasmView.getUint32(mipmapOffs, true);

  const height = gWasmView.getUint32(
    mipmapOffs + wasmTexFieldSizes.WIDTH_FIELD_SIZE,
    true,
  );

  const pitchLg2 = gWasmView.getUint32(
    mipmapOffs +
      wasmTexFieldSizes.WIDTH_FIELD_SIZE +
      wasmTexFieldSizes.HEIGHT_FIELD_SIZE,
    true,
  );
  const pitch = 1 << pitchLg2;

  const pixelsOffs = gWasmView.getUint32(
    mipmapOffs +
      wasmTexFieldSizes.WIDTH_FIELD_SIZE +
      wasmTexFieldSizes.HEIGHT_FIELD_SIZE +
      wasmTexFieldSizes.LG2_PITCH_FIELD_SIZE,
    true,
  );

  const imageBuf8 = new Uint8Array(
    gWasmViews.texturesPixels.buffer,
    gWasmViews.texturesPixels.byteOffset + pixelsOffs,
    height * pitch * BPP_RGBA,
  );

  const mipmap = new BitImageRGBA();
  mipmap.initLg2Pitch(width, height, pitchLg2, imageBuf8);

  return mipmap;
}

const initTextureWasm = (
  texName: string,
  texIdx: number,
  mipMapBaseIdx: number,
): Texture => {
  assert(texIdx >= 0 && texIdx < Object.keys(ascImportImages).length);

  const texDescOffs =
    gWasmViews.texturesIndex.byteOffset +
    texIdx * wasmTexFieldSizes.TEX_DESC_SIZE;

  const numMipmaps = gWasmView.getUint32(texDescOffs, true);

  const firstMipmapDescOffRelIdx = gWasmView.getUint32(
    texDescOffs + wasmTexFieldSizes.NUM_MIPS_FIELD_SIZE,
    true,
  );

  let mipmapDescOffs =
    gWasmViews.texturesIndex.byteOffset + firstMipmapDescOffRelIdx;

  const mipmaps: Mipmap[] = new Array(numMipmaps);

  for (let i = 0; i < numMipmaps; i++) {
    const image = wasmMipmap2BitImageRGBAView(mipmapDescOffs);
    mipmaps[i] = new Mipmap(mipMapBaseIdx + i, image);
    mipmapDescOffs += wasmTexFieldSizes.MIP_DESC_SIZE;
  }

  const texture = new Texture(texName, texIdx, mipmaps);

  return texture;
};

export { Texture, Mipmap, initTextureWasm };
