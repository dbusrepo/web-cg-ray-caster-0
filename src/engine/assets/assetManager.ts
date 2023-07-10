// import assert from 'assert';
import * as loadUtils from './loadUtils';
// import map0 from '../../../assets/maps/map0.txt'
import {
  // images as sourceImages,
  getImagesPaths,
} from '../../../assets/build/images';
import { decodePNGs } from './images/utils';
import { BitImageRGBA, BPP_RGBA } from './images/bitImageRGBA';
import { AssetTextureRGBA } from './assetTextureRGBA';

type AssetManagerParams = {
  generateMipmaps: boolean;
}

class AssetManager {
  private params: AssetManagerParams;
  private textures: AssetTextureRGBA[];

  public async init(params: AssetManagerParams) {
    this.params = params;
    await this.loadTextures();
  }

  private async loadTextures() {
    const imageBuffers = await this.loadImagesBuffers();
    const bitImagesRGBA = await decodePNGs(imageBuffers);
    this.textures = bitImagesRGBA.map((bitImage) => {
      return new AssetTextureRGBA(bitImage, this.params.generateMipmaps);
    });
  }

  private async loadImagesBuffers(): Promise<ArrayBuffer[]> {
    const imagesPaths = await getImagesPaths();
    // assert(imagesPaths.length === Object.keys(sourceImages).length);
    const imageBuffers = await Promise.all(
      imagesPaths.map(async (url: string) => loadUtils.loadResAsArrayBuffer(url)),
    );
    return imageBuffers;
    // test load res file as text
    // const resFile = (await import('../assets/images/images.res')).default;
    // console.log('RES HERE: ', await loadUtils.loadResAsText(resFile));
  }

  public get Textures(): AssetTextureRGBA[] {
    return this.textures;
  }

  public get NumTextures(): number {
    return this.textures.length;
  }

  public get PixelsDataSize(): number {
    return this.textures.reduce((acc, texture) => acc + texture.PixelsDataSize, 0);
  }

  public get GenerateMipmaps(): boolean {
    return this.params.generateMipmaps;
  }
}

export { AssetManager };
