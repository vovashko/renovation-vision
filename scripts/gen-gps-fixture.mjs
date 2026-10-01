// One-off generator for tests/fixtures/gps.jpg: a tiny (1x1) baseline JPEG carrying an EXIF APP1
// segment with GPS coordinates and DateTimeOriginal, built by hand (no system imagemagick/exiftool
// available). Not part of the app; run once with `node scripts/gen-gps-fixture.mjs`.
import { writeFileSync } from "node:fs";

function u16be(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n);
  return b;
}
function u16le(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}
function u32le(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}
function ascii(s) {
  return Buffer.from(s, "ascii");
}

// --- TIFF body (little-endian), offsets relative to the start of the TIFF header ---
const TIFF_HEADER_LEN = 8;

// IFD0: 2 entries (ExifIFD pointer, GPSIFD pointer)
const IFD0_COUNT = 2;
const IFD0_LEN = 2 + IFD0_COUNT * 12 + 4;
const ifd0Offset = TIFF_HEADER_LEN;

// Exif SubIFD: 1 entry (DateTimeOriginal, ASCII, stored out-of-line since it's >4 bytes)
const EXIF_COUNT = 1;
const EXIF_LEN = 2 + EXIF_COUNT * 12 + 4;
const exifIfdOffset = ifd0Offset + IFD0_LEN;
const dateStr = "2024:05:17 10:30:00\0"; // 20 bytes incl. trailing NUL, per the EXIF spec's count
const exifDataOffset = exifIfdOffset + EXIF_LEN;

// GPS IFD: 4 entries (LatRef, Lat, LonRef, Lon); only Lat/Lon need out-of-line rational data
const GPS_COUNT = 4;
const GPS_LEN = 2 + GPS_COUNT * 12 + 4;
const gpsIfdOffset = exifDataOffset + dateStr.length;
const gpsDataOffset = gpsIfdOffset + GPS_LEN;
// 2 rationals (lat) + 2 rationals (lon), each rational = 2x uint32 = 8 bytes -> 3 components each (deg,min,sec)
const latDataOffset = gpsDataOffset;
const lonDataOffset = latDataOffset + 3 * 8;

function ifdEntry(tag, type, count, valueOrOffset) {
  return Buffer.concat([u16le(tag), u16le(type), u32le(count), valueOrOffset]);
}

// IFD0
const ifd0 = Buffer.concat([
  u16le(IFD0_COUNT),
  ifdEntry(0x8769, 4, 1, u32le(exifIfdOffset)), // ExifIFD pointer (LONG)
  ifdEntry(0x8825, 4, 1, u32le(gpsIfdOffset)), // GPSInfo pointer (LONG)
  u32le(0), // next IFD
]);

// Exif SubIFD
const exifIfd = Buffer.concat([
  u16le(EXIF_COUNT),
  ifdEntry(0x9003, 2, dateStr.length, u32le(exifDataOffset)), // DateTimeOriginal (ASCII)
  u32le(0),
]);
const exifData = ascii(dateStr);

// GPS IFD: 52.5200 N, 13.4050 E (Berlin), as degree/minute/second rationals
function dmsRationals(decimal) {
  const deg = Math.floor(decimal);
  const minFloat = (decimal - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = Math.round((minFloat - min) * 60 * 100); // x100 for a clean rational
  return Buffer.concat([u32le(deg), u32le(1), u32le(min), u32le(1), u32le(sec), u32le(100)]);
}
const latData = dmsRationals(52.52);
const lonData = dmsRationals(13.405);

const gpsIfd = Buffer.concat([
  u16le(GPS_COUNT),
  ifdEntry(0x0001, 2, 2, Buffer.concat([ascii("N\0"), Buffer.alloc(2)])), // GPSLatitudeRef
  ifdEntry(0x0002, 5, 3, u32le(latDataOffset)), // GPSLatitude
  ifdEntry(0x0003, 2, 2, Buffer.concat([ascii("E\0"), Buffer.alloc(2)])), // GPSLongitudeRef
  ifdEntry(0x0004, 5, 3, u32le(lonDataOffset)), // GPSLongitude
  u32le(0),
]);

const tiffHeader = Buffer.concat([ascii("II"), u16le(42), u32le(ifd0Offset)]);
const tiffBody = Buffer.concat([tiffHeader, ifd0, exifIfd, exifData, gpsIfd, latData, lonData]);

const exifSegmentPayload = Buffer.concat([ascii("Exif\0\0"), tiffBody]);
const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), u16be(exifSegmentPayload.length + 2), exifSegmentPayload]);

// Minimal baseline 1x1 grayscale JPEG body (SOF0 + a single DC-only MCU), enough for any real JPEG
// decoder (and the browser canvas path) to decode a 1x1 image.
const sof0 = Buffer.concat([
  Buffer.from([0xff, 0xc0]),
  u16be(11),
  Buffer.from([0x08]), // precision
  u16be(1), // height
  u16be(1), // width
  Buffer.from([0x01, 0x01, 0x11, 0x00]), // 1 component, sampling 1x1, quant table 0
]);
const dqt = Buffer.concat([Buffer.from([0xff, 0xdb]), u16be(2 + 65), Buffer.from([0x00]), Buffer.alloc(64, 16)]);
const dht_dc = Buffer.concat([
  Buffer.from([0xff, 0xc4]),
  u16be(2 + 1 + 16 + 1),
  Buffer.from([0x00]), // DC table 0
  Buffer.from([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), // one code of length 1
  Buffer.from([0x00]), // symbol: category 0
]);
const dht_ac = Buffer.concat([
  Buffer.from([0xff, 0xc4]),
  u16be(2 + 1 + 16 + 1),
  Buffer.from([0x10]), // AC table 0
  Buffer.from([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), // one code of length 1
  Buffer.from([0x00]), // EOB
]);
const sos = Buffer.concat([
  Buffer.from([0xff, 0xda]),
  u16be(8),
  Buffer.from([0x01, 0x01, 0x00]), // 1 component, DC table 0 / AC table 0
  Buffer.from([0x00, 0x3f, 0x00]),
]);
// Entropy-coded data: DC code "0" (1 bit) for category 0 (value 0), then AC EOB "0" (1 bit), padded with 1s.
const scanData = Buffer.from([0b00111111]);

const jpeg = Buffer.concat([
  Buffer.from([0xff, 0xd8]), // SOI
  app1,
  dqt,
  sof0,
  dht_dc,
  dht_ac,
  sos,
  scanData,
  Buffer.from([0xff, 0xd9]), // EOI
]);

writeFileSync(new URL("../tests/fixtures/gps.jpg", import.meta.url), jpeg);
console.log(`Wrote tests/fixtures/gps.jpg (${jpeg.length} bytes)`);
