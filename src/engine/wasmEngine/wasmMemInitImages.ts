import { images as sourceImgs } from '../../assets/images/imagesList';
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

function writeImages(
  images: BitImage[],
  wasmImagesPixels: Uint8Array,
  wasmImagesIndex: Uint32Array,
) {
  const numImages = images.length;
  const PTR_2_IMGS_OFFS = 0;
  const WIDTHS_OFFS = PTR_2_IMGS_OFFS + numImages;
  const HEIGHTS_OFFS = WIDTHS_OFFS + numImages;
  let imgOffset = 0;
  for (let i = 0; i < images.length; ++i) {
    // Atomics.store(imageIndex, i, imagesOffsets[i]);
    const image = images[i];
    wasmImagesIndex[WIDTHS_OFFS + i] = image.Width;
    wasmImagesIndex[HEIGHTS_OFFS + i] = image.Height;
    wasmImagesIndex[PTR_2_IMGS_OFFS + i] = imgOffset;
    wasmImagesPixels.set(image.Pixels, imgOffset);
    imgOffset += image.Pixels.length;
  }
}

export { getImagesIndexSize, writeImages };
