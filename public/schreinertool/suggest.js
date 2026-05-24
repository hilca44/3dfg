export const baseCommands = [
[ 
[ 
  ["sl.", "Seite links"],
  ["sr.", "Seite rechts"],
  ["bo.", "Boden"],
  ["de.", "Deckel"],
  ["fr.", "Front"],
  ["rw.", "Rueckwand"],
],"Teilebezeichnungen"
],
  ["mat.", "Material definieren"],
  ["mat.19,cornflowerblue,16", "Material mit Farbnamen"],
  ["mat.1", "Material 1"],
  ["p.sl,sr,bo,de", "Minimal: Seiten, Boden, Deckel"],
  ["p.fr,rw,bo,de,sl,sr", "Teileliste"],
  ["breit.", "Breite"],
  ["tief.40", "Tiefe"],
  ["rw.mat.1", "Rueckwand Material 1"],
  ["fr.mat.1", "Front Material 1"],
  ["x.4", "Position X absolut"],
  ["x.+4", "Position X relativ"],
  ["x.anz.4,g1", "Reihe in X-Richtung"],
  ["x.anz.4,55r", "Reihe mit 55 Rasterabstand"],
  ["dre.z.90", "um 90 Grad in Z drehen"],
  ["hoch", "Höhe"],
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

export const parameterOptionsByProperty = {
  hoch: [
    ["", "zahl"],
    ["2", "Material 2"],
    ["3", "Material 3"]
  ],
}



// const parameterOptionsByProperty = {
//   hoch: [
//     ["1", "Material 1"],
//     ["2", "Material 2"],
//     ["3", "Material 3"]
//   ],
//   mat: [
//     ["1", "Material 1"],
//     ["2", "Material 2"],
//     ["3", "Material 3"]
//   ],
//   o: [
//     ["9", "9 Grad, z-Achse default"],
//     ["45", "45 Grad, z-Achse default"],
//     ["90", "90 Grad, z-Achse default"],
//     ["-45", "-45 Grad, z-Achse default"],
//     ["45x", "45 Grad um x"],
//     ["45y", "45 Grad um y"],
//     ["45z", "45 Grad um z"]
//   ],
//   u: [
//     ["2f", "2 cm vorne"],
//     ["2b", "2 cm hinten"],
//     ["2f,1b", "vorne und hinten"],
//     ["8g", "8 cm unten"]
//   ],
//   x: defaultParameterOptions,
//   y: defaultParameterOptions,
//   z: defaultParameterOptions,
//   wdh: [
//     ["1", "1 cm"],
//     ["2", "2 cm"],
//     ["5", "5 cm"],
//     ["10", "10 cm"]
//   ],
//   w: [
//     ["40", "40 cm"],
//     ["60", "60 cm"],
//     ["80", "80 cm"],
//     ["120", "120 cm"]
//   ],
//   breit: [
//     ["40", "40 cm"],
//     ["60", "60 cm"],
//     ["80", "80 cm"],
//     ["120", "120 cm"]
//   ],
//   d: [
//     ["30", "30 cm"],
//     ["40", "40 cm"],
//     ["60", "60 cm"]
//   ],
//   tief: [
//     ["30", "30 cm"],
//     ["40", "40 cm"],
//     ["60", "60 cm"]
//   ],
//   hoch: [
//     ["30", "30 cm"],
//     ["72", "72 cm"],
//     ["100", "100 cm"],
//     ["200", "200 cm"]
//   ],
//   s: [
//     ["1.6", "16 mm"],
//     ["1.9", "19 mm"],
//     ["2.5", "25 mm"],
//     ["3.8", "38 mm"]
//   ],
//   stk: [
//     ["1.6", "16 mm"],
//     ["1.9", "19 mm"],
//     ["2.5", "25 mm"],
//     ["3.8", "38 mm"]
//   ],
//   sx: [
//     ["2", "in 2 Teile"],
//     ["3", "in 3 Teile"],
//     ["3,5", "3 Teile, Abstand 5"]
//   ],
//   sy: [
//     ["2", "in 2 Teile"],
//     ["3", "in 3 Teile"],
//     ["2,1", "2 Teile, Abstand 1"]
//   ],
//   sz: [
//     ["2", "in 2 Teile"],
//     ["4,2", "4 Teile, Abstand 2"]
//   ],
//   co: [
//     ["white", "White"],
//     ["wheat", "Wheat"],
//     ["cornflowerblue", "Cornflower Blue"],
//     ["gray", "Gray"]
//   ],
//   n: [
//     ["2", "2 Wiederholungen"],
//     ["3", "3 Wiederholungen"],
//     ["4", "4 Wiederholungen"]
//   ],
//   nz: [
//     ["2", "2 in z"],
//     ["3", "3 in z"],
//     ["4", "4 in z"]
//   ]
// };


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
