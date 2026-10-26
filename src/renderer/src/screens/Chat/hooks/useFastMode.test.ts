import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useFastMode } from "./useFastMode";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(cleanup);

it("ignores the old profile's delayed fast-tier read", async () => {
  const old = deferred<string>();
  Object.defineProperty(window, "hermesAPI", {
    configurable: true,
    value: {
      getConfig: vi.fn((_key: string, profile: string) =>
        profile === "old" ? old.promise : Promise.resolve("normal"),
      ),
      setConfig: vi.fn().mockResolvedValue(undefined),
    },
  });
  const { result, rerender } = renderHook(
    ({ profile }) => useFastMode(profile),
    { initialProps: { profile: "old" } },
  );
  rerender({ profile: "new" });
  await act(async () => {});
  await act(async () => {
    old.resolve("fast");
  });
  expect(result.current.fastMode).toBe(false);
});

it("does not replace an explicit choice with the initial read", async () => {
  const initial = deferred<string>();
  Object.defineProperty(window, "hermesAPI", {
    configurable: true,
    value: {
      getConfig: vi.fn(() => initial.promise),
      setConfig: vi.fn().mockResolvedValue(undefined),
    },
  });
  const { result } = renderHook(() => useFastMode("work"));
  await act(async () => {
    await result.current.set(true);
  });
  await act(async () => {
    initial.resolve("normal");
  });
  expect(result.current.fastMode).toBe(true);
});
