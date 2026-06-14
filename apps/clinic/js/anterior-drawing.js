/**
 * Cornea Clinic — anterior segment drawing studio
 * Phase 1 extraction from Cornea.html
 */
// ========== ANTERIOR DRAWING STUDIO ==========
const DRAW_NS = 'http://www.w3.org/2000/svg';
const DRAWING_SKETCH_FILE = 'Anterior segment sketch.png';
const DRAWING_CANVAS_W = 1400;
const DRAWING_CANVAS_H = 900;
const DRAWING_PNG_SCALE = 2;
const drawingState = {
    ready: false,
    sketchDataUrl: null,
    sketchLoadPromise: null,
    svg: null,
    viewport: null,
    baseLayer: null,
    drawLayer: null,
    selectionLayer: null,
    gridRect: null,
    tool: 'select',
    stroke: '#c62828',
    fill: '#000000',
    strokeWidth: 3,
    opacity: 1,
    gridOn: true,
    snapOn: false,
    zoom: 1,
    panX: 0,
    panY: 0,
    selected: null,
    dragging: false,
    interaction: null,
    drawStart: null,
    current: null,
    freePts: [],
    markerCounter: 1
};

function initAnteriorDrawingStudio() {
    const svg = document.getElementById('anteriorDrawingSvg');
    if (!svg) return;
    drawingState.svg = svg;
    drawingState.viewport = document.getElementById('drawingViewport');
    drawingState.baseLayer = document.getElementById('drawingBaseLayer');
    drawingState.drawLayer = document.getElementById('drawingLayer');
    drawingState.selectionLayer = document.getElementById('drawingSelectionLayer');
    drawingState.gridRect = document.getElementById('drawingGridRect');
    if (!drawingState.ready) {
        setupDrawingBaseSchematics();
        svg.addEventListener('pointerdown', onDrawingPointerDown);
        svg.addEventListener('pointermove', onDrawingPointerMove);
        svg.addEventListener('pointerup', onDrawingPointerUp);
        svg.addEventListener('pointerleave', onDrawingPointerUp);
        drawingState.ready = true;
    }
    drawingApplyView();
}

function getSketchPlacement(naturalW, naturalH) {
    const scale = Math.min((DRAWING_CANVAS_W - 40) / naturalW, (DRAWING_CANVAS_H - 80) / naturalH);
    const w = naturalW * scale;
    const h = naturalH * scale;
    return {
        x: (DRAWING_CANVAS_W - w) / 2,
        y: (DRAWING_CANVAS_H - h) / 2,
        w,
        h
    };
}

function placeAnteriorSegmentSketch(href, naturalW, naturalH) {
    const base = drawingState.baseLayer;
    if (!base || !naturalW || !naturalH) return;
    const sketchHref = (drawingState.sketchDataUrl && String(drawingState.sketchDataUrl).startsWith('data:'))
        ? drawingState.sketchDataUrl
        : (String(href).startsWith('data:') ? href : drawingState.sketchDataUrl || href);
    const { x, y, w, h } = getSketchPlacement(naturalW, naturalH);
    const img = createSvg('image', {
        id: 'anteriorSegmentSketch',
        href: sketchHref,
        x,
        y,
        width: w,
        height: h,
        preserveAspectRatio: 'xMidYMid meet',
        'pointer-events': 'none'
    });
    if (String(sketchHref).startsWith('data:')) {
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', sketchHref);
    }
    base.innerHTML = '';
    base.appendChild(img);
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

function normalizeSketchHrefInLayer(layerRoot) {
    if (!layerRoot || !drawingState.sketchDataUrl || !String(drawingState.sketchDataUrl).startsWith('data:')) return;
    const el = layerRoot.querySelector ? layerRoot.querySelector('#anteriorSegmentSketch') : null;
    if (!el) return;
    el.setAttribute('href', drawingState.sketchDataUrl);
    el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', drawingState.sketchDataUrl);
}

function ensureSketchDataUrlInBaseLayer() {
    normalizeSketchHrefInLayer(drawingState.baseLayer);
}

function getEmbeddedDrawingSketchDataUrl() {
    const embedded = typeof window !== 'undefined' ? window.DRAWING_SKETCH_EMBEDDED : '';
    return (embedded && String(embedded).startsWith('data:')) ? embedded : '';
}

function preloadDrawingSketch() {
    if (drawingState.sketchDataUrl && String(drawingState.sketchDataUrl).startsWith('data:')) {
        return Promise.resolve(drawingState.sketchDataUrl);
    }
    const embedded = getEmbeddedDrawingSketchDataUrl();
    if (embedded) {
        drawingState.sketchDataUrl = embedded;
        return Promise.resolve(embedded);
    }
    if (drawingState.sketchLoadPromise) return drawingState.sketchLoadPromise;
    drawingState.sketchLoadPromise = fetch(DRAWING_SKETCH_FILE)
        .then((res) => {
            if (!res.ok) throw new Error('sketch fetch failed');
            return res.blob();
        })
        .then((blob) => blobToDataUrl(blob))
        .then((dataUrl) => {
            drawingState.sketchDataUrl = dataUrl;
            return dataUrl;
        })
        .catch(() => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = img.naturalWidth;
                    c.height = img.naturalHeight;
                    c.getContext('2d').drawImage(img, 0, 0);
                    drawingState.sketchDataUrl = c.toDataURL('image/png');
                } catch (_) {
                    drawingState.sketchDataUrl = null;
                }
                resolve(drawingState.sketchDataUrl);
            };
            img.onerror = () => resolve(null);
            img.src = DRAWING_SKETCH_FILE;
        }));
    return drawingState.sketchLoadPromise;
}

function setupDrawingBaseSchematics() {
    const base = drawingState.baseLayer;
    if (!base || base.querySelector('#anteriorSegmentSketch')) return;
    preloadDrawingSketch().then((src) => {
        if (!src || !String(src).startsWith('data:')) {
            base.innerHTML = `<text x="${DRAWING_CANVAS_W / 2}" y="${DRAWING_CANVAS_H / 2}" text-anchor="middle" fill="#60778d" font-size="18">Could not load ${DRAWING_SKETCH_FILE}</text>`;
            return;
        }
        const img = new Image();
        img.onload = () => placeAnteriorSegmentSketch(src, img.naturalWidth, img.naturalHeight);
        img.onerror = () => {
            base.innerHTML = `<text x="${DRAWING_CANVAS_W / 2}" y="${DRAWING_CANVAS_H / 2}" text-anchor="middle" fill="#60778d" font-size="18">Could not load ${DRAWING_SKETCH_FILE}</text>`;
        };
        img.src = src;
    });
}

function restoreDrawingBaseLayerFromSaved(d) {
    const base = drawingState.baseLayer;
    if (!base || !d) return;
    if (d.sketchDataUrl && String(d.sketchDataUrl).startsWith('data:')) {
        drawingState.sketchDataUrl = d.sketchDataUrl;
    }
    if (d.baseLayer) {
        base.innerHTML = d.baseLayer;
        normalizeSketchHrefInLayer(base);
        return;
    }
    if (drawingState.sketchDataUrl && String(drawingState.sketchDataUrl).startsWith('data:')) {
        const img = new Image();
        img.onload = () => placeAnteriorSegmentSketch(drawingState.sketchDataUrl, img.naturalWidth, img.naturalHeight);
        img.src = drawingState.sketchDataUrl;
    }
}

function getSketchRectOnCanvas() {
    const el = drawingState.baseLayer?.querySelector('#anteriorSegmentSketch');
    if (el) {
        return {
            x: parseFloat(el.getAttribute('x')) || 0,
            y: parseFloat(el.getAttribute('y')) || 0,
            w: parseFloat(el.getAttribute('width')) || 0,
            h: parseFloat(el.getAttribute('height')) || 0
        };
    }
    return null;
}

function drawSketchOntoCanvas(ctx, sketchImg, scale) {
    let rect = getSketchRectOnCanvas();
    if (!rect || !rect.w) {
        rect = getSketchPlacement(sketchImg.naturalWidth, sketchImg.naturalHeight);
    }
    const vp = drawingState.viewport;
    if (vp && typeof vp.getCTM === 'function') {
        const m = vp.getCTM();
        ctx.save();
        ctx.scale(scale, scale);
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
        ctx.drawImage(sketchImg, rect.x, rect.y, rect.w, rect.h);
        ctx.restore();
    } else {
        ctx.drawImage(sketchImg, rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
    }
}

function drawingStatus(msg) {
    const el = document.getElementById('drawingStatus');
    if (el) el.textContent = msg;
}

function setDrawingTool(tool) {
    drawingState.tool = tool;
    document.querySelectorAll('#drawToolButtons .draw-btn, .draw-leftbar .draw-tool-grid .draw-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    if (drawingState.svg) {
        drawingState.svg.style.cursor = tool === 'pan' ? 'grab' : (tool === 'select' ? 'default' : 'crosshair');
    }
    drawingStatus('Tool: ' + tool);
}

function drawingSetStrokeWidth(v) { drawingState.strokeWidth = parseFloat(v) || 1; }
function drawingSetOpacity(v) { drawingState.opacity = Math.max(0.05, Math.min(1, parseFloat(v) || 1)); }
function drawingSetColor(v) { drawingState.stroke = v; if (drawingState.selected) drawingState.selected.setAttribute('stroke', v); }
function drawingSetFillColor(v) { drawingState.fill = v; if (drawingState.selected) drawingState.selected.setAttribute('fill', v); }
function drawingToggleGrid(on) { drawingState.gridOn = !!on; if (drawingState.gridRect) drawingState.gridRect.style.display = on ? '' : 'none'; }
function drawingToggleSnap(on) { drawingState.snapOn = !!on; }

function svgPoint(evt) {
    const pt = drawingState.svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const p = pt.matrixTransform(drawingState.svg.getScreenCTM().inverse());
    return snapPoint(p);
}

function snapPoint(p) {
    if (!drawingState.snapOn) return p;
    const g = 20;
    return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g };
}

function createSvg(tag, attrs = {}) {
    const el = document.createElementNS(DRAW_NS, tag);
    Object.keys(attrs).forEach(k => el.setAttribute(k, attrs[k]));
    return el;
}

function applyStyle(el, mode) {
    const cfg = {
        pen: { w: drawingState.strokeWidth, o: 1 },
        pencil: { w: Math.max(1, drawingState.strokeWidth * 0.7), o: 0.8 },
        marker: { w: Math.max(4, drawingState.strokeWidth * 2), o: 0.8 },
        highlighter: { w: Math.max(10, drawingState.strokeWidth * 3), o: 0.35 },
        spray: { w: drawingState.strokeWidth, o: 0.35 },
        freeform: { w: drawingState.strokeWidth, o: drawingState.opacity }
    }[mode] || { w: drawingState.strokeWidth, o: drawingState.opacity };
    el.setAttribute('stroke', drawingState.stroke);
    el.setAttribute('stroke-width', cfg.w);
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('opacity', cfg.o);
}

function onDrawingPointerDown(evt) {
    if (!drawingState.ready) return;
    const p = svgPoint(evt);
    drawingState.drawStart = p;
    drawingState.dragging = true;
    const t = drawingState.tool;

    const handle = evt.target.closest('[data-resize-handle], [data-rotate-handle]');
    if (handle && drawingState.selected) {
        const bb = drawingState.selected.getBBox();
        const cx = bb.x + bb.width / 2;
        const cy = bb.y + bb.height / 2;
        const startTransform = drawingState.selected.getAttribute('transform') || '';
        if (handle.dataset.rotateHandle === '1') {
            drawingState.interaction = {
                kind: 'rotate',
                start: p,
                center: { x: cx, y: cy },
                startTransform
            };
        } else {
            const h = handle.dataset.resizeHandle;
            const anchors = {
                nw: { x: bb.x + bb.width, y: bb.y + bb.height },
                n:  { x: bb.x + bb.width / 2, y: bb.y + bb.height },
                ne: { x: bb.x, y: bb.y + bb.height },
                e:  { x: bb.x, y: bb.y + bb.height / 2 },
                se: { x: bb.x, y: bb.y },
                s:  { x: bb.x + bb.width / 2, y: bb.y },
                sw: { x: bb.x + bb.width, y: bb.y },
                w:  { x: bb.x + bb.width, y: bb.y + bb.height / 2 }
            };
            drawingState.interaction = {
                kind: 'resize',
                handle: h,
                start: p,
                bbox: bb,
                anchor: anchors[h] || { x: cx, y: cy },
                startTransform
            };
        }
        return;
    }

    if (t === 'select') {
        const target = evt.target.closest('#drawingLayer > *, #drawingLayer > g');
        setSelectedDrawingObject(target || null);
        if (target) target.dataset.dragStart = JSON.stringify({ x: p.x, y: p.y });
        return;
    }
    if (t === 'pan') return;
    if (t === 'eraser') {
        const hit = evt.target.closest('#drawingLayer > *, #drawingLayer > g');
        if (hit) hit.remove();
        return;
    }
    if (['pen', 'pencil', 'marker', 'highlighter', 'freeform'].includes(t)) {
        drawingState.freePts = [p];
        const path = createSvg('path', { d: `M ${p.x} ${p.y}`, fill: 'none' });
        applyStyle(path, t);
        drawingState.drawLayer.appendChild(path);
        drawingState.current = path;
        return;
    }
    if (t === 'spray') {
        const g = createSvg('g', {});
        drawingState.drawLayer.appendChild(g);
        drawingState.current = g;
        sprayAt(p, g);
        return;
    }
    drawingState.current = createShapeAtStart(t, p);
}

function onDrawingPointerMove(evt) {
    if (!drawingState.dragging || !drawingState.ready) return;
    const p = svgPoint(evt);
    const t = drawingState.tool;
    if (drawingState.interaction && drawingState.selected) {
        if (drawingState.interaction.kind === 'rotate') {
            const c = drawingState.interaction.center;
            const a0 = Math.atan2(drawingState.interaction.start.y - c.y, drawingState.interaction.start.x - c.x);
            const a1 = Math.atan2(p.y - c.y, p.x - c.x);
            let deg = ((a1 - a0) * 180) / Math.PI;
            if (evt.shiftKey) deg = Math.round(deg / 15) * 15;
            drawingState.selected.setAttribute('transform',
                `${drawingState.interaction.startTransform} rotate(${deg} ${c.x} ${c.y})`.trim()
            );
            drawingStatus(`Rotate ${Math.round(deg)}°${evt.shiftKey ? ' (snap 15°)' : ''}`);
            setSelectedDrawingObject(drawingState.selected);
            return;
        }
        if (drawingState.interaction.kind === 'resize') {
            const i = drawingState.interaction;
            const bb = i.bbox;
            const minSize = 8;
            const dx = p.x - i.start.x;
            const dy = p.y - i.start.y;
            let sx = 1, sy = 1;
            if (/[ew]/.test(i.handle)) {
                const w = Math.max(minSize, bb.width + (i.handle.includes('w') ? -dx : dx));
                sx = w / Math.max(minSize, bb.width);
            }
            if (/[ns]/.test(i.handle)) {
                const h = Math.max(minSize, bb.height + (i.handle.includes('n') ? -dy : dy));
                sy = h / Math.max(minSize, bb.height);
            }
            if (i.handle === 'n' || i.handle === 's') sx = 1;
            if (i.handle === 'e' || i.handle === 'w') sy = 1;
            if (evt.shiftKey) {
                const uni = Math.max(sx, sy);
                sx = uni;
                sy = uni;
            }
            let anchorX = i.anchor.x, anchorY = i.anchor.y;
            if (evt.altKey) {
                anchorX = bb.x + bb.width / 2;
                anchorY = bb.y + bb.height / 2;
            }
            drawingState.selected.setAttribute('transform',
                `${i.startTransform} translate(${anchorX} ${anchorY}) scale(${sx} ${sy}) translate(${-anchorX} ${-anchorY})`.trim()
            );
            drawingStatus(`Resize ${Math.round(sx * 100)}% × ${Math.round(sy * 100)}%${evt.shiftKey ? ' (locked)' : ''}${evt.altKey ? ' (from center)' : ''}`);
            setSelectedDrawingObject(drawingState.selected);
            return;
        }
    }
    if (t === 'select' && drawingState.selected && drawingState.selected.dataset.dragStart) {
        const s = JSON.parse(drawingState.selected.dataset.dragStart);
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        moveElementBy(drawingState.selected, dx, dy);
        drawingState.selected.dataset.dragStart = JSON.stringify({ x: p.x, y: p.y });
        return;
    }
    if (t === 'pan') {
        const s = drawingState.drawStart;
        drawingState.panX += (p.x - s.x);
        drawingState.panY += (p.y - s.y);
        drawingState.drawStart = p;
        drawingApplyView();
        return;
    }
    if (t === 'eraser') {
        const hit = evt.target.closest('#drawingLayer > *, #drawingLayer > g');
        if (hit) hit.remove();
        return;
    }
    if (['pen', 'pencil', 'marker', 'highlighter', 'freeform'].includes(t) && drawingState.current) {
        drawingState.freePts.push(p);
        drawingState.current.setAttribute('d', pointsToPath(drawingState.freePts));
        return;
    }
    if (t === 'spray' && drawingState.current) {
        sprayAt(p, drawingState.current);
        return;
    }
    if (drawingState.current) updateShapePreview(drawingState.current, t, drawingState.drawStart, p);
}

function onDrawingPointerUp(evt) {
    if (!drawingState.ready) return;
    const p = svgPoint(evt);
    const t = drawingState.tool;
    if (drawingState.current && ['text', 'note', 'markerNum', 'callout'].includes(t)) {
        finishPointTool(t, p);
    }
    if (drawingState.current && drawingState.current.tagName !== 'g') {
        drawingState.current.removeAttribute('data-preview');
    }
    if (drawingState.selected) delete drawingState.selected.dataset.dragStart;
    drawingState.interaction = null;
    drawingState.current = null;
    drawingState.dragging = false;
    drawingStatus('Tool: ' + drawingState.tool);
}

function pointsToPath(pts) {
    if (!pts.length) return '';
    return 'M ' + pts.map(p => `${p.x} ${p.y}`).join(' L ');
}

function sprayAt(p, g) {
    for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * (drawingState.strokeWidth * 3 + 10);
        const cx = p.x + Math.cos(a) * r;
        const cy = p.y + Math.sin(a) * r;
        const dot = createSvg('circle', { cx, cy, r: Math.max(0.7, drawingState.strokeWidth / 4), fill: drawingState.stroke, opacity: 0.25 * drawingState.opacity });
        g.appendChild(dot);
    }
}

function createShapeAtStart(tool, p) {
    let el = null;
    if (tool === 'rect' || tool === 'roundrect') el = createSvg('rect', { x: p.x, y: p.y, width: 1, height: 1, fill: 'none' });
    else if (tool === 'circle') el = createSvg('circle', { cx: p.x, cy: p.y, r: 1, fill: 'none' });
    else if (tool === 'ellipse') el = createSvg('ellipse', { cx: p.x, cy: p.y, rx: 1, ry: 1, fill: 'none' });
    else if (tool === 'line' || tool === 'arrow' || tool === 'doublearrow' || tool === 'ruler' || tool === 'callout') el = createSvg('line', { x1: p.x, y1: p.y, x2: p.x + 1, y2: p.y + 1, fill: 'none' });
    else if (tool === 'triangle' || tool === 'polygon') el = createSvg('polygon', { points: `${p.x},${p.y} ${p.x + 1},${p.y + 1} ${p.x + 2},${p.y + 2}`, fill: 'none' });
    else if (tool === 'text' || tool === 'note' || tool === 'markerNum') {
        el = createSvg('g', {});
    } else return null;
    if (tool === 'roundrect' && el.tagName === 'rect') { el.setAttribute('rx', 16); el.setAttribute('ry', 16); }
    applyStyle(el, tool);
    if (tool === 'arrow' || tool === 'callout' || tool === 'ruler') el.setAttribute('marker-end', 'url(#arrowHead)');
    if (tool === 'doublearrow') { el.setAttribute('marker-end', 'url(#arrowHead)'); el.setAttribute('marker-start', 'url(#arrowHead)'); }
    drawingState.drawLayer.appendChild(el);
    return el;
}

function updateShapePreview(el, tool, s, p) {
    if (el.tagName === 'rect') {
        el.setAttribute('x', Math.min(s.x, p.x));
        el.setAttribute('y', Math.min(s.y, p.y));
        el.setAttribute('width', Math.abs(p.x - s.x));
        el.setAttribute('height', Math.abs(p.y - s.y));
        if (tool !== 'rect' && tool !== 'roundrect') el.setAttribute('fill', drawingState.fill);
    } else if (el.tagName === 'circle') {
        const r = Math.hypot(p.x - s.x, p.y - s.y);
        el.setAttribute('r', r);
    } else if (el.tagName === 'ellipse') {
        el.setAttribute('cx', (s.x + p.x) / 2);
        el.setAttribute('cy', (s.y + p.y) / 2);
        el.setAttribute('rx', Math.abs(p.x - s.x) / 2);
        el.setAttribute('ry', Math.abs(p.y - s.y) / 2);
    } else if (el.tagName === 'line') {
        el.setAttribute('x1', s.x); el.setAttribute('y1', s.y); el.setAttribute('x2', p.x); el.setAttribute('y2', p.y);
    } else if (el.tagName === 'polygon') {
        if (tool === 'triangle') {
            const points = `${s.x},${p.y} ${(s.x + p.x) / 2},${s.y} ${p.x},${p.y}`;
            el.setAttribute('points', points);
        } else {
            const cx = (s.x + p.x) / 2, cy = (s.y + p.y) / 2;
            const rx = Math.abs(p.x - s.x) / 2, ry = Math.abs(p.y - s.y) / 2;
            const pts = [];
            for (let i = 0; i < 6; i++) {
                const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                pts.push(`${cx + rx * Math.cos(a)},${cy + ry * Math.sin(a)}`);
            }
            el.setAttribute('points', pts.join(' '));
        }
    }
}

function finishPointTool(tool, p) {
    const g = drawingState.current;
    if (!g) return;
    const askText = (label, def = '') => prompt(label, def) || '';
    if (tool === 'text') {
        const txt = askText('Text label:', 'Label');
        if (!txt.trim()) { g.remove(); return; }
        const t = createSvg('text', { x: p.x, y: p.y, fill: drawingState.stroke, 'font-size': 22, 'font-family': 'Sora, sans-serif' });
        t.textContent = txt;
        g.appendChild(t);
    } else if (tool === 'markerNum') {
        const num = askText('Marker number:', String(drawingState.markerCounter++));
        const c = createSvg('circle', { cx: p.x, cy: p.y, r: 18, fill: '#fff', stroke: drawingState.stroke, 'stroke-width': 2 });
        const t = createSvg('text', { x: p.x, y: p.y + 7, fill: drawingState.stroke, 'font-size': 18, 'font-weight': 700, 'text-anchor': 'middle', 'font-family': 'Sora, sans-serif' });
        t.textContent = num || '?';
        g.appendChild(c); g.appendChild(t);
    } else if (tool === 'note') {
        const note = askText('Point note:', 'Note');
        if (!note.trim()) { g.remove(); return; }
        const c = createSvg('circle', { cx: p.x, cy: p.y, r: 6, fill: drawingState.stroke });
        const line = createSvg('line', { x1: p.x, y1: p.y, x2: p.x + 70, y2: p.y - 40, stroke: drawingState.stroke, 'stroke-width': 2 });
        const box = createSvg('rect', { x: p.x + 66, y: p.y - 70, width: 190, height: 42, rx: 6, ry: 6, fill: '#fffbe6', stroke: drawingState.stroke, 'stroke-width': 1.5 });
        const t = createSvg('text', { x: p.x + 74, y: p.y - 43, fill: '#1a2b3a', 'font-size': 14, 'font-family': 'Sora, sans-serif' });
        t.textContent = note;
        g.append(c, line, box, t);
    } else if (tool === 'callout') {
        const label = askText('Callout label:', 'Callout');
        const l = createSvg('line', { x1: p.x, y1: p.y, x2: p.x + 80, y2: p.y - 50, stroke: drawingState.stroke, 'stroke-width': 2, 'marker-end': 'url(#arrowHead)' });
        const t = createSvg('text', { x: p.x + 86, y: p.y - 52, fill: drawingState.stroke, 'font-size': 18, 'font-family': 'Sora, sans-serif' });
        t.textContent = label || 'Callout';
        g.append(l, t);
    }
}

function setSelectedDrawingObject(el) {
    drawingState.selected = el;
    drawingState.selectionLayer.innerHTML = '';
    if (!el) return;
    const bb = el.getBBox();
    const r = createSvg('rect', { x: bb.x - 6, y: bb.y - 6, width: bb.width + 12, height: bb.height + 12, fill: 'none', stroke: '#1565c0', 'stroke-dasharray': '6 4', 'stroke-width': 2 });
    drawingState.selectionLayer.appendChild(r);
    const handles = [
        ['nw', bb.x - 6, bb.y - 6],
        ['n', bb.x + bb.width / 2, bb.y - 6],
        ['ne', bb.x + bb.width + 6, bb.y - 6],
        ['e', bb.x + bb.width + 6, bb.y + bb.height / 2],
        ['se', bb.x + bb.width + 6, bb.y + bb.height + 6],
        ['s', bb.x + bb.width / 2, bb.y + bb.height + 6],
        ['sw', bb.x - 6, bb.y + bb.height + 6],
        ['w', bb.x - 6, bb.y + bb.height / 2]
    ];
    handles.forEach(([name, x, y]) => {
        const h = createSvg('rect', {
            x: x - 5, y: y - 5, width: 10, height: 10,
            fill: '#ffffff', stroke: '#1565c0', 'stroke-width': 1.6, rx: 2, ry: 2,
            'data-resize-handle': name, cursor: `${name}-resize`
        });
        drawingState.selectionLayer.appendChild(h);
    });
    const cx = bb.x + bb.width / 2;
    const rotateY = bb.y - 34;
    const link = createSvg('line', { x1: cx, y1: bb.y - 6, x2: cx, y2: rotateY + 10, stroke: '#1565c0', 'stroke-width': 1.2, 'stroke-dasharray': '4 3' });
    const rotateHandle = createSvg('circle', {
        cx, cy: rotateY, r: 8, fill: '#ffffff', stroke: '#1565c0', 'stroke-width': 1.8,
        'data-rotate-handle': '1', cursor: 'crosshair'
    });
    drawingState.selectionLayer.append(link, rotateHandle);
}

function moveElementBy(el, dx, dy) {
    const prev = el.getAttribute('transform') || '';
    const tr = ` translate(${dx},${dy})`;
    el.setAttribute('transform', (prev + tr).trim());
    setSelectedDrawingObject(el);
}

function drawingResizeSelected(scale) {
    const el = drawingState.selected;
    if (!el) return;
    const bb = el.getBBox();
    const cx = bb.x + bb.width / 2;
    const cy = bb.y + bb.height / 2;
    const prev = el.getAttribute('transform') || '';
    el.setAttribute('transform', `${prev} translate(${cx},${cy}) scale(${scale}) translate(${-cx},${-cy})`);
    setSelectedDrawingObject(el);
}

function drawingRotateSelected(deg) {
    const el = drawingState.selected;
    if (!el) return;
    const bb = el.getBBox();
    const cx = bb.x + bb.width / 2;
    const cy = bb.y + bb.height / 2;
    const prev = el.getAttribute('transform') || '';
    el.setAttribute('transform', `${prev} rotate(${deg} ${cx} ${cy})`);
    setSelectedDrawingObject(el);
}
function drawingDeleteSelected() { if (drawingState.selected) { drawingState.selected.remove(); setSelectedDrawingObject(null); } }
function drawingDuplicateSelected() { if (!drawingState.selected) return; const c = drawingState.selected.cloneNode(true); c.setAttribute('transform', ((c.getAttribute('transform') || '') + ' translate(18,18)').trim()); drawingState.drawLayer.appendChild(c); setSelectedDrawingObject(c); }
function drawingBringForward() { const el = drawingState.selected; if (el && el.nextSibling) el.parentNode.insertBefore(el.nextSibling, el); }
function drawingSendBackward() { const el = drawingState.selected; if (el && el.previousSibling) el.parentNode.insertBefore(el, el.previousSibling); }

function drawingApplyView() {
    if (!drawingState.viewport) return;
    drawingState.viewport.setAttribute('transform', `translate(${drawingState.panX},${drawingState.panY}) scale(${drawingState.zoom})`);
}
function drawingZoom(mult) { drawingState.zoom = Math.max(0.2, Math.min(5, drawingState.zoom * mult)); drawingApplyView(); }
function drawingFit() { drawingState.zoom = 0.9; drawingState.panX = 0; drawingState.panY = 0; drawingApplyView(); }
function drawingResetView() { drawingState.zoom = 1; drawingState.panX = 0; drawingState.panY = 0; drawingApplyView(); }

function drawingSerialize() {
    ensureSketchDataUrlInBaseLayer();
    const drawHtml = drawingState.drawLayer ? drawingState.drawLayer.innerHTML : '';
    const baseHtml = drawingState.baseLayer ? drawingState.baseLayer.innerHTML : '';
    const sketchUrl = (drawingState.sketchDataUrl && String(drawingState.sketchDataUrl).startsWith('data:'))
        ? drawingState.sketchDataUrl
        : '';
    return JSON.stringify({
        drawLayer: drawHtml,
        baseLayer: baseHtml,
        sketchDataUrl: sketchUrl,
        zoom: drawingState.zoom, panX: drawingState.panX, panY: drawingState.panY,
        markerCounter: drawingState.markerCounter
    });
}
function drawingDeserialize(json) {
    try {
        if (!drawingState.drawLayer) return;
        const d = typeof json === 'string' ? JSON.parse(json) : json;
        restoreDrawingBaseLayerFromSaved(d);
        drawingState.drawLayer.innerHTML = d.drawLayer || '';
        drawingState.zoom = d.zoom || 1;
        drawingState.panX = d.panX || 0;
        drawingState.panY = d.panY || 0;
        drawingState.markerCounter = d.markerCounter || 1;
        drawingApplyView();
        setSelectedDrawingObject(null);
    } catch (_) {}
}

function drawingResetInternal() {
    if (drawingState.drawLayer) drawingState.drawLayer.innerHTML = '';
    setSelectedDrawingObject(null);
}

function drawingNewProject() {
    if (!confirm('Clear current drawing?')) return;
    drawingResetInternal();
}
function drawingSaveProjectJSON() {
    const blob = new Blob([drawingSerialize()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AnteriorDrawing_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}
function drawingLoadProjectJSON(input) {
    const file = input.files?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = e => drawingDeserialize(e.target.result || '{}');
    fr.readAsText(file);
    input.value = '';
}
function drawingExportSVG() {
    const svg = drawingState.svg.cloneNode(true);
    svg.querySelector('#drawingSelectionLayer')?.remove();
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `AnteriorDrawing_${new Date().toISOString().slice(0,10)}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
}
function drawingRasterizeToCanvas(scale, onReady) {
    let finished = false;
    const finish = (canvas) => {
        if (finished) return;
        finished = true;
        onReady(canvas);
    };

    const failSafe = setTimeout(() => {
        if (finished) return;
        const canvas = document.createElement('canvas');
        canvas.width = DRAWING_CANVAS_W * scale;
        canvas.height = DRAWING_CANVAS_H * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        finish(canvas);
    }, 12000);

    const wrapFinish = (canvas) => {
        clearTimeout(failSafe);
        finish(canvas);
    };

    if (!drawingState.drawLayer) {
        wrapFinish(document.createElement('canvas'));
        return;
    }

    preloadDrawingSketch().then(() => {
        if (!drawingState.baseLayer?.querySelector('#anteriorSegmentSketch')
            && drawingState.sketchDataUrl
            && String(drawingState.sketchDataUrl).startsWith('data:')) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    placeAnteriorSegmentSketch(drawingState.sketchDataUrl, img.naturalWidth, img.naturalHeight);
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = drawingState.sketchDataUrl;
            });
        }
    }).then(() => {
        const w = DRAWING_CANVAS_W * scale;
        const h = DRAWING_CANVAS_H * scale;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);

        try {
            const tmp = document.createElementNS(DRAW_NS, 'svg');
            tmp.setAttribute('xmlns', DRAW_NS);
            tmp.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
            tmp.setAttribute('viewBox', `0 0 ${DRAWING_CANVAS_W} ${DRAWING_CANVAS_H}`);
            tmp.setAttribute('width', String(DRAWING_CANVAS_W));
            tmp.setAttribute('height', String(DRAWING_CANVAS_H));
            if (drawingState.gridOn && drawingState.svg) {
                const defs = drawingState.svg.querySelector('defs');
                if (defs) tmp.appendChild(defs.cloneNode(true));
                const grid = drawingState.gridRect?.cloneNode(true);
                if (grid) tmp.appendChild(grid);
            }
            const vpG = document.createElementNS(DRAW_NS, 'g');
            const vpTransform = drawingState.viewport?.getAttribute('transform');
            if (vpTransform) vpG.setAttribute('transform', vpTransform);
            if (drawingState.baseLayer && drawingState.baseLayer.childNodes.length) {
                const baseClone = drawingState.baseLayer.cloneNode(true);
                normalizeSketchHrefInLayer(baseClone);
                vpG.appendChild(baseClone);
            }
            vpG.appendChild(drawingState.drawLayer.cloneNode(true));
            tmp.appendChild(vpG);
            const xml = new XMLSerializer().serializeToString(tmp);
            const overlay = new Image();
            let blobUrl = null;
            overlay.onload = () => {
                try {
                    ctx.drawImage(overlay, 0, 0, w, h);
                } catch (_) {}
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                wrapFinish(canvas);
            };
            overlay.onerror = () => {
                if (blobUrl) URL.revokeObjectURL(blobUrl);
                wrapFinish(canvas);
            };
            try {
                const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
                blobUrl = URL.createObjectURL(blob);
                overlay.src = blobUrl;
            } catch (_) {
                overlay.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
            }
        } catch (_) {
            wrapFinish(canvas);
        }
    }).catch(() => {
        const canvas = document.createElement('canvas');
        canvas.width = DRAWING_CANVAS_W * scale;
        canvas.height = DRAWING_CANVAS_H * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        wrapFinish(canvas);
    });
}

function drawingExportPNG() {
    drawingRasterizeToCanvas(DRAWING_PNG_SCALE, (c) => {
        const a = document.createElement('a');
        a.href = c.toDataURL('image/png');
        a.download = `AnteriorDrawing_${new Date().toISOString().slice(0,10)}.png`;
        a.click();
    });
}

function drawingToPngDataUrl(cb) {
    const scale = 1;
    drawingRasterizeToCanvas(scale, (c) => {
        try {
            cb(c.toDataURL('image/png'));
        } catch (err) {
            console.warn('[Drawing] PNG export failed:', err);
            cb('');
        }
    });
}

window.openAnteriorDrawingModal = function() {
    initAnteriorDrawingStudio();
    const json = document.getElementById('anteriorDrawingJSON')?.value || '';
    if (json) {
        drawingDeserialize(json);
        if (!drawingState.baseLayer?.querySelector('#anteriorSegmentSketch')) {
            setupDrawingBaseSchematics();
        }
    } else {
        drawingResetInternal();
    }
    openEmrModal('anteriorDrawingModal');
};

window.saveAnteriorDrawingToForm = function() {
    const saveBtn = document.querySelector('#anteriorDrawingModal .btn-primary');
    try {
        initAnteriorDrawingStudio();
        const jsonEl = document.getElementById('anteriorDrawingJSON');
        const imgEl = document.getElementById('anteriorDrawingImage');
        if (!jsonEl || !imgEl) {
            alert('Could not find drawing fields on the visit form.');
            return;
        }
        if (!drawingState.drawLayer) {
            alert('Drawing studio is not ready. Close and reopen the studio, then try again.');
            return;
        }
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving…';
        }
        preloadDrawingSketch().then(() => {
            ensureSketchDataUrlInBaseLayer();
            jsonEl.value = drawingSerialize();
            closeEmrModal('anteriorDrawingModal');
            renderAnteriorDrawingPreview();
            drawingToPngDataUrl((png) => {
            if (png) {
                try {
                    imgEl.value = png;
                } catch (err) {
                    console.warn('[Drawing] Preview image too large to store inline:', err);
                }
            }
            renderAnteriorDrawingPreview();
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Drawing';
            }
            });
        }).catch((err) => {
            console.error('[Drawing] Save failed:', err);
            alert('Could not save drawing: ' + (err.message || 'unknown error'));
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Drawing';
            }
        });
    } catch (err) {
        console.error('[Drawing] Save failed:', err);
        alert('Could not save drawing: ' + (err.message || 'unknown error'));
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Drawing';
        }
    }
};

function renderAnteriorDrawingPreview() {
    const img = document.getElementById('anteriorDrawingImage')?.value || '';
    const json = document.getElementById('anteriorDrawingJSON')?.value || '';
    const box = document.getElementById('anteriorDrawingPreview');
    if (!box) return;
    if (img) {
        box.classList.remove('empty');
        box.innerHTML = `<img src="${img}" alt="Anterior segment drawing preview">`;
        return;
    }
    if (json && json !== '{"drawLayer":"","zoom":1,"panX":0,"panY":0,"markerCounter":1}') {
        try {
            const parsed = JSON.parse(json);
            if (parsed.drawLayer && String(parsed.drawLayer).trim()) {
                box.classList.remove('empty');
                box.innerHTML = '<span style="color:var(--text-secondary);font-size:0.85rem;"><i class="fa-solid fa-check"></i> Drawing saved — reopen studio to edit or wait for preview.</span>';
                return;
            }
        } catch (_) {}
    }
    box.classList.add('empty');
    box.innerHTML = 'No drawing saved yet. Click "Open Drawing Studio" to create one.';
}

window.clearAnteriorDrawing = function() {
    if (!confirm('Clear saved drawing for this visit?')) return;
    const jsonEl = document.getElementById('anteriorDrawingJSON');
    const imgEl = document.getElementById('anteriorDrawingImage');
    if (jsonEl) jsonEl.value = '';
    if (imgEl) imgEl.value = '';
    renderAnteriorDrawingPreview();
};
if (typeof window !== 'undefined') {
  window.renderAnteriorDrawingPreview = renderAnteriorDrawingPreview;
  window.initAnteriorDrawingStudio = initAnteriorDrawingStudio;
  window.preloadDrawingSketch = preloadDrawingSketch;
}
