let plannerApp = null;

const demoPool = [
  { id: "alaric", label: "A", name: "Alaric", type: "player" },
  { id: "kaelyss", label: "K", name: "Kaelyss", type: "player" },
  { id: "torvek", label: "T", name: "Torvek", type: "player" },
  { id: "bandit-1", label: "B1", name: "Bandit 1", type: "npc" },
  { id: "bandit-2", label: "B2", name: "Bandit 2", type: "npc" },
  { id: "ogre", label: "OG", name: "Ogre", type: "npc" },
  { id: "player-slot", label: "J", name: "Slot Joueur", type: "slot" }
];

class PlannerNarratifApp extends Application {
  static get defaultOptions() {
    const saved = game.settings.get("planner-narratif", "windowState") ?? {};

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
  const timeline = this._getTimeline();

  return $(`
    <section class="planner-shell">
      <header class="planner-header">
        <strong>Planner Narratif</strong>
        <span>V0.11</span>
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
  this._bindPlannerEvents();
}

  _refreshContentOnly() {
    if (!this.rendered) return;

    const poolEl = this.element.find(".planner-pool");
    const timelineEl = this.element.find(".planner-timeline");

    poolEl.html(demoPool.map(item => this._renderChip(item, "pool")).join(""));

    const timeline = this._getTimeline();
    timelineEl.html(timeline.map((item, index) => this._renderChip(item, "timeline", index)).join(""));

    this._bindPlannerEvents();
  }

  _bindPlannerEvents() {
    this.element.find(".planner-chip-pool").off("click").on("click", async event => {
      const id = event.currentTarget.dataset.id;
      const item = demoPool.find(p => p.id === id);
      if (!item) return;

      const timeline = this._getTimeline();

      timeline.push({
        ...item,
        occurrenceId: foundry.utils.randomID()
      });

      await this._setTimeline(timeline);
    });

    this.element.find(".planner-chip-timeline").off("click").on("click", async event => {
      if (event.detail !== 3) return;

      const index = Number(event.currentTarget.dataset.index);
      const timeline = this._getTimeline();

      timeline.splice(index, 1);

      await this._setTimeline(timeline);
    });
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

  _getTimeline() {
    return game.settings.get("planner-narratif", "timeline") ?? [];
  }

  async _setTimeline(timeline) {
    await game.settings.set("planner-narratif", "timeline", timeline);

    this._refreshContentOnly();

    game.socket.emit("module.planner-narratif", {
      type: "timeline-updated"
    });
  }

  async close(options = {}) {
    const el = this.element?.[0];

    if (el) {
      await game.settings.set("planner-narratif", "windowState", {
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
  game.settings.register("planner-narratif", "launcherPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: {
      left: "432px",
      top: "851px"
    }
  });

  game.settings.register("planner-narratif", "windowState", {
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

  game.settings.register("planner-narratif", "timeline", {
    scope: "world",
    config: false,
    type: Object,
    default: []
  });
});

Hooks.once("ready", () => {
  ui.notifications.info("Planner Narratif chargé !");
  console.log("Planner Narratif | Ready V0.11");

  game.socket.on("module.planner-narratif", data => {
    if (data?.type !== "timeline-updated") return;
    plannerApp?._refreshContentOnly();
  });

  document.getElementById("planner-narratif-launcher")?.remove();

  const button = document.createElement("button");
  button.id = "planner-narratif-launcher";
  button.title = "Planner Narratif";
  button.innerText = "⚔";

  const savedPosition = game.settings.get("planner-narratif", "launcherPosition");

  button.style.left = savedPosition?.left ?? "432px";
  button.style.top = savedPosition?.top ?? "851px";

  let isDragging = false;
  let hasMoved = false;
  let offsetX = 0;
  let offsetY = 0;

  button.addEventListener("mousedown", event => {
    isDragging = true;
    hasMoved = false;

    offsetX = event.clientX - button.offsetLeft;
    offsetY = event.clientY - button.offsetTop;

    button.classList.add("dragging");
  });

  document.addEventListener("mousemove", event => {
    if (!isDragging) return;

    hasMoved = true;
    button.style.left = `${event.clientX - offsetX}px`;
    button.style.top = `${event.clientY - offsetY}px`;
  });

  document.addEventListener("mouseup", async () => {
    if (!isDragging) return;

    isDragging = false;
    button.classList.remove("dragging");

    await game.settings.set("planner-narratif", "launcherPosition", {
      left: button.style.left,
      top: button.style.top
    });
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