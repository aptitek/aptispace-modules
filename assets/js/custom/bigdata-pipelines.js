// ==========================================================================
// bigdata-pipelines.js — Simulateurs interactifs de stockage colonnaire,
// pipelines ETL/ELT/Hybrides, transactions Lakehouse OCC & architecture Médaillon.
// Chapitres : datalake.qmd, datawarehouse.qmd, datalakehouse.qmd, medaillon.qmd
// ==========================================================================

import { getPlotlyTheme, getThemeColor } from "../core.js";

function resolveTarget(container) {
  return typeof container === "string" ? document.querySelector(container) : container;
}

// ==========================================================================
// 1. INSPECTEUR DYNAMIQUE PARQUET : PRUNING, ZONE MAPS & DATA SWAMP (datalake.qmd)
// ==========================================================================

export function createParquetPruningSimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const rowGroups = [
    { id: 1, rows: "2,5M lignes", minAmt: 5, maxAmt: 420, countries: ["FR", "BE"], hasFraudTx: false },
    { id: 2, rows: "2,5M lignes", minAmt: 430, maxAmt: 980, countries: ["DE", "ES"], hasFraudTx: false },
    { id: 3, rows: "2,5M lignes", minAmt: 1050, maxAmt: 8900, countries: ["FR", "CH"], hasFraudTx: true },
    { id: 4, rows: "2,5M lignes", minAmt: 12, maxAmt: 650, countries: ["IT", "NL"], hasFraudTx: false }
  ];

  const allCols = [
    { key: "tx_id", label: "tx_id (FOR+BitPack)", mbPerRg: 18 },
    { key: "country", label: "country (DICT+RLE)", mbPerRg: 6 },
    { key: "amount", label: "amount (DECIMAL)", mbPerRg: 28 },
    { key: "payload_log", label: "payload_log (TEXT lourd)", mbPerRg: 198 }
  ];

  const state = {
    query: "high_fr",
    codec: "zstd",
    corruptWrite: false
  };

  const queries = {
    high_fr: {
      sql: "SELECT country, SUM(amount) FROM sales WHERE amount > 1000 AND country = 'FR'",
      neededCols: ["country", "amount"],
      matchRg: (rg) => rg.maxAmt > 1000 && rg.countries.includes("FR"),
      skipReason: (rg) => (rg.maxAmt <= 1000 ? `Zone Map max=${rg.maxAmt} <= 1000` : `Dict '${rg.countries.join(",")}' != FR`)
    },
    bloom_tx: {
      sql: "SELECT tx_id, amount FROM sales WHERE tx_id = 'TX-994812-FRAUD'",
      neededCols: ["tx_id", "amount"],
      matchRg: (rg) => rg.hasFraudTx,
      skipReason: () => "Bloom Filter = ABSENT garanti (0 faux négatif)"
    },
    full_star: {
      sql: "SELECT * FROM sales  -- Anti-pattern analytique !",
      neededCols: ["tx_id", "country", "amount", "payload_log"],
      matchRg: () => true,
      skipReason: () => ""
    }
  };

  const codecFactor = {
    csv: { name: "CSV Brut (Lignes — Sans métadonnées)", mult: 3.4 },
    snappy: { name: "Parquet + Snappy (Latence ultra-faible)", mult: 1.0 },
    zstd: { name: "Parquet + ZSTD Niv. 5 (Recommandé prod)", mult: 0.86 }
  };

  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    const q = queries[state.query];
    const cf = codecFactor[state.codec];
    const isCsv = state.codec === "csv";

    const rawTotalMb = Math.round(4 * 250 * 3.4);
    let readMb = 0;
    let scannedChunks = 0;
    const totalChunks = rowGroups.length * allCols.length;

    const rgViews = rowGroups.map((rg) => {
      const rgMatches = isCsv ? true : q.matchRg(rg);
      const chunks = allCols.map((col) => {
        const colNeeded = isCsv ? true : q.neededCols.includes(col.key);
        const isRead = rgMatches && colNeeded;
        if (isRead) {
          scannedChunks += 1;
          readMb += col.mbPerRg * cf.mult;
        }
        return {
          col,
          isRead,
          reason: !colNeeded ? "Column Pruned" : (!rgMatches ? q.skipReason(rg) : "Lu & Vectorisé SIMD")
        };
      });
      return { rg, rgMatches, chunks };
    });

    readMb = Math.max(1, Math.round(readMb));
    const savedPct = Math.max(0, Math.round((1 - readMb / rawTotalMb) * 100));

    const logs = [];
    if (state.corruptWrite) {
      logs.push({ s: "danger", t: "[CRASH DATA LAKE BRUT] Un job Spark a planté à 50 % d'écriture sur S3 : des fichiers _part-0002.parquet incomplets/orphelins polluent le dossier !" });
      logs.push({ s: "danger", t: "[ABSENCE D'ACID] Sans couche transactionnelle (Lakehouse), les lecteurs concurrents lisent un état corrompu et partiel." });
    } else if (isCsv) {
      logs.push({ s: "warn", t: `[CSV ORIENTÉ LIGNES] Aucune Zone Map ni découpage colonnaire : lecture intégrale obligatoire de ${rawTotalMb} Mo sur le disque !` });
    } else {
      logs.push({ s: "info", t: `[ÉTAPE 1 : FOOTER] Lecture unique du File Footer en fin de fichier (quelques Ko) -> Schéma + Offsets + Zone Maps chargés.` });
      logs.push({ s: "ok", t: `[ÉTAPE 2 : ÉLAGAGE] ${totalChunks - scannedChunks}/${totalChunks} Column Chunks ignorés sans le moindre appel disque (${savedPct} % d'I/O économisés vs CSV).` });
    }

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Requête OLAP :</span>
        <button type="button" class="bd-btn ${state.query === "high_fr" ? "is-active" : ""}" data-q="high_fr">
          <i class="bi bi-funnel"></i> Zone Map + Dictionnaire
        </button>
        <button type="button" class="bd-btn ${state.query === "bloom_tx" ? "is-active" : ""}" data-q="bloom_tx">
          <i class="bi bi-bullseye"></i> Recherche Clé (Bloom Filter)
        </button>
        <button type="button" class="bd-btn ${state.query === "full_star" ? "is-active" : ""}" data-q="full_star" data-variant="warning">
          <i class="bi bi-exclamation-triangle"></i> SELECT * (Anti-pattern)
        </button>
        <button type="button" class="bd-btn ${state.corruptWrite ? "is-active" : ""}" data-action="corrupt" data-variant="danger">
          <i class="bi bi-lightning-fill"></i> Simuler Crash Écriture Brute
        </button>
      </div>

      <div class="bd-controls-row">
        <div class="bd-control-group">
          <div class="bd-control-head">
            <span>Format physique & Codec de compression par Page</span>
          </div>
          <select class="bd-select" data-input="codec">
            <option value="zstd" ${state.codec === "zstd" ? "selected" : ""}>Parquet + ZSTD Niv. 5 (-14 % vs Snappy, recommandé prod)</option>
            <option value="snappy" ${state.codec === "snappy" ? "selected" : ""}>Parquet + Snappy (Décompression ultra-rapide)</option>
            <option value="csv" ${state.codec === "csv" ? "selected" : ""}>CSV Brut Orienté Lignes (Référence sans élagage)</option>
          </select>
        </div>
        <div class="bd-control-group">
          <div class="bd-control-head">
            <span>Requête SQL soumise au moteur</span>
          </div>
          <div class="small"><code>${q.sql}</code></div>
        </div>
      </div>

      <div class="bd-metrics">
        <div class="bd-metric" data-state="${isCsv ? "danger" : "ok"}">
          <div class="bd-metric-label">Volume Disque Lu</div>
          <div class="bd-metric-val">${readMb} Mo</div>
          <div class="bd-metric-sub">sur ${rawTotalMb} Mo bruts CSV</div>
        </div>
        <div class="bd-metric" data-state="${savedPct > 70 ? "ok" : "warn"}">
          <div class="bd-metric-label">Économie Bande Passante I/O</div>
          <div class="bd-metric-val">${savedPct} %</div>
          <div class="bd-metric-sub">${scannedChunks} / ${totalChunks} Column Chunks lus</div>
        </div>
        <div class="bd-metric" data-state="${state.corruptWrite ? "danger" : "info"}">
          <div class="bd-metric-label">Intégrité Transactionnelle</div>
          <div class="bd-metric-val">${state.corruptWrite ? "CORROMPUE !" : "Fichier Immuable"}</div>
          <div class="bd-metric-sub">${state.corruptWrite ? "Lecture partielle (pas d'ACID)" : "Write-Once sur stockage objet"}</div>
        </div>
      </div>

      ${rgViews.map(({ rg, rgMatches, chunks }) => `
        <div class="bd-zone" data-state="${state.corruptWrite && rg.id === 4 ? "danger" : (rgMatches ? "info" : "ok")}">
          <div class="bd-zone-header">
            <span class="bd-zone-title">
              <i class="bi bi-view-stacked"></i> Row Group #${rg.id} (${rg.rows} · ~250 Mo) — Zone Map amount: [${rg.minAmt}, ${rg.maxAmt}] · Dict: {${rg.countries.join(", ")}}
            </span>
            <span class="bd-pill" data-state="${state.corruptWrite && rg.id === 4 ? "danger" : (rgMatches ? "info" : "ok")}">
              ${state.corruptWrite && rg.id === 4 ? "FICHIER ORPHELIN TRONQUÉ !" : (rgMatches ? "Inspecté" : "Row Group Sauté (0 I/O)")}
            </span>
          </div>
          <div class="bd-parquet-grid">
            ${chunks.map((c) => `
              <div class="bd-node" data-state="${state.corruptWrite && rg.id === 4 ? "danger" : (c.isRead ? "scanned" : "pruned")}">
                <div class="bd-node-head"><span>${c.col.key}</span></div>
                <div class="bd-node-body">${c.reason}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("")}

      <div class="bd-footer-box">
        <span><i class="bi bi-file-earmark-binary"></i> <strong>File Footer Parquet (lu en premier à la fin du fichier)</strong> : Schéma + Encodages DICT/RLE/FOR + Offsets + Zone Maps Min/Max + Bloom Filters</span>
        <span class="bd-pill" data-state="violet">PAR1 Magic Bytes</span>
      </div>

      <div class="bd-console">
        ${logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">&gt; ${l.t}</div>`).join("")}
      </div>
    `;

    root.querySelectorAll("[data-q]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.query = btn.dataset.q;
        state.corruptWrite = false;
        render();
      });
    });

    const corruptBtn = root.querySelector('[data-action="corrupt"]');
    if (corruptBtn) {
      corruptBtn.addEventListener("click", () => {
        state.corruptWrite = !state.corruptWrite;
        render();
      });
    }

    const codecSelect = root.querySelector('[data-input="codec"]');
    if (codecSelect) {
      codecSelect.addEventListener("change", (e) => {
        state.codec = e.target.value;
        render();
      });
    }
  }

  render();
  return root;
}

// ==========================================================================
// 2. SIMULATEUR DE PIPELINE : ETL vs ELT vs ARCHITECTURE HYBRIDE (datawarehouse.qmd)
// ==========================================================================

export function createHybridPipelineSimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const state = {
    arch: "hybrid",
    anomalyInjected: true
  };

  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    const hasAnom = state.anomalyInjected;
    const archData = {
      etl: {
        latency: "145 min",
        latencyState: "danger",
        throughput: "8 500 enreg./s",
        critAcc: "99,7 %",
        critState: "ok",
        incidents: "0,2 Critique · 1,1 Majeur / mois",
        cost: "24 500 $ / mois",
        zones: [
          {
            title: "1. Extraction & Serveur Staging Dédié",
            state: "warn",
            badge: "Goulot Mono-Moteur !",
            desc: "100 % des flux (y compris 1,5 To de clics web peu risqués) font la queue derrière le moteur de validation Schema-on-Write."
          },
          {
            title: "2. Contrôle Préventif A Priori",
            state: "ok",
            badge: "Couverture 100 %",
            desc: hasAnom
              ? "Anomalie financière (-45 000 €) bloquée net à la frontière ! Aucune ligne viciée n'entre, mais le batch prend 2h25."
              : "Validation exhaustive des types, clés étrangères et règles comptables."
          },
          {
            title: "3. Data Warehouse Décisionnel",
            state: "warn",
            badge: "Propre mais en retard",
            desc: "Indicateurs exacts à 99,7 %, mais fraîcheur incompatible avec le pilotage quasi temps réel."
          }
        ]
      },
      elt: {
        latency: "68 min",
        latencyState: "ok",
        throughput: "45 000 enreg./s",
        critAcc: hasAnom ? "96,8 % (Dégradée !)" : "98,4 %",
        critState: hasAnom ? "danger" : "warn",
        incidents: "4,5 Critiques · 12,3 Majeurs / mois",
        cost: "15 200 $ / mois",
        zones: [
          {
            title: "1. Ingestion Brute Immédiate (Extract & Load)",
            state: "ok",
            badge: "Vitesse Maximale",
            desc: "Déversement direct sans filtrage dans Snowflake / BigQuery / Redshift (Schema-on-Read)."
          },
          {
            title: "2. Transformations SQL In-Database",
            state: hasAnom ? "danger" : "warn",
            badge: "Validation Détective (35 %)",
            desc: hasAnom
              ? "Contrôles exécutés APRÈS chargement : la facture -45 000 € et la clé fournisseur orpheline traversent les jointures !"
              : "Transformations SQL rapides, mais couverture de contrôle partielle (35 %)."
          },
          {
            title: "3. Dashboards Direction & ML",
            state: hasAnom ? "danger" : "ok",
            badge: hasAnom ? "POLLUTION MÉTIER (68 % des orgs)" : "Flux nominal",
            desc: hasAnom
              ? "Chiffre d'affaires erroné affiché au COMEX avant détection de l'incident -> perte de confiance et retour à Excel !"
              : "Indicateurs servis rapidement tant que les sources amont restent propres."
          }
        ]
      },
      hybrid: {
        latency: "72 min (-50,3 % vs ETL)",
        latencyState: "ok",
        throughput: "38 000 enreg./s (+347 % vs ETL)",
        critAcc: "99,5 %",
        critState: "ok",
        incidents: "0,4 Critique · 3,8 Majeurs (-67 % vs ELT !)",
        cost: "17 800 $ / mois (-27,3 % vs ETL)",
        zones: [
          {
            title: "1. Classification Engine (4 Critères)",
            state: "info",
            badge: "Routage Intelligent",
            desc: "Évalue Criticalité, Complexité, Volume et Risque : sépare les transactions financières (<100 Go) du clickstream (>1 To)."
          },
          {
            title: "2A. Voie ETL (Critique) + 2B. Voie ELT (Volume)",
            state: "ok",
            badge: "Validation Ciblée 78 %",
            desc: hasAnom
              ? "La facture -45 000 € est interceptée en Staging ETL pendant que le téraoctet de clics file à pleine vitesse en SQL Cloud !"
              : "Chaque flux emprunte le circuit adapté à son profil de risque et de volumétrie."
          },
          {
            title: "3. Integration Layer & Control Plane",
            state: "ok",
            badge: "Réconcilié & Supervisé",
            desc: "Jointure intègre entre dimensions maîtresses certifiées (ETL) et tables de faits massives (ELT) en 72 min."
          }
        ]
      }
    };

    const d = archData[state.arch];
    const logs = [];

    if (state.arch === "etl") {
      logs.push({ s: "ok", t: state.anomalyInjected ? "[DOUANE ETL] Transaction revenu négative (-45 000 €) interceptée en Staging avant chargement." : "[DOUANE ETL] Validation préventive complète effectuée." });
      logs.push({ s: "warn", t: "[GOULOT] Le téraoctet d'événements Web Analytics engorge le serveur ETL pendant 145 minutes !" });
    } else if (state.arch === "elt") {
      logs.push({ s: "info", t: "[AUTOROUTE ELT] 1,5 To chargés en 68 minutes grâce au parallélisme massif du Cloud Data Warehouse." });
      if (state.anomalyInjected) {
        logs.push({ s: "danger", t: "[INCIDENT CRITIQUE] La transaction corrompue et une clé fournisseur invalide ont déjà faussé le Dashboard Financier !" });
      }
    } else {
      logs.push({ s: "info", t: "[CLASSIFICATION ENGINE] Flux Revenus & Référentiel Fournisseurs -> Voie Critique ETL | Flux Web Analytics (1,5 To) -> Voie Volume ELT." });
      if (state.anomalyInjected) {
        logs.push({ s: "ok", t: "[PROTECTION CHIRURGICALE] L'anomalie comptable est bloquée en Staging ETL sans ralentir d'une seconde le flux analytique Cloud (72 min total) !" });
      }
    }

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Architecture :</span>
        <button type="button" class="bd-btn ${state.arch === "etl" ? "is-active" : ""}" data-arch="etl" data-variant="warning">
          <i class="bi bi-shield-check"></i> Pure ETL (Qualité d'abord)
        </button>
        <button type="button" class="bd-btn ${state.arch === "elt" ? "is-active" : ""}" data-arch="elt" data-variant="danger">
          <i class="bi bi-speedometer2"></i> Pure ELT (Vitesse d'abord)
        </button>
        <button type="button" class="bd-btn ${state.arch === "hybrid" ? "is-active" : ""}" data-arch="hybrid" data-variant="success">
          <i class="bi bi-signpost-split"></i> Hybride (Varma 2024)
        </button>
        <button type="button" class="bd-btn ${state.anomalyInjected ? "is-active" : ""}" data-action="anomaly" data-variant="danger">
          <i class="bi bi-bug-fill"></i> ${state.anomalyInjected ? "Anomalie Financière + Pic 1,5 To : ACTIFS" : "Injecter Anomalie Financière + Pic 1,5 To"}
        </button>
      </div>

      <div class="bd-metrics">
        <div class="bd-metric" data-state="${d.latencyState}">
          <div class="bd-metric-label">Latence Moyenne</div>
          <div class="bd-metric-val">${d.latency}</div>
          <div class="bd-metric-sub">Débit : ${d.throughput}</div>
        </div>
        <div class="bd-metric" data-state="${d.critState}">
          <div class="bd-metric-label">Exactitude Critique</div>
          <div class="bd-metric-val">${d.critAcc}</div>
          <div class="bd-metric-sub">${d.incidents}</div>
        </div>
        <div class="bd-metric" data-state="info">
          <div class="bd-metric-label">Coût Mensuel Infra</div>
          <div class="bd-metric-val">${d.cost}</div>
          <div class="bd-metric-sub">Benchmark Varma (2024)</div>
        </div>
      </div>

      <div class="bd-topology-3">
        ${d.zones.map((z) => `
          <div class="bd-zone" data-state="${z.state}">
            <div class="bd-zone-header">
              <span class="bd-zone-title">${z.title}</span>
              <span class="bd-pill" data-state="${z.state}">${z.badge}</span>
            </div>
            <div class="bd-node-body">${z.desc}</div>
          </div>
        `).join("")}
      </div>

      <div class="bd-console">
        ${logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">&gt; ${l.t}</div>`).join("")}
      </div>
    `;

    root.querySelectorAll("[data-arch]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.arch = btn.dataset.arch;
        render();
      });
    });

    const anomBtn = root.querySelector('[data-action="anomaly"]');
    if (anomBtn) {
      anomBtn.addEventListener("click", () => {
        state.anomalyInjected = !state.anomalyInjected;
        render();
      });
    }
  }

  render();
  return root;
}

// ==========================================================================
// 3. SIMULATEUR LAKEHOUSE : OCC, DELETION VECTORS, HMS TIMEOUT & CoW/MoR (datalakehouse.qmd)
// ==========================================================================

export function createLakehouseOccSimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const scenarios = {
    occ_file_conflict: {
      metrics: [
        { l: "Granularité OCC", v: "Fichier Parquet", sub: "Mode historique sans Row Tracking", s: "warn" },
        { l: "Snapshot Initial", v: "V_start = v12", sub: "Lu par Tx A et Tx B simultanément", s: "info" },
        { l: "Transaction A", v: "VALIDÉE (v13)", sub: "Modifie ligne #42 dans part-01.parquet", s: "ok" },
        { l: "Transaction B", v: "REJETÉE !", sub: "ConcurrentDeleteReadException", s: "danger" }
      ],
      zones: [
        {
          title: "Transaction A (UPDATE ligne #42)",
          state: "ok",
          badge: "Commit v13 Réussi",
          blocks: [{ t: "Lit part-01.parquet @v12", s: "info" }, { t: "Écrit part-01-v13.parquet", s: "ok" }]
        },
        {
          title: "Transaction B (UPDATE ligne #980 — Même fichier !)",
          state: "danger",
          badge: "Conflit OCC Détecté",
          blocks: [{ t: "V_start(v12) < V_commit(v13)", s: "warn" }, { t: "Exception : part-01 déjà réécrit !", s: "danger" }]
        },
        {
          title: "Lecteurs SQL Concurrents (MVCC)",
          state: "ok",
          badge: "Isolation Snapshot",
          blocks: [{ t: "Lisent v12 puis v13 sans aucun verrouillage", s: "ok" }]
        }
      ],
      logs: [
        { s: "info", t: "[MVCC] Tx A et Tx B démarrent toutes deux sur l'instantané V_start = v12 et ciblent deux lignes distinctes de part-01.parquet (100 Mo)." },
        { s: "ok", t: "[COMMIT v13] Tx A valide en premier via put-if-absent dans _delta_log/000013.json." },
        { s: "danger", t: "[CONFLIT OCC] Au moment de valider Tx B, le moteur constate que part-01.parquet a été remplacé par v13 -> lève ConcurrentDeleteReadException !" }
      ]
    },
    row_level_dv: {
      metrics: [
        { l: "Granularité OCC", v: "Niveau Ligne (Row ID)", sub: "Deletion Vectors + Row Tracking", s: "ok" },
        { l: "Amplification Écriture", v: "Quasi Nulle (Bitmaps)", sub: "Pas de réécriture des 100 Mo Parquet", s: "ok" },
        { l: "Transaction A (#42)", v: "VALIDÉE (v13)", sub: "Bitmap DV_A enregistré", s: "ok" },
        { l: "Transaction B (#980)", v: "VALIDÉE (v14) !", sub: "Fusion atomique des bitmaps DV", s: "ok" }
      ],
      zones: [
        {
          title: "Fichier de Base Immuable (part-01.parquet · 100 Mo)",
          state: "info",
          badge: "Conservé Intact !",
          blocks: [{ t: "1 000 000 lignes conservées sans réécriture", s: "primary" }]
        },
        {
          title: "Vecteurs de Suppression (Bitmaps Roaring)",
          state: "ok",
          badge: "Fusionnés sans Conflit",
          blocks: [{ t: "DV Tx A : bit #42 masqué (4 Ko)", s: "ok" }, { t: "DV Tx B : bit #980 masqué (4 Ko)", s: "healing" }]
        },
        {
          title: "Journal _delta_log / Manifestes Iceberg",
          state: "ok",
          badge: "v12 → v13 → v14",
          blocks: [{ t: "Row IDs distincts (#42 != #980) -> Auto-réconciliation !", s: "ok" }]
        }
      ],
      logs: [
        { s: "ok", t: "[ROW-LEVEL CONCURRENCY] Grâce au traçage des lignes (Row Tracking), le validateur vérifie que #42 et #980 ne se chevauchent pas." },
        { s: "ok", t: "[DELETION VECTORS] Au lieu de rejeter Tx B ou de réécrire 100 Mo, le moteur combine les bitmaps de suppression : les deux transactions réussissent !" }
      ]
    },
    hms_timeout: {
      metrics: [
        { l: "Mécanisme Commit", v: "Verrou Externe HMS", sub: "Hive MetaStore Lock Heartbeat", s: "danger" },
        { l: "Incident Réseau", v: "Pause GC / Timeout", sub: "Expiration prématurée du bail HMS", s: "danger" },
        { l: "Effet Critique", v: "DIRTY WRITE !", sub: "Écrasement mutuel de métadonnées", s: "danger" },
        { l: "Parade Recommandée", v: "put-if-absent / CAS", sub: "Primitives atomiques natives", s: "info" }
      ],
      zones: [
        {
          title: "Scripteur 1 (Pause GC pendant l'écriture)",
          state: "warn",
          badge: "Croît détenir le verrou !",
          blocks: [{ t: "Heartbeat HMS expiré", s: "danger" }, { t: "Écrit quand même son pointeur...", s: "warn" }]
        },
        {
          title: "Hive MetaStore (Service Externe)",
          state: "danger",
          badge: "Bail révoqué trop tôt",
          blocks: [{ t: "Attribue le verrou au Scripteur 2 !", s: "danger" }]
        },
        {
          title: "État de la Table (Jain et al., CIDR 2023)",
          state: "danger",
          badge: "TABLE CORROMPUE",
          blocks: [{ t: "Collision de pointeurs (Split-Brain)", s: "danger" }, { t: "Perte silencieuse de données", s: "danger" }]
        }
      ],
      logs: [
        { s: "warn", t: "[AVERTISSEMENT LHBench] Le Scripteur 1 acquiert un verrou externe HMS mais subit une pause réseau/GC dépassant le délai de heartbeat." },
        { s: "danger", t: "[DIRTY WRITE] HMS libère le verrou et l'accorde au Scripteur 2 alors que le Scripteur 1 finalise son écriture -> corruption de la table !" },
        { s: "info", t: "[BONNE PRATIQUE] Privilégiez les commits atomiques put-if-absent ou un coordinateur CAS strict (REST Catalog / DynamoDB)." }
      ]
    },
    cow_vs_mor: {
      metrics: [
        { l: "Copy-on-Write (CoW)", v: "100 Mo Réécrits", sub: "Pour 1 ligne modifiée (Lecture 0 surcoût)", s: "warn" },
        { l: "Merge-on-Read (MoR)", v: "10 Ko Écrits seuls", sub: "Idéal CDC / Streaming haute fréquence", s: "ok" },
        { l: "Dette Technique MoR", v: "18 443 Petits Fichiers", sub: "Latence lecture dégradée sans maintenance", s: "danger" },
        { l: "Après OPTIMIZE + VACUUM", v: "Fichiers 256-512 Mo", sub: "Deltas fusionnés & snapshots purgés", s: "ok" }
      ],
      zones: [
        {
          title: "Stratégie Copy-on-Write (CoW)",
          state: "info",
          badge: "Optimisé Lecture BI",
          blocks: [{ t: "Écriture lente (réécrit 100 Mo)", s: "warn" }, { t: "Lecture SQL directe ultra-rapide", s: "ok" }]
        },
        {
          title: "Stratégie Merge-on-Read (MoR)",
          state: "warn",
          badge: "Optimisé Ingestion CDC",
          blocks: [{ t: "Écriture éclair (Delta Avro/Bitmap 10 Ko)", s: "ok" }, { t: "Surcoût fusion à la volée en lecture", s: "warn" }]
        },
        {
          title: "Maintenance Obligatoire (Compaction)",
          state: "ok",
          badge: "OPTIMIZE / rewrite_data_files",
          blocks: [{ t: "Fusionne petits fichiers + deltas", s: "healing" }, { t: "VACUUM / expire_snapshots purge S3", s: "ok" }]
        }
      ],
      logs: [
        { s: "info", t: "[ARBITRAGE CoW vs MoR] CoW paie le coût à l'écriture (tables Gold BI) ; MoR diffère la fusion à la lecture (tables Silver CDC)." },
        { s: "ok", t: "[BENCHMARK LHBench] Sur 200 000 fichiers, la planification distribuée Spark de Delta surpasse le parcours single-node de 7× à 12× ; mais l'exécution régulière d'OPTIMIZE et VACUUM reste indispensable !" }
      ]
    }
  };

  let current = "occ_file_conflict";
  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    const sc = scenarios[current];

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Scénario Lakehouse :</span>
        <button type="button" class="bd-btn ${current === "occ_file_conflict" ? "is-active" : ""}" data-sc="occ_file_conflict" data-variant="danger">
          <i class="bi bi-intersect"></i> Conflit OCC (Fichier)
        </button>
        <button type="button" class="bd-btn ${current === "row_level_dv" ? "is-active" : ""}" data-sc="row_level_dv" data-variant="success">
          <i class="bi bi-grid-3x3-gap"></i> Deletion Vectors (Ligne)
        </button>
        <button type="button" class="bd-btn ${current === "hms_timeout" ? "is-active" : ""}" data-sc="hms_timeout" data-variant="danger">
          <i class="bi bi-stopwatch"></i> Panne Verrou HMS (Dirty Write)
        </button>
        <button type="button" class="bd-btn ${current === "cow_vs_mor" ? "is-active" : ""}" data-sc="cow_vs_mor" data-variant="warning">
          <i class="bi bi-layers-half"></i> CoW vs MoR & Compaction
        </button>
      </div>

      <div class="bd-metrics">
        ${sc.metrics.map((m) => `
          <div class="bd-metric" data-state="${m.s}">
            <div class="bd-metric-label">${m.l}</div>
            <div class="bd-metric-val">${m.v}</div>
            <div class="bd-metric-sub">${m.sub}</div>
          </div>
        `).join("")}
      </div>

      <div class="bd-topology-3">
        ${sc.zones.map((z) => `
          <div class="bd-zone" data-state="${z.state}">
            <div class="bd-zone-header">
              <span class="bd-zone-title">${z.title}</span>
              <span class="bd-pill" data-state="${z.state}">${z.badge}</span>
            </div>
            <div class="bd-blocks">
              ${z.blocks.map((b) => `<span class="bd-block" data-state="${b.s}">${b.t}</span>`).join("")}
            </div>
          </div>
        `).join("")}
      </div>

      <div class="bd-console">
        ${sc.logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">&gt; ${l.t}</div>`).join("")}
      </div>
    `;

    root.querySelectorAll("[data-sc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        current = btn.dataset.sc;
        render();
      });
    });
  }

  render();
  return root;
}

// ==========================================================================
// 4. SIMULATEUR MÉDAILLON : QUARANTAINE, IDEMPOTENCE & REPLAY (medaillon.qmd)
// ==========================================================================

export function createMedallionReplaySimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const state = {
    scenario: "quarantine_cdc",
    scdMode: "scd2",
    idempotentMerge: true
  };

  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    let bronzeState = "ok";
    let silverState = "ok";
    let goldState = "ok";
    let bronzeItems = [];
    let silverItems = [];
    let goldItems = [];
    let logs = [];

    if (state.scenario === "quarantine_cdc") {
      bronzeItems = [
        { t: "offset#101 : tx=501, amt=120.00 €", s: "primary" },
        { t: "offset#102 : tx=501, amt=120.00 € (Doublon Kafka)", s: "warn" },
        { t: "offset#103 : tx=502, amt=-95.00 € (Corrompu !)", s: "danger" },
        { t: "offset#104 : tx=503, email='alice@...' (PII)", s: "info" }
      ];
      silverItems = [
        { t: "tx=501 conservée 1× via ROW_NUMBER() = 1", s: "ok" },
        { t: "tx=503 -> email masqué SHA-256 (RGPD/PII)", s: "ok" },
        { t: "QUARANTAINE : tx=502 (amt <= 0) isolée sans crash !", s: "warn" }
      ];
      goldItems = [
        { t: "fact_sales : 2 ventes certifiées (Clés BIGINT NOT NULL)", s: "ok" },
        { t: "0 anomalie propagée aux dashboards BI", s: "ok" }
      ];
      logs = [
        { s: "info", t: "[BRONZE APPEND-ONLY] Les 4 messages Kafka (dont 1 doublon réseau et 1 montant négatif) sont archivés tels quels avec leur offset." },
        { s: "warn", t: "[SILVER QUALITY GATE] Au lieu de faire planter le job nocturne, la porte de quarantaine déroute tx=502 vers silver.quarantine_tx !" },
        { s: "ok", t: "[GOLD] Seules les transactions dédoublonnées et conformes alimentent le schéma en étoile." }
      ];
    } else if (state.scenario === "retry_idempotence") {
      const ok = state.idempotentMerge;
      goldState = ok ? "ok" : "danger";
      silverState = ok ? "ok" : "warn";
      bronzeItems = [
        { t: "Lot du 2026-11-15 : 1 000 transactions (50 000 €)", s: "primary" },
        { t: "Crash réseau Airflow à 99 % -> Relance automatique (Retry #2)", s: "warn" }
      ];
      silverItems = ok
        ? [{ t: "MERGE INTO silver.tx ON target.tx_id = src.tx_id", s: "ok" }, { t: "Retry #2 : 0 doublon créé (Idempotent !)", s: "ok" }]
        : [{ t: "INSERT INTO silver.tx SELECT ... (ANTI-PATTERN !)", s: "danger" }, { t: "Retry #2 : 2 000 lignes écrites en double !", s: "danger" }];
      goldItems = ok
        ? [{ t: "Chiffre d'affaires Gold = 50 000 € (Exact malgré 2 exécutions)", s: "ok" }]
        : [{ t: "FAUX CA GOLD = 100 000 € (+100 % d'erreur comptable !)", s: "danger" }];
      logs = ok
        ? [
            { s: "warn", t: "[RETRY ORCHESTRATEUR] Timeout réseau lors du commit : Airflow réexécute automatiquement la tâche sur la même tranche horaire." },
            { s: "ok", t: "[IDEMPOTENCE MERGE INTO] f(f(x)) = f(x) : les clés existantes sont reconnues, le chiffre d'affaires Gold reste rigoureusement exact à 50 000 € !" }
          ]
        : [
            { s: "danger", t: "[PIÈGE NON-IDEMPOTENT] Avec un simple INSERT INTO, la relance automatique d'Airflow double silencieusement toutes les ventes du jour !" },
            { s: "info", t: "[ACTION] Basculez le bouton « Mode d'écriture » sur MERGE INTO pour rendre le pipeline idempotent." }
          ];
    } else {
      // Downstream bug + Immutable Bronze Replay
      bronzeState = "ok";
      silverState = "ok";
      goldState = "ok";
      bronzeItems = [
        { t: "Historique brut 90 jours intact (Preserve Everything)", s: "ok" },
        { t: "Taux devise JSON d'origine préservé", s: "primary" }
      ];
      silverItems = [
        { t: "Re-lecture incrémentale depuis l'offset de l'incident", s: "healing" },
        { t: "Tables Silver propres et inchangées", s: "ok" }
      ];
      goldItems = [
        { t: "Bug formule TVA/Devise corrigé dans le modèle Gold", s: "healing" },
        { t: "Replay terminé : 90 jours recalculés sans perte !", s: "ok" }
      ];
      logs = [
        { s: "danger", t: "[INCIDENT MÉTIER] Un bug de conversion USD -> EUR introduit vendredi dernier a faussé les agrégats Gold sur 5 jours." },
        { s: "ok", t: "[VALEUR DU BRONZE IMMUABLE] Parce que la couche Bronze n'a subi aucune transformation destructrice, l'équipe corrige le SQL et rejoue (Replay) l'historique sans jamais solliciter les API sources !" }
      ];
    }

    const scdRows = state.scdMode === "scd2"
      ? [
          { k: "1001", id: "CLI-42", city: "Lyon", from: "2024-01-01", to: "2026-06-14", cur: "false", st: "muted" },
          { k: "1089", id: "CLI-42", city: "Bordeaux", from: "2026-06-15", to: "NULL", cur: "true", st: "ok" }
        ]
      : [
          { k: "1001", id: "CLI-42", city: "Bordeaux (Lyon écrasé !)", from: "—", to: "—", cur: "true", st: "warn" }
        ];

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Scénario Médaillon :</span>
        <button type="button" class="bd-btn ${state.scenario === "quarantine_cdc" ? "is-active" : ""}" data-sc="quarantine_cdc" data-variant="success">
          <i class="bi bi-funnel-fill"></i> Quarantaine Silver & CDC
        </button>
        <button type="button" class="bd-btn ${state.scenario === "retry_idempotence" ? "is-active" : ""}" data-sc="retry_idempotence" data-variant="danger">
          <i class="bi bi-arrow-repeat"></i> Crash Retry & Idempotence
        </button>
        <button type="button" class="bd-btn ${state.scenario === "bronze_replay" ? "is-active" : ""}" data-sc="bronze_replay" data-variant="warning">
          <i class="bi bi-rewind-circle"></i> Bug Aval & Replay Bronze
        </button>
        ${state.scenario === "retry_idempotence" ? `
          <button type="button" class="bd-btn ${state.idempotentMerge ? "is-active" : ""}" data-action="toggle-merge" data-variant="${state.idempotentMerge ? "success" : "danger"}">
            <i class="bi bi-code-square"></i> Mode : ${state.idempotentMerge ? "MERGE INTO (Idempotent)" : "INSERT INTO (Doublons !)" }
          </button>
        ` : ""}
      </div>

      <div class="bd-topology-3">
        <div class="bd-zone" data-state="${bronzeState}">
          <div class="bd-zone-header">
            <span class="bd-zone-title"><i class="bi bi-archive"></i> 1. Couche Bronze (Brut Immuable)</span>
            <span class="bd-pill" data-state="primary">Append-Only</span>
          </div>
          <div class="bd-blocks">
            ${bronzeItems.map((it) => `<span class="bd-block" data-state="${it.s}">${it.t}</span>`).join("")}
          </div>
        </div>

        <div class="bd-zone" data-state="${silverState}">
          <div class="bd-zone-header">
            <span class="bd-zone-title"><i class="bi bi-droplet-half"></i> 2. Couche Silver (Nettoyé & Conforme)</span>
            <span class="bd-pill" data-state="${silverState}">Quality Gate</span>
          </div>
          <div class="bd-blocks">
            ${silverItems.map((it) => `<span class="bd-block" data-state="${it.s}">${it.t}</span>`).join("")}
          </div>
        </div>

        <div class="bd-zone" data-state="${goldState}">
          <div class="bd-zone-header">
            <span class="bd-zone-title"><i class="bi bi-trophy"></i> 3. Couche Gold (Modèle Kimball BI)</span>
            <span class="bd-pill" data-state="${goldState}">Star Schema</span>
          </div>
          <div class="bd-blocks">
            ${goldItems.map((it) => `<span class="bd-block" data-state="${it.s}">${it.t}</span>`).join("")}
          </div>
        </div>
      </div>

      <div class="bd-zone" data-state="info">
        <div class="bd-zone-header">
          <span class="bd-zone-title"><i class="bi bi-clock-history"></i> Dimension Client Gold (<code>gold.dim_customers</code>) — Déménagement Lyon → Bordeaux le 15/06/2026</span>
          <div class="d-flex gap-2">
            <button type="button" class="bd-btn ${state.scdMode === "scd1" ? "is-active" : ""}" data-scd="scd1" data-variant="warning">SCD Type 1 (Écrase)</button>
            <button type="button" class="bd-btn ${state.scdMode === "scd2" ? "is-active" : ""}" data-scd="scd2" data-variant="success">SCD Type 2 (Historise)</button>
          </div>
        </div>
        <table class="bd-mini-table">
          <thead>
            <tr>
              <th>customer_key (BIGINT)</th>
              <th>customer_id</th>
              <th>city</th>
              <th>valid_from</th>
              <th>valid_to</th>
              <th>is_current</th>
            </tr>
          </thead>
          <tbody>
            ${scdRows.map((r) => `
              <tr data-state="${r.st}">
                <td>${r.k}</td>
                <td>${r.id}</td>
                <td>${r.city}</td>
                <td>${r.from}</td>
                <td>${r.to}</td>
                <td>${r.cur}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="small">
          ${state.scdMode === "scd2"
            ? "Avec <strong>SCD Type 2</strong>, les ventes de 2025 restent rattachées à <code>customer_key = 1001</code> (Lyon), tandis que les ventes post-15/06/2026 pointent vers <code>1089</code> (Bordeaux) !"
            : "Attention : en <strong>SCD Type 1</strong>, l'écrasement réattribue rétroactivement toutes les ventes historiques de 2024-2025 à Bordeaux !"}
        </div>
      </div>

      <div class="bd-console">
        ${logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">&gt; ${l.t}</div>`).join("")}
      </div>
    `;

    root.querySelectorAll("[data-sc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.scenario = btn.dataset.sc;
        render();
      });
    });

    const mergeBtn = root.querySelector('[data-action="toggle-merge"]');
    if (mergeBtn) {
      mergeBtn.addEventListener("click", () => {
        state.idempotentMerge = !state.idempotentMerge;
        render();
      });
    }

    root.querySelectorAll("[data-scd]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.scdMode = btn.dataset.scd;
        render();
      });
    });
  }

  render();
  return root;
}

export function renderVarmaIncidentsChart(divId) {
  const target = resolveTarget(typeof divId === "string" && !divId.startsWith("#") ? `#${divId}` : divId);
  if (!target || typeof Plotly === "undefined") return null;
  const x = ["Critique", "Majeur", "Mineur"];
  const traces = [
    { name: "Pure ETL", x, y: [0.2, 1.1, 3.5], type: "bar", marker: { color: getThemeColor("--sol-blue", ""), opacity: 0.88 } },
    { name: "Architecture Hybride (Varma)", x, y: [0.4, 3.8, 9.2], type: "bar", marker: { color: getThemeColor("--sol-green", ""), opacity: 0.88 } },
    { name: "Pure ELT", x, y: [4.5, 12.3, 24.5], type: "bar", marker: { color: getThemeColor("--sol-red", ""), opacity: 0.88 } }
  ];
  const layout = {
    barmode: "group",
    height: 290,
    template: getPlotlyTheme(),
    margin: { t: 35, b: 35, l: 48, r: 16 },
    yaxis: { title: "Incidents / mois" },
    legend: { orientation: "h", yanchor: "bottom", y: 1.02, xanchor: "right", x: 1 }
  };
  Plotly.newPlot(target.id, traces, layout, { responsive: true, displayModeBar: false });
  return target;
}
