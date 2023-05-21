import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { WasmViews} from '../wasmEngine/wasmViews';
import { images } from '../../assets/build/images';

const loadTexture = (wasmViews: WasmViews, imageName: string): BitImageRGBA => {
  const imagesList = Object.values(images);

  const imageIdx = imagesList.findIndex((value) => value === imageName);

  if (imageIdx === -1) {
    throw new Error(`image ${imageName} not found`)
  }

  // get view on images index in wasm mem
  const { imagesIndex, imagesPixels } = wasmViews;

  const numImages = imagesList.length;
  // get images index regions offsets: address, widths, heights
  const address_index = 0;
  const width_index = address_index + numImages;
  const height_index = width_index + numImages;

  const imageAddress = imagesIndex[address_index + imageIdx];
  const imageWidth = imagesIndex[width_index + imageIdx];
  const imageHeight = imagesIndex[height_index + imageIdx];

  const bitImage = new BitImageRGBA();
  bitImage.Width = imageWidth;
  bitImage.Height = imageHeight;
  bitImage.Buf8 = new Uint8Array(imagesPixels.buffer, // wasm memory buffer
                                 imagesPixels.byteOffset + imageAddress, 
                                 imageWidth * imageHeight * BPP_RGBA);

  return bitImage;
} 

export { loadTexture };
