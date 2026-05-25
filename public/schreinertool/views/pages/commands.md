# schreinertool Referenz

Diese Seite beschreibt die Eigenschaften der Zeichnungssprache. Ein Projekt besteht aus Textzeilen. Die erste Zeile beschreibt das Projekt, jede weitere Zeile beschreibt einen Korpus oder ein Teil.

## Grundform

`projektname mat.19,wh` - Projektzeile mit Name und Material.

`a p.sl,sr,bo,de,rw,eb breit.80 tief.40 hoch.72` - Korpus `a` mit Teilen, Breite, Tiefe und Höhe.

`b dock.a,,0_b,,3 breit.40 tief.40 hoch.72` - Korpus `b`, verbunden mit Korpus `a`.

Eine Zeile beginnt mit dem Namen, danach folgen Eigenschaften.

`a breit.80 tief.40 hoch.72` - Korpus `a` mit expliziten Maßen.

Viele Eigenschaften haben Kurzformen. Diese beiden Zeilen sind gleich gemeint:

`a breit.80 tief.40 hoch.72` - ausgeschriebene Maße.

`a 80,40,72` - kurze Schreibweise für dieselben Maße.

## Vererbung und integrierte Korpusse

Ein Korpus kann von einem anderen Korpus erben. Dabei steht der neue Name vor dem Punkt, der vorhandene Korpus nach dem Punkt.

`b.a x.100` - Korpus `b` erbt von `a` und bekommt zusätzlich `x.100`.

Ein Korpus kann auch fest in einen anderen Korpus integriert werden. Dafür steht der Parent vor dem Punkt.

`a.griff p.fr breit.12 tief.2 hoch.2 x.40 y.-2 z.36` - `griff` gehört fest zu `a`.

Wird `a` später kopiert oder wiederholt, wird `a.griff` automatisch mitkopiert.

`a n2y` - erzeugt `a` und `a1y`.

`a.griff ...` - erzeugt zusätzlich `a.griff` und `a1y.griff`.

Auch geerbte Korpusse nehmen integrierte Kinder mit:

`b.a x.100` - erzeugt neben `b` auch `b.griff`, wenn `a.griff` existiert.

Die alte Gruppen-Schreibweise mit `+`, zum Beispiel `b.a+`, `ba+` oder `b+a`, wird nicht mehr verwendet.

## Zahlen

- `3` absoluter Wert
- `+3` relativer Wert
- `+-3` relativer negativer Wert
- `3,5,7` Liste

Maße werden in Zentimetern angegeben. Materialstärken in der Projektzeile werden in Millimetern geschrieben.

## Erste Zeile

`test_regal mat.19,wh mat.8,gr` - Projektname mit zwei Materialien.

Die erste Zeile enthält:

- Projektname
- Materialien
- optionale Projektwerte wie `xx`, `xy`, `xz`
- optionale Standardwerte, die für Korpusse gelten

`mat.19,wh` - Material 1, 19 mm stark, Farbe `wh`.

`mat.19,dunkelblau,16` - Material mit sprechendem Farbnamen, 19 mm stark, Farbe dunkelblau, Preis 16.

## Teile

`p` legt fest, welche Teile ein Korpus enthält. `p` gehört nur an den Korpus, nicht an einzelne Teile. Die Reihenfolge ist wichtig.

`a p.sl,sr,bo,de,rw,eb` - Korpus `a` mit Seiten, Boden, Deckel, Rückwand und Einlegeboden.

Neue Schreibweise:

`a p.sl,sr,bo,de,rw,eb` - Teileliste mit 2-Zeichen-Teilkürzeln.

Teilkürzel:

- `sl` linke Seite
- `sr` rechte Seite
- `bo` Boden
- `de` Deckel
- `rw` Rückwand
- `fr` Front
- `eb` Einlegeboden
- `mw` Mittelwand

## Richtungen

- `x` links/rechts
- `y` vorne/hinten
- `z` unten/oben
- `l` links
- `r` rechts
- `g` unten
- `t` oben
- `b` hinten
- `f` vorne

## Eigenschaften

- `p` Teile des Korpus
- `w` Breite
- `d` Tiefe
- `h` Höhe
- `x` Position in x-Richtung
- `y` Position in y-Richtung
- `z` Position in z-Richtung
- `m` Material
- `nx`, `ny`, `nz` Wiederholung
- `sx`, `sy`, `sz` Teilung
- `layout`, `cols` Innenaufteilung
- `u` Verkleinern oder Erweitern
- `i` Verbinden
- `fit` an zwei Punkte anpassen
- `o` Drehen
- `vi` Darstellung
- `#` Kommentar
- `-` Zeile oder Eigenschaft deaktivieren

## Kürzel-System

Die Sprache trennt kurze Namen optisch nach Länge:

- 2 Zeichen: Objekt, Bauteil oder Richtung
- mehr als 2 Zeichen: Eigenschaft, Aktion, Werkzeug oder Befehl

Damit bleiben Teile kompakt, während Befehle und Eigenschaften als gut lesbare Schlagwörter erscheinen.

Wichtige Schlagwörter:

- `mat` Material
- `breit` Breite
- `tief` Tiefe
- `hoch` Höhe
- `anz` Stärke
- `reihe` wiederholen als Reihe
- `sta` stapeln
- `dock` andocken
- `aus` ausrichten
- `zen` zentrieren
- `dre` drehen
- `cut` schneiden / teilen
- `copy` kopieren
- `push` Einzug / Überstand

Beispiele im neuen Raster:

`a.fr.zie.v.2`

`a.rw.drk.h.1`

`a.de.dre.z.90`

`a.copy.z.7`

`a.fr.cut.y.3,25`

Das liest sich wie eine kleine CAD-Maschinensprache: erst Objekt, dann Aktion, dann Richtung oder Wert.

Mehrere Teile können vor einem Befehl als Gruppe stehen:

`sl,mw,sr.cut.y.3,25` - linke Seite, Mittelwand und rechte Seite in y schneiden.

Ungleiche Teilung geht mit einer Werte-Liste:

`fr.cut.x.20,30,rest` - Front in x in 20, 30 und Rest schneiden.

`fr.cut.x.20,g2,30,rest` - wie oben, mit 2 Abstand zwischen den Stücken.

Optional kann es explizit als Array markiert werden: `fr.cut.x.arr.20,30,rest`. Mit `arr` gehen auch nur zwei Werte: `fr.cut.z.arr.20,30`. Stückmaße ab 10 werden bei zwei Werten ebenfalls als ungleiche Teilung gelesen: `fr.cut.z.20,30`.

Punktwerte gehen vom Groben zum Feinen:

- `x.4` absolute Position x = 4
- `x.4,16,44` mehrere absolute x-Positionen
- `x.+4` relative x-Verschiebung
- `x.+4,4,4,4` mehrere relative x-Schritte
- `x.anz.4,g1` Reihe in x: Anzahl 4, Abstand 1
- `x.anz.4,55r` Reihe in x: Anzahl 4, Rasterabstand 55

Dasselbe Prinzip gilt für `y`, `z`, `breit`, `tief` und `hoch`, auch an Teilen: `fr.x.4`, `fr.breit.40`, `sl.hoch.n2,g1`.

## Autokonvertierung

Alter Code wird beim Laden und beim Anwenden im Textmodus automatisch in das neue Raster umgewandelt.

Sichere Umwandlungen:

- `nx=3,10` wird `x.anz.3,g10`
- `ny=2,5` wird `y.anz.2,g5`
- `nz=4,20` wird `z.anz.4,g20`
- `p=fbgtlr` wird `p.fr,rw,bo,de,sl,sr`
- `w=120 d=80 h=180` wird `breit.120 tief.80 hoch.180`
- `rw.m=2 rw.w=40` wird `rw.mat.2 rw.breit.40`
- `f.sx=3,5` wird `fr.cut.x.3,5`
- `f.sy=2,1` wird `fr.cut.y.2,1`
- `f.sz=4,2` wird `fr.cut.z.4,2`
- `b,f.sx=2,1` wird `rw.cut.x.2,1 fr.cut.x.2,1`
- `f,b.u=-1` wird `fr.push.-1 rw.push.-1`
- `o=90z` wird `dre.z.90`
- `l.o=9z` wird `sl.dre.z.9`
- `i=a,,0_b,,3` wird `dock.a,,0_b,,3`

Neue Kürzel werden vor dem Berechnen intern wieder auf die stabile alte Form abgebildet. Alte Projekte bleiben dadurch lauffähig, während der Text Schritt für Schritt moderner werden kann.

## Aliase

Aliase sind Kurzbefehle fuer haeufige Korpusformen. Sie bleiben im Text sichtbar und werden nur intern vor dem Berechnen erweitert.

`b sk=a,14,3` - erzeugt einen Schubkasten `b` in Korpus `a`, Hoehe 14 cm, `z.anz.3`.

Das entspricht intern:

`b p.sl,sr,fr,rw,bo breit.a.c.w tief.a.c.d hoch.14 dock.a,g,1 push.-2 mat.3 z.anz.3`

Parameter:

- Parameter 1: Zielkorpus, z.B. `a`
- Parameter 2: Hoehe, z.B. `14`
- Parameter 3: Wiederholung in z-Richtung, z.B. `3`

Wenn der Alias sichtbar ausgeschrieben werden soll, wird als vierter Parameter `e` geschrieben:

`b sk=a,14,3,e`

`a leg=22,4` - erzeugt vier Beine mit 22 cm Höhe.

Das entspricht intern:

`a leg=22,4`

`a leg=22,2` - erzeugt zwei Beine mit 22 cm Höhe.

## Maße

`breit.80 tief.40 hoch.72` - Breite, Tiefe und Höhe ausgeschrieben.

`80,40,72` - kurze Schreibweise für Breite, Tiefe und Höhe.

`breit`, `tief`, `hoch` stehen für Breite, Tiefe und Höhe.

## Position

`x.20` - Position in x-Richtung.

`y.10` - Position in y-Richtung.

`z.5` - Position in z-Richtung.

`x20` - alte kurze Schreibweise für `x.20`.

`y10` - alte kurze Schreibweise für `y.10`.

`z5` - alte kurze Schreibweise für `z.5`.

## Material

Material kann am Korpus oder am Teil gesetzt werden.

`mat.1` - Material am Korpus.

`rw.mat.2` - Material an der Rückwand.

`fr.mat.1` - Material an der Front.

## Verkleinern und Erweitern

`u` verändert Teile an bestimmten Seiten.

`push.8` - kann für Sockel- oder Korpusverkürzungen verwendet werden.

`fr.push.0.4` - verkleinert die Front an den passenden Seiten um 0,4 cm.

`eb.push.2f` - verkürzt den Einlegeboden vorne um 2 cm.

`eb.push.2f,1b` - verkürzt den Einlegeboden vorne und hinten unterschiedlich.

`sl.push.7f,9tg` - verkürzt die linke Seite vorne um 7 cm und oben/unten um 9 cm.

## Wiederholen

`x.anz`, `y.anz`, `z.anz` erzeugen Wiederholungen.

`x.anz.3,10` - drei Wiederholungen in x-Richtung mit Abstand 10.

`y.anz.2,5` - zwei Wiederholungen in y-Richtung mit Abstand 5.

`z.anz.4,20` - vier Wiederholungen in z-Richtung mit Abstand 20.

Der erste Wert ist die Anzahl. Der zweite Wert ist der Abstand.

## Cut

`cut.x`, `cut.y`, `cut.z` schneidet ein Teil in mehrere kleinere Teile.

`fr.cut.x.3,5` - Front in x-Richtung in drei Teile schneiden, Abstand 5.

`fr.cut.y.2,1` - Front in y-Richtung in zwei Teile schneiden, Abstand 1.

`fr.cut.z.4,2` - Front in z-Richtung in vier Teile schneiden, Abstand 2.

Der erste Wert ist die Anzahl der Teile. Der zweite Wert ist der Abstand zwischen den Teilen.

Kombinationen erzeugen ein Gitter:

`fr.cut.x.3,5 fr.cut.z.2,4` - Gitter aus x- und z-Teilung.

`fr.cut.x.2,5 fr.cut.y.3,2 fr.cut.z.2,4` - erzeugt `2 x 3 x 2` Teile.

Ungleiche Werte können direkt an Maß oder Position stehen:

`sl.hoch.40,30,6g,20,1` - erzeugt mehrere ungleiche Höhenstücke; `6g` oder `g6` ist der globale Abstand zwischen allen Stücken, eine abschließende `1` füllt bis Ende.

`sl.hoch.2/2,1g(gap)` - teilt die Höhe in zwei gleiche Stücke mit 1 cm Abstand.

`sl.breit.dito` - übernimmt die letzte Wertfolge.

`sl.x.1,10,20` - wiederholt das Teil mit ungleichen x-Positionen.

## Innenaufteilung

`layout` und `cols` erzeugen automatisch Mittelseiten und Fachböden.

`a breit.300 tief.60 hoch.220 layout.30:4,240:2,rest:3`

Bedeutung:

- Spalte 1 ist 30 cm breit und hat 4 Fächer
- Spalte 2 ist 240 cm breit und hat 2 Fächer
- Spalte 3 nimmt die restliche Breite und hat 3 Fächer

Die nötigen Mittelseiten und Fachböden werden automatisch erzeugt. Die Breiten sind lichte Spaltenbreiten; Mittelseiten werden dazwischen eingerechnet.

Kurzform für gleichmäßige Spalten:

`a breit.300 tief.60 hoch.220 cols.3:4`

Das erzeugt 3 gleich breite Spalten mit jeweils 4 Fächern.

Eigene Stärken sind möglich:

`a breit.100 tief.50 hoch.100 cols.2:3 mw.anz.3 eb.anz.2`

Das erzeugt zwei Spalten mit drei Fächern, Mittelseiten mit 3 cm Stärke und Fachböden mit 2 cm Stärke.

## Verbinden

`i` dockt einen Punkt des aktuellen Korpus an einen Zielpunkt an.

`b i` - verbindet den aktuellen Korpus mit dem vorherigen Korpus.

`b i=a,,0_b,,3` - verbindet Punkt 0 des aktuellen Korpus mit Punkt 3 von Korpus `a`.

`b i=f,0,a,g,3` - verbindet Teil `f`, Ecke 0, mit Korpus `a`, Teil `g`, Ecke 3.

`b i1` - verbindet den aktuellen Korpus mit Ecke 1.

Format: `i=aktuelles_teil,aktuelle_ecke,ziel_korpus,ziel_teil,ziel_ecke`.

Wenn nur `i` geschrieben wird, wird der aktuelle Korpus mit dem vorherigen Korpus verbunden.

## An zwei Punkte anpassen

`fit` berechnet `w`, `d`, `h` aus zwei Punkten. Punkt 1 wird als Zielpunkt gesetzt.

`b fit=a,g,1_a,c,7` - berechnet die Maße von `b` aus den Punkten `a,g,1` und `a,c,7`.

`b fit=ag1_ac7` - kurze Schreibweise für dieselbe Anpassung.

Das bedeutet:

- Punkt 1 ist `a,g,1`
- Punkt 2 ist `a,c,7`
- `b.w`, `b.d`, `b.h` werden aus dem Abstand der beiden Punkte berechnet
- `b.tar` wird auf Punkt 1 gesetzt
- `b.cur` bleibt Ecke 0 des neuen Korpus

## Drehen

`o` dreht mit Achsensuffix.

`o=45z` - dreht den Korpus um 45 Grad um die z-Achse.

`l.o=9z` - dreht Teil `l` um 9 Grad um die z-Achse.

`o=15x,9z0` - dreht um x und z; bei `9z0` ist `0` die Ecke, um die gedreht wird.

## Darstellung

`vi` steuert die Darstellung.

`vi=wf` - Drahtmodell.

`f.vi=t4` - Transparenzstufe für die Front.

## Punkte

Ein Punkt besteht aus Korpus, Teil und Ecke.

`al1` - Korpus `a`, Teil `l`, Ecke `1`.

`a,l,1` - dieselbe Angabe mit Kommas.

## Ecken

- Vorderseite: 0 bis 3, im Uhrzeigersinn, Start unten links
- Rückseite: 4 bis 7, im Uhrzeigersinn
- Standardpunkt des aktuellen Korpus: 0
- Standardzielpunkt: 3

Vorne: `0` unten links, `1` oben links, `2` oben rechts, `3` unten rechts.

Hinten: `4` unten links, `5` oben links, `6` oben rechts, `7` unten rechts.

## Kommentare und Deaktivieren

`i1` - verbindet den aktuellen Korpus mit Ecke 1.

`-a p.sl,sr,bo,de,rw,eb breit.80 tief.40 hoch.72` - deaktivierte Zeile.

Alles hinter `#` ist Kommentar. Kommentare am besten hinter den Code schreiben. Zeilen oder Blöcke mit `-` werden deaktiviert.
