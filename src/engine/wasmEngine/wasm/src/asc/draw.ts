import { myAssert } from './myAssert';
import { rgbaSurface0ptr, rgbaSurface0width, rgbaSurface0height } from './importVars';
// import { rgbaSurface1ptr, rgbaSurface1width, rgbaSurface1height } from './importVars';
import { logi, logf } from './importVars';
import { FONT_X_SIZE, FONT_Y_SIZE, FONT_SPACING } from './importVars';
import { stringsDataPtr, fontCharsPtr } from './importVars';

const PIX_OFFS = 4;
const FRAME_ROW_LEN = rgbaSurface0width * PIX_OFFS;
const LIMIT = rgbaSurface0ptr + rgbaSurface0height * FRAME_ROW_LEN;

function clearBg(
  start: u32,
  end: u32,
  color: u32,
): void {

  const startOff: usize = rgbaSurface0ptr + start * FRAME_ROW_LEN;
  const endOff: usize = rgbaSurface0ptr + end * FRAME_ROW_LEN;

  // const startOff1: usize = rgbaSurface1ptr + start * FRAME_ROW_LEN;
  // const endOff1: usize = rgbaSurface1ptr + end * FRAME_ROW_LEN;

  // let value = v128.splat<i32>(color);
  // TODO check bounds ?
  // for (let i = startOff; i < endOff; i += 32) {
  //   v128.store(i, value);
  //   v128.store(i + 16, value);
  // }

  // TODO handle remainder elements here ?

  // let ptr1 = startOff1;
  for (let ptr = startOff; ptr < endOff; ptr += PIX_OFFS) {
    store<u32>(ptr, color);
    // store<u32>(ptr1, 0xff_00_ff_00);
    // ptr1 += PIX_OFFS;
  }

  // test first and last pixel
  // store<u32>(rgbaSurface0ptr, 0xFF_00_00_FF);
  // store<u32>(rgbaSurface0ptr + (pixelCount-1)*4, 0xFF_00_00_FF);
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

function drawText(textOffs: usize, x: i32, y: i32, scale: f32, color: u32): void {
  myAssert(x >= 0 && x < rgbaSurface0width);
  myAssert(y >= 0 && y < rgbaSurface0height);
  myAssert(scale > 0);
  myAssert(FONT_X_SIZE == 8);
  let rowPtr: usize = rgbaSurface0ptr + x * PIX_OFFS + y * FRAME_ROW_LEN;
  let startNextRow: usize = rgbaSurface0ptr + (y + 1) * FRAME_ROW_LEN;
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
          const yDelta = FONT_Y_SIZE * FRAME_ROW_LEN;
          pixPtr = nextRow + yDelta;
          if (pixPtr >= LIMIT) {
            skipRow = true;
            break;
          }
          nextRow += yDelta + FRAME_ROW_LEN; 
        }
        if (chBmpRowY & curBit) {
          myAssert(pixPtr < LIMIT);
          store<u32>(pixPtr, color);
        }
        pixPtr += PIX_OFFS;
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
      pixPtr += FONT_SPACING * PIX_OFFS;
    }
    rowPtr += FRAME_ROW_LEN;
    startNextRow += FRAME_ROW_LEN;
    inc_y += step_y;
    while (inc_y >= 1) {
      inc_y -= 1;
      font_y++;
    }
  }
}

export { clearBg, drawText }
