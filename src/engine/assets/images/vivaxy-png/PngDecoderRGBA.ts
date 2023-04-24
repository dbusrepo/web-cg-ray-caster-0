import assert from 'assert';
import { decodeImageInfo, decode } from './decode';
import { BitImageRGBA } from '../bitImageRGBA';
import { COLOR_TYPES } from './helpers/color-types';
import { PngDecoder } from '../pngDecoder';
import { ImageInfo } from '../imageDecoder';

const BPP = 4;

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

  read(input: ArrayBuffer, output: BitImageRGBA): void {
    // this.checkType(input);
    const metadata = decode(input);
    const { width, height, data: sourcePixels } = metadata;
    // console.log(sourcePixels);
    output.setSize(width, height);
    switch (metadata.colorType) {
      case COLOR_TYPES.TRUE_COLOR_WITH_ALPHA:
      case COLOR_TYPES.TRUE_COLOR: // alpha = 255 in sourcePixels
        {
          // console.log(metdata.colorType);
          output.Pixels.set(sourcePixels);
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
