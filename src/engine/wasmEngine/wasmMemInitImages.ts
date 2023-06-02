import { images as sourceImgs } from '../../../assets/build/images';
import { BitImage } from './../assets/images/bitImage';

// IMAGES REGION LAYOUT:

// INDEX with images ptrs and sizes, IMAGES data (pixels)
// INDEX LAYOUT: offsets to images start, widths, heights (32bit each)
// offsets to images wrt to image data start

// field sizes
const OFFS_IMG_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const WIDTH_SIZE = Uint32Array.BYTES_PER_ELEMENT;
const HEIGHT_SIZE = Uint32Array.BYTES_PER_ELEMENT;

function getImagesIndexSize() {
  const numImages = Object.keys(sourceImgs).length;
  return (OFFS_IMG_SIZE + WIDTH_SIZE + HEIGHT_SIZE) * numImages;
}

function copyImages2WasmMem(
  images: BitImage[],
  imagesIndex: Uint32Array,
  imagesPixels: Uint8Array,
) {
  const { length: numImages } = images;
  const address_index = 0;
  const width_index = address_index + numImages;
  const height_index = width_index + numImages;
  let imageAddress = 0;
  for (let i = 0, { length } = images; i < length; ++i) {
    // Atomics.store(imageIndex, i, imagesOffsets[i]);
    const image = images[i];
    imagesIndex[width_index + i] = image.Width;
    imagesIndex[height_index + i] = image.Height;
    imagesIndex[address_index + i] = imageAddress;
    imagesPixels.set(image.Buf8, imageAddress);
    imageAddress += image.Buf8.length;
  }
}

export { getImagesIndexSize, copyImages2WasmMem };
