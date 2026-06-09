// datatables.js
// Tableau de données générique : recherche globale, tri par colonne, filtres déroulants, pagination.

function resolveElement(selector) {
  return typeof selector === 'string' ? document.querySelector(selector) : selector;
}

function esc(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadge(val) {
  const states = { Actif: 'success', Bêta: 'warning', Arrêté: 'danger', Déprécié: 'danger' };
  const state = states[val] || 'secondary';
  return `<span class="apt-dt-badge apt-dt-badge--${state}">${esc(val)}</span>`;
}

function freeBadge(val) {
  if (!val) return '';
  const lower = String(val).toLowerCase();
  const state = lower.startsWith('oui') ? 'yes' : lower.startsWith('non') ? 'no' : 'limited';
  return `<span class="apt-dt-pill apt-dt-pill--${state}">${esc(val)}</span>`;
}

function boolBadge(val) {
  if (!val) return '';
  const isYes = String(val).toLowerCase().startsWith('oui');
  return `<span class="apt-dt-badge apt-dt-badge--${isYes ? 'info' : 'secondary'}">${esc(val)}</span>`;
}

function renderCell(col, row) {
  const val = row[col.key] ?? '';
  switch (col.type) {
    case 'link': {
      const href = esc(col.urlKey ? (row[col.urlKey] ?? '') : val);
      if (!href) return esc(val);
      return `<a class="apt-dt-link" href="${href}" target="_blank" rel="noopener noreferrer">${esc(val)} <i class="bi bi-box-arrow-up-right apt-dt-ext-icon" aria-hidden="true"></i></a>`;
    }
    case 'badge':
      return statusBadge(val);
    case 'badge-free':
      return freeBadge(val);
    case 'badge-bool':
      return boolBadge(val);
    case 'tooltip':
      return `<span class="apt-dt-truncate" title="${esc(val)}">${esc(val)}</span>`;
    default:
      return esc(val);
  }
}

/**
 * Crée un tableau de données interactif (recherche, tri, filtres, pagination).
 *
 * @param {string|Element} selectorOrElement - Conteneur cible
 * @param {Array<Object>} data - Tableau de lignes (objets plats)
 * @param {Object} [options]
 * @param {Array}   [options.columns]       - Définitions de colonnes : { key, label, type, urlKey, sortable }
 * @param {boolean} [options.searchable]    - Affiche la barre de recherche (défaut : true)
 * @param {number}  [options.pageSize]      - Lignes par page (0 = tout afficher, défaut : 15)
 * @param {Array}   [options.filterColumns] - Clés de colonnes à filtrer (auto-détecté si omis)
 * @param {boolean} [options.compact]       - Mode compact, réduire le padding
 * @returns {{ update(data: Array), destroy() }}
 */
export function createDataTable(selectorOrElement, data, options = {}) {
  const container = resolveElement(selectorOrElement);
  if (!container) {
    console.warn(`createDataTable: conteneur introuvable pour "${selectorOrElement}"`);
    return null;
  }

  const {
    searchable = true,
    pageSize = 15,
    filterColumns: filterColumnsProp = null,
    columns: columnsProp = null,
    compact = false,
  } = options;

  let rows = Array.isArray(data) ? [...data] : [];
  let sortKey = null;
  let sortDir = 'asc';
  let searchQuery = '';
  let activeFilters = {};
  let page = 1;

  function buildColumns(sampleRows) {
    if (!sampleRows.length) return [];
    return Object.keys(sampleRows[0]).map(key => ({
      key,
      label: key,
      sortable: true,
      type: key === 'URL' ? 'url-hidden' : 'text',
    }));
  }

  let cols = columnsProp
    ? columnsProp.map(c => ({ sortable: true, type: 'text', ...c }))
    : buildColumns(rows);

  function autoFilterCols(sampleRows, allCols) {
    if (filterColumnsProp !== null) return filterColumnsProp;
    return allCols
      .filter(c => !['url-hidden', 'url', 'link', 'tooltip'].includes(c.type))
      .filter(c => {
        const vals = new Set(sampleRows.map(r => r[c.key]).filter(v => v != null && v !== ''));
        return vals.size >= 2 && vals.size <= 12;
      })
      .map(c => c.key);
  }

  let filterCols = autoFilterCols(rows, cols);

  const visibleCols = () => cols.filter(c => c.type !== 'url-hidden');

  function getFiltered() {
    let result = rows;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row =>
        visibleCols().some(col => String(row[col.key] ?? '').toLowerCase().includes(q))
      );
    }

    for (const [key, val] of Object.entries(activeFilters)) {
      if (val !== '') result = result.filter(row => row[key] === val);
    }

    if (sortKey) {
      result = [...result].sort((a, b) => {
        const va = String(a[sortKey] ?? '');
        const vb = String(b[sortKey] ?? '');
        const cmp = va.localeCompare(vb, 'fr', { numeric: true, sensitivity: 'base' });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }

  function render() {
    const filtered = getFiltered();
    const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
    page = Math.min(page, totalPages);
    const pageRows = pageSize > 0 ? filtered.slice((page - 1) * pageSize, page * pageSize) : filtered;
    const vcols = visibleCols();

    container.innerHTML = '';
    container.classList.add('apt-datatable');
    container.classList.toggle('apt-datatable--compact', compact);

    // ── Toolbar ─────────────────────────────────────────────────────────────
    if (searchable || filterCols.length > 0) {
      const toolbar = document.createElement('div');
      toolbar.className = 'apt-dt-toolbar';

      if (searchable) {
        const wrap = document.createElement('div');
        wrap.className = 'apt-dt-search-wrap';
        const icon = document.createElement('i');
        icon.className = 'bi bi-search apt-dt-search-icon';
        icon.setAttribute('aria-hidden', 'true');
        wrap.appendChild(icon);
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'apt-dt-search-input';
        inp.placeholder = 'Rechercher…';
        inp.value = searchQuery;
        inp.setAttribute('aria-label', 'Rechercher dans le tableau');
        inp.addEventListener('input', e => { searchQuery = e.target.value; page = 1; render(); });
        wrap.appendChild(inp);
        toolbar.appendChild(wrap);
      }

      filterCols.forEach(key => {
        const col = cols.find(c => c.key === key);
        if (!col) return;
        const vals = [...new Set(rows.map(r => r[key]).filter(v => v != null && v !== ''))].sort();
        const sel = document.createElement('select');
        sel.className = 'apt-dt-filter';
        sel.setAttribute('aria-label', `Filtrer par ${col.label}`);
        const all = document.createElement('option');
        all.value = '';
        all.textContent = `— ${col.label} —`;
        sel.appendChild(all);
        vals.forEach(v => {
          const opt = document.createElement('option');
          opt.value = v;
          opt.textContent = v;
          if (activeFilters[key] === v) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', e => { activeFilters[key] = e.target.value; page = 1; render(); });
        toolbar.appendChild(sel);
      });

      container.appendChild(toolbar);
    }

    // ── Table ────────────────────────────────────────────────────────────────
    const wrapper = document.createElement('div');
    wrapper.className = 'table-responsive apt-dt-wrapper';

    const table = document.createElement('table');
    table.className = 'table apt-dt-table';

    const thead = document.createElement('thead');
    const htr = document.createElement('tr');
    vcols.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label;
      if (col.sortable !== false) {
        th.classList.add('apt-dt-th-sort');
        if (sortKey === col.key) {
          th.classList.add(sortDir === 'asc' ? 'apt-dt-sort--asc' : 'apt-dt-sort--desc');
        }
        th.addEventListener('click', () => {
          sortDir = sortKey === col.key && sortDir === 'asc' ? 'desc' : 'asc';
          sortKey = col.key;
          render();
        });
      }
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    if (pageRows.length === 0) {
      const etr = document.createElement('tr');
      const etd = document.createElement('td');
      etd.colSpan = vcols.length;
      etd.className = 'apt-dt-empty';
      etd.textContent = 'Aucun résultat trouvé';
      etr.appendChild(etd);
      tbody.appendChild(etr);
    } else {
      pageRows.forEach(row => {
        const tr = document.createElement('tr');
        vcols.forEach(col => {
          const td = document.createElement('td');
          td.innerHTML = renderCell(col, row);
          if (col.type === 'tooltip') td.classList.add('apt-dt-td-clip');
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);
    container.appendChild(wrapper);

    // ── Footer ───────────────────────────────────────────────────────────────
    const footer = document.createElement('div');
    footer.className = 'apt-dt-footer';

    const count = document.createElement('span');
    count.className = 'apt-dt-count';
    const n = filtered.length;
    count.textContent = n === rows.length
      ? `${n} résultat${n > 1 ? 's' : ''}`
      : `${n} / ${rows.length} résultat${n > 1 ? 's' : ''}`;
    footer.appendChild(count);

    if (pageSize > 0 && totalPages > 1) {
      const pager = document.createElement('div');
      pager.className = 'apt-dt-pager';

      const mkBtn = (icon, disabled, onClick) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'apt-dt-pager-btn';
        btn.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;
        btn.disabled = disabled;
        btn.addEventListener('click', onClick);
        return btn;
      };

      pager.appendChild(mkBtn('bi-chevron-double-left', page === 1, () => { page = 1; render(); }));
      pager.appendChild(mkBtn('bi-chevron-left', page === 1, () => { page--; render(); }));

      const info = document.createElement('span');
      info.className = 'apt-dt-pager-info';
      info.textContent = `${page} / ${totalPages}`;
      pager.appendChild(info);

      pager.appendChild(mkBtn('bi-chevron-right', page === totalPages, () => { page++; render(); }));
      pager.appendChild(mkBtn('bi-chevron-double-right', page === totalPages, () => { page = totalPages; render(); }));

      footer.appendChild(pager);
    }

    container.appendChild(footer);
  }

  render();

  return {
    update(newData) {
      rows = Array.isArray(newData) ? [...newData] : [];
      if (!columnsProp) {
        cols = buildColumns(rows);
        filterCols = autoFilterCols(rows, cols);
      }
      page = 1;
      render();
    },
    destroy() {
      container.innerHTML = '';
      container.classList.remove('apt-datatable', 'apt-datatable--compact');
    },
  };
}
