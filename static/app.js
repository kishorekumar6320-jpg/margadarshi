const $ = s => document.querySelector(s);
const form = $("#f"), out = $("#out"), status = $("#status"), btn = $("#go");
const ok = v => v.trim().length >= 3 && /\p{L}/u.test(v);

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function panel(title, items) {
  if (!items || !items.length) return null;
  const p = h("div", "panel"); p.append(h("h2", "", title));
  const ul = h("ul"); items.forEach(t => ul.append(h("li", "", t))); p.append(ul);
  return p;
}
function setErr(name, msg) {
  const i = form.elements[name]; i.classList.toggle("bad", !!msg);
  const e = i.parentElement.querySelector(".err"); if (e) e.textContent = msg || "";
}
function fail(msg) { status.className = "error"; status.textContent = msg; }

form.addEventListener("submit", async ev => {
  ev.preventDefault();
  const d = Object.fromEntries(new FormData(form));
  ["education", "interests", "passion"].forEach(k => setErr(k, ""));
  let bad = false;
  if (!ok(d.education)) { setErr("education", "Tell us your current education, like Class 10."); bad = true; }
  if (!ok(d.interests) && !ok(d.passion)) {
    setErr("interests", "Fill interests or passion (at least one)."); bad = true;
  }
  if (bad) return;
  out.hidden = true; status.className = ""; status.textContent = "Drawing your route map. This takes 10 to 30 seconds.";
  btn.disabled = true;
  try {
    const r = await fetch("/api/analyze", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(d)});
    const j = await r.json();
    if (!r.ok) return fail(j.message || "Something went wrong. Try again.");
    status.textContent = "";
    render(j);
  } catch (e) { fail("Could not reach the server. Is the app still running?"); }
  finally { btn.disabled = false; }
});

function render(j) {
  out.replaceChildren(); out.hidden = false;
  if (j.needs_more_info) {
    const p = h("div", "panel note"); p.append(h("h2", "", "We need a little more"), h("p", "", j.message || "Tell us about subjects, hobbies or goals you want to explore."));
    out.append(p); return;
  }
  const top = h("div", "panel"); top.append(h("p", "best", j.best_fit), h("p", "", j.why), h("p", "", j.profile_summary)); out.append(top);
  const a = panel("What we assumed", j.assumptions); if (a) { a.classList.add("note"); out.append(a); }
  const g = h("div", "grid");
  [["Career options", j.career_options], ["Courses", j.courses], ["Exams to take", j.exams], ["Skills to build", j.skills], ["Job roles", j.job_roles]]
    .forEach(([t, l]) => { const p = panel(t, l); if (p) g.append(p); });
  out.append(g);
  out.append(h("h2", "", "Your route map"));
  out.append(buildMap(j.roadmap || []));
  const g2 = h("div", "grid");
  [["Other paths", j.alternatives], ["Risks and trade-offs", j.risks_and_tradeoffs], ["Do this week", j.next_steps]]
    .forEach(([t, l]) => { const p = panel(t, l); if (p) g2.append(p); });
  out.append(g2);
  out.scrollIntoView({behavior: "smooth"});
}

function buildMap(nodes) {
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const level = {}; nodes.forEach(n => level[n.id] = 0);
  for (let i = 0; i < nodes.length; i++)            // longest-path levels; the cap stops loops
    nodes.forEach(n => (n.next || []).forEach(t => { if (byId[t] && level[t] < level[n.id] + 1 && level[n.id] < nodes.length) level[t] = level[n.id] + 1; }));
  const max = Math.max(0, ...Object.values(level));
  const wrap = h("div", "map"), svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  wrap.append(svg);
  const els = {};
  for (let l = 0; l <= max; l++) {
    const row = h("div", "row");
    nodes.filter(n => level[n.id] === l).forEach(n => {
      const kind = (n.type || "").toLowerCase().match(/decision|exam|job|skill|project|course|stage/);
      const el = h("div", "node " + (kind ? kind[0] : "")); el.append(h("h3", "", n.title), h("b", "", n.duration), h("p", "", n.description));
      els[n.id] = el; row.append(el);
    });
    wrap.append(row);
  }
  const draw = () => {
    svg.replaceChildren(); const w = wrap.getBoundingClientRect();
    nodes.forEach(n => (n.next || []).forEach(t => {
      if (!els[n.id] || !els[t]) return;
      const a = els[n.id].getBoundingClientRect(), b = els[t].getBoundingClientRect();
      const x1 = a.left + a.width / 2 - w.left, y1 = a.bottom - w.top, x2 = b.left + b.width / 2 - w.left, y2 = b.top - w.top, m = (y1 + y2) / 2;
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", `M${x1},${y1} C${x1},${m} ${x2},${m} ${x2},${y2}`); svg.append(p);
    }));
  };
  requestAnimationFrame(() => requestAnimationFrame(draw));
  addEventListener("resize", draw);
  return wrap;
}
