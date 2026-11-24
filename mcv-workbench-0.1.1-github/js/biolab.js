import { t as tr, localized } from "./i18n.js";
import { ico } from './icons.js';

export const isBiolab = (theme = document.documentElement.dataset.theme) => theme === 'g1' || theme === 'g2';

const syncLabels = localized(() => ({ local: tr("s691"), idle: tr("s692"), syncing: tr("s693"), offline: tr("s694"), error: tr("s695") }));
const utc = () => new Date().toISOString().slice(11, 16) + 'Z';

export function terminal(status, overdue) {
  const attention = overdue > 0 || status.state === 'error';
  return `<div class="lab-terminal" aria-label="${tr("s698")}">
    <div class="lab-brand">${ico('biolab-mark', { size: 26 })}<b>MCV · BIOLAB</b></div>
    <div class="lab-status">
      <span class="lab-system" data-attention="${attention}">${tr("s699", {2: (attention ? ico('biohazard', { size: 16 }) : '<span class="lab-led" aria-hidden="true"></span>'), 3: (attention ? tr("s696") : tr("s697"))})}</span>
      <span><span class="lab-led" data-sync="${Object.hasOwn(syncLabels, status.state) ? status.state : 'local'}" aria-hidden="true"></span> ${tr("s700", {5: (syncLabels[status.state] || syncLabels.local)})}</span>
      <time class="lab-clock">${utc()}</time>
    </div>
  </div>`;
}

export function updateClock() {
  const clock = document.querySelector('.lab-clock');
  if (clock) clock.textContent = utc();
}

function codeFor(source) {
  let hash = 0;
  for (const char of source) hash = (Math.imul(hash, 31) + char.codePointAt(0)) >>> 0;
  return 'MCV-' + String(hash % 10000).padStart(4, '0');
}

export function markTiles(root, view) {
  root.querySelectorAll('.card:not(.scroll),.stat,.t,.lg').forEach((tile, index) => {
    const key = tile.dataset.id || tile.dataset.k || tile.id || tile.querySelector('h2,.tt,.lbl,b')?.textContent.trim();
    tile.dataset.labCode = codeFor(key || view + '-' + index);
  });
}
