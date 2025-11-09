# OLLYSPA v2.5 — Beginner-friendly SPA framework.

## What is OLLYSPA?
OLLYSPA is a *tiny* single-page application framework made with plain HTML, CSS and JavaScript. Think of it as a little helper that:
- Lets you switch pages using the URL hash (like `#home` or `#about`),
- Loads small HTML components on demand,
- Lets your page react to data changes (so the UI updates when the underlying data changes),
- Uses a JSON file for the site's content,
- Remembers light/dark theme in `localStorage`.



---

## Project structure (what each file does)
```
index.html

ollyspa.core.js       -> the tiny framework (routing + data binding)

data/content.json     -> your site's data (editable JSON)

components/home.html  -> home page component

components/about.html -> about page component

assets/css/style.css  -> default styles (light/dark)

README.md
```

---

## How to use it
1. Open `index.html` in a browser (you can just double-click it).
2. Click the header links or change the URL hash to `#home` or `#about` to switch pages.
3. Click the "Toggle theme" button — the site will remember the choice using `localStorage`.

---

## How the data works (change content)
Open `data/content.json` and you'll see simple JSON:
```json
{
  "site": { "title": "...", "description": "..." },
  "home": { "welcome": "...", "features": [...] },
  "about": { "title": "...", "content": "..." }
}
```
Change any text here, save the file, then refresh the page. The components read from `data` and display what's inside.

Some fields are bound for editing in real-time (for example the home page welcome message). That's done with `o-model` — typing into that input updates the JSON-backed state in the running app.

---

## How routing works
Routing is hash-based:
- The part after `#` in the URL is the route name. Example: `site.com/#about` → route `about`.
- The framework looks for `components/<route>.html` and inserts that component into the page.
- If there's no hash, the framework uses `#home`.

So, `#contact` would map to `components/contact.html`.

---

## How directives work (o-if, o-for, o-model, o-click)
- `o-if="expression"`: Shows the element only if the expression is true.
- `o-for="item in list"`: Repeats an element for each item in `list` (useful for building lists).
- `o-model="data.path"`: Two-way binding for inputs. Changes in the input update `data.path` in memory.
- `o-click="doSomething()"`: Run JavaScript expression when clicked (it runs with `state` and `data` in scope).

Inside templates you can write `{{ data.home.welcome }}` to show values.

---

## How to add more pages/components
1. Create a new file `components/yourpage.html`.
2. Put HTML there (you can use `{{ ... }}` interpolation and the `o-` directives).
3. Link to it with `<a href="#yourpage">Your page</a>` or type the hash in the URL.
4. Optionally add new content in `data/content.json` and reference it from your component.

---

## Tips & limitations
- This is educational and tiny: it does not do virtual DOM diffing or advanced performance tricks.
- `o-for` and expression evaluation are intentionally simple — they work for common beginner patterns.
- Keep expressions readable and avoid putting complex logic inside templates — move it to `data/content.json` or a small helper in `ollyspa.core.js`.

---

Have fun exploring and learning!
