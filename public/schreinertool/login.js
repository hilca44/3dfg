document.getElementById("loginForm")?.addEventListener("submit", async event => {
  event.preventDefault();

  const status = document.getElementById("status");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  status.textContent = "Login läuft ...";

  const res = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    status.textContent = data.error || "Login fehlgeschlagen.";
    return;
  }

  status.textContent = "Login erfolgreich. Galerie wird geöffnet ...";
  location.href = "/gallery?mine=1";
});
