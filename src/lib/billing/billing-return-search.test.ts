import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  decideConfirmPaymentPoll,
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

describe("decideConfirmPaymentPoll", () => {
  it("treats SUCCEEDED as terminal success", () => {
    assert.deepEqual(
      decideConfirmPaymentPoll({
        status: "SUCCEEDED",
        currentPlan: "ENTERPRISE",
      }),
      { action: "succeeded", currentPlan: "ENTERPRISE" },
    );
  });

  it("treats PENDING as retry without creating a new payment", () => {
    assert.deepEqual(
      decideConfirmPaymentPoll({
        status: "PENDING",
        currentPlan: "FREE",
      }),
      { action: "retry" },
    );
  });

  it("treats CANCELED as terminal cancel", () => {
    assert.deepEqual(
      decideConfirmPaymentPoll({
        status: "CANCELED",
        currentPlan: "FREE",
      }),
      { action: "canceled" },
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
