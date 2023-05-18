import { BitImageRGBA, BPP } from '../assets/images/bitImageRGBA';
import { WasmViews} from '../wasmEngine/wasmViews';
import { images } from '../../assets/build/images';

const loadTexture = (wasmViews: WasmViews, imageName: string): BitImageRGBA => {
  const imagesList = Object.values(images);

  const imageIdx = imagesList.findIndex((value) => {
    return value === imageName;
  });

  if (imageIdx === -1) {
    throw new Error(`image ${imageName} not found`)
  }

  const numImages = imagesList.length;
  const imagesIndex = wasmViews.imagesIndex;
  const offsets_offset = 0; // image pixel offsets
  const widths_offset = offsets_offset + numImages;
  const heights_offset = widths_offset + numImages;

  const offset = imagesIndex[offsets_offset + imageIdx];
  const width = imagesIndex[widths_offset + imageIdx];
  const height = imagesIndex[heights_offset + imageIdx];

  const imagesPixels = wasmViews.imagesPixels;

  const bitImage = new BitImageRGBA();
  bitImage.Width = width;
  bitImage.Height = height;
  bitImage.Buf8 = new Uint8Array(imagesPixels, offset, width * height * BPP);

  return bitImage;
} 

export { loadTexture };
