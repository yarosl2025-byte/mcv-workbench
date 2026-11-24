import { t as tr } from "./i18n.js";
// Each entry is [closed shapes, open strokes]. Closed shapes support duotone fills.
const shapes = {
  'biolab-mark': ['M12 2.4 21 7.2v9.6l-9 4.8-9-4.8V7.2z','M7.4 15.7V8.3l4.6 4.6 4.6-4.6v7.4M3 9.7H1.6m20.8 4.6H21M12 2.4v2.2m0 14.8v2.2'],
  ship: ['M3 13l9-4 9 4-4 6H7Zm4-2V6h10v5','M12 3v3m-9 16q2-2 4 0t5 0 5 0 4 0'],
  anchor: ['M14 5a2 2 0 1 0-4 0 2 2 0 1 0 4 0','M12 7v14M8 10h8M4 15a8 6 0 0 0 16 0m-16 0-2 2m18-2 2 2'],
  engine: ['M7 3h10v7H7z','M7 6h10m-5 4v7m-2 0h4v4h-4zM4 10v10m16-10v10'],
  generator: ['M22 12a10 10 0 1 0-20 0 10 10 0 1 0 20 0','m13 5-5 8h4l-1 6 5-8h-4z'],
  turbine: ['M21 12a9 9 0 1 0-18 0 9 9 0 1 0 18 0','M12 12q6-3 2-8m-2 8q3 6 8 2m-8-2q-6 3-2 8m2-8Q9 6 4 10'],
  pump: ['M6 6h9l4 4v7H6z','M6 9H3v5h3m13-3h3V6h-7M9 20h8m-3-8a2 2 0 1 0-4 0 2 2 0 1 0 4 0'],
  tank: ['M5 6q0-3 7-3t7 3v12q0 3-7 3t-7-3z','M5 6q0 3 7 3t7-3M5 15q0 3 7 3t7-3'],
  droplet: ['M12 2q6 7 7 12a7 7 0 0 1-14 0q1-5 7-12Z','M8 15q0 3 3 4'],
  fuel: ['M4 3h10v18H4z','M6 6h6v5H6zm8 7h2q2 0 2 2v3a2 2 0 0 0 4 0V9l-3-3M2 21h14'],
  gauge: ['M3 16a9 9 0 1 1 18 0v3H3z','m12 15 4-5M7 12l-1-1m6-4v2m6 4h1'],
  trend: ['', 'M3 3v18h18M6 16l5-5 4 2 6-7m-5 0h5v5'],
  thermometer: ['M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z','M12 9v8m4-9h3m-3 4h3'],
  wrench: ['M21 5a6 6 0 0 1-7 8l-7 8a2 2 0 1 1-3-3l8-7a6 6 0 0 1 8-7l-4 4 2 2z','M5 19h.01'],
  tools: ['', 'm3 3 4 1 1 3 12 12-2 2L6 9 3 8zM13 8l5-5 3 3-5 5M8 14l-5 5 2 2 5-5'],
  alert: ['M12 3 2 21h20z','M12 9v5m0 3h.01'],
  bell: ['M5 17h14l-2-4V9A5 5 0 0 0 7 9v4z','M10 20q2 3 4 0M12 2v2'],
  check: ['', 'm4 12 5 5L20 6'],
  checklist: ['M3 3h18v18H3z','m6 8 1 1 2-2m3 1h6M6 13l1 1 2-2m3 1h6m-6 5h6'],
  calendar: ['M3 5h18v16H3z','M7 3v4m10-4v4M3 10h18m-14 4h2m3 0h2m3 0h1m-11 3h2'],
  clock: ['M22 12a10 10 0 1 0-20 0 10 10 0 1 0 20 0','M12 6v6l4 2'],
  search: ['M16 10a6 6 0 1 0-12 0 6 6 0 1 0 12 0','m15 15 6 6'],
  plus: ['', 'M12 4v16M4 12h16'],
  edit: ['m4 16 12-12 4 4L8 20l-5 1z','m13 7 4 4'],
  trash: ['M5 7h14l-1 14H6z','M3 7h18M9 7V3h6v4m-5 4v6m4-6v6'],
  copy: ['M8 8h12v13H8z','M16 5V3H3v14h2'],
  share: ['M8 12a2 2 0 1 0-4 0 2 2 0 1 0 4 0m12-6a2 2 0 1 0-4 0 2 2 0 1 0 4 0m0 12a2 2 0 1 0-4 0 2 2 0 1 0 4 0','m8 11 8-4m-8 6 8 4'],
  sync: ['', 'M20 10a8 8 0 0 0-14-4L3 9m0-5v5h5m-4 5a8 8 0 0 0 14 4l3-3m0 5v-5h-5'],
  cloud: ['M6 18a4 4 0 0 1-1-8 6 6 0 0 1 11-2 5 5 0 0 1 3 10z',''],
  'cloud-off': ['', 'm3 3 18 18M6 18a4 4 0 0 1-2-7m4-5a6 6 0 0 1 8 2 5 5 0 0 1 5 7m-7 3H6'],
  file: ['M5 3h9l5 5v13H5z','M14 3v5h5M8 12h8m-8 4h8'],
  book: ['M3 4h7l2 2 2-2h7v15h-7l-2 2-2-2H3z','M12 6v15M6 8h3m6 0h3'],
  camera: ['M3 7h5l2-3h4l2 3h5v13H3z','M16 13a4 4 0 1 0-8 0 4 4 0 1 0 8 0'],
  mic: ['M9 10V6a3 3 0 1 1 6 0v4a3 3 0 1 1-6 0z','M5 10a7 7 0 0 0 14 0m-7 7v4m-4 0h8'],
  settings: ['M10 3h4l1 3 3-1 2 3-2 3v2l2 3-2 3-3-1-1 3h-4l-1-3-3 1-2-3 2-3v-2L4 8l2-3 3 1z','M15 12a3 3 0 1 0-6 0 3 3 0 1 0 6 0'],
  home: ['M4 11l8-8 8 8v10H4z','M9 21v-7h6v7'],
  map: ['m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z','M9 3v15m6-12v15'],
  lifebuoy: ['M22 12a10 10 0 1 0-20 0 10 10 0 1 0 20 0','M16 12a4 4 0 1 0-8 0 4 4 0 1 0 8 0M5 5l4 4m6 6 4 4m0-14-4 4m-6 6-4 4'],
  fire: ['M12 2q0 5 4 7l1-3q4 5 4 9a9 7 0 0 1-18 0q0-4 4-8l1 4q3-3 4-9z','M12 13q5 5 0 8-5-3 0-8z'],
  flask: ['M9 3h6m-5 0v7L4 19q-1 2 2 2h12q3 0 2-2l-6-9V3','M8 15h8m-6 3h.01m4 0h.01'],
  snowflake: ['', 'M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3m-6 16 3-3 3 3M4 10l4-1-1-4m13 9-4 1 1 4'],
  fan: ['M12 10Q5 1 4 8q0 4 6 4m4 0q9-7 2-8-4 0-4 6m0 4q7 9 8 2 0-4-6-4m-4 0q-9 7-2 8 4 0 4-6','M14 12a2 2 0 1 0-4 0 2 2 0 1 0 4 0'],
  crane: ['M3 3h16v4H3zm3 4h4v14H6z','M3 21h10m6-14v7q-3 0-3 2a2 2 0 0 0 4 0M6 12l4 4m0-9 4-4'],
  steering: ['M22 12a10 10 0 1 0-20 0 10 10 0 1 0 20 0','M3 10h18m-9 3v8m-7-3 5-5m4 0 5 5m-5-6a2 2 0 1 0-4 0 2 2 0 1 0 4 0'],
  antenna: ['M14 10a2 2 0 1 0-4 0 2 2 0 1 0 4 0','M12 12v9m-4 0h8M7 6q-4 4 0 8m10-8q4 4 0 8M4 3q-7 7 0 14m16-14q7 7 0 14'],
  box: ['m3 7 9-4 9 4v11l-9 4-9-4z','m3 7 9 4 9-4m-9 4v11M7 5l9 4'],
  clipboard: ['M8 5H4v16h16V5h-4m-8-2h8v5H8z','M8 12h8m-8 4h8'],
  mail: ['M3 5h18v14H3z','m3 6 9 7 9-7'],
  reply: ['M9 4 2 11l7 6v-4c6 0 9 1 13 6-1-8-5-11-13-11z',''],
  flag: ['M5 4h14l-3 4 3 4H5z','M5 3v18'],
  'chevron-right': ['', 'm9 5 7 7-7 7'],
  'chevron-down': ['', 'm5 9 7 7 7-7'],
  'chevron-left': ['', 'm15 5-7 7 7 7'],
  close: ['', 'm5 5 14 14M19 5 5 19'],
  filter: ['M3 4h18l-7 8v7l-4 2v-9z',''],
  upload: ['', 'M12 16V3M7 8l5-5 5 5M4 15v6h16v-6'],
  download: ['', 'M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5'],
  star: ['m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',''],
  more: ['M5 12h.01m7 0h.01m7 0h.01',''],
};

export const iconNames = Object.keys(shapes);
const hazard = '<circle cx="12" cy="12" r="4.5" stroke-width="1.5"/>' +
  [0, 120, 240].map(angle => `<path transform="rotate(${angle} 12 12)" fill="currentColor" stroke="none"
    d="M9 2.3a4.5 4.5 0 1 0 6 0A6.5 6.5 0 1 1 9 2.3Z"/>`).join('') +
  '<circle cx="12" cy="12" r="1.65" fill="currentColor" stroke="none"/>';
export function ico(name, { size = 20, cls = '' } = {}) {
  const [solid, line] = Object.hasOwn(shapes, name) ? shapes[name] : shapes.tools;
  const safeClass = String(cls).replace(/[^\w -]/g, '');
  const dimension = Number(size) || 20;
  const paths = name === 'biohazard' ? hazard : (solid ? `<path class="ico-fill" d="${solid}"/>` : '') +
    (line ? `<path d="${line}"/>` : '');
  return `<svg class="ico ${safeClass}" width="${dimension}" height="${dimension}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

export const viewIcons = {
  ship:'ship', today:'home', notes:'book', lochart:'droplet', equip:'tools', plan:'calendar',
  alerts:'bell', pms:'checklist', rhrs:'clock', perf:'trend', dg:'generator', fuel:'fuel',
  oil:'flask', tanks:'tank', lube:'droplet', reefer:'snowflake', log:'clipboard', bwm:'gauge',
  sync:'sync', more:'more', urgency:'alert', icons:'box', biolab:'biolab-mark', 'plan/priorities':'flag',
};
const groupIcons = { me:'engine', ae:'generator', tg:'turbine', st:'steering', dk:'crane', ls:'lifebuoy',
  fp:'fire', ps:'pump', sy:'fan', el:'generator', nv:'antenna', cg:'box', hl:'ship', gn:'checklist' };
const actions = {
  accept:'check', decline:'close', close:'close', mic:'mic', dict:'mic', export:'download', install:'download',
  gencode:'sync', syncall:'sync', unlink:'cloud-off', update:'download', ntmove:'check', nttask:'plus',
  rfsea:'thermometer', tscancel:'close', ntcancel:'close', eqback:'chevron-left', reply:'reply',
  pmadd:'plus', tsnew:'plus', tsmail:'mail', ntshare:'share', pmmore:'chevron-down', lgmore:'chevron-down',
};
const exact = { '+':'plus', '×':'close', '✕':'close', '←':'chevron-left', '→':'chevron-right', '‹':'chevron-left', '›':'chevron-right' };
const tabIcons = { tree:'tools', ts:'alert', daily:'clipboard', month:'calendar', rob:'tank', clo:'droplet',
  lube:'droplet', bunker:'fuel', scrape:'flask', iso:'trend', pmi:'gauge', status:'checklist',
  sum:'trend', day:'calendar', cnt:'gauge', notes:'book', theme:'settings' };
const texts = [
  [/удал|точно\?|delet/i,'trash'], [/копир|copy/i,'copy'], [/подел|share/i,'share'], [/редакт|править|\bedit\b/i,'edit'],
  [/добав|новая|новый|\b(?:add|new)\b/i,'plus'], [/сохран|\bsave\b/i,'check'], [/отмен|закрыть|cancel|close/i,'close'], [/загруз|import|upload/i,'upload'],
  [/скач|выгруз|export|download/i,'download'], [/поиск|search/i,'search'], [/оформлен|настрой|settings|appearance|language/i,'settings'],
  [/нагрузк|тренд|график|trend|chart|workload/i,'trend'], [/просроч|неисправ|срочн|тревог|overdue|fault|urgency|alarm/i,'alert'],
  [/танк|\btanks?\b/i,'tank'], [/масл|\boils?\b/i,'droplet'], [/топлив|fuel/i,'fuel'], [/синхрон|обнов|sync|update/i,'sync'],
  [/сегодня|недел|месяц|срок|today|week|month|due/i,'calendar'], [/обслужив|работ|maintenance|\bjobs\b/i,'checklist'],
];
const labelIcon = text => texts.find(([pattern]) => pattern.test(text))?.[1];

function insertIcon(element, name, size, replace = false) {
  if (element.querySelector(':scope > .ico')) return;
  if (replace) element.querySelector(':scope > svg')?.remove();
  element.insertAdjacentHTML('afterbegin', ico(name, { size }));
}

export function decorateIcons(root, view) {
  root.querySelectorAll('a[data-v], .more-menu a[href^="#"], .ship-tabs a').forEach(link => {
    const name = viewIcons[link.dataset.v || link.hash.slice(1)];
    if (name) insertIcon(link, name, 20, true);
  });
  root.querySelectorAll('h1,h2,h3').forEach(heading => {
    const group = heading.closest('[data-act="eqg"]')?.dataset.k;
    const name = groupIcons[group] || (heading.tagName === 'H1' ? viewIcons[view] : labelIcon(heading.textContent)) || viewIcons[view] || 'clipboard';
    insertIcon(heading, name, heading.tagName === 'H1' ? 24 : 17);
  });
  root.querySelectorAll('button, label.btn').forEach(button => {
    if (button.querySelector(':scope > .ico')) return;
    const { act = '', k, t, m } = button.dataset;
    const label = button.textContent.trim();
    const glyph = exact[label];
    const name = button.dataset.icon || actions[act] || (act.endsWith('del') ? 'trash' : act.endsWith('edit') ? 'edit' :
      act.endsWith('add') ? 'plus' : act.endsWith('save') ? 'check' : null) ||
      glyph ||
      (button.matches('[role="tab"],.seg button') && tabIcons[k || t || m]) ||
      (label.startsWith('+') ? 'plus' : label.startsWith('←') ? 'chevron-left' : labelIcon(label)) ||
      (button.matches('.chip') ? 'filter' : button.matches('.mc,.strip button') ? 'calendar' :
        button.matches('[role="tab"]') ? 'box' : button.id === 'tundo' ? 'reply' : 'chevron-right');
    if (glyph) {
      if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', button.title || (glyph === 'close' ? tr("s570") : glyph === 'plus' ? tr("s1146") : glyph === 'chevron-left' ? tr("s1147") : tr("s1148")));
      button.textContent = '';
    } else if (/^[+←]\s/u.test(label) && button.firstChild?.nodeType === Node.TEXT_NODE) {
      button.firstChild.textContent = button.firstChild.textContent.replace(/^\s*[+←]\s*/u, '');
    }
    insertIcon(button, name, 16, true);
  });
  root.querySelectorAll('.tag.warn,.tag.p1,.ship-status,.ship-alarm a').forEach(element => {
    const state = element.dataset.state;
    const name = state ? ({ idle:'cloud', syncing:'sync', offline:'cloud-off', error:'alert', local:'file' }[state] || 'sync') :
      /срок|\bdue\b/i.test(element.textContent) ? 'clock' : 'alert';
    insertIcon(element, name, 14);
  });
}
