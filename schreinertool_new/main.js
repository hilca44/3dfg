import { parseNewDsl } from "./newdsl.js";
import { init3D, addBox, clearScene } from "./view3d.js";

window.run = function () {
  const txt = document.getElementById("input").value;

  const db = parseNewDsl(txt);

  clearScene();

  for (const b of Object.values(db.blocks)) {
    addBox(b);
  }

  document.getElementById("output").textContent =
    JSON.stringify(db, null, 2);
};

window.onload = () => {
  init3D();
};