// Created: 2026-08-26 UTC

/**
 * A minimal ZIP container writer/reader, STORE method only (no compression).
 *
 * The export service used to hand out `.epub` and `.docx` files that were
 * plain text made to *look* like a zip's local-file-header strings — not a
 * real archive, so no reader could open them. Both formats are just a zip
 * container around a handful of small XML parts, and STORE (uncompressed)
 * entries are a fully spec-compliant way to write one: real EPUB and DOCX
 * readers accept stored entries the same as deflated ones. This avoids
 * pulling in a compression dependency for files that are a few kilobytes at
 * most.
 *
 * `readZipEntries` exists so the parts this module writes can be verified by
 * reading them back, rather than trusting the writer against its own byte
 * offsets.
 */

const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const VERSION_NEEDED_TO_EXTRACT = 20;
const STORE_METHOD = 0;

const LOCAL_FILE_HEADER_SIZE = 30;
const CENTRAL_DIRECTORY_HEADER_SIZE = 46;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;

export interface ZipEntry {
  path: string;
  data: Buffer;
}

const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }

  return table;
}

export function crc32(data: Buffer): number {
  let crc = 0xffffffff;

  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Write a set of entries as a real, spec-compliant ZIP archive: a local file
 * header + data per entry, followed by the central directory and the end
 * record every reader locates the directory through.
 *
 * Entries are written in the order given, which matters for EPUB: its `mimetype`
 * entry has to be first and uncompressed for a conforming reader to recognize
 * the container without reading the rest of the archive.
 */
export function buildZipArchive(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.path, 'utf8');
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const localHeader = Buffer.alloc(LOCAL_FILE_HEADER_SIZE);
    localHeader.writeUInt32LE(LOCAL_FILE_HEADER_SIGNATURE, 0);
    localHeader.writeUInt16LE(VERSION_NEEDED_TO_EXTRACT, 4);
    localHeader.writeUInt16LE(0, 6); // general purpose bit flag
    localHeader.writeUInt16LE(STORE_METHOD, 8);
    localHeader.writeUInt16LE(0, 10); // last mod file time
    localHeader.writeUInt16LE(0, 12); // last mod file date
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18); // compressed size == uncompressed size for STORE
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    localParts.push(localHeader, nameBytes, entry.data);

    const centralHeader = Buffer.alloc(CENTRAL_DIRECTORY_HEADER_SIZE);
    centralHeader.writeUInt32LE(CENTRAL_DIRECTORY_SIGNATURE, 0);
    centralHeader.writeUInt16LE(VERSION_NEEDED_TO_EXTRACT, 4); // version made by
    centralHeader.writeUInt16LE(VERSION_NEEDED_TO_EXTRACT, 6); // version needed to extract
    centralHeader.writeUInt16LE(0, 8); // general purpose bit flag
    centralHeader.writeUInt16LE(STORE_METHOD, 10);
    centralHeader.writeUInt16LE(0, 12); // last mod file time
    centralHeader.writeUInt16LE(0, 14); // last mod file date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // file comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header

    centralParts.push(centralHeader, nameBytes);

    offset += LOCAL_FILE_HEADER_SIZE + nameBytes.length + size;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralDirectoryOffset = offset;

  const endRecord = Buffer.alloc(END_OF_CENTRAL_DIRECTORY_SIZE);
  endRecord.writeUInt32LE(END_OF_CENTRAL_DIRECTORY_SIGNATURE, 0);
  endRecord.writeUInt16LE(0, 4); // number of this disk
  endRecord.writeUInt16LE(0, 6); // disk where central directory starts
  endRecord.writeUInt16LE(entries.length, 8); // central directory records on this disk
  endRecord.writeUInt16LE(entries.length, 10); // total central directory records
  endRecord.writeUInt32LE(centralDirectory.length, 12);
  endRecord.writeUInt32LE(centralDirectoryOffset, 16);
  endRecord.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localParts, centralDirectory, endRecord]);
}

/**
 * Read the entries back out of a ZIP built by `buildZipArchive` (or any other
 * STORE-only archive with entries at the offsets their central directory
 * records name). Used to verify the archives this module writes rather than
 * asserting on raw byte offsets in tests.
 */
export function readZipEntries(archive: Buffer): ZipEntry[] {
  const eocdOffset = archive.lastIndexOf(
    Buffer.from([
      END_OF_CENTRAL_DIRECTORY_SIGNATURE & 0xff,
      (END_OF_CENTRAL_DIRECTORY_SIGNATURE >>> 8) & 0xff,
      (END_OF_CENTRAL_DIRECTORY_SIGNATURE >>> 16) & 0xff,
      (END_OF_CENTRAL_DIRECTORY_SIGNATURE >>> 24) & 0xff
    ])
  );

  if (eocdOffset === -1) {
    throw new Error('Not a valid zip archive: end-of-central-directory record not found');
  }

  const entryCount = archive.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = archive.readUInt32LE(eocdOffset + 16);

  const entries: ZipEntry[] = [];
  let cursor = centralDirectoryOffset;

  for (let i = 0; i < entryCount; i++) {
    if (archive.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Not a valid zip archive: central directory record ${i} missing its signature`);
    }

    const compressedSize = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localHeaderOffset = archive.readUInt32LE(cursor + 42);
    const path = archive.toString('utf8', cursor + CENTRAL_DIRECTORY_HEADER_SIZE, cursor + CENTRAL_DIRECTORY_HEADER_SIZE + nameLength);

    if (archive.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error(`Not a valid zip archive: local file header for "${path}" missing its signature`);
    }

    const localNameLength = archive.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = archive.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + LOCAL_FILE_HEADER_SIZE + localNameLength + localExtraLength;
    const data = archive.subarray(dataOffset, dataOffset + compressedSize);

    entries.push({ path, data: Buffer.from(data) });
    cursor += CENTRAL_DIRECTORY_HEADER_SIZE + nameLength + extraLength + commentLength;
  }

  return entries;
}
