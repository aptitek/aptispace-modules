// ==========================================================================
// bigdata-cluster.js — Simulateurs interactifs de systèmes distribués & pannes
// Chapitres : fondations.qmd, hdfs.qmd, mapreduce.qmd, spark.qmd
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
// 1. SIMULATEUR CAP, SLA & SENSIBILITÉ AU DÉLAI O(d) vs O(1) (fondations.qmd)
// ==========================================================================

export function createCapDelaySimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const state = {
    preset: "nominal",
    delayRemote: 18,
    slaMs: 120,
    infinitePartition: false
  };

  const presets = {
    nominal: { label: "Réseau Nominal", delay: 18, sla: 120, inf: false, variant: "success", icon: "bi-wifi" },
    congestion: { label: "Congestion WAN", delay: 190, sla: 120, inf: false, variant: "warning", icon: "bi-exclamation-diamond" },
    fairloss: { label: "Coupure Fair-Loss (Retransmissions)", delay: 850, sla: 120, inf: false, variant: "danger", icon: "bi-scissors" },
    infinite: { label: "Partition Infinie (Gilbert & Lynch)", delay: 1000, sla: 120, inf: true, variant: "danger", icon: "bi-slash-circle" }
  };

  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    const dLocal = 2;
    const dRem = state.delayRemote;
    const isInf = state.infinitePartition;

    const linLat = isInf ? Infinity : (2 * dRem + dLocal);
    const seqWriteLat = isInf ? Infinity : (dRem + dLocal);
    const seqReadLat = dLocal;
    const causalLat = 2 * dLocal;
    const eventualLat = dLocal;

    const linSlaOk = !isInf && linLat <= state.slaMs;
    const seqWriteOk = !isInf && seqWriteLat <= state.slaMs;
    const linAvailEmp = isInf ? "0,0 %" : (linSlaOk ? "99,99 %" : (linLat < state.slaMs * 2.5 ? "41,2 % (Timeouts SLA)" : "0,8 % (Indisponible SLA)"));

    const linkState = isInf ? "danger" : (dRem > state.slaMs / 2 ? "warn" : "ok");
    const linkLabel = isInf
      ? "PARTITION INFINIE : 100 % des paquets inter-DC perdus définitivement"
      : (dRem > 300
        ? `LIEN FAIR-LOSS DÉGRADÉ : pertes + retransmissions TCP (d_remote = ${dRem} ms)`
        : `LIAISON INTER-DATACENTER ACTIVE : d_local = ${dLocal} ms | d_remote = ${dRem} ms`);

    const models = [
      {
        name: "Linéarisabilité (C de CAP)",
        complexity: "Lecture O(d) · Écriture O(d)",
        writeTxt: isInf ? "Bloquée (∞)" : `${linLat} ms`,
        readTxt: isInf ? "Bloquée (∞)" : `${linLat} ms`,
        state: isInf ? "dead" : (linSlaOk ? "ok" : "danger"),
        pill: isInf ? "Vivacité sacrifiée" : (linSlaOk ? "SLA respecté" : "Violation SLA !"),
        pillState: isInf || !linSlaOk ? "danger" : "ok",
        fill: isInf ? 100 : Math.min(100, Math.round((linLat / 500) * 100)),
        desc: isInf
          ? "Impossible de valider le quorum distant : le système bloque toute réponse pour interdire les lectures obsolètes."
          : (linSlaOk
            ? "Quorum synchrone atteint sous le seuil SLA : récence temps réel garantie sur objet unique."
            : "Formellement « disponible » au sens de Gilbert & Lynch (finit par répondre), mais en panne côté utilisateur (timeout SLA) !")
      },
      {
        name: "Cohérence Séquentielle",
        complexity: "Écriture O(d) · Lecture O(1)",
        writeTxt: isInf ? "Bloquée (∞)" : `${seqWriteLat} ms`,
        readTxt: `${seqReadLat} ms (Locale)`,
        state: isInf ? "warn" : (seqWriteOk ? "ok" : "warn"),
        pill: seqWriteOk ? "Ordre global OK" : "Écriture ralentie",
        pillState: seqWriteOk ? "info" : "warn",
        fill: isInf ? 100 : Math.min(100, Math.round((seqWriteLat / 500) * 100)),
        desc: "Les lectures s'exécutent localement en O(1) selon un ordre global unique, mais sans garantie de récence à la milliseconde près."
      },
      {
        name: "Cohérence Causale (ex. COPS)",
        complexity: "Lecture O(1) · Écriture O(1)",
        writeTxt: `${causalLat} ms (d_local)`,
        readTxt: `${causalLat} ms (d_local)`,
        state: "ok",
        pill: "Optimum sans coordination WAN",
        pillState: "ok",
        fill: Math.max(6, Math.round((causalLat / 500) * 100)),
        desc: "Linéarisable intra-DC O(d_local), réplication causale asynchrone inter-DC : zéro blocage WAN et respect strict de la causalité (question → réponse)."
      },
      {
        name: "Cohérence Éventuelle",
        complexity: "Lecture O(1) · Écriture O(1)",
        writeTxt: `${eventualLat} ms`,
        readTxt: `${eventualLat} ms`,
        state: dRem > 100 || isInf ? "warn" : "ok",
        pill: dRem > 100 || isInf ? "Lectures obsolètes (Stale)" : "Convergence rapide",
        pillState: dRem > 100 || isInf ? "warn" : "primary",
        fill: Math.max(4, Math.round((eventualLat / 500) * 100)),
        desc: dRem > 100 || isInf
          ? `Attention : divergence temporaire de ${isInf ? "durée indéterminée" : `${dRem} ms`} entre répliques ; inversions causales possibles.`
          : "Réponse immédiate en mémoire locale ; les répliques convergent dès que les écritures ralentissent."
      }
    ];

    const logs = [];
    if (isInf) {
      logs.push({ s: "danger", t: "[RÉSEAU] Partition infinie déclarée entre Paris (DC-1) et Francfort (DC-2)." });
      logs.push({ s: "danger", t: "[CAP] Théorème d'impossibilité actif : Linéarisabilité + Terminaison mathématiquement incompatibles." });
      logs.push({ s: "ok", t: `[CAUSAL] DC-1 continue de servir lectures/écritures en ${causalLat} ms O(1) avec ordre causal préservé.` });
    } else if (!linSlaOk) {
      logs.push({ s: "warn", t: `[SLA] Seuil client fixé à ${state.slaMs} ms, mais l'aller-retour de consensus exige ${linLat} ms.` });
      logs.push({ s: "danger", t: "[PRATIQUE vs THÉORIE] Gilbert & Lynch jugent ce nœud « Disponible » (réponse finie), mais l'API Gateway coupe en HTTP 504 !" });
      logs.push({ s: "info", t: `[ABD / FAIR-LOSS] Le lien finit par délivrer les paquets réémis après ${dRem} ms : la sécurité (safety) reste intacte.` });
    } else {
      logs.push({ s: "ok", t: `[NOMINAL] Consensus inter-DC bouclé en ${linLat} ms <= SLA (${state.slaMs} ms).` });
      logs.push({ s: "info", t: "[CONSEIL] Même à faible latence, l'architecture COPS divise le temps de réponse par " + Math.round(linLat / causalLat) + "× en évitant le transit WAN synchrone." });
    }

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Scénario réseau :</span>
        <button type="button" class="bd-btn ${state.preset === "nominal" ? "is-active" : ""}" data-preset="nominal" data-variant="success">
          <i class="bi bi-check-circle"></i> Nominal (18 ms)
        </button>
        <button type="button" class="bd-btn ${state.preset === "congestion" ? "is-active" : ""}" data-preset="congestion" data-variant="warning">
          <i class="bi bi-activity"></i> Congestion WAN (190 ms)
        </button>
        <button type="button" class="bd-btn ${state.preset === "fairloss" ? "is-active" : ""}" data-preset="fairloss" data-variant="danger">
          <i class="bi bi-arrow-repeat"></i> Pertes Fair-Loss (850 ms)
        </button>
        <button type="button" class="bd-btn ${state.preset === "infinite" ? "is-active" : ""}" data-preset="infinite" data-variant="danger">
          <i class="bi bi-lightning-charge"></i> Partition Infinie (∞)
        </button>
      </div>

      <div class="bd-controls-row">
        <div class="bd-control-group">
          <div class="bd-control-head">
            <span>Délai inter-datacenter <code>d_remote</code></span>
            <span class="bd-control-val">${isInf ? "∞ (Coupé)" : `${dRem} ms`}</span>
          </div>
          <input type="range" class="bd-range" data-input="delay" min="5" max="1000" step="5" value="${dRem}" ${isInf ? "disabled" : ""}>
        </div>
        <div class="bd-control-group">
          <div class="bd-control-head">
            <span>Budget maximal du contrat SLA</span>
            <span class="bd-control-val">${state.slaMs} ms</span>
          </div>
          <input type="range" class="bd-range" data-input="sla" min="30" max="400" step="10" value="${state.slaMs}">
        </div>
      </div>

      <div class="bd-link-banner" data-state="${linkState}">
        <span><i class="bi bi-diagram-3"></i> ${linkLabel}</span>
        <span class="bd-pill" data-state="${linSlaOk ? "ok" : "danger"}">Disponibilité SLA Linéarisable : ${linAvailEmp}</span>
      </div>

      <div class="bd-topology">
        ${models.map((m) => `
          <div class="bd-node" data-state="${m.state}">
            <div class="bd-node-head">
              <span>${m.name}</span>
              <span class="bd-pill" data-state="${m.pillState}">${m.pill}</span>
            </div>
            <div class="bd-node-body">
              <div class="mb-1"><code>${m.complexity}</code></div>
              <div class="d-flex justify-content-between small mb-1">
                <span>Écriture : <strong>${m.writeTxt}</strong></span>
                <span>Lecture : <strong>${m.readTxt}</strong></span>
              </div>
              <div class="bd-bar-track mb-2">
                <div class="bd-bar-fill" data-state="${m.state === "dead" ? "danger" : m.state}" data-fill="${m.fill}"></div>
              </div>
              <div>${m.desc}</div>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="bd-console">
        ${logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">&gt; ${l.t}</div>`).join("")}
      </div>
    `;

    applyFillBars(root);

    root.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.preset;
        const p = presets[key];
        state.preset = key;
        state.delayRemote = p.delay;
        state.slaMs = p.sla;
        state.infinitePartition = p.inf;
        render();
      });
    });

    const delayInput = root.querySelector('[data-input="delay"]');
    if (delayInput) {
      delayInput.addEventListener("input", (e) => {
        state.delayRemote = Number(e.target.value);
        state.infinitePartition = false;
        state.preset = "custom";
        render();
      });
    }

    const slaInput = root.querySelector('[data-input="sla"]');
    if (slaInput) {
      slaInput.addEventListener("input", (e) => {
        state.slaMs = Number(e.target.value);
        state.preset = "custom";
        render();
      });
    }
  }

  render();
  return root;
}

// ==========================================================================
// 2. SIMULATEUR CLUSTER HDFS : TOPOLOGIE RACK-AWARE & AUTOGUÉRISON (hdfs.qmd)
// ==========================================================================

export function createHdfsClusterSimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const scenarios = {
    nominal: {
      nnState: "ok",
      nnBadge: "Actif (RAM : 1,2 Go / 64 Go)",
      nnMode: "Lecture / Écriture (fsimage + edits synchronisés)",
      secBadge: "Checkpoint prêt (fusion périodique)",
      rack1State: "ok",
      rack2State: "ok",
      nodes: [
        { id: "DN1", rack: 1, hb: "3 s", state: "ok", blocks: [{ b: "B1 (128 Mo)", s: "primary" }, { b: "B2 (128 Mo)", s: "ok" }] },
        { id: "DN2", rack: 1, hb: "3 s", state: "ok", blocks: [{ b: "B3 (44 Mo)", s: "primary" }, { b: "B1 (128 Mo)", s: "ok" }] },
        { id: "DN3", rack: 2, hb: "3 s", state: "ok", blocks: [{ b: "B1 (128 Mo)", s: "ok" }, { b: "B2 (128 Mo)", s: "primary" }, { b: "B3 (44 Mo)", s: "ok" }] },
        { id: "DN4", rack: 2, hb: "3 s", state: "ok", blocks: [{ b: "B2 (128 Mo)", s: "ok" }, { b: "B3 (44 Mo)", s: "ok" }] }
      ],
      metrics: [
        { l: "Fichier 300 Mo", v: "3 Blocs", sub: "128 + 128 + 44 Mo", s: "info" },
        { l: "Réplication R=3", v: "9 / 9 Répliques", sub: "2 Racks distincts", s: "ok" },
        { l: "Ratio Seek / Transfert", v: "0,8 %", sub: "10 ms pour 1,28 s @100 Mo/s", s: "ok" },
        { l: "Santé Cluster", v: "100 % Intègre", sub: "Checksums CRC32 valides", s: "ok" }
      ],
      logs: [
        { s: "info", t: "[CLIENT] Demande d'écriture /data/ventes.parquet (300 Mo) -> Découpage en 3 blocs (dfs.blocksize = 128 Mo)." },
        { s: "ok", t: "[RACK-AWARENESS] Placement B1 : Réplique 1 sur DN1 (Rack 1 local), Réplique 2 sur DN3 (Rack 2 distant), Réplique 3 sur DN2/DN4." },
        { s: "ok", t: "[NAMENODE] Journalisation dans edit log validée ; 0 octet de donnée utilisateur n'a transité par le NameNode." }
      ]
    },
    dn_crash: {
      nnState: "ok",
      nnBadge: "Alerte Sous-Réplication -> Guérison",
      nnMode: "Ordre de copie émis vers DN1 / DN4",
      secBadge: "Standby synchronisé",
      rack1State: "warn",
      rack2State: "ok",
      nodes: [
        { id: "DN1", rack: 1, hb: "2 s", state: "ok", blocks: [{ b: "B1 (128 Mo)", s: "ok" }, { b: "B2 (128 Mo)", s: "ok" }, { b: "B3 (Copié auto)", s: "healing" }] },
        { id: "DN2", rack: 1, hb: "TIMEOUT > 10 min", state: "dead", blocks: [{ b: "B3 (Perdu)", s: "danger" }, { b: "B1 (Perdu)", s: "danger" }] },
        { id: "DN3", rack: 2, hb: "3 s", state: "ok", blocks: [{ b: "B1 (128 Mo)", s: "ok" }, { b: "B2 (128 Mo)", s: "ok" }, { b: "B3 (Source saine)", s: "primary" }] },
        { id: "DN4", rack: 2, hb: "3 s", state: "ok", blocks: [{ b: "B2 (128 Mo)", s: "ok" }, { b: "B3 (128 Mo)", s: "ok" }, { b: "B1 (Copié auto)", s: "healing" }] }
      ],
      metrics: [
        { l: "Détection Panne", v: "Heartbeat = 0", sub: "DN2 déclaré mort (> 10 min)", s: "danger" },
        { l: "Blocs Affectés", v: "B1, B3 (R=2→3)", sub: "Re-réplication automatique", s: "info" },
        { l: "Continuité Lecture", v: "0 Interruption", sub: "Bascule transparente client", s: "ok" },
        { l: "État Final", v: "Auto-Guéri", sub: "Quota R=3 restauré", s: "ok" }
      ],
      logs: [
        { s: "danger", t: "[HEARTBEAT] Aucun signal reçu de DN2 (Rack 1) depuis > 10 min 30 s -> DN2 marqué DEAD par le NameNode." },
        { s: "warn", t: "[REPLICATION MONITOR] Blocs B1 et B3 tombés à R=2 (< dfs.replication=3)." },
        { s: "ok", t: "[SELF-HEALING] DN3 copie B3 vers DN1 et DN1 copie B1 vers DN4 en arrière-plan : quota R=3 restauré sans intervention humaine !" }
      ]
    },
    bitrot: {
      nnState: "ok",
      nnBadge: "Signalement Corruption Bloc",
      nnMode: "Invalidation réplique altérée & remplacement",
      secBadge: "Standby synchronisé",
      rack1State: "ok",
      rack2State: "warn",
      nodes: [
        { id: "DN1", rack: 1, hb: "3 s", state: "ok", blocks: [{ b: "B1 (128 Mo)", s: "ok" }, { b: "B2 (Source réparation)", s: "primary" }] },
        { id: "DN2", rack: 1, hb: "3 s", state: "ok", blocks: [{ b: "B3 (44 Mo)", s: "ok" }, { b: "B1 (128 Mo)", s: "ok" }] },
        { id: "DN3", rack: 2, hb: "3 s", state: "warn", blocks: [{ b: "B1 (128 Mo)", s: "ok" }, { b: "B2 (CRC32 INVALIDE !)", s: "corrupt" }, { b: "B3 (44 Mo)", s: "ok" }] },
        { id: "DN4", rack: 2, hb: "3 s", state: "ok", blocks: [{ b: "B2 (Lecture basculée)", s: "healing" }, { b: "B3 (44 Mo)", s: "ok" }] }
      ],
      metrics: [
        { l: "Incident Physique", v: "Bit-Rot Disque", sub: "Secteur magnétique altéré (DN3)", s: "danger" },
        { l: "Détection", v: "Échec Checksum", sub: "Vérifié à la lecture client", s: "warn" },
        { l: "Bascule Client", v: "DN3 → DN4", sub: "Lecture saine immédiate", s: "ok" },
        { l: "Réparation", v: "DN1 → DN3", sub: "Écrasement du bloc corrompu", s: "info" }
      ],
      logs: [
        { s: "danger", t: "[CHECKSUM] Le client lit B2 sur DN3 : somme de contrôle calculée != somme stockée (corruption silencieuse disque)." },
        { s: "info", t: "[FAILOVER] Le client bascule immédiatement sur la réplique saine de DN4 et signale le bloc corrompu au NameNode." },
        { s: "ok", t: "[BLOCK SCANNER] Le NameNode ordonne la suppression du bloc vicié sur DN3 et sa régénération depuis DN1." }
      ]
    },
    rack_outage: {
      nnState: "ok",
      nnBadge: "Perte Complète du Switch Rack 1",
      nnMode: "Survie garantie par Rack-Awareness",
      secBadge: "Standby actif",
      rack1State: "offline",
      rack2State: "ok",
      nodes: [
        { id: "DN1", rack: 1, hb: "HORS LIGNE", state: "dead", blocks: [{ b: "B1 (Inaccessible)", s: "danger" }, { b: "B2 (Inaccessible)", s: "danger" }] },
        { id: "DN2", rack: 1, hb: "HORS LIGNE", state: "dead", blocks: [{ b: "B3 (Inaccessible)", s: "danger" }, { b: "B1 (Inaccessible)", s: "danger" }] },
        { id: "DN3", rack: 2, hb: "2 s", state: "ok", blocks: [{ b: "B1 (Disponible !)", s: "ok" }, { b: "B2 (Disponible !)", s: "ok" }, { b: "B3 (Disponible !)", s: "ok" }] },
        { id: "DN4", rack: 2, hb: "2 s", state: "ok", blocks: [{ b: "B2 (Disponible !)", s: "ok" }, { b: "B3 (Disponible !)", s: "ok" }] }
      ],
      metrics: [
        { l: "Panne Majeure", v: "Switch / PDU Rack 1", sub: "100 % des nœuds Rack 1 coupés", s: "danger" },
        { l: "Blocs Survivants", v: "3 / 3 Blocs (100 %)", sub: "B1, B2, B3 présents sur Rack 2", s: "ok" },
        { l: "Perte de Données", v: "0 Octet", sub: "Sauvé par la politique 2-Racks", s: "ok" },
        { l: "Si Placement Aléatoire", v: "Risque Perte !", sub: "Les 3 copies auraient pu être sur Rack 1", s: "warn" }
      ],
      logs: [
        { s: "danger", t: "[INCIDENT CRITIQUE] Disjonction électrique / panne du commutateur Top-of-Rack de la Baie 1 : DN1 et DN2 tombent simultanément !" },
        { s: "ok", t: "[RACK-AWARENESS] Comme HDFS place obligatoirement au moins une réplique sur une baie distante, B1, B2 et B3 survivent tous sur le Rack 2." },
        { s: "info", t: "[CONTINUITÉ] Les jobs analytiques poursuivent leurs lectures depuis DN3 et DN4 sans aucune perte de fichier." }
      ]
    },
    safemode: {
      nnState: "warn",
      nnBadge: "SAFEMODE (Lecture Seule Stricte)",
      nnMode: "Attente seuil Block Reports (99,9 %) + Fusion Checkpoint",
      secBadge: "Fusion fsimage + edit log en cours...",
      rack1State: "ok",
      rack2State: "ok",
      nodes: [
        { id: "DN1", rack: 1, hb: "Block Report OK", state: "ok", blocks: [{ b: "B1", s: "info" }, { b: "B2", s: "info" }] },
        { id: "DN2", rack: 1, hb: "Block Report OK", state: "ok", blocks: [{ b: "B3", s: "info" }, { b: "B1", s: "info" }] },
        { id: "DN3", rack: 2, hb: "Inventaire en cours...", state: "warn", blocks: [{ b: "B1", s: "warn" }, { b: "B2", s: "warn" }] },
        { id: "DN4", rack: 2, hb: "Block Report OK", state: "ok", blocks: [{ b: "B2", s: "info" }, { b: "B3", s: "info" }] }
      ],
      metrics: [
        { l: "État NameNode", v: "SAFEMODE", sub: "Écritures / suppressions bloquées", s: "warn" },
        { l: "Cohérence Namespace", v: "Linéarisable", sub: "Zéro décision hâtive de copie", s: "info" },
        { l: "Checkpointing", v: "fsimage + edits", sub: "Fusionné par Secondary / Standby", s: "ok" },
        { l: "Block Reports", v: "78 % → 99,9 %", sub: "Reconstruction table RAM", s: "warn" }
      ],
      logs: [
        { s: "warn", t: "[SAFEMODE] Redémarrage du NameNode : chargement de la fsimage consolidée + relecture du dernier edit log." },
        { s: "info", t: "[LINÉARISABILITÉ] Tant que les DataNodes n'ont pas remonté leurs Block Reports, HDFS refuse toute écriture pour protéger l'espace de noms." },
        { s: "ok", t: "[CHECKPOINT] Grâce au fusionnement périodique assuré par le Secondary/Standby NameNode, le redémarrage prend quelques secondes au lieu de plusieurs heures." }
      ]
    },
    smallfiles: {
      nnState: "danger",
      nnBadge: "SATURATION RAM NAMENODE (98 %)",
      nnMode: "GC Pause critique — 40 millions d'inodes de 10 Ko !",
      secBadge: "fsimage hypertrophiée",
      rack1State: "ok",
      rack2State: "ok",
      nodes: [
        { id: "DN1", rack: 1, hb: "Disque : 4 % utilisé", state: "ok", blocks: [{ b: "10M micro-blocs (10 Ko)", s: "warn" }] },
        { id: "DN2", rack: 1, hb: "Disque : 4 % utilisé", state: "ok", blocks: [{ b: "10M micro-blocs (10 Ko)", s: "warn" }] },
        { id: "DN3", rack: 2, hb: "Disque : 4 % utilisé", state: "ok", blocks: [{ b: "10M micro-blocs (10 Ko)", s: "warn" }] },
        { id: "DN4", rack: 2, hb: "Disque : 4 % utilisé", state: "ok", blocks: [{ b: "10M micro-blocs (10 Ko)", s: "warn" }] }
      ],
      metrics: [
        { l: "Données Réelles", v: "400 Go seuls", sub: "40M fichiers × 10 Ko", s: "warn" },
        { l: "RAM NameNode", v: "~18 Go saturés", sub: "~150 octets × (fichiers + blocs)", s: "danger" },
        { l: "Ratio Seek Disque", v: "99 % d'attente !", sub: "10 ms seek pour 0,1 ms lecture", s: "danger" },
        { l: "Remède", v: "Compaction", sub: "Regrouper en blocs >= 128 Mo", s: "info" }
      ],
      logs: [
        { s: "danger", t: "[SMALL FILE PROBLEM] 40 millions de fichiers de 10 Ko ne pèsent que 400 Go sur les DataNodes, mais étouffent la RAM du NameNode !" },
        { s: "danger", t: "[GOULOT SEEK] Les têtes de lecture mécaniques passent 10 ms à se déplacer pour lire 0,1 ms d'octets : le débit s'effondre." },
        { s: "info", t: "[ARCHITECTURE] HDFS est conçu pour un nombre modéré de grands fichiers séquentiels (>= 128 Mo), jamais pour des millions de micro-fichiers." }
      ]
    }
  };

  let current = "nominal";
  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    const sc = scenarios[current];
    const r1Nodes = sc.nodes.filter((n) => n.rack === 1);
    const r2Nodes = sc.nodes.filter((n) => n.rack === 2);

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Injecter une situation :</span>
        <button type="button" class="bd-btn ${current === "nominal" ? "is-active" : ""}" data-sc="nominal" data-variant="success">
          <i class="bi bi-check2-circle"></i> Nominal (R=3)
        </button>
        <button type="button" class="bd-btn ${current === "dn_crash" ? "is-active" : ""}" data-sc="dn_crash" data-variant="danger">
          <i class="bi bi-hdd-network"></i> Crash DataNode
        </button>
        <button type="button" class="bd-btn ${current === "bitrot" ? "is-active" : ""}" data-sc="bitrot" data-variant="warning">
          <i class="bi bi-bug"></i> Bit-Rot (Checksum)
        </button>
        <button type="button" class="bd-btn ${current === "rack_outage" ? "is-active" : ""}" data-sc="rack_outage" data-variant="danger">
          <i class="bi bi-plug"></i> Panne Totale Rack 1
        </button>
        <button type="button" class="bd-btn ${current === "safemode" ? "is-active" : ""}" data-sc="safemode" data-variant="warning">
          <i class="bi bi-shield-lock"></i> Safemode & Checkpoint
        </button>
        <button type="button" class="bd-btn ${current === "smallfiles" ? "is-active" : ""}" data-sc="smallfiles" data-variant="danger">
          <i class="bi bi-files"></i> Tempête Petits Fichiers
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

      <div class="bd-zone" data-state="${sc.nnState}">
        <div class="bd-zone-header">
          <span class="bd-zone-title"><i class="bi bi-cpu"></i> Plan de Contrôle : NameNode (Métadonnées en RAM)</span>
          <span class="bd-pill" data-state="${sc.nnState === "ok" ? "ok" : sc.nnState}">${sc.nnBadge}</span>
        </div>
        <div class="d-flex flex-wrap justify-content-between gap-2 small">
          <span><strong> État :</strong> ${sc.nnMode}</span>
          <span class="bd-pill" data-state="info"><i class="bi bi-journal-check"></i> Secondary / Standby : ${sc.secBadge}</span>
        </div>
      </div>

      <div class="bd-topology">
        <div class="bd-zone" data-state="${sc.rack1State}">
          <div class="bd-zone-header">
            <span class="bd-zone-title"><i class="bi bi-hdd-rack"></i> Baie Serveurs — Rack 1 (Switch ToR-1)</span>
            <span class="bd-pill" data-state="${sc.rack1State === "offline" ? "danger" : sc.rack1State}">
              ${sc.rack1State === "offline" ? "ÉLECTRIQUEMENT COUPÉ" : "En ligne"}
            </span>
          </div>
          ${r1Nodes.map((n) => `
            <div class="bd-node" data-state="${n.state}">
              <div class="bd-node-head">
                <span><i class="bi bi-server"></i> ${n.id}</span>
                <span class="bd-pill" data-state="${n.state === "dead" ? "danger" : n.state}">Heartbeat : ${n.hb}</span>
              </div>
              <div class="bd-blocks">
                ${n.blocks.map((b) => `<span class="bd-block" data-state="${b.s}">${b.b}</span>`).join("")}
              </div>
            </div>
          `).join("")}
        </div>

        <div class="bd-zone" data-state="${sc.rack2State}">
          <div class="bd-zone-header">
            <span class="bd-zone-title"><i class="bi bi-hdd-rack"></i> Baie Serveurs — Rack 2 (Switch ToR-2)</span>
            <span class="bd-pill" data-state="${sc.rack2State}">En ligne</span>
          </div>
          ${r2Nodes.map((n) => `
            <div class="bd-node" data-state="${n.state}">
              <div class="bd-node-head">
                <span><i class="bi bi-server"></i> ${n.id}</span>
                <span class="bd-pill" data-state="${n.state}">${n.hb}</span>
              </div>
              <div class="bd-blocks">
                ${n.blocks.map((b) => `<span class="bd-block" data-state="${b.s}">${b.b}</span>`).join("")}
              </div>
            </div>
          `).join("")}
        </div>
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
// 3. SIMULATEUR HADOOP 1.x vs YARN, LOCALITÉ & STRAGGLERS (mapreduce.qmd)
// ==========================================================================

export function createYarnLocalitySimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const scenarios = {
    h1_bubbles: {
      masterTitle: "Hadoop 1.x — JobTracker Monolithique",
      masterState: "warn",
      masterBadge: "Goulot : Typed Slots Rigides",
      cpuFill: 34,
      cpuLabel: "3,2 / 10 cœurs actifs (Yahoo! av. YARN)",
      metrics: [
        { l: "Architecture", v: "Hadoop 1.x", sub: "Map slots ≠ Reduce slots", s: "warn" },
        { l: "Utilisation CPU", v: "32 %", sub: "Bulles d'inactivité (Pipeline Bubbles)", s: "warn" },
        { l: "File d'Attente", v: "14 Tâches Reduce", sub: "Bloquées malgré 8 Map slots vides !", s: "danger" },
        { l: "Diversité Moteurs", v: "MapReduce seul", sub: "Impossible d'héberger Spark/Storm", s: "warn" }
      ],
      nodes: [
        { name: "TaskTracker 1 (Rack A)", state: "warn", slots: [{ t: "Map Slot (VIDE)", s: "idle" }, { t: "Map Slot (VIDE)", s: "idle" }, { t: "Reduce Slot (100%)", s: "primary" }] },
        { name: "TaskTracker 2 (Rack A)", state: "warn", slots: [{ t: "Map Slot (VIDE)", s: "idle" }, { t: "Map Slot (VIDE)", s: "idle" }, { t: "Reduce Slot (100%)", s: "primary" }] },
        { name: "TaskTracker 3 (Rack B)", state: "warn", slots: [{ t: "Map Slot (VIDE)", s: "idle" }, { t: "Map Slot (VIDE)", s: "idle" }, { t: "Reduce Slot (100%)", s: "primary" }] }
      ],
      logs: [
        { s: "warn", t: "[PHASE REDUCE] La phase Map est terminée, mais les 6 Map Slots ont interdiction formelle d'exécuter une tâche Reduce !" },
        { s: "danger", t: "[GASPILLAGE] 66 % de la capacité du cluster dort pendant que les Reducers saturent en file d'attente." }
      ]
    },
    h1_spof: {
      masterTitle: "Hadoop 1.x — CRASH DU JOBTRACKER (SPOF) !",
      masterState: "danger",
      masterBadge: "ÉTAT MÉMOIRE DÉTRUIT",
      cpuFill: 0,
      cpuLabel: "0 cœur utile — Cluster intégralement paralysé",
      metrics: [
        { l: "Défaillance", v: "Crash JobTracker", sub: "Point Unique de Défaillance (SPOF)", s: "danger" },
        { l: "Jobs en Cours", v: "100 % Perdus", sub: "État d'avancement en RAM volatilisé", s: "danger" },
        { l: "Reprise", v: "Manuelle", sub: "Relance intégrale par les équipes", s: "danger" },
        { l: "Limite d'Échelle", v: "~4 000 Nœuds max", sub: "Au-delà, le JobTracker s'effondre", s: "warn" }
      ],
      nodes: [
        { name: "TaskTracker 1 (Orphelin)", state: "dead", slots: [{ t: "Tâche avortée", s: "danger" }, { t: "Tâche avortée", s: "danger" }] },
        { name: "TaskTracker 2 (Orphelin)", state: "dead", slots: [{ t: "Tâche avortée", s: "danger" }, { t: "Tâche avortée", s: "danger" }] },
        { name: "TaskTracker 3 (Orphelin)", state: "dead", slots: [{ t: "Tâche avortée", s: "danger" }, { t: "Tâche avortée", s: "danger" }] }
      ],
      logs: [
        { s: "danger", t: "[FATAL] OutOfMemoryError dans le processus JobTracker central !" },
        { s: "danger", t: "[SPOF] Comme le JobTracker portait à la fois l'allocation matérielle ET le suivi de chaque sous-tâche, 100 % des jobs en cours sur la grille sont détruits." }
      ]
    },
    yarn_nominal: {
      masterTitle: "YARN (Hadoop 2.x) — ResourceManager Agnostique",
      masterState: "ok",
      masterBadge: "Conteneurs Fongibles + Late Binding",
      cpuFill: 82,
      cpuLabel: "6 à 10 cœurs actifs (+1 000 machines équivalentes chez Yahoo!)",
      metrics: [
        { l: "Conteneurs", v: "<RAM, CPU> Fongibles", sub: "Zéro bulle Map/Reduce", s: "ok" },
        { l: "Localité Obtenue", v: "Node & Rack-Local", sub: "Via ResourceRequest + Late Binding", s: "ok" },
        { l: "Multi-Ténabilité", v: "MR + Spark + Flink", sub: "1 ApplicationMaster dédié par job", s: "info" },
        { l: "Gain Deep Locality", v: "+34 % Débit", sub: "Co-optimisation Map + Shuffle (Lee 2019)", s: "ok" }
      ],
      nodes: [
        { name: "NodeManager 1 (Rack A)", state: "ok", slots: [{ t: "AM #1 (Spark)", s: "violet" }, { t: "Task [Node-Local : 0 réseau]", s: "ok" }, { t: "Task [Node-Local : 0 réseau]", s: "ok" }] },
        { name: "NodeManager 2 (Rack A)", state: "ok", slots: [{ t: "AM #2 (MapReduce)", s: "violet" }, { t: "Task [Rack-Local : Switch ToR]", s: "primary" }, { t: "Reduce Container <4Go, 2CPU>", s: "ok" }] },
        { name: "NodeManager 3 (Rack B)", state: "ok", slots: [{ t: "Spark Executor <8Go, 4CPU>", s: "ok" }, { t: "Flink Stream Container", s: "primary" }] }
      ],
      logs: [
        { s: "ok", t: "[YARN] Le ResourceManager octroie des baux abstraits <RAM, CPU> ; chaque ApplicationMaster y associe tardivement (late binding) la tâche la plus locale." },
        { s: "info", t: "[LOCALITÉ] Priorité 1 : Node-local (disque local) -> Priorité 2 : Rack-local (switch de baie) -> Dernier recours : Off-switch." }
      ]
    },
    yarn_am_crash: {
      masterTitle: "YARN — Crash Isolé d'un ApplicationMaster",
      masterState: "ok",
      masterBadge: "ResourceManager Intact · Redémarrage Ciblé AM #2",
      cpuFill: 76,
      cpuLabel: "Les autres jobs (Spark, Flink) tournent à 100 % sans coupure",
      metrics: [
        { l: "Incident", v: "Crash AM #2", sub: "Un seul job affecté sur le cluster", s: "warn" },
        { l: "Impact Cluster", v: "0 % sur Job #1 & #3", sub: "Isolation applicative totale", s: "ok" },
        { l: "Récupération", v: "Auto-Restart AM #2", sub: "Relancé dans un nouveau conteneur", s: "info" },
        { l: "Tâches Déjà Finies", v: "Préservées", sub: "Reprise incrémentale de l'état", s: "ok" }
      ],
      nodes: [
        { name: "NodeManager 1 (Rack A)", state: "ok", slots: [{ t: "AM #1 (Spark — Intact)", s: "ok" }, { t: "Spark Executor (Continue)", s: "ok" }] },
        { name: "NodeManager 2 (Rack A)", state: "warn", slots: [{ t: "AM #2 (CRASHÉ !)", s: "danger" }, { t: "Conteneur libéré", s: "idle" }] },
        { name: "NodeManager 3 (Rack B)", state: "ok", slots: [{ t: "AM #2-bis (Redémarré par RM !)", s: "healing" }, { t: "Flink Stream (Intact)", s: "ok" }] }
      ],
      logs: [
        { s: "warn", t: "[INCIDENT] Le conteneur de l'ApplicationMaster #2 sur NodeManager 2 s'est arrêté brutalement." },
        { s: "ok", t: "[ISOLATION YARN] Le ResourceManager instancie immédiatement AM #2-bis sur NodeManager 3 ; les jobs Spark et Flink concurrents ne subissent aucune interruption !" }
      ]
    },
    straggler: {
      masterTitle: "YARN / MRAppMaster — Nœud Lent (Straggler) & Exécution Spéculative",
      masterState: "ok",
      masterBadge: "Course Spéculative + Isolation _temporary/_taskid",
      cpuFill: 80,
      cpuLabel: "Protection contre les latences de queue (Tail Latency)",
      metrics: [
        { l: "Anomalie", v: "Disque Lent NM2", sub: "Bridage thermique / secteur lent", s: "warn" },
        { l: "Parade", v: "Tâche Spéculative", sub: "Clone lancé en parallèle sur NM3", s: "info" },
        { l: "Sécurité d'Écriture", v: "_temporary/_taskid", sub: "Idempotence : zéro doublon final", s: "ok" },
        { l: "Gain Temps Total", v: "-68 % d'attente", sub: "NM3 gagne la course et valide", s: "ok" }
      ],
      nodes: [
        { name: "NodeManager 1 (Rack A)", state: "ok", slots: [{ t: "Task_01 : Terminée (100%)", s: "ok" }, { t: "MRAppMaster (Surveille)", s: "violet" }] },
        { name: "NodeManager 2 (Straggler lent !)", state: "warn", slots: [{ t: "Task_02_attempt_0 (Ralentie : 31%) -> Tuée", s: "warn" }] },
        { name: "NodeManager 3 (Secours rapide)", state: "ok", slots: [{ t: "Task_02_attempt_1 [Spéculative : 100% GAGNANTE]", s: "healing" }] }
      ],
      logs: [
        { s: "warn", t: "[STRAGGLER] MRAppMaster détecte que Task_02_attempt_0 sur NM2 progresse 4× moins vite que la moyenne du stage." },
        { s: "info", t: "[SPECULATIVE EXEC] Sans tuer NM2 tout de suite, MRAppMaster lance un clone Task_02_attempt_1 sur NM3 écrivant dans _temporary/_attempt_1." },
        { s: "ok", t: "[COMMIT ATOMIQUE] attempt_1 termine en premier : son dossier _temporary est promu dans le répertoire final et attempt_0 est proprement annulée !" }
      ]
    }
  };

  let current = "yarn_nominal";
  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function render() {
    const sc = scenarios[current];

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Comparer & Tester les pannes :</span>
        <button type="button" class="bd-btn ${current === "h1_bubbles" ? "is-active" : ""}" data-sc="h1_bubbles" data-variant="warning">
          <i class="bi bi-hourglass-split"></i> Hadoop 1.x : Bulles Slots
        </button>
        <button type="button" class="bd-btn ${current === "h1_spof" ? "is-active" : ""}" data-sc="h1_spof" data-variant="danger">
          <i class="bi bi-x-octagon"></i> Hadoop 1.x : Crash SPOF
        </button>
        <button type="button" class="bd-btn ${current === "yarn_nominal" ? "is-active" : ""}" data-sc="yarn_nominal" data-variant="success">
          <i class="bi bi-boxes"></i> YARN : Fongible & Localité
        </button>
        <button type="button" class="bd-btn ${current === "yarn_am_crash" ? "is-active" : ""}" data-sc="yarn_am_crash" data-variant="warning">
          <i class="bi bi-arrow-clockwise"></i> YARN : Crash AM Isolé
        </button>
        <button type="button" class="bd-btn ${current === "straggler" ? "is-active" : ""}" data-sc="straggler" data-variant="success">
          <i class="bi bi-lightning"></i> Straggler & Spéculatif
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

      <div class="bd-zone" data-state="${sc.masterState}">
        <div class="bd-zone-header">
          <span class="bd-zone-title"><i class="bi bi-diagram-2"></i> ${sc.masterTitle}</span>
          <span class="bd-pill" data-state="${sc.masterState}">${sc.masterBadge}</span>
        </div>
        <div class="small mb-1 d-flex justify-content-between">
          <span>Rendement CPU effectif du cluster :</span>
          <strong>${sc.cpuLabel}</strong>
        </div>
        <div class="bd-bar-track">
          <div class="bd-bar-fill" data-state="${sc.masterState}" data-fill="${sc.cpuFill}"></div>
        </div>
      </div>

      <div class="bd-topology-3">
        ${sc.nodes.map((n) => `
          <div class="bd-zone" data-state="${n.state === "dead" ? "offline" : n.state}">
            <div class="bd-zone-header">
              <span class="bd-zone-title"><i class="bi bi-pc-horizontal"></i> ${n.name}</span>
            </div>
            <div class="bd-blocks">
              ${n.slots.map((sl) => `<span class="bd-block" data-state="${sl.s}">${sl.t}</span>`).join("")}
            </div>
          </div>
        `).join("")}
      </div>

      <div class="bd-console">
        ${sc.logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">&gt; ${l.t}</div>`).join("")}
      </div>
    `;

    applyFillBars(root);

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
// 4. SIMULATEUR SPARK : LIGNÉE RDD, CHECKPOINT, OOM & SKEW (spark.qmd)
// ==========================================================================

export function createSparkLineageSimulator(container) {
  const target = resolveTarget(container);
  if (!target) return null;
  target.innerHTML = "";

  const state = {
    scenario: "worker_crash",
    mitigationEnabled: false
  };

  const root = document.createElement("div");
  root.className = "bd-sim";
  target.appendChild(root);

  function buildView() {
    const m = state.mitigationEnabled;

    if (state.scenario === "worker_crash") {
      return {
        toggleLabel: m ? "RDD intermédiaire mis en .cache() sur RAM" : "Activer .cache() sur le RDD intermédiaire",
        metrics: [
          { l: "Panne Injectée", v: "Crash Executor 2", sub: "Perte Partition P1 en RAM", s: "danger" },
          { l: "Taille Lignée DAG", v: "2,4 Ko (Recette)", sub: "Contre 120 Go si journal WAL", s: "ok" },
          { l: "Partitions Recalculées", v: "1 sur 3 (P1 seule)", sub: "P0 et P2 restent intactes !", s: "ok" },
          { l: "Temps de Reprise", v: m ? "0,9 s (Lignée conservée)" : "1,1 s (Pipelining RAM)", sub: "Déterministe & Immuable", s: "info" }
        ],
        stages: [
          {
            title: "Driver JVM & Planificateur DAG",
            state: "ok",
            badge: "Lignée Intacte",
            items: [
              { t: "Recette : Parquet -> filter() -> map()", s: "primary" },
              { t: "Graine aléatoire (seed=42) figée", s: "info" }
            ]
          },
          {
            title: "Stage 1 — Narrow (Pipelining Tungsten)",
            state: "warn",
            badge: "Executor 2 tombé -> Rejoué sur Exec 3",
            items: [
              { t: "Exec 1 : P0 [Intacte en RAM]", s: "ok" },
              { t: "Exec 2 : P1 [RAM PERDUE !]", s: "danger" },
              { t: "Exec 3 : P2 + Recalcul ciblé de P1", s: "healing" }
            ]
          },
          {
            title: "Stage 2 — Wide (Shuffle reduceByKey)",
            state: "ok",
            badge: "Combiner Associatif & Commutatif",
            items: [
              { t: "Map-side combine local", s: "ok" },
              { t: "Agrégation finale exacte (100 %)", s: "ok" }
            ]
          }
        ],
        logs: [
          { s: "danger", t: "[EXECUTOR LOST] Le serveur hébergeant l'Executor 2 s'est éteint : la partition P1 (et son éventuel cache RAM) disparaît." },
          { s: "info", t: "[DATA LINEAGE] Comme le caching ne détruit jamais la lignée, le DAG Scheduler relit la recette de P1 uniquement." },
          { s: "ok", t: "[RECOVERY] L'Executor 3 recalcule P1 depuis le bloc source immuable en pipelining mémoire : P0 et P2 n'ont pas bougé !" }
        ]
      };
    }

    if (state.scenario === "deep_iter") {
      return {
        toggleLabel: m ? "Checkpoint HDFS Activé (Lignée coupée à l'itér. 490)" : "Activer .checkpoint() distribué sur HDFS/S3",
        metrics: [
          { l: "Scénario", v: "Crash à l'Itér. 500", sub: "Algorithme ML / PageRank", s: "warn" },
          { l: "Lignée à Rejouer", v: m ? "10 étapes seules !" : "500 étapes complètes !", sub: m ? "Tranchée au Checkpoint 490" : "Explosion du graphe DAG", s: m ? "ok" : "danger" },
          { l: "Support Sauvegarde", v: m ? "HDFS Répliqué (R=3)" : "RAM Volatile seule", sub: m ? "Survit à l'arrêt du serveur" : "Disque local insuffisant si crash", s: m ? "ok" : "warn" },
          { l: "Durée Récupération", v: m ? "4 secondes" : "38 minutes !", sub: m ? "Reprise quasi instantanée" : "Tempête de recalcul en chaîne", s: m ? "ok" : "danger" }
        ],
        stages: [
          {
            title: "Amont (Itérations 1 → 490)",
            state: m ? "pruned" : "danger",
            badge: m ? "Lignée Tranchée & Purgée" : "Relecture forcée depuis zéro !",
            items: m
              ? [{ t: "Graphe parent supprimé de la RAM", s: "pruned" }, { t: "Checkpoint HDFS (R=3) = Nouvelle Source", s: "ok" }]
              : [{ t: "Re-calcul Itér. 1..250...", s: "danger" }, { t: "Re-calcul Itér. 251..490...", s: "danger" }]
          },
          {
            title: "Point de Contrôle (Itération 490)",
            state: m ? "ok" : "warn",
            badge: m ? "HDFS / S3 Tolérant aux Pannes" : "Aucun Checkpoint Distribué",
            items: m
              ? [{ t: "Lecture directe des blocs répliqués", s: "healing" }]
              : [{ t: "Un checkpoint sur disque local aurait péri avec le nœud !", s: "warn" }]
          },
          {
            title: "Aval (Itérations 491 → 500)",
            state: m ? "ok" : "danger",
            badge: m ? "10 étapes rejouées" : "Bloqué en attente de l'amont",
            items: [
              { t: m ? "Itér. 491..500 recalculées en 4 s" : "Cluster saturé par la lignée géante", s: m ? "ok" : "danger" }
            ]
          }
        ],
        logs: m
          ? [
              { s: "ok", t: "[CHECKPOINT DISTRIBUÉ] À l'itération 490, Spark a matérialisé le RDD sur HDFS (3 répliques) et tranché la lignée parente." },
              { s: "ok", t: "[REPRISE ÉCLAIR] Lors du crash à l'itération 500, l'exécuteur de secours repart directement de l'itération 490 en 4 secondes !" }
            ]
          : [
              { s: "danger", t: "[PIÈGE ITÉRATIF] Crash d'un nœud à l'itération 500 sans Checkpoint : Spark doit remonter les 500 transformations et Shuffles depuis l'origine !" },
              { s: "info", t: "[ACTION] Cliquez sur le bouton « Activer .checkpoint() distribué » ci-dessus pour trancher la lignée sur HDFS." }
            ]
      };
    }

    if (state.scenario === "driver_oom") {
      return {
        toggleLabel: m ? "Refactoring actif : df.filter() distribué + take(10)" : "Corriger l'anti-pattern (.filter() sur Workers)",
        metrics: [
          { l: "Opération", v: m ? "df.filter() + write" : "df.toPandas() / collect()", sub: "Table de 80 Go (500M lignes)", s: m ? "ok" : "danger" },
          { l: "Mémoire Driver (8 Go)", v: m ? "420 Mo (5 %)" : "SATURÉE > 8 Go !", sub: m ? "Orchestration légère" : "java.lang.OutOfMemoryError", s: m ? "ok" : "danger" },
          { l: "Travail des Workers", v: m ? "100 % Parallèle" : "Rapatriement réseau massif", sub: m ? "Tungsten off-heap actif" : "Goulot réseau vers 1 nœud", s: m ? "ok" : "danger" },
          { l: "Statut du Job", v: m ? "Succès (6,2 s)" : "CRASH DRIVER", sub: m ? "Zéro engorgement" : "Arrêt brutal de l'application", s: m ? "ok" : "danger" }
        ],
        stages: [
          {
            title: "Nœud Driver Unique (8 Go RAM)",
            state: m ? "ok" : "danger",
            badge: m ? "Sain (Métadonnées seules)" : "CRASH OutOfMemoryError !",
            items: m
              ? [{ t: "Plan Catalyst optimisé", s: "ok" }, { t: "Échantillon take(10) : 4 Ko", s: "info" }]
              : [{ t: "Réception de 80 Go de partitions...", s: "danger" }, { t: "JVM Heap Space Exhausted !", s: "danger" }]
          },
          {
            title: "Cluster Workers (Exécuteurs 1..4)",
            state: "ok",
            badge: m ? "Filtrage Distribué en RAM" : "Envoi massif vers le Driver",
            items: m
              ? [{ t: "Exec 1..4 : filter(amount > 1000)", s: "ok" }, { t: "Écriture Parquet parallèle", s: "ok" }]
              : [{ t: "Sérialisation et expédition totale au Driver", s: "warn" }]
          }
        ],
        logs: m
          ? [
              { s: "ok", t: "[REFACTORING] Le filtrage s'exécute intégralement sur les Workers ; seul un aperçu borné (.take(10)) revient au Driver." }
            ]
          : [
              { s: "danger", t: "[ANTI-PATTERN #2] df.collect() / df.toPandas() rapatrie les 80 Go distribués dans la RAM de l'unique Driver -> Crash immédiat !" },
              { s: "info", t: "[ACTION] Cliquez sur « Corriger l'anti-pattern » pour maintenir le calcul sur les Workers." }
            ]
      };
    }

    // Data Skew + UDF scenario
    return {
      toggleLabel: m ? "AQE Skew Join / Salting + Expressions JVM Actifs" : "Activer AQE Skew Join / Salting & Natif JVM",
      metrics: [
        { l: "Symptôme Spark UI", v: m ? "200 / 200 Tâches OK" : "Bloqué à 199 / 200 (99 %)", sub: m ? "Charge équilibrée" : "Clé NULL/défaut géante sur 1 tâche", s: m ? "ok" : "danger" },
        { l: "Moteur d'Exécution", v: m ? "100 % JVM + Tungsten" : "Aller-retour UDF Python", sub: m ? "Catalyst + SIMD actifs" : "Double sérialisation Py4J/Pickle", s: m ? "ok" : "warn" },
        { l: "Débordement Disque", v: m ? "0 Mo Spill" : "42 Go Disk Spill !", sub: m ? "Tient en mémoire off-heap" : "Executor 1 saturé par le Skew", s: m ? "ok" : "danger" },
        { l: "Temps d'Exécution", v: m ? "18 secondes" : "47 minutes", sub: m ? "Accélération ×156" : "3 exécuteurs oisifs attendent Exec 1", s: m ? "ok" : "danger" }
      ],
      stages: [
        {
          title: "Executor 1 (Clé chaude customer_id = NULL/0)",
          state: m ? "ok" : "danger",
          badge: m ? "Sous-partition découpée (Salting 0..3)" : "SURCHARGÉ (95 % des lignes !)",
          items: m
            ? [{ t: "Clé salée _0 (25 % de la charge)", s: "ok" }, { t: "Expression native when().otherwise()", s: "ok" }]
            : [{ t: "1 tâche géante bloquée à 99 %", s: "danger" }, { t: "Sérialisation ligne à ligne vers Python UDF", s: "warn" }]
        },
        {
          title: "Executors 2, 3 & 4",
          state: m ? "ok" : "warn",
          badge: m ? "Coopération Active (Clés _1, _2, _3)" : "OISIFS (Attendent Executor 1)",
          items: m
            ? [{ t: "Exec 2 : Clé salée _1 (25 %)", s: "ok" }, { t: "Exec 3 : Clé salée _2 (25 %)", s: "ok" }, { t: "Exec 4 : Clé salée _3 (25 %)", s: "ok" }]
            : [{ t: "Terminés en 2 s -> 45 min d'inactivité totale", s: "idle" }]
        }
      ],
      logs: m
        ? [
            { s: "ok", t: "[AQE / SALTING] Adaptive Query Execution (ou le Salting manuel 0..3) découpe la partition géante entre les 4 exécuteurs." },
            { s: "ok", t: "[TUNGSTEN] Le remplacement de l'UDF Python par when/otherwise élimine toute sérialisation hors JVM." }
          ]
        : [
            { s: "danger", t: "[DATA SKEW] Lors du Shuffle Join, 95 % des enregistrements tombent sur le même hash de clé : 199 tâches finissent en 2 s, la 200e patine pendant 47 min !" },
            { s: "warn", t: "[UDF PYTHON] Pire : l'UDF Python force la JVM à sérialiser chaque ligne vers un processus Python externe, aveuglant Catalyst." }
          ]
    };
  }

  function render() {
    const view = buildView();

    root.innerHTML = `
      <div class="bd-toolbar">
        <span class="bd-toolbar-label">Scénario Spark :</span>
        <button type="button" class="bd-btn ${state.scenario === "worker_crash" ? "is-active" : ""}" data-sc="worker_crash" data-variant="danger">
          <i class="bi bi-hdd-network"></i> Crash Worker (Lignée)
        </button>
        <button type="button" class="bd-btn ${state.scenario === "deep_iter" ? "is-active" : ""}" data-sc="deep_iter" data-variant="warning">
          <i class="bi bi-infinity"></i> Crash Itération 500
        </button>
        <button type="button" class="bd-btn ${state.scenario === "driver_oom" ? "is-active" : ""}" data-sc="driver_oom" data-variant="danger">
          <i class="bi bi-memory"></i> Crash .collect() OOM
        </button>
        <button type="button" class="bd-btn ${state.scenario === "skew_udf" ? "is-active" : ""}" data-sc="skew_udf" data-variant="warning">
          <i class="bi bi-bar-chart-steps"></i> Data Skew 99% & UDF
        </button>
        <button type="button" class="bd-btn ${state.mitigationEnabled ? "is-active" : ""}" data-action="mitigate" data-variant="success">
          <i class="bi bi-wrench-adjustable-circle"></i> ${view.toggleLabel}
        </button>
      </div>

      <div class="bd-metrics">
        ${view.metrics.map((m) => `
          <div class="bd-metric" data-state="${m.s}">
            <div class="bd-metric-label">${m.l}</div>
            <div class="bd-metric-val">${m.v}</div>
            <div class="bd-metric-sub">${m.sub}</div>
          </div>
        `).join("")}
      </div>

      <div class="bd-topology-3">
        ${view.stages.map((st) => `
          <div class="bd-zone" data-state="${st.state === "pruned" ? "info" : st.state}">
            <div class="bd-zone-header">
              <span class="bd-zone-title">${st.title}</span>
              <span class="bd-pill" data-state="${st.state === "pruned" ? "info" : st.state}">${st.badge}</span>
            </div>
            <div class="bd-blocks">
              ${st.items.map((it) => `<span class="bd-block" data-state="${it.s}">${it.t}</span>`).join("")}
            </div>
          </div>
        `).join("")}
      </div>

      <div class="bd-console">
        ${view.logs.map((l) => `<div class="bd-console-line" data-state="${l.s}">&gt; ${l.t}</div>`).join("")}
      </div>
    `;

    root.querySelectorAll("[data-sc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.scenario = btn.dataset.sc;
        state.mitigationEnabled = false;
        render();
      });
    });

    const mitBtn = root.querySelector('[data-action="mitigate"]');
    if (mitBtn) {
      mitBtn.addEventListener("click", () => {
        state.mitigationEnabled = !state.mitigationEnabled;
        render();
      });
    }
  }

  render();
  return root;
}
