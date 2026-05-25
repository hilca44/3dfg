# Spickzettel

## Grundidee

Eine Zeile beschreibt ein Projekt, einen Korpus oder ein Teil.
Der Text ist das Projekt.

---

## Projektkopf

`kueche mat.19,wh mat.16,bl`

- `kueche` ist der Projektname
- `mat.19,wh` ist Material 1
- `mat.16,bl` ist Material 2

---

## Korpus

`a p.sl,sr,bo,de,rw,fr breit.60 tief.55 hoch.72`

- `a` ist der Name
- `p.sl,sr,bo,de,rw,fr` sind die Teile
- `breit`, `tief`, `hoch` sind die Maße

---

## Teile

- `sl` linke Seite
- `sr` rechte Seite
- `bo` Boden
- `de` Deckel
- `rw` Rückwand
- `fr` Front
- `eb` Einlegeboden
- `mw` Mittelwand

---

## Position

`x.20`
`y.-5`
`z.10`

---

## Wiederholen

`x.anz.3,55r`
`y.anz.2,5`
`z.anz.4,20`

---

## Cut

`fr.cut.x.2`
`fr.cut.z.3,1`
`sl,mw,sr.cut.y.3,25`

---

## Anpassen

`push.8`
`fr.push.0.4`
`eb.push.2f`
`eb.push.2f,1b`

---

## Verbinden

`b dock`

`b dock.a,,0_b,,3`

---

## Drehen

`dre.z.45`
`sl.dre.z.9`

---

## Komplettbeispiel

`kueche mat.19,wh`
`a p.sl,sr,bo,de,rw,fr breit.60 tief.55 hoch.72`
`b.a x.70 dock`
