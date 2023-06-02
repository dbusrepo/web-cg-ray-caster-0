import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

// script to generate strings.ts (for js/ts) and the asc file importStrings.ts

const FIELD_SEP = '=';

// https://bobbyhadz.com/blog/javascript-dirname-is-not-defined-in-es-module-scope#:~:text=Conclusion%20%23,directory%20name%20of%20the%20path.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// console.log('directory-name 👉️', __dirname);

const srcFile = process.argv[2];
const outFileTs = process.argv[3];
const outFileTsAsc = process.argv[4];

const checkArgs = () => {
  const invMsg = `Syntax: node ${path.basename(__filename)} <srcFile> <outFileTs> <outFileTsAsc>`;
  if (srcFile == undefined) {
    console.log(`Invocation error: source file arg required.\n${invMsg}`);
    process.exit(1);
  }
  if (outFileTs == undefined) {
    console.log(`Invocation error: out file ts arg required.\n${invMsg}`);
    process.exit(1);
  }
  if (outFileTsAsc == undefined) {
    console.log(`Invocation error: out file ts asc arg required.\n${invMsg}`);
    process.exit(1);
  }
};

checkArgs();

// example call from cli in the same dir of the script: 
// $ node preprocSringsList .res .ts ascfile.ts
// if from another dir use the rel path for the script and the other args
const IN_FILE = srcFile; // path.join(__dirname, srcFile);
const OUT_FILE = outFileTs; // path.join(__dirname, outFile);
const OUT_FILE_ASC = outFileTsAsc;

const writeOpts = {
  encoding: 'utf8',
};

const warnMsg = '// Do not modify. This file is auto generated from strings.res with make';

const stringsObjPrefix = `const strings = {`;
const stringsObjSuffix = `};\n`;

const stringsByteArrPrefix = `const stringsArrayData = new Uint8Array([`;
const stringsByteArrSuffix = `]);\n`;

// const stringsByteIndexPrefix = `const stringsArrayDataIndex = new Uint32Array([`;
// const stringsByteIndexSuffix = `]);\n`;

const ascStringsIndexesObjPrefix = `const ascImportStrings = {`;
const ascStringsIndexesObjSuffix= `};\n`;

const numStrings = `const numStrings = Object.keys(strings).length;\n`;

const suffix = 'export { numStrings, strings, stringsArrayData, ascImportStrings };';

// https://stackoverflow.com/questions/14313183/javascript-regex-how-do-i-check-if-the-string-is-ascii-only
function isASCII(str, extended) {
  return (extended ? /^[\x00-\xFF]*$/ : /^[\x00-\x7F]*$/).test(str);
}

function asciiStr2byteArrStr(str) {
  const charValues = [];
  for (let i = 0; i < str.length; i++) {
    let charValue = str.charCodeAt(i);
    charValues.push(charValue);
  }
  charValues.push('0');
  return charValues;
}

try {
  console.log(IN_FILE);
  const data = fs.readFileSync(IN_FILE, { encoding: 'utf8' });

  const lines = data.trimEnd().split(/\r?\n/); // trimeEnd removes the last newline
  console.log(lines);

  let objStringsObjBodyStr = '';
  let objStringArrBodyStr = '';
  let objStringArrIndexBodyStr = '';
  let ascStringsOffsObjBodyStr = '';
  let strOffset = 0;
  let ascIdx = 0;
  let ascImportBodyStr = '';
  let first = true;
  const strKeys = {};
  lines.forEach(line => {
    if (line.trim() == '') return;
    const fields = line.split(FIELD_SEP);
    const [strKey, str] = fields;
    if (strKeys[strKey]) {
      console.log(`String key ${strKey} duplicated ! Aborting string preprocessing...`);
      process.exit(1);
    }
    strKeys[strKey] = 1;
    if (!isASCII(str)) {
      console.log(`String ${str} is not ASCII ! Aborting string preprocessing...`);
      process.exit(1);
    }
    const newLine = first ? '':'\n';
    objStringsObjBodyStr += `${newLine}  ${strKey}: '${str}',`;
    const strByteArr = asciiStr2byteArrStr(str);
    objStringArrBodyStr += `${newLine}  ${strByteArr},`;
    // objStringArrIndexBodyStr += `${newLine}  ${strOffset},`;
    ascStringsOffsObjBodyStr += `${newLine}  ${strKey}: ${strOffset},`;
    // ascIdx++;
    strOffset += strByteArr.length;
    ascImportBodyStr += `export declare const ${strKey}: usize;\n`;
    first = false;
  });
  console.log(objStringsObjBodyStr);
  const fileStr = `${warnMsg}
${stringsObjPrefix}
${objStringsObjBodyStr}
${stringsObjSuffix}
${stringsByteArrPrefix}
${objStringArrBodyStr}
${stringsByteArrSuffix}
${ascStringsIndexesObjPrefix}
${ascStringsOffsObjBodyStr}
${ascStringsIndexesObjSuffix}
${numStrings}
${suffix}
`;
// strings index not generated
// ${stringsByteIndexPrefix}
// ${objStringArrIndexBodyStr}
// ${stringsByteIndexSuffix}

  fs.writeFileSync(OUT_FILE, fileStr, writeOpts);
  fs.writeFileSync(OUT_FILE_ASC, ascImportBodyStr, writeOpts);
} catch (err) {
  console.error(err);
}
