// Loaded before the stylesheets so a saved appearance is applied on first paint.
(() => {
  let tr = key => key;
  const setTranslator = translate => { tr = translate };
  const themes = {
    old: { get label() { return tr("s673") }, metal: 'off' },
    a: { get label() { return tr("s674") }, metal: 'light' },
    b: { get label() { return tr("s675") }, metal: 'strong' },
    c: { get label() { return tr("s676") }, metal: 'off' },
    d: { get label() { return tr("s677") }, metal: 'off' },
    e: { get label() { return tr("s678") }, metal: 'light' },
    f: { get label() { return tr("s679") }, metal: 'off' },
    g1: { get label() { return tr("s680") }, metal: 'off' },
    g2: { get label() { return tr("s681") }, metal: 'off' },
  };
  const metals = { get off() { return tr("s682") }, get light() { return tr("s683") }, get strong() { return tr("s684") } };
  const effects = { get off() { return tr("s682") }, get light() { return tr("s685") } };
  const palettes = {
    signal: { get title() { return tr("s686") }, colors: ['#D9534F', '#E8913A', '#E3C14A', '#5B9BD5'] },
    muted: { get title() { return tr("s687") }, colors: ['#C0524B', '#C98A4B', '#BFA85A', '#6F93B3'] },
    accessible: { get title() { return tr("s688") }, colors: ['#D55E00', '#E69F00', '#56B4E9', '#8C96A3'] },
    mono: { get title() { return tr("s689") }, colors: ['#888888', '#888888', '#888888', '#888888'] },
    custom: { get title() { return tr("s690") } },
  };
  const keys = ['crit', 'high', 'reply', 'norm'];
  const colorPattern = /^#[\da-f]{6}$/i;
  const storage = {
    get(key) { try { return localStorage.getItem(key) } catch { return null } },
    set(key, value) { try { localStorage.setItem(key, value) } catch {} },
    json(key) {
      try { const value = JSON.parse(this.get(key)); return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
      catch { return {} }
    },
  };
  const root = document.documentElement;
  const effectKey = 'mcv-biolab-effects';
  const savedEffects = storage.get(effectKey);
  root.dataset.effects = Object.hasOwn(effects, savedEffects) ? savedEffects : 'light';
  function setEffects(value) {
    if (!Object.hasOwn(effects, value)) return;
    root.dataset.effects = value;
    storage.set(effectKey, value);
  }
  const metalByTheme = storage.json('mcv-metal');
  const savedUrgency = storage.json('mcv-urgency');
  const urgency = {
    palette: Object.hasOwn(palettes, savedUrgency.palette) ? savedUrgency.palette : 'muted',
    colors: palettes.muted.colors.map((fallback, i) => colorPattern.test(savedUrgency.colors?.[i]) ? savedUrgency.colors[i] : fallback),
  };
  function applyUrgency() {
    const colors = palettes[urgency.palette].colors || urgency.colors;
    keys.forEach((key, i) => root.style.setProperty('--u-' + key, colors[i]));
    root.dataset.urgencyPalette = urgency.palette;
  }
  function setUrgency(palette, index, color) {
    if (!Object.hasOwn(palettes, palette)) return;
    urgency.palette = palette;
    if (keys[index] && colorPattern.test(color)) urgency.colors[index] = color;
    storage.set('mcv-urgency', JSON.stringify(urgency));
    applyUrgency();
  }
  function apply(theme) {
    root.dataset.theme = theme;
    const metal = metalByTheme[theme];
    root.dataset.metal = Object.hasOwn(metals, metal) ? metal : themes[theme].metal;
  }
  function setTheme(theme) {
    if (!Object.hasOwn(themes, theme)) return;
    storage.set('mcv-theme', theme);
    const url = new URL(location.href);
    if (url.searchParams.has('theme')) {
      url.searchParams.set('theme', theme);
      history.replaceState(history.state, '', url);
    }
    apply(theme);
  }
  function setMetal(metal) {
    if (!Object.hasOwn(metals, metal)) return;
    const theme = root.dataset.theme;
    metalByTheme[theme] = metal;
    storage.set('mcv-metal', JSON.stringify(metalByTheme));
    apply(theme);
  }
  const requested = new URLSearchParams(location.search).get('theme');
  const saved = storage.get('mcv-theme');
  apply(Object.hasOwn(themes, requested) ? requested : Object.hasOwn(themes, saved) ? saved : 'a');
  applyUrgency();
  window.MCVAppearance = { setTranslator, themes, metals, setTheme, setMetal, effects, setEffects, palettes, urgency, setUrgency };
})();
