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
    "z.B. plrgtbc",
    "Reihenfolge ist wichtig",
    "b back  Rückwand",
    "l left  linke Seite",
    "r right rechte Seite",
    "c cupboard  Einlegeboden",
    "f front Front",
    "g ground Boden",
    "v vertical Mittelwand"
  ],

  a: [
    "Abmessungen",
    "z.B. 40,30,90",
    "Einheit: cm, Breite,Tiefe,Höhe"
  ],

  c: [
    "connect",
    "- standardziel = letzter korpus",
    "ecken vorne: unten-links = 0, dann im uhrzeigersinn 1,2,3",
    "ecken hinten: unten-links = 4, dann im uhrzeigersinn 5,6,7",
    "- example : c",
    "- example : c1  c0_prev1",
    "- example : c0_a2",
    "- example : ct2_ag3"
  ],

  m: [
    "material",
    "m2 mf3",
    "m0=dummy Material, wird nicht berechnet"
  ],

  u: [
    "pushPull",
    "z.B. uf0.3",
    "*z.B.:*",
    "uf0.4 verkleinere die Front 4mm an allen Seiten",
    "u8 (ua8) verkürze den Korpus unten um 8cm + Sockelleiste",
    "uc2f verkürze den Fachboden vorne um 2cm",
    "ucg2f dito Fachboden und Boden"
  ],

  o: [
    "drehen",
    "z.B. o45z oder l.o=9z"
  ],

  n: [
    "Reihe",
    "z.B. n3",
    "Anzahl"
  ],

  s: [
    "teilen",
    "z.B. sf2,0.6",
    "in gleiche Teile teilen"
  ],

  w: [
    "Breite",
    "w40"
  ],

  d: [
    "Tiefe",
    "d23"
  ],

  h: [
    "Höhe",
    "h90"
  ]

};
