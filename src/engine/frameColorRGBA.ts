const RGBA_RED_SHIFT = 24;
const RGBA_GREEN_SHIFT = 16;
const RGBA_BLUE_SHIFT = 8;
const RGBA_ALPHA_SHIFT = 0;

const ABGR_ALPHA_SHIFT = 24;
const ABGR_BLUE_SHIFT = 16;
const ABGR_GREEN_SHIFT = 8;
const ABGR_RED_SHIFT = 0;

const BPP_RGBA = 4;

abstract class FrameColorRGBA {
  static colorABGR(a: number, b: number, g: number, r: number): number {
    return (
      (a << ABGR_ALPHA_SHIFT) |
      (b << ABGR_BLUE_SHIFT) |
      (g << ABGR_GREEN_SHIFT) |
      r
    );
  }

  // RGBA -> ABGR
  static colorRGBAtoABGR(color: number): number {
    const r = (color >> 24) & 0xff;
    const g = (color >> 16) & 0xff;
    const b = (color >> 8) & 0xff;
    const a = color & 0xff;
    return FrameColorRGBA.colorABGR(a, b, g, r);
  }

  static randColorABGR(): number {
    const a = 0xff;
    const b = (Math.random() * 255) | 0;
    const g = (Math.random() * 255) | 0;
    const r = (Math.random() * 255) | 0;
    return FrameColorRGBA.colorABGR(a, b, g, r);
  }

  abstract lightColorABGR(colorABGR: number, intensity: number): number;

  abstract fogColorABGR(colorABGR: number, intensity: number): number;

  abstract lightPixel(
    frameBuffer: Uint32Array,
    pColor: number,
    intensity: number,
  ): void;

  abstract fogPixel(
    frameBuffer: Uint32Array,
    pColor: number,
    intensity: number,
  ): void;
}

export {
  FrameColorRGBA,
  RGBA_RED_SHIFT,
  RGBA_GREEN_SHIFT,
  RGBA_BLUE_SHIFT,
  RGBA_ALPHA_SHIFT,
  ABGR_ALPHA_SHIFT,
  ABGR_BLUE_SHIFT,
  ABGR_GREEN_SHIFT,
  ABGR_RED_SHIFT,
  BPP_RGBA,
};
