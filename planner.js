const MODULE_ID = "planner-narratif";
let plannerApp = null;

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

class PlannerNarratifApp extends Application {
  static get defaultOptions() {
    const saved = game.settings.get(MODULE_ID, "windowState") ?? {};

    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "planner-narratif-window",
      title: "Planner Narratif",
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
      <section class="planner-shell">
        <header class="planner-header">
          <div class="planner-header-spacer"></div>
          <div class="planner-header-actions">
            <button type="button" class="planner-refresh">↻ Actualiser</button>
            ${game.user.isGM ? `<button type="button" class="planner-add">+ Ajouter</button>` : ""}
            ${game.user.isGM ? `<button type="button" class="planner-reset">Fin du Tour</button>` : ""}
            <span>V0.20</span>
          </div>
        </header>

        <main class="planner-body">
          <section class="planner-section">
            <h3>POOL</h3>
            <div class="planner-pool">
              ${pool.map(item => this._renderChip(item, "pool")).join("")}
            </div>
          </section>

          <section class="planner-section">
            <h3>TIMELINE</h3>
            <div class="planner-timeline">
              ${timeline.map((item, index) => this._renderChip(item, "timeline", index)).join("")}
            </div>
          </section>
        </main>
      </section>
    `);
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".planner-refresh").on("click", () => {
      this.render(false);
    });

    html.find(".planner-add").on("click", () => {
      if (!game.user.isGM) return;
      this._openCreateDialog();
    });

    html.find(".planner-reset").on("click", async () => {
      if (!game.user.isGM) return;

      const confirmReset = await Dialog.confirm({
        title: "Fin du Tour",
        content: "<p>Vider entièrement la timeline ?</p>",
        yes: () => true,
        no: () => false,
        defaultYes: false
      });

      if (!confirmReset) return;

      await setTimeline([]);
      this.render(false);
    });

    html.find(".planner-chip-pool").on("dblclick", async event => {
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
      this.render(false);
    });

    html.find(".planner-chip-pool").on("contextmenu", async event => {
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

      const newPool = pool.filter(p => p.id !== id);
      const newTimeline = getTimeline().filter(t => t.id !== id);

      await setPool(newPool);
      await setTimeline(newTimeline);

      this.render(false);
    });

    html.find(".planner-chip-timeline").on("click", async event => {
      if (!game.user.isGM) {
        ui.notifications.warn("Seul le MJ peut modifier la timeline pour l'instant.");
        return;
      }

      if (event.detail === 1) {
        const index = Number(event.currentTarget.dataset.index);
        const timeline = getTimeline();

        if (index < 0 || index >= timeline.length) return;

        timeline[index].played = !timeline[index].played;

        await setTimeline(timeline);
        this.render(false);
      }

      if (event.detail === 3) {
        const index = Number(event.currentTarget.dataset.index);
        const timeline = getTimeline();

        if (index < 0 || index >= timeline.length) return;

        timeline.splice(index, 1);

        await setTimeline(timeline);
        this.render(false);
      }
    });

    if (game.user.isGM) {
      this._activateDragAndDrop(html);
    }
  }

  _activateDragAndDrop(html) {
    html.find(".planner-chip-pool").attr("draggable", true);
    html.find(".planner-chip-timeline").attr("draggable", true);

    html.find(".planner-chip-pool").on("dragstart", event => {
      event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({
        source: "pool",
        id: event.currentTarget.dataset.id
      }));

      event.currentTarget.classList.add("planner-dragging");
    });

    html.find(".planner-chip-timeline").on("dragstart", event => {
      event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({
        source: "timeline",
        index: Number(event.currentTarget.dataset.index)
      }));

      event.currentTarget.classList.add("planner-dragging");
    });

    html.find(".planner-chip-pool, .planner-chip-timeline").on("dragend", event => {
      event.currentTarget.classList.remove("planner-dragging");
    });

    html.find(".planner-timeline").on("dragover", event => {
      event.preventDefault();
    });

    html.find(".planner-chip-timeline").on("dragover", event => {
      event.preventDefault();
    });

    html.find(".planner-timeline").on("drop", async event => {
      event.preventDefault();

      if ($(event.target).closest(".planner-chip-timeline").length) return;

      const data = this._readDragData(event);
      if (!data) return;

      const timeline = getTimeline();

      if (data.source === "pool") {
        const item = getPool().find(p => p.id === data.id);
        if (!item) return;

        timeline.unshift({
          ...item,
          occurrenceId: foundry.utils.randomID(),
          played: false
        });

        await setTimeline(timeline);
        this.render(false);
      }
    });

    html.find(".planner-chip-timeline").on("drop", async event => {
      event.preventDefault();

      const data = this._readDragData(event);
      if (!data) return;

      const targetIndex = Number(event.currentTarget.dataset.index);
      const timeline = getTimeline();

      if (Number.isNaN(targetIndex)) return;

      if (data.source === "pool") {
        const item = getPool().find(p => p.id === data.id);
        if (!item) return;

        if (timeline[targetIndex]?.type === "slot") {
          timeline[targetIndex] = {
            ...item,
            occurrenceId: foundry.utils.randomID(),
            played: false
          };
        } else {
          timeline.splice(targetIndex, 0, {
            ...item,
            occurrenceId: foundry.utils.randomID(),
            played: false
          });
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

        const [moved] = timeline.splice(fromIndex, 1);

        let insertIndex = targetIndex;
        if (fromIndex < targetIndex) insertIndex = targetIndex - 1;

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
      <form class="planner-create-form">
        <div class="form-group">
          <label>Nom</label>
          <input type="text" name="name" placeholder="Alaric" />
        </div>

        <div class="form-group">
          <label>Label court</label>
          <input type="text" name="label" placeholder="A" maxlength="3" />
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
      </form>
    `;

    new Dialog({
      title: "Ajouter au Pool",
      content,
      buttons: {
        create: {
          label: "Créer",
          callback: async html => {
            const form = html.find(".planner-create-form")[0];
            const data = new FormData(form);

            const name = String(data.get("name") ?? "").trim();
            const label = String(data.get("label") ?? "").trim().toUpperCase();
            const type = String(data.get("type") ?? "player");

            if (!name || !label) {
              ui.notifications.warn("Nom et label court sont obligatoires.");
              return;
            }

            const pool = getPool();

            pool.push({
              id: foundry.utils.randomID(),
              name,
              label,
              type
            });

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
    const playedClass = item.played ? "planner-chip-played" : "";

    return `
      <button
        class="planner-chip planner-chip-${item.type} planner-chip-${zone} ${playedClass}"
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

    plannerApp = null;
    return super.close(options);
  }
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "launcherPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: {
      left: "432px",
      top: "851px"
    }
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
  console.log("Planner Narratif | Ready V0.20");

  document.getElementById("planner-narratif-launcher")?.remove();

  const button = document.createElement("button");
  button.id = "planner-narratif-launcher";
  button.title = "Planner Narratif";
  button.innerText = "⚔";

  const savedPosition = game.settings.get(MODULE_ID, "launcherPosition");

  button.style.left = savedPosition?.left ?? "432px";
  button.style.top = savedPosition?.top ?? "851px";

  let hasMoved = false;
  let offsetX = 0;
  let offsetY = 0;

  const onMouseMove = event => {
    hasMoved = true;
    button.style.left = `${event.clientX - offsetX}px`;
    button.style.top = `${event.clientY - offsetY}px`;
    button.classList.add("dragging");
  };

  const onMouseUp = async () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    button.classList.remove("dragging");

    await game.settings.set(MODULE_ID, "launcherPosition", {
      left: button.style.left,
      top: button.style.top
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

    if (plannerApp?.rendered) {
      plannerApp.close();
      return;
    }

    plannerApp = new PlannerNarratifApp();
    plannerApp.render(true);
  });

  document.body.appendChild(button);
});