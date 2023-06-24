import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { gWasmRun } from '../wasmEngine/wasmRun';
import { images } from '../../../assets/build/images';

const loadImage = (image: string): BitImageRGBA => {
  const imagesList = Object.values(images);

  const imageIdx = imagesList.findIndex((value) => value === image);

  if (imageIdx === -1) {
    throw new Error(`image ${image} not found`)
  }

  // get view on images index in wasm mem
  const { imagesIndex, imagesPixels } = gWasmRun.WasmViews;

  const { length: numImages } = imagesList;

  // get images index regions offsets: address, widths, heights
  const address_index = 0;
  const width_index = address_index + numImages;
  const height_index = width_index + numImages;

  const imageAddress = imagesIndex[address_index + imageIdx];
  const imageWidth = imagesIndex[width_index + imageIdx];
  const imageHeight = imagesIndex[height_index + imageIdx];


  const imageBuf8 = new Uint8Array(imagesPixels.buffer,
                                 imagesPixels.byteOffset + imageAddress, 
                                 imageWidth * imageHeight * BPP_RGBA);

  const bitImage = new BitImageRGBA();
  bitImage.init(imageWidth, imageHeight, imageBuf8);

  return bitImage;
};

export { loadImage };
