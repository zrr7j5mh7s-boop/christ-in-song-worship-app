(function () {
  "use strict";

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let j = 0; j < 8; j += 1) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c >>> 0;
    }
    return table;
  })();

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    return new TextEncoder().encode(String(data));
  }

  function readAscii(view, offset, length) {
    let out = "";
    for (let i = 0; i < length; i += 1) out += String.fromCharCode(view.getUint8(offset + i));
    return out;
  }

  function findEndOfCentralDirectory(buffer) {
    const view = new DataView(buffer);
    const minOffset = Math.max(0, buffer.byteLength - 65557);
    for (let offset = buffer.byteLength - 22; offset >= minOffset; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    return -1;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot read compressed backup archives.");
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(stream).arrayBuffer();
  }

  async function deflateRaw(bytes) {
    if (typeof CompressionStream === "undefined") return null;
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (_error) {
      return null;
    }
  }

  async function readZipEntries(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const eocdOffset = findEndOfCentralDirectory(arrayBuffer);
    if (eocdOffset < 0) throw new Error("Could not read the backup archive. The file may be corrupted.");

    const centralDirOffset = view.getUint32(eocdOffset + 16, true);
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const entries = [];
    let offset = centralDirOffset;

    for (let index = 0; index < totalEntries; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) break;
      const compression = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const fileNameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localHeaderOffset = view.getUint32(offset + 42, true);
      const name = readAscii(view, offset + 46, fileNameLength);
      offset += 46 + fileNameLength + extraLength + commentLength;

      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = arrayBuffer.slice(dataOffset, dataOffset + compressedSize);
      let content = compressed;
      if (compression === 0) {
        content = compressed;
      } else if (compression === 8) {
        content = await inflateRaw(compressed);
      } else {
        continue;
      }
      entries.push({ name, content, size: uncompressedSize || content.byteLength });
    }
    return entries;
  }

  function writeUint32LE(value) {
    const bytes = new Uint8Array(4);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, value >>> 0, true);
    return bytes;
  }

  function writeUint16LE(value) {
    const bytes = new Uint8Array(2);
    const view = new DataView(bytes.buffer);
    view.setUint16(0, value, true);
    return bytes;
  }

  function concatChunks(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    chunks.forEach((chunk) => {
      out.set(chunk, offset);
      offset += chunk.length;
    });
    return out;
  }

  async function createZip(entries) {
    const normalized = (entries || []).map((entry) => ({
      name: String(entry.name || "").replace(/\\/g, "/"),
      data: toBytes(entry.data),
    })).filter((entry) => entry.name);

    const chunks = [];
    const centralRecords = [];
    let offset = 0;

    for (const entry of normalized) {
      const nameBytes = new TextEncoder().encode(entry.name);
      let payload = entry.data;
      let compression = 0;
      if (entry.data.length > 512) {
        const compressed = await deflateRaw(entry.data);
        if (compressed && compressed.length < entry.data.length) {
          payload = compressed;
          compression = 8;
        }
      }
      const checksum = crc32(entry.data);
      const localHeader = concatChunks([
        writeUint32LE(0x04034b50),
        writeUint16LE(20),
        writeUint16LE(0),
        writeUint16LE(compression),
        writeUint16LE(0),
        writeUint16LE(0),
        writeUint32LE(checksum),
        writeUint32LE(payload.length),
        writeUint32LE(entry.data.length),
        writeUint16LE(nameBytes.length),
        writeUint16LE(0),
        nameBytes,
        payload,
      ]);
      chunks.push(localHeader);

      const centralHeader = concatChunks([
        writeUint32LE(0x02014b50),
        writeUint16LE(20),
        writeUint16LE(20),
        writeUint16LE(0),
        writeUint16LE(compression),
        writeUint16LE(0),
        writeUint16LE(0),
        writeUint32LE(checksum),
        writeUint32LE(payload.length),
        writeUint32LE(entry.data.length),
        writeUint16LE(nameBytes.length),
        writeUint16LE(0),
        writeUint16LE(0),
        writeUint16LE(0),
        writeUint16LE(0),
        writeUint32LE(0),
        writeUint32LE(offset),
        nameBytes,
      ]);
      centralRecords.push(centralHeader);
      offset += localHeader.length;
    }

    const centralOffset = offset;
    centralRecords.forEach((record) => {
      chunks.push(record);
      offset += record.length;
    });

    const eocd = concatChunks([
      writeUint32LE(0x06054b50),
      writeUint16LE(0),
      writeUint16LE(0),
      writeUint16LE(normalized.length),
      writeUint16LE(normalized.length),
      writeUint32LE(offset - centralOffset),
      writeUint32LE(centralOffset),
      writeUint16LE(0),
    ]);
    chunks.push(eocd);

    return new Blob([concatChunks(chunks)], { type: "application/zip" });
  }

  window.CISBackupZip = {
    createZip,
    readZipEntries,
  };
})();
