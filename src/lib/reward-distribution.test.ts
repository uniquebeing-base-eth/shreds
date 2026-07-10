import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { REWARDS_ABI } from "./contracts";
import { normalizePrivateKey, resolveCeloRpcUrl } from "./reward-distribution";

describe("reward-distribution helpers", () => {
  it("normalizes a raw 64-byte private key", () => {
    const raw = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    assert.equal(normalizePrivateKey(raw), `0x${raw}`);
  });

  it("uses a configured Celo RPC URL and falls back to the public endpoint", () => {
    assert.equal(resolveCeloRpcUrl({ CELO_RPC_URL: "https://custom-rpc.example" }), "https://custom-rpc.example");
    assert.equal(resolveCeloRpcUrl({ CELO_RPC_URL: "   " }), "https://forno.celo.org");
    assert.equal(resolveCeloRpcUrl({}), "https://forno.celo.org");
  });

  it("exposes the reward contract distribute entrypoint", () => {
    assert.ok(REWARDS_ABI.some((item) => item.type === "function" && item.name === "distribute"));
  });
});
