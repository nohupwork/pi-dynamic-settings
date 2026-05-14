/**
 * Dynamic Settings Extension
 *
 * Per-mode sampling parameters (temperature, top_p, etc.) injected into every
 * provider request — no model reload needed. Does not alter tools, system prompt,
 * or any other Pi behavior. Pi continues to function as a full agent harness.
 *
 * All params are loaded from a sidecar JSON file (config.json) so they can be
 * tuned without editing code.
 *
 * Usage:
 *   /dynamic-settings         Show mode selector
 *   /dynamic-settings off     Disable, restore provider defaults
 *   /dynamic-settings <name>  Switch to a named mode
 *
 * When active:
 * - Sampling params (temperature, top_p, …) are injected into each provider request
 * - All tools remain active
 * - System prompt is unchanged
 * - Status bar shows "settings:<name>"
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, "config.json");

// ── Types ────────────────────────────────────────────────────────────────────

interface SamplingParams {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  min_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  repetition_penalty?: number;
  [key: string]: number | undefined;
}

interface ConfigFile {
  modes?: Record<string, SamplingParams>;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PARAMS: SamplingParams = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 20,
  min_p: 0.0,
  presence_penalty: 0.0,
  frequency_penalty: 0.0,
  repetition_penalty: 1.0,
};

// ── Config Loading ───────────────────────────────────────────────────────────

function loadConfig(): ConfigFile {
  if (!existsSync(CONFIG_PATH)) {
    return { modes: {} };
  }
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as ConfigFile;
  } catch (err) {
    console.error(`[pi-dynamic-settings] Failed to parse ${CONFIG_PATH}:`, err);
    return { modes: {} };
  }
}

const config = loadConfig();
const modeParams: Record<string, SamplingParams> = config.modes ?? {};

function getParamsForMode(mode: string): SamplingParams {
  return modeParams[mode] ?? DEFAULT_PARAMS;
}

const MODE_NAMES = Object.keys(modeParams);

// ── Extension ────────────────────────────────────────────────────────────────

export default function dynamicSettingsExtension(pi: ExtensionAPI) {
  let activeMode: string | undefined;

  function updateStatus(ctx: ExtensionContext) {
    if (activeMode) {
      ctx.ui.setStatus("pi-dynamic-settings", ctx.ui.theme.fg("accent", `settings:${activeMode}`));
    } else {
      ctx.ui.setStatus("pi-dynamic-settings", undefined);
    }
  }

  async function enableMode(ctx: ExtensionContext, mode: string): Promise<void> {
    activeMode = mode;

    const params = getParamsForMode(mode);
    const paramSummary = `temp=${params.temperature}, top_p=${params.top_p}`;
    ctx.ui.notify(`Settings "${mode}" active — ${paramSummary}`, "info");
    updateStatus(ctx);
  }

  async function disableMode(ctx: ExtensionContext): Promise<void> {
    if (!activeMode) {
      ctx.ui.notify("No settings mode is active", "info");
      return;
    }

    const prev = activeMode;
    activeMode = undefined;

    ctx.ui.notify(`Settings "${prev}" disabled — provider defaults restored`, "info");
    updateStatus(ctx);
  }

  async function showSelector(ctx: ExtensionContext): Promise<void> {
    const items = [
      ...MODE_NAMES.map((name) => {
        const params = getParamsForMode(name);
        return `${name} (temp=${params.temperature}, top_p=${params.top_p})`;
      }),
      "off — restore provider defaults",
    ];

    const choice = await ctx.ui.select("Select settings mode", items);
    if (!choice) return;

    if (choice.startsWith("off")) {
      await disableMode(ctx);
      return;
    }

    const name = choice.split(" (")[0];
    await enableMode(ctx, name);
  }

  // ── Commands ─────────────────────────────────────────────────────────────

  pi.registerCommand("dynamic-settings", {
    description: "Switch sampling settings mode. No args shows selector.",
    getArgumentCompletions: (prefix) => {
      const options = [...MODE_NAMES, "off"];
      const filtered = options.filter((o) => o.startsWith(prefix));
      return filtered.length > 0 ? filtered.map((o) => ({ value: o, label: o })) : null;
    },
    handler: async (args, ctx) => {
      const arg = args?.trim();

      if (!arg) {
        await showSelector(ctx);
      } else if (arg.toLowerCase() === "off") {
        await disableMode(ctx);
      } else if (modeParams[arg.toLowerCase()]) {
        await enableMode(ctx, arg.toLowerCase());
      } else {
        ctx.ui.notify(`Unknown mode "${arg}". Use no args to see available modes.`, "warning");
      }
    },
  });

  // ── Events ───────────────────────────────────────────────────────────────

  // Inject sampling parameters into every provider request
  pi.on("before_provider_request", (event) => {
    if (!activeMode) return undefined;

    const params = getParamsForMode(activeMode);

    // Only include defined values — let the provider use defaults for anything omitted
    const overrides: Record<string, number> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        overrides[key] = value;
      }
    }

    if (Object.keys(overrides).length === 0) {
      return undefined;
    }

    return { ...(event.payload as Record<string, unknown>), ...overrides };
  });

  // Initialize status on session start
  pi.on("session_start", async (_event, ctx) => {
    updateStatus(ctx);
  });
}
