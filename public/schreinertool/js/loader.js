function loadPage(name) {
  fetch(`content/${name}.html`)
    .then(res => res.ok ? res.text() : "Seite nicht gefunden")
    .then(html => document.getElementById('content').innerHTML = html);
}

function route() {
  const hash = location.hash.slice(1) || 'tut';
  loadPage(hash);
}

window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);