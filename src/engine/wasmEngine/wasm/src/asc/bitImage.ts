import { myAssert } from './myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from './memUtils';
import { alloc, free } from './workerHeapManager';
import { ObjectAllocator, newObjectAllocator } from './objectAllocator';
import { logi } from './importVars';
import { usePalette, imagesIndexPtr, imagesIndexSize, imagesDataSize, imagesDataPtr, numImages } from './importVars';

// index fields types
type IMG_OFF_T = u32; // used for offsets to pixels
type IMG_SIZE_T = u32; // used for widths and heights
const IMG_OFF_SIZE = sizeof<IMG_OFF_T>();
const IMG_WH_SIZE = sizeof<IMG_SIZE_T>();

// index sections: offsets, widths, heights
const imgPtrsPtr: PTR_T = imagesIndexPtr;
const imgWidths = imgPtrsPtr + <usize>numImages * IMG_OFF_SIZE;
const imgHeights = imgWidths + <usize>numImages * IMG_WH_SIZE;

const imageDataPtr: PTR_T = imagesDataPtr;

// @ts-ignore: decorator
@final @unmanaged class BitImage {

  private imgIdx: usize = 0;

  init(idx: usize): void {
    myAssert(idx >= 0 && idx < numImages);
    this.imgIdx = idx;
  }

  @inline get pixels(): PTR_T {
    // logi(load<IMG_OFF_T>(imgPtrsPtr + <usize>this._imgIdx * IMG_OFF_SIZE));
    return imageDataPtr + load<IMG_OFF_T>(imgPtrsPtr + <usize>this.imgIdx * IMG_OFF_SIZE);
  }

  @inline get width(): SIZE_T {
    return load<IMG_SIZE_T>(imgWidths + <usize>this.imgIdx * IMG_WH_SIZE);
  }

  @inline get height(): SIZE_T {
    return load<IMG_SIZE_T>(imgHeights + <usize>this.imgIdx * IMG_WH_SIZE);
  }
}

let bitImageAlloc = changetype<ObjectAllocator<BitImage>>(NULL_PTR);

function initBitImageAllocator(): void {
  bitImageAlloc = newObjectAllocator<BitImage>(16);
}

// TODO: test
function newBitImage(imgIdx: usize): BitImage {
  if (changetype<PTR_T>(bitImageAlloc) === NULL_PTR) {
    initBitImageAllocator();
  }
  const bitImage = bitImageAlloc.new();
  bitImage.init(imgIdx);
  return bitImage;
}

export { BitImage, newBitImage };
