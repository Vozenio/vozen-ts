// @vitest-environment jsdom

import { cleanup, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetPluginSlotStoreForTest } from "@/lib/plugin-slots";
import { createQueryClientTestHarness } from "@/test/queryClientTestHarness";
import { useSettingsNavState } from "./settings-nav";

const mocks = vi.hoisted(() => ({
  accessState: "unavailable",
}));

vi.mock("@/hooks/useHostDaemon", () => ({
  useHostDaemon: () => ({ hasDaemon: false }),
  useLocalHostDaemonAccess: () => ({ accessState: mocks.accessState }),
}));

function wrapperFor(path: string) {
  const { wrapper: QueryWrapper } = createQueryClientTestHarness();
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </QueryWrapper>
    );
  };
}

afterEach(() => {
  cleanup();
  resetPluginSlotStoreForTest();
  mocks.accessState = "unavailable";
});

describe("useSettingsNavState", () => {
  it("resolves the Providers bucket from its section route", () => {
    const { result } = renderHook(() => useSettingsNavState(), {
      wrapper: wrapperFor("/settings/providers"),
    });

    expect(result.current.activeSection).toBe("providers");
    expect(result.current.hasUnknownSection).toBe(false);
  });

  it("resolves the Machines bucket from its route without listing it in the visible nav", () => {
    // Machines is bb's multi-daemon fleet feature (vozen has no host daemon to
    // pair) — still routable so a stale link resolves, just not an entry
    // point anyone can navigate to from the sidebar.
    const { result } = renderHook(() => useSettingsNavState(), {
      wrapper: wrapperFor("/settings/machines"),
    });

    expect(result.current.activeSection).toBe("machines");
    expect(result.current.sections.map((section) => section.id)).not.toContain(
      "machines",
    );
  });

  it("does not list the Community section in the visible nav", () => {
    // Community links out to bb's own Discord/GitHub — vozen has neither.
    const { result } = renderHook(() => useSettingsNavState(), {
      wrapper: wrapperFor("/settings/general"),
    });

    expect(result.current.sections.map((section) => section.id)).not.toContain(
      "community",
    );
  });

  it("shows Files when local helper access can be enabled", () => {
    mocks.accessState = "permission-required";
    const { result } = renderHook(() => useSettingsNavState(), {
      wrapper: wrapperFor("/settings/files"),
    });

    expect(result.current.sections.map((section) => section.id)).toContain(
      "files",
    );
  });

  it("resolves archived threads as a settings section", () => {
    const { result } = renderHook(() => useSettingsNavState(), {
      wrapper: wrapperFor("/settings/archived"),
    });

    expect(result.current.activeSection).toBe("archived");
    expect(result.current.sections.map((section) => section.id)).toContain(
      "archived",
    );
  });

  it("keeps plugin management out of Settings", () => {
    const { result } = renderHook(() => useSettingsNavState(), {
      wrapper: wrapperFor("/settings"),
    });

    expect(result.current.sections.map((section) => section.id)).not.toContain(
      "plugins",
    );
  });
});
