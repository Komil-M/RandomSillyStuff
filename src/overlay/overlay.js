const canvas = document.getElementById('overlayCanvas');
const context = canvas.getContext('2d');

let latestPayload = null;
let devicePixelRatioCache = window.devicePixelRatio || 1;
let mapTransform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

function resize() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  devicePixelRatioCache = ratio;
  draw();
}

function computeMapTransform(treeNodes, overlayBounds) {
  if (!treeNodes || !treeNodes.length) {
    return { scale: overlayBounds.scale || 1, offsetX: overlayBounds.offsetX || 0, offsetY: overlayBounds.offsetY || 0 };
  }
  const xs = treeNodes.map((node) => Number(node.x || 0));
  const ys = treeNodes.map((node) => Number(node.y || 0));
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = canvas.width / devicePixelRatioCache;
  const height = canvas.height / devicePixelRatioCache;
  const fitX = width > 0 ? width / Math.max(1, maxX - minX + 40) : 1;
  const fitY = height > 0 ? height / Math.max(1, maxY - minY + 40) : 1;
  const baseScale = Math.min(fitX, fitY) * 0.8;
  const scale = baseScale * Number(overlayBounds.scale || 1);
  return {
    scale,
    offsetX: ((width / 2) - (((minX + maxX) / 2) * scale)) + (overlayBounds.offsetX || 0),
    offsetY: ((height / 2) + 140 - (((minY + maxY) / 2) * scale)) + (overlayBounds.offsetY || 0),
  };
}

function normalizeCoords(point, bounds) {
  return {
    x: point.x * bounds.scale + bounds.offsetX,
    y: point.y * bounds.scale + bounds.offsetY,
  };
}

function drawGrid(bounds) {
  const { width, height } = canvas;
  context.save();
  context.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  context.lineWidth = 1;
  for (let x = 0; x < width; x += 80 * devicePixelRatioCache) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += 80 * devicePixelRatioCache) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.restore();
}

function drawTextTopBar(payload) {
  const { character, mission, selectedGuide, routeNodes, guideProgress } = payload;
  const guide = selectedGuide || {};
  const totalSteps = routeNodes.length;
  const currentStep = Number(guideProgress?.currentStep || 0);
  const completed = Math.max(0, Math.min(totalSteps, Number.isFinite(currentStep) ? currentStep : 0));
  const nextStep = completed < totalSteps ? completed + 1 : totalSteps;
  const status =
    totalSteps > 0
      ? `${completed}/${totalSteps} done (next #${nextStep}${completed === totalSteps ? ' (complete)' : ''})`
      : 'No route steps';
  const text = `Character: ${character?.name || 'N/A'} | Mission: ${
    mission?.text || 'N/A'
  } | Guide: ${guide.title || 'none'} | ${status}`;
  context.save();
  context.fillStyle = 'rgba(4,6,20,0.65)';
  context.fillRect(10, 10, Math.min(canvas.width / devicePixelRatioCache - 20, text.length * 7.8 + 80), 28);
  context.fillStyle = '#eff3ff';
  context.font = '12px Consolas, monospace';
  context.fillText(text, 18, 30);
  context.restore();
}

function draw() {
  const payload = latestPayload;
  if (!payload) return;
  const { overlay, treeData, routeNodes = [] } = payload;
  if (!overlay?.visible) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  context.clearRect(0, 0, canvas.width, canvas.height);

  const bounds = {
    scale: Number(overlay.scale || 1),
    offsetX: Number(overlay.offsetX || 0),
    offsetY: Number(overlay.offsetY || 0),
    width: canvas.width / devicePixelRatioCache,
    height: canvas.height / devicePixelRatioCache,
  };

  drawGrid(bounds);
  drawTextTopBar(payload);

  if (!treeData || !Array.isArray(treeData.nodes)) {
    context.save();
    context.fillStyle = '#ff5d5d';
    context.fillText('Passive tree data missing', 18, 60);
    context.restore();
    return;
  }

  const indexById = new Map();
  treeData.nodes.forEach((node) => indexById.set(String(node.id), node));
  mapTransform = computeMapTransform(treeData.nodes, bounds);
  const toScreen = (node) => normalizeCoords(node, mapTransform);

  const guideProgress = payload.guideProgress || {};
  const rawRouteNodes = Array.isArray(routeNodes) ? routeNodes : [];
  const routeOrdered = [...rawRouteNodes].sort((a, b) => (a.order || 0) - (b.order || 0));
  const routeIds = rawRouteNodes.map((node) => String(node.id));
  const routeIdSet = new Set(routeIds);
  const completedCount = Math.max(
    0,
    Math.min(routeOrdered.length, Number.isFinite(Number(guideProgress.currentStep))
      ? Number(guideProgress.currentStep)
      : 0)
  );

  context.save();
  context.strokeStyle = 'var(--edge)';
  context.lineWidth = 2;
  context.lineCap = 'round';
  (treeData.edges || []).forEach(([a, b]) => {
    const start = indexById.get(String(a));
    const end = indexById.get(String(b));
    if (!start || !end) return;
    const p1 = toScreen(start);
    const p2 = toScreen(end);
    context.beginPath();
    context.moveTo(p1.x, p1.y);
    context.lineTo(p2.x, p2.y);
    context.stroke();
  });
  context.restore();

  context.save();
  const nodes = treeData.nodes;
  nodes.forEach((node) => {
    const isInRoute = routeIdSet.has(String(node.id));
    const position = toScreen(node);
    const routeIndex = isInRoute ? routeIds.indexOf(String(node.id)) : -1;
    const isCompleted = isInRoute && routeIndex >= 0 && routeIndex < completedCount;
    const isCurrent = isInRoute && routeIndex === completedCount && completedCount < routeOrdered.length;
    const radius = Math.max(5, Number(node.size || 14) * 0.5);

    context.beginPath();
    context.fillStyle = isCurrent
      ? 'var(--node-current)'
      : isCompleted
        ? 'var(--node-complete)'
        : isInRoute
          ? 'var(--node-route)'
          : 'var(--node)';
    context.strokeStyle = isCurrent
      ? 'rgba(255, 202, 58, 0.95)'
      : isCompleted
        ? 'rgba(124, 248, 128, 0.95)'
        : isInRoute
          ? 'rgba(180,255,180,0.95)'
          : 'rgba(255,255,255,0.38)';
    context.lineWidth = isCurrent ? 2.8 : isInRoute ? 2 : 1;
    context.arc(position.x, position.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  });
  context.restore();

  context.save();
  context.fillStyle = 'white';
  context.strokeStyle = 'rgba(0,0,0,0.45)';
  context.lineWidth = 1.4;
  context.font = '11px Consolas, Menlo, monospace';
  routeOrdered.forEach((node, index) => {
    const treeNode = indexById.get(String(node.id));
    if (!treeNode) return;
    const position = toScreen(treeNode);
    const radius = Math.max(7, Number(treeNode.size || 14) * 0.6);
    const label = `#${index + 1}`;
    context.beginPath();
    const isCurrent = index === completedCount && completedCount < routeOrdered.length;
    const isCompleted = index < completedCount;
    context.fillStyle = isCurrent
      ? 'var(--node-current)'
      : isCompleted
        ? 'var(--node-complete)'
        : 'var(--node-active)';
    context.arc(position.x, position.y, radius + 4, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = '#021';
    context.textAlign = 'center';
    context.fillText(label, position.x, position.y + 4);
  });
  context.restore();
}

window.electronAPI?.onOverlayUpdate((payload) => {
  latestPayload = payload || {};
  if (!latestPayload.routeNodes) latestPayload.routeNodes = [];
  resize();
});

window.addEventListener('resize', resize);
resize();
