const MODULE_ID = "planner-narratif";
let plannerApp = null;

const demoPool = [
  { id: "alaric", label: "A", name: "Alaric", type: "player" },
  { id: "kaelyss", label: "K", name: "Kaelyss", type: "player" },
  { id: "torvek", label: "T", name: "Torvek", type: "player" },

  { id: "garde-1", label: "G1", name: "Garde 1", type: "npc" },
  { id: "garde-2", label: "G2", name: "Garde 2", type: "npc" },

  { id: "bandit-1", label: "B1", name: "Bandit 1", type: "monster" },
  { id: "bandit-2", label: "B2", name: "Bandit 2", type: "monster" },
  { id: "ogre", label: "OG", name: "Ogre", type: "monster" },

  { id: "player-slot", label: "J", name: "Slot Joueur", type: "slot" }
];

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
    const timeline = game.settings.get(MODULE_ID, "timeline") ?? [];

    return $(`
      <section class="planner-shell">
        <header class="planner-header">
          <strong>Planner Narratif</strong>
          <div class="planner-header-actions">
            <button type="button" class="planner-refresh">↻ Actualiser</button>
            ${game.user.isGM ? `<button type="button" class="planner-reset">Reset Timeline</button>` : ""}
            <span>V0.18</span>
          </div>
        </header>

        <main class="planner-body">
          <section class="planner-section">
            <h3>POOL</h3>
            <div class="planner-pool">
              ${demoPool.map(item => this._renderChip(item, "pool")).join("")}
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

    html.find(".planner-reset").on("click", async () => {
      if (!game.user.isGM) return;

      const confirmReset = await Dialog.confirm({
        title: "Reset Timeline",
        content: "<p>Vider entièrement la timeline ?</p>",
        yes: () => true,
        no: () => false,
        defaultYes: false
      });

      if (!confirmReset) return;

      await game.settings.set(MODULE_ID, "timeline", []);
      this.render(false);
    });

    html.find(".planner-chip-pool").on("dblclick", async event => {
      if (!game.user.isGM) {
        ui.notifications.warn("Seul le MJ peut modifier la timeline pour l'instant.");
        return;
      }

      const id = event.currentTarget.dataset.id;
      const item = demoPool.find(p => p.id === id);
      if (!item) return;

      const timeline = game.settings.get(MODULE_ID, "timeline") ?? [];

      timeline.unshift({
        ...item,
        occurrenceId: foundry.utils.randomID()
      });

      await game.settings.set(MODULE_ID, "timeline", timeline);
      this.render(false);
    });

    html.find(".planner-chip-timeline").on("click", async event => {
      if (event.detail !== 3) return;

      if (!game.user.isGM) {
        ui.notifications.warn("Seul le MJ peut modifier la timeline pour l'instant.");
        return;
      }

      const index = Number(event.currentTarget.dataset.index);
      const timeline = game.settings.get(MODULE_ID, "timeline") ?? [];

      if (index < 0 || index >= timeline.length) return;

      timeline.splice(index, 1);

      await game.settings.set(MODULE_ID, "timeline", timeline);
      this.render(false);
    });

    if (game.user.isGM) {
      html.find(".planner-chip-timeline").attr("draggable", true);

      html.find(".planner-chip-timeline").on("dragstart", event => {
        event.originalEvent.dataTransfer.setData(
          "text/plain",
          event.currentTarget.dataset.index
        );

        event.currentTarget.classList.add("planner-dragging");
      });

      html.find(".planner-chip-timeline").on("dragend", event => {
        event.currentTarget.classList.remove("planner-dragging");
      });

      html.find(".planner-chip-timeline").on("dragover", event => {
        event.preventDefault();
      });

      html.find(".planner-chip-timeline").on("drop", async event => {
        event.preventDefault();

        const fromIndex = Number(event.originalEvent.dataTransfer.getData("text/plain"));
        const toIndex = Number(event.currentTarget.dataset.index);

        if (Number.isNaN(fromIndex) || Number.isNaN(toIndex)) return;
        if (fromIndex === toIndex) return;

        const timeline = game.settings.get(MODULE_ID, "timeline") ?? [];

        const [moved] = timeline.splice(fromIndex, 1);
        timeline.splice(toIndex, 0, moved);

        await game.settings.set(MODULE_ID, "timeline", timeline);
        this.render(false);
      });
    }
  }

  _renderChip(item, zone, index = null) {
    const indexAttr = index === null ? "" : `data-index="${index}"`;

    return `
      <button
        class="planner-chip planner-chip-${item.type} planner-chip-${zone}"
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

  game.settings.register(MODULE_ID, "timeline", {
    scope: "world",
    config: false,
    type: Object,
    default: []
  });
});

Hooks.once("ready", () => {
  console.log("Planner Narratif | Ready V0.18");

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