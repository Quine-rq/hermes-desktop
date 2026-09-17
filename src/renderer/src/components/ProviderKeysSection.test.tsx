import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderKeysSection } from "./ProviderKeysSection";

vi.mock("./useI18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

const api = {
  listCustomProviders: vi.fn(),
  listModels: vi.fn(),
  onModelLibraryChanged: vi.fn(),
  onCustomProvidersChanged: vi.fn(),
};

function renderProviders(): void {
  render(
    <ProviderKeysSection
      items={[]}
      env={{}}
      savedKey={null}
      visibleKeys={new Set()}
      onChange={vi.fn()}
      onBlur={vi.fn()}
      onToggleVisibility={vi.fn()}
      onRemove={vi.fn()}
      profile="work"
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(window, "hermesAPI", {
    value: api,
    configurable: true,
  });
  api.listCustomProviders.mockResolvedValue([
    { name: "Local workstation", baseUrl: "http://localhost:8000/v1" },
  ]);
  api.listModels.mockResolvedValue([]);
  api.onModelLibraryChanged.mockReturnValue(() => {});
  api.onCustomProvidersChanged.mockReturnValue(() => {});
});

describe("custom provider loading", () => {
  // @lat: [[provider-setup#Provider setup#LLM-provider keys are configured-only, via modals#Named custom providers#Model library failure preserves configured providers]]
  it("keeps configured provider cards when the model library fails, then recovers on refresh", async () => {
    api.listModels.mockRejectedValueOnce(
      new Error("Model library unavailable"),
    );
    renderProviders();
    expect(await screen.findByText("Local workstation")).toBeVisible();
    expect(screen.getByText("http://localhost:8000/v1")).toBeVisible();
    expect(api.listCustomProviders).toHaveBeenCalledWith("work");

    api.listModels.mockResolvedValue([
      {
        provider: "custom",
        providerLabel: "Legacy endpoint",
        baseUrl: "http://localhost:9000/v1",
      },
    ]);
    await act(async () => {
      api.onModelLibraryChanged.mock.calls[0][0]();
    });
    expect(await screen.findByText("Legacy endpoint")).toBeVisible();
    expect(screen.getByText("Local workstation")).toBeVisible();
  });

  it("falls back to legacy models when the provider identity store fails", async () => {
    api.listCustomProviders.mockRejectedValue(new Error("Store unavailable"));
    api.listModels.mockResolvedValue([
      {
        provider: "custom",
        providerLabel: "Legacy endpoint",
        baseUrl: "http://localhost:9000/v1",
      },
    ]);
    renderProviders();
    expect(await screen.findByText("Legacy endpoint")).toBeVisible();
  });

  it("keeps the authoritative endpoint and excludes built-in provider models", async () => {
    api.listModels.mockResolvedValue([
      {
        provider: "custom",
        providerLabel: "Local workstation",
        baseUrl: "http://localhost:9000/v1",
      },
      {
        provider: "custom",
        providerLabel: "Hermes One",
        baseUrl: "https://inference.hermesone.org/v1",
      },
    ]);
    renderProviders();
    expect(await screen.findByText("Local workstation")).toBeVisible();
    expect(screen.getAllByText("Local workstation")).toHaveLength(1);
    expect(screen.getByText("http://localhost:8000/v1")).toBeVisible();
    expect(
      screen.queryByText("http://localhost:9000/v1"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Hermes One")).not.toBeInTheDocument();
  });

  it("handles both reads failing and retries them on a provider change", async () => {
    api.listCustomProviders.mockRejectedValueOnce(
      new Error("Store unavailable"),
    );
    api.listModels.mockRejectedValueOnce(
      new Error("Model library unavailable"),
    );
    await act(async () => {
      renderProviders();
    });
    expect(screen.getByText("providers.keys.addProvider")).toBeVisible();
    await act(async () => {
      api.onCustomProvidersChanged.mock.calls[0][0]();
    });
    expect(await screen.findByText("Local workstation")).toBeVisible();
  });
});
