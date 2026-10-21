const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");

test("Paymob webhook accepts a valid transaction HMAC and rejects tampering", async () => {
  const { verifyPaymobTransactionHmac } = await import("../src/lib/paymob.ts");
  const secret = "test-only-hmac-secret";
  const transaction = {
    amount_cents: 12500,
    created_at: "2026-10-19T12:00:00.000000",
    currency: "EGP",
    error_occured: false,
    has_parent_transaction: false,
    id: 123456,
    integration_id: 98765,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 654321 },
    owner: 456,
    pending: false,
    source_data: { pan: "4242", sub_type: "Visa", type: "card" },
    success: true,
  };
  const fields = [
    transaction.amount_cents,
    transaction.created_at,
    transaction.currency,
    transaction.error_occured,
    transaction.has_parent_transaction,
    transaction.id,
    transaction.integration_id,
    transaction.is_3d_secure,
    transaction.is_auth,
    transaction.is_capture,
    transaction.is_refunded,
    transaction.is_standalone_payment,
    transaction.is_voided,
    transaction.order.id,
    transaction.owner,
    transaction.pending,
    transaction.source_data.pan,
    transaction.source_data.sub_type,
    transaction.source_data.type,
    transaction.success,
  ];
  const hmac = createHmac("sha512", secret).update(fields.map(String).join("")).digest("hex");

  assert.equal(verifyPaymobTransactionHmac(transaction, hmac, secret), true);
  const tamperedHmac = `${hmac[0] === "0" ? "1" : "0"}${hmac.slice(1)}`;
  assert.equal(verifyPaymobTransactionHmac(transaction, tamperedHmac, secret), false);
  assert.equal(verifyPaymobTransactionHmac({ ...transaction, amount_cents: 1 }, hmac, secret), false);
});
