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

/**
 * The modification instant every entry carries: 1980-01-01 00:00.
 *
 * Both fields were written as `0`, commented "last mod file time"/"last mod file
 * date", and zero is not a date. The MS-DOS date field packs
 * `((year - 1980) << 9) | (month << 5) | day` with the month and day counted
 * from one, so all-zero bits decode to **month 0, day 0** — a calendar position
 * that does not exist, on every `.epub` and `.docx` this service has ever handed
 * a reader.
 *
 * What that costs depends on who opens the file, and none of the answers are
 * "nothing". `unzip -l` prints `1980-00-00 00:00`. Java's `ZipEntry.getTime()`
 * feeds the fields to a lenient calendar, where month 0 and day 0 roll backwards
 * to November 1979 — so a reader written on `java.util.zip`, which is most of
 * the EPUB tooling that is not a browser, reports a modification date a year
 * before the format's own epoch. Python's `zipfile` hands the tuple through as
 * `(1980, 0, 0, 0, 0, 0)`, which `datetime` refuses, so anything that turns an
 * entry's date into a `datetime` raises `ValueError` on a file it could
 * otherwise read.
 *
 * 1980-01-01 is the earliest instant the fields can spell, which is the honest
 * value for a writer that tracks no timestamp — and it keeps the archive a pure
 * function of its entries, which `generateEPUBContent` already relies on: "the
 * same story exported twice should produce the same book identifier", and the
 * copy this module hands back for verification must not vary between calls.
 * Stamping the real clock here — the obvious other way to give the fields a
 * valid date — would break exactly that.
 */
const DOS_EPOCH_TIME = 0;
const DOS_EPOCH_DATE = (1 << 5) | 1;

export interface ZipEntry {
  path: string;
  data: Buffer;
}

/** An entry's MS-DOS modification fields, decoded into the date they spell. */
export interface DosDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * What `readZipEntries` answers: an entry plus the modification date its header
 * carries, so that field can be asserted on through the reader like every other
 * one rather than by decoding two `u16`s at hand-counted offsets in a test.
 */
export interface ReadZipEntry extends ZipEntry {
  modifiedAt: DosDateTime;
}

/**
 * Decode the MS-DOS time and date fields a ZIP header stores an entry's
 * modification instant in. Month and day are counted from one, so a zero in
 * either is not a date — see `DOS_EPOCH_DATE`.
 */
export function decodeDosDateTime(time: number, date: number): DosDateTime {
  return {
    year: 1980 + ((date >>> 9) & 0x7f),
    month: (date >>> 5) & 0x0f,
    day: date & 0x1f,
    hour: (time >>> 11) & 0x1f,
    minute: (time >>> 5) & 0x3f,
    second: (time & 0x1f) * 2
  };
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
 * stored (never deflated), when (the DOS epoch — no timestamp is tracked, and
 * that is the earliest instant the fields can spell), its CRC, its size (twice —
 * STORE makes the compressed and uncompressed sizes equal), and how long its
 * filename is. Shared so the two headers can't drift apart on a field neither of
 * them actually varies.
 */
function writeStoreMethodFields(writer: SequentialBufferWriter, crc: number, size: number, nameLength: number): SequentialBufferWriter {
  return writer
    .u16(0) // general purpose bit flag
    .u16(STORE_METHOD)
    .u16(DOS_EPOCH_TIME) // last mod file time
    .u16(DOS_EPOCH_DATE) // last mod file date
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
export function readZipEntries(archive: Buffer): ReadZipEntry[] {
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

  const entries: ReadZipEntry[] = [];
  let cursor = centralDirectoryOffset;

  for (let i = 0; i < entryCount; i++) {
    if (archive.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error(`Not a valid zip archive: central directory record ${i} missing its signature`);
    }

    const modifiedAt = decodeDosDateTime(archive.readUInt16LE(cursor + 12), archive.readUInt16LE(cursor + 14));
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

    entries.push({ path, data: Buffer.from(data), modifiedAt });
    cursor += CENTRAL_DIRECTORY_HEADER_SIZE + nameLength + extraLength + commentLength;
  }

  return entries;
}
