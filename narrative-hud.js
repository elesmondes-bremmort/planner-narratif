const MODULE_ID = "narrative-hud";

let narrativeHudOverlay = null;

function getPool() {
  return game.settings.get(MODULE_ID, "pool") ?? [];
}

function getTimeline() {
  return game.settings.get(MODULE_ID, "timeline") ?? [];
}

function getViewMode() {
  return game.settings.get(MODULE_ID, "viewMode") ?? "intrigue";
}

function getIntrigueVisiblePlayers() {
  return game.settings.get(MODULE_ID, "intrigueVisiblePlayers") ?? {};
}

async function setPool(pool) {
  await game.settings.set(MODULE_ID, "pool", pool);
}

async function setTimeline(timeline) {
  await game.settings.set(MODULE_ID, "timeline", timeline);
}

async function setViewMode(mode) {
  const nextMode = mode === "combat" ? "combat" : "intrigue";
  await game.settings.set(MODULE_ID, "viewMode", nextMode);
}

async function setIntrigueVisiblePlayers(visiblePlayers) {
  await game.settings.set(MODULE_ID, "intrigueVisiblePlayers", visiblePlayers);
}

function isIntrigueMode() {
  return getViewMode() === "intrigue";
}

function isCombatMode() {
  return getViewMode() === "combat";
}

class NarrativeHudOverlay {
  constructor() {
    this.showProtagonistsPanel = false;
    this.isDraggingPoolEntity = false;
  }

  get rendered() {
    return Boolean(document.getElementById("narrative-hud-overlay"));
  }

  render() {
    document.getElementById("narrative-hud-overlay")?.remove();

    const html = this._renderInner();
    document.body.appendChild(html[0]);
    this.activateListeners(html);
    this._positionCombatPoolPanel();
  }

  close() {
    document.getElementById("narrative-hud-overlay")?.remove();
    narrativeHudOverlay = null;
  }

  _renderInner() {
    const mode = getViewMode();

    return $(`
      <div id="narrative-hud-overlay" class="narrative-hud-overlay-${mode}">
        ${isIntrigueMode() ? this._renderIntrigueView() : this._renderCombatView()}
      </div>
    `);
  }

  _renderIntrigueView() {
    const players = getPool().filter(item => item.type === "player");
    const visiblePlayers = getIntrigueVisiblePlayers();
    const visiblePlayerItems = players.filter(item => visiblePlayers[item.id] !== false);

    return `
      <section class="narrative-hud-intrigue-panel">
        <div class="narrative-hud-intrigue-bar">
          ${visiblePlayerItems.length
            ? visiblePlayerItems.map(item => this._renderHudCard(item, {
            mode: "intrigue",
            visible: true
          })).join("")
            : `<div class="narrative-hud-empty">Aucun protagoniste affich&eacute;.</div>`}
        </div>
        <div class="narrative-hud-intrigue-controls">
          ${this._renderModeToggle()}
          <button type="button" class="narrative-hud-protagonists-toggle">Protagonistes</button>
          <button type="button" class="narrative-hud-refresh">&#8635;</button>
        </div>
        ${this.showProtagonistsPanel ? this._renderProtagonistsPanel(players, visiblePlayers) : ""}
      </section>
    `;
  }

  _renderCombatView() {
    const pool = getPool();
    const timeline = getTimeline();
    const activeItem = timeline.find(item => item.played !== true);
    const activeId = activeItem?.id ?? null;
    const orderedPool = this._getCombatOrderedPool(pool);

    return `
      <section class="narrative-hud-combat-timeline-panel">
        <div class="narrative-hud-combat-track">
          <div class="narrative-hud-timeline">
            ${timeline.map((item, index) => this._renderChip(item, "timeline", index)).join("")}
          </div>
        </div>
        <div class="narrative-hud-combat-actions">
          ${game.user.isGM ? `<button type="button" class="narrative-hud-new-turn">Nouveau Tour</button>` : ""}
          ${game.user.isGM ? `<button type="button" class="narrative-hud-clear">Vider Timeline</button>` : ""}
          <button type="button" class="narrative-hud-refresh">&#8635;</button>
        </div>
        <span class="narrative-hud-version">V0.30</span>
      </section>

      <aside class="narrative-hud-combat-pool-panel">
        <div class="narrative-hud-pool-header">
          ${game.user.isGM ? `<button type="button" class="narrative-hud-add">+ Ajouter</button>` : ""}
          ${game.user.isGM ? `<button type="button" class="narrative-hud-add-slot">+ Slot Joueur</button>` : ""}
          ${this._renderModeToggle()}
        </div>
        <div class="narrative-hud-pool">
          ${orderedPool.map(item => this._renderHudCard(item, {
            mode: "combat",
            active: activeId && item.id === activeId
          })).join("")}
        </div>
      </aside>
    `;
  }

  activateListeners(html) {
    html.find(".narrative-hud-mode-toggle").on("click", async () => {
      await setViewMode(isCombatMode() ? "intrigue" : "combat");
      this.render();
    });

    html.find(".narrative-hud-refresh").on("click", () => this.render());

    html.find(".narrative-hud-add").on("click", () => {
      if (!game.user.isGM) return;
      this._openCreateDialog();
    });

    html.find(".narrative-hud-add-slot").on("click", async () => {
      if (!game.user.isGM) return;

      const timeline = getTimeline();
      timeline.push({
        id: foundry.utils.randomID(),
        occurrenceId: foundry.utils.randomID(),
        name: "Slot Joueur",
        label: "J",
        type: "slot",
        played: false
      });

      await setTimeline(timeline);
      this.render();
    });

    html.find(".narrative-hud-new-turn").on("click", async () => {
      if (!game.user.isGM) return;

      const timeline = getTimeline().map(item => ({ ...item, played: false }));
      await setTimeline(timeline);
      this.render();
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
      this.render();
    });

    html.find(".narrative-hud-pool-entity").on("click", async event => {
      if (this.isDraggingPoolEntity) return;

      if (!game.user.isGM) {
        ui.notifications.warn("Seul le MJ peut modifier la timeline pour l'instant.");
        return;
      }

      const id = event.currentTarget.dataset.id;
      const item = getPool().find(p => p.id === id);
      if (!item) return;

      const timeline = getTimeline();

      timeline.unshift({
        ...item,
        occurrenceId: foundry.utils.randomID(),
        played: false
      });

      await setTimeline(timeline);
      this.render();
    });

    html.find(".narrative-hud-pool-entity").on("contextmenu", async event => {
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

      this.render();
    });

    html.find(".narrative-hud-protagonists-toggle").on("click", () => {
      this.showProtagonistsPanel = !this.showProtagonistsPanel;
      this.render();
    });

    html.find(".narrative-hud-protagonist-checkbox").on("change", async event => {
      const id = event.currentTarget.dataset.id;
      const visiblePlayers = { ...getIntrigueVisiblePlayers() };

      if (event.currentTarget.checked) {
        delete visiblePlayers[id];
      } else {
        visiblePlayers[id] = false;
      }

      await setIntrigueVisiblePlayers(visiblePlayers);
      this.showProtagonistsPanel = true;
      this.render();
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
      this.render();
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
      this.render();
    });

    if (game.user.isGM) this._activateDragAndDrop(html);
  }

  _activateDragAndDrop(html) {
    html.find(".narrative-hud-pool-entity").attr("draggable", true);
    html.find(".narrative-hud-chip-timeline").attr("draggable", true);

    html.find(".narrative-hud-pool-entity").on("dragstart", event => {
      this.isDraggingPoolEntity = true;

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

    html.find(".narrative-hud-pool-entity, .narrative-hud-chip-timeline").on("dragend", event => {
      event.currentTarget.classList.remove("narrative-hud-dragging");
      window.setTimeout(() => {
        this.isDraggingPoolEntity = false;
      }, 100);
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
        this.render();
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
        this.render();
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
        this.render();
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

  _positionCombatPoolPanel() {
    const panel = document.querySelector(".narrative-hud-combat-pool-panel");
    if (!panel) return;

    const sidebar = document.getElementById("sidebar");
    const sidebarRect = sidebar?.getBoundingClientRect();
    const sidebarStyle = sidebar ? window.getComputedStyle(sidebar) : null;
    const sidebarVisible = Boolean(
      sidebar
      && sidebarRect
      && sidebarRect.width > 20
      && sidebarRect.height > 20
      && sidebarStyle?.display !== "none"
      && sidebarStyle?.visibility !== "hidden"
      && !sidebar.classList.contains("collapsed")
      && sidebarRect.left < window.innerWidth
    );

    const right = sidebarVisible ? Math.max(12, window.innerWidth - sidebarRect.left + 12) : 12;
    panel.style.right = `${right}px`;
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
            <option value="npc">Alli&eacute;</option>
            <option value="monster">Ennemi</option>
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
            this.render();
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
    const typeLabel = this._getTypeLabel(item.type);

    return `
      <button
        class="narrative-hud-chip narrative-hud-chip-${item.type} narrative-hud-chip-${zone} ${playedClass}"
        title="${typeLabel} - ${item.name}"
        type="button"
        data-id="${item.id}"
        ${indexAttr}
      >
        <span class="narrative-hud-chip-label">${item.label}</span>
        <span class="narrative-hud-chip-type">${typeLabel}</span>
      </button>
    `;
  }

  _renderHudCard(item, options = {}) {
    const label = String(item.label ?? item.name?.[0] ?? "?").trim().slice(0, 3).toUpperCase();
    const mode = options.mode ?? "intrigue";
    const typeLabel = this._getTypeLabel(item.type);
    const activeClass = options.active ? "narrative-hud-active" : "";
    const poolClass = mode === "combat" ? "narrative-hud-pool-entity" : "";

    if (mode === "intrigue") {
      return `
        <article
          class="narrative-hud-card narrative-hud-card-intrigue narrative-hud-card-${item.type}"
          title="${item.name}"
          data-id="${item.id}"
        >
          <div class="narrative-hud-card-portrait">${label}</div>
          <div class="narrative-hud-card-name">${item.name}</div>
        </article>
      `;
    }

    return `
      <article
        class="narrative-hud-card narrative-hud-card-combat narrative-hud-card-${item.type} ${poolClass} ${activeClass}"
        title="${typeLabel} - ${item.name}"
        data-id="${item.id}"
      >
        <div class="narrative-hud-card-portrait"></div>
        <div class="narrative-hud-card-content">
          <div class="narrative-hud-card-name">${item.name}</div>
          ${this._renderHudCardDetails(item)}
          <div class="narrative-hud-card-statuses">Statuts</div>
        </div>
      </article>
    `;
  }

  _renderProtagonistsPanel(players, visiblePlayers) {
    return `
      <div class="narrative-hud-protagonists-panel">
        ${players.map(item => `
          <label class="narrative-hud-protagonist-row">
            <input
              type="checkbox"
              class="narrative-hud-protagonist-checkbox"
              data-id="${item.id}"
              ${visiblePlayers[item.id] === false ? "" : "checked"}
            />
            <span>${item.name}</span>
          </label>
        `).join("")}
      </div>
    `;
  }

  _renderHudCardDetails(item) {
    if (item.type === "player") {
      return `
        <div class="narrative-hud-card-lines">
          <div>&#10084;&#65039; 25/30</div>
          <div>&#128154; 12/20</div>
          <div>&#128153; 8/12</div>
        </div>
      `;
    }

    if (item.type === "slot") {
      return `
        <div class="narrative-hud-card-lines">
          <div>Slot joueur</div>
        </div>
      `;
    }

    const wounds = item.type === "monster" ? 2 : 1;

    return `
      <div class="narrative-hud-card-lines">
        <div>&#129656; Blessures : ${wounds}</div>
      </div>
    `;
  }

  _renderModeToggle() {
    const modeLabel = isCombatMode() ? "&#128367; Intrigue" : "&#9876; Combat";

    return `<button type="button" class="narrative-hud-mode-toggle">${modeLabel}</button>`;
  }

  _getTypeLabel(type) {
    return {
      player: "PJ",
      npc: "Alli\u00e9",
      monster: "Ennemi",
      slot: "Slot"
    }[type] ?? type;
  }

  _getCombatOrderedPool(pool) {
    const order = {
      player: 0,
      npc: 1,
      monster: 2
    };

    return pool.filter(item => item.type in order).sort((a, b) => {
      const typeOrder = (order[a.type] ?? 99) - (order[b.type] ?? 99);
      if (typeOrder !== 0) return typeOrder;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "viewMode", {
    scope: "client",
    config: false,
    type: String,
    default: "intrigue",
    choices: {
      intrigue: "Intrigue",
      combat: "Combat"
    }
  });

  game.settings.register(MODULE_ID, "intrigueVisiblePlayers", {
    scope: "client",
    config: false,
    type: Object,
    default: {}
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
  console.log("Narrative HUD | Ready V0.30");

  window.addEventListener("resize", () => {
    narrativeHudOverlay?._positionCombatPoolPanel();
  });
  window.setInterval(() => narrativeHudOverlay?._positionCombatPoolPanel(), 500);

  narrativeHudOverlay = new NarrativeHudOverlay();
  narrativeHudOverlay.render();
});
