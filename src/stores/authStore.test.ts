import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/services/api", () => ({
  api: {
    login: vi.fn(async () => ({ token: "trainer-token", user: { id: 2, role: "teacher" } })),
    logout: vi.fn(async () => undefined),
  },
}));

import { useAuthStore } from "@/stores/authStore";
import { queryClient } from "@/lib/queryClient";

const adminGroups = { data: [{ id: 1, name: "DEV101" }, { id: 2, name: "MA101" }] };

describe("authStore", () => {
  beforeEach(() => queryClient.clear());

  it("drops the previous account's cached data on logout", async () => {
    queryClient.setQueryData(["groups"], adminGroups);

    await useAuthStore.getState().logout();

    expect(queryClient.getQueryData(["groups"])).toBeUndefined();
  });

  it("starts the next account with an empty cache on login", async () => {
    queryClient.setQueryData(["groups"], adminGroups);

    await useAuthStore.getState().login("trainer@ofppt.com", "password123");

    expect(queryClient.getQueryData(["groups"])).toBeUndefined();
    expect(useAuthStore.getState().user?.role).toBe("teacher");
  });
});
