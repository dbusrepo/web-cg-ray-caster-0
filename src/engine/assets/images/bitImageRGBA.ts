import { BitImage } from './bitImage';

const BPP_RGBA = 4;

class BitImageRGBA extends BitImage {

  private buf32: Uint32Array;

  get Buf8() {
    return this.buf8;
  }

  set Buf8(p: Uint8Array) {
    this.buf8 = p;
    this.buf32 = new Uint32Array(this.buf8.buffer, this.buf8.byteOffset, this.buf8.byteLength / BPP_RGBA);
  }
  
  get Buf32() {
    return this.buf32;
  }

}

export { BitImageRGBA, BPP_RGBA };
