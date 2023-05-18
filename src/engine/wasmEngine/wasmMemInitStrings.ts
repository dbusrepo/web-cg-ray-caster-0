import { stringsArrayData } from '../../assets/build/strings';

// STRINGS REGION LAYOUT:

// INDEX with for each str an offset to that string starting from the string
// data, strings data
// Note: strings are null terminated

// index to strings not used
// // note: ptrs to strings in the index are 32bit long
// function getStringsIndexSize() {
//   return stringsArrayDataIndex.byteLength;
// }

function writeStringsData(stringsView: Uint8Array) {
  // stringsIndexView.set(stringsArrayDataIndex);
  stringsView.set(stringsArrayData);
}

export { writeStringsData };
