# Galerie-Zugangskontrolle

Die persönliche Galerie nutzt serverseitige Benutzer mit Passwort-Hash.

## Benutzerdatei

Die Datei liegt hier:

```text
public/schreinertool/gallery/users.json
```

Wenn sie fehlt, legt der Server beim ersten Login-Versuch automatisch einen Admin an.

## Admin-Zugang

Empfohlen ist ein Start über Environment-Variable:

```bash
ST_ADMIN_EMAIL='admin@example.com' ST_ADMIN_PASSWORD='ein-sicheres-passwort' node server.js
```

Wenn keine Variable gesetzt ist, wird einmalig `admin@schreinertool.local` / `admin` erzeugt. Dieses Passwort danach sofort ändern.

## Benutzer anlegen

Ein Eintrag sieht so aus:

```json
{
  "users": {
    "admin@example.com": {
      "password": "pbkdf2$...",
      "email": "admin@example.com",
      "role": "admin",
      "created": "2026-05-17"
    },
    "kunde@example.com": {
      "password": "pbkdf2$...",
      "email": "kunde@example.com",
      "role": "user",
      "created": "2026-05-17"
    }
  }
}
```

Passwörter werden nicht im Klartext gespeichert. Der Server erwartet PBKDF2-Hashes im Format:

```text
pbkdf2$salt$hash
```

## Einfacher Weg für neue Benutzer

Du kannst neue Benutzer zuerst mit einem temporären Klartext-Passwort eintragen:

```json
{
  "users": {
    "kunde@example.com": {
      "password": "plain:geheimes-startpasswort",
      "email": "kunde@example.com",
      "role": "user",
      "created": "2026-05-17"
    }
  }
}
```

Beim ersten erfolgreichen Login wird `plain:...` automatisch durch einen PBKDF2-Hash ersetzt.

## PayPal-Zahlungsliste

Normale Benutzer können sich nur anmelden, wenn ihre PayPal-E-Mail zusätzlich in dieser Datei steht:

```text
public/schreinertool/gallery/paid-emails.json
```

Beispiel:

```json
[
  {
    "email": "kunde@example.com",
    "until": "2027-05-17",
    "paypal": "Transaktions-ID oder Notiz"
  }
]
```

`until` ist optional. Ohne `until` gilt die E-Mail als unbegrenzt freigeschaltet. Benutzer mit `"role": "admin"` sind von dieser Zahlungsliste ausgenommen.

Aktuell gibt es noch keine Admin-Oberfläche zum Erzeugen neuer Benutzer; Benutzer werden in dieser Datei verwaltet.
