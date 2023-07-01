// import assert from 'assert';
import * as loadUtils from './loadUtils';
// import map0 from '../../../assets/maps/map0.txt'
import {
  // images as sourceImages,
  getImagesPaths,
} from '../../../assets/build/images';
import { loadImages } from './images/utils';
import { BitImage } from './images/bitImage';

class AssetManager {
  private images: BitImage[]; // RGBA, PAL_IDX ?
  private imagesTotalSize: number;

  public async init() {
    await this.loadImages();
  }

  private async loadImages() {
    const imageBuffers = await this.loadImageBuffers();
    const { imagesTotalSize, images } = await loadImages(imageBuffers);
    this.images = images;
    this.imagesTotalSize = imagesTotalSize;
  }

  private async loadImageBuffers(): Promise<ArrayBuffer[]> {
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

  public get Images(): BitImage[] {
    return this.images;
  }

  public get ImagesTotalSize(): number {
    return this.imagesTotalSize;
  }

}

export { AssetManager };
