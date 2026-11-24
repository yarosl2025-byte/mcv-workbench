import { t as tr, localized } from "./i18n.js";
import { ico } from './icons.js';

export const priorityLevels = ['crit', 'high', 'reply'];
export const levels = localized(() => ({
  crit: [tr("s1205"), 'alert'], high: [tr("s1206"), 'clock'], reply: [tr("s77"), 'reply'],
  norm: [tr("s1207"), 'flag'], done: [tr("s15"), 'check'],
}));
const activeDefect = new Set(['open', 'prog', 'wait']);
const isoDay = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0')].join('-');

export function urgencyOf(item, date = new Date()) {
  if (Object.hasOwn(item, 'ds')) {
    if (item.ds === 'Overdue' || item.ds === 'Due') return 'high';
    return /closed|complete|done/i.test(item.js || '') ? 'done' : 'norm';
  }
  if (Object.hasOwn(item, 'grp') && Object.hasOwn(item, 'prio')) {
    if (!activeDefect.has(item.status)) return ['done', 'hist'].includes(item.status) ? 'done' : 'norm';
    return ['Critical', 'High'].includes(item.prio) ? 'high' : 'norm';
  }
  if (['done', 'dropped'].includes(item.status)) return 'done';
  // Red ("crit") is set only by the user (pri = 'urgent'). Everything automatic tops out at orange ("high").
  if (item.pri === 'urgent') return 'crit';
  if (item.pri === 'medium') return 'high';
  if (item.pri === 'later') return item.reply === true ? 'reply' : 'norm';
  const today = isoDay(date);
  if (Number(item.prio) === 1 || (item.status !== 'inbox' && item.due && item.due < today)) return 'high';
  const soon = isoDay(new Date(date.getFullYear(), date.getMonth(), date.getDate() + 2));
  if (item.due >= today && item.due <= soon) return 'high';
  return item.reply === true ? 'reply' : 'norm';
}

export function urgencyBadge(level) {
  const [label, icon] = levels[level];
  return `<span class="urgency-badge" title="${label}" aria-label="${label}">${ico(icon, { size: 14 })}</span>`;
}

export function urgencyChips(items, selected = '', link = false) {
  const counts = { crit: 0, high: 0, reply: 0 };
  const date = new Date();
  for (const item of items) {
    const level = urgencyOf(item, date);
    if (Object.hasOwn(counts, level)) counts[level]++;
  }
  return `<div class="urgency-chips" role="group" aria-label="${tr("s1154")}">${priorityLevels.map(level => {
    const [label, icon] = levels[level], content = `${ico(icon, { size: 15 })} ${label} <b>${counts[level]}</b>`;
    return link
      ? `<a class="chip urgency-chip" data-urgency="${level}" href="#plan/${level}">${content}</a>`
      : `<button class="chip urgency-chip" id="filter-${level}" data-act="urgency-filter" data-k="${level}" data-urgency="${level}" aria-pressed="${selected === level}">${content}</button>`;
  }).join('')}</div>`;
}

export function taskColor(value) {
  return /^[1-8]$/.test(String(value ?? '')) ? String(value) : '';
}

export function urgencySettings(appearance) {
  const { palettes, urgency } = appearance;
  const colorKeys = [...priorityLevels, 'norm'];
  return `<section class="card"><h2>${tr("s1154")}</h2><div class="palette-options" role="group" aria-label="${tr("s1208")}">
    ${Object.entries(palettes).map(([key, { title, colors }]) => `<button class="palette-option" type="button" id="palette-${key}" data-act="urgency-palette" data-k="${key}" aria-pressed="${key === urgency.palette}"><span>${title}</span><span class="palette-samples" aria-hidden="true">${colorKeys.map((level, i) => `<span style="--u-color:${(colors || urgency.colors)[i]}">${ico(levels[level][1], { size: 15 })}</span>`).join('')}</span></button>`).join('')}
  </div><div class="custom-palette mt"${urgency.palette === 'custom' ? '' : ' hidden'}>
    ${colorKeys.map((level, i) => `<label for="urgency-color-${i}">${levels[level][0]} <input id="urgency-color-${i}" type="color" data-urgency-color="${i}" value="${urgency.colors[i]}"></label>`).join('')}
  </div></section>`;
}
