/* VFD Hi-Fi scene mode. EL rendering in display-fx.js is left untouched. */
(() => {
  'use strict';
  if (!window.TelegraphFXPanel) return;
  const panel = document.querySelector('.panel');
  if (!panel) return;
  const defaults = { core: .68, exposure: 2.5, near: 1.95, nearRadius: 4.1, mid: .75, midRadius: 7, far: .16, farRadius: 20, glassDepth: .07, unlit: .3, mesh: .6, reflection: .24, hue: 1, density: .1, pitch: 1.5, gap: .2, pixelBoost: 1, pixelContrast: 1 };
  const parameters = { ...defaults };
  const enabled = { glass: true, grid: true, glow: true, ghost: false };
  const enabledDefaults = { ...enabled };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none';
  document.body.append(svg);
  const overlay = document.createElement('div');
  overlay.className = 'fx-mode-overlay';
  overlay.dataset.mode = 'vfd';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
  const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
  function apply() {
    document.documentElement.dataset.fxMode = 'vfd';
    const p = parameters;
    const hue = 152 + Math.max(0, Math.min(1, p.hue)) * 24;
    const core = `hsl(${hue} 95% ${Math.min(86, 64 + p.core * 10)}%)`;
    const near = `hsl(${hue} 95% 58%)`;
    const mid = `hsl(${hue - 6} 85% 44%)`;
    const far = `hsl(${hue - 12} 70% 26%)`;
    const root = document.documentElement.style;
    root.setProperty('--amber', core);
    root.setProperty('--amber2', core);
    root.setProperty('--fx-core', core);
    root.setProperty('--vfd-grid-pitch', Math.max(1.5, p.pitch) + 'px');
    root.setProperty('--vfd-grid-gap', Math.max(.6, p.gap) + 'px');
    root.setProperty('--vfd-grid-alpha', enabled.grid ? String(Math.min(.5, p.mesh * .22 + p.unlit * .12)) : '0');
    root.setProperty('--vfd-glass-alpha', enabled.glass ? String(Math.min(.35, p.reflection * .6)) : '0');
    root.setProperty('--vfd-vignette', enabled.glass ? String(Math.min(.7, .25 + p.glassDepth * .6)) : '.2');
    root.setProperty('--vfd-glass-depth', enabled.glass ? String(Math.min(.8, .3 + p.glassDepth * .5)) : '.2');
    const r = panel.getBoundingClientRect();
    const W = Math.max(1, Math.ceil(r.width)), H = Math.max(1, Math.ceil(r.height));
    const pitch = Math.max(1.5, p.pitch), gap = Math.max(.2, p.gap), cells = 8, tileSize = pitch * cells;
    const dpr = Math.min(3, Math.max(1, devicePixelRatio || 1));
    const tileCanvas = document.createElement('canvas');
    tileCanvas.width = tileCanvas.height = Math.round(tileSize * dpr);
    const tc = tileCanvas.getContext('2d');
    tc.scale(dpr, dpr);
    for (let gy = 0; gy < cells; gy++) for (let gx = 0; gx < cells; gx++) {
      const v = hash(gx + 1, gy + 1);
      tc.globalAlpha = Math.max(.35, 1 - p.density * v * .7);
      tc.fillStyle = '#fff';
      tc.fillRect(gx * pitch + gap / 2, gy * pitch + gap / 2, Math.max(.8, pitch - gap), Math.max(.8, pitch - gap));
    }
    const exp = Math.min(2.6, Math.pow(1.6, Math.max(0, p.exposure - 1)));
    const nearA = Math.min(.95, (.18 + p.near * .22) * exp);
    const midA = Math.min(.75, (.08 + p.mid * .28) * exp);
    const farA = Math.min(.4, (.03 + p.far * .5) * exp);
    const coreA = Math.min(1, (.35 + p.core * .55) * (.75 + p.pixelContrast * .25) * exp);
    const mask = '<feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .3333 .3333 .3333 0 0" result="mask"/>';
    const wide = `<feMorphology in="mask" operator="dilate" radius="${.25 + p.pixelBoost * .85}" result="wide"/>`;
    const lattice = `<feImage href="${tileCanvas.toDataURL()}" x="0" y="0" width="${tileSize}" height="${tileSize}" preserveAspectRatio="none" result="tile"/><feTile in="tile" result="lattice"/>`;
    const dots = '<feComposite in="lattice" in2="wide" operator="in" result="dots"/>';
    const glow = enabled.glow ? [
      [p.farRadius, farA, far], [p.midRadius, midA, mid], [p.nearRadius, nearA, near]
    ].map(([radius, alpha, color], i) => `<feGaussianBlur in="dots" stdDeviation="${radius}" result="b${i}"/><feFlood flood-color="${color}" flood-opacity="${alpha}" result="f${i}"/><feComposite in="f${i}" in2="b${i}" operator="in" result="g${i}"/>`).join('') : '';
    const ghost = enabled.ghost ? `<feOffset in="dots" dx="1.4" dy=".7" result="ghostShift"/><feGaussianBlur in="ghostShift" stdDeviation=".5" result="ghostBlur"/><feFlood flood-color="${near}" flood-opacity="${Math.min(.35, .18 * exp)}" result="ghostColor"/><feComposite in="ghostColor" in2="ghostBlur" operator="in" result="ghost"/>` : '';
    const coreNode = `<feFlood flood-color="${core}" flood-opacity="${coreA}" result="c"/><feComposite in="c" in2="dots" operator="in" result="core"/>`;
    const merge = `<feMerge>${enabled.glow ? '<feMergeNode in="g0"/><feMergeNode in="g1"/><feMergeNode in="g2"/>' : ''}${enabled.ghost ? '<feMergeNode in="ghost"/>' : ''}<feMergeNode in="core"/></feMerge>`;
    svg.innerHTML = `<defs><filter id="vfd-scene" filterUnits="userSpaceOnUse" x="-40" y="-40" width="${W + 80}" height="${H + 80}" color-interpolation-filters="sRGB">${mask}${wide}${lattice}${dots}${glow}${ghost}${coreNode}${merge}</filter></defs>`;
    Object.assign(overlay.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
  new ResizeObserver(() => { if (document.documentElement.dataset.fxMode === 'vfd') apply(); }).observe(panel);
  window.TelegraphFXPanel.registerRenderer('vfd', { parameters, enabled, defaults: { parameters: { ...defaults }, enabled: { ...enabledDefaults } }, apply });
})();
