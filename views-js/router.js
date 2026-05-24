const routes = {
  main: "/views/main/",
  editor: "/views/editor/",
  gallery: "/views/gallery/"
};

async function loadView(name){

  const base = routes[name] || routes.main;

  // HTML laden
  const html = await fetch(base + "view.html")
                     .then(r => r.text());

  const view = document.getElementById("view");
  view.innerHTML = html;

  // JS laden
  const module = await import(base + "view.js");

  if (module.init) module.init();
}

function router(){

  const params = new URLSearchParams(location.search);

  const view = params.get("view") || "main";

  loadView(view);
}

window.addEventListener("popstate", router);
window.addEventListener("load", router);

export function go(view){

  history.pushState({}, "", "?view=" + view);

  loadView(view);
}