const MODULE_ID = "narrative-hud";
const LAUNCHER_DEFAULT_POSITION = {
  right: "21px",
  bottom: "274px"
};

let narrativeHudApp = null;

function getPool() {
  return game.settings.get(MODULE_ID, "pool") ?? [];
}

function getTimeline() {
  return game.settings.get(MODULE_ID, "timeline") ?? [];
}

async function setPool(pool) {
  await game.settings.set(MODULE_ID, "pool", pool);
}

async function setTimeline(timeline) {
  await game.settings.set(MODULE_ID, "timeline", timeline);
}

class NarrativeHudApp extends Application {
  static get defaultOptions() {
    const saved = game.settings.get(MODULE_ID, "windowState") ?? {};

    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "narrative-hud-window",
      title: "Narrative HUD",
      width: saved.width ?? 720,
      height: saved.height ?? 260,
      top: saved.top ?? 120,
      left: saved.left ?? 320,
      resizable: true
    });
  }

  async _renderInner() {
    const pool = getPool();
    const timeline = getTimeline();

    return $(`
      <section class="narrative-hud-shell">
        <header class="narrative-hud-header">
          <div class="narrative-hud-header-spacer"></div>
          <div class="narrative-hud-header-actions">
            <button type="button" class="narrative-hud-refresh">↻ Actualiser</button>
            ${game.user.isGM ? `<button type="button" class="narrative-hud-add">+ Ajouter</button>` : ""}
            ${game.user.isGM ? `<button type="button" class="narrative-hud-new-turn">Nouveau Tour</button>` : ""}
            ${game.user.isGM ? `<button type="button" class="narrative-hud-clear">Vider Timeline</button>` : ""}
            <span>V0.25</span>
          </div>
        </header>

        <main class="narrative-hud-body">
          <section class="narrative-hud-section">
            <h3>POOL</h3>
            <div class="narrative-hud-pool">
              ${pool.map(item => this._renderChip(item, "pool")).join("")}
            </div>
          </section>

          <section class="narrative-hud-section">
            <h3>TIMELINE</h3>
            <div class="narrative-hud-timeline">
              ${timeline.map((item, index) => this._renderChip(item, "timeline", index)).join("")}
            </div>
          </section>
        </main>
      </section>
    `);
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".narrative-hud-refresh").on("click", () => this.render(false));

    html.find(".narrative-hud-add").on("click", () => {
      if (!game.user.isGM) return;
      this._openCreateDialog();
    });

    html.find(".narrative-hud-new-turn").on("click", async () => {
      if (!game.user.isGM) return;

      const timeline = getTimeline().map(item => ({ ...item, played: false }));
      await setTimeline(timeline);
      this.render(false);
    });

    html.find(".narrative-hud-clear").on("click", async () => {
      if (!game.user.isGM) return;

      const confirmClear = await Dialog.confirm({
        title: "Vider Timeline",
        content: "<p>Vider entièrement la timeline ?</p>",
        yes: () => true,
        no: () => false,
        defaultYes: false
      });

      if (!confirmClear) return;

      await setTimeline([]);
      this.render(false);
    });

    html.find(".narrative-hud-chip-pool").on("dblclick", async event => {
      if (!game.user.isGM) {
        ui.notifications.warn("Seul le MJ peut modifier la timeline pour l'instant.");
        return;
      }

      const id = event.currentTarget.dataset.id;
      const item = getPool().find(p => p.id === id);
      if (!item) return;

      const timeline = getTimeline();

      timeline.push({
        ...item,
        occurrenceId: foundry.utils.randomID(),
        played: false
      });

      await setTimeline(timeline);
      this.render(false);
    });

    html.find(".narrative-hud-chip-pool").on("contextmenu", async event => {
      event.preventDefault();

      if (!game.user.isGM) return;

      const id = event.currentTarget.dataset.id;
      const pool = getPool();
      const item = pool.find(p => p.id === id);
      if (!item) return;

      const confirmDelete = await Dialog.confirm({
        title: "Supprimer du Pool",
        content: `<p>Supprimer définitivement <strong>${item.name}</strong> ?</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: false
      });

      if (!confirmDelete) return;

      await setPool(pool.filter(p => p.id !== id));
      await setTimeline(getTimeline().filter(t => t.id !== id));

      this.render(false);
    });

    html.find(".narrative-hud-chip-timeline").on("contextmenu", async event => {
      event.preventDefault();

      if (!game.user.isGM) {
        ui.notifications.warn("Seul le MJ peut modifier la timeline pour l'instant.");
        return;
      }

      const index = Number(event.currentTarget.dataset.index);
      const timeline = getTimeline();

      if (index < 0 || index >= timeline.length) return;

      timeline[index].played = !timeline[index].played;

      await setTimeline(timeline);
      this.render(false);
    });

    html.find(".narrative-hud-chip-timeline").on("click", async event => {
      if (event.detail !== 3) return;

      if (!game.user.isGM) {
        ui.notifications.warn("Seul le MJ peut modifier la timeline pour l'instant.");
        return;
      }

      const index = Number(event.currentTarget.dataset.index);
      const timeline = getTimeline();

      if (index < 0 || index >= timeline.length) return;

      timeline.splice(index, 1);

      await setTimeline(timeline);
      this.render(false);
    });

    if (game.user.isGM) this._activateDragAndDrop(html);
  }

  _activateDragAndDrop(html) {
    html.find(".narrative-hud-chip-pool").attr("draggable", true);
    html.find(".narrative-hud-chip-timeline").attr("draggable", true);

    html.find(".narrative-hud-chip-pool").on("dragstart", event => {
      event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({
        source: "pool",
        id: event.currentTarget.dataset.id
      }));

      event.currentTarget.classList.add("narrative-hud-dragging");
    });

    html.find(".narrative-hud-chip-timeline").on("dragstart", event => {
      event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({
        source: "timeline",
        index: Number(event.currentTarget.dataset.index)
      }));

      event.currentTarget.classList.add("narrative-hud-dragging");
    });

    html.find(".narrative-hud-chip-pool, .narrative-hud-chip-timeline").on("dragend", event => {
      event.currentTarget.classList.remove("narrative-hud-dragging");
    });

    html.find(".narrative-hud-timeline").on("dragover", event => {
      event.preventDefault();
    });

    html.find(".narrative-hud-chip-timeline").on("dragover", event => {
      event.preventDefault();
    });

    html.find(".narrative-hud-timeline").on("drop", async event => {
      event.preventDefault();

      if ($(event.target).closest(".narrative-hud-chip-timeline").length) return;

      const data = this._readDragData(event);
      if (!data) return;

      const timeline = getTimeline();

      if (data.source === "pool") {
        const item = getPool().find(p => p.id === data.id);
        if (!item) return;

        timeline.push({
          ...item,
          occurrenceId: foundry.utils.randomID(),
          played: false
        });

        await setTimeline(timeline);
        this.render(false);
      }
    });

    html.find(".narrative-hud-chip-timeline").on("drop", async event => {
      event.preventDefault();

      const data = this._readDragData(event);
      if (!data) return;

      const targetIndex = Number(event.currentTarget.dataset.index);
      const timeline = getTimeline();

      if (Number.isNaN(targetIndex)) return;

      if (data.source === "pool") {
        const item = getPool().find(p => p.id === data.id);
        if (!item) return;

        const newOccurrence = {
          ...item,
          occurrenceId: foundry.utils.randomID(),
          played: false
        };

        if (timeline[targetIndex]?.type === "slot") {
          timeline[targetIndex] = newOccurrence;
        } else {
          timeline.splice(targetIndex, 0, newOccurrence);
        }

        await setTimeline(timeline);
        this.render(false);
        return;
      }

      if (data.source === "timeline") {
        const fromIndex = Number(data.index);

        if (Number.isNaN(fromIndex)) return;
        if (fromIndex < 0 || fromIndex >= timeline.length) return;
        if (fromIndex === targetIndex) return;

        const targetRect = event.currentTarget.getBoundingClientRect();
        const dropAfter = event.originalEvent.clientX > targetRect.left + targetRect.width / 2;
        const [moved] = timeline.splice(fromIndex, 1);

        let insertIndex = targetIndex;
        if (fromIndex < targetIndex) {
          insertIndex = dropAfter ? targetIndex : targetIndex - 1;
        } else {
          insertIndex = dropAfter ? targetIndex + 1 : targetIndex;
        }

        insertIndex = Math.max(0, Math.min(insertIndex, timeline.length));
        timeline.splice(insertIndex, 0, moved);

        await setTimeline(timeline);
        this.render(false);
      }
    });
  }

  _readDragData(event) {
    try {
      return JSON.parse(event.originalEvent.dataTransfer.getData("text/plain"));
    } catch {
      return null;
    }
  }

  async _openCreateDialog() {
    const content = `
      <form class="narrative-hud-create-form">
        <div class="form-group">
          <label>Nom de base</label>
          <input type="text" name="name" placeholder="Bandit" />
        </div>

        <div class="form-group">
          <label>Label court de base</label>
          <input type="text" name="label" placeholder="B" maxlength="3" />
        </div>

        <div class="form-group">
          <label>Type</label>
          <select name="type">
            <option value="player">PJ</option>
            <option value="npc">PNJ</option>
            <option value="monster">Monstre</option>
            <option value="slot">Slot Joueur</option>
          </select>
        </div>

        <div class="form-group">
          <label>Quantité</label>
          <input type="number" name="quantity" value="1" min="1" max="99" />
        </div>
      </form>
    `;

    new Dialog({
      title: "Ajouter au Pool",
      content,
      buttons: {
        create: {
          label: "Créer",
          callback: async html => {
            const form = html.find(".narrative-hud-create-form")[0];
            const data = new FormData(form);

            const baseName = String(data.get("name") ?? "").trim();
            const baseLabel = String(data.get("label") ?? "").trim().toUpperCase();
            const type = String(data.get("type") ?? "player");
            const quantity = Math.max(1, Math.min(99, Number(data.get("quantity") ?? 1)));

            if (!baseName || !baseLabel) {
              ui.notifications.warn("Nom et label court sont obligatoires.");
              return;
            }

            const pool = getPool();

            for (let i = 1; i <= quantity; i++) {
              const shouldSuffix = quantity > 1;

              pool.push({
                id: foundry.utils.randomID(),
                name: shouldSuffix ? `${baseName} ${i}` : baseName,
                label: shouldSuffix ? `${baseLabel}${i}` : baseLabel,
                type
              });
            }

            await setPool(pool);
            this.render(false);
          }
        },
        cancel: {
          label: "Annuler"
        }
      },
      default: "create"
    }).render(true);
  }

  _renderChip(item, zone, index = null) {
    const indexAttr = index === null ? "" : `data-index="${index}"`;
    const playedClass = item.played ? "narrative-hud-chip-played" : "";

    return `
      <button
        class="narrative-hud-chip narrative-hud-chip-${item.type} narrative-hud-chip-${zone} ${playedClass}"
        title="${item.name}"
        type="button"
        data-id="${item.id}"
        ${indexAttr}
      >
        ${item.label}
      </button>
    `;
  }

  async close(options = {}) {
    const el = this.element?.[0];

    if (el) {
      await game.settings.set(MODULE_ID, "windowState", {
        left: el.offsetLeft,
        top: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight
      });
    }

    narrativeHudApp = null;
    return super.close(options);
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "launcherPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: LAUNCHER_DEFAULT_POSITION
  });

  game.settings.register(MODULE_ID, "windowState", {
    scope: "client",
    config: false,
    type: Object,
    default: {
      left: 320,
      top: 120,
      width: 720,
      height: 260
    }
  });

  game.settings.register(MODULE_ID, "pool", {
    scope: "world",
    config: false,
    type: Object,
    default: []
  });

  game.settings.register(MODULE_ID, "timeline", {
    scope: "world",
    config: false,
    type: Object,
    default: []
  });
});

Hooks.once("ready", () => {
  console.log("Narrative HUD | Ready V0.25");

  document.getElementById("narrative-hud-launcher")?.remove();

  const button = document.createElement("button");
  button.id = "narrative-hud-launcher";
  button.title = "Narrative HUD";
  button.innerText = "⚔";

  const savedPosition = game.settings.get(MODULE_ID, "launcherPosition");

  const parsePixels = value => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const applyLauncherPosition = position => {
    const width = button.offsetWidth || 36;
    const height = button.offsetHeight || 36;
    const maxRight = Math.max(8, window.innerWidth - width - 8);
    const maxBottom = Math.max(8, window.innerHeight - height - 8);
    const right = parsePixels(position?.right) ?? parsePixels(LAUNCHER_DEFAULT_POSITION.right);
    const bottom = parsePixels(position?.bottom) ?? parsePixels(LAUNCHER_DEFAULT_POSITION.bottom);

    button.style.left = "auto";
    button.style.top = "auto";
    button.style.right = `${Math.max(8, Math.min(right, maxRight))}px`;
    button.style.bottom = `${Math.max(8, Math.min(bottom, maxBottom))}px`;
  };

  window.addEventListener("resize", () => applyLauncherPosition(game.settings.get(MODULE_ID, "launcherPosition")));

  let hasMoved = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMouseMove = event => {
    hasMoved = true;
    const maxLeft = Math.max(8, window.innerWidth - button.offsetWidth - 8);
    const maxTop = Math.max(8, window.innerHeight - button.offsetHeight - 8);

    button.style.left = `${Math.max(8, Math.min(event.clientX - offsetX, maxLeft))}px`;
    button.style.top = `${Math.max(8, Math.min(event.clientY - offsetY, maxTop))}px`;
    button.style.right = "auto";
    button.style.bottom = "auto";
    button.classList.add("dragging");
  };

  const onMouseUp = async () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    button.classList.remove("dragging");

    const rect = button.getBoundingClientRect();

    await game.settings.set(MODULE_ID, "launcherPosition", {
      right: `${Math.round(Math.max(8, window.innerWidth - rect.right))}px`,
      bottom: `${Math.round(Math.max(8, window.innerHeight - rect.bottom))}px`
    });
  };

  button.addEventListener("mousedown", event => {
    hasMoved = false;

    offsetX = event.clientX - button.offsetLeft;
    offsetY = event.clientY - button.offsetTop;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp, { once: true });
  });

  button.addEventListener("dblclick", event => {
    event.preventDefault();
    event.stopPropagation();

    if (hasMoved) return;

    if (narrativeHudApp?.rendered) {
      narrativeHudApp.close();
      return;
    }

    narrativeHudApp = new NarrativeHudApp();
    narrativeHudApp.render(true);
  });

  document.body.appendChild(button);
  applyLauncherPosition(savedPosition);
});
