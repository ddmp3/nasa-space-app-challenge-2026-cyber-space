import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createFixtureConnector, loadFixtures } from "../src/analyze/fixtures.js";
import type { Connector } from "../src/analyze/analyze.js";
import { createApp } from "../src/server/app.js";
import type { AppDeps } from "../src/server/app.js";
import { REPO_ROOT, API_ROOT } from "../src/server/config.js";
import { loadSites, parseSites } from "../src/server/load.js";
import { PARAMETERS } from "../src/server/parameters.js";
import { PARAM_IDS } from "../src/scoring/index.js";

const DATA = path.join(REPO_ROOT, "data");
const ORIGIN = "https://front.example.net";

type Running = { url: string; close: () => Promise<void> };

async function start(overrides: Partial<AppDeps> = {}, connectors?: Connector[]): Promise<Running> {
  const fixtures = await loadFixtures(path.join(DATA, "fixtures", "site-values.json"));
  const openapi = parse(await readFile(path.join(API_ROOT, "openapi.yaml"), "utf8")) as Record<string, unknown>;
  const app = createApp({
    sites: fixtures.sites,
    connectors: connectors ?? [createFixtureConnector(fixtures)],
    sourceNames: ["fixtures"],
    openapi,
    moonReference: { id: "moon-south-pole", params: {} },
    allowedOrigins: [ORIGIN],
    ...overrides,
  });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) };
}

const post = (url: string, body: unknown, raw = false): Promise<Response> =>
  fetch(`${url}/api/analyze`, { method: "POST", headers: { "content-type": "application/json" }, body: raw ? (body as string) : JSON.stringify(body) });

describe("serveur HTTP", () => {
  let api: Running;
  beforeAll(async () => {
    api = await start();
  });
  afterAll(async () => api.close());

  it("GET /api/health répond ok", async () => {
    const res = await fetch(`${api.url}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("GET /api/modes liste les 3 modes prédéfinis avec leurs critères", async () => {
    const body = (await (await fetch(`${api.url}/api/modes`)).json()) as { modes: { id: string; criteria: unknown[] }[] };
    expect(body.modes.map((m) => m.id)).toEqual(["robotics", "calibration", "colony"]);
    expect(body.modes.every((m) => m.criteria.length > 0)).toBe(true);
  });

  it("GET /api/parameters couvre tout le catalogue", async () => {
    const body = (await (await fetch(`${api.url}/api/parameters`)).json()) as { parameters: { id: string }[] };
    expect(body.parameters.map((p) => p.id).sort()).toEqual([...PARAM_IDS].sort());
    expect(PARAMETERS).toHaveLength(PARAM_IDS.length);
  });

  it("GET /api/reference/moon renvoie le profil, et 404 s'il est absent", async () => {
    expect(await (await fetch(`${api.url}/api/reference/moon`)).json()).toMatchObject({ id: "moon-south-pole" });
    const other = await start({ moonReference: undefined });
    const res = await fetch(`${other.url}/api/reference/moon`);
    expect(res.status).toBe(404);
    await other.close();
  });

  it("POST /api/analyze (mode) : forme du contrat, tri par total décroissant, Amazonie écartée en dernier", async () => {
    const res = await post(api.url, { mode: "robotics" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { mode: string; sites: { id: string; total: number; excluded?: string; criteria: { param: string; value: number | null; score: number; verdict: string }[] }[] };
    expect(body.mode).toBe("robotics");
    expect(body.sites.map((s) => s.id)).toEqual(["atacama", "haughton", "amazonie"]);
    expect(body.sites.map((s) => s.total)).toEqual([93, 87, 0]);
    expect(body.sites[2]?.excluded).toBe("vegetation");
    for (const s of body.sites) {
      expect(Object.keys(s).filter((k) => k !== "excluded")).toEqual(["id", "name", "lat", "lon", "role", "criteria", "total"].sort((a, b) => Object.keys(s).indexOf(a) - Object.keys(s).indexOf(b)));
      for (const c of s.criteria) expect(Object.keys(c)).toEqual(["param", "value", "score", "verdict"]);
    }
  });

  it("POST /api/analyze (critères libres, filtre désactivé) garde l'Amazonie dans le classement", async () => {
    const res = await post(api.url, { criteria: [{ param: "humidity", max: 40, tolerance: 30, weight: 1 }], bareSoilOnly: false });
    const body = (await res.json()) as { mode: string; sites: { id: string; total: number; excluded?: string }[] };
    expect(body.mode).toBe("custom");
    expect(body.sites[0]?.id).toBe("atacama");
    expect(body.sites.every((s) => s.excluded === undefined)).toBe(true);
  });

  it.each([
    ["mode inconnu", { mode: "mars" }],
    ["ni mode ni critères", {}],
    ["mode et critères ensemble", { mode: "robotics", criteria: [{ param: "wind", max: 3, tolerance: 3, weight: 1 }] }],
    ["critère sans intervalle", { criteria: [{ param: "wind", tolerance: 3, weight: 1 }] }],
    ["paramètre inconnu", { criteria: [{ param: "gravite", max: 3, tolerance: 3, weight: 1 }] }],
    ["poids nul", { criteria: [{ param: "wind", max: 3, tolerance: 3, weight: 0 }] }],
  ])("POST /api/analyze rejette en 400 : %s", async (_name, body) => {
    const res = await post(api.url, body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: expect.any(String) });
  });

  it("POST /api/analyze : JSON illisible → 400, corps énorme → 413", async () => {
    const bad = await post(api.url, "{pas du json", true);
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: "Corps JSON invalide" });
    const big = await post(api.url, JSON.stringify({ mode: "robotics", pad: "x".repeat(60_000) }), true);
    expect(big.status).toBe(413);
  });

  it("une source en panne ne casse pas l'analyse : critères « missing » seulement", async () => {
    const down: Connector = async () => {
      throw new Error("source en panne");
    };
    const errors: string[] = [];
    const flaky = await start({ onConnectorError: (e) => errors.push((e as Error).message) }, [down]);
    const res = await post(flaky.url, { mode: "colony" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sites: { total: number; criteria: { verdict: string }[] }[] };
    expect(body.sites).toHaveLength(3);
    expect(body.sites.every((s) => s.total === 0 && s.criteria.every((c) => c.verdict === "missing"))).toBe(true);
    expect(errors.length).toBe(3);
    await flaky.close();
  });

  it("GET /api/sites/{id} : fiche avec valeurs brutes et sources", async () => {
    const res = await fetch(`${api.url}/api/sites/haughton?mode=robotics`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; total: number; mode: string; values: Record<string, number>; sources: string[]; terrain?: string };
    expect(body).toMatchObject({ id: "haughton", total: 87, mode: "robotics", sources: ["fixtures"], terrain: "impact" });
    expect(body.values.t2m_min).toBe(-48.55);
  });

  it("GET /api/sites/{id} : source de chaque valeur et référence lunaire des critères du mode", async () => {
    const moon = {
      params: {
        slope_mean: { min: 5.23, max: 12.89, unit: "°", source: "LOLA" },
        wind: { min: 0, max: 0, unit: "m/s", source: "pas d'atmosphère" },
        roughness: { unit: "m", source: "sans valeur" },
      },
    };
    const real = await start({ moonReference: moon, useFixtures: false });
    const body = (await (await fetch(`${real.url}/api/sites/haughton?mode=robotics`)).json()) as {
      valueSources: Record<string, string>;
      moon: Record<string, unknown>;
    };
    expect(body.valueSources).toMatchObject({ t2m_min: "nasa-power", slope_mean: "copernicus-dem", quake_count: "usgs-comcat" });
    // Tous les paramètres sourcés, quel que soit le mode (le front affiche ceux de ses critères) ; roughness n'a pas de valeur.
    expect(body.moon).toEqual({
      slope_mean: { min: 5.23, max: 12.89, unit: "°", source: "LOLA" },
      wind: { min: 0, max: 0, unit: "m/s", source: "pas d'atmosphère" },
    });
    await real.close();
    const fixtures = await start({ useFixtures: true });
    const fx = (await (await fetch(`${fixtures.url}/api/sites/haughton`)).json()) as { valueSources: Record<string, string> };
    expect(fx.valueSources.t2m_min).toBe("fixtures");
    await fixtures.close();
  });

  it("GET /api/sources : chaque paramètre du catalogue a une source terrestre nommée", async () => {
    const { sources } = (await (await fetch(`${api.url}/api/sources`)).json()) as {
      sources: { id: string; name: string; url: string; body: string; params: string[]; terms: string }[];
    };
    const earth = sources.filter((s) => s.body === "earth").flatMap((s) => s.params);
    expect([...earth].sort()).toEqual([...PARAM_IDS].sort());
    expect(new Set(earth).size).toBe(earth.length); // une seule source par paramètre
    for (const s of sources) expect(s.name && s.url.startsWith("https://") && s.terms).toBeTruthy();
  });

  it("GET /api/sites/{id} : Amazonie écartée ; 404 site inconnu ; 400 mode inconnu", async () => {
    const amazon = (await (await fetch(`${api.url}/api/sites/amazonie`)).json()) as { total: number; excluded?: string };
    expect(amazon).toMatchObject({ total: 0, excluded: "vegetation" });
    expect((await fetch(`${api.url}/api/sites/nope`)).status).toBe(404);
    expect((await fetch(`${api.url}/api/sites/haughton?mode=mars`)).status).toBe(400);
  });

  it("route inconnue → 404 JSON", async () => {
    const res = await fetch(`${api.url}/api/nimporte`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Route inconnue" });
  });

  it("CORS : seule l'origine du front est autorisée", async () => {
    const ok = await fetch(`${api.url}/api/modes`, { headers: { Origin: ORIGIN } });
    expect(ok.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const ko = await fetch(`${api.url}/api/modes`, { headers: { Origin: "https://autre.example.org" } });
    expect(ko.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("documentation : /api/openapi.json et /api/docs", async () => {
    const spec = (await (await fetch(`${api.url}/api/openapi.json`)).json()) as { openapi: string; paths: Record<string, unknown> };
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining(["/api/analyze", "/api/sites/{id}", "/api/health"]));
    const docs = await fetch(`${api.url}/api/docs/`);
    expect(docs.status).toBe(200);
    expect(await docs.text()).toContain("swagger");
  });

  it("limite de débit : 429 après dépassement, mais /api/health reste disponible", async () => {
    const limited = await start({ rateLimitPerMinute: 3 });
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await fetch(`${limited.url}/api/modes`)).status);
    expect(codes).toEqual([200, 200, 200, 429, 429]);
    expect((await fetch(`${limited.url}/api/health`)).status).toBe(200);
    await limited.close();
  });
});

describe("contrat openapi.yaml ↔ réponses réelles", () => {
  it("les chemins décrits sont exactement ceux que le serveur expose", async () => {
    const spec = parse(await readFile(path.join(API_ROOT, "openapi.yaml"), "utf8")) as { paths: Record<string, Record<string, unknown>> };
    expect(Object.keys(spec.paths).sort()).toEqual(["/api/analyze", "/api/health", "/api/modes", "/api/parameters", "/api/reference/moon", "/api/sites/{id}", "/api/sources"]);
    expect(Object.keys(spec.paths["/api/analyze"] ?? {})).toEqual(["post"]);
  });

  it("l'énumération ParamId du contrat est celle du catalogue", async () => {
    const spec = parse(await readFile(path.join(API_ROOT, "openapi.yaml"), "utf8")) as { components: { schemas: { ParamId: { enum: string[] } } } };
    expect([...spec.components.schemas.ParamId.enum].sort()).toEqual([...PARAM_IDS].sort());
  });
});

describe("chargement des sites", () => {
  it("parseSites écarte les entrées invalides et garde les autres", () => {
    const notes: string[] = [];
    const sites = parseSites(
      [
        { id: "ok", name: "OK", lat: 10, lon: 20, role: "validation", terrain: "desert" },
        { id: "Mauvais Id", name: "x", lat: 0, lon: 0 },
        { id: "ok", name: "doublon", lat: 0, lon: 0 },
        { id: "lat", name: "x", lat: 95, lon: 0 },
        { id: "sans-role", name: "S", lat: 1, lon: 2 },
      ],
      (n) => notes.push(n),
    );
    expect(sites.map((s) => s.id)).toEqual(["ok", "sans-role"]);
    expect(sites[1]?.role).toBe("candidate");
    expect(notes).toHaveLength(3);
  });

  it("parseSites accepte { sites: [...] } et refuse le reste", () => {
    expect(parseSites({ sites: [{ id: "a", name: "A", lat: 0, lon: 0 }] })).toHaveLength(1);
    expect(() => parseSites("nope")).toThrow();
  });

  it("loadSites se rabat sur les fixtures quand candidates.json est absent", async () => {
    const notes: string[] = [];
    const dir = await mkdtemp(path.join(tmpdir(), "cyberspace-data-"));
    await mkdir(path.join(dir, "fixtures"));
    await copyFile(path.join(DATA, "fixtures", "site-values.json"), path.join(dir, "fixtures", "site-values.json"));
    const sites = await loadSites(dir, (n) => notes.push(n));
    expect(sites.map((s) => s.id)).toEqual(["haughton", "atacama", "amazonie"]);
    expect(notes[0]).toContain("candidates.json absent");
    await rm(dir, { recursive: true });
  });

  it("data/candidates.json du dépôt : tous les sites sont valides, avec un témoin négatif", async () => {
    const notes: string[] = [];
    const sites = await loadSites(DATA, (n) => notes.push(n));
    expect(notes).toEqual([]);
    expect(sites.length).toBeGreaterThanOrEqual(30);
    expect(sites.some((s) => s.role === "negative")).toBe(true);
    expect(sites.filter((s) => s.role === "validation").length).toBeGreaterThanOrEqual(7);
  });
});
