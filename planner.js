class PlannerNarratifApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "planner-narratif",
      title: "Planner Narratif",
      width: 400,
      height: 300,
      resizable: true
    });
  }

  async _renderHTML() {
    return `
      <div style="padding:10px;">
        <h2>Hello Ravessandre !</h2>
      </div>
    `;
  }
}

Hooks.once("ready", () => {
  console.log("Planner Narratif chargé !");
});

Hooks.on("getSceneControlButtons", controls => {
  controls.push({
    name: "planner",
    title: "Planner Narratif",
    icon: "fas fa-scroll",
    layer: "tokens",
    tools: [
      {
        name: "open-planner",
        title: "Ouvrir Planner",
        icon: "fas fa-scroll",
        button: true,
        onClick: () => {
          new PlannerNarratifApp().render(true);
        }
      }
    ]
  });
});