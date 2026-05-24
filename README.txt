# C3CAD Node.js Projekt (Express)

Dieses Projekt macht deine C3CAD-Webanwendung über einen Node.js-Server mit Express aufrufbar.

## 🚀 Schnellstart

1. **ZIP entpacken**  
   Entpacke `c3cad-node.zip` auf deinem Server oder lokalen Rechner.

2. **In das Projektverzeichnis wechseln**

   ```bash
   cd c3cad-node
   ```

3. **Abhängigkeiten installieren**

   ```bash
   npm install
   ```

4. **Server starten**

   ```bash
   npm start
   ```

5. **Browser öffnen**  
   Gehe zu [http://localhost:3000](http://localhost:3000)

---

## 📁 Struktur

```text
c3cad-node/
├── public/             # Hier liegt deine Webanwendung
│   ├── index.html
│   ├── p5.js           # ← Diese Platzhalter bitte durch echte Dateien ersetzen
│   ├── fu.js
│   ├── cad.js
│   ├── sketch.js
│   ├── fontBase64.js
│   └── c3port.css
├── server.js           # Express-Server
├── package.json        # NPM-Projektdefinition
```

---

## 📌 Hinweise

- Die Datei `index.html` wird automatisch bei jedem Seitenaufruf geladen.
- Falls du den Server öffentlich erreichbar machen willst, verwende z. B. `pm2`, `nginx` oder passe die Firewall an.

Viel Erfolg!
