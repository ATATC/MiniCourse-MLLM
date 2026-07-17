/* Interactive VLM architecture plot — data-driven SVG with animated token flow.
   Mounts into #vlm-plot. No dependencies. */
(function () {
  var SVGNS = "http://www.w3.org/2000/svg";
  var ACCENT = "#2a6fdb", TEXTCLR = "#64748b", INK = "#19212e", SOFT = "#5a6675";

  // ---- architecture definitions ---------------------------------------
  // node: {x,y,w,h,kind:'io'|'frozen'|'trainable'|'seq', label, sub}
  // edge: {from,to,carries:'image'|'text'|'mixed', a,b}  (a/b = anchor side)
  var VB = [0, 0, 940, 300];
  var LAYOUTS = {
    llava: {
      title: "LLaVA-style — projection",
      note: "A small trainable projector maps vision features straight into the LLM's embedding space; the resulting visual tokens simply join the text sequence. Cheap to train — but every image spends real context length.",
      nodes: {
        img:  { x: 24,  y: 60,  w: 120, h: 52, kind: "io", label: "Image", sub: "" },
        venc: { x: 176, y: 60,  w: 132, h: 52, kind: "frozen", label: "Vision Encoder", sub: "frozen" },
        proj: { x: 340, y: 60,  w: 124, h: 52, kind: "trainable", label: "Projector", sub: "trainable" },
        txt:  { x: 24,  y: 188, w: 120, h: 52, kind: "io", label: "Text prompt", sub: "" },
        llm:  { x: 600, y: 124, w: 140, h: 52, kind: "trainable", label: "LLM Decoder", sub: "fine-tuned / LoRA" },
        out:  { x: 780, y: 124, w: 120, h: 52, kind: "io", label: "Text", sub: "" }
      },
      edges: [
        { from: "img", to: "venc", carries: "image" },
        { from: "venc", to: "proj", carries: "image" },
        { from: "proj", to: "llm", carries: "image", a: "right", b: "left" },
        { from: "txt", to: "llm", carries: "text", a: "right", b: "left" },
        { from: "llm", to: "out", carries: "text" }
      ]
    },
    blip2: {
      title: "BLIP-2-style — learned queries",
      note: "A Q-Former sits between two frozen models and squeezes visual features through a fixed set of 32 learned query tokens — a constant visual footprint no matter how large or detailed the image.",
      nodes: {
        img:  { x: 24,  y: 60,  w: 116, h: 52, kind: "io", label: "Image", sub: "" },
        venc: { x: 168, y: 60,  w: 128, h: 52, kind: "frozen", label: "Vision Encoder", sub: "frozen" },
        qf:   { x: 324, y: 60,  w: 120, h: 52, kind: "trainable", label: "Q-Former", sub: "32 queries" },
        vtok: { x: 472, y: 60,  w: 120, h: 52, kind: "io", label: "32 tokens", sub: "fixed length" },
        txt:  { x: 24,  y: 188, w: 120, h: 52, kind: "io", label: "Text prompt", sub: "" },
        llm:  { x: 656, y: 124, w: 140, h: 52, kind: "frozen", label: "LLM Decoder", sub: "frozen" },
        out:  { x: 812, y: 124, w: 104, h: 52, kind: "io", label: "Text", sub: "" }
      },
      edges: [
        { from: "img", to: "venc", carries: "image" },
        { from: "venc", to: "qf", carries: "image" },
        { from: "qf", to: "vtok", carries: "image" },
        { from: "vtok", to: "llm", carries: "image", a: "right", b: "left" },
        { from: "txt", to: "llm", carries: "text", a: "right", b: "left" },
        { from: "llm", to: "out", carries: "text" }
      ]
    },
    flamingo: {
      title: "Flamingo-style — gated cross-attention",
      note: "Vision never enters the text sequence. Text tokens are the queries into new gated cross-attention layers, which attend to resampled visual features (keys/values); the result flows on through the frozen LM blocks — great for many interleaved images without growing context.",
      nodes: {
        img:   { x: 24,  y: 34,  w: 128, h: 50, kind: "io", label: "Image / frames", sub: "" },
        venc:  { x: 186, y: 34,  w: 128, h: 50, kind: "frozen", label: "Vision Encoder", sub: "frozen" },
        resamp:{ x: 348, y: 34,  w: 156, h: 50, kind: "trainable", label: "Perceiver Resampler", sub: "trainable" },
        xattn: { x: 528, y: 128, w: 158, h: 52, kind: "trainable", label: "Gated cross-attn", sub: "×N, trainable" },
        txt:   { x: 24,  y: 214, w: 128, h: 50, kind: "io", label: "Text tokens", sub: "" },
        lmb:   { x: 528, y: 214, w: 158, h: 50, kind: "frozen", label: "Frozen LM block", sub: "×N, interleaved" },
        out:   { x: 748, y: 168, w: 120, h: 56, kind: "io", label: "Text", sub: "" }
      },
      edges: [
        { from: "img", to: "venc", carries: "image" },
        { from: "venc", to: "resamp", carries: "image" },
        { from: "resamp", to: "xattn", carries: "image", a: "bottom", b: "top" },
        { from: "txt", to: "xattn", carries: "text", a: "right", b: "left" },
        { from: "xattn", to: "lmb", carries: "mixed", a: "bottom", b: "top" },
        { from: "lmb", to: "out", carries: "text", a: "right", b: "left" }
      ]
    },
    kosmos: {
      title: "Kosmos-style — unified model",
      note: "No encoder/decoder split: image and text tokens share one embedding space and pass through a single transformer, trained jointly end-to-end. The most flexible — and most data-hungry — of the four.",
      nodes: {
        img:   { x: 24,  y: 60,  w: 132, h: 52, kind: "io", label: "Image patches", sub: "" },
        txt:   { x: 24,  y: 188, w: 132, h: 52, kind: "io", label: "Text tokens", sub: "" },
        embed: { x: 228, y: 124, w: 136, h: 52, kind: "trainable", label: "Shared embedding", sub: "" },
        useq:  { x: 400, y: 124, w: 152, h: 52, kind: "seq", label: "Interleaved sequence", sub: "" },
        unif:  { x: 588, y: 124, w: 170, h: 52, kind: "trainable", label: "Unified Transformer", sub: "×N, joint" },
        out:   { x: 794, y: 124, w: 122, h: 52, kind: "io", label: "Text / boxes", sub: "" }
      },
      edges: [
        { from: "img", to: "embed", carries: "image", a: "right", b: "left" },
        { from: "txt", to: "embed", carries: "text", a: "right", b: "left" },
        { from: "embed", to: "useq", carries: "mixed" },
        { from: "useq", to: "unif", carries: "mixed" },
        { from: "unif", to: "out", carries: "text" }
      ]
    }
  };
  var ORDER = ["llava", "blip2", "flamingo", "kosmos"];
  var LABELS = { llava: "LLaVA", blip2: "BLIP-2", flamingo: "Flamingo", kosmos: "Kosmos" };

  // ---- helpers ---------------------------------------------------------
  function el(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function anchor(n, side) {
    switch (side) {
      case "left": return [n.x, n.y + n.h / 2];
      case "right": return [n.x + n.w, n.y + n.h / 2];
      case "top": return [n.x + n.w / 2, n.y];
      case "bottom": return [n.x + n.w / 2, n.y + n.h];
    }
    return [n.x + n.w / 2, n.y + n.h / 2];
  }
  function normal(side) {
    return side === "left" ? [-1, 0] : side === "right" ? [1, 0]
      : side === "top" ? [0, -1] : [0, 1];
  }
  function pathD(p0, nA, p1, nB) {
    var dx = p1[0] - p0[0], dy = p1[1] - p0[1];
    var dist = Math.sqrt(dx * dx + dy * dy);
    var c = Math.max(30, Math.min(90, dist * 0.42));
    var c1 = [p0[0] + nA[0] * c, p0[1] + nA[1] * c];
    var c2 = [p1[0] + nB[0] * c, p1[1] + nB[1] * c];
    return "M" + p0[0] + "," + p0[1] + " C" + c1[0] + "," + c1[1] + " " + c2[0] + "," + c2[1] + " " + p1[0] + "," + p1[1];
  }

  var NODE_STYLE = {
    io:        { fill: "#fbfcfe", stroke: "#b9c4d4", dash: "5 4", tw: 700 },
    frozen:    { fill: "#ffffff", stroke: "#c8d2e0", dash: "", tw: 700 },
    trainable: { fill: "#eef3fd", stroke: "#8fb0ea", dash: "", tw: 800 },
    seq:       { fill: "#f4f6fa", stroke: "#c8d2e0", dash: "", tw: 700 }
  };

  function buildStage(key) {
    var L = LAYOUTS[key];
    var svg = el("svg", {
      viewBox: VB.join(" "), class: "vlm-svg",
      preserveAspectRatio: "xMidYMid meet"
    });
    var gEdges = el("g", {}), gParticles = el("g", {}), gNodes = el("g", {});
    var particles = [];

    L.edges.forEach(function (ed) {
      var na = L.nodes[ed.from], nb = L.nodes[ed.to];
      var sa = ed.a || "right", sb = ed.b || "left";
      var p0 = anchor(na, sa), p1 = anchor(nb, sb);
      var d = pathD(p0, normal(sa), p1, normal(sb));
      var stroke = ed.carries === "text" ? "#c3ccd9" : ed.carries === "image" ? "#b7cbef" : "#cbd3df";
      gEdges.appendChild(el("path", { d: d, fill: "none", stroke: stroke, "stroke-width": 2 }));
      // measurement path
      var mp = el("path", { d: d, fill: "none", stroke: "none" });
      gEdges.appendChild(mp);
      var len = mp.getTotalLength ? mp.getTotalLength() : 0;
      var kinds = ed.carries === "mixed" ? ["image", "text", "image", "text"]
        : ed.carries === "image" ? ["image", "image", "image"] : ["text", "text", "text"];
      kinds.forEach(function (kind, i) {
        var c = el("circle", {
          r: kind === "image" ? 4.3 : 3.6,
          fill: kind === "image" ? ACCENT : TEXTCLR,
          opacity: 0.9
        });
        gParticles.appendChild(c);
        particles.push({ el: c, path: mp, len: len, phase: i / kinds.length });
      });
    });

    Object.keys(L.nodes).forEach(function (id) {
      var n = L.nodes[id], st = NODE_STYLE[n.kind];
      var g = el("g", {});
      g.appendChild(el("rect", {
        x: n.x, y: n.y, width: n.w, height: n.h, rx: 9,
        fill: st.fill, stroke: st.stroke, "stroke-width": 1.6,
        "stroke-dasharray": st.dash
      }));
      var cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      var hasSub = n.sub && n.sub.length;
      var t1 = el("text", {
        x: cx, y: hasSub ? cy - 3 : cy + 1, "text-anchor": "middle",
        "dominant-baseline": "middle", "font-size": 13.5,
        "font-weight": st.tw, "font-family": "'Lato',sans-serif",
        fill: n.kind === "trainable" ? "#1d54ab" : INK
      }, n.label);
      g.appendChild(t1);
      if (hasSub) {
        g.appendChild(el("text", {
          x: cx, y: cy + 14, "text-anchor": "middle", "dominant-baseline": "middle",
          "font-size": 10.5, "font-family": "'Lato',sans-serif", fill: SOFT
        }, n.sub));
      }
      gNodes.appendChild(g);
    });

    svg.appendChild(gEdges);
    svg.appendChild(gNodes);
    svg.appendChild(gParticles);
    return { svg: svg, particles: particles, note: L.note };
  }

  // ---- mount -----------------------------------------------------------
  function mount(root) {
    root.classList.add("vlm-demo");
    root.innerHTML = "";

    var tabs = document.createElement("div");
    tabs.className = "vlm-tabs";
    var tabBtns = {};
    ORDER.forEach(function (k) {
      var b = document.createElement("button");
      b.className = "vlm-tab"; b.type = "button"; b.textContent = LABELS[k];
      b.addEventListener("click", function () { select(k); });
      tabs.appendChild(b); tabBtns[k] = b;
    });
    var play = document.createElement("button");
    play.className = "vlm-tab vlm-play"; play.type = "button";
    tabs.appendChild(play);
    root.appendChild(tabs);

    var legend = document.createElement("div");
    legend.className = "vlm-legend";
    legend.innerHTML =
      '<span><i class="vlm-dot" style="background:' + ACCENT + '"></i>vision tokens</span>' +
      '<span><i class="vlm-dot" style="background:' + TEXTCLR + '"></i>text tokens</span>' +
      '<span><i class="vlm-swatch trainable"></i>trained / tunable</span>' +
      '<span><i class="vlm-swatch frozen"></i>frozen</span>';
    root.appendChild(legend);

    var stageWrap = document.createElement("div");
    stageWrap.className = "vlm-stage";
    root.appendChild(stageWrap);

    var caption = document.createElement("p");
    caption.className = "vlm-note";
    root.appendChild(caption);

    // pre-build all stages
    var stages = {};
    ORDER.forEach(function (k) { stages[k] = buildStage(k); });

    var current = "llava", playing = true, raf = null, t0 = null;

    function renderPlay() { play.textContent = playing ? "❚❚ Pause" : "▶ Play"; }

    function select(k) {
      current = k;
      ORDER.forEach(function (kk) { tabBtns[kk].classList.toggle("active", kk === k); });
      stageWrap.innerHTML = "";
      stageWrap.appendChild(stages[k].svg);
      caption.innerHTML = stages[k].note;
    }

    function frame(ts) {
      if (t0 == null) t0 = ts;
      var elapsed = (ts - t0) / 1000;
      var st = stages[current];
      st.particles.forEach(function (p) {
        if (!p.len) return;
        var u = (elapsed * 0.16 + p.phase) % 1;
        var pt = p.path.getPointAtLength(u * p.len);
        p.el.setAttribute("cx", pt.x);
        p.el.setAttribute("cy", pt.y);
        var fade = u < 0.08 ? u / 0.08 : u > 0.92 ? (1 - u) / 0.08 : 1;
        p.el.setAttribute("opacity", 0.9 * fade);
      });
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) { t0 = null; raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

    play.addEventListener("click", function () {
      playing = !playing; renderPlay();
      if (playing) start(); else stop();
    });

    select("llava");
    renderPlay();
    start();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.getElementById("vlm-plot");
    if (root) mount(root);
  });
})();
