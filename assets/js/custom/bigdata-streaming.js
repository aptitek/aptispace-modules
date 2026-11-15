// ==========================================================================
// bigdata-streaming.js — Simulateurs interactifs complémentaires Big Data
// Chapitres : consensus.qmd, nosql.qmd, kafka-cdc.qmd, streaming.qmd,
//             orchestration-gouvernance.qmd
// ==========================================================================

function resolveTarget(container) {
  return typeof container === "string" ? document.querySelector(container) : container;
}

function applyFillBars(root) {
  root.querySelectorAll("[data-fill]").forEach((el) => {
    el.style.setProperty("--bd-fill", `${el.dataset.fill}%`);
  });
}

// ==========================================================================
// 1. SIMULATEUR CONSENSUS RAFT, QUORUMS & FENCING TOKENS (consensus.qmd)
// ==========================================================================

export function createConsensusFencingSimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const state = {
    mode: "quorum",
    w: 3,
    r: 3
  };

  const modes = {
    quorum: { label: "Quorum Sans Chef (W + R > N)", variant: "primary", icon: "bi-intersect" },
    raft_crash: { label: "Crash Leader Raft & Élection", variant: "warning", icon: "bi-lightning-charge" },
    split_nofence: { label: "Split-Brain Sans Fencing (Corruption)", variant: "danger", icon: "bi-bug-fill" },
    split_fenced: { label: "Jeton de Clôture (Fencing Token)", variant: "success", icon: "bi-shield-check" }
  };

  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    const N = 5;
    const strictQuorum = state.w + state.r > N;

    let metrics = [];
    let banner = { state: "ok", left: "", right: "" };
    let zonesHtml = "";
    let logs = [];

    if (state.mode === "quorum") {
      const writeSet = [1, 2, 3, 4, 5].slice(0, state.w);
      const readSet = [5, 4, 3, 2, 1].slice(0, state.r);
      const overlap = writeSet.filter((id) => readSet.includes(id));

      metrics = [
        { l: "Répliques (N)", v: "5 nœuds", sub: "Topologie sans chef", s: "info" },
        { l: "Somme W + R", v: `${state.w} + ${state.r} = ${state.w + state.r}`, sub: strictQuorum ? "> 5 (Intersection garantie)" : "<= 5 (Disjoint possible !)", s: strictQuorum ? "ok" : "danger" },
        { l: "Nœuds en commun", v: `${overlap.length} réplique(s)`, sub: overlap.length > 0 ? `Chevauchement : N${overlap.join(", N")}` : "AUCUN chevauchement !", s: overlap.length > 0 ? "ok" : "danger" },
        { l: "Valeur retournée", v: overlap.length > 0 ? "v2 ( fraîche )" : "v1 ( OBSOLÈTE )", sub: overlap.length > 0 ? "Max timestamp retenu" : "Stale Read silencieux", s: overlap.length > 0 ? "ok" : "danger" }
      ];

      banner = strictQuorum
        ? { state: "ok", left: `Quorum strict respecté (${state.w} + ${state.r} > 5)`, right: `Tolère ${N - Math.max(state.w, state.r)} panne(s) sans lecture obsolète` }
        : { state: "danger", left: `Quorum faible (${state.w} + ${state.r} <= 5) : ensembles W et R disjoints !`, right: "Le lecteur interroge uniquement des répliques non mises à jour" };

      const nodesCards = [1, 2, 3, 4, 5].map((id) => {
        const inW = writeSet.includes(id);
        const inR = readSet.includes(id);
        const both = inW && inR;
        const st = both ? "ok" : inW ? "scanned" : inR ? "warn" : "pruned";
        const badge = both ? "ÉCRIT + LU (v2)" : inW ? "ÉCRIT (v2)" : inR ? "LU SEUL (v1 !)" : "Ignoré (v1)";
        const bState = both ? "ok" : inW ? "info" : inR ? "danger" : "";
        return `
          <div class="bd-node" data-state="${st}">
            <div class="bd-node-head">
              <span><i class="bi bi-hdd-network me-1"></i>Réplique N${id}</span>
              <span class="bd-pill" data-state="${bState}">${badge}</span>
            </div>
            <div class="bd-node-body">État local : <code>${inW ? "solde = 950 EUR (t=2)" : "solde = 400 EUR (t=1)"}</code></div>
          </div>
        `;
      }).join("");

      zonesHtml = `
        <div class="bd-zone" data-state="${strictQuorum ? "ok" : "danger"}">
          <div class="bd-zone-header">
            <span class="bd-zone-title"><i class="bi bi-diagram-3-fill"></i> Anneau de 5 Répliques (Ajustez W et R ci-dessus)</span>
            <span class="bd-pill" data-state="${strictQuorum ? "ok" : "danger"}">${strictQuorum ? "Quorum Strict" : "Sloppy / Éventuel"}</span>
          </div>
          <div class="bd-topology-3">${nodesCards}</div>
        </div>
      `;

      logs = strictQuorum
        ? [
            { s: "info", t: `[WRITE W=${state.w}] Client propage (solde=950, t=2) sur [N${writeSet.join(", N")}].` },
            { s: "ok", t: `[READ R=${state.r}] Lecteur sonde [N${readSet.join(", N")}] -> trouve t=2 sur [N${overlap.join(", N")}] et déclenche un Read-Repair asynchrone.` }
          ]
        : [
            { s: "warn", t: `[WRITE W=${state.w}] Écriture acquittée rapidement sur [N${writeSet.join(", N")}], mais pas encore propagée aux autres.` },
            { s: "danger", t: `[STALE READ R=${state.r}] Lecteur sonde [N${readSet.join(", N")}] : aucune réplique n'a vu t=2 ! L'application lit l'ancien solde 400 EUR.` }
          ];
    } else if (state.mode === "raft_crash") {
      metrics = [
        { l: "Mandat Raft (Term)", v: "Term 7 -> 8", sub: "Horloge logique monotone", s: "info" },
        { l: "Majorité requise", v: "3 / 5 votes", sub: "lfloor N/2 rfloor + 1", s: "ok" },
        { l: "Ancien Leader N1", v: "CRASHÉ", sub: "Timeout élection 180 ms", s: "danger" },
        { l: "Nouveau Leader", v: "Nœud N2 (Term 8)", sub: "Journal validé préservé", s: "ok" }
      ];
      banner = { state: "ok", left: "Élection Raft terminée en 185 ms : N2 élu Leader du Term 8 avec 3 voix (N2, N3, N4)", right: "Zéro perte d'entrée engagée" };
      zonesHtml = `
        <div class="bd-topology-3">
          <div class="bd-zone" data-state="offline">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-x-octagon-fill"></i> N1 (Ex-Leader)</span><span class="bd-pill" data-state="danger">Term 7 · Hors ligne</span></div>
            <div class="bd-blocks"><span class="bd-block" data-state="idle">idx 1..42 (commited)</span></div>
          </div>
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-award-fill"></i> N2 (Nouveau Leader)</span><span class="bd-pill" data-state="ok">Term 8 · 3/5 votes</span></div>
            <div class="bd-blocks"><span class="bd-block" data-state="ok">idx 1..42</span><span class="bd-block" data-state="healing">idx 43 répliqué -> N3, N4</span></div>
          </div>
          <div class="bd-zone" data-state="info">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-people-fill"></i> N3, N4 (Followers) · N5 (Lent)</span><span class="bd-pill" data-state="info">Quorum Actif</span></div>
            <div class="bd-blocks"><span class="bd-block" data-state="ok">N3 : Vote N2 (Term 8)</span><span class="bd-block" data-state="ok">N4 : Vote N2 (Term 8)</span><span class="bd-block" data-state="warn">N5 : En retard (rattrapage)</span></div>
          </div>
        </div>
      `;
      logs = [
        { s: "danger", t: "[HEARTBEAT TIMEOUT] Les Followers N2, N3, N4 ne reçoivent plus d'AppendEntries de N1 après 180 ms." },
        { s: "info", t: "[REQUEST VOTE] N2 incrémente son mandat à Term=8, possède le journal le plus à jour (idx=42) et obtient la majorité {N2, N3, N4}." },
        { s: "ok", t: "[SAFETY] Si N1 redémarre plus tard avec Term=7, il découvre Term=8 > 7 et rétrograde immédiatement en Follower." }
      ];
    } else if (state.mode === "split_nofence") {
      metrics = [
        { l: "Client 1 (Zombie)", v: "Pause GC 15 s", sub: "Croit détenir le verrou !", s: "danger" },
        { l: "Bail Verrou (TTL)", v: "Expiré à 10 s", sub: "Réattribué au Client 2", s: "warn" },
        { l: "Contrôle Stockage", v: "AUCUN JETON", sub: "Accepte toute requête", s: "danger" },
        { l: "Intégrité Fichier", v: "CORROMPUE", sub: "Dirty Write : v2 écrasée !", s: "danger" }
      ];
      banner = { state: "danger", left: "ALERTE SPLIT-BRAIN : Le Client 1 se réveille de sa pause JVM GC et écrase la mise à jour validée du Client 2 !", right: "Cas réel : expiration de bail HMS" };
      zonesHtml = `
        <div class="bd-topology-3">
          <div class="bd-zone" data-state="danger">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-hourglass-bottom"></i> 1. Client 1 (Pause GC)</span><span class="bd-pill" data-state="danger">Bail expiré</span></div>
            <div class="bd-node-body">Obtient le verrou à <code>t=0s</code>, prépare l'écriture <code>v1</code>, puis gèle pendant <strong>15 s</strong> (Stop-the-World GC).</div>
          </div>
          <div class="bd-zone" data-state="warn">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-lightning-fill"></i> 2. Client 2 (Légitime)</span><span class="bd-pill" data-state="ok">Nouveau bail t=10s</span></div>
            <div class="bd-node-body">À <code>t=10s</code>, le verrou expire. Client 2 l'acquiert légitimement et écrit <code>v2</code> à <code>t=12s</code>.</div>
          </div>
          <div class="bd-zone" data-state="danger">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-hdd-fill"></i> 3. Stockage Sans Fencing</span><span class="bd-pill" data-state="danger">Dirty Write t=15s</span></div>
            <div class="bd-blocks"><span class="bd-block" data-state="ok">t=12s : écrit v2</span><span class="bd-block" data-state="danger">t=15s : Client 1 écrase v2 par v1 !</span></div>
          </div>
        </div>
      `;
      logs = [
        { s: "warn", t: "[t=10s] Le service de verrouillage pense que Client 1 est mort (TTL expiré) et accorde le verrou au Client 2." },
        { s: "info", t: "[t=12s] Client 2 valide proprement ses métadonnées v2 sur le stockage partagé." },
        { s: "danger", t: "[t=15s] Fin de pause GC du Client 1 : son paquet réseau retardé arrive au stockage et détruit silencieusement v2 !" }
      ];
    } else {
      metrics = [
        { l: "Jeton Client 1", v: "token = 33", sub: "Émis avant la pause GC", s: "warn" },
        { l: "Jeton Client 2", v: "token = 34", sub: "Monotone croissant (+1)", s: "ok" },
        { l: "Mémoire Stockage", v: "max_seen = 34", sub: "Vérification atomique", s: "info" },
        { l: "Intégrité Fichier", v: "100 % INTACTE", sub: "Écriture zombie 33 rejetée !", s: "ok" }
      ];
      banner = { state: "ok", left: "PROTECTION FENCING ACTIVE : Le stockage rejette l'écriture tardive du Client 1 car token 33 < max_seen 34", right: "Zéro corruption malgré la pause GC" };
      zonesHtml = `
        <div class="bd-topology-3">
          <div class="bd-zone" data-state="warn">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-person-exclamation"></i> Client 1 (Zombie réveillé)</span><span class="bd-pill" data-state="warn">Fencing Token = 33</span></div>
            <div class="bd-node-body">Tente d'écrire <code>(v1, token=33)</code> à <code>t=15s</code> après l'expiration de son bail.</div>
          </div>
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-person-check-fill"></i> Client 2 (Actif)</span><span class="bd-pill" data-state="ok">Fencing Token = 34</span></div>
            <div class="bd-node-body">A déjà validé <code>(v2, token=34)</code> à <code>t=12s</code> via le quorum ZooKeeper / Raft.</div>
          </div>
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-shield-lock-fill"></i> Stockage / QJM avec Clôture</span><span class="bd-pill" data-state="ok">max_token = 34</span></div>
            <div class="bd-blocks"><span class="bd-block" data-state="ok">Accepté : token 34 (v2)</span><span class="bd-block" data-state="danger">REJETÉ : token 33 &lt; 34</span></div>
          </div>
        </div>
      `;
      logs = [
        { s: "info", t: "[FENCING] Le coordinateur Raft/ZooKeeper délivre un numéro d'époque strictement croissant (zxid / term) à chaque bail." },
        { s: "ok", t: "[t=12s] Le serveur de stockage enregistre v2 et mémorise max_token = 34." },
        { s: "ok", t: "[t=15s] Requête tardive (v1, token=33) reçue -> 33 < 34 : rejet atomique immédiat (StaleEpochException) !" }
      ];
    }

    const controlsHtml = state.mode === "quorum" ? `
      <div class="bd-controls-row">
        <div class="bd-control-group">
          <div class="bd-control-head"><span>Quorum d'écriture (W)</span><span class="bd-control-val">W = ${state.w} / 5</span></div>
          <input type="range" class="bd-range" data-inp="w" min="1" max="5" step="1" value="${state.w}" />
        </div>
        <div class="bd-control-group">
          <div class="bd-control-head"><span>Quorum de lecture (R)</span><span class="bd-control-val">R = ${state.r} / 5</span></div>
          <input type="range" class="bd-range" data-inp="r" min="1" max="5" step="1" value="${state.r}" />
        </div>
      </div>
    ` : "";

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Scénario :</span>
        ${Object.entries(modes).map(([k, m]) => `
          <button type="button" class="bd-btn ${state.mode === k ? "is-active" : ""}" data-mode="${k}" data-variant="${m.variant}">
            <i class="bi ${m.icon}"></i>${m.label}
          </button>
        `).join("")}
      </div>
      ${controlsHtml}
      <div class="bd-metrics">
        ${metrics.map((m) => `
          <div class="bd-metric" data-state="${m.s}">
            <div class="bd-metric-label">${m.l}</div>
            <div class="bd-metric-val">${m.v}</div>
            <div class="bd-metric-sub">${m.sub}</div>
          </div>
        `).join("")}
      </div>
      <div class="bd-link-banner" data-state="${banner.state}">
        <span><i class="bi bi-broadcast me-1"></i>${banner.left}</span>
        <span>${banner.right}</span>
      </div>
      ${zonesHtml}
      <div class="bd-console">
        ${logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">${l.t}</div>`).join("")}
      </div>
    `;

    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        render();
      });
    });
    root.querySelectorAll("[data-inp]").forEach((inp) => {
      inp.addEventListener("input", () => {
        state[inp.dataset.inp] = Number(inp.value);
        render();
      });
    });
  }

  render();
  return root;
}

// ==========================================================================
// 2. SIMULATEUR NOSQL : HACHAGE COHÉRENT & ARBRES LSM (nosql.qmd)
// ==========================================================================

export function createNosqlLsmSimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const state = {
    mode: "modulo_crash",
    compacted: false,
    bloomEnabled: true
  };

  const modes = {
    modulo_crash: { label: "Modulo N (Tempête de Re-hachage)", variant: "danger", icon: "bi-shuffle" },
    consistent_ring: { label: "Hachage Cohérent + Virtual Nodes", variant: "success", icon: "bi-arrow-repeat" },
    lsm_write_crash: { label: "Écriture LSM & Crash RAM (WAL)", variant: "primary", icon: "bi-journal-arrow-down" },
    lsm_compact: { label: "SSTables, Tombstone, Bloom & Compaction", variant: "warning", icon: "bi-layers-half" }
  };

  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    let metrics = [];
    let extraControls = "";
    let bodyHtml = "";
    let logs = [];

    if (state.mode === "modulo_crash") {
      metrics = [
        { l: "Formule de routage", v: "hash(k) mod N", sub: "Passage de N=4 à N=5", s: "danger" },
        { l: "Clés déplacées", v: "80 % (4 / 5)", sub: "(N - 1) / N migrées !", s: "danger" },
        { l: "Trafic inter-nœuds", v: "SATURATION", sub: "Tempête réseau & cache miss", s: "danger" },
        { l: "Impact Production", v: "Indisponibilité", sub: " Effondrement lors d'un scale-out", s: "danger" }
      ];
      bodyHtml = `
        <div class="bd-zone" data-state="danger">
          <div class="bd-zone-header">
            <span class="bd-zone-title"><i class="bi bi-exclamation-triangle-fill"></i> Ajout d'un 5e serveur avec <code>hash(key) mod N</code></span>
            <span class="bd-pill" data-state="danger">80 % des clés changent d'adresse !</span>
          </div>
          <table class="bd-mini-table">
            <thead><tr><th>Clé Métier</th><th>Hash h(k)</th><th>N=4 (h mod 4)</th><th>N=5 (h mod 5)</th><th>Statut Réseau</th></tr></thead>
            <tbody>
              <tr data-state="ok"><td>user_101</td><td>10</td><td>Serveur S2</td><td>Serveur S0</td><td>MIGRATION FORCÉE</td></tr>
              <tr data-state="danger"><td>user_204</td><td>17</td><td>Serveur S1</td><td>Serveur S2</td><td>MIGRATION FORCÉE</td></tr>
              <tr data-state="danger"><td>cart_309</td><td>23</td><td>Serveur S3</td><td>Serveur S3</td><td>Stable (20 % seulement)</td></tr>
              <tr data-state="danger"><td>order_512</td><td>31</td><td>Serveur S3</td><td>Serveur S1</td><td>MIGRATION FORCÉE</td></tr>
              <tr data-state="danger"><td>sess_880</td><td>44</td><td>Serveur S0</td><td>Serveur S4</td><td>MIGRATION FORCÉE</td></tr>
            </tbody>
          </table>
        </div>
      `;
      logs = [
        { s: "danger", t: "[MODULO TRAP] Dès que N passe de 4 à 5 (ajout de capacité) ou de 4 à 3 (crash serveur), le reste de la division entière change pour 80 % du parc !" },
        { s: "warn", t: "[CONSÉQUENCE] Au moment précis où le cluster souffre d'une panne, il déclenche un transfert réseau massif de quasi toutes ses données." }
      ];
    } else if (state.mode === "consistent_ring") {
      metrics = [
        { l: "Topologie", v: "Anneau [0, 2^32)", sub: "256 vnodes par serveur", s: "ok" },
        { l: "Clés déplacées", v: "20 % (1 / N)", sub: "Minimum mathématique optimal", s: "ok" },
        { l: "Équilibrage charge", v: "Écart < 3 %", sub: "Lissé par les Virtual Nodes", s: "ok" },
        { l: "Nœuds inchangés", v: "80 % intacts", sub: "Zéro invalidation inutile", s: "info" }
      ];
      bodyHtml = `
        <div class="bd-topology">
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-bullseye"></i> Anneau de Hachage Cohérent (Karger / Dynamo)</span><span class="bd-pill" data-state="ok">Optimal O(K/N)</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="ok">Arc [0..85] -> S0 (Intact)</span>
              <span class="bd-block" data-state="ok">Arc [86..170] -> S1 (Intact)</span>
              <span class="bd-block" data-state="healing">Arc [171..205] -> Nouveau S4 (20 %)</span>
              <span class="bd-block" data-state="ok">Arc [206..255] -> S2 & S3 (Intacts)</span>
            </div>
            <div class="bd-node-body">Chaque serveur physique héberge <strong>128 à 256 jetons virtuels (vnodes)</strong> dispersés sur le cercle : quand S4 rejoint le cluster, il prélève une fine tranche équitable à chacun de ses voisins sans créer de point chaud.</div>
          </div>
        </div>
      `;
      logs = [
        { s: "ok", t: "[CONSISTENT HASHING] Seules les clés situées sur l'arc repris par S4 sont copiées (exactement 1/N du volume total)." },
        { s: "info", t: "[VNODES] Si un serveur tombe en panne, sa charge ne s'écrase pas sur un unique successeur : ses 256 vnodes se répartissent uniformément sur tout le cluster !" }
      ];
    } else if (state.mode === "lsm_write_crash") {
      metrics = [
        { l: "Chemin d'écriture", v: "Séquentiel pur", sub: "Append WAL + RAM SkipList", s: "ok" },
        { l: "Coût I/O Écriture", v: "0 seek aléatoire", sub: "10x à 50x plus véloce qu'un B-Tree", s: "ok" },
        { l: "Crash Électrique", v: "MemTable perdue", sub: "RAM volatile effacée", s: "warn" },
        { l: "Reprise après Crash", v: "100 % rejouée", sub: "Reconstruction via WAL disque", s: "ok" }
      ];
      bodyHtml = `
        <div class="bd-topology-3">
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-1-circle-fill"></i> Write-Ahead Log (Disque)</span><span class="bd-pill" data-state="ok">Append-Only Séquentiel</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="ok">PUT k12=80</span>
              <span class="bd-block" data-state="ok">PUT k04=19</span>
              <span class="bd-block" data-state="ok">DEL k09 (Tombstone)</span>
            </div>
            <div class="bd-node-body">Inscrit sur disque séquentiel avant l'acquittement client : survit à toute coupure secteur.</div>
          </div>
          <div class="bd-zone" data-state="info">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-2-circle-fill"></i> MemTable (RAM Triée)</span><span class="bd-pill" data-state="info">Red-Black / SkipList</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="healing">k04 -> 19 (rejoué WAL)</span>
              <span class="bd-block" data-state="healing">k09 -> TOMBSTONE</span>
              <span class="bd-block" data-state="healing">k12 -> 80 (rejoué WAL)</span>
            </div>
            <div class="bd-node-body">Triée en mémoire vive ; vidée d'un bloc à 64 Mo vers une SSTable immuable.</div>
          </div>
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-3-circle-fill"></i> SSTables (Disque Immuable)</span><span class="bd-pill" data-state="primary">Triées par clé</span></div>
            <div class="bd-blocks"><span class="bd-block" data-state="primary">SSTable_L0_01.db (64 Mo)</span><span class="bd-block" data-state="primary">SSTable_L1_01.db (256 Mo)</span></div>
            <div class="bd-node-body">Jamais modifiées sur place (contrairement aux pages 16 Ko d'un B-Tree).</div>
          </div>
        </div>
      `;
      logs = [
        { s: "info", t: "[LSM-TREE] Pourquoi Cassandra, HBase et RocksDB encaissent des centaines de milliers d'écritures/s ? Parce qu'ils transforment les mutations aléatoires en écritures séquentielles pures." },
        { s: "ok", t: "[CRASH RECOVERY] Coupure électrique simulée : la MemTable RAM est reconstruite à l'identique en quelques millisecondes en relisant le segment actif du WAL." }
      ];
    } else {
      const sstableCount = state.compacted ? 1 : 5;
      const diskReads = state.compacted ? 1 : state.bloomEnabled ? 1 : 5;

      extraControls = `
        <div class="bd-controls-row">
          <div class="bd-control-group">
            <div class="bd-control-head"><span>Filtres de Bloom en RAM</span><span class="bd-control-val">${state.bloomEnabled ? "ACTIFS" : "DÉSACTIVÉS"}</span></div>
            <button type="button" class="bd-btn ${state.bloomEnabled ? "is-active" : ""}" data-act="toggle-bloom" data-variant="success">
              <i class="bi bi-funnel-fill"></i>${state.bloomEnabled ? "Bloom Filter : Actif (Évite les faux scans)" : "Activer les Filtres de Bloom"}
            </button>
          </div>
          <div class="bd-control-group">
            <div class="bd-control-head"><span>Maintenance LSM-Tree</span><span class="bd-control-val">${state.compacted ? "COMPACTÉ (L1)" : "5 SSTables L0 + Tombstone"}</span></div>
            <button type="button" class="bd-btn ${state.compacted ? "is-active" : ""}" data-act="toggle-compact" data-variant="primary">
              <i class="bi bi-arrows-collapse"></i>${state.compacted ? "Réinitialiser l'accumulation L0" : "Lancer la Compaction (Merge-Sort)"}
            </button>
          </div>
        </div>
      `;

      metrics = [
        { l: "Fichiers SSTables", v: `${sstableCount} fichier(s)`, sub: state.compacted ? "Fusionnés & triés" : "Accumulation de flushs RAM", s: state.compacted ? "ok" : "warn" },
        { l: "I/O Disque Lecture", v: `${diskReads} accès disque`, sub: state.bloomEnabled ? "Bloom écarte les absents en RAM" : "Amplification de lecture L0 !", s: diskReads === 1 ? "ok" : "danger" },
        { l: "Tombstones (DEL)", v: state.compacted ? "0 (Purgés !)" : "2 actifs", sub: state.compacted ? "Espace disque récupéré" : "Masquent les vieilles versions", s: state.compacted ? "ok" : "warn" },
        { l: "Parenté Lakehouse", v: "Ancêtre du MoR", sub: "Même logique que Hudi/Iceberg", s: "info" }
      ];

      bodyHtml = state.compacted ? `
        <div class="bd-zone" data-state="ok">
          <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-check2-circle"></i> SSTable Compactée Unique (Niveau L1)</span><span class="bd-pill" data-state="ok">Zéro doublon · Zéro Tombstone expiré</span></div>
          <div class="bd-blocks">
            <span class="bd-block" data-state="ok">k01 = "Alice" (v3 finale)</span>
            <span class="bd-block" data-state="ok">k04 = "Lyon" (v2 finale)</span>
            <span class="bd-block" data-state="pruned">k09 purgée physiquement (ex-Tombstone)</span>
          </div>
        </div>
      ` : `
        <div class="bd-zone" data-state="warn">
          <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-stack"></i> Niveau L0 avant Compaction : Recherche de <code>k01</code> (du plus récent au plus ancien)</span><span class="bd-pill" data-state="warn">Amplification de lecture</span></div>
          <div class="bd-blocks">
            <span class="bd-block" data-state="${state.bloomEnabled ? "pruned" : "danger"}">SST_5 : ${state.bloomEnabled ? "Sauté par Bloom (0 I/O)" : "Scanné inutilement !"}</span>
            <span class="bd-block" data-state="warn">SST_4 : k09 = TOMBSTONE</span>
            <span class="bd-block" data-state="${state.bloomEnabled ? "pruned" : "danger"}">SST_3 : ${state.bloomEnabled ? "Sauté par Bloom (0 I/O)" : "Scanné inutilement !"}</span>
            <span class="bd-block" data-state="ok">SST_2 : k01 = "Alice" (Trouvé !)</span>
            <span class="bd-block" data-state="idle">SST_1 : k01 = "Ancien" (Obsolète)</span>
          </div>
        </div>
      `;

      logs = [
        { s: "info", t: "[SUPPRESSION LSM] Comme une SSTable est immuable, un DELETE n'efface rien sur le champ : il écrit un marqueur 'Tombstone' qui masque les anciennes valeurs jusqu'à la prochaine compaction." },
        { s: state.bloomEnabled ? "ok" : "danger", t: state.bloomEnabled ? "[BLOOM FILTER] Le filtre probabiliste en RAM garantit à 100 % qu'une clé est absente d'une SSTable, évitant 4 lectures disque inutiles sur 5 !" : "[SANS BLOOM] Le moteur doit ouvrir chaque SSTable sur disque de la plus récente à la plus ancienne !" }
      ];
    }

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Mécanisme NoSQL :</span>
        ${Object.entries(modes).map(([k, m]) => `
          <button type="button" class="bd-btn ${state.mode === k ? "is-active" : ""}" data-mode="${k}" data-variant="${m.variant}">
            <i class="bi ${m.icon}"></i>${m.label}
          </button>
        `).join("")}
      </div>
      ${extraControls}
      <div class="bd-metrics">
        ${metrics.map((m) => `
          <div class="bd-metric" data-state="${m.s}">
            <div class="bd-metric-label">${m.l}</div>
            <div class="bd-metric-val">${m.v}</div>
            <div class="bd-metric-sub">${m.sub}</div>
          </div>
        `).join("")}
      </div>
      ${bodyHtml}
      <div class="bd-console">
        ${logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">${l.t}</div>`).join("")}
      </div>
    `;

    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        render();
      });
    });
    const bloomBtn = root.querySelector('[data-act="toggle-bloom"]');
    if (bloomBtn) {
      bloomBtn.addEventListener("click", () => {
        state.bloomEnabled = !state.bloomEnabled;
        render();
      });
    }
    const compBtn = root.querySelector('[data-act="toggle-compact"]');
    if (compBtn) {
      compBtn.addEventListener("click", () => {
        state.compacted = !state.compacted;
        render();
      });
    }
  }

  render();
  return root;
}

// ==========================================================================
// 3. SIMULATEUR APACHE KAFKA, ISR, CONSUMER LAG & CDC (kafka-cdc.qmd)
// ==========================================================================

export function createKafkaCdcSimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const state = {
    mode: "nominal_cdc",
    acksAll: true,
    consumers: 4
  };

  const modes = {
    nominal_cdc: { label: "Flux Nominal CDC (WAL -> Kafka)", variant: "success", icon: "bi-check-circle" },
    broker_crash: { label: "Crash Broker Leader (acks=1 vs all)", variant: "danger", icon: "bi-hdd-rack-fill" },
    lag_consumers: { label: "Consumer Lag & Surnombre", variant: "warning", icon: "bi-speedometer2" },
    schema_poison: { label: "Contrat Schema Registry & Polling", variant: "primary", icon: "bi-file-earmark-lock2" }
  };

  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    const P = 4;
    let controls = "";
    let metrics = [];
    let bodyHtml = "";
    let logs = [];

    if (state.mode === "nominal_cdc") {
      metrics = [
        { l: "Capture Source", v: "Log-Based WAL", sub: "Debezium + Outbox ACID", s: "ok" },
        { l: "Partitions Topic", v: "4 partitions", sub: "Ordre garanti par clé client", s: "info" },
        { l: "Réplication ISR", v: "RF=3 · ISR=3", sub: "Quorum KRaft sain", s: "ok" },
        { l: "Consumer Lag", v: "0 msg (Temps réel)", sub: "4 consommateurs = 4 partitions", s: "ok" }
      ];
      bodyHtml = `
        <div class="bd-topology-3">
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-database-check"></i> PostgreSQL WAL + Debezium</span><span class="bd-pill" data-state="ok">Zéro charge SQL</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="ok">op="c" (INSERT cmd_81)</span>
              <span class="bd-block" data-state="healing">op="u" (UPDATE cmd_81)</span>
              <span class="bd-block" data-state="warn">op="d" (DELETE -> Tombstone)</span>
            </div>
          </div>
          <div class="bd-zone" data-state="info">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-hdd-stack"></i> Topic <code>orders.cdc</code> (P0..P3)</span><span class="bd-pill" data-state="info">hash(cmd_id) mod 4</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="primary">P0 : off 0..412 (cmd_81 ordonné)</span>
              <span class="bd-block" data-state="primary">P1 : off 0..398</span>
              <span class="bd-block" data-state="primary">P2 : off 0..405</span>
              <span class="bd-block" data-state="primary">P3 : off 0..401</span>
            </div>
          </div>
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-people-fill"></i> Groupe <code>bronze-ingester</code></span><span class="bd-pill" data-state="ok">1:1 Optimal</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="ok">C1 <- P0</span>
              <span class="bd-block" data-state="ok">C2 <- P1</span>
              <span class="bd-block" data-state="ok">C3 <- P2</span>
              <span class="bd-block" data-state="ok">C4 <- P3</span>
            </div>
          </div>
        </div>
      `;
      logs = [
        { s: "ok", t: "[CDC WAL] Toutes les mutations (y compris les suppressions physiques DELETE) sont lues séquentiellement dans le journal binaire de PostgreSQL sans exécuter de SELECT coûteux." },
        { s: "info", t: "[ORDRE PAR CLÉ] Tous les événements de cmd_81 ont la même clé de partitionnement : INSERT puis UPDATE puis DELETE atterrissent toujours dans cet ordre exact sur P0." }
      ];
    } else if (state.mode === "broker_crash") {
      controls = `
        <div class="bd-controls-row">
          <div class="bd-control-group">
            <div class="bd-control-head"><span>Configuration Durabilité Producteur</span><span class="bd-control-val">${state.acksAll ? "acks=all + min.insync.replicas=2" : "acks=1 (Leader seul !)"}</span></div>
            <button type="button" class="bd-btn ${state.acksAll ? "is-active" : ""}" data-act="toggle-acks" data-variant="${state.acksAll ? "success" : "danger"}">
              <i class="bi ${state.acksAll ? "bi-shield-lock-fill" : "bi-exclamation-octagon-fill"}"></i>
              ${state.acksAll ? "Basculer vers acks=1 (Observer la perte)" : "Activer acks=all + min.insync.replicas=2 (Zéro perte)"}
            </button>
          </div>
        </div>
      `;
      metrics = [
        { l: "Broker 1 (Ex-Leader P0)", v: "CRASH DISQUE", sub: "Panne matérielle brutale", s: "danger" },
        { l: "Politique d'acquittement", v: state.acksAll ? "acks=all (ISR>=2)" : "acks=1 (Immédiat)", sub: state.acksAll ? "Attend la copie Follower" : "Acquitte avant réplication !", s: state.acksAll ? "ok" : "danger" },
        { l: "Événements Perdus", v: state.acksAll ? "0 événement" : "4 événements PERDUS", sub: state.acksAll ? "Présents sur Broker 2 & 3" : "Offsets 1042..1045 volatilisés", s: state.acksAll ? "ok" : "danger" },
        { l: "Bascule KRaft", v: "Broker 2 élu", sub: "En quelques millisecondes", s: "info" }
      ];
      bodyHtml = `
        <div class="bd-topology-3">
          <div class="bd-zone" data-state="offline">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-x-circle-fill"></i> Broker 1 (Crashé)</span><span class="bd-pill" data-state="danger">Ex-Leader P0</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="idle">off 0..1041</span>
              <span class="bd-block" data-state="danger">off 1042..1045 ${state.acksAll ? "(Déjà répliqués)" : "(PERDUS !)"}</span>
            </div>
          </div>
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-award-fill"></i> Broker 2 (Nouveau Leader ISR)</span><span class="bd-pill" data-state="ok">Promu par KRaft</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="ok">off 0..1041</span>
              <span class="bd-block" data-state="${state.acksAll ? "ok" : "danger"}">${state.acksAll ? "off 1042..1045 intacts !" : "Tronqué à 1041 !"}</span>
            </div>
          </div>
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-hdd-fill"></i> Broker 3 (Follower ISR)</span><span class="bd-pill" data-state="info">In-Sync Replica</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="ok">off 0..1041</span>
              <span class="bd-block" data-state="${state.acksAll ? "ok" : "warn"}">${state.acksAll ? "off 1042..1045 intacts !" : "Arrêté à 1041"}</span>
            </div>
          </div>
        </div>
      `;
      logs = state.acksAll
        ? [
            { s: "ok", t: "[DURABILITÉ GARANTIE] Avec acks=all et min.insync.replicas=2, Broker 1 n'avait confirmé les offsets 1042..1045 au producteur qu'après écriture effective sur les Followers ISR." },
            { s: "info", t: "[BASCULE KRAFT] Le quorum de contrôleurs KRaft couronne immédiatement Broker 2 sans aucune perte financière." }
          ]
        : [
            { s: "danger", t: "[PERTE SILENCIEUSE] Avec acks=1, Broker 1 a répondu 'OK' au producteur dès l'écriture dans son cache local, puis a grillé avant que Broker 2 ne tire (fetch) les offsets 1042..1045 !" },
            { s: "warn", t: "[RÈGLE PRODUCTION] Sur tout flux critique ou CDC financier, imposez systématiquement replication.factor=3, min.insync.replicas=2 et acks=all." }
          ];
    } else if (state.mode === "lag_consumers") {
      const activeC = Math.min(state.consumers, P);
      const idleC = Math.max(0, state.consumers - P);
      const rateIn = 40000;
      const rateOut = activeC * 10000;
      const lagDelta = Math.max(0, rateIn - rateOut);

      controls = `
        <div class="bd-controls-row">
          <div class="bd-control-group">
            <div class="bd-control-head"><span>Instances dans le Consumer Group (Topic à 4 partitions)</span><span class="bd-control-val">${state.consumers} consommateur(s)</span></div>
            <input type="range" class="bd-range" data-inp="consumers" min="1" max="6" step="1" value="${state.consumers}" />
          </div>
        </div>
      `;
      metrics = [
        { l: "Débit Entrant Topic", v: "40 000 msg/s", sub: "10 000 msg/s par partition", s: "info" },
        { l: "Débit Consommé", v: `${rateOut.toLocaleString("fr-FR")} msg/s`, sub: `${activeC} instance(s) active(s)`, s: lagDelta === 0 ? "ok" : "danger" },
        { l: "Dérive Consumer Lag", v: lagDelta === 0 ? "0 msg/s (Stable)" : `+${lagDelta.toLocaleString("fr-FR")} msg/s`, sub: lagDelta === 0 ? "Fraîcheur nominale" : "Retard cumulatif critique !", s: lagDelta === 0 ? "ok" : "danger" },
        { l: "Instances Oisives", v: `${idleC} oisive(s)`, sub: idleC > 0 ? "Plafond = nb de partitions (4) !" : "100 % des instances utilisées", s: idleC > 0 ? "warn" : "ok" }
      ];

      const consumerBlocks = Array.from({ length: state.consumers }, (_, i) => {
        const idx = i + 1;
        if (idx <= P) {
          const parts = [];
          for (let p = 0; p < P; p++) {
            if ((p % activeC) === i) parts.push(`P${p}`);
          }
          return `<span class="bd-block" data-state="${parts.length > 1 ? "warn" : "ok"}">Consumer C${idx} <- [${parts.join(", ")}] (${parts.length > 1 ? "Surchargé !" : "10k msg/s"})</span>`;
        }
        return `<span class="bd-block" data-state="idle">Consumer C${idx} <- AUCUNE PARTITION (Oisif 0 msg/s !)</span>`;
      }).join("");

      bodyHtml = `
        <div class="bd-zone" data-state="${lagDelta > 0 ? "danger" : idleC > 0 ? "warn" : "ok"}">
          <div class="bd-zone-header">
            <span class="bd-zone-title"><i class="bi bi-sliders"></i> Attribution Dynamique des 4 Partitions au Consumer Group</span>
            <span class="bd-pill" data-state="${lagDelta > 0 ? "danger" : idleC > 0 ? "warn" : "ok"}">${lagDelta > 0 ? "Sous-dimensionné" : idleC > 0 ? "Sur-provisionné inutilement" : "Équilibre parfait"}</span>
          </div>
          <div class="bd-blocks">${consumerBlocks}</div>
        </div>
      `;
      logs = [
        { s: lagDelta > 0 ? "danger" : "ok", t: lagDelta > 0 ? `[CONSUMER LAG] Avec seulement ${state.consumers} consommateur(s), certaines instances doivent lire plusieurs partitions et accumulent +${lagDelta} messages de retard chaque seconde !` : "[DÉBIT ALIGNÉ] Les 4 partitions sont absorbées en temps réel sans accumulation de retard." },
        ...(idleC > 0 ? [{ s: "warn", t: `[PIÈGE CLASSIQUE] Kafka interdit à deux membres d'un même groupe de lire la même partition (pour préserver l'ordre des offsets) : C5${state.consumers > 5 ? " et C6" : ""} restent totalement inactifs tant que vous n'augmentez pas le nombre de partitions du topic !` }] : [])
      ];
    } else {
      metrics = [
        { l: "Sérialisation", v: "Avro Binaire", sub: "5 octets en-tête (Magic + ID)", s: "ok" },
        { l: "Mode Compatibilité", v: "BACKWARD", sub: "Nouveau lecteur lit l'ancien", s: "info" },
        { l: "Mutation Cassante", v: "BLOQUÉE (HTTP 409)", sub: "amount: DECIMAL -> STRING rejeté", s: "ok" },
        { l: "Comparatif Polling SQL", v: "DELETE Manqués", sub: "Seul le CDC WAL voit les purges", s: "warn" }
      ];
      bodyHtml = `
        <div class="bd-topology">
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-shield-fill-check"></i> Pare-Feu Schema Registry (Avro / Protobuf)</span><span class="bd-pill" data-state="ok">Poison Pill stoppée en amont</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="ok">v1 : {tx_id: long, amount: decimal}</span>
              <span class="bd-block" data-state="ok">v2 : + discount: decimal = 0.0 (Valide)</span>
              <span class="bd-block" data-state="danger">v3 : amount: string -> REJETÉ (409 Incompatible)</span>
            </div>
          </div>
          <div class="bd-zone" data-state="warn">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-eye-slash-fill"></i> Pourquoi bannir le Polling SQL (<code>updated_at</code>) ?</span><span class="bd-pill" data-state="danger">Fantômes en aval</span></div>
            <div class="bd-node-body">Une requête périodique <code>SELECT * FROM orders WHERE updated_at &gt; T</code> ne voit <strong>jamais</strong> une ligne supprimée par <code>DELETE</code> : la ligne annulée survit éternellement dans votre Lakehouse ! Le CDC sur <code>WAL</code> émet un événement explicite de suppression.</div>
          </div>
        </div>
      `;
      logs = [
        { s: "ok", t: "[SCHEMA REGISTRY] Au lieu de répéter les noms de colonnes JSON dans chaque message, Avro n'envoie qu'un Schema ID de 4 octets et bloque instantanément tout déploiement producteur cassant le contrat." },
        { s: "info", t: "[OUTBOX PATTERN] Pour éviter la double écriture non atomique (commit BDD réussi mais crash avant l'envoi Kafka), le microservice écrit l'événement dans une table locale 'outbox' au sein de la MÊME transaction SQL, relevée par Debezium." }
      ];
    }

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Scénario Kafka & CDC :</span>
        ${Object.entries(modes).map(([k, m]) => `
          <button type="button" class="bd-btn ${state.mode === k ? "is-active" : ""}" data-mode="${k}" data-variant="${m.variant}">
            <i class="bi ${m.icon}"></i>${m.label}
          </button>
        `).join("")}
      </div>
      ${controls}
      <div class="bd-metrics">
        ${metrics.map((m) => `
          <div class="bd-metric" data-state="${m.s}">
            <div class="bd-metric-label">${m.l}</div>
            <div class="bd-metric-val">${m.v}</div>
            <div class="bd-metric-sub">${m.sub}</div>
          </div>
        `).join("")}
      </div>
      ${bodyHtml}
      <div class="bd-console">
        ${logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">${l.t}</div>`).join("")}
      </div>
    `;

    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        render();
      });
    });
    const acksBtn = root.querySelector('[data-act="toggle-acks"]');
    if (acksBtn) {
      acksBtn.addEventListener("click", () => {
        state.acksAll = !state.acksAll;
        render();
      });
    }
    const consInp = root.querySelector('[data-inp="consumers"]');
    if (consInp) {
      consInp.addEventListener("input", () => {
        state.consumers = Number(consInp.value);
        render();
      });
    }
  }

  render();
  return root;
}

// ==========================================================================
// 4. SIMULATEUR STREAMING : WATERMARKS, BACKPRESSURE & CHANDY-LAMPORT (streaming.qmd)
// ==========================================================================

export function createStreamWatermarkSimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const state = {
    mode: "late_event",
    allowedLatenessMin: 12
  };

  const modes = {
    late_event: { label: "Retard Tunnel : Event-Time & Watermark", variant: "primary", icon: "bi-clock-history" },
    backpressure: { label: "Puits Lent & Contre-Pression (Crédits)", variant: "warning", icon: "bi-speedometer" },
    crash_atleast: { label: "Crash Worker (At-Least-Once : Doublon)", variant: "danger", icon: "bi-exclamation-diamond-fill" },
    crash_exactly: { label: "Crash avec Barrière Chandy-Lamport + 2PC", variant: "success", icon: "bi-check2-all" }
  };

  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    let controls = "";
    let metrics = [];
    let bodyHtml = "";
    let logs = [];

    if (state.mode === "late_event") {
      // Event generated at 14:03, window [14:00, 14:05), arrives at 14:14 -> delay after window close (14:05) = 9 min
      const delayAfterWindow = 9;
      const acceptedInWindow = state.allowedLatenessMin >= delayAfterWindow;

      controls = `
        <div class="bd-controls-row">
          <div class="bd-control-group">
            <div class="bd-control-head"><span>Tolérance aux retardataires (<code>Allowed Lateness</code> après clôture 14:05)</span><span class="bd-control-val">${state.allowedLatenessMin} min</span></div>
            <input type="range" class="bd-range" data-inp="lateness" min="0" max="15" step="1" value="${state.allowedLatenessMin}" />
          </div>
        </div>
      `;
      metrics = [
        { l: "Événement Mobile", v: "500 EUR à 14:03", sub: "Reçu à 14:14 (+9 min hors tunnel)", s: "info" },
        { l: "En Processing-Time", v: "FAUX (Fenêtre 14:10)", sub: "Fausse les deux tranches horaires !", s: "danger" },
        { l: "En Event-Time + Watermark", v: acceptedInWindow ? " Fenêtre [14:00, 14:05)" : "Routé vers Side Output", sub: acceptedInWindow ? "Agrégat historique mis à jour !" : `Retard 9 min > tolérance ${state.allowedLatenessMin} min`, s: acceptedInWindow ? "ok" : "warn" },
        { l: "Perte Silencieuse", v: "0 événement", sub: "Side Output auditable si hors délai", s: "ok" }
      ];
      bodyHtml = `
        <div class="bd-topology">
          <div class="bd-zone" data-state="danger">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-x-octagon"></i> Approche Naïve : Processing-Time</span><span class="bd-pill" data-state="danger">Biais Temporel</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="warn">Fenêtre [14:00, 14:05) : 1 000 EUR (Manque 500 !)</span>
              <span class="bd-block" data-state="danger">Fenêtre [14:10, 14:15) : +500 EUR (Facturé à tort !)</span>
            </div>
          </div>
          <div class="bd-zone" data-state="${acceptedInWindow ? "ok" : "warn"}">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-check-circle-fill"></i> Modèle Dataflow : Event-Time + Watermark</span><span class="bd-pill" data-state="${acceptedInWindow ? "ok" : "warn"}">${acceptedInWindow ? "Réconcilié" : "Side Output"}</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="ok">Fenêtre [14:00, 14:05) : ${acceptedInWindow ? "1 500 EUR (Exact !)" : "1 000 EUR (Clôturée)"}</span>
              <span class="bd-block" data-state="${acceptedInWindow ? "idle" : "healing"}">${acceptedInWindow ? "Side Output : vide" : "Side Output late_events : +500 EUR récupéré"}</span>
            </div>
          </div>
        </div>
      `;
      logs = [
        { s: "info", t: "[EVENT-TIME vs PROCESSING-TIME] Le paiement a eu lieu à 14:03 dans une rame de métro sans réseau et n'atteint Kafka qu'à 14:14." },
        { s: acceptedInWindow ? "ok" : "warn", t: acceptedInWindow ? `[ALLOWED LATENESS = ${state.allowedLatenessMin} min >= 9 min] Flink/Spark conserve l'état RocksDB de la fenêtre [14:00, 14:05) ouvert aux rétractions et émet le total corrigé 1 500 EUR.` : `[ALLOWED LATENESS = ${state.allowedLatenessMin} min < 9 min] L'état RAM/RocksDB de [14:00, 14:05) a été purgé pour préserver la mémoire, mais l'événement est sauvé dans un flux latéral (Side Output) pour réconciliation Silver !` }
      ];
    } else if (state.mode === "backpressure") {
      metrics = [
        { l: "Ralentissement Puits", v: "Débit divisé par 5", sub: "Compaction S3 / pic latence aval", s: "warn" },
        { l: "Tampons Réseau Flink", v: "Crédits = 0", sub: "Freinage gracieux de l'amont", s: "info" },
        { l: "Mémoire JVM Workers", v: "62 % (Stable)", sub: "Zéro OutOfMemoryError !", s: "ok" },
        { l: "Effet sur Kafka", v: "Pause poll() naturelle", sub: "Les messages attendent sur disque Kafka", s: "ok" }
      ];
      bodyHtml = `
        <div class="bd-zone" data-state="info">
          <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-arrow-left-right"></i> Propagation de la Contre-Pression par Crédits (Credit-Based Flow Control)</span><span class="bd-pill" data-state="ok">Anti-Crash OOM</span></div>
          <div class="bd-topology-3">
            <div class="bd-node" data-state="ok">
              <div class="bd-node-head"><span>1. Source Kafka</span><span class="bd-pill" data-state="info">Ralentit poll()</span></div>
              <div class="bd-bar-track"><div class="bd-bar-fill" data-state="info" data-fill="30"></div></div>
              <div class="bd-node-body">Garde le surplus en sécurité sur les disques séquentiels des Brokers.</div>
            </div>
            <div class="bd-node" data-state="warn">
              <div class="bd-node-head"><span>2. Opérateur Fenêtre</span><span class="bd-pill" data-state="warn">0 crédit aval</span></div>
              <div class="bd-bar-track"><div class="bd-bar-fill" data-state="warn" data-fill="88"></div></div>
              <div class="bd-node-body">Tampon de sortie plein -> cesse d'accorder des crédits à la source.</div>
            </div>
            <div class="bd-node" data-state="danger">
              <div class="bd-node-head"><span>3. Puits Externe Lent</span><span class="bd-pill" data-state="danger">Goulot 2 000 msg/s</span></div>
              <div class="bd-bar-track"><div class="bd-bar-fill" data-state="danger" data-fill="100"></div></div>
              <div class="bd-node-body">Absorbe à son rythme maximal sans faire exploser la RAM amont.</div>
            </div>
          </div>
        </div>
      `;
      logs = [
        { s: "warn", t: "[GOULOT AVAL] Le système cible ralentit brutalement de 10 000 à 2 000 écritures/s." },
        { s: "ok", t: "[BACKPRESSURE] Sans contrôle de flux, la source continuerait d'ingérer en RAM jusqu'au crash OOM. Avec les crédits réseau de Flink, le freinage remonte jusqu'au consommateur Kafka qui suspend simplement ses lectures !" }
      ];
    } else if (state.mode === "crash_atleast") {
      metrics = [
        { l: "Panne Injectée", v: "Crash TaskManager 2", sub: "À l'offset Kafka 540", s: "danger" },
        { l: "Dernier Offset Commité", v: "Offset 500", sub: "40 événements rejoués au redémarrage", s: "warn" },
        { l: "État Interne Compteur", v: "Désynchronisé", sub: "Déjà émis partiellement en aval", s: "danger" },
        { l: "Bilan Financier Cible", v: "+4 200 EUR FANTÔMES", sub: "Doublons comptabilisés !", s: "danger" }
      ];
      bodyHtml = `
        <div class="bd-zone" data-state="danger">
          <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-bug-fill"></i> Reprise <code>At-Least-Once</code> sans Snapshot Coordonné</span><span class="bd-pill" data-state="danger">Sur-comptage</span></div>
          <div class="bd-blocks">
            <span class="bd-block" data-state="ok">Offsets 501..540 traités et poussés au puits</span>
            <span class="bd-block" data-state="danger">CRASH avant commit d'offset !</span>
            <span class="bd-block" data-state="danger">Reprise à 501 -> 40 transactions poussées une 2e fois !</span>
          </div>
        </div>
      `;
      logs = [
        { s: "danger", t: "[AT-LEAST-ONCE] Aucune donnée n'est perdue, mais les offsets 501..540 sont ré-appliqués sur la sortie sans annulation de la tentative interrompue -> +4 200 EUR facturés en double !" }
      ];
    } else {
      metrics = [
        { l: "Algorithme Snapshot", v: "Chandy-Lamport (ABS)", sub: "Barrières légères sans arrêt", s: "ok" },
        { l: "Alignement Atomique", v: "Offset 500 + RocksDB", sub: "Checkpoint S3 #18 cohérent", s: "ok" },
        { l: "Protocole de Sortie", v: "Two-Phase Commit (2PC)", sub: "Abandonne la tx ouverte au crash", s: "info" },
        { l: "Bilan Financier Cible", v: "100 % EXACT (0 doublon)", sub: "Sémantique End-to-End Exactly-Once", s: "ok" }
      ];
      bodyHtml = `
        <div class="bd-zone" data-state="ok">
          <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-shield-check"></i> Barrières Asynchrones de Chandy-Lamport (Flink ABS) + Puits Transactionnel 2PC</span><span class="bd-pill" data-state="ok">Exactly-Once Bout-en-Bout</span></div>
          <div class="bd-blocks">
            <span class="bd-block" data-state="ok">Barrière Checkpoint #18 scelle (Offset=500, Somme RocksDB=12 000 EUR)</span>
            <span class="bd-block" data-state="warn">Crash à l'offset 540 -> Tx aval #19 non pré-validée avortée (Rollback)</span>
            <span class="bd-block" data-state="healing">Restauration #18 (Offset=500, Somme=12 000 EUR) + rejeu propre 501..540</span>
          </div>
        </div>
      `;
      logs = [
        { s: "info", t: "[CHANDY-LAMPORT ABS] Des marqueurs légers ('checkpoint barriers') voyagent dans le flux même des données sans figer le cluster et photographient de façon asynchrone l'état RocksDB exact correspondant à l'offset 500." },
        { s: "ok", t: "[EXACTLY-ONCE + 2PC] Lors du crash à 540, la transaction aval non committée est annulée, l'état RocksDB revient à 500 et le rejeu 501..540 produit un résultat strictement identique à une exécution sans panne !" }
      ];
    }

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Scénario Streaming :</span>
        ${Object.entries(modes).map(([k, m]) => `
          <button type="button" class="bd-btn ${state.mode === k ? "is-active" : ""}" data-mode="${k}" data-variant="${m.variant}">
            <i class="bi ${m.icon}"></i>${m.label}
          </button>
        `).join("")}
      </div>
      ${controls}
      <div class="bd-metrics">
        ${metrics.map((m) => `
          <div class="bd-metric" data-state="${m.s}">
            <div class="bd-metric-label">${m.l}</div>
            <div class="bd-metric-val">${m.v}</div>
            <div class="bd-metric-sub">${m.sub}</div>
          </div>
        `).join("")}
      </div>
      ${bodyHtml}
      <div class="bd-console">
        ${logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">${l.t}</div>`).join("")}
      </div>
    `;

    applyFillBars(root);

    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        render();
      });
    });
    const latInp = root.querySelector('[data-inp="lateness"]');
    if (latInp) {
      latInp.addEventListener("input", () => {
        state.allowedLatenessMin = Number(latInp.value);
        render();
      });
    }
  }

  render();
  return root;
}

// ==========================================================================
// 5. SIMULATEUR ORCHESTRATION DAG, WAP & GOUVERNANCE RGPD (orchestration-gouvernance.qmd)
// ==========================================================================

export function createGovernanceWapSimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const state = {
    mode: "backfill",
    deterministicDate: false,
    wapEnabled: true,
    shredded: false
  };

  const modes = {
    backfill: { label: "Backfill DAG : Piège CURRENT_DATE()", variant: "warning", icon: "bi-calendar-range" },
    wap_branch: { label: "Disjoncteur Write-Audit-Publish (WAP)", variant: "primary", icon: "bi-git" },
    gdpr_snapshots: { label: "RGPD : Fuite Time Travel vs VACUUM", variant: "danger", icon: "bi-clock-fill" },
    gdpr_shred: { label: "RGPD sur Immuable : Crypto-Shredding KMS", variant: "success", icon: "bi-key-fill" }
  };

  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    let controls = "";
    let metrics = [];
    let bodyHtml = "";
    let logs = [];

    if (state.mode === "backfill") {
      controls = `
        <div class="bd-controls-row">
          <div class="bd-control-group">
            <div class="bd-control-head"><span>Prédicat Temporel du Job SQL (Rattrapage de 3 jours passés le 15 nov.)</span><span class="bd-control-val">${state.deterministicDate ? "Fenêtre logique {{ ds }}" : "CURRENT_DATE() (Anti-Pattern !)"}</span></div>
            <button type="button" class="bd-btn ${state.deterministicDate ? "is-active" : ""}" data-act="toggle-date" data-variant="${state.deterministicDate ? "success" : "danger"}">
              <i class="bi ${state.deterministicDate ? "bi-check2-circle" : "bi-exclamation-triangle-fill"}"></i>
              ${state.deterministicDate ? "Revenir à CURRENT_DATE() (Voir le bug)" : "Corriger avec l'intervalle logique {{ ds }} (Airflow / Dagster)"}
            </button>
          </div>
        </div>
      `;
      metrics = [
        { l: "Action Opérateur", v: "Backfill 12..14 nov.", sub: "Lancé le 15 novembre", s: "info" },
        { l: "Clause SQL exécutée", v: state.deterministicDate ? "dt = '{{ ds }}'" : "dt = CURRENT_DATE()", sub: state.deterministicDate ? "Paramétrée par la partition" : "Lit l'horloge système !", s: state.deterministicDate ? "ok" : "danger" },
        { l: "Partitions 12..14 nov.", v: state.deterministicDate ? "100 % Restaurées" : "CORROMPUES / VIDES", sub: state.deterministicDate ? "Chacune lit son jour exact" : "Ont lu le 15 nov. 3 fois !", s: state.deterministicDate ? "ok" : "danger" },
        { l: "Idempotence Temporelle", v: state.deterministicDate ? "DÉTERMINISTE" : "BRISÉE", sub: "Règle cardinale DAG", s: state.deterministicDate ? "ok" : "danger" }
      ];
      bodyHtml = `
        <div class="bd-zone" data-state="${state.deterministicDate ? "ok" : "danger"}">
          <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-diagram-2-fill"></i> Exécution du Rattrapage Historique (Backfill) sur 3 Partitions</span><span class="bd-pill" data-state="${state.deterministicDate ? "ok" : "danger"}">${state.deterministicDate ? "Pur & Rejouable" : "Bug Horloge Système"}</span></div>
          <table class="bd-mini-table">
            <thead><tr><th>Run Orchestrateur</th><th>Partition Cible</th><th>Source Effectivement Lue</th><th>Résultat en Production</th></tr></thead>
            <tbody>
              <tr data-state="${state.deterministicDate ? "ok" : "danger"}"><td>Run #1 (rattrapage)</td><td>dt = 2026-11-12</td><td>${state.deterministicDate ? "bronze (2026-11-12)" : "bronze (2026-11-15 !!)"}</td><td>${state.deterministicDate ? "Exact (14 200 ventes)" : "FAUX (Données du 15 copiées dans le 12 !)"}</td></tr>
              <tr data-state="${state.deterministicDate ? "ok" : "danger"}"><td>Run #2 (rattrapage)</td><td>dt = 2026-11-13</td><td>${state.deterministicDate ? "bronze (2026-11-13)" : "bronze (2026-11-15 !!)"}</td><td>${state.deterministicDate ? "Exact (15 890 ventes)" : "FAUX (Données du 15 copiées dans le 13 !)"}</td></tr>
              <tr data-state="${state.deterministicDate ? "ok" : "danger"}"><td>Run #3 (rattrapage)</td><td>dt = 2026-11-14</td><td>${state.deterministicDate ? "bronze (2026-11-14)" : "bronze (2026-11-15 !!)"}</td><td>${state.deterministicDate ? "Exact (11 400 ventes)" : "FAUX (Données du 15 copiées dans le 14 !)"}</td></tr>
            </tbody>
          </table>
        </div>
      `;
      logs = state.deterministicDate
        ? [{ s: "ok", t: "[PURETÉ FONCTIONNELLE] En injectant la borne logique d'orchestration (data_interval_start / partition_key), un job lancé 6 mois plus tard reconstruit exactement la partition historique voulue." }]
        : [{ s: "danger", t: "[ANTI-PATTERN MAJEUR] CURRENT_DATE() ou datetime.now() évalue l'heure où le serveur exécute le script, jamais la journée métier rattrapée : vos 3 jours d'historique contiennent désormais des clones du 15 novembre !" }];
    } else if (state.mode === "wap_branch") {
      controls = `
        <div class="bd-controls-row">
          <div class="bd-control-group">
            <div class="bd-control-head"><span>Architecture de Déploiement des Données (Anomalie amont : 18 % de clés NULL)</span><span class="bd-control-val">${state.wapEnabled ? "WAP Actif (Branche Nessie/Iceberg)" : "Écriture Directe sur main"}</span></div>
            <button type="button" class="bd-btn ${state.wapEnabled ? "is-active" : ""}" data-act="toggle-wap" data-variant="${state.wapEnabled ? "success" : "danger"}">
              <i class="bi bi-git"></i>${state.wapEnabled ? "Désactiver WAP (Observer la pollution BI)" : "Activer Write-Audit-Publish (Branche Isolée)"}
            </button>
          </div>
        </div>
      `;
      metrics = [
        { l: "1. Write (Écriture)", v: state.wapEnabled ? "branch: audit_run_42" : "branch: main (Direct)", sub: "Zero-copy sur métadonnées", s: state.wapEnabled ? "info" : "warn" },
        { l: "2. Audit (Contrat dbt)", v: "ÉCHEC (18 % NULL)", sub: "Seuil max toléré : 0 %", s: "danger" },
        { l: "3. Publish (Promotion)", v: state.wapEnabled ? "AVORTÉ (Drop Branch)" : "DÉJÀ EXPOSÉ !", sub: state.wapEnabled ? "Circuit-breaker déclenché" : "Aucun retour arrière auto", s: state.wapEnabled ? "ok" : "danger" },
        { l: "Dashboards Direction", v: state.wapEnabled ? "100 % SAINS (Snapshot N-1)" : "POLLUÉS (-18 % CA !)", sub: state.wapEnabled ? "Zéro impact utilisateur" : "Incident critique ouvert", s: state.wapEnabled ? "ok" : "danger" }
      ];
      bodyHtml = `
        <div class="bd-topology-3">
          <div class="bd-zone" data-state="info">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-pencil-square"></i> 1. WRITE</span><span class="bd-pill" data-state="info">${state.wapEnabled ? "audit_run_42" : "main"}</span></div>
            <div class="bd-node-body">${state.wapEnabled ? "Spark écrit les nouveaux fichiers Parquet uniquement dans le manifeste d'une branche isolée du catalogue Iceberg/Nessie." : "Spark committe directement le lot corrompu sur la table de production lue par Tableau / Power BI."}</div>
          </div>
          <div class="bd-zone" data-state="danger">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-clipboard2-pulse-fill"></i> 2. AUDIT</span><span class="bd-pill" data-state="danger">Assertion Failed</span></div>
            <div class="bd-node-body">Test de contrat : <code>not_null(customer_id)</code> détecte 18 % de valeurs nulles dues à un bug API amont.</div>
          </div>
          <div class="bd-zone" data-state="${state.wapEnabled ? "ok" : "danger"}">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-megaphone-fill"></i> 3. PUBLISH</span><span class="bd-pill" data-state="${state.wapEnabled ? "ok" : "danger"}">${state.wapEnabled ? "main protégée" : "main corrompue"}</span></div>
            <div class="bd-node-body">${state.wapEnabled ? "Le merge atomique vers <code>main</code> est bloqué ! Les analystes continuent d'interroger la version certifiée précédente sans interruption." : "Trop tard : les tests tournant APRÈS publication sur <code>main</code>, les rapports exécutifs affichent déjà des chiffres faux."}</div>
          </div>
        </div>
      `;
      logs = [
        { s: state.wapEnabled ? "ok" : "danger", t: state.wapEnabled ? "[WAP BLUE/GREEN] Créer une branche dans Nessie ou Iceberg ne copie aucun fichier Parquet (pur pointeur de métadonnées) et permet de valider plusieurs tables atomiquement avant exposition." : "[ALERTE] Tester une table APRÈS l'avoir écrite en production transforme chaque test échoué en panne visible par les métiers !" }
      ];
    } else if (state.mode === "gdpr_snapshots") {
      metrics = [
        { l: "Requête Légale", v: "Art. 17 RGPD", sub: "Effacer client usr_891", s: "info" },
        { l: "Après SQL DELETE seul", v: "NON CONFORME !", sub: "Lisible via VERSION AS OF", s: "danger" },
        { l: "Snapshots Historiques", v: "Conservés 7 à 30 j", sub: "Pointent vers les vieux Parquet", s: "warn" },
        { l: "Conformité Physique", v: "DELETE + VACUUM", sub: "Purge snapshots & orphelins", s: "ok" }
      ];
      bodyHtml = `
        <div class="bd-topology">
          <div class="bd-zone" data-state="danger">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-exclamation-octagon-fill"></i> Piège du <code>DELETE</code> Logique Seul</span><span class="bd-pill" data-state="danger">Fuite Time Travel</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="ok">Snapshot v15 (Actuel) : usr_891 masqué</span>
              <span class="bd-block" data-state="danger">Snapshot v14 (S3) : part-001.parquet contient toujours email &amp; IBAN de usr_891 !</span>
            </div>
          </div>
          <div class="bd-zone" data-state="ok">
            <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-trash3-fill"></i> Pipeline Complet d'Effacement Physique</span><span class="bd-pill" data-state="ok">Octets S3 détruits</span></div>
            <div class="bd-blocks">
              <span class="bd-block" data-state="ok">1. DELETE / MERGE RGPD groupé</span>
              <span class="bd-block" data-state="ok">2. OPTIMIZE / rewrite_data_files</span>
              <span class="bd-block" data-state="ok">3. VACUUM / expire_snapshots (délai légal &lt; 30 j)</span>
            </div>
          </div>
        </div>
      `;
      logs = [
        { s: "warn", t: "[IMMUABILITÉ vs RGPD] Dans un Lakehouse MVCC, un DELETE crée un nouveau snapshot ou un Deletion Vector sans toucher aux anciens fichiers Parquet utilisés par le Time Travel." },
        { s: "ok", t: "[BONNE PRATIQUE] Regroupez les demandes d'effacement RGPD dans un batch hebdomadaire (le RGPD accorde 30 jours) suivi d'une expiration des snapshots antérieurs pour éviter de réécrire Pétaoctets toutes les 5 minutes." }
      ];
    } else {
      controls = `
        <div class="bd-controls-row">
          <div class="bd-control-group">
            <div class="bd-control-head"><span>État de la Clé KMS de <code>usr_891</code> (DEK : Data Encryption Key)</span><span class="bd-control-val">${state.shredded ? "CLÉ DÉTRUITE (Crypto-Shredded !)" : "Clé KMS Active"}</span></div>
            <button type="button" class="bd-btn ${state.shredded ? "is-active" : ""}" data-act="toggle-shred" data-variant="${state.shredded ? "danger" : "success"}">
              <i class="bi ${state.shredded ? "bi-arrow-counterclockwise" : "bi-fire"}"></i>
              ${state.shredded ? "Restaurer la simulation initiale" : "Exécuter le Droit à l'Oubli : Détruire la clé KMS usr_891"}
            </button>
          </div>
        </div>
      `;
      metrics = [
        { l: "Octets Réécrits sur S3/Kafka", v: "0 octet", sub: "Journaux immuables intacts", s: "ok" },
        { l: "Latence d'Effacement", v: state.shredded ? "12 ms (Appel KMS)" : "En attente", sub: "Suppression d'une clé 256 bits", s: state.shredded ? "ok" : "info" },
        { l: "PII dans Kafka + Bronze", v: state.shredded ? "INDÉCHIFFRABLE" : "Déchiffrable via KMS", sub: "AES-256-GCM par sujet", s: state.shredded ? "ok" : "warn" },
        { l: "Statut Agrégats Gold", v: "100 % Préservés", sub: "Montants non-PII intacts !", s: "ok" }
      ];
      bodyHtml = `
        <div class="bd-zone" data-state="${state.shredded ? "ok" : "info"}">
          <div class="bd-zone-header"><span class="bd-zone-title"><i class="bi bi-safe2-fill"></i> Crypto-Shredding sur Topics Kafka, Bronze &amp; Archives Froides</span><span class="bd-pill" data-state="${state.shredded ? "ok" : "primary"}">${state.shredded ? "Anonymisé définitivement" : "Chiffrement par enveloppe"}</span></div>
          <table class="bd-mini-table">
            <thead><tr><th>Système Stockage</th><th>Champs Métier (Clair)</th><th>Champs PII (Chiffrés avec DEK_891)</th><th>Vue Lecteur Autorisé</th></tr></thead>
            <tbody>
              <tr data-state="ok"><td>Topic Kafka <code>orders</code></td><td>tx=9012, amount=149.00 EUR</td><td><code>ENC(AES256, DEK_891)</code></td><td>${state.shredded ? "[REDACTED — Clé détruite]" : "alice.martin@mail.fr"}</td></tr>
              <tr data-state="ok"><td>Table <code>bronze.events</code></td><td>tx=9012, country="FR"</td><td><code>ENC(AES256, DEK_891)</code></td><td>${state.shredded ? "[REDACTED — Clé détruite]" : "alice.martin@mail.fr"}</td></tr>
              <tr data-state="ok"><td>Archive Glacier 5 ans</td><td>tx=9012, amount=149.00 EUR</td><td><code>ENC(AES256, DEK_891)</code></td><td>${state.shredded ? "[REDACTED — Clé détruite]" : "alice.martin@mail.fr"}</td></tr>
            </tbody>
          </table>
        </div>
      `;
      logs = [
        { s: "info", t: "[CRYPTO-SHREDDING] Comment oublier un citoyen dans un journal Kafka ou une bande de sauvegarde qu'on ne peut pas modifier ? En chiffrant ses champs PII à l'ingestion avec une clé individuelle DEK stockée dans un KMS." },
        { s: state.shredded ? "ok" : "warn", t: state.shredded ? "[CONFORMITÉ INSTANTANÉE] La destruction irréversible de DEK_891 transforme instantanément tous les ciphertexts historiques en bruit aléatoire mathématiquement indéchiffrable, tout en gardant les montants comptables intacts !" : "[PRÊT] Cliquez sur le bouton ci-dessus pour détruire la clé KMS de usr_891 et observer l'effet simultané sur Kafka, Bronze et les archives." }
      ];
    }

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Scénario Orchestration &amp; RGPD :</span>
        ${Object.entries(modes).map(([k, m]) => `
          <button type="button" class="bd-btn ${state.mode === k ? "is-active" : ""}" data-mode="${k}" data-variant="${m.variant}">
            <i class="bi ${m.icon}"></i>${m.label}
          </button>
        `).join("")}
      </div>
      ${controls}
      <div class="bd-metrics">
        ${metrics.map((m) => `
          <div class="bd-metric" data-state="${m.s}">
            <div class="bd-metric-label">${m.l}</div>
            <div class="bd-metric-val">${m.v}</div>
            <div class="bd-metric-sub">${m.sub}</div>
          </div>
        `).join("")}
      </div>
      ${bodyHtml}
      <div class="bd-console">
        ${logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">${l.t}</div>`).join("")}
      </div>
    `;

    root.querySelectorAll("[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        render();
      });
    });
    const dateBtn = root.querySelector('[data-act="toggle-date"]');
    if (dateBtn) {
      dateBtn.addEventListener("click", () => {
        state.deterministicDate = !state.deterministicDate;
        render();
      });
    }
    const wapBtn = root.querySelector('[data-act="toggle-wap"]');
    if (wapBtn) {
      wapBtn.addEventListener("click", () => {
        state.wapEnabled = !state.wapEnabled;
        render();
      });
    }
    const shredBtn = root.querySelector('[data-act="toggle-shred"]');
    if (shredBtn) {
      shredBtn.addEventListener("click", () => {
        state.shredded = !state.shredded;
        render();
      });
    }
  }

  render();
  return root;
}
