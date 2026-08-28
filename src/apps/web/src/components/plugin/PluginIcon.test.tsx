// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import {
  resetPluginLogoStoreForTest,
  setPluginLogoUrls,
} from "@/lib/plugin-logos";

const { PluginIcon } = await import("./PluginIcon");

afterEach(() => {
  cleanup();
  resetPluginLogoStoreForTest();
});

it("uses branding.icon instead of the image logo or contribution hint", () => {
  setPluginLogoUrls(
    new Map([
      [
        "docs",
        {
          displayName: "Docs",
          icon: "FileText",
          compactIconUrl: null,
          logoUrl: "/api/v1/plugins/docs/assets/logo?h=abc",
          logoDarkUrl: "/api/v1/plugins/docs/assets/logo-dark?h=def",
          icons: new Map(),
        },
      ],
    ]),
  );

  const view = render(<PluginIcon pluginId="docs" icon="Layers" />);
  expect(view.container.querySelector("[data-icon=FileText]")).toBeTruthy();
  expect(view.container.querySelector("[data-icon=Layers]")).toBeNull();
  expect(view.container.querySelector("img")).toBeNull();
});

it("uses the contribution hint when branding.icon is omitted", () => {
  setPluginLogoUrls(
    new Map([
      [
        "github",
        {
          displayName: "GitHub",
          icon: null,
          compactIconUrl: null,
          logoUrl: "/api/v1/plugins/github/assets/logo?h=abc",
          logoDarkUrl: null,
          icons: new Map(),
        },
      ],
    ]),
  );

  const view = render(<PluginIcon pluginId="github" icon="Layers" />);
  expect(view.container.querySelector("[data-icon=Layers]")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
});

it("uses Zap compactly when a logo-only plugin has no contribution hint", () => {
  setPluginLogoUrls(
    new Map([
      [
        "github",
        {
          displayName: "GitHub",
          icon: null,
          compactIconUrl: null,
          logoUrl: "/api/v1/plugins/github/assets/logo?h=abc",
          logoDarkUrl: null,
          icons: new Map(),
        },
      ],
    ]),
  );

  const view = render(<PluginIcon pluginId="github" icon={null} />);
  expect(view.container.querySelector("[data-icon=Zap]")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
});

it("uses a plugin-owned compact SVG before named icon hints", () => {
  const compactIconUrl = "/api/v1/plugins/omega/assets/icon?h=abc";
  setPluginLogoUrls(
    new Map([
      [
        "omega",
        {
          displayName: "Omegacode",
          icon: "Workflow",
          compactIconUrl,
          logoUrl: null,
          logoDarkUrl: null,
          icons: new Map(),
        },
      ],
    ]),
  );

  const view = render(<PluginIcon pluginId="omega" icon="Layers" />);
  const asset = view.container.querySelector(
    `[data-plugin-icon-asset="${compactIconUrl}"]`,
  );
  expect(asset).toBeTruthy();
  expect(asset?.getAttribute("style")).toContain(compactIconUrl);
  expect(view.container.querySelector("[data-icon]")).toBeNull();
});

it("resolves every named branding.icon the shipped plugins declare", async () => {
  const { readFile } = await import("node:fs/promises");
  const { dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { pluginIconName } = await import("./PluginIcon");

  // bb upstream scans plugins/*/package.json manifests. vozen ships no bb
  // plugin manifests — its provider glyphs are declared inline in the server
  // shim (bbShim.ts), so scan that file's glyph literals instead.
  const shimSource = await readFile(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../server/bbShim.ts",
    ),
    "utf8",
  );
  const declared = [
    ...[...shimSource.matchAll(/glyph:\s*"([A-Za-z]+)"/g)].map((m) => m[1]),
    ...[
      ...(shimSource
        .match(/HERDR_AGENT_ICON_GLYPHS[^{]*\{([^}]*)\}/)?.[1]
        ?.matchAll(/"([A-Za-z]+)"/g) ?? []),
    ].map((m) => m[1]),
  ];

  expect(declared.length).toBeGreaterThan(0);
  // A typo silently falls back to Zap, so a deliberate icon must round-trip.
  expect(declared.filter((icon) => pluginIconName(icon) !== icon)).toEqual([]);
});
