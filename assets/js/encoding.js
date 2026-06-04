// ==========================================
// encoding.js - Generic Data Encoding Helpers
// ==========================================

const DEFAULT_EMPTY_BYTE = {
  hex: "--",
  binary: "00000000",
  inactiveClass: "inactive"
};

function toByteRecord(byte, index, extra = {}) {
  const normalized = byte & 0xFF;
  return {
    index,
    hex: normalized.toString(16).padStart(2, "0").toUpperCase(),
    binary: normalized.toString(2).padStart(8, "0"),
    inactiveClass: "",
    ...extra
  };
}

/**
 * Encodes a primitive value into byte records.
 *
 * @param {string} value
 * @param {string} dataType - bool | int8 | int32 | float64 | string
 * @param {Object} options
 * @returns {Array<Object>}
 */
export function encodeValueToBytes(value, dataType, options = {}) {
  const stringLimit = options.stringLimit ?? 8;
  const records = [];

  if (dataType === "bool") {
    const normalized = String(value).toLowerCase();
    const isTrue = normalized === "true" || normalized === "1" || normalized === "vrai";
    return [toByteRecord(isTrue ? 1 : 0, 0)];
  }

  if (dataType === "int8") {
    return [toByteRecord(parseInt(value, 10) || 0, 0)];
  }

  if (dataType === "int32") {
    const num = parseInt(value, 10) || 0;
    for (let i = 0; i < 4; i++) {
      records.push(toByteRecord((num >> (24 - i * 8)) & 0xFF, i));
    }
    return records;
  }

  if (dataType === "float64") {
    const arr = new Float64Array([parseFloat(value) || 0]);
    const dataView = new DataView(arr.buffer);
    for (let i = 0; i < 8; i++) {
      records.push(toByteRecord(dataView.getUint8(i), i));
    }
    return records;
  }

  if (dataType === "string") {
    const text = String(value).substring(0, stringLimit);
    for (let i = 0; i < text.length; i++) {
      records.push(toByteRecord(text.charCodeAt(i), i));
    }
  }

  return records;
}

/**
 * Pads and groups byte records into fixed-size visual slots.
 *
 * @param {Array<Object>} bytes
 * @param {Object} options
 * @returns {{ groups: Array<Array<Object>>, hasOverflow: boolean }}
 */
export function groupBytesIntoSlots(bytes = [], options = {}) {
  const slotSize = options.slotSize ?? 4;
  const slotCount = options.slotCount ?? 2;
  const emptyByte = options.emptyByte || DEFAULT_EMPTY_BYTE;
  const groups = [];

  for (let groupIndex = 0; groupIndex < slotCount; groupIndex++) {
    const start = groupIndex * slotSize;
    const group = [];

    for (let offset = 0; offset < slotSize; offset++) {
      const index = start + offset;
      group.push(bytes[index] || { ...emptyByte, index });
    }

    groups.push(group);
  }

  return {
    groups,
    hasOverflow: bytes.length > slotSize
  };
}

/**
 * Splits text into token-like records with optional configured fragments.
 *
 * @param {string} text
 * @param {Object} options
 * @returns {Array<Object>}
 */
export function tokenizeText(text, options = {}) {
  if (!text || typeof text !== "string") return [];

  const fragmentMap = options.fragmentMap || {};
  const splitLongWords = options.splitLongWords !== false;
  const longWordThreshold = options.longWordThreshold ?? 9;
  const regex = options.regex || / ?[a-zA-ZÀ-ÿ0-9]+| ?[^\s\w\p{Emoji_Presentation}]+| ?\p{Emoji_Presentation}/gu;
  const matches = text.match(regex) || [];
  const tokens = [];

  matches.forEach(match => {
    let cleanText = match;
    let hasSpace = false;

    if (match.startsWith(" ")) {
      hasSpace = true;
      cleanText = match.substring(1);
    }

    const fragments = fragmentMap[cleanText] || fragmentMap[cleanText.toLowerCase()];
    if (fragments) {
      fragments.forEach((fragment, index) => {
        tokens.push({
          text: fragment,
          isFragment: index < fragments.length - 1,
          hasSpace: index === 0 ? hasSpace : false
        });
      });
      return;
    }

    if (splitLongWords && cleanText.length > longWordThreshold && !/\s/.test(cleanText)) {
      const mid = Math.floor(cleanText.length / 2);
      tokens.push({ text: cleanText.substring(0, mid), isFragment: true, hasSpace });
      tokens.push({ text: cleanText.substring(mid), isFragment: false, hasSpace: false });
      return;
    }

    tokens.push({ text: cleanText, isFragment: false, hasSpace });
  });

  return tokens;
}
