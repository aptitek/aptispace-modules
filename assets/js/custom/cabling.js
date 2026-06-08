// ==========================================
// cabling.js - Exercice de câblage interactif
// ==========================================

export function createCabling(containerId, leftItems, rightItems, onStateUpdate) {
  return new CablingManager(containerId, leftItems, rightItems, onStateUpdate);
}

class CablingManager {
  constructor(containerId, leftItems, rightItems, onStateUpdate) {
    this.containerId    = containerId;
    this.container      = document.querySelector(containerId);
    this.leftItems      = leftItems;
    this.rightItems     = rightItems;
    this.onStateUpdate  = onStateUpdate;

    this.connections  = {};   // { leftSrcId: rightSrcId }
    this.activeNode   = null; // { el, srcId, group } — pour click-to-connect
    this.validated    = false;
    this.jsp          = null; // jsPlumb instance
    this._connMap     = new Map(); // srcId → jsPlumb Connection object
    this._sparks      = [];   // spark DOM elements for incorrect connections

    if (this.container) {
      this._init();
    }
  }

  // ── Initialisation ────────────────────────────────────────────────────────

  async _init() {
    const { newInstance } = await import("https://esm.sh/@jsplumb/browser-ui@6.2.10");

    // Vider le conteneur (sécurité OJS — re-render)
    this.container.innerHTML = "";

    // Structure de base
    this.container.classList.add("cabling-canvas");

    // ── Colonnes HTML ───────────────────────────────
    const colLeft  = this._makeColumn("left");
    const colMid   = this._makeMidColumn();
    const colRight = this._makeColumn("right");

    this.leftItems.forEach((it) => {
      colLeft.appendChild(this._makePill(it, "left"));
    });
    this.rightItems.forEach((it) => {
      colRight.appendChild(this._makePill(it, "right"));
    });

    this.container.append(colLeft, colMid, colRight);

    // ── Instance jsPlumb ────────────────────────────
    this.jsp = newInstance({
      container: this.container,
      connector: { 
        type: "Bezier", 
        options: { 
          curviness: 80
        } 
      },
      paintStyle: { 
        stroke: "var(--sol-cyan)", 
        strokeWidth: 4,
        outlineStroke: "rgba(var(--sol-base03-rgb), 0.3)",
        outlineWidth: 2
      },
      hoverPaintStyle: { 
        stroke: "var(--sol-yellow)", 
        strokeWidth: 5,
        outlineStroke: "rgba(var(--sol-base03-rgb), 0.4)",
        outlineWidth: 2
      },
      endpoint: "Dot",
      endpointStyle: { fill: "var(--sol-base01)", radius: 6 }
    });

    // ── Endpoints jsPlumb ───────────────────────────
    const SOCKET_STYLE = {
      fill: "var(--cabling-socket-bg)",
      stroke: "var(--sol-base01)",
      strokeWidth: 4,
    };
    const SOCKET_HOVER = {
      fill: "var(--cabling-socket-bg)",
      stroke: "var(--sol-cyan)",
      strokeWidth: 4,
    };

    this.leftItems.forEach((it) => {
      const el = this.container.querySelector(`[data-id="L_${it.id}"]`);
      if (!el) return;
      this.jsp.addEndpoint(el, {
        anchor: [ 1, 0.5, 1, 0.4 ],
        source: true,
        target: false,
        endpoint: { type: "Dot", options: { radius: 14 } },
        paintStyle: SOCKET_STYLE,
        hoverPaintStyle: SOCKET_HOVER,
        maxConnections: 1,
        connectionsDetachable: true,
        cssClass: "cabling-ep-left",
      });
    });

    this.rightItems.forEach((it) => {
      const el = this.container.querySelector(`[data-id="R_${it.id}"]`);
      if (!el) return;
      this.jsp.addEndpoint(el, {
        anchor: [ 0, 0.5, -1, 0.4 ],
        source: false,
        target: true,
        endpoint: { type: "Dot", options: { radius: 14 } },
        paintStyle: SOCKET_STYLE,
        hoverPaintStyle: SOCKET_HOVER,
        maxConnections: 1,
        connectionsDetachable: true,
        cssClass: "cabling-ep-right",
      });
    });

    // ── Événements jsPlumb ──────────────────────────

    // Empêcher les connexions invalides (même groupe)
    this.jsp.bind("beforeDrop", (info) => {
      if (this.validated) return false;
      const srcGroup = info.connection.source.dataset.group;
      const tgtGroup = info.dropEndpoint.element.dataset.group;
      return srcGroup !== tgtGroup;
    });

    // Connexion créée
    this.jsp.bind("connection", ({ source, target, connection }) => {
      const leftEl  = source.dataset.group === "left" ? source : target;
      const rightEl = source.dataset.group === "right" ? source : target;
      const lid = leftEl.dataset.srcId;
      const rid = rightEl.dataset.srcId;
      if (!lid || !rid) return;

      // Supprimer l'ancien câble si existant pour ce connecteur gauche
      const old = this._connMap.get(lid);
      if (old && old !== connection) {
        try { this.jsp.deleteConnection(old); } catch {}
      }
      this.connections[lid] = rid;
      this._connMap.set(lid, connection);

      // Couleur par index de la pill gauche (classe CSS data-color pour ciblage)
      const ci = this.leftItems.findIndex(it => it.id === lid);
      const colors = ["var(--sol-cyan)", "var(--sol-magenta)", "var(--sol-orange)", "var(--sol-violet)", "var(--sol-blue)"];
      const stroke = colors[ci % colors.length];
      connection.setPaintStyle({ 
        stroke, 
        strokeWidth: 4,
        outlineStroke: "rgba(var(--sol-base03-rgb), 0.3)",
        outlineWidth: 2
      });
      connection.setHoverPaintStyle({ 
        stroke: "var(--sol-yellow)", 
        strokeWidth: 5,
        outlineStroke: "rgba(var(--sol-base03-rgb), 0.4)",
        outlineWidth: 2
      });

      this._clearActive();
      this.onStateUpdate(this.getState());
    });

    // Connexion détruite
    this.jsp.bind("connectionDetached", ({ source, target }) => {
      const leftEl = source.dataset.group === "left" ? source : target;
      const lid = leftEl.dataset.srcId;
      if (lid) {
        delete this.connections[lid];
        this._connMap.delete(lid);
      }
      this.onStateUpdate(this.getState());
    });

    // ── Click-to-connect ────────────────────────────
    this.container.addEventListener("click", (e) => {
      if (this.validated) return;
      const pill = e.target.closest(".cabling-pill");
      if (!pill) return;

      const group  = pill.dataset.group;
      const srcId  = pill.dataset.srcId;

      if (!this.activeNode) {
        // Rien de sélectionné → sélectionner cette pill
        this._setActive(pill);
        return;
      }

      if (this.activeNode.srcId === srcId && this.activeNode.group === group) {
        // Même pill cliquée → désélectionner
        this._clearActive();
        return;
      }

      if (this.activeNode.group === group) {
        // Même groupe → déplacer la sélection
        this._setActive(pill);
        return;
      }

      // Groupes opposés → connecter
      const leftEl  = group === "right" ? this.activeNode.el : pill;
      const rightEl = group === "right" ? pill : this.activeNode.el;
      this._connectElements(leftEl, rightEl);
    });

    // ── Resizing ────────────────────────────────────
    this._resizeHandler = () => {
      if (this.jsp) {
        this.jsp.repaintEverything();
      }
    };
    window.addEventListener("resize", this._resizeHandler);
  }

  // ── Helpers DOM ───────────────────────────────────────────────────────────

  _makeColumn(side) {
    const col = document.createElement("div");
    col.className = `cabling-col cabling-col--${side}`;
    return col;
  }

  _makeMidColumn() {
    const mid = document.createElement("div");
    mid.className = "cabling-gap";
    return mid;
  }

  _makePill(item, group) {
    const pill = document.createElement("div");
    pill.className = "cabling-pill";
    pill.dataset.id    = `${group === "left" ? "L" : "R"}_${item.id}`;
    pill.dataset.srcId = item.id;
    pill.dataset.group = group;
    pill.textContent   = item.label;
    return pill;
  }

  // ── Click-to-connect state ────────────────────────────────────────────────

  _setActive(pill) {
    this._clearActive();
    this.activeNode = { el: pill, srcId: pill.dataset.srcId, group: pill.dataset.group };
    pill.classList.add('is-active');
  }

  _clearActive() {
    if (this.activeNode?.el) {
      this.activeNode.el.classList.remove('is-active');
    }
    this.activeNode = null;
  }

  // ── Connexion programmatique ──────────────────────────────────────────────

  _connectElements(leftEl, rightEl) {
    if (!leftEl || !rightEl || !this.jsp) return;

    const lid = leftEl.dataset.srcId;
    const rid = rightEl.dataset.srcId;

    // Supprimer l'ancien câble du côté gauche s'il existe
    const oldLeft = this._connMap.get(lid);
    if (oldLeft) { try { this.jsp.deleteConnection(oldLeft); } catch {} }

    // Supprimer l'ancien câble du côté droit si déjà occupé
    for (const [l, conn] of this._connMap.entries()) {
      if (this.connections[l] === rid && l !== lid) {
        try { this.jsp.deleteConnection(conn); } catch {}
        delete this.connections[l];
        this._connMap.delete(l);
      }
    }

    // Créer la connexion — jsPlumb émettra "connection" qui met à jour l'état
    const leftEps  = this.jsp.getEndpoints(leftEl);
    const rightEps = this.jsp.getEndpoints(rightEl);
    if (leftEps.length && rightEps.length) {
      try {
        this.jsp.connect({ source: leftEps[0], target: rightEps[0] });
      } catch (err) {
        console.warn("jsPlumb connect error:", err);
      }
    }
  }

  // ── Spark particles ────────────────────────────────────────

  _addSparks(pillEl, side) {
    const containerRect = this.container.getBoundingClientRect();
    const pillRect      = pillEl.getBoundingClientRect();
    const x = side === "right"
      ? pillRect.right  - containerRect.left
      : pillRect.left   - containerRect.left;
    const y = pillRect.top + pillRect.height / 2 - containerRect.top;

    const COUNT = 6;
    for (let i = 0; i < COUNT; i++) {
      const spark = document.createElement("span");
      spark.className = "cabling-spark";
      spark.style.setProperty("--spark-x", `${x}px`);
      spark.style.setProperty("--spark-y", `${y}px`);
      spark.style.setProperty("--angle", `${i * (360 / COUNT)}deg`);
      spark.style.setProperty("--spark-delay", `${(i * 0.1) % 0.6}s`);
      this.container.appendChild(spark);
      this._sparks.push(spark);
    }
  }

  // ── API publique ──────────────────────────────────────────────

  validate() {
    if (Object.keys(this.connections).length < this.leftItems.length) {
      return { status: "incomplete", ...this.getState() };
    }

    this.validated = true;

    for (const [lid, conn] of this._connMap.entries()) {
      const rid       = this.connections[lid];
      const item      = this.leftItems.find(it => it.id === lid);
      const isCorrect = item && rid === item.match;
      conn.removeClass("conn-active");
      conn.addClass(isCorrect ? "conn-correct" : "conn-incorrect");

      if (!isCorrect) {
        const leftEl  = this.container.querySelector(`[data-src-id="${lid}"][data-group="left"]`);
        const rightEl = this.container.querySelector(`[data-src-id="${rid}"][data-group="right"]`);
        if (leftEl)  this._addSparks(leftEl,  "right");
        if (rightEl) this._addSparks(rightEl, "left");
      }
    }

    this.jsp.repaintEverything();

    this.container.querySelectorAll(".cabling-pill").forEach(el => {
      el.classList.add('is-validated');
    });

    return { status: "validated", ...this.getState() };
  }

  reset() {
    this.validated  = false;
    this._clearActive();

    if (this.jsp) {
      this._connMap.forEach(c => {
        c.removeClass("conn-correct conn-incorrect");
        try { this.jsp.deleteConnection(c); } catch {}
      });
    }

    this.connections = {};
    this._connMap.clear();

    this._sparks.forEach(s => s.remove());
    this._sparks = [];

    this.container.querySelectorAll(".cabling-pill").forEach(el => {
      el.classList.remove('is-active', 'is-validated');
    });

    return { status: "hidden", ...this.getState() };
  }

  clearValidation() {
    this.validated  = false;
    this._clearActive();

    if (this.jsp) {
      this._connMap.forEach(c => {
        c.removeClass("conn-correct conn-incorrect");
      });
    }

    this._sparks.forEach(s => s.remove());
    this._sparks = [];

    this.container.querySelectorAll(".cabling-pill").forEach(el => {
      el.classList.remove('is-active', 'is-validated');
    });

    return { status: "hidden", ...this.getState() };
  }

  getState() {
    let score = 0;
    this.leftItems.forEach(it => {
      if (this.connections[it.id] === it.match) score++;
    });
    return { score, total: this.leftItems.length, connections: { ...this.connections } };
  }

  destroy() {
    if (this._resizeHandler) {
      window.removeEventListener("resize", this._resizeHandler);
    }
    if (this.jsp) {
      this.jsp.destroy();
      this.jsp = null;
    }
  }
}

