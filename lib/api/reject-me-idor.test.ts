import { describe, expect, it } from "vitest";
import {
  rejectMeIdorBody,
  rejectMeIdorSearchParams,
} from "@/lib/api/reject-me-idor";

describe("rejectMeIdor", () => {
  it("accepte query propre", () => {
    expect(() =>
      rejectMeIdorSearchParams(new URLSearchParams("limit=20"))
    ).not.toThrow();
  });

  it("refuse userId / adherentId", () => {
    expect(() =>
      rejectMeIdorSearchParams(new URLSearchParams("userId=u2"))
    ).toThrow(/userId/);
    expect(() =>
      rejectMeIdorSearchParams(new URLSearchParams("adherentId=a1"))
    ).toThrow(/adherentId/);
  });

  it("refuse body senderId", () => {
    expect(() => rejectMeIdorBody({ senderId: "x" })).toThrow(/senderId/);
  });
});
