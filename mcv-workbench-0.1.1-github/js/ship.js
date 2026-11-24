import { t as tr, localized } from "./i18n.js";
import * as db from './store.js';
import { grpOf } from './equip.js';
import { urgencyChips } from './urgency.js';

let C;
export function init(ctx) { C = ctx }

const sections = localized(() => ([
  [tr("s189"), ['me']],
  [tr("s1165"), ['ae', 'tg']],
  [tr("s858"), ['cg', 'dk', 'st']],
  [tr("s1166"), ['el']],
  [tr("s162"), []],
]));
const zones = localized(() => ([
  [tr("s1167"), ['me', 'ae', 'tg']],
  [tr("s1168"), ['el', 'fp', 'hl']],
  [tr("s1169"), ['cg']],
  [tr("s1170"), ['dk', 'st']],
]));
const sync = localized(() => ({
  local: tr("s1171"), idle: tr("s243"), syncing: tr("s244"),
  offline: tr("s627"), error: tr("s628"),
}));

function shipDrawing(counts) {
  const zone = index => counts[index] ? ' class="ship-hot"' : '';
  const bays = Array.from({ length: 6 }, (_, i) => `
    <g transform="translate(${123 + i * 55} ${i % 2 ? 5 : 0})">
      <path d="M0 119l9-8h41l-9 8z" fill="var(--p3)"/>
      <path d="M0 119h41v31H0zM41 119l9-8v31l-9 8z" fill="var(--p1)"${zone(2)}/>
      <path d="M0 129h41l9-8M0 139h41l9-8M13 119v31m14-31v31" class="ship-detail"/>
    </g>
    <text x="${143 + i * 55}" y="169">${i + 1}</text>`).join('');
  return `<svg class="ship-drawing" viewBox="0 0 530 230" role="img" aria-labelledby="ship-drawing-title">
    <title id="ship-drawing-title">${tr("s1172")}</title>
    <defs><pattern id="ship-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0v22" fill="none" stroke="var(--line)"/></pattern></defs>
    <path d="M0 0h530v230H0z" fill="url(#ship-grid)"/>
    <path d="M23 151l29-14h418l44 15-22 26H38z" fill="var(--p3)"/>
    <path d="M23 151l16 22h442l33-21-21 33q-14 16-39 16H68q-29 0-40-24z" fill="var(--p2)"/>
    <path d="M33 182h450M117 174v27m319-27v27" class="ship-detail"/>
    <path d="M38 173h80v28H68q-19 0-30-10z" fill="var(--p1)"${zone(0)}/>
    <path d="M59 191v-9h30v9zm6-9v-5h17v5m-14 0v9m7-9v9m7-9v9m7-4h11v-9" class="ship-detail"/>
    <path d="M458 140l56 12-21 33q-14 16-39 16h-18v-27z" fill="var(--p1)"${zone(3)}/>
    <path d="M466 148v20m-7-9h14M479 179h7m-7 4h4" class="ship-detail"/>
    <path d="M48 106l5-43h19l5 43M53 63l8-5h17l-6 5m6-5 3 43" fill="var(--p2)"/>
    <path d="M55 152V105h16V88h36l13 9v49l-15 6z" fill="var(--p1)"${zone(1)}/>
    <path d="M71 88l11-8h36l13 10-11 7M74 105h40m-48 10h44m-44 12h44m-44 12h44M96 80V56m-10 11h20" class="ship-detail"/>
    ${bays}
    <path d="M72 201v15h43m347-15v15h-43M86 80V37H49" class="ship-detail"/>
    <text x="45" y="32" text-anchor="start">${tr("s1173")}</text>
    <text x="120" y="222" text-anchor="start">${tr("s1174")}</text>
    <text x="413" y="222" text-anchor="end">${tr("s1175")}</text>
  </svg>`;
}

function maintenance(jobs, date) {
  const end = C.add(date, 30);
  const namedGroups = sections.flatMap(([, groups]) => groups);
  return sections.map(([label, groups]) => {
    const list = jobs.filter(j => groups.length ? groups.includes(j.group) : !namedGroups.includes(j.group));
    const count = list.filter(j => j.overdue || (j.due >= date && j.due <= end)).length;
    const share = list.length ? Math.round(100 * count / list.length) : 0;
    return `<div class="ship-meter"><div class="row between"><label for="ship-progress-${groups[0] || 'other'}">${label}</label>
      <span class="note">${list.length ? `${tr("s1176", {0: (count), 1: (list.length), 2: (share)})}` : tr("s1177")}</span></div>
      <progress id="ship-progress-${groups[0] || 'other'}" max="100" value="${share}"></progress></div>`;
  }).join('');
}

function workload(jobs, date) {
  const counts = Array(8).fill(0);
  const end = C.add(date, 56);
  for (const { due } of jobs) {
    if (due >= date && due < end) counts[Math.floor(C.diff(due, date) / 7)]++;
  }
  if (!counts.some(Boolean)) return ("<p class=\"empty\">" + tr("s1178") + "</p>");
  const peak = Math.max(...counts);
  const points = counts.map((count, i) => [24 + i * 42, 82 - count * 62 / peak]);
  const curve = points.slice(1).map(([x, y], i) => {
    const [px, py] = points[i], mid = (px + x) / 2;
    return `C${mid} ${py} ${mid} ${y} ${x} ${y}`;
  }).join(' ');
  const summary = counts.map((n, i) => `${tr("s1179", {0: (i + 1), 1: (n)})}`).join(', ');
  return `<svg class="ship-workload" viewBox="0 0 342 110" role="img" aria-label="${summary}">
    <path d="M24 20h294M24 51h294M24 82h294" class="ship-detail"/>
    <path d="M${points[0].join(' ')} ${curve}" class="ship-trend"/>
    ${points.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3"/><text x="${x}" y="103">${i + 1}</text>`).join('')}
    <text x="11" y="24">${peak}</text><text x="11" y="86">0</text>
  </svg>`;
}

function shipView() {
  const date = C.today();
  const jobs = C.pmsJobs().map(j => ({ group: grpOf(j.eq), overdue: j.ds === 'Overdue', due: j.due || '' }));
  const overdue = jobs.filter(j => j.overdue);
  const counts = zones.map(([, groups]) => overdue.filter(j => groups.includes(j.group)).length);
  const defects = db.all('ts').filter(c => ['open', 'prog', 'wait'].includes(c.status) && ['Critical', 'High'].includes(c.prio));
  const critical = defects.filter(c => c.prio === 'Critical').length;
  const high = defects.length - critical;
  return `<header class="ship-header"><h1>MCV · MAERSK CABO VERDE</h1>
    <span class="ship-status" data-state="${db.status.state}"><span class="dot"></span>${sync[db.status.state] || sync.local}</span>
  </header>
  <nav class="ship-tabs" aria-label="${tr("s1185")}"><a href="#ship" aria-current="page">${tr("s188")}</a>
    <a href="#pms">${tr("s1186")}</a><a href="#equip">${tr("s1006")}</a><a href="#plan">${tr("s1187")}</a></nav>
  <section class="card ship-map"><div class="row between"><h2>${tr("s1188")}</h2><span class="note">${tr("s1189")}</span></div>
    ${shipDrawing(counts)}
    <div class="ship-zones">${zones.map(([label], i) => `<div><span>${label}</span>${counts[i] ? `<span class="tag warn">${tr("s96", {0: (counts[i])})}</span>` : ''}</div>`).join('')}</div>
  </section>
  <section class="banner ${overdue.length || defects.length ? 'red ' : ''}ship-alarm" aria-label="${tr("s1190")}">
    ${urgencyChips(C.tasks(), '', true)}
    ${defects.length ? `<a href="#equip/defects">${tr("s1180", {0: (critical), 1: (high)})}</a>` : ''}
    ${overdue.length ? `<a href="#pms">${tr("s1181", {0: (overdue.length)})}</a>` : ''}
    ${!overdue.length && !defects.length ? ("<div class=\"note\">" + tr("s1182") + "</div>") : ''}
  </section>
  <div class="ship-metrics">
    <section class="card"><h2>${tr("s1191")}</h2><p class="note">${tr("s1192")}</p>
      ${jobs.length ? maintenance(jobs, date) : ("<p class=\"empty\">" + tr("s1183") + "</p>")}</section>
    <section class="card"><h2>${tr("s1193")}</h2><p class="note">${tr("s1194")}</p>
      ${jobs.length ? workload(jobs, date) : ("<p class=\"empty\">" + tr("s1184") + "</p>")}</section>
  </div>`;
}

export const VIEWS = { ship: shipView };
