(() => {
  "use strict";
  const nav = document.querySelector(".navigation");
  const menu = document.querySelector(".menu-toggle");
  const closeMenu = () => { nav?.classList.remove("menu-open"); menu?.setAttribute("aria-expanded", "false"); menu?.setAttribute("aria-label", "Open navigation"); };
  menu?.addEventListener("click", () => {
    const open = nav?.classList.toggle("menu-open") ?? false;
    menu.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  });
  document.querySelectorAll(".nav-links a").forEach(link => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", event => { if (event.key === "Escape" && nav?.classList.contains("menu-open")) { closeMenu(); menu?.focus(); } });

  const tabs = [...document.querySelectorAll("[data-workflow]")];
  const activateTab = tab => {
    tabs.forEach(item => {
      const active = item === tab;
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById(item.getAttribute("aria-controls"))?.toggleAttribute("hidden", !active);
    });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", event => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft") next = (index + tabs.length - 1) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault(); activateTab(tabs[next]); tabs[next].focus();
    });
  });

  const dialog = document.getElementById("capture-dialog");
  document.querySelectorAll("[data-expand]").forEach(button => button.addEventListener("click", () => {
    const source = button.querySelector("img");
    const expanded = document.getElementById("expanded-capture");
    if (!source || !expanded || !dialog) return;
    expanded.src = source.src; expanded.alt = source.alt;
    document.getElementById("expanded-caption").textContent = source.alt;
    dialog.showModal();
  }));
  document.querySelector(".dialog-close")?.addEventListener("click", () => dialog?.close());
  dialog?.addEventListener("click", event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });

  const strength = document.getElementById("effect-strength");
  const split = document.getElementById("look-split");
  const treatment = document.querySelector(".look-treated");
  const gallery = globalThis.ScenePilotGallery;
  const entries = gallery?.entries ?? (gallery?.recipes ?? []).map(recipe => ({ ...recipe, category: "looks" }));
  const galleryStatus = document.getElementById("effect-status");
  const familyLabels = { blur: "Blur", color: "Color", distort: "Distortion", generate: "Texture", key: "Keying", stylize: "Stylize", utility: "Utility", looks: "Stacked looks", grades: "Film grades", transitions: "Transitions", lights: "Strobe & lighting", punch: "Camera punch", shake: "Camera shake", stutter: "Stutter", speed: "Speed ramps", echo: "Frame echoes", type: "Kinetic type" };
  const cardHost = document.getElementById("effect-cards");
  const category = document.getElementById("effect-category");
  const search = document.getElementById("effect-search");
  const frameControl = document.getElementById("effect-frame");
  const originalImage = document.querySelector(".look-original");
  if (cardHost && entries.length) {
    cardHost.replaceChildren(...entries.map(entry => {
      const button = document.createElement("button"); button.type = "button"; button.className = "effect-card";
      button.dataset.effect = entry.id; button.setAttribute("aria-pressed", String(entry.id === "noir"));
      const image = document.createElement("img"); image.src = entry.thumbnail; image.width = 240; image.height = 160; image.loading = "lazy"; image.alt = "";
      const label = document.createElement("span"), family = document.createElement("small"), name = document.createElement("span");
      family.textContent = familyLabels[entry.category] ?? "Look"; name.textContent = entry.label;
      label.append(family, name); button.append(image, label); return button;
    }));
    if (category) for (const family of new Set(entries.map(entry => entry.category))) {
      const option = document.createElement("option"); option.value = family;
      option.textContent = `${familyLabels[family] ?? family} (${entries.filter(entry => entry.category === family).length})`; category.append(option);
    }
  }
  const cards = [...document.querySelectorAll("[data-effect]")];
  const filterGallery = () => {
    const query = (search?.value ?? "").trim().toLowerCase();
    let count = 0;
    cards.forEach(card => {
      const entry = entries.find(item => item.id === card.dataset.effect);
      const matches = entry && (!category || category.value === "all" || category.value === entry.category) && `${entry.label} ${entry.description} ${(entry.keywords ?? []).join(" ")} ${entry.effects.map(effect => effect.label).join(" ")} ${familyLabels[entry.category] ?? ""}`.toLowerCase().includes(query);
      card.hidden = !matches; if (matches) count++;
    });
    const counter = document.getElementById("effect-count"); if (counter) counter.textContent = `${count} of ${entries.length} effects & presets`;
    const empty = document.getElementById("effect-empty"); if (empty) empty.hidden = count > 0;
  };
  search?.addEventListener("input", filterGallery); category?.addEventListener("change", filterGallery);
  if (cardHost) filterGallery();
  let activeEffect = "noir", activeStrength = "100", activeFrame = 2, requestedEffect = "noir", request = 0, scrubTick = 0;
  // Bound decoded memory; share in-flight decodes and reuse frames when reversing.
  const decodedFrames = new Map();
  const decodeFrame = src => {
    if (decodedFrames.has(src)) {
      const cached = decodedFrames.get(src); decodedFrames.delete(src); decodedFrames.set(src, cached); return cached;
    }
    const image = new Image(); image.src = src;
    const pending = image.decode().then(() => image).catch(error => {
      if (decodedFrames.get(src) === pending) decodedFrames.delete(src);
      throw error;
    });
    decodedFrames.set(src, pending);
    while (decodedFrames.size > 48) decodedFrames.delete(decodedFrames.keys().next().value);
    return pending;
  };
  let warmRequest = 0;
  const warmFrames = (recipe, center) => {
    if (!recipe.frames?.length || (!window.requestIdleCallback && !window.setTimeout)) return;
    const token = ++warmRequest;
    // Only two background image decodes at once, near the current position.
    const warm = async () => {
      for (const offset of [1, -1, 2, -2, 3, -3, 4, -4]) {
        if (token !== warmRequest || activeEffect !== recipe.id || requestedEffect !== recipe.id) return;
        const sample = recipe.frames[center + offset]; if (!sample) continue;
        await Promise.all([decodeFrame(sample.src), decodeFrame(sample.original)]).catch(() => {});
      }
    };
    if (window.requestIdleCallback) window.requestIdleCallback(warm, { timeout: 250 });
    else window.setTimeout(warm, 32);
  };
  const showView = mode => {
    if (!split) return;
    if (mode === "original") split.value = "100";
    if (mode === "result") split.value = "0";
    if (mode === "split" && ["0", "100"].includes(split.value)) split.value = "50";
    document.querySelector(".look-image").style.setProperty("--split", `${split.value}%`);
    document.querySelector(".look-image").dataset.view = mode;
    split.setAttribute("aria-valuetext", `${Math.round((100 - Number(split.value)) * 10) / 10} percent effect visible`);
    document.querySelectorAll("[data-effect-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.effectView === mode)));
  };
  const showEffect = async (id, level, frame = 2) => {
    const recipe = entries.find(item => item.id === id);
    const sample = recipe?.frames?.[frame];
    if (sample) level = "100";
    if (!recipe || !recipe.variants[level] || !treatment) return;
    const token = ++request; requestedEffect = id;
    if (id !== activeEffect) galleryStatus.textContent = `Loading ${recipe.label}…`;
    treatment.setAttribute("aria-busy", "true");
    try {
      const [image, original] = await Promise.all([
        decodeFrame(sample?.src ?? recipe.variants[level]),
        ...(originalImage ? [decodeFrame(sample?.original ?? recipe.original ?? gallery.original)] : []),
      ]);
      if (token !== request) return;
      treatment.src = image.src;
      if (originalImage && original) { originalImage.src = original.src; originalImage.alt = `${recipe.label}: original source on the left, ScenePilot result on the right.`; }
      activeEffect = id; activeStrength = level; activeFrame = frame;
      strength.value = level; strength.disabled = Boolean(sample);
      if (frameControl) { frameControl.value = String(frame); frameControl.max = String(Math.max(0, (recipe.frames?.length ?? 1) - 1)); }
      const scrub = document.getElementById("effect-scrub"); if (scrub) scrub.hidden = !sample;
      const timeLabel = document.getElementById("effect-time"); if (timeLabel) timeLabel.textContent = sample ? `${sample.time.toFixed(3)} s` : "";
      frameControl?.setAttribute("aria-valuetext", sample ? `${sample.time.toFixed(3)} seconds, sample ${frame + 1} of ${recipe.frames.length}` : "Still sample");
      document.getElementById("effect-name").textContent = recipe.label;
      document.getElementById("effect-description").textContent = recipe.description;
      document.getElementById("effect-image-label").textContent = `${recipe.label.toUpperCase()} / ${sample ? `${sample.time.toFixed(3)} s` : `${level}%`}`;
      document.querySelector(".look-controls .eyebrow").textContent = `RENDERED IN SCENEPILOT / ${familyLabels[recipe.category] ?? "LOOKS"}`;
      if (id !== treatment.dataset.effect) document.getElementById("effect-stack").replaceChildren(...(recipe.effects.length ? recipe.effects : [{ label: `${familyLabels[recipe.category]} · ${recipe.label}` }]).map(effect => {
        const item = document.createElement("li"); item.textContent = effect.label; return item;
      }));
      treatment.dataset.effect = id;
      cards.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.effect === id)));
      galleryStatus.textContent = sample ? `${recipe.label} · sample ${frame + 1} of ${recipe.frames.length}. Step through time; drag the divider to compare.` : `${recipe.label} · ${level}% strength. Drag the divider to compare.`;
      warmFrames(recipe, frame);
    } catch {
      if (token !== request) return;
      requestedEffect = activeEffect; strength.value = activeStrength;
      if (frameControl) frameControl.value = String(activeFrame);
      galleryStatus.textContent = "That render could not load. Your previous comparison is still shown. Select a look to retry.";
    } finally { if (token === request) treatment.removeAttribute("aria-busy"); }
  };
  cards.forEach(button => button.addEventListener("click", () => {
    if (scrubTick) window.cancelAnimationFrame(scrubTick);
    scrubTick = 0; ++warmRequest;
    return showEffect(button.dataset.effect, strength.value);
  }));
  strength?.addEventListener("change", () => showEffect(requestedEffect, strength.value));
  frameControl?.addEventListener("input", () => {
    // Coalesce high-frequency pointer events; don't snap the thumb backwards
    // when an older decode finishes between input and the next screen refresh.
    ++request;
    if (!window.requestAnimationFrame) return showEffect(requestedEffect, "100", Number(frameControl.value));
    if (scrubTick) window.cancelAnimationFrame(scrubTick);
    scrubTick = window.requestAnimationFrame(() => {
      scrubTick = 0; void showEffect(requestedEffect, "100", Number(frameControl.value));
    });
  });
  document.querySelectorAll("[data-effect-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.effectView)));
  split?.addEventListener("input", () => showView(split.value === "0" ? "result" : split.value === "100" ? "original" : "split"));
  if (galleryStatus && !gallery) {
    galleryStatus.textContent = "Gallery controls are unavailable. The original / Noir comparison is still shown.";
    document.querySelectorAll(".gallery-interactive").forEach(control => { control.hidden = true; });
  }

  const plan = document.querySelector(".cut-plan");
  const tempo = document.getElementById("demo-tempo");
  const playButton = document.querySelector(".play-plan");
  const playhead = document.querySelector(".rhythm-playhead");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const rhythms = {
    cinematic: { shots: 4, text: "Cinematic: 4 shots across 8 bars. Room to hold a moment." },
    balanced: { shots: 8, text: "Balanced: 8 shots across 8 bars. A cut on each downbeat." },
    energy: { shots: 16, text: "High energy: 16 shots across 8 bars. A cut every two beats." }
  };
  let frame = 0;
  let progress = 0;
  let lastTime = 0;
  let playing = false;
  const stop = () => {
    playing = false; cancelAnimationFrame(frame); lastTime = 0;
    playButton?.setAttribute("aria-pressed", "false");
    if (playButton) playButton.textContent = reducedMotion.matches ? "→ Step one bar" : progress > 0 && progress < 1 ? "▶ Resume pacing" : "▶ Play pacing";
  };
  const drawPlan = name => {
    if (!plan) return;
    progress = 0; stop();
    playhead.style.left = "0%";
    plan.replaceChildren(...Array.from({ length: rhythms[name].shots }, (_, i) => {
      const shot = document.createElement("span"); shot.textContent = String(i + 1).padStart(2, "0"); return shot;
    }));
    document.getElementById("pacing-description").textContent = rhythms[name].text;
  };
  document.querySelectorAll("[data-pacing]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-pacing]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    drawPlan(button.dataset.pacing);
  }));
  const tick = now => {
    if (!playing) return;
    if (lastTime) progress = Math.min(1, progress + (now - lastTime) / (32 * 60 / Number(tempo.value) * 1000));
    lastTime = now;
    playhead.style.left = `${progress * 100}%`;
    if (progress >= 1) { stop(); return; }
    frame = requestAnimationFrame(tick);
  };
  playButton?.addEventListener("click", () => {
    if (playing) { stop(); return; }
    if (reducedMotion.matches) {
      progress = (progress >= 1 ? 0 : progress) + .125;
      playhead.style.left = `${progress * 100}%`;
      return;
    }
    if (progress >= 1) progress = 0;
    playing = true; lastTime = 0; playButton.textContent = "Ⅱ Pause pacing"; playButton.setAttribute("aria-pressed", "true");
    frame = requestAnimationFrame(tick);
  });
  tempo?.addEventListener("input", () => { document.getElementById("tempo-value").value = `${tempo.value} BPM`; });
  document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); });
  const updateMotion = () => { stop(); if (playButton && reducedMotion.matches) playButton.textContent = "→ Step one bar"; };
  reducedMotion.addEventListener("change", updateMotion);
  if ("IntersectionObserver" in window && plan) {
    new IntersectionObserver(entries => { if (!entries[0].isIntersecting) stop(); }).observe(plan);
  }
  const wave = document.getElementById("rhythm-wave-path");
  if (wave) {
    const points = Array.from({ length: 161 }, (_, i) => {
      const envelope = .3 + .7 * Math.abs(Math.sin(i * .079));
      const height = Math.sin(i * 2.4) * envelope * 42;
      return `${i === 0 ? "M" : "L"}${i * 4} ${50 + height}`;
    });
    wave.setAttribute("d", points.join(" "));
  }
  drawPlan("balanced"); updateMotion();

  // Public installer resolution is intentionally disabled until the release gates pass.
})();
