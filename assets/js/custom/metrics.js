// =====================================================================
// metrics.js — Generic metric cards
// =====================================================================

function createMetricCard({ label, value, valueClass = "text-body", subtitle = "" }) {
  const card = document.createElement("div");
  card.className = "card p-3 flex-fill text-center shadow-none border";

  const labelEl = document.createElement("div");
  labelEl.className = "text-muted small text-uppercase fw-bold mb-1";
  labelEl.textContent = label;

  const valueEl = document.createElement("div");
  valueEl.className = `fw-bold font-monospace fs-5 ${valueClass}`;
  valueEl.textContent = value;

  card.append(labelEl, valueEl);

  if (subtitle) {
    const subtitleEl = document.createElement("div");
    subtitleEl.className = "text-muted small mt-1";
    subtitleEl.textContent = subtitle;
    card.appendChild(subtitleEl);
  }

  return card;
}

function resolveTarget(target) {
  return typeof target === "string" ? document.querySelector(target) : target;
}

function syncMetricSlot(slot, { value, valueClass = "" }) {
  slot.textContent = value;
  Array.from(slot.classList)
    .filter(className => className.startsWith("text-"))
    .forEach(className => slot.classList.remove(className));
  if (valueClass) {
    slot.classList.add(valueClass);
  }
}

export function createMetricsCards(metrics = []) {
  const row = document.createElement("div");
  row.className = "d-flex flex-column flex-sm-row gap-3 mb-3";
  metrics.forEach(metric => row.appendChild(createMetricCard(metric)));
  return row;
}

export function updateMetricsCards(target, metrics = []) {
  const host = resolveTarget(target);
  if (!host) return null;

  const slots = metrics
    .map(metric => [metric, host.querySelector(`[data-metric="${metric.id}"]`)])
    .filter(([, slot]) => slot);

  if (slots.length === metrics.length) {
    slots.forEach(([metric, slot]) => syncMetricSlot(slot, metric));
    return host;
  }

  host.textContent = "";
  host.appendChild(createMetricsCards(metrics));
  return host;
}
