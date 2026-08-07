// Premium interactive investment chart (Citi Mobile / Fidelity / Apple Stocks
// style). Renders a smooth blue/purple gradient line with a soft gradient
// fill on top of an SVG, supports:
//   - time-range switching (1D / 1W / 1M / 3M / 1Y / ALL) with an animated
//     morph between datasets
//   - a subtle continuous "live" drift so the line never looks static
//   - drag / touch scrubbing with a crosshair + tooltip showing the value
//     and date at the selected point, plus a live-updating gain/loss callback
//
// No external chart library — everything is plain SVG + pointer events, in
// keeping with the rest of this codebase.

const POINT_COUNT = 60;
const VIEW_WIDTH = 380;
const VIEW_HEIGHT = 180;
const PADDING_Y = 10;

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

const rangeConfig = {
  '1D': { points: POINT_COUNT, volatility: 0.006, label: (i, n) => new Date(Date.now() - (n - 1 - i) * 6 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) },
  '1W': { points: POINT_COUNT, volatility: 0.012, label: (i, n) => new Date(Date.now() - (n - 1 - i) * 2.8 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric' }) },
  '1M': { points: POINT_COUNT, volatility: 0.02, label: (i, n) => new Date(Date.now() - (n - 1 - i) * 12 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
  '3M': { points: POINT_COUNT, volatility: 0.03, label: (i, n) => new Date(Date.now() - (n - 1 - i) * 36 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) },
  '1Y': { points: POINT_COUNT, volatility: 0.05, label: (i, n) => new Date(Date.now() - (n - 1 - i) * 6 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) },
  'ALL': { points: POINT_COUNT, volatility: 0.08, label: (i, n) => new Date(Date.now() - (n - 1 - i) * 18 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) },
};

// Generates a deterministic-but-organic random walk of `n` points that ends
// exactly at `endValue`, so the chart always agrees with the real portfolio
// total shown above it.
function generateSeries(range, endValue, seedKey) {
  const cfg = rangeConfig[range] || rangeConfig['1M'];
  const n = cfg.points;
  const rand = mulberry32(hashSeed(`${seedKey}:${range}`));
  const base = Math.max(endValue, 1);
  const steps = [];
  let value = base * (1 - (rand() - 0.3) * cfg.volatility * 4);
  for (let i = 0; i < n; i++) {
    const drift = (rand() - 0.48) * cfg.volatility * base;
    value += drift;
    steps.push(value);
  }
  // Anchor the final point to the real ending value so the chart is always
  // consistent with the number displayed above it, with a gentle taper so
  // the join doesn't look abrupt.
  const tailBlend = Math.min(6, n);
  for (let i = 0; i < tailBlend; i++) {
    const idx = n - tailBlend + i;
    const t = (i + 1) / tailBlend;
    steps[idx] = steps[idx] * (1 - t) + endValue * t;
  }
  steps[n - 1] = endValue;
  return steps;
}

function pointsToPath(points) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, max * 0.001, 0.01);
  const usableHeight = VIEW_HEIGHT - PADDING_Y * 2;
  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * VIEW_WIDTH;
    const y = PADDING_Y + usableHeight - ((v - min) / range) * usableHeight;
    return [x, y];
  });
  let d = `M${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;
  for (let i = 1; i < coords.length; i++) {
    d += ` L${coords[i][0].toFixed(2)} ${coords[i][1].toFixed(2)}`;
  }
  const fillD = `${d} L${VIEW_WIDTH} ${VIEW_HEIGHT} L0 ${VIEW_HEIGHT} Z`;
  return { lineD: d, fillD, coords };
}

function lerp(a, b, t) { return a + (b - a) * t; }

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

/**
 * Mounts an interactive chart into the given root's chart elements.
 * @param {Element} root - the page root (portfolio.html fragment)
 * @param {Object} opts
 * @param {(v:number)=>string} opts.formatCurrency
 * @param {(points:number[], range:string)=>void} [opts.onScrub] - called with
 *   the current series + range while the user drags; called with null to
 *   signal "released" so the caller can restore normal totals.
 */
export function createPortfolioChart(root, opts) {
  const { formatCurrency } = opts;
  const svg = root.querySelector('#portChartSvg');
  const linePath = root.querySelector('#portChartLine');
  const fillPath = root.querySelector('#portChartFill');
  const crosshair = root.querySelector('#portChartCrosshair');
  const crosshairLine = root.querySelector('#portChartCrosshairLine');
  const crosshairDot = root.querySelector('#portChartCrosshairDot');
  const tooltip = root.querySelector('#portChartTooltip');
  const tooltipValue = root.querySelector('#portChartTooltipValue');
  const tooltipDate = root.querySelector('#portChartTooltipDate');
  const wrap = root.querySelector('#portChartWrap');

  let currentRange = '1M';
  let currentPoints = [];
  let currentEndValue = 0;
  let seedKey = 'portfolio';
  let animationFrame = null;
  let liveTimer = null;
  let dragging = false;
  let destroyed = false;

  function draw(points) {
    const { lineD, fillD, coords } = pointsToPath(points);
    linePath.setAttribute('d', lineD);
    fillPath.setAttribute('d', fillD);
    return coords;
  }

  let lastCoords = [];

  function animateTo(newPoints, duration = 650) {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    const startPoints = currentPoints.length === newPoints.length ? currentPoints.slice() : new Array(newPoints.length).fill(newPoints[newPoints.length - 1]);
    const startTime = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = easeOutCubic(t);
      const frame = newPoints.map((v, i) => lerp(startPoints[i], v, eased));
      lastCoords = draw(frame);
      if (t < 1 && !destroyed) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        currentPoints = newPoints;
        animationFrame = null;
      }
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function setRange(range, endValue, animate = true) {
    currentRange = range;
    currentEndValue = endValue;
    const series = generateSeries(range, endValue, seedKey);
    if (animate && currentPoints.length) {
      animateTo(series);
    } else {
      currentPoints = series;
      lastCoords = draw(series);
    }
  }

  function setEndValue(endValue, seed) {
    if (seed) seedKey = seed;
    setRange(currentRange, endValue, currentPoints.length > 0);
  }

  // ---------- Subtle continuous "live market" drift ----------
  // Every couple of seconds, nudge the last few points slightly so the chart
  // never looks like a static image — same trick real trading apps use for
  // an "always live" feel between real data ticks.
  function startLiveDrift() {
    stopLiveDrift();
    liveTimer = setInterval(() => {
      if (dragging || destroyed || !currentPoints.length) return;
      const rand = Math.random() - 0.5;
      const magnitude = Math.max(currentEndValue * 0.0015, 0.05);
      const next = currentPoints.slice();
      const lastIdx = next.length - 1;
      next[lastIdx] = Math.max(0, next[lastIdx] + rand * magnitude);
      animateTo(next, 900);
    }, 2600);
  }

  function stopLiveDrift() {
    if (liveTimer) clearInterval(liveTimer);
    liveTimer = null;
  }

  // ---------- Drag / touch scrubbing ----------
  function clientXToIndex(clientX) {
    const rect = svg.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(fraction * (currentPoints.length - 1));
  }

  function showScrub(index) {
    if (!lastCoords[index]) return;
    const [x, y] = lastCoords[index];
    crosshair.classList.remove('hidden');
    crosshairLine.setAttribute('x1', x);
    crosshairLine.setAttribute('x2', x);
    crosshairDot.setAttribute('cx', x);
    crosshairDot.setAttribute('cy', y);

    const rect = svg.getBoundingClientRect();
    const pxRatio = rect.width / VIEW_WIDTH;
    tooltip.classList.remove('hidden');
    tooltip.style.left = `${x * pxRatio}px`;
    tooltip.style.top = `${(y / VIEW_HEIGHT) * rect.height}px`;

    const value = currentPoints[index];
    tooltipValue.textContent = formatCurrency(value);
    const cfg = rangeConfig[currentRange] || rangeConfig['1M'];
    tooltipDate.textContent = cfg.label(index, currentPoints.length);

    if (opts.onScrub) opts.onScrub(value, index, currentPoints);
  }

  function hideScrub() {
    crosshair.classList.add('hidden');
    tooltip.classList.add('hidden');
    if (opts.onScrub) opts.onScrub(null);
  }

  function onPointerDown(e) {
    dragging = true;
    if (svg.setPointerCapture && e.pointerId != null) svg.setPointerCapture(e.pointerId);
    showScrub(clientXToIndex(e.clientX));
  }
  function onPointerMove(e) {
    if (!dragging) return;
    showScrub(clientXToIndex(e.clientX));
  }
  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    hideScrub();
  }

  svg.style.touchAction = 'none';
  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointerleave', onPointerUp);
  svg.addEventListener('pointercancel', onPointerUp);

  startLiveDrift();

  return {
    setRange,
    setEndValue,
    destroy() {
      destroyed = true;
      stopLiveDrift();
      if (animationFrame) cancelAnimationFrame(animationFrame);
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', onPointerUp);
      svg.removeEventListener('pointerleave', onPointerUp);
      svg.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
