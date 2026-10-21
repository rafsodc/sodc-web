import { describe, expect, it, vi } from "vitest";
import { createAppQueryClient } from "../queryClient";
const queryClient = createAppQueryClient();

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

  it.each(["SESSION_VERSION_STALE", "ACCESS_REVOKED"])("does not retry the explicit %s marker without a generic error code", async marker => {
    const error = new Error(marker);
    const queryFn = vi.fn().mockRejectedValue(error);
    await expect(queryClient.fetchQuery({ queryKey: [marker], queryFn })).rejects.toBe(error);
    expect(queryFn).toHaveBeenCalledOnce();
    queryClient.removeQueries({ queryKey: [marker] });
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
