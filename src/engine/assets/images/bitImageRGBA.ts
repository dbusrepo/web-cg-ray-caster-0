import { BitImage } from './bitImage';

const BPP = 4;

class BitImageRGBA extends BitImage {
  protected allocPixels(): void {
    const size = BPP * this.width * this.height;
    this.pixels= new Uint8Array(size);
  }
}

export { BitImageRGBA };
