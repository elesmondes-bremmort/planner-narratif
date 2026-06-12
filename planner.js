Hooks.once("ready", () => {
  ui.notifications.info("Planner Narratif chargé !");
  console.log("Planner Narratif | Ready");

  const existing = document.getElementById("planner-narratif-launcher");
  if (existing) existing.remove();

  const button = document.createElement("button");
  button.id = "planner-narratif-launcher";
  button.innerText = "⚔ Planner";

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const savedPosition = game.settings.get("planner-narratif", "launcherPosition");
  if (savedPosition) {
    button.style.left = savedPosition.left;
    button.style.top = savedPosition.top;
  }

  button.addEventListener("mousedown", event => {
    isDragging = true;
    offsetX = event.clientX - button.offsetLeft;
    offsetY = event.clientY - button.offsetTop;
  });

  document.addEventListener("mousemove", event => {
    if (!isDragging) return;

    button.style.left = `${event.clientX - offsetX}px`;
    button.style.top = `${event.clientY - offsetY}px`;
  });

  document.addEventListener("mouseup", async () => {
    if (!isDragging) return;
    isDragging = false;

    await game.settings.set("planner-narratif", "launcherPosition", {
      left: button.style.left,
      top: button.style.top
    });
  });

  button.addEventListener("click", event => {
    if (isDragging) return;

    new Dialog({
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
    }, {
      top: 120,
      left: 90,
      width: 520
    }).render(true);
  });

  document.body.appendChild(button);
});

Hooks.once("init", () => {
  game.settings.register("planner-narratif", "launcherPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: {
      left: "90px",
      top: "90px"
    }
  });
});