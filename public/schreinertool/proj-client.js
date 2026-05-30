import { expandAliases } from "./alias.js?v=dockparse2";

async function loadProjFromServer(text) {
  const url = "/getProj?text=" + encodeURIComponent(text);
  const res = await fetch(url);
  const raw = await res.text();
  const data = JSON.parse(raw);

  if (!res.ok || data?.ok === false) {
    const err = new Error(data?.error || `getProj failed: ${res.status}`);
    err.data = data;
    err.status = res.status;
    err.line = data?.line;
    err.token = data?.token;
    err.code = data?.code;
    throw err;
  }

  return data;
}

export class Proj {
  constructor(inn) {
    this.inn = expandAliases(inn);
  }

  getall() {
    return loadProjFromServer(this.inn).then(pr => {
      window.PR = pr;
      return pr;
    });
  }
}
