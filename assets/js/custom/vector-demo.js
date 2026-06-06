// ==========================================
// vector-demo.js — Interactive BoW & TF-IDF Vectorizer
// ==========================================

import { getThemeColor } from "../core.js";

const corpus = [
  "Le chat mange le poisson",
  "Le chien mange le chat",
  "Le poisson mange le plancton"
];

// Simple tokenization helper
function tokenize(text) {
  return text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .split(/\s+/)
    .filter(x => x.length > 0);
}

const tokenizedCorpus = corpus.map(tokenize);

// Unique vocabulary sorted alphabetically
const vocabSet = new Set();
tokenizedCorpus.forEach(tokens => {
  tokens.forEach(token => vocabSet.add(token));
});
const vocabulary = Array.from(vocabSet).sort();

// Document Frequency (DF)
const df = {};
vocabulary.forEach(word => {
  df[word] = tokenizedCorpus.filter(tokens => tokens.includes(word)).length;
});

// Inverse Document Frequency (IDF) using standard formula: IDF = log10(N/DF) + 1
const idf = {};
vocabulary.forEach(word => {
  idf[word] = Math.log10(corpus.length / df[word]) + 1;
});

export function createVectorDemo(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  // Clear container
  container.innerHTML = "";

  // Create UI Structure
  const wrapper = document.createElement("div");
  wrapper.className = "vector-demo-wrapper card p-3 shadow-sm border";

  // Header/Title
  const header = document.createElement("h4");
  header.className = "card-title mb-3 bi-cpu";
  header.innerText = " Démonstrateur Interactif : BoW vs TF-IDF";
  wrapper.appendChild(header);

  // Description
  const desc = document.createElement("p");
  desc.className = "text-muted small mb-4";
  desc.innerText = "Choisissez une phrase du corpus pour voir comment elle est vectorisée par le Bag of Words (BoW) et par TF-IDF. Survolez un mot ou une cellule pour analyser les calculs sous-jacents.";
  wrapper.appendChild(desc);

  // Dropdown selector
  const selectorLabel = document.createElement("label");
  selectorLabel.className = "form-label small fw-bold text-uppercase";
  selectorLabel.innerText = "Sélectionner un document (corpus de 3 phrases) :";
  wrapper.appendChild(selectorLabel);

  const select = document.createElement("select");
  select.className = "form-select mb-4";
  corpus.forEach((sentence, idx) => {
    const opt = document.createElement("option");
    opt.value = idx;
    opt.innerText = `S${idx + 1} : "${sentence}"`;
    select.appendChild(opt);
  });
  wrapper.appendChild(select);

  // Sentence words list (tokens visualization)
  const tokensLabel = document.createElement("div");
  tokensLabel.className = "small fw-bold text-uppercase mb-2";
  tokensLabel.innerText = "Phrase découpée en Tokens :";
  wrapper.appendChild(tokensLabel);

  const tokensContainer = document.createElement("div");
  tokensContainer.className = "tokens-container d-flex flex-wrap gap-2 mb-4 p-2 rounded";
  wrapper.appendChild(tokensContainer);

  // Row for Vectors
  const vectorsRow = document.createElement("div");
  vectorsRow.className = "row g-3 mb-4";

  // Left Vector column (BoW)
  const bowCol = document.createElement("div");
  bowCol.className = "col-md-6";
  const bowHeader = document.createElement("h6");
  bowHeader.className = "fw-bold text-uppercase small text-primary mb-2";
  bowHeader.innerText = "Vecteur Bag of Words (BoW)";
  bowCol.appendChild(bowHeader);

  const bowVectorGrid = document.createElement("div");
  bowVectorGrid.className = "vector-grid";
  bowCol.appendChild(bowVectorGrid);
  vectorsRow.appendChild(bowCol);

  // Right Vector column (TF-IDF)
  const tfidfCol = document.createElement("div");
  tfidfCol.className = "col-md-6";
  const tfidfHeader = document.createElement("h6");
  tfidfHeader.className = "fw-bold text-uppercase small text-orange mb-2";
  tfidfHeader.innerText = "Vecteur TF-IDF";
  tfidfCol.appendChild(tfidfHeader);

  const tfidfVectorGrid = document.createElement("div");
  tfidfVectorGrid.className = "vector-grid";
  tfidfCol.appendChild(tfidfVectorGrid);
  vectorsRow.appendChild(tfidfCol);

  wrapper.appendChild(vectorsRow);

  // Details panel
  const detailsPanel = document.createElement("div");
  detailsPanel.className = "details-panel p-3 rounded text-muted small border";
  detailsPanel.innerHTML = "<em>Survolez un mot de la phrase ou une cellule du vecteur pour voir le calcul détaillé.</em>";
  wrapper.appendChild(detailsPanel);

  container.appendChild(wrapper);

  // Render function for selected sentence index
  function updateUI(idx) {
    const rawSentence = corpus[idx];
    const docTokens = tokenizedCorpus[idx];
    const totalWords = docTokens.length;

    // 1. Draw tokens
    tokensContainer.innerHTML = "";
    rawSentence.split(/\s+/).forEach((rawWord) => {
      const cleanWord = rawWord.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
      const span = document.createElement("span");
      span.className = "token-badge badge bg-secondary-subtle text-secondary border px-2 py-1 fs-6";
      span.innerText = rawWord;
      span.dataset.word = cleanWord;

      // Event listeners for hovering
      span.addEventListener("mouseenter", () => highlightWord(cleanWord, idx));
      span.addEventListener("mouseleave", clearHighlight);

      tokensContainer.appendChild(span);
    });

    // 2. Draw BoW Vector
    bowVectorGrid.innerHTML = "";
    vocabulary.forEach((word) => {
      const count = docTokens.filter(t => t === word).length;
      const cell = document.createElement("div");
      cell.className = "vector-cell p-2 border rounded text-center";
      cell.dataset.word = word;
      if (count > 0) {
        cell.classList.add("active-bow");
      }

      cell.innerHTML = `
        <div class="vocab-word text-truncate fw-bold small mb-1">${word}</div>
        <div class="vector-val fs-5 fw-bold">${count}</div>
      `;

      cell.addEventListener("mouseenter", () => highlightWord(word, idx));
      cell.addEventListener("mouseleave", clearHighlight);

      bowVectorGrid.appendChild(cell);
    });

    // 3. Draw TF-IDF Vector
    tfidfVectorGrid.innerHTML = "";
    vocabulary.forEach((word) => {
      const count = docTokens.filter(t => t === word).length;
      const tf = count / totalWords;
      const tfidfScore = tf * idf[word];
      const cell = document.createElement("div");
      cell.className = "vector-cell p-2 border rounded text-center";
      cell.dataset.word = word;
      if (tfidfScore > 0) {
        cell.classList.add("active-tfidf");
      }

      cell.innerHTML = `
        <div class="vocab-word text-truncate fw-bold small mb-1">${word}</div>
        <div class="vector-val fs-5 fw-bold">${tfidfScore.toFixed(2)}</div>
      `;

      cell.addEventListener("mouseenter", () => highlightWord(word, idx));
      cell.addEventListener("mouseleave", clearHighlight);

      tfidfVectorGrid.appendChild(cell);
    });
  }

  // Highlight word across all elements
  function highlightWord(word, docIdx) {
    const docTokens = tokenizedCorpus[docIdx];
    const totalWords = docTokens.length;
    const count = docTokens.filter(t => t === word).length;
    const tf = count / totalWords;
    const wordIdf = idf[word];
    const tfidfVal = tf * wordIdf;

    // Highlight spans
    document.querySelectorAll(`${containerSelector} .token-badge`).forEach(span => {
      if (span.dataset.word === word) {
        span.classList.remove("bg-secondary-subtle", "text-secondary");
        span.classList.add("bg-primary", "text-white");
      }
    });

    // Highlight vector cells
    document.querySelectorAll(`${containerSelector} .vector-cell`).forEach(cell => {
      if (cell.dataset.word === word) {
        cell.classList.add("highlighted");
      }
    });

    // Update details panel
    if (vocabulary.includes(word)) {
      detailsPanel.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong class="fs-6 text-primary">Mot : "${word}"</strong>
          <span class="badge bg-info-subtle text-info border">DF = ${df[word]} / 3 documents</span>
        </div>
        <div class="row g-2 text-dark">
          <div class="col-6">
            <div class="p-2 bg-light rounded border h-100">
              <strong class="d-block text-muted small text-uppercase mb-1">Pondération BoW</strong>
              <div>Occurrences : <span class="fw-bold">${count}</span></div>
              <div class="small text-muted mt-1">Nombre brut d'apparitions dans cette phrase.</div>
            </div>
          </div>
          <div class="col-6">
            <div class="p-2 bg-light rounded border h-100">
              <strong class="d-block text-muted small text-uppercase mb-1">Calcul TF-IDF</strong>
              <div>• TF (Term Frequency) : <code>${count} / ${totalWords} = ${tf.toFixed(2)}</code></div>
              <div>• IDF (Inverse Doc Freq) : <code>log10(3 / ${df[word]}) + 1 = ${wordIdf.toFixed(2)}</code></div>
              <div class="fw-bold mt-1 text-orange">• Score TF-IDF : <code>${tf.toFixed(2)} × ${wordIdf.toFixed(2)} = ${tfidfVal.toFixed(2)}</code></div>
            </div>
          </div>
        </div>
      `;
    } else {
      detailsPanel.innerHTML = `
        <div class="text-warning">
          <strong>Le mot "${word}" ne fait pas partie du vocabulaire global de l'espace vectoriel.</strong><br>
          <span class="small text-muted">Il a été nettoyé (caractère spécial ou ponctuation).</span>
        </div>
      `;
    }
  }

  function clearHighlight() {
    // Reset spans
    document.querySelectorAll(`${containerSelector} .token-badge`).forEach(span => {
      span.classList.add("bg-secondary-subtle", "text-secondary");
      span.classList.remove("bg-primary", "text-white");
    });

    // Reset vector cells
    document.querySelectorAll(`${containerSelector} .vector-cell`).forEach(cell => {
      cell.classList.remove("highlighted");
    });

    // Reset details panel
    detailsPanel.innerHTML = "<em>Survolez un mot de la phrase ou une cellule du vecteur pour voir le calcul détaillé.</em>";
  }

  // Handle select change
  select.addEventListener("change", (e) => {
    updateUI(parseInt(e.target.value));
  });

  // Initial render
  updateUI(0);
}
