let plannerApp = null;

class PlannerNarratifDialog extends Dialog {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "planner-narratif-window",
      title: "Planner Narratif",
      width: 520,
      height: "auto",
      resizable: true,
      top: 120,
      left: 90
    });
  }
}

Hooks.once("init", () => {
  game.settings.register("planner-narratif", "launcherPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: {
      left: "550px",
      top: "851px"
    }
  });
});

Hooks.once("ready", () => {
  ui.notifications.info("Planner Narratif chargé !");
  console.log("Planner Narratif | Ready");

  document.getElementById("planner-narratif-launcher")?.remove();

  const button = document.createElement("button");
  button.id = "planner-narratif-launcher";
  button.title = "Planner Narratif";
  button.innerText = "⚔";

  const savedPosition = game.settings.get(
    "planner-narratif",
    "launcherPosition"
  );

  button.style.left = savedPosition?.left ?? "432px";
  button.style.top = savedPosition?.top ?? "851px";

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  button.addEventListener("mousedown", event => {
    isDragging = true;

    offsetX = event.clientX - button.offsetLeft;
    offsetY = event.clientY - button.offsetTop;

    button.classList.add("dragging");
  });

  document.addEventListener("mousemove", event => {
    if (!isDragging) return;

    button.style.left = `${event.clientX - offsetX}px`;
    button.style.top = `${event.clientY - offsetY}px`;
  });

  document.addEventListener("mouseup", async () => {
    if (!isDragging) return;

    isDragging = false;
    button.classList.remove("dragging");

    await game.settings.set(
      "planner-narratif",
      "launcherPosition",
      {
        left: button.style.left,
        top: button.style.top
      }
    );
  });

  button.addEventListener("dblclick", event => {
    event.preventDefault();
    event.stopPropagation();

    if (plannerApp?.rendered) {
      plannerApp.close();
      plannerApp = null;
      return;
    }

    plannerApp = new PlannerNarratifDialog({
      title: "Planner Narratif",
      content: `
        <div class="planner-narratif-content">
          <h2>Hello Ravessandre !</h2>
          <p>Le Planner Narratif est vivant.</p>
        </div>
      `,
      buttons: {
        close: {
          label: "Fermer"
        }
      }
    });

    plannerApp.render(true);

    plannerApp._onClose = () => {
      plannerApp = null;
    };
  });

  document.body.appendChild(button);
});