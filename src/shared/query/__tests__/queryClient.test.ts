import { describe, expect, it, vi } from "vitest";
import { queryClient } from "../queryClient";

describe("queryClient retry policy", () => {
  it("does not retry authentication failures before session recovery", async () => {
    const queryFn = vi.fn().mockRejectedValue({ code: 401 });

    await expect(
      queryClient.fetchQuery({
        queryKey: ["auth-retry-policy"],
        queryFn,
      }),
    ).rejects.toMatchObject({ code: 401 });

    expect(queryFn).toHaveBeenCalledTimes(1);
    queryClient.removeQueries({ queryKey: ["auth-retry-policy"] });
  });

  it("retains one retry for transient failures", async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary network error"))
      .mockResolvedValueOnce("recovered");

    await expect(
      queryClient.fetchQuery({
        queryKey: ["network-retry-policy"],
        queryFn,
      }),
    ).resolves.toBe("recovered");

    expect(queryFn).toHaveBeenCalledTimes(2);
    queryClient.removeQueries({ queryKey: ["network-retry-policy"] });
  });
});
