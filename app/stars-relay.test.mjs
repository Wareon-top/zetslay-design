import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(
  new URL("./stars-relay.js", import.meta.url),
  "utf8",
);
const fixture = () => ({
  installation: { enabled: true },
  config: {
    automatic: false,
    autoRefund: false,
    notifyOwner: true,
    fastMode: false,
    showSender: false,
    currency: "TON",
    walletVersion: "V4R2",
    maxSpend: "5",
    dailyLimit: "20",
    gasReserve: "0.2",
    lowTon: "0.5",
    lowUsdt: "5",
    rateRub: "0",
    feePercent: 0,
    buyerBlacklist: [],
    manageLots: false,
    autoPause: false,
    personalLots: false,
    pricePerStarMinor: 200,
    personalLotMinutes: 30,
    templateLotId: "",
    maxStars: 10000,
    askTemplate: "{order_id}",
    confirmTemplate: "{recipient} {token}",
    receiptTemplate: "{receipt}",
    errorTemplate: "",
    paidMessagesTemplate: "",
  },
  wallet: null,
  balance: null,
  mappings: [],
  hidden: [],
  personal: [],
  tasks: [],
  lotQueue: null,
  lotOperation: null,
  analytics: {
    orders: 0,
    stars: 0,
    revenueMinor: 0,
    profitMinor: null,
    uncertain: 0,
  },
  configured: false,
  proxyConfigured: false,
  workerEnabled: true,
  purchaseEnabled: true,
  deliveryEnabled: true,
  lotsEnabled: true,
});
function harness() {
  const listeners = {},
    calls = [],
    feedback = { textContent: "", setAttribute() {} },
    fields = {
      mnemonic: { value: "PRIVATE_SEED" },
      fragmentCookie: { value: "PRIVATE_COOKIE" },
      tonApiKey: { value: "PRIVATE_KEY" },
    },
    fieldset = { disabled: false };
  const form = {
    querySelector: (s) =>
      s === "fieldset"
        ? fieldset
        : s.includes("feedback")
          ? feedback
          : fields[s.match(/name="([^"]+)"/)?.[1]] || null,
  };
  const context = vm.createContext({
    authState: { token: "session" },
    sessionGeneration: 1,
    escapeHtml: (v) =>
      String(v).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      ),
    queueMicrotask: () => {},
    URL,
    console,
    window: { confirm: () => true },
    document: {
      addEventListener: (k, f) => (listeners[k] = f),
      querySelector: () => feedback,
    },
    apiRequest: async (path, options) => {
      calls.push([path, options]);
      return fixture();
    },
    humanError: (e) => e.message,
    renderPluginPage: () => calls.push(["render"]),
  });
  vm.runInContext(source, context);
  context.sample = fixture();
  vm.runInContext(
    "starsUi.session=authState.token;starsUi.generation=sessionGeneration;starsUi.status=sample;",
    context,
  );
  return {
    context,
    listeners,
    calls,
    form,
    feedback,
    fields,
    fieldset,
    run: (s) => vm.runInContext(s, context),
  };
}
test("Ultra Stars panel has real balance state, wallet versions, budgets, mapping and no generated cover", () => {
  const h = harness(),
    html = h.run(
      "starsSettingsMarkup({id:'zetslay.stars-relay',installed:true})",
    );
  assert.match(html, /Дневной лимит/);
  assert.match(html, /W5/);
  assert.match(html, /Не проверен/);
  assert.match(html, /Проверить без списания/);
  assert.match(html, /Лот → количество Stars/);
  assert.doesNotMatch(html, /<figure|data-plugin-cover|PRIVATE_/);
  assert.equal(h.run("starsSettingsMarkup({id:'other',installed:true})"), "");
});
test("failed settings save retains typed secrets and existing form, without storing them in UI state", async () => {
  const h = harness();
  h.context.form = h.form;
  h.context.apiRequest = async () => {
    throw Error("Сессия не подтверждена");
  };
  await h.run("starsAction('settings',{mnemonic:'PRIVATE'},form)");
  assert.equal(h.fields.mnemonic.value, "PRIVATE_SEED");
  assert.match(h.feedback.textContent, /Сессия не подтверждена/);
  assert.equal(h.fieldset.disabled, false);
  assert.equal(h.calls.length, 0);
  assert.ok(!h.run("JSON.stringify(starsUi)").includes("PRIVATE"));
});
test("acknowledged save clears secrets and refresh failure advises against repeating the operation", async () => {
  const h = harness();
  h.context.form = h.form;
  let calls = 0;
  h.context.apiRequest = async () => {
    if (calls++ === 0) return {};
    throw Error("Network");
  };
  await h.run("starsAction('settings',{},form)");
  assert.equal(h.fields.mnemonic.value, "");
  assert.match(h.feedback.textContent, /Действие принято/);
  assert.match(h.feedback.textContent, /перед повтором/);
});
test("late response after account switch cannot display another wallet or clear next account input", async () => {
  const h = harness();
  let resolve;
  h.context.form = h.form;
  h.context.apiRequest = () => new Promise((r) => (resolve = r));
  const pending = h.run("starsAction('settings',{},form)");
  h.run("authState.token='other';sessionGeneration++;resetStarsUi()");
  resolve(fixture());
  await pending;
  assert.equal(h.run("starsUi.status"), null);
  assert.equal(h.fields.mnemonic.value, "PRIVATE_SEED");
  assert.equal(h.calls.length, 0);
});
test("redelivery and lot changes require explicit confirmation; reconcile uses the read proof route", async () => {
  const h = harness();
  h.context.window.confirm = () => false;
  await h.listeners.click({
    target: {
      closest: () => ({
        hasAttribute: (k) => k === "data-stars-task",
        dataset: { action: "redeliver", starsTask: "A" },
      }),
    },
  });
  assert.equal(h.calls.length, 0);
  h.context.window.confirm = () => true;
  await h.listeners.click({
    target: {
      closest: () => ({
        hasAttribute: (k) => k === "data-stars-task",
        dataset: { action: "reconcile", starsTask: "A" },
      }),
    },
  });
  assert.equal(h.calls[0][0], "/api/v1/plugins/stars-relay/task");
  assert.equal(h.calls[0][1].body.action, "reconcile");
});
test("provider names and buyer usernames are escaped, and uncertain payment has no new-purchase retry", () => {
  const h = harness();
  h.context.sample.mappings = [
    { lotId: "10", title: "<img src=x onerror=alert(1)>", quantity: 100 },
  ];
  h.context.sample.tasks = [
    {
      orderId: "A",
      status: "payment_unknown",
      recipient: "<script>",
      quantity: 100,
    },
  ];
  const html = h.run(
    "starsSettingsMarkup({id:'zetslay.stars-relay',installed:true})",
  );
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img|<script|data-action="retry"/);
  assert.match(html, /Проверить платёж/);
});
