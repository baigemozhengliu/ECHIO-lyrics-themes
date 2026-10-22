/* Monochrome green CRT scene mode. EL rendering in display-fx.js is left untouched. */
(() => {
  'use strict';
  if (!window.TelegraphFXPanel) return;
  const panel = document.querySelector('.panel');
  if (!panel) return;
  const defaults = { pitch: 2.7, scan: .27, green: 116, glow: 11, bright: 1.15 };
  const parameters = { ...defaults };
  const enabled = {};
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
  document.body.append(svg);
  const overlay = document.createElement('div');
  overlay.className = 'fx-mode-overlay';
  overlay.dataset.mode = 'crt';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
  function apply() {
    document.documentElement.dataset.fxMode = 'crt';
    const p = parameters;
    const hue = Math.max(95, Math.min(150, p.green));
    const lightness = Math.min(86, 52 + p.bright * 18);
    const core = `hsl(${hue} 95% ${lightness}%)`;
    const near = `hsl(${hue} 92% 58%)`;
    const mid = `hsl(${hue} 82% 42%)`;
    const far = `hsl(${hue} 70% 24%)`;
    const root = document.documentElement.style;
    root.setProperty('--amber', core);
    root.setProperty('--amber2', core);
    root.setProperty('--fx-core', core);
    root.setProperty('--crt-pitch', Math.max(1.2, p.pitch) + 'px');
    root.setProperty('--crt-scan', String(Math.max(0, Math.min(.85, p.scan))));
    const r = panel.getBoundingClientRect();
    const W = Math.max(1, Math.ceil(r.width)), H = Math.max(1, Math.ceil(r.height));
    const bright = Math.min(1.5, Math.max(.3, p.bright));
    const mask = '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .3333 .3333 .3333 0 0" result="mask"/>';
    const glow = p.glow > 0 ? [
      [p.glow * 2.2, Math.min(.22, .12 * bright), far],
      [p.glow, Math.min(.42, .28 * bright), mid],
      [p.glow * .38, Math.min(.8, .55 * bright), near]
    ].map(([radius, alpha, color], i) => `<feGaussianBlur in="mask" stdDeviation="${radius}" result="b${i}"/><feFlood flood-color="${color}" flood-opacity="${alpha}" result="f${i}"/><feComposite in="f${i}" in2="b${i}" operator="in" result="g${i}"/>`).join('') : '';
    const coreNode = `<feFlood flood-color="${core}" flood-opacity="${Math.min(1, .55 + bright * .3)}" result="c"/><feComposite in="c" in2="mask" operator="in" result="core"/>`;
    const merge = `<feMerge>${p.glow > 0 ? '<feMergeNode in="g0"/><feMergeNode in="g1"/><feMergeNode in="g2"/>' : ''}<feMergeNode in="core"/></feMerge>`;
    svg.innerHTML = `<defs><filter id="crt-scene" filterUnits="userSpaceOnUse" x="-40" y="-40" width="${W + 80}" height="${H + 80}" color-interpolation-filters="sRGB">${mask}${glow}${coreNode}${merge}</filter></defs>`;
    Object.assign(overlay.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
  new ResizeObserver(() => { if (document.documentElement.dataset.fxMode === 'crt') apply(); }).observe(panel);
  window.TelegraphFXPanel.registerRenderer('crt', { parameters, enabled, defaults: { parameters: { ...defaults }, enabled: {} }, apply });
})();
