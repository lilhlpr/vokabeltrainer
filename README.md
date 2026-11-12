# Englisch-Vokabeltrainer 📚

Ein kleiner Vokabeltrainer fürs Handy. Er läuft komplett im Browser, ohne Server und ohne Anmeldung.

- **Leicht:** Die richtige Antwort aus vier Möglichkeiten antippen.
- **Schwer:** Die Antwort selbst schreiben. Groß- und Kleinschreibung und Satzzeichen zählen nicht. Bei genau einem Tippfehler gibt es einen zweiten Versuch.
- **Eine Runde fragt alle Wörter der ausgewählten Listen ab**, in zufälliger Reihenfolge. Am Ende kommt die Auswertung, und mit „Fehler üben“ kommen nur die falsch beantworteten Wörter noch einmal dran.
- Jedes Wort sammelt bis zu drei Sterne. Sterne und eine angefangene Runde werden im Browser des jeweiligen Geräts gespeichert.

## Ordner

```
index.html          Seite (hier stehen die Listen als <script>-Zeilen)
style.css           Aussehen
app.js              Programm
vokabeln/           eine Datei pro Vokabelliste
```

## Auf GitHub Pages veröffentlichen

1. Auf github.com ein neues Repository anlegen, z. B. `vokabeltrainer`, auf **Public** stellen.
2. **Add file → Upload files** wählen und den *Inhalt* dieses Ordners hineinziehen (`index.html` muss ganz oben liegen, nicht in einem Unterordner). **Commit changes** klicken.
3. **Settings → Pages**: unter „Build and deployment“ **Deploy from a branch** wählen, Branch **main**, Ordner **/ (root)**, **Save**.
4. Nach ein bis zwei Minuten läuft der Trainer unter `https://DEIN-NAME.github.io/vokabeltrainer/`.

Tipp fürs Handy: Seite öffnen und im Browser-Menü „Zum Startbildschirm hinzufügen“ wählen.

## Neue Vokabelliste hinzufügen

1. Die Datei `vokabeln/s196-199.js` kopieren, z. B. als `unit3.js`.
2. `id` (eindeutig, ohne Leerzeichen), `titel`, `emoji` und die Wörter anpassen.
3. In `index.html` eine Zeile ergänzen, über der Zeile mit `app.js`:
   ```html
   <script src="vokabeln/unit3.js"></script>
   ```

Aufbau einer Liste:

```js
(window.VOKABELN = window.VOKABELN || []).push({
  id: "unit3",
  titel: "Unit 3 · Seite 210",
  emoji: "🐶",
  woerter: [
    { en: "dog", de: "Hund", emoji: "🐶" },
    { en: "find sth. out", de: "etwas herausfinden", info: "simple past: found" },
    { en: "neighbour", de: "Nachbar/in", auchEn: ["neighbor"] }
  ]
});
```

| Feld | Pflicht | Bedeutung |
|---|---|---|
| `en` | ja | Englisch |
| `de` | ja | Deutsch |
| `emoji` | nein | Bild auf der Karte |
| `info` | nein | Hinweis, der nach der Antwort erscheint |
| `auchEn` / `auchDe` | nein | weitere Antworten, die im Schwer-Modus als richtig gelten |
| `labels` | nein | andere Beschriftung der beiden Seiten, z. B. `{ en: "Simple past", de: "Grundform" }` |

Im Schwer-Modus gelten automatisch auch diese Schreibweisen als richtig:

- jede einzelne Bedeutung, wenn mehrere mit `;`, `,` oder ` / ` getrennt sind („Ausflug; Reise“ → „Reise“)
- die Antwort ohne Klammerteil oder mit Klammerinhalt („(mit dem Auto) fahren“ → „fahren“)
- `Nachbar/in` → „Nachbar“ oder „Nachbarin“
- ohne `sth.`, `sb.`, `etwas`, `sich` („find sth. out“ → „find out“)
- `ae`, `oe`, `ue`, `ss` statt `ä`, `ö`, `ü`, `ß`

`labels` kann bei einem einzelnen Wort oder bei der ganzen Liste stehen. In `vokabeln/s196-199.js` nutzen es die unregelmäßigen Verben: Gezeigt wird die Grundform, gesucht die simple-past-Form (oder umgekehrt). Im Leicht-Modus werden Verben nur mit anderen Verben als Auswahl gemischt.

Achtung: Ändert man bei einem Wort den englischen Text oder die `id` einer Liste, fangen die Sterne für dieses Wort wieder bei null an.
