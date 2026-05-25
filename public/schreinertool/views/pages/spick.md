# Spickzettel

## grundidee

eine zeile = ein korpus oder eine anweisung.  
alles klein schreiben.  
der text ist das projekt.

---

## grundaufbau

### projektkopf

erste zeile = projektname + materialien

beispiel:

`küche m19wh`

oder:

`küche m19wh m16bl m4oc`

---

## korpuszeile

beispiel:

`a pflrgtbc 60,60,80`

- `a` = name  
- `pflrgtbc` = teile  
- `60,60,80` = breite, tiefe, höhe  

---

## wichtigste kommandos

### vererbung und integrierte korpusse

`b.a`

`b` erbt von `a`.

`a.griff`

`griff` ist fest in `a` integriert und wird bei Kopien oder Wiederholungen von `a` mitgenommen.

beispiel:

`a n2y`  
`a.griff pf 12,2,2`

ergibt auch `a1y.griff`.

die alte `+`-gruppenschreibweise wird nicht mehr verwendet.

---

### material

`m19wh`  
`m16bl`  
`m4oc`

---

### teile

`p`  
`plrgtbc`  
`pflrgtbc`

---

### verbinden

`c`

beispiel:

`ba c`

---

### cut

`sc3`  
`sf2`  
`sfz3,1`

---

### ändern / anpassen

`uf0.4`  
`u8g`  
`uc2f`  
`u8gl`

---

### drehen

`o45z`  
`l.o=9z`  

---

### wiederholen

`nx3`  
`nz4,2`

---

## kurzbeispiele

`küche m19wh`  
`a pflrgtbc 60,60,80`

---

`küche m19wh`  
`a pflrgtbc 60,60,80`  
`ba c`

---

# connect

## grundidee

connect richtet einen korpus an einem ziel aus.

- aktueller korpus = die aktuelle zeile  
- zielkorpus = der korpus, an den gefangen wird  

---

## standard

`c`

verbindet mit dem vorherigen korpus.

---

## ecken

### vorne

- `0` unten links  
- `1` unten rechts  
- `2` oben rechts  
- `3` oben links  

### hinten

- `4` unten links  
- `5` unten rechts  
- `6` oben rechts  
- `7` oben links  

---

## ecke auf ecke

klassischer fall.

ein punkt des aktuellen korpus wird auf einen punkt des zielkorpus gesetzt.

---

## kantenmitte

zwei ecken:

- `01` vorne unten  
- `12` vorne rechts  
- `04` links unten tief  

→ mitte der kante

---


## zentrum

gegenüberliegende ecken:

- `06`  
- `17`  
- `24`  
- `35`  

→ zentrum des korpus

---

## typische fälle

### daneben

`a pflrgtbc 60,60,80`  
`ba c`

---

### oben drauf

unten des aktuellen auf oben des ziels

---

### hinten bündig

hinten auf hinten  
(z. b. `4–7` auf `4–7`)

---

### vorne vorsetzen

rückseite auf vorderseite  
(`4–7` auf `0–3`)

---

## wichtig

- current = aktueller korpus  
- target = zielkorpus  

erst fangen, dann optional verschieben.

---

## merkregeln

- `0–3` vorne  
- `4–7` hinten  
- 2 ecken = kante  
- 4 ecken = fläche  
- diagonal = zentrum  

---

## kurzfassung

`c` verbindet  
ecke auf ecke = standard  
hinten auf hinten = bündig  
unten auf oben = stapeln  
links auf rechts = daneben  

---

## beispiel

`küche m19wh`  
`a pflrgtbc 60,60,80`  
`ba c`
