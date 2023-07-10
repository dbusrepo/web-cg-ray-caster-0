import { BitImageRGBA, BPP_RGBA } from './images/bitImageRGBA';

function genNextMipLevelRGBA(curMip: BitImageRGBA) {
  const { Width: srcWidth, Height: srcHeight, Buf8: srcBuf8 } = curMip;
  const nextWidth = Math.max(1, srcWidth >> 1);
  const nextHeight = Math.max(1, srcHeight >> 1);
  const nextBuf8 = new Uint8Array(nextWidth * nextHeight * BPP_RGBA);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const mixPixels = (a: Uint8Array, b: Uint8Array, t: number) => a.map((v, i) => lerp(v, b[i], t));

  const getSrcPixel = (x: number, y: number) => {
    const offset = (x + y * srcWidth) * BPP_RGBA;
    return srcBuf8.subarray(offset, offset + BPP_RGBA);
  };

  let dstOffset = 0;
  for (let y = 0; y < nextHeight; ++y) {
    for (let x = 0; x < nextWidth; ++x) {
      // texcoords of the center texel next mip
      const u = (x + .5) / nextWidth;
      const v = (y + .5) / nextHeight;
      // same texcoords in current mip - 0.5 for centering
      const au = (u * srcWidth - .5);
      const av = (v * srcHeight - .5);
      // src top left pixel
      const tx = au | 0;
      const ty = av | 0;
      // mix amounts between src pixels
      const t1 = au % 1;
      const t2 = av % 1;
      // get the 4 pixels
      const p00 = getSrcPixel(tx, ty);
      const p10 = getSrcPixel(tx + 1, ty);
      const p01 = getSrcPixel(tx, ty + 1);
      const p11 = getSrcPixel(tx + 1, ty + 1);
      // bilinear filtering
      // interpolate horizontally
      const p0 = mixPixels(p00, p10, t1);
      const p1 = mixPixels(p01, p11, t1);
      // interpolate vertically
      const p = mixPixels(p0, p1, t2);
      // write to next mip
      nextBuf8.set(p, dstOffset);
      dstOffset += BPP_RGBA;
    }
  }

  const nextMip = new BitImageRGBA();
  nextMip.init(nextWidth, nextHeight, nextBuf8);
  return nextMip;
}

class AssetTextureRGBA {
  private levels: BitImageRGBA[];

  constructor(image: BitImageRGBA, generateMipmaps: boolean) {
    this.levels = new Array();
    this.levels.push(image);
    if (generateMipmaps) {
      this.generateMipmaps();
    }
  }

  get PixelsDataSize(): number {
    return this.levels.reduce((acc, cur) => acc + cur.Buf8.length, 0);
  }

  get Levels(): BitImageRGBA[] {
    return this.levels;
  }

  private generateMipmaps() {
    let mip = this.levels[0];
    while (mip.Width > 1 || mip.Height > 1) {
      mip = genNextMipLevelRGBA(mip);
      this.levels.push(mip);
    }
  }
}

export { AssetTextureRGBA };
