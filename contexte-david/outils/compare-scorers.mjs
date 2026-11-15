import { readFileSync } from "node:fs";
const [build, dir, fixtures] = process.argv.slice(2);
const { analyze } = await import(`${build}/src/analyze/analyze.js`);
const { createFixtureConnector, loadFixtures } = await import(`${build}/src/analyze/fixtures.js`);
const fx = await loadFixtures(fixtures);
let diffs = 0;
for (const mode of ["robotics", "calibration", "colony"]) {
  const ts = await analyze({ mode }, { sites: fx.sites, connectors: [createFixtureConnector(fx)] });
  const py = JSON.parse(readFileSync(`${dir}/py-${mode}.json`, "utf8"));
  for (const p of py.sites) {
    const t = ts.sites.find((s) => s.id === p.id);
    const same = t.total === p.total && t.criteria.every((c, i) => c.verdict === p.criteria[i].verdict && Math.abs(c.score - p.criteria[i].score) < 1e-3);
    if (!same) diffs++;
    console.log(`${mode.padEnd(12)} ${p.id.padEnd(9)} TS=${t.total} PY=${p.total} ${same ? "identique" : "ÉCART"}`);
  }
  console.log(`${mode.padEnd(12)} exclus TS=${ts.sites.filter((s) => s.excluded).map((s) => s.id)} PY=${(py.excluded ?? []).map((e) => e.id)}`);
}
console.log(diffs ? `${diffs} écarts` : "aucun écart");
