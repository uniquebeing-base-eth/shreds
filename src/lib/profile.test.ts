import { describe, expect, test } from "bun:test";
import { buildLeaderboardFromProfiles, mergeStoredProfiles } from "./profile";

describe("profile sync helpers", () => {
  test("mergeStoredProfiles prefers the newest server values for the same wallet", () => {
    const cache = {
      "0xabc": {
        username: "old-name",
        wallet: "0xabc",
        xp: 10,
        packs_shredded: 1,
        level: 1,
      },
    };

    const merged = mergeStoredProfiles(cache, [
      {
        username: "fresh-name",
        wallet: "0xABC",
        xp: 120,
        packs_shredded: 4,
        level: 2,
      },
    ]);

    expect(merged["0xabc"]).toEqual({
      username: "fresh-name",
      wallet: "0xabc",
      xp: 120,
      packs_shredded: 4,
      level: 2,
    });
  });

  test("buildLeaderboardFromProfiles sorts by xp and packs shredded", () => {
    const rows = buildLeaderboardFromProfiles({
      "0xabc": {
        username: "alpha",
        wallet: "0xabc",
        xp: 200,
        packs_shredded: 4,
        level: 2,
      },
      "0xdef": {
        username: "beta",
        wallet: "0xdef",
        xp: 200,
        packs_shredded: 6,
        level: 3,
      },
      "0x123": {
        username: "gamma",
        wallet: "0x123",
        xp: 50,
        packs_shredded: 1,
        level: 1,
      },
    });

    expect(rows.map((row) => row.wallet)).toEqual(["0xdef", "0xabc", "0x123"]);
  });
});
