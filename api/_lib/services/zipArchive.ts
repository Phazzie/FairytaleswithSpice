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
 * Fills a fixed-size buffer field by field, so a header's layout reads as the
 * sequence of fields the ZIP spec defines rather than as a list of byte
 * offsets someone has to keep in sync by hand.
 */
class SequentialBufferWriter {
  private readonly buffer: Buffer;
  private offset = 0;

  constructor(size: number) {
    this.buffer = Buffer.alloc(size);
  }

  u16(value: number): this {
    this.buffer.writeUInt16LE(value, this.offset);
    this.offset += 2;
    return this;
  }

  u32(value: number): this {
    this.buffer.writeUInt32LE(value, this.offset);
    this.offset += 4;
    return this;
  }

  toBuffer(): Buffer {
    return this.buffer;
  }
}

/**
 * The fields a local file header and a central directory record describe
 * identically once past their signature and version fields: this entry was
 * stored (never deflated), when (never — no timestamp is tracked), its CRC,
 * its size (twice — STORE makes the compressed and uncompressed sizes equal),
 * and how long its filename is. Shared so the two headers can't drift apart on
 * a field neither of them actually varies.
 */
function writeStoreMethodFields(writer: SequentialBufferWriter, crc: number, size: number, nameLength: number): SequentialBufferWriter {
  return writer
    .u16(0) // general purpose bit flag
    .u16(STORE_METHOD)
    .u16(0) // last mod file time
    .u16(0) // last mod file date
    .u32(crc)
    .u32(size) // compressed size == uncompressed size for STORE
    .u32(size)
    .u16(nameLength);
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

    const localHeader = writeStoreMethodFields(
      new SequentialBufferWriter(LOCAL_FILE_HEADER_SIZE).u32(LOCAL_FILE_HEADER_SIGNATURE).u16(VERSION_NEEDED_TO_EXTRACT),
      crc,
      size,
      nameBytes.length
    )
      .u16(0) // extra field length
      .toBuffer();

    localParts.push(localHeader, nameBytes, entry.data);

    const centralHeader = writeStoreMethodFields(
      new SequentialBufferWriter(CENTRAL_DIRECTORY_HEADER_SIZE)
        .u32(CENTRAL_DIRECTORY_SIGNATURE)
        .u16(VERSION_NEEDED_TO_EXTRACT) // version made by
        .u16(VERSION_NEEDED_TO_EXTRACT), // version needed to extract
      crc,
      size,
      nameBytes.length
    )
      .u16(0) // extra field length
      .u16(0) // file comment length
      .u16(0) // disk number start
      .u16(0) // internal file attributes
      .u32(0) // external file attributes
      .u32(offset) // relative offset of local header
      .toBuffer();

    centralParts.push(centralHeader, nameBytes);

    offset += LOCAL_FILE_HEADER_SIZE + nameBytes.length + size;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const centralDirectoryOffset = offset;

  const endRecord = new SequentialBufferWriter(END_OF_CENTRAL_DIRECTORY_SIZE)
    .u32(END_OF_CENTRAL_DIRECTORY_SIGNATURE)
    .u16(0) // number of this disk
    .u16(0) // disk where central directory starts
    .u16(entries.length) // central directory records on this disk
    .u16(entries.length) // total central directory records
    .u32(centralDirectory.length)
    .u32(centralDirectoryOffset)
    .u16(0) // comment length
    .toBuffer();

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
