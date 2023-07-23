import assert from 'assert';
import { BitImage } from './bitImage';
import { BPP_RGBA, FrameColorRGBA } from '../../frameColorRGBA';
import * as utils from '../../utils';

class BitImageRGBA extends BitImage {
  private pitchLg2: number; // lg2 of pitch pixels u32
  private buf32: Uint32Array;

  init(width: number, height: number, buf8: Uint8Array) {
    this.width = width;
    this.height = height;
    this.Buf8 = buf8;
    this.resizePitchPow2();
    assert(this.width <= 1 << this.PitchLg2);
  }

  initPitchLg2(
    width: number,
    height: number,
    pitchLg2: number,
    buf8: Uint8Array,
  ) {
    this.width = width;
    this.height = height;
    this.pitchLg2 = pitchLg2;
    this.Buf8 = buf8;
    assert(this.width <= 1 << this.PitchLg2);
  }

  private resizePitchPow2() {
    let pitch = this.width;
    if (!utils.isPowerOf2(pitch)) {
      pitch = utils.nextPowerOf2(pitch);
      const dstBuf8 = new Uint8Array(this.height * pitch * BPP_RGBA);
      let srcOffset = 0;
      let dstOffset = 0;
      const srcPitchBytes = this.width * BPP_RGBA;
      const dstPitchBytes = pitch * BPP_RGBA;
      for (let y = 0; y < this.height; ++y) {
        const srcRowY = this.buf8.subarray(
          srcOffset,
          srcOffset + srcPitchBytes,
        );
        dstBuf8.set(srcRowY, dstOffset);
        srcOffset += srcPitchBytes;
        dstOffset += dstPitchBytes;
      }
      this.Buf8 = dstBuf8;
    }
    this.pitchLg2 = Math.log2(pitch);
  }

  get PitchLg2() {
    return this.pitchLg2;
  }

  get Buf8() {
    return this.buf8;
  }

  set Buf8(p: Uint8Array) {
    this.buf8 = p;
    this.buf32 = new Uint32Array(
      this.buf8.buffer,
      this.buf8.byteOffset,
      this.buf8.byteLength / BPP_RGBA,
    );
  }

  get Buf32() {
    return this.buf32;
  }

  makeDarker() {
    const buf32 = this.Buf32;
    for (let i = 0; i < buf32.length; ++i) {
      // png texels are stored in rgba, read as abgr due to little endian
      const c = buf32[i]; // abgr
      const a = (c >> 24) & 0xff;
      const b = (c >> 16) & 0xff;
      const g = (c >> 8) & 0xff;
      const r = c & 0xff;
      const r2 = (r * 3) >> 2;
      const g2 = (g * 3) >> 2;
      const b2 = (b * 3) >> 2;
      const a2 = a;
      // stored as abgr, bytes swapped by endian, read as abgr
      buf32[i] = FrameColorRGBA.colorABGR(a2, b2, g2, r2);
    }
  }
}

export { BitImageRGBA, BPP_RGBA };
