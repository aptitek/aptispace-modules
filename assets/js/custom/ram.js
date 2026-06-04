// ==========================================
// ram.js — RAM simulator rendering engine
// ==========================================
// Usage (OJS):
//   import { getRamData, renderRam } from "./assets/js/custom/ram.js"
//
//   ramData = getRamData(rawInput, dataType)
//   updateRamUI = renderRam(ramData)
//

import { renderListTemplate } from "../core.js";

/**
 * Converts a raw input value into hex/binary byte representations based on data type,
 * and pads the elements to fit a dual-stick DIMM motherboard physical architecture.
 *
 * @param {string} val      - The active string input from the user interface
 * @param {string} dataType - Active data type ('bool', 'int8', 'int32', 'float64', 'string')
 * @returns {Object}        - Dual-stick bytes payload: { stick1, stick2, needsStick2 }
 */
export function getRamData(val, dataType) {
  let byteList = [];

  try {
    if (dataType === "bool") {
      let isTrue = val.toLowerCase() === "true" || val === "1" || val.toLowerCase() === "vrai";
      byteList.push({ index: 0, hex: isTrue ? "01" : "00", binary: isTrue ? "00000001" : "00000000", inactiveClass: "" });
    
    } else if (dataType === "int8") {
      let num = parseInt(val) || 0;
      let b = num & 0xFF;
      byteList.push({ index: 0, hex: b.toString(16).padStart(2, '0').toUpperCase(), binary: b.toString(2).padStart(8, '0'), inactiveClass: "" });
    
    } else if (dataType === "int32") {
      let num = parseInt(val) || 0;
      for (let i = 0; i < 4; i++) {
        let b = (num >> (24 - i * 8)) & 0xFF;
        byteList.push({ index: i, hex: b.toString(16).padStart(2, '0').toUpperCase(), binary: b.toString(2).padStart(8, '0'), inactiveClass: "" });
      }
    
    } else if (dataType === "float64") {
      let num = parseFloat(val) || 0;
      let arr = new Float64Array([num]);
      let dataview = new DataView(arr.buffer);
      for (let i = 0; i < 8; i++) {
        let b = dataview.getUint8(i);
        byteList.push({ index: i, hex: b.toString(16).padStart(2, '0').toUpperCase(), binary: b.toString(2).padStart(8, '0'), inactiveClass: "" });
      }
    
    } else if (dataType === "string") {
      let str = val.substring(0, 8); // Max 8 characters total across both sticks
      for (let i = 0; i < str.length; i++) {
        let b = str.charCodeAt(i);
        byteList.push({ index: i, hex: b.toString(16).padStart(2, '0').toUpperCase(), binary: b.toString(2).padStart(8, '0'), inactiveClass: "" });
      }
    }
  } catch (e) {
    byteList = [{ index: "?", hex: "??", binary: "Erreur", inactiveClass: "" }];
  }

  // Determine if we need the second DIMM memory stick (byte count > 4)
  let needsStick2 = byteList.length > 4;

  // Populate Stick 1 (DIMM 1: Octets 0 to 3)
  let stick1Bytes = [];
  for (let i = 0; i < 4; i++) {
    if (i < byteList.length) {
      stick1Bytes.push(byteList[i]);
    } else {
      stick1Bytes.push({
        index: i,
        hex: "--",
        binary: "00000000",
        inactiveClass: "inactive"
      });
    }
  }

  // Populate Stick 2 (DIMM 2: Octets 4 to 7)
  let stick2Bytes = [];
  for (let i = 4; i < 8; i++) {
    if (i < byteList.length) {
      stick2Bytes.push(byteList[i]);
    } else {
      stick2Bytes.push({
        index: i,
        hex: "--",
        binary: "00000000",
        inactiveClass: "inactive"
      });
    }
  }

  return {
    stick1: stick1Bytes,
    stick2: stick2Bytes,
    needsStick2: needsStick2
  };
}

/**
 * Renders the RAM stick data using templates and adjusts DIMM stick visibility.
 *
 * @param {Object} ramData - Mapped RAM sticks payload { stick1, stick2, needsStick2 }
 */
export function renderRam(ramData) {
  if (!ramData) return;

  // Render slots for DIMM Stick 1
  renderListTemplate("#ram-bytes-container-1", ".ram-byte-template", ramData.stick1);
  
  // Render slots for DIMM Stick 2
  renderListTemplate("#ram-bytes-container-2", ".ram-byte-template", ramData.stick2);
  
  // Dynamically show or hide Stick 2 based on storage demand
  const stick2 = document.querySelector("#ram-stick-2");
  if (stick2) {
    if (ramData.needsStick2) {
      stick2.classList.remove("d-none");
    } else {
      stick2.classList.add("d-none");
    }
  }
}
