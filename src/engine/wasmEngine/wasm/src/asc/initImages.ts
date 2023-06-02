import { imagesIndexPtr, numImages } from './importVars';
import { BitImage } from './bitImage';
import { logi } from './importVars';
import { SArray, newSArray } from './sarray';
import { PTR_T, SIZE_T } from './memUtils';

function initImages(): SArray<BitImage> {
  const bitImages = newSArray<BitImage>(numImages);
  for (let i: usize = 0; i < numImages; i++) {
    const image = bitImages.at(i);
    image.init(i);
  }
  return bitImages;
}

export { initImages };
