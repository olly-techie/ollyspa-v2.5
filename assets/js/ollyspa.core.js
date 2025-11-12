/* OLLYSPA v2.5 — simple SPA framework (vanilla JS)
   Features:
   - hash routing
   - dynamic component loading (components/*.html)
   - simple reactivity and data-binding: o-model, o-click, o-for, o-if, {{ interpolation }}
   - JSON data source (data/content.json)
   - theme toggle with localStorage
   - beginner-friendly, small footprint
*/

const OLLYSPA = (function () {
  const state = {
    data: {},
    route: location.hash.replace('#','') || 'home',
    theme: localStorage.getItem('olly-theme') || 'light'
  };

  // Make a reactive state proxy that triggers simple updates.
  const handlers = [];
  function notify() { handlers.forEach(h => h()); }

  const proxy = new Proxy(state, {
    set(target, prop, value) {
      target[prop] = value;
      notify();
      return true;
    }
  });

  // Utility: load JSON data file
  async function loadData(url='data/content.json') {
    try {
      const res = await fetch(url);
      state.data = await res.json();
      notify();
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  }

  // Router: map routes to component filenames by convention
  function getComponentPath(route) {
    if (!route) route = 'home';
    return `components/${route}.html`;
  }

  // Load component HTML and inject into #app
  async function loadRoute(route) {
    const path = getComponentPath(route);
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error('Not found');
      const html = await res.text();
      const container = document.getElementById('app');
      container.innerHTML = html;
      processDirectives(container);
    } catch (e) {
      document.getElementById('app').innerHTML = `<div class="notfound"><h2>Page not found</h2><p>Couldn't load <code>${path}</code></p></div>`;
      console.warn(e);
    }
  }

  // Basic expression evaluation in the context of state and data
  function evalInContext(expr) {
    try {
      // Create function with state/data in scope
      const fn = new Function('state', 'data', `with(state){ with(data){ return (${expr}); } }`);
      return fn(proxy, proxy.data);
    } catch (e) {
      console.warn('Expression error:', expr, e);
      return undefined;
    }
  }

  // Process template interpolations {{ }}
  function interpolate(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue;
      if (text.includes('{{')) {
        node.nodeValue = text.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr) => {
          const val = evalInContext(expr);
          return val === undefined ? '' : val;
        });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    // Attributes interpolation
    for (const attr of Array.from(node.attributes || [])) {
      if (attr.value && attr.value.includes('{{')) {
        attr.value = attr.value.replace(/\{\{\s*(.+?)\s*\}\}/g, (_, expr) => {
          const val = evalInContext(expr);
          return val === undefined ? '' : val;
        });
      }
    }
    // recurse
    node.childNodes.forEach(interpolate);
  }

  // Implement o-if (remove node if false)
  function processIf(node) {
    const ifExpr = node.getAttribute && node.getAttribute('o-if');
    if (!ifExpr) return true;
    const ok = !!evalInContext(ifExpr);
    if (!ok) {
      node.remove();
      return false;
    } else {
      node.removeAttribute('o-if');
      return true;
    }
  }

  // Implement o-for="item in items" with simple cloning
  function processFor(node) {
    const forExpr = node.getAttribute && node.getAttribute('o-for');
    if (!forExpr) return false;
    const match = forExpr.match(/^\s*(\w+)\s+in\s+(.+)\s*$/);
    if (!match) return false;
    const [, itemName, listExpr] = match;
    const list = evalInContext(listExpr) || [];
    const parent = node.parentNode;
    const template = node.cloneNode(true);
    node.remove(); // remove original template
    list.forEach((item, idx) => {
      const clone = template.cloneNode(true);
      // For evaluation, inject item into data temporarily by name
      // We create a small wrapper proxy for evalInContext usage
      // Easiest: attach item to proxy.data as __item and adjust expressions in clone
      // Simpler: replace occurrences of {{ itemName.xxx }} and attributes that refer to itemName.
      // We'll perform interpolation using a temporary context:
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null, false);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(n => {
        if (n.nodeType === Node.TEXT_NODE) {
          n.nodeValue = n.nodeValue.replace(new RegExp(`\\{\\{\\s*${itemName}(.+?)\\s*\\}\\}`, 'g'), (_, rest) => {
            // evaluate expression like item.prop
            try {
              const fn = new Function(itemName, 'state', 'data', `with(state){ with(data){ return ${itemName}${rest}; } }`);
              const v = fn(item, proxy, proxy.data);
              return v === undefined ? '' : v;
            } catch (e) { return ''; }
          }).replace(new RegExp(`\\{\\{\\s*${itemName}\\s*\\}\\}`, 'g'), String(item));
        }
        if (n.nodeType === Node.ELEMENT_NODE) {
          for (const attr of Array.from(n.attributes || [])) {
            // handle attributes like title="{{ item.name }}"
            if (attr.value && attr.value.includes(itemName)) {
              attr.value = attr.value.replace(new RegExp(`${itemName}(.+?)`, 'g'), (_, rest) => {
                try {
                  const fn = new Function(itemName, 'state', 'data', `with(state){ with(data){ return ${itemName}${rest}; } }`);
                  const v = fn(item, proxy, proxy.data);
                  return v === undefined ? '' : v;
                } catch (e) { return ''; }
              }).replace(new RegExp(`\\b${itemName}\\b`, 'g'), String(item));
            }
          }
        }
      });
      parent.appendChild(clone);
      // After inserting, run directives inside clone
      processDirectives(clone);
    });
    return true;
  }

  // o-model two-way binding (for inputs)
  function bindModel(node) {
    const model = node.getAttribute && node.getAttribute('o-model');
    if (!model) return false;
    // Set initial value from state.data or state
    const cur = evalInContext(model);
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') {
      node.value = cur == null ? '' : cur;
      node.addEventListener('input', (e) => {
        // assign value back — we support simple dotted paths like person.name
        const assign = new Function('state','data','val', `with(state){ with(data){ ${model} = val; } }`);
        assign(proxy, proxy.data, node.value);
        notify();
      });
    }
    node.removeAttribute('o-model');
    return true;
  }

  // o-click: attach event handler expression
  function bindClick(node) {
    const clickExpr = node.getAttribute && node.getAttribute('o-click');
    if (!clickExpr) return false;
    node.addEventListener('click', (e) => {
      try {
        const fn = new Function('event','state','data', `with(state){ with(data){ ${clickExpr} } }`);
        fn(e, proxy, proxy.data);
        notify();
      } catch (err) {
        console.error('o-click error:', err);
      }
    });
    node.removeAttribute('o-click');
    return true;
  }

  // Walk and process directives
  function processDirectives(root) {
    // Register an update handler that re-renders interpolations and processes conditional directives when state changes
    const render = () => {
      // For simplicity: re-process interpolation text nodes and attributes, and o-if
      interpolate(root);
      // We'll not re-run o-for because it's destructive; more advanced frameworks diff lists.
      // But we will re-apply o-model values to keep inputs in sync.
      root.querySelectorAll('[o-model]').forEach(bindModel);
      root.querySelectorAll('[o-if]').forEach(node => {
        // re-evaluate condition; if false, remove node
        try {
          const ok = !!evalInContext(node.getAttribute('o-if'));
          if (!ok && node.parentNode) node.remove();
          else if (ok) node.removeAttribute('o-if');
        } catch (e) {}
      });
    };
    // run initial treatments: process o-for first (it clones and processes inner)
    // find nodes with o-for at any depth (we convert NodeList to array)
    Array.from(root.querySelectorAll('[o-for]')).forEach(node => processFor(node));
    // process o-if (top-down)
    Array.from(root.querySelectorAll('[o-if]')).forEach(node => processIf(node));
    // process o-model, o-click
    Array.from(root.querySelectorAll('[o-model]')).forEach(node => bindModel(node));
    Array.from(root.querySelectorAll('[o-click]')).forEach(node => bindClick(node));
    // handle interpolations
    interpolate(root);

    // Add to handlers list so when state changes we re-run render
    handlers.push(render);
  }

  // Theme helper
  function applyTheme() {
    document.body.classList.remove('theme-light','theme-dark');
    document.body.classList.add(`theme-${state.theme}`);
    localStorage.setItem('olly-theme', state.theme);
  }

  // Toggle theme exposed to components
  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    proxy.theme = state.theme; // trigger update
    applyTheme();
  }

  // Initialize: load data, set up router listeners, set theme, attach nav handlers
  function init() {
    // initial theme
    state.theme = state.theme || 'light';
    applyTheme();

    // load JSON
    loadData();

    window.addEventListener('hashchange', () => {
      state.route = location.hash.replace('#','') || 'home';
      loadRoute(state.route);
    });

    // initial route
    if (!location.hash) location.hash = '#home';
    state.route = location.hash.replace('#','') || 'home';
    loadRoute(state.route);

    // Attach theme toggle if exists
    const tbtn = document.getElementById('theme-toggle');
    if (tbtn) {
      tbtn.addEventListener('click', () => toggleTheme());
    }

    // simple nav active class update
    window.addEventListener('hashchange', updateNavActive);
    updateNavActive();
  }

  function updateNavActive() {
    const route = location.hash.replace('#','') || 'home';
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === `#${route}`);
    });
  }

  // Expose public API
  return {
    init,
    toggleTheme,
    loadData,
    state: proxy
  };
})();

// Initialize when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  OLLYSPA.init();
});
