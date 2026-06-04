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
import { encodeValueToBytes, groupBytesIntoSlots } from "../encoding.js";

const RAM_SLOT_SIZE = 4;
const RAM_SLOT_COUNT = 2;

/**
 * Converts a raw input value into hex/binary byte representations based on data type,
 * and pads the elements to fit a dual-stick DIMM motherboard physical architecture.
 *
 * @param {string} val      - The active string input from the user interface
 * @param {string} dataType - Active data type ('bool', 'int8', 'int32', 'float64', 'string')
 * @returns {Object}        - Dual-stick bytes payload: { stick1, stick2, needsStick2 }
 */
export function getRamData(val, dataType) {
  try {
    const byteList = encodeValueToBytes(val, dataType, { stringLimit: RAM_SLOT_SIZE * RAM_SLOT_COUNT });
    const slots = groupBytesIntoSlots(byteList, {
      slotSize: RAM_SLOT_SIZE,
      slotCount: RAM_SLOT_COUNT
    });

    return {
      stick1: slots.groups[0],
      stick2: slots.groups[1],
      needsStick2: slots.hasOverflow
    };
  } catch (e) {
    const slots = groupBytesIntoSlots([{ index: "?", hex: "??", binary: "Erreur", inactiveClass: "" }], {
      slotSize: RAM_SLOT_SIZE,
      slotCount: RAM_SLOT_COUNT
    });
    return {
      stick1: slots.groups[0],
      stick2: slots.groups[1],
      needsStick2: false
    };
  }
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
