export const baseCommands = [
  ["mat.", "Material definieren"],
  ["mat.19,cornflowerblue,16", "Material mit Farbnamen"],
  ["mat.1", "Material 1"],
  ["p.sl,sr,bo,de", "Minimal: Seiten, Boden, Deckel"],
  ["p.fr,rw,bo,de,sl,sr", "Teileliste"],
  ["breit.", "Breite"],
  ["tief.40", "Tiefe"],
  ["hoch.72", "Hoehe"],
  ["rw.mat.1", "Rueckwand Material 1"],
  ["fr.mat.1", "Front Material 1"],
  ["x.4", "Position X absolut"],
  ["x.+4", "Position X relativ"],
  ["x.anz.4,g1", "Reihe in X-Richtung"],
  ["x.anz.4,55r", "Reihe mit 55 Rasterabstand"],
  ["dre.z.90", "um 90 Grad in Z drehen"],
  ["sl.dre.z.9", "linke Seite um 9 Grad in Z drehen"],
  ["cur=,,", "aktueller Verbindungspunkt"],
  ["tar=,,", "Ziel-Verbindungspunkt"],
  ["fr.teilen.x.3,5", "Front in X-Richtung teilen"],
  ["fr.teilen.x.20,30,rest", "Front ungleich in X-Richtung teilen"],
  ["fr.teilen.z.arr.20,30", "Front ungleich in Z-Richtung teilen"],
  ["sl,mw,sr.teilen.y.3,25", "Teilegruppe in Y-Richtung teilen"],
  ["teilen.", "teilen.[x|y|z]],[anzahl,[abstand:<zahl>a|raster:<zahl>r]"],

  ["z.anz.4,g20", "in Z-Richtung als Reihe"],
  ["copy.z.7", "in Z-Richtung kopieren"],
  ["dock.a,,0_b,,3", "an einen Zielpunkt andocken"]
];

export const materialSuggest = {
  thickness: [
    ["16", "16 mm"],
    ["19", "19 mm"],
    ["22", "22 mm"],
    ["25", "25 mm"],
    ["38", "38 mm"]
  ],
  price: [
    ["14", "14 Eur/qm"],
    ["16", "16 Eur/qm"],
    ["22", "22 Eur/qm"],
    ["28", "28 Eur/qm"]
  ],
  edgePrice: [
    ["0.65", "0,65 Eur/m Kante"],
    ["0.8", "0,80 Eur/m Kante"],
    ["1", "1 Eur/m Kante"],
    ["1.2", "1,20 Eur/m Kante"]
  ]
};
