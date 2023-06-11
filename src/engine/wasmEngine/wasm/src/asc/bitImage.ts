import { myAssert } from './myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from './memUtils';
import { alloc, free } from './workerHeapManager';
import { ObjectAllocator, newObjectAllocator } from './objectAllocator';
import { logi } from './importVars';
import { imagesIndexPtr, imagesIndexSize, imagesDataSize, imagesDataPtr, numImages } from './importVars';

// index fields types
type IMG_OFF_T = u32; // used for offsets to pixels
type IMG_SIZE_T = u32; // used for widths and heights
const IMG_OFF_SIZE = sizeof<IMG_OFF_T>();
const IMG_WH_SIZE = sizeof<IMG_SIZE_T>();

// index sections: offsets, widths, heights
const imgPtrsPtr: PTR_T = imagesIndexPtr;
const imgWidthsPtr = imgPtrsPtr + <usize>numImages * IMG_OFF_SIZE;
const imgHeightsPtr = imgWidthsPtr + <usize>numImages * IMG_WH_SIZE;

const imageDataPtr: PTR_T = imagesDataPtr;

// @ts-ignore: decorator
@final @unmanaged class BitImage {

  private imgIdx: usize = 0;

  init(idx: usize): void {
    myAssert(idx >= 0 && idx < numImages);
    // logi(imagesIndexPtr);
    // logi(imgWidths);
    // logi(load<IMG_SIZE_T>(imgWidthsPtr + <usize>0 * IMG_WH_SIZE));
    // logi(load<IMG_SIZE_T>(imgWidths + <usize>1 * IMG_WH_SIZE));
    this.imgIdx = idx;
  }

  @inline get Ptr(): PTR_T {
    // logi(load<IMG_OFF_T>(imgPtrsPtr + <usize>this._imgIdx * IMG_OFF_SIZE));
    return imageDataPtr + load<IMG_OFF_T>(imgPtrsPtr + <usize>this.imgIdx * IMG_OFF_SIZE);
  }

  @inline get Width(): SIZE_T {
    return load<IMG_SIZE_T>(imgWidthsPtr + <usize>this.imgIdx * IMG_WH_SIZE);
  }

  @inline get Height(): SIZE_T {
    return load<IMG_SIZE_T>(imgHeightsPtr + <usize>this.imgIdx * IMG_WH_SIZE);
  }
}

let bitImageAllocator = changetype<ObjectAllocator<BitImage>>(NULL_PTR);

function initBitImageAllocator(): void {
  bitImageAllocator = newObjectAllocator<BitImage>(16);
}

// TODO: test
function newBitImage(imgIdx: usize): BitImage {
  if (changetype<PTR_T>(bitImageAllocator) === NULL_PTR) {
    initBitImageAllocator();
  }
  const bitImage = bitImageAllocator.new();
  bitImage.init(imgIdx);
  return bitImage;
}

// TODO: test
function deleteBitImage(bitImage: BitImage): void {
  bitImageAllocator.delete(changetype<BitImage>(bitImage));
}

export { BitImage, newBitImage, deleteBitImage };
