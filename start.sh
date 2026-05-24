#!/bin/bash

echo "🔄 Starte C3CAD Node.js Server..."

# Projektverzeichnis ermitteln
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Node.js Abhängigkeiten installieren (falls noch nicht vorhanden)
if [ ! -d "node_modules" ]; then
  echo "📦 Installiere Abhängigkeiten..."
  npm install
fi

# Server starten
echo "🚀 Starte Server unter http://localhost:3000"
node server.js
