// src/features/stylesheets/runtime.ts
var e = "data-css-scope", t = /^(?:\s|\/\*[\s\S]*?\*\/|@charset\s+"[^"]*"\s*;|@import\b[^;]*;)*/, n = /* @__PURE__ */ new Map(), r = !1, i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Map(), o = /* @__PURE__ */ new WeakMap(), s = /* @__PURE__ */ new Set();
function c(e) {
	return e.replace(/[^\w-]/g, "_");
}
function l(e) {
	return e?.scoped === !0 && e.global !== !0;
}
function u(e, n) {
	let r = t.exec(e)?.[0] ?? "";
	return `${r}@scope (${n}) {\n${e.slice(r.length)}\n}`;
}
function d(t, n) {
	return l(n) ? u(n.css, `[${e}~="${c(t)}"]`) : r ? u(n.css, "[data-root]") + (n.rootCss ? `
${n.rootCss}` : "") : n.css;
}
function f() {
	let e = [...a.keys()].sort((e, t) => (n.get(e)?.order ?? 0) - (n.get(t)?.order ?? 0));
	if (!e.every((t, n) => {
		let r = a.get(e[n - 1]);
		return !r || !!(r.compareDocumentPosition(a.get(t)) & Node.DOCUMENT_POSITION_FOLLOWING);
	})) for (let t of e) document.head.appendChild(a.get(t));
}
function p(e) {
	if (typeof document > "u") return;
	let t = n.get(e), r = a.get(e);
	if (t && (t.global || (i.get(e) ?? 0) > 0)) {
		let n = r ?? document.createElement("style"), i = d(e, t);
		r || (n.setAttribute("data-css-files", e), document.head.appendChild(n), a.set(e, n)), n.textContent !== i && (n.textContent = i);
	} else r && (r.remove(), a.delete(e));
}
function m(t) {
	let r = (o.get(t) ?? []).filter((e) => l(n.get(e))).map(c);
	r.length ? t.setAttribute(e, r.join(" ")) : t.removeAttribute(e);
}
function h(e) {
	let t = /* @__PURE__ */ new Map();
	for (let [n, r] of Object.entries(e ?? {})) r && typeof r.css == "string" && t.set(n, {
		name: String(r.name ?? ""),
		css: r.css,
		global: r.global === !0,
		order: Number.isFinite(r.order) ? r.order : 0,
		rootCss: typeof r.rootCss == "string" ? r.rootCss : "",
		scoped: r.scoped === !0
	});
	return t;
}
function g(e, t = {}) {
	let a = n;
	n = h(e), r = t.canvas === !0;
	for (let e of /* @__PURE__ */ new Set([
		...a.keys(),
		...n.keys(),
		...i.keys()
	])) p(e);
	typeof document < "u" && f();
	for (let e of s) m(e);
}
function _() {
	g({}), i.clear(), r = !1;
}
function v(e) {
	i.set(e, (i.get(e) ?? 0) + 1), p(e), typeof document < "u" && f();
}
function y(e) {
	let t = (i.get(e) ?? 0) - 1;
	t > 0 ? i.set(e, t) : i.delete(e), p(e);
}
function b(e, t) {
	let n = t?.enabled !== !1 && Array.isArray(t?.sheets) ? t.sheets : [], r = [...new Set(n.filter((e) => typeof e == "string"))], i = o.get(e) ?? [];
	o.set(e, r), m(e);
	for (let e of r.filter((e) => !i.includes(e))) v(e);
	for (let e of i.filter((e) => !r.includes(e))) y(e);
	r.length ? s.add(e) : s.delete(e);
}
var x = {
	mounted: (e, { value: t }) => b(e, t),
	unmounted: (e) => b(e, { sheets: [] }),
	updated: (e, { value: t }) => b(e, t)
};
export { g as n, x as r, _ as t };
