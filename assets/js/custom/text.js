// ==========================================
// text.js - Token Stream Compatibility Adapter
// ==========================================

import { createTokenStream } from "../components.js";
import { tokenizeText as tokenizeGenericText } from "../encoding.js";

const TOKEN_FRAGMENT_MAP = {
  anticonstitutionnellement: ["anti", "constitution", "nelle", "ment"]
};

export function tokenizeText(text, options = {}) {
  return tokenizeGenericText(text, {
    fragmentMap: TOKEN_FRAGMENT_MAP,
    ...options
  });
}

export function createLabeledText(selectorOrElement, options = {}) {
  return createTokenStream(selectorOrElement, {
    tokenizer: text => tokenizeText(text, options.tokenizerOptions),
    ...options
  });
}
