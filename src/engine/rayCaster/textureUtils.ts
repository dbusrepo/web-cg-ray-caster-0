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
  const { imagesIndex, imagesPixels } = wasmViews;
  // get images index region offsets (address, widths, heights)
  const address_index = 0;
  const width_index = address_index + numImages;
  const heigth_index = width_index + numImages;

  const offset = imagesIndex[address_index + imageIdx];
  const width = imagesIndex[width_index + imageIdx];
  const height = imagesIndex[heigth_index + imageIdx];

  const bitImage = new BitImageRGBA();
  bitImage.Width = width;
  bitImage.Height = height;
  bitImage.Buf8 = new Uint8Array(imagesPixels, offset, width * height * BPP);

  return bitImage;
} 

export { loadTexture };
