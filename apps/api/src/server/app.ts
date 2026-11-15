import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { analyze, collectValues } from "../analyze/analyze.js";
import type { AnalyzeDeps } from "../analyze/analyze.js";
import { ValidationError } from "../analyze/validate.js";
import { moonValues } from "../analyze/moon.js";
import { MODES, PARAM_IDS, isModeId, isVegetated, scoreSite } from "../scoring/index.js";
import { SOURCES, valueSources } from "../sources/catalog.js";
import { PARAMETERS } from "./parameters.js";

export type AppDeps = AnalyzeDeps & {
  /** Noms des sources branchées, renvoyés par GET /api/sites/{id}. */
  sourceNames: string[];
  /** Vrai si les valeurs viennent des données d'exemple (USE_FIXTURES) : les sources par valeur le disent. */
  useFixtures?: boolean;
  /** Contrat OpenAPI déjà parsé (servi sur /api/docs et /api/openapi.json). */
  openapi: Record<string, unknown>;
  /** data/reference/moon-south-pole.json, si présent. */
  moonReference?: unknown;
  allowedOrigins?: string[];
  rateLimitPerMinute?: number;
  log?: (message: string, error?: unknown) => void;
};

export function createApp(deps: AppDeps): express.Express {
  const log = deps.log ?? (() => undefined);
  const allowed = deps.allowedOrigins ?? [];
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Azure Container Apps : l'IP du client est dans X-Forwarded-For

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || allowed.includes(origin)),
      methods: ["GET", "POST"],
    }),
  );

  // Sonde de santé et documentation : avant la limitation de débit (les sondes Azure sont fréquentes).
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/openapi.json", (_req, res) => {
    res.json(deps.openapi);
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(deps.openapi));

  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: deps.rateLimitPerMinute ?? 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Trop de requêtes, réessayez dans une minute" },
    }),
  );
  app.use(express.json({ limit: "50kb" }));

  app.get("/api/modes", (_req, res) => {
    res.json({ modes: Object.values(MODES) });
  });

  app.get("/api/parameters", (_req, res) => {
    res.json({ parameters: PARAMETERS });
  });

  app.get("/api/sources", (_req, res) => {
    res.json({ sources: SOURCES });
  });

  app.get("/api/reference/moon", (_req, res) => {
    if (deps.moonReference === undefined) {
      res.status(404).json({ error: "Profil lunaire de référence indisponible" });
      return;
    }
    res.json(deps.moonReference);
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      res.json(await analyze(req.body, deps));
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
        return;
      }
      log("POST /api/analyze a échoué", error);
      res.status(500).json({ error: "Erreur interne" });
    }
  });

  app.get("/api/sites/:id", async (req, res) => {
    const site = deps.sites.find((s) => s.id === req.params.id);
    if (!site) {
      res.status(404).json({ error: `Site inconnu : ${req.params.id}` });
      return;
    }
    const mode = typeof req.query.mode === "string" ? req.query.mode : "robotics";
    if (!isModeId(mode)) {
      res.status(400).json({ error: `Mode inconnu : ${mode}` });
      return;
    }
    try {
      const values = await collectValues(site, deps.connectors, deps.onConnectorError);
      const { total, criteria } = scoreSite(values, MODES[mode].criteria);
      const excluded = isVegetated(values);
      res.json({
        id: site.id,
        name: site.name,
        lat: site.lat,
        lon: site.lon,
        role: site.role,
        ...(site.terrain ? { terrain: site.terrain } : {}),
        mode,
        total: excluded ? 0 : total,
        criteria,
        ...(excluded ? { excluded: "vegetation" } : {}),
        values,
        sources: deps.sourceNames,
        valueSources: valueSources(values, deps.useFixtures),
        moon: moonValues(deps.moonReference, PARAM_IDS),
      });
    } catch (error) {
      log(`GET /api/sites/${site.id} a échoué`, error);
      res.status(500).json({ error: "Erreur interne" });
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Route inconnue" });
  });

  // Corps JSON invalide ou trop gros : erreur du client, pas du serveur.
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    const type = (error as { type?: string } | null)?.type;
    if (type === "entity.parse.failed") {
      res.status(400).json({ error: "Corps JSON invalide" });
      return;
    }
    if (type === "entity.too.large") {
      res.status(413).json({ error: "Corps trop volumineux" });
      return;
    }
    log("Erreur non gérée", error);
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(500).json({ error: "Erreur interne" });
  });

  return app;
}
