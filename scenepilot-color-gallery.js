/* Adapted from the original ScenePilot rendered gallery; scoped to this section. */
(()=>{const root=document.getElementById("scenepilot-color");if(!root)return;const byId=id=>root.querySelector("#"+CSS.escape(id));
  const strength = byId("effect-strength");
  const split = byId("look-split");
  const treatment = root.querySelector(".look-treated");
  const gallery = globalThis.ScenePilotColorGallery;
  const entries = gallery?.entries ?? (gallery?.recipes ?? []).map(recipe => ({ ...recipe, category: "looks" }));
  const galleryStatus = byId("effect-status");
  const familyLabels = { blur: "Blur", color: "Color", distort: "Distortion", generate: "Texture", key: "Keying", stylize: "Stylize", utility: "Utility", looks: "Stacked looks", grades: "Film grades", transitions: "Transitions", lights: "Strobe & lighting", punch: "Camera punch", shake: "Camera shake", stutter: "Stutter", speed: "Speed ramps", echo: "Frame echoes", type: "Kinetic type" };
  const cardHost = byId("effect-cards");
  const category = byId("effect-category");
  const search = byId("effect-search");
  const frameControl = byId("effect-frame");
  const originalImage = root.querySelector(".look-original");
  if (cardHost && entries.length) {
    cardHost.replaceChildren(...entries.map(entry => {
      const button = document.createElement("button"); button.type = "button"; button.className = "effect-card";
      button.dataset.effect = entry.id; button.setAttribute("aria-pressed", String(entry.id === "fx-contrast"));
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
  const cards = [...root.querySelectorAll("[data-effect]")];
  const filterGallery = () => {
    const query = (search?.value ?? "").trim().toLowerCase();
    let count = 0;
    cards.forEach(card => {
      const entry = entries.find(item => item.id === card.dataset.effect);
      const matches = entry && (!category || category.value === "all" || category.value === entry.category) && `${entry.label} ${entry.description} ${(entry.keywords ?? []).join(" ")} ${entry.effects.map(effect => effect.label).join(" ")} ${familyLabels[entry.category] ?? ""}`.toLowerCase().includes(query);
      card.hidden = !matches; if (matches) count++;
    });
    const counter = byId("effect-count"); if (counter) counter.textContent = `${count} of ${entries.length} effects & presets`;
    const empty = byId("effect-empty"); if (empty) empty.hidden = count > 0;
  };
  search?.addEventListener("input", filterGallery); category?.addEventListener("change", filterGallery);
  if (cardHost) filterGallery();
  let activeEffect = "fx-contrast", activeStrength = "100", activeFrame = 2, requestedEffect = "fx-contrast", request = 0, scrubTick = 0;
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
    root.querySelector(".look-image").style.setProperty("--split", `${split.value}%`);
    root.querySelector(".look-image").dataset.view = mode;
    split.setAttribute("aria-valuetext", `${Math.round((100 - Number(split.value)) * 10) / 10} percent effect visible`);
    root.querySelectorAll("[data-effect-view]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.effectView === mode)));
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
      const scrub = byId("effect-scrub"); if (scrub) scrub.hidden = !sample;
      const timeLabel = byId("effect-time"); if (timeLabel) timeLabel.textContent = sample ? `${sample.time.toFixed(3)} s` : "";
      frameControl?.setAttribute("aria-valuetext", sample ? `${sample.time.toFixed(3)} seconds, sample ${frame + 1} of ${recipe.frames.length}` : "Still sample");
      byId("effect-name").textContent = recipe.label;
      byId("effect-description").textContent = recipe.description;
      byId("effect-image-label").textContent = `${recipe.label.toUpperCase()} / ${sample ? `${sample.time.toFixed(3)} s` : `${level}%`}`;
      root.querySelector(".look-controls .eyebrow").textContent = `RENDERED IN SCENEPILOT / ${familyLabels[recipe.category] ?? "LOOKS"}`;
      if (id !== treatment.dataset.effect) byId("effect-stack").replaceChildren(...(recipe.effects.length ? recipe.effects : [{ label: `${familyLabels[recipe.category]} · ${recipe.label}` }]).map(effect => {
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
  root.querySelectorAll("[data-effect-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.effectView)));
  split?.addEventListener("input", () => showView(split.value === "0" ? "result" : split.value === "100" ? "original" : "split"));
  if (galleryStatus && !gallery) {
    galleryStatus.textContent = "Gallery controls are unavailable. The original / Noir comparison is still shown.";
    root.querySelectorAll(".gallery-interactive").forEach(control => { control.hidden = true; });
  }


void showEffect("fx-contrast","100");
})();
