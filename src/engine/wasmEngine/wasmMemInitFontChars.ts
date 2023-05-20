import assert from 'assert';
import { FONT_X_SIZE, fontChars } from '../../assets/fonts/font';

function copyFontChars2WasmMem(fontCharsView: Uint8Array) {
  assert(FONT_X_SIZE === 8);
  let offset = 0;
  for (let ch of fontChars) {
    const chBitmap = new Uint8Array(ch);
    fontCharsView.set(chBitmap, offset);
    offset += chBitmap.byteLength;
  }
}

export { copyFontChars2WasmMem };
