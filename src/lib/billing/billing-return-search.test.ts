import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideBillingReturnConfirmation,
  parseBillingReturnSearch,
  stripBillingReturnSearchParams,
} from "./billing-return-search.js";

describe("parseBillingReturnSearch", () => {
  it("reads return paymentId from query string", () => {
    assert.deepEqual(parseBillingReturnSearch("?billing=return&paymentId=pay_123"), {
      kind: "return",
      paymentId: "pay_123",
    });
  });

  it("keeps return without paymentId so callers can fall back to storage", () => {
    assert.deepEqual(parseBillingReturnSearch("billing=return"), {
      kind: "return",
      paymentId: null,
    });
  });

  it("detects cancelled return", () => {
    assert.deepEqual(parseBillingReturnSearch("?billing=cancelled"), { kind: "cancelled" });
  });

  it("returns none when billing param is absent", () => {
    assert.deepEqual(parseBillingReturnSearch(""), { kind: "none" });
  });
});

describe("decideBillingReturnConfirmation", () => {
  it("treats SUCCEEDED as terminal success", () => {
    assert.deepEqual(
      decideBillingReturnConfirmation({
        status: "SUCCEEDED",
        currentPlan: "ENTERPRISE",
      }),
      { action: "succeeded", currentPlan: "ENTERPRISE" },
    );
  });

  it("treats PENDING as terminal for the current return check", () => {
    assert.deepEqual(
      decideBillingReturnConfirmation({
        status: "PENDING",
        currentPlan: "FREE",
      }),
      { action: "pending" },
    );
  });

  it("treats CANCELED as terminal cancel", () => {
    assert.deepEqual(
      decideBillingReturnConfirmation({
        status: "CANCELED",
        currentPlan: "FREE",
      }),
      { action: "canceled" },
    );
  });
});

describe("checkout exit return regression", () => {
  it("handles the exact return URL with one non-success PENDING result", () => {
    const returned = parseBillingReturnSearch(
      "?billing=return&paymentId=payment-opened-but-not-paid",
    );
    assert.deepEqual(returned, {
      kind: "return",
      paymentId: "payment-opened-but-not-paid",
    });
    assert.deepEqual(
      decideBillingReturnConfirmation({ status: "PENDING", currentPlan: "FREE" }),
      { action: "pending" },
    );
  });
});

describe("stripBillingReturnSearchParams", () => {
  it("strips billing return params and keeps unrelated search", () => {
    assert.equal(
      stripBillingReturnSearchParams(
        "https://app.example/app/billing?billing=return&paymentId=pay_1&plan=TEAM&x=1",
      ),
      "/app/billing?x=1",
    );
  });
});
