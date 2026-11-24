import { t as tr, localized } from "./i18n.js";
import { ico, iconNames } from './icons.js';
import { levels, taskColor, urgencyBadge, urgencyOf } from './urgency.js';

let C;
export function init(ctx) { C = ctx }

const examples = localized(() => ({
  crit: tr("s1149"),
  high: tr("s1150"),
  reply: tr("s1151"),
  norm: tr("s1152"),
  done: tr("s1153"),
}));

function urgencyView() {
  // Use the bundled demo snapshot date so all statuses stay available for comparison.
  const demoDate = new Date(2026, 10, 23);
  const tasks = C.tasks().filter(task => /^demo-[1-7]$/.test(task.id));
  return `<header><h1>${tr("s1154")}</h1><p class="sub">${tr("s1155")}</p></header>
  <section class="card"><h2>${tr("s1156")}</h2><div class="list mt">${Object.entries(levels).map(([key, [label]], i) => {
    const task = tasks.find(row => urgencyOf(row, demoDate) === key);
    const color = taskColor(task?.color) || String(i + 1);
    return `<div class="t urgency-demo-row" data-urgency="${key}">${urgencyBadge(key)}<div class="tb">
      <b><span class="task-dot" data-task-color="${color}" aria-hidden="true"></span>${C.esc(task?.title || examples[key])}</b>
      <span class="note">${label}</span></div></div>`;
  }).join('')}</div></section>`;
}

function iconView() {
  return `<header><h1>${tr("s1157")}</h1><p class="sub">${tr("s1158", {0: (iconNames.length)})}</p></header>
  <div class="icon-grid">${iconNames.map(name => `<figure class="stat">${ico(name, { size: 28 })}<figcaption>${name}</figcaption></figure>`).join('')}</div>`;
}

function biolabView() {
  const marks = [24, 48, 96].map(size => `<figure>
    <img src="icons/biolab-mark.svg" width="${size}" height="${size}" alt="${tr("s1159")}">
    <figcaption>${size} × ${size} px</figcaption></figure>`).join('');
  const backgrounds = [['g1', tr("s1160")], ['g2', tr("s1161")]].map(([theme, label]) => `<figure class="lab-background" data-preview-theme="${theme}">
    <figcaption>${ico('biolab-mark', { size: 24 })} ${label}</figcaption></figure>`).join('');
  return `<header><h1>${tr("s1162")}</h1></header>
    <section class="card"><h2>${tr("s1163")}</h2><div class="lab-mark-samples">${marks}</div></section>
    <section class="card"><h2>${tr("s1164")}</h2><div class="lab-background-samples">${backgrounds}</div></section>`;
}

export const VIEWS = { urgency: urgencyView, icons: iconView, biolab: biolabView };
