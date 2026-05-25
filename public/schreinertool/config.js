const cfg = {

  // ==========================================
  // BESCHLAG-KATALOG
  // ==========================================
  beschlaege: {

    ts: {
      name: "Topfscharnier 110°",
      hersteller: "haefele",
      artikel_nr: "342.42.660",
      preis_eur: 3.8,
      einheit: "stk"
    },

    tsmp: {
      name: "Montagepl",
      hersteller: "haefele",
      artikel_nr: "342.20.900",
      preis_eur: 1.0,
      einheit: "stk"
    },
    griff_standard: {
      name: "Bügelgriff Edelstahl",
      hersteller: "haefele",
      artikel_nr: "155.00.724",
      preis_eur: 4.80,
      einheit: "stk"
    },

    exzenterverbinder: {
      name: "Exzenterverbinder",
      hersteller: "haefele",
      artikel_nr: "263.14.705",
      preis_eur: 0.9,
      einheit: "stk"
    },

    fachbodentraeger: {
      name: "Fachbodenträger 5 mm",
      hersteller: "haefele",
      artikel_nr: "282.24.720",
      preis_eur: 0.25,
      einheit: "stk"
    },

    "universal-winkel-verbinder": {
      name: "Universal-Winkel-Verbinder",
      hersteller: "haefele",
      artikel_nr: "264.25.929",
      preis_eur: 1.1,
      einheit: "stk"
    }
  },

  // ==========================================
  // REGELN PRO KORPUS-TEIL (c3cad-native)
  // ==========================================
  // f = front
  // n = linke seite
  // r = rechte seite
  // g = ground / boden
  // t = top / deckel
  // b = back / rückwand
  // c = fachboden
  regeln: {

    f: {
      beschlaege: [
        {
          ref: "ts",
          min: 2,
          pro_m2: 4
        },
        {
          ref: "tsmp",
          min: 2,
          pro_m2: 4
        },
        {
          ref: "griff_standard",
          fix: 1
        }
      ]
    },

    g: {
      beschlaege: [
        {
          ref: "exzenterverbinder",
          fix: 4
        }
      ]
    },

    t: {
      beschlaege: [
        {
          ref: "exzenterverbinder",
          fix: 4
        }
      ]
    },

    c: {
      beschlaege: [
        {
          ref: "fachbodentraeger",
          fix: 4
        }
      ]
    },

    b: {
      beschlaege: [
        {
          ref: "universal-winkel-verbinder",
          pro_m2: 4
        }
      ]
    },

    n: {},   // linke seite – keine beschläge
    r: {}    // rechte seite – keine beschläge
  }
};

const CMD = {

  p: [
    "Teile",
    "z.B. p.sl,sr,bo,de,rw,fr",
    "Reihenfolge ist wichtig",
    "rw Rückwand",
    "sl linke Seite",
    "sr rechte Seite",
    "eb Einlegeboden",
    "fr Front",
    "bo Boden",
    "mw Mittelwand"
  ],

  a: [
    "Abmessungen",
    "z.B. 40,30,90",
    "Einheit: cm, Breite,Tiefe,Höhe"
  ],

  c: [
    "dock",
    "- standardziel = letzter korpus",
    "ecken vorne: unten-links = 0, dann im uhrzeigersinn 1,2,3",
    "ecken hinten: unten-links = 4, dann im uhrzeigersinn 5,6,7",
    "- beispiel: dock",
    "- beispiel: dock.a,,0_b,,3"
  ],

  m: [
    "material",
    "mat.1",
    "mat.19,wh"
  ],

  u: [
    "push",
    "z.B. fr.push.0.3",
    "*z.B.:*",
    "fr.push.0.4 verkleinert die Front 4mm an allen Seiten",
    "push.8 verkürzt den Korpus unten um 8cm",
    "eb.push.2f verkürzt den Fachboden vorne um 2cm"
  ],

  o: [
    "drehen",
    "z.B. dre.z.45 oder sl.dre.z.9"
  ],

  n: [
    "Reihe",
    "z.B. x.anz.3",
    "Anzahl"
  ],

  s: [
    "cut",
    "z.B. fr.cut.x.2,0.6",
    "in gleiche Teile schneiden"
  ],

  w: [
    "Breite",
    "breit.40"
  ],

  d: [
    "Tiefe",
    "tief.23"
  ],

  h: [
    "Höhe",
    "hoch.90"
  ]

};
