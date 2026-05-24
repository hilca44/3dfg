# C3CAD Tutorial

# Lektion 1
===
C3CAD ist ein textbasiertes CAD-System für Möbel- und Korpusbau.
Ein Projekt besteht aus einer Beschreibung in textform, aus der direkt ein 3D-Modell erzeugt wird.

Grundregel:
- Zeile 1 ist immer der Projektkopf
- ab Zeile 2 folgen die Korpusdefinitionen

---

## Projektkopf

Die erste Zeile definiert das Projekt.

Beispiel:
tutorialdemo

Optional können hier auch globale Parameter stehen:
tutorialdemo w60 d55 h72

---

## Korpuszeilen

Jede weitere Zeile beschreibt genau einen Korpus.  
Der Minimalkorpus wird mit einem Buchstaben `a`
beschrieben.  
Das liegt daran, dass c3cad(c3) für die meisten Aktionen
*Standardwerte* parat hat.  
`a` ergibt also einen Küchenunterschrank mit einem Fachboden.  Im Hintergrund ist somit diese eine Zeile
für den Schrank maßgeblich:  
`a plrgtbc 60,55,70`  


Das kannst du [hier](http://localhost:3000/c3-5/index.html)
ausprobieren.


Mehrere Korpusse:  
`a plrgtbc 60,55,72 #schrank_1`  
`b plrgtbc 20,50,72 x60 #schrank_2`  

Nach der Raute folgt ein Kommentar, der  
die Zeichnung lesbarer macht, aber nicht  
notwendig ist.  
Der Befehl `x60` versetzt Schrank `b` um 60cm  
nach rechts. Er steht nun neben Schrank `a`.  

Der erste Block ist immer der Korpusname.

*Es geht aber noch einfacher - viel einfacher.*


# Lektion 2
===

---

## Maße

Schrankaußenmaße werden so eingegeben:
60,45,72 = Breite,Tiefe,Höhe
oder
w60 d45 h72 = Breite Tiefe Höhe

Maße können fest gesetzt oder aus Systemwerten bzw. verlinkten Projekten übernommen werden.

---

## Bauteile

Ein Korpus besteht aus Bauteilen wie Seiten, Boden, Deckel, Rückwand oder Fachböden.
Diese werden über Buchstaben aktiviert.



---

## Unterteilungen (Split)

Mit Split-Kommandos werden Bereiche unterteilt.

Allgemeines Muster:
s<bauteil><richtung><anzahl>,<abstand>

Beispiel:
sfz3,1

Bedeutung:
- s = split
- f = Fach-/Frontbereich
- z = Höhe
- 3 = Anzahl
- 1 = Abstand

Im Kontext:
a w60 d55 h72 sfz3,1

---

## Korpusse verbinden (Connect)

Korpusse können relativ zueinander positioniert werden, indem Ecken (Corners) miteinander verbunden werden.

Grundidee:
- aktuelle Ecke bestimmen
- Zielecke bestimmen
- aktuellen Korpus verschieben

Beispiel:
b w40 d55 h72 tarnme=a curcor=0 tarcor=1

Der Korpus b wird an den Korpus a angedockt.

---

## Verlinkte Korpusse

C3CAD unterstützt verlinkte Unterprojekte.

Ablauf:
- eine externe Datei enthält in Zeile 1 eine URL
- die URL enthält ein komplettes C3CAD-Projekt
- dieses Projekt wird geladen und geparst
- Maße aus der aktuellen Zeile überschreiben den Projektkopf des Links

Beispiel:
a innurl=drawerblock w60 d55 h72

So lassen sich Modulbibliotheken aufbauen.

---

## Typische Workflows

Ein einzelner Korpus:
demo
a w60 d55 h72

Zwei Korpusse:
demo
a w60 d55 h72
b w40 d55 h72 tarnme=a curcor=0 tarcor=1

Korpus mit Unterteilungen:
demo
a w60 d55 h72 g b sfz3,1

---

## Fehlerbehebung

Wenn nichts angezeigt wird:
- existiert eine Projektzeile?
- existieren Korpuszeilen?
- sind Tokens korrekt geschrieben?

Wenn Connect nicht funktioniert:
- existiert der Zielkorpus?
- sind Corner-Werte gültig?
- ist die Bounding-Box korrekt?

Wenn ein Link nicht lädt:
- existiert die Link-Datei?
- ist der Pfad korrekt?
- enthält Zeile 1 eine gültige URL?

---

## Komplettes Beispiel

tutorialdemo
a w60 d55 h72 g b sfz3,1
b w40 d55 h72 g b tarnme=a curcor=0 tarcor=1
