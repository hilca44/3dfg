// routes/blockEditor.js
import express from "express";

const router = express.Router();

/*
  Erwartet:
  - getCurrentProject()  → liefert pr
  - splitLineToBlocks()  → zerlegt eine Korpuszeile
  - COMMAND_DICT         → Dictionary der Befehle
*/

import { getCurrentProject } from "../project.js";
import { splitLineToBlocks, COMMAND_DICT } from "../project.js";

/* --------------------------------------------------
   GET /block-editor?corpus=a
-------------------------------------------------- */
router.get("/", (req, res) => {
  const corpusName = req.query.corpus;

  if (!corpusName) {
    return res.status(400).send("missing corpus parameter");
  }

  const pr = getCurrentProject();
  const line = pr.pp?.[corpusName];

  if (!line) {
    return res.status(404).send("corpus not found");
  }

  const html = renderBlockEditorHTML(corpusName, line);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

/* --------------------------------------------------
   Block-Editor HTML Renderer
-------------------------------------------------- */
function renderBlockEditorHTML(corpusName, line) {
  const blocks = splitLineToBlocks(line);

  let html = `
    <div class="block-editor" data-corpus="${corpusName}">
  `;

  blocks.forEach((b, i) => {
    html += `
      <div class="block-row">
        <div class="block-label">
          ${b.label}
          <button class="info"
            onclick="openCommandHelp('${b.cmd}')">?</button>
        </div>

        <div class="block-input">
          <span class="cmd">${b.cmd}</span>
          <input
            type="text"
            value="${escapeHTML(b.args)}"
            data-index="${i}">
        </div>
      </div>
    `;
  });

  // Neuer Befehl
  html += `
    <div class="block-row new-block">
      <div class="block-label">Neuer Befehl</div>
      <div class="block-input">
        <select id="newCmd">
          ${renderCommandOptions()}
        </select>
        <input type="text" id="newArgs">
      </div>
    </div>
  `;

  // Kommentar
  html += `
    <div class="block-row comment">
      <div class="block-label"># Kommentar</div>
      <div class="block-input">
        <span class="cmd">#</span>
        <input type="text" value="${escapeHTML(line.comment || "")}">
      </div>
    </div>
  `;

  html += `</div>`;
  return html;
}

/* --------------------------------------------------
   Helpers
-------------------------------------------------- */
function escapeHTML(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderCommandOptions() {
  return Object.entries(COMMAND_DICT)
    .map(([k, v]) =>
      `<option value="${k}">${k} – ${v}</option>`
    )
    .join("");
}

export default router;
