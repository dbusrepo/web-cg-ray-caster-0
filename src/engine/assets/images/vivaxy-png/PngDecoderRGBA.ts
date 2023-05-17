import assert from 'assert';
import { decodeImageInfo, decode } from './decode';
import { BitImageRGBA, BPP } from '../bitImageRGBA';
import { COLOR_TYPES } from './helpers/color-types';
import { PngDecoder } from '../pngDecoder';
import { ImageInfo } from '../imageDecoder';

class PngDecoderRGBA implements PngDecoder {
  readInfo(input: ArrayBuffer): ImageInfo {
    // this.checkType(input);
    const imgInfo = decodeImageInfo(input);
    const depth = imgInfo[2];
    assert(depth === 8);
    return {
      width: imgInfo[0],
      height: imgInfo[1],
      depth: imgInfo[2],
      bpp: BPP,
    };
  }

  read(input: ArrayBuffer, outImage: BitImageRGBA): void {
    // this.checkType(input);
    const metadata = decode(input);
    const { width, height, data: sourcePixels } = metadata;
    // console.log(sourcePixels);
    outImage.Width = width;
    outImage.Height = height;
    const imageBuffer = new Uint8Array(width * height * BPP);
    switch (metadata.colorType) {
      case COLOR_TYPES.TRUE_COLOR_WITH_ALPHA:
      case COLOR_TYPES.TRUE_COLOR: // alpha = 255 in sourcePixels
        {
          // console.log(metdata.colorType);
          imageBuffer.set(sourcePixels);
          outImage.Buf8 = imageBuffer;
        }
        break;
      // TODO other color types ?
      default:
        throw new Error(
          `PngDecoderRGBA read: color type ${metadata.colorType} not supported`,
        );
    }
  }

  // private checkType(input: ArrayBuffer): void {
  //   const [bitDepth, colorType] = decodeColorInfo(input);
  //   assert(bitDepth === 8);
  //   console.log(colorType);
  //   assert(colorType === COLOR_TYPES.TRUE_COLOR);
  // }

  // const [bitDepth, colorType] = decodeColorInfo(input);
  // assert(bitDepth === 8);
  // switch (colorType) {
  //   case COLOR_TYPES.TRUE_COLOR_WITH_ALPHA:
  //   case COLOR_TYPES.TRUE_COLOR:
  //     return [...sizes, 4]; // then we map rgb to rgba with alpha 255
  //   // break;
  //   // TODO other color types ?
  //   default:
  //     throw new Error(
  //       `PngDecoderRGBA readSizes: color type ${colorType} not supported`,
  //     );
}

export { PngDecoderRGBA };
