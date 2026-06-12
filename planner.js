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

function canUserModifyItem(item) {
  return game.user.isGM || item?.type === "player" || item?.type === "slot";
}

function getTimeline() {
  return game.settings.get(MODULE_ID, "timeline") ?? [];
}

async function saveTimeline(timeline) {
  if (!game.user.isGM) return;

  await game.settings.set(MODULE_ID, "timeline", timeline);

  plannerApp?._refreshTimelineOnly();

  game.socket.emit(`module.${MODULE_ID}`, {
    type: "state-updated"
  });
}

function requestAddToTimeline(itemId) {
  const item = demoPool.find(p => p.id === itemId);
  if (!item) return;

  if (!canUserModifyItem(item)) {
    ui.notifications.warn("Seul le MJ peut ajouter les PNJ et monstres.");
    return;
  }

  if (game.user.isGM) {
    return addToTimeline(itemId);
  }

  game.socket.emit(`module.${MODULE_ID}`, {
    type: "request-add",
    itemId
  });
}

function requestRemoveFromTimeline(index) {
  const timeline = getTimeline();
  const item = timeline[index];

  if (!item) return;

  if (!canUserModifyItem(item)) {
    ui.notifications.warn("Seul le MJ peut retirer les PNJ et monstres.");
    return;
  }

  if (game.user.isGM) {
    return removeFromTimeline(index);
  }

  game.socket.emit(`module.${MODULE_ID}`, {
    type: "request-remove",
    index
  });
}

async function addToTimeline(itemId) {
  if (!game.user.isGM) return;

  const item = demoPool.find(p => p.id === itemId);
  if (!item) return;

  const timeline = getTimeline();

  timeline.push({
    ...item,
    occurrenceId: foundry.utils.randomID()
  });

  await saveTimeline(timeline);
}

async function removeFromTimeline(index) {
  if (!game.user.isGM) return;

  const timeline = getTimeline();

  if (index < 0 || index >= timeline.length) return;

  timeline.splice(index, 1);

  await saveTimeline(timeline);
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
    return $(`
      <section class="planner-shell">
        <header class="planner-header">
          <strong>Planner Narratif</strong>
          <span>V0.16</span>
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
              ${this._renderTimeline()}
            </div>
          </section>
        </main>
      </section>
    `);
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on("dblclick", ".planner-chip-pool", event => {
      event.preventDefault();
      event.stopPropagation();

      const id = event.currentTarget.dataset.id;
      requestAddToTimeline(id);
    });

    html.on("click", ".planner-chip-timeline", event => {
      if (event.detail !== 3) return;

      event.preventDefault();
      event.stopPropagation();

      const index = Number(event.currentTarget.dataset.index);
      requestRemoveFromTimeline(index);
    });
  }

  _renderTimeline() {
    const timeline = getTimeline();
    return timeline
      .map((item, index) => this._renderChip(item, "timeline", index))
      .join("");
  }

  _refreshTimelineOnly() {
    if (!this.rendered) return;

    this.element.find(".planner-timeline").html(this._renderTimeline());
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
  console.log("Planner Narratif | Ready V0.16");

  game.socket.on(`module.${MODULE_ID}`, async data => {
    if (!data?.type) return;

    if (data.type === "state-updated") {
      plannerApp?._refreshTimelineOnly();
      return;
    }

    if (!game.user.isGM) return;

    if (data.type === "request-add") {
      await addToTimeline(data.itemId);
      return;
    }

    if (data.type === "request-remove") {
      await removeFromTimeline(data.index);
    }
  });

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