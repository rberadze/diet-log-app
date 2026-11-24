// Diet Log · Charts — a Telegram Mini App. Code only: your data comes from the bot's own server after Telegram
// confirms who you are, and nothing is stored here.
(() => {
  "use strict";
  const tg = window.Telegram && window.Telegram.WebApp;
  const $ = (id) => document.getElementById(id);
  const GROUPS = ["food", "gut", "timing"];
  const PERIODS = [["d7", 7], ["d30", 30], ["d90", 90]];

  // The bot passes its API address; only the bot's own Supabase function is accepted.
  const api = new URLSearchParams(location.search).get("api") || "";
  const apiOk = /^https:\/\/[a-z0-9]{10,40}\.supabase\.co\/functions\/v1\/miniapp$/.test(api);

  const state = { group: "food", days: 30, from: null, to: null, data: null, cache: new Map(), texts: null };

  function theme() {
    return tg && tg.colorScheme === "dark" ? "dark" : "light";
  }

  function setText(t) {
    state.texts = t;
    $("title").textContent = t.title;
    $("fromLabel").textContent = t.from;
    $("toLabel").textContent = t.to;
    $("show").textContent = t.show;
    $("hint").textContent = t.tapHint;
    document.title = `Diet Log · ${t.title}`;
    renderTabs();
    renderChips();
  }

  function renderTabs() {
    const t = state.texts;
    $("tabs").innerHTML = "";
    for (const g of GROUPS) {
      const b = document.createElement("button");
      b.type = "button";
      b.role = "tab";
      b.textContent = t ? t.tabs[g] : g;
      b.setAttribute("aria-selected", String(g === state.group));
      b.onclick = () => {
        if (state.group === g) return;
        state.group = g;
        haptic();
        renderTabs();
        renderCharts();
      };
      $("tabs").appendChild(b);
    }
  }

  function renderChips() {
    const t = state.texts;
    $("chips").innerHTML = "";
    const custom = !!state.from;
    for (const [key, n] of PERIODS) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t ? t.periods[key] : `${n}`;
      b.setAttribute("aria-pressed", String(!custom && state.days === n));
      b.onclick = () => {
        state.days = n;
        state.from = state.to = null;
        $("dates").hidden = true;
        haptic();
        renderChips();
        load();
      };
      $("chips").appendChild(b);
    }
    const c = document.createElement("button");
    c.type = "button";
    c.textContent = t ? t.periods.custom : "…";
    c.setAttribute("aria-pressed", String(custom || !$("dates").hidden));
    c.onclick = () => {
      $("dates").hidden = !$("dates").hidden;
      if (!$("dates").hidden && state.data) {
        $("from").value = state.data.from;
        $("to").value = state.data.to;
        $("to").max = $("from").max = state.data.today;
      }
      renderChips();
    };
    $("chips").appendChild(c);
  }

  $("dates").onsubmit = (e) => {
    e.preventDefault();
    if (!$("from").value || !$("to").value) return;
    state.from = $("from").value;
    state.to = $("to").value;
    haptic();
    renderChips();
    load();
  };

  function showState(text, opts = {}) {
    const s = $("state");
    s.className = "state" + (opts.box ? " box" : "");
    s.innerHTML = "";
    if (opts.skeleton) {
      const sk = document.createElement("div");
      sk.className = "skeleton";
      s.className = "";
      s.appendChild(sk);
      return;
    }
    s.textContent = text || "";
    s.onclick = opts.retry ? () => load(true) : null;
  }

  function renderCharts() {
    const d = state.data;
    const car = $("carousel");
    car.innerHTML = "";
    $("dots").innerHTML = "";
    hideTip();
    if (!d) return;
    $("period").textContent = d.period;
    if (!d.hasMeals) showState(d.texts.nothing, { box: true });
    else showState("");
    const list = d.charts.filter((c) => c.group === state.group);
    list.forEach((c, i) => {
      const card = document.createElement("article");
      card.className = "card";
      card.setAttribute("aria-roledescription", "slide");
      card.setAttribute("aria-label", `${i + 1} / ${list.length}`);
      card.innerHTML = c.svg; // drawn by the bot's server from your log; text inside is escaped there
      const svg = card.querySelector("svg");
      if (svg) {
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.setAttribute("role", "img");
      }
      car.appendChild(card);
      const dot = document.createElement("i");
      if (i === 0) dot.className = "on";
      $("dots").appendChild(dot);
    });
    car.scrollLeft = 0;
  }

  // dots follow the swipe
  $("carousel").addEventListener("scroll", () => {
    const car = $("carousel");
    const i = Math.round(car.scrollLeft / Math.max(1, car.clientWidth - 20));
    [...$("dots").children].forEach((d, k) => d.classList.toggle("on", k === i));
    hideTip();
  }, { passive: true });

  // tap a bar or dot → its numbers
  let lit = null;
  $("carousel").addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest("[data-tip]");
    if (!el) return hideTip();
    if (lit) lit.classList.remove("on");
    lit = el;
    el.classList.add("on");
    const tip = $("tip");
    tip.textContent = el.getAttribute("data-tip");
    tip.hidden = false;
    haptic();
  });
  function hideTip() {
    $("tip").hidden = true;
    if (lit) lit.classList.remove("on");
    lit = null;
  }

  window.addEventListener("scroll", () => document.querySelector(".top").classList.toggle("scrolled", scrollY > 4), { passive: true });

  function haptic() {
    try {
      tg && tg.HapticFeedback && tg.HapticFeedback.selectionChanged();
    } catch (_) { /* not in Telegram */ }
  }

  async function load(force) {
    const t = state.texts;
    if (!tg || !tg.initData) return showState((t && t.errorAuth) || "Open this page from the Diet Log bot (the 📊 Charts button).", { box: true });
    if (!apiOk) return showState("This page was opened with a wrong address. Use the 📊 Charts button in the bot.", { box: true });
    const body = { initData: tg.initData, theme: theme() };
    if (state.from && state.to) Object.assign(body, { from: state.from, to: state.to });
    else body.days = state.days;
    const key = JSON.stringify({ ...body, initData: 0 });
    if (!force && state.cache.has(key)) {
      state.data = state.cache.get(key);
      return renderCharts();
    }
    $("carousel").innerHTML = "";
    $("dots").innerHTML = "";
    showState((t && t.loading) || "…", { skeleton: true });
    try {
      const res = await fetch(api, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) return showState((t && t.errorAuth) || "Open this page from the Diet Log bot.", { box: true });
      if (res.status === 403 || res.status === 404) return showState((t && t.errorAccess) || "This page is private.", { box: true });
      if (!res.ok || !j.charts) throw new Error(String(res.status));
      state.cache.set(key, j);
      state.data = j;
      if (!state.texts) setText(j.texts);
      renderCharts();
    } catch (_) {
      showState((t && t.errorGeneric) || "Something went wrong. Tap to try again.", { box: true, retry: true });
    }
  }

  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.setHeaderColor("secondary_bg_color");
      tg.setBackgroundColor("secondary_bg_color");
    } catch (_) { /* older Telegram */ }
    tg.onEvent("themeChanged", () => {
      document.documentElement.dataset.theme = theme();
      state.cache.clear();
      load(true);
    });
    document.documentElement.dataset.theme = theme();
  }
  renderTabs();
  renderChips();
  load();
})();
