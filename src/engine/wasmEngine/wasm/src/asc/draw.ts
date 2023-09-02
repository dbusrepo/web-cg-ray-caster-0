import { myAssert } from './myAssert';
import { PTR_T, SIZE_T, NULL_PTR } from './memUtils';
import { rgbaSurface0ptr, rgbaSurface0width, rgbaSurface0height } from './importVars';
import { BPP_RGBA } from './frameColorRGBA';
// import { rgbaSurface1ptr, rgbaSurface1width, rgbaSurface1height } from './importVars';
import { logi, logf } from './importVars';
import { FONT_X_SIZE, FONT_Y_SIZE, FONT_SPACING } from './importVars';
import { stringsDataPtr, fontCharsPtr } from './importVars';

const FRAME_WIDTH = rgbaSurface0width as SIZE_T;
const FRAME_HEIGHT = rgbaSurface0height as SIZE_T;
const FRAME_STRIDE: SIZE_T = FRAME_WIDTH * BPP_RGBA;
const LIMIT = rgbaSurface0ptr + FRAME_HEIGHT * FRAME_STRIDE;

function clearBg(
  start: usize,
  end: usize,
  color: u32,
): void {

  const startPtr: PTR_T = rgbaSurface0ptr + start * FRAME_STRIDE;
  const endPtr: PTR_T = rgbaSurface0ptr + end * FRAME_STRIDE;
  const numPixels = FRAME_STRIDE * (end - start);

  // // const numPixels16 = numPixels / 16;
  const value = v128.splat<i32>(color);
  for (let framePtr = startPtr; framePtr < endPtr; framePtr += 16) {
    v128.store(framePtr, value);
  }

  // // const numPixels32 = numPixels / 32;
  // const value = v128.splat<i32>(color);
  // for (let framePtr = startPtr; framePtr < endPtr; framePtr += 32) {
  //   v128.store(framePtr, value);
  //   v128.store(framePtr + 16, value);
  // }

  // for (let framePtr = startPtr; framePtr < endPtr; framePtr += BPP_RGBA) {
  //   store<u32>(framePtr, color);
  // }

  // memory.fill(startOff, 0x00, endOff - startOff);

  // test first and last pixel
  // store<u32>(rgbaSurface0ptr, 0xFF_00_00_FF);
  // store<u32>(rgbaSurface0ptr + endPtr - BPP_RGBA, 0xFF_00_00_FF);
}

// export function clearCanvasVec(rgbaSurface0ptr: i32): void {
//     const value = 0xff_00_00_00;
//     let limit = rgbaSurface0ptr + pixelCount*4;
//     for (let i: i32 = rgbaSurface0ptr; i != limit; i+=16) {
//         store<u32>(i, value);
//         store<u32>(i+4, value);
//         store<u32>(i+8, value);
//         store<u32>(i+12, value);
//     }
// }

function drawText(textOffs: usize, x: u32, y: u32, scale: f32, color: u32): void {
  myAssert(x >= 0 && x < rgbaSurface0width);
  myAssert(y >= 0 && y < rgbaSurface0height);
  myAssert(scale > 0);
  myAssert(FONT_X_SIZE == 8);
  let rowPtr: usize = rgbaSurface0ptr + x * BPP_RGBA + y * FRAME_STRIDE;
  let startNextRow: usize = rgbaSurface0ptr + (y + 1) * FRAME_STRIDE;
  const step_y = f32(1) / scale;
  let inc_y = f32(0);
  for (let font_y = usize(0); font_y < FONT_Y_SIZE && rowPtr < LIMIT; ) {
    const bmpRowYPtr = fontCharsPtr + font_y;
    let pixPtr = rowPtr;
    let chPtr = stringsDataPtr + textOffs;
    let nextRow = startNextRow;
    let ch: u8;
    while (ch = load<u8>(chPtr++)) {
      const chBmpRowY = load<u8>(bmpRowYPtr + ch * FONT_Y_SIZE);
      let skipRow = false;
      const step_x = f32(1) / scale;
      let inc_x = f32(0);
      for (let font_x = usize(0), curBit: u8 = 0x80; font_x < FONT_X_SIZE; ) {
        // if we go over the rightmost col skip FONT_Y_SIZE rows
        if (pixPtr >= nextRow) {
          const yDelta = FONT_Y_SIZE * FRAME_STRIDE;
          pixPtr = nextRow + yDelta;
          if (pixPtr >= LIMIT) {
            skipRow = true;
            break;
          }
          nextRow += yDelta + FRAME_STRIDE; 
        }
        if (chBmpRowY & curBit) {
          myAssert(pixPtr < LIMIT);
          store<u32>(pixPtr, color);
        }
        pixPtr += BPP_RGBA;
        inc_x += step_x;
        while (inc_x >= 1) {
          inc_x -= 1;
          font_x++;
          curBit >>= 1;
        }
      }
      if (skipRow) {
        break;
      }
      pixPtr += FONT_SPACING * BPP_RGBA;
    }
    rowPtr += FRAME_STRIDE;
    startNextRow += FRAME_STRIDE;
    inc_y += step_y;
    while (inc_y >= 1) {
      inc_y -= 1;
      font_y++;
    }
  }
}

export { clearBg, drawText }
