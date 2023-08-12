import assert from 'assert';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { ascImportImages } from '../../../assets/build/images';
import { gWasmView, gWasmViews } from '../wasmEngine/wasmRun';
import { wasmTexFieldSizes } from '../wasmEngine/wasmMemInitImages';

class Texture {
  constructor(
    private texId: number,
    private mipmaps: BitImageRGBA[],
  ) {}

  getMipmap(lvl: number): BitImageRGBA {
    // assert(lvl >= 0 && lvl < this.mipmaps.length);
    return this.mipmaps[lvl];
  }

  get Mipmaps(): BitImageRGBA[] {
    return this.mipmaps;
  }

  get NumMipmaps(): number {
    return this.mipmaps.length;
  }

  get TexId(): number {
    return this.texId;
  }

  set TexId(texId: number) {
    this.texId = texId;
  }

  makeDarker() {
    this.mipmaps.forEach((mipmap) => {
      mipmap.makeDarker();
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
      wasmTexFieldSizes.PITCH_LG2_FIELD_SIZE,
    true,
  );

  const imageBuf8 = new Uint8Array(
    gWasmViews.texturesPixels.buffer,
    gWasmViews.texturesPixels.byteOffset + pixelsOffs,
    height * pitch * BPP_RGBA,
  );

  const mipmap = new BitImageRGBA();
  mipmap.initPitchLg2(width, height, pitchLg2, imageBuf8);

  return mipmap;
}

const initTexLightDarkPair = (
  texId: number,
  darkTexId: number,
): [Texture, Texture] => {
  const tex = initTexture(texId);
  const darkTex = initTexture(darkTexId);

  return [tex, darkTex];
};

const initTexture = (texId: number): Texture => {
  assert(texId >= 0 && texId < Object.keys(ascImportImages).length);

  const texDescOffs =
    gWasmViews.texturesIndex.byteOffset +
    texId * wasmTexFieldSizes.TEX_DESC_SIZE;

  const numMipmaps = gWasmView.getUint32(texDescOffs, true);

  const firstMipmapDescOffRelIdx = gWasmView.getUint32(
    texDescOffs + wasmTexFieldSizes.NUM_MIPS_FIELD_SIZE,
    true,
  );

  let mipmapDescOffs =
    gWasmViews.texturesIndex.byteOffset + firstMipmapDescOffRelIdx;

  const mipmaps: BitImageRGBA[] = new Array(numMipmaps);

  for (let i = 0; i < numMipmaps; i++) {
    mipmaps[i] = wasmMipmap2BitImageRGBAView(mipmapDescOffs);
    mipmapDescOffs += wasmTexFieldSizes.MIP_DESC_SIZE;
  }

  const texture = new Texture(texId, mipmaps);

  return texture;
};

export { Texture, initTexture, initTexLightDarkPair };
