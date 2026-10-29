/* The wallet phrase and provider session remain in the form, never UI state or browser storage. */
const starsUi = {
  session: null,
  generation: 0,
  status: null,
  busy: false,
  loading: false,
  error: "",
  report: null,
  revision: 0,
};
function resetStarsUi() {
  Object.assign(starsUi, {
    session: authState.token,
    generation: sessionGeneration,
    status: null,
    busy: false,
    loading: false,
    error: "",
    report: null,
    revision: starsUi.revision + 1,
  });
}
const starsCurrent = (token, generation) =>
  token === authState.token && generation === sessionGeneration;
const starsLabels = {
  ignored: "Существующий заказ пропущен",
  unmatched: "Лот не привязан",
  discovering: "Читаем заказ",
  awaiting_recipient: "Ждём @username",
  awaiting_confirmation: "Ждём подтверждения",
  queued: "В очереди",
  broadcasting: "Передаём в TON",
  confirming: "Проверяем платёж",
  payment_unknown: "Оплата требует проверки",
  payment_confirmed: "Оплата подтверждена",
  delivery_unknown: "Чек требует проверки",
  completed: "Чек отправлен",
  manual: "Проверка продавцом",
  cancelled: "Отменён",
  refunded: "Возвращён",
  refund_unknown: "Возврат требует проверки",
};
const starsMoney = (n) =>
  n === null ? "Нет курса" : (Number(n || 0) / 100).toFixed(2) + " ₽";
function starsCoin(value, currency = "TON") {
  try {
    const n = BigInt(value),
      decimals = currency === "USDT" ? 6 : 9,
      base = 10n ** BigInt(decimals);
    return (
      String(n / base) +
      "." +
      String(n % base)
        .padStart(decimals, "0")
        .replace(/0+$/, "")
        .padEnd(2, "0") +
      " " +
      currency
    );
  } catch {
    return "Не проверено";
  }
}
function starsSettingsMarkup(plugin) {
  if (plugin.id !== "zetslay.stars-relay" || !plugin.installed) return "";
  if (
    starsUi.session !== authState.token ||
    starsUi.generation !== sessionGeneration
  )
    resetStarsUi();
  if (!starsUi.status && !starsUi.loading && !starsUi.error)
    queueMicrotask(loadStarsStatus);
  const s = starsUi.status;
  if (!s)
    return `<section class="plugin-page-panel" data-stars-panel><h2>Stars Relay</h2><p role="status">${escapeHtml(starsUi.error || "Загружаем настройки…")}</p><button type="button" class="button button--ghost" data-stars-refresh>Обновить</button></section>`;
  const c = {
      ...s.config,
      pricePerStarRub: (s.config.pricePerStarMinor / 100).toFixed(2),
    },
    disabled = starsUi.busy ? "disabled" : "",
    field = (k, label, type = "text") =>
      `<label>${label}<input name="${k}" type="${type}" value="${escapeHtml(String(c[k]))}" ${type === "number" ? 'min="0" step="any"' : ""} required></label>`,
    check = (k, label) =>
      `<label class="stars-switch"><input type="checkbox" name="${k}" ${c[k] ? "checked" : ""}>${label}</label>`;
  return `<section class="stars-panel" data-stars-panel>
 <header class="stars-intro"><div><span class="stars-kicker">УЛЬТРА · TELEGRAM STARS</span><h2>Stars Relay</h2><p>Оплаченный заказ → получатель → проверенный платёж → чек в чате.</p></div><button type="button" class="button button--ghost" data-stars-refresh ${disabled}>Обновить</button></header>
 <div class="stars-metrics"><div><span>Заказов с чеком</span><strong>${s.analytics.orders}</strong></div><div><span>Stars оплачено</span><strong>${s.analytics.stars.toLocaleString("ru-RU")}</strong></div><div><span>Выручка RUB</span><strong>${starsMoney(s.analytics.revenueMinor)}</strong></div><div><span>Требуют проверки</span><strong>${s.analytics.uncertain}</strong></div></div>
 <p class="stars-feedback" data-stars-feedback role="status">${escapeHtml(starsUi.error)}</p>
 <section class="plugin-page-panel"><div class="stars-section-head"><div><span>ПОДКЛЮЧЕНИЕ</span><h3>Кошелёк и Fragment</h3></div><span class="stars-pill">${s.configured ? "Данные сохранены" : "Заполните подключение"}</span></div>
 <div class="stars-balance"><div><span>TON</span><strong>${s.balance ? (Number(s.balance.tonNano) / 1e9).toFixed(4) : "Не проверен"}</strong></div><div><span>USDT · сеть TON</span><strong>${s.balance ? (Number(s.balance.usdtUnits) / 1e6).toFixed(2) : "Не проверен"}</strong></div><small>${s.balance ? "Проверка: " + escapeHtml(s.balance.checkedAt) : "Нулевой баланс не подставляется вместо отсутствующих данных."}</small></div>
 <p class="stars-note">${s.wallet ? "Кошелёк " + escapeHtml(s.wallet.version) + ": <code>" + escapeHtml(s.wallet.address) + "</code>" : "Подготовьте активированный кошелёк, связанный с аккаунтом Fragment."} Секреты вводите только здесь. Для плагина используйте отдельный кошелёк с оборотными средствами.</p>
 <form data-stars-form="connection"><fieldset ${disabled}><div class="stars-fields"><label>Версия кошелька<select name="walletVersion"><option ${c.walletVersion === "V4R2" ? "selected" : ""}>V4R2</option><option value="W5" ${c.walletVersion === "W5" ? "selected" : ""}>W5 · v5r1</option></select></label><label>Адрес кошелька<input name="walletAddress" autocomplete="off" spellcheck="false" placeholder="UQ… / EQ… / 0:…"></label><label class="stars-wide">Seed-фраза · 24 слова<textarea name="mnemonic" rows="2" autocomplete="off" spellcheck="false" placeholder="Оставьте пустым, чтобы сохранить прежнюю фразу"></textarea></label><label class="stars-wide">Экспорт cookie Fragment<textarea name="fragmentCookie" rows="3" autocomplete="off" spellcheck="false" placeholder="JSON Cookie-Editor, Netscape или Cookie header"></textarea></label><label>Hash · необязательно<input name="fragmentHash" type="password" autocomplete="new-password" placeholder="Автоматически или api?hash=…"></label><label>TonAPI Key<input name="tonApiKey" type="password" autocomplete="new-password" placeholder="Пусто — оставить сохранённый"></label><label class="stars-wide">Отдельный прокси Fragment · необязательно<input name="proxyUrl" type="password" autocomplete="new-password" placeholder="http://login:password@host:port"></label></div>${check("clearProxy", "Удалить отдельный прокси и использовать прямое соединение")}<p data-stars-form-feedback role="status"></p><button type="submit" class="button button--primary">Сохранить подключение</button></fieldset></form>
 <form data-stars-form="check"><fieldset ${disabled}><h4>Проверка без списания</h4><p>Проверяет сессию, кошелёк и баланс. С @username дополнительно рассчитает платёж, без подписи и отправки.</p><div class="stars-fields"><label>@username для расчёта<input name="recipient" placeholder="@username" autocomplete="off"></label><label>Stars<input name="quantity" type="number" min="50" max="${c.maxStars}" value="50"></label></div><p data-stars-form-feedback role="status"></p><button type="submit" class="button button--ghost">Проверить без списания</button></fieldset></form>
 ${starsUi.report ? `<div class="stars-report" role="status">${escapeHtml(starsUi.report)}</div>` : ""}</section>
 <section class="plugin-page-panel"><div class="stars-section-head"><div><span>ПРАВИЛА РАБОТЫ</span><h3>Приём заказов и расходы</h3></div><span class="stars-pill">${c.automatic ? "Приём включён" : "Приём остановлен"}</span></div><p class="stars-note">Сервер: обработка ${s.workerEnabled ? "включена" : "выключена"} · платежи ${s.purchaseEnabled ? "разрешены" : "выключены"} · сообщения ${s.deliveryEnabled ? "разрешены" : "выключены"} · лоты ${s.lotsEnabled ? "разрешены" : "выключены"}.</p>
 <form data-stars-form="settings"><fieldset ${disabled}><div class="stars-checks">${check("automatic", "Принимать новые оплаченные заказы и оплачивать Stars")}${check("fastMode", "Fast Mode: не спрашивать повторное подтверждение получателя")}${check("showSender", "Показывать отправителя получателю")}${check("notifyOwner", "Уведомлять продавца в Telegram")}${check("autoRefund", "Разрешить возврат по команде покупателя до подписи платежа")}</div>
 <div class="stars-fields"><label>Оплата<select name="currency"><option ${c.currency === "TON" ? "selected" : ""}>TON</option><option ${c.currency === "USDT" ? "selected" : ""}>USDT</option></select></label>${field("maxSpend", "Лимит одного платежа · выбранная валюта")}${field("dailyLimit", "Дневной лимит · выбранная валюта")}${field("gasReserve", "Резерв TON на комиссию")}${field("maxStars", "Максимум Stars в заказе", "number")}${field("rateRub", "Курс выбранной валюты к RUB · 0 — не считать")}${field("feePercent", "Комиссия FunPay, %", "number")}</div>
 <p class="stars-note">Дневной лимит считается по UTC, отдельно для TON и USDT, включая неопределённые списания. Курс фиксируется для заказа. Расчётная разница: ${starsMoney(s.analytics.profitMinor)}; сетевая комиссия учитывается отдельно.</p>
 <label>Чёрный список покупателей · числовые ID<textarea name="buyerBlacklist" rows="2">${escapeHtml(c.buyerBlacklist.join(", "))}</textarea></label>
 <details><summary>Привязанные лоты и личные номиналы</summary><div class="stars-checks">${check("manageLots", "Разрешить изменение состояния привязанных лотов")}${check("autoPause", "Скрывать при низком балансе и возвращать скрытые плагином")}${check("personalLots", "Разрешить покупателю !stars_lot КОЛИЧЕСТВО")}</div><div class="stars-fields">${field("lowTon", "Низкий баланс: TON")}${field("lowUsdt", "Низкий баланс: USDT")}${field("pricePerStarRub", "Цена за одну Stars, ₽", "number")}${field("personalLotMinutes", "Время жизни личного лота, минут", "number")}<label>ID своего лота-шаблона<input name="templateLotId" inputmode="numeric" value="${escapeHtml(c.templateLotId)}" placeholder="Раздел Telegram Stars · 2418"></label></div><p>Для личных предложений нужен ваш обычный лот Telegram Stars. Название и цена меняются; категория, изображения и параметры наследуются из шаблона. Покупатель закрепляется за предложением. Перед выключением плагина закройте временные предложения.</p></details>
 <details><summary>Сообщения покупателю</summary><p>{order_id} · {quantity} · {recipient} · {name} · {token} · {receipt}</p>${[
   ["askTemplate", "Запрос @username"],
   ["confirmTemplate", "Подтверждение · {token} и {recipient} обязательны"],
   ["receiptTemplate", "Чек · {receipt} обязателен"],
   ["errorTemplate", "Нужна проверка продавцом"],
   ["paidMessagesTemplate", "Ограничение платных сообщений"],
 ]
   .map(
     ([k, label]) =>
       `<label>${label}<textarea name="${k}" maxlength="700" rows="3">${escapeHtml(c[k])}</textarea></label>`,
   )
   .join("")}</details>
 <p data-stars-form-feedback role="status"></p><button type="submit" class="button button--primary">Сохранить правила</button></fieldset></form></section>
 <section class="plugin-page-panel"><div class="stars-section-head"><div><span>АССОРТИМЕНТ</span><h3>Лот → количество Stars</h3></div><span>${s.mappings.length} привязок</span></div><p>Число задаётся явно; текст названия не используется для случайного определения номинала. Заказ нескольких единиц умножает номинал.</p><form data-stars-form="mapping"><fieldset ${disabled}><div class="stars-fields"><label>ID вашего лота<input name="lotId" pattern="[1-9][0-9]{0,19}" required></label><label>Stars за одну единицу<input name="quantity" type="number" min="50" max="100000" required value="100"></label></div><p data-stars-form-feedback role="status"></p><button type="submit" class="button button--primary">Проверить лот и привязать</button></fieldset></form>
 <div class="stars-list">${s.mappings.map((m) => `<article><div><strong>${escapeHtml(m.title)}</strong><small>#${m.lotId} · ${m.quantity} Stars за единицу</small></div><button type="button" data-stars-remove="${m.lotId}" class="button button--ghost" ${disabled}>Убрать привязку</button></article>`).join("") || "<p>Привязок пока нет.</p>"}</div><div class="stars-actions"><button type="button" data-stars-lots="off" class="button button--ghost" ${disabled}>Выключить привязанные лоты</button><button type="button" data-stars-lots="on" class="button button--ghost" ${disabled}>Включить привязанные лоты</button><button type="button" data-stars-stop class="button button--ghost" ${disabled}>Остановить очередь лотов</button></div>
 ${s.lotQueue ? `<p>Обработано ${s.lotQueue.index}/${s.lotQueue.total}${s.lotQueue.stop ? " · остановлено" : ""}</p>` : ""}${s.lotOperation ? `<p role="alert">Лот #${escapeHtml(s.lotOperation.lotId)}: ${escapeHtml(s.lotOperation.status)}. Автоматические изменения приостановлены.</p><button type="button" data-stars-review="${escapeHtml(s.lotOperation.lotId)}" class="button button--ghost">Прочитать состояние и снять паузу</button>` : ""}
 ${s.hidden.length ? `<p>Скрыты плагином: ${s.hidden.length}. Ручные изменения исключают автоматическое восстановление.</p>` : ""}
 <details><summary>Личные предложения · ${s.personal.length}</summary>${s.personal.map((p) => `<p>${p.quantity} Stars · ${escapeHtml(p.status)} ${p.lotId ? `· #${p.lotId}` : ""} ${p.code ? "· " + escapeHtml(p.code) : ""}${!["closed", "expired"].includes(p.status) ? ` <button type="button" class="button button--ghost" data-stars-personal="${escapeHtml(p.id)}">Закрыть предложение</button>` : ""}</p>`).join("") || "<p>Покупатель создаёт номинал командой !stars_lot 150.</p>"}</details></section>
 <section class="plugin-page-panel"><div class="stars-section-head"><div><span>ПОСТОЯННАЯ ОЧЕРЕДЬ</span><h3>Заказы и подтверждения</h3></div><button type="button" data-stars-export class="button button--ghost">Экспорт журнала</button></div><p>После перезапуска очередь сохраняется. Неизвестный платёж блокирует следующий расход; «Проверить платёж» только читает сеть.</p><div class="stars-tasks">${
   s.tasks
     .filter((t) => !["ignored", "unmatched"].includes(t.status))
     .map(
       (t) =>
         `<article><header><strong>#${escapeHtml(t.orderId)} · ${t.quantity || "—"} Stars</strong><span class="stars-pill ${t.status.includes("unknown") ? "is-warning" : ""}">${escapeHtml(starsLabels[t.status] || t.status)}</span></header><p>${t.recipient ? "@" + escapeHtml(t.recipient) + " · " : ""}${t.costUnits ? escapeHtml(starsCoin(t.costUnits, t.paymentCurrency)) : ""}${t.code ? " · " + escapeHtml(t.code) : ""}</p>${t.receipt ? `<a href="${escapeHtml(t.receipt)}" target="_blank" rel="noopener noreferrer">Чек TON ↗</a>` : ""}<div class="stars-actions">${["confirming", "payment_unknown", "payment_confirmed"].includes(t.status) ? `<button type="button" data-stars-task="${escapeHtml(t.orderId)}" data-action="reconcile" class="button button--ghost" ${disabled}>Проверить платёж</button>` : ""}${["payment_confirmed", "delivery_unknown"].includes(t.status) ? `<button type="button" data-stars-task="${escapeHtml(t.orderId)}" data-action="redeliver" class="button button--ghost" ${disabled}>Повторно отправить чек</button>` : ""}${t.status === "manual" ? `<button type="button" data-stars-task="${escapeHtml(t.orderId)}" data-action="retry" class="button button--ghost" ${disabled}>Вернуть к вводу получателя</button>` : ""}${["discovering", "awaiting_recipient", "awaiting_confirmation", "queued", "manual"].includes(t.status) ? `<button type="button" data-stars-task="${escapeHtml(t.orderId)}" data-action="cancel" class="button button--ghost" ${disabled}>Отменить обработку</button>` : ""}</div></article>`,
     )
     .join("") ||
   "<p>Новые заказы появятся после фонового чтения. Существующие заказы при запуске пропускаются.</p>"
 }</div></section>
 <section class="plugin-page-panel"><div class="stars-section-head"><div><span>АНАЛИТИКА</span><h3>Дни и номиналы</h3></div><span>Подтверждённые заказы</span></div>
 <div class="stars-fields"><div><h4>Последние 14 дней с продажами · UTC</h4>${
   (s.analytics.days || [])
     .sort((a, b) => b.day.localeCompare(a.day))
     .slice(0, 14)
     .map(
       (d) =>
         `<p><strong>${escapeHtml(d.day)}</strong> · ${d.orders} заказов · ${d.stars} Stars<br>Выручка ${starsMoney(d.revenueMinor)} · расчётная разница ${starsMoney(d.profitMinor)}</p>`,
     )
     .join("") || "<p>Отчёт появится после оплаты и отправки чека.</p>"
 }</div><div><h4>Популярные номиналы</h4>${
   (s.analytics.denominations || [])
     .slice(0, 10)
     .map(
       (d) =>
         `<p><strong>${d.quantity} Stars</strong> · ${d.orders} заказов · ${starsMoney(d.revenueMinor)}</p>`,
     )
     .join("") || "<p>Данных пока нет.</p>"
 }</div></div><p class="stars-note">Расчётная разница учитывает указанную комиссию FunPay. Сетевые расходы хранятся по каждому платежу в экспортируемом журнале.</p></section>
 <aside class="stars-note">Управление в Telegram: <code>/stars</code>. Покупатель: <code>!stars НОМЕР_ЗАКАЗА @username</code>, подтверждение: <code>!stars_yes НОМЕР_ЗАКАЗА КОД</code>. Чек подтверждает платёж в сети, а не отдельное уведомление о зачислении Stars.</aside></section>`;
}
async function loadStarsStatus() {
  if (!authState.token || starsUi.busy || starsUi.loading) return;
  if (
    starsUi.session !== authState.token ||
    starsUi.generation !== sessionGeneration
  )
    resetStarsUi();
  const token = authState.token,
    generation = sessionGeneration,
    revision = starsUi.revision;
  starsUi.loading = true;
  try {
    const s = await apiRequest("/api/v1/plugins/stars-relay/status", {
      authenticated: true,
    });
    if (starsCurrent(token, generation) && revision === starsUi.revision) {
      starsUi.status = s;
      starsUi.error = "";
    }
  } catch (e) {
    if (starsCurrent(token, generation) && revision === starsUi.revision)
      starsUi.error = humanError(e);
  } finally {
    if (starsCurrent(token, generation) && revision === starsUi.revision) {
      starsUi.loading = false;
      renderPluginPage();
    }
  }
}
async function starsAction(path, body, form = null) {
  if (starsUi.busy) return;
  const token = authState.token,
    generation = sessionGeneration;
  starsUi.busy = true;
  starsUi.revision++;
  const fieldset = form?.querySelector("fieldset"),
    feedback =
      form?.querySelector("[data-stars-form-feedback]") ||
      document.querySelector("[data-stars-feedback]");
  if (fieldset) fieldset.disabled = true;
  if (feedback) feedback.textContent = "Выполняем…";
  let accepted = false,
    complete = false;
  try {
    const r = await apiRequest("/api/v1/plugins/stars-relay/" + path, {
      method: "POST",
      authenticated: true,
      body,
    });
    if (!starsCurrent(token, generation)) return;
    accepted = true;
    for (const name of [
      "mnemonic",
      "fragmentCookie",
      "fragmentHash",
      "tonApiKey",
      "proxyUrl",
    ]) {
      const input = form?.querySelector('[name="' + name + '"]');
      if (input) input.value = "";
    }
    if (path === "check")
      starsUi.report = r.recipient
        ? "Получатель @" +
          r.recipient.username +
          " · стоимость " +
          starsCoin(r.costUnits, r.currency) +
          ". Подпись и отправка не выполнялись."
        : "Сессия и кошелёк проверены. Списание не выполнялось.";
    const s = await apiRequest("/api/v1/plugins/stars-relay/status", {
      authenticated: true,
    });
    if (!starsCurrent(token, generation)) return;
    starsUi.status = s;
    starsUi.error = "Действие подтверждено. Состояние обновлено.";
    complete = true;
  } catch (e) {
    if (starsCurrent(token, generation)) {
      starsUi.error = accepted
        ? "Действие принято, но обновить состояние не удалось. Обновите страницу перед повтором."
        : humanError(e);
      if (feedback) {
        feedback.textContent = starsUi.error;
        feedback.setAttribute("role", "alert");
      }
    }
  } finally {
    if (starsCurrent(token, generation)) {
      starsUi.busy = false;
      if (fieldset) fieldset.disabled = false;
      if (complete) renderPluginPage();
    }
  }
}
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!form.matches("[data-stars-form]")) return;
  event.preventDefault();
  if (starsUi.busy) return;
  const f = new FormData(form),
    kind = form.dataset.starsForm;
  try {
    if (kind === "connection") {
      const body = {
        config: {
          ...starsUi.status.config,
          walletVersion: String(f.get("walletVersion")),
        },
        clearProxy: f.has("clearProxy"),
      };
      for (const k of [
        "mnemonic",
        "walletAddress",
        "fragmentCookie",
        "fragmentHash",
        "tonApiKey",
        "proxyUrl",
      ])
        if (String(f.get(k) || "").trim()) body[k] = String(f.get(k)).trim();
      return starsAction("settings", body, form);
    }
    if (kind === "settings") {
      const c = { ...starsUi.status.config };
      for (const k of [
        "automatic",
        "autoRefund",
        "fastMode",
        "notifyOwner",
        "showSender",
        "manageLots",
        "autoPause",
        "personalLots",
      ])
        c[k] = f.has(k);
      for (const k of [
        "currency",
        "maxSpend",
        "dailyLimit",
        "gasReserve",
        "lowTon",
        "lowUsdt",
        "rateRub",
        "templateLotId",
        "askTemplate",
        "confirmTemplate",
        "receiptTemplate",
        "errorTemplate",
        "paidMessagesTemplate",
      ])
        c[k] = String(f.get(k) || "").trim();
      for (const k of ["maxStars", "personalLotMinutes", "feePercent"])
        c[k] = Number(f.get(k));
      const price = String(f.get("pricePerStarRub"));
      if (!/^\d+(?:\.\d{1,2})?$/.test(price))
        throw Error("Укажите цену с точностью до копеек");
      c.pricePerStarMinor = Math.round(Number(price) * 100);
      c.buyerBlacklist = String(f.get("buyerBlacklist") || "")
        .split(/[\s,;]+/)
        .filter(Boolean);
      return starsAction("settings", { config: c }, form);
    }
    if (kind === "mapping")
      return starsAction(
        "mapping",
        {
          lotId: String(f.get("lotId")).trim(),
          quantity: Number(f.get("quantity")),
        },
        form,
      );
    if (kind === "check") {
      const recipient = String(f.get("recipient") || "").trim();
      return starsAction(
        "check",
        recipient ? { recipient, quantity: Number(f.get("quantity")) } : {},
        form,
      );
    }
  } catch (e) {
    const feedback = form.querySelector("[data-stars-form-feedback]");
    if (feedback) feedback.textContent = e.message;
  }
});
document.addEventListener("click", (event) => {
  const el = event.target.closest(
    "[data-stars-refresh],[data-stars-remove],[data-stars-task],[data-stars-lots],[data-stars-stop],[data-stars-review],[data-stars-personal],[data-stars-export]",
  );
  if (!el || starsUi.busy) return;
  if (el.hasAttribute("data-stars-refresh")) return loadStarsStatus();
  if (el.hasAttribute("data-stars-remove")) {
    if (window.confirm("Убрать привязку? Сам лот останется на FunPay."))
      return starsAction("mapping-remove", { lotId: el.dataset.starsRemove });
  }
  if (el.hasAttribute("data-stars-task")) {
    const action = el.dataset.action;
    if (
      action === "reconcile" ||
      window.confirm(
        action === "redeliver"
          ? "Отправить чек ещё раз? Новый платёж не создаётся."
          : "Подтвердить действие с заказом?",
      )
    )
      return starsAction("task", {
        orderId: el.dataset.starsTask,
        action,
        confirm: true,
      });
  }
  if (
    el.hasAttribute("data-stars-lots") &&
    window.confirm("Изменить состояние всех привязанных лотов?")
  )
    return starsAction("lots", {
      active: el.dataset.starsLots === "on",
      confirm: true,
    });
  if (el.hasAttribute("data-stars-stop")) return starsAction("lots-stop", {});
  if (
    el.hasAttribute("data-stars-review") &&
    window.confirm(
      "Прочитать фактическое состояние лота и снять паузу? Автоматическое восстановление этого лота будет отменено.",
    )
  )
    return starsAction("lot-review", {
      lotId: el.dataset.starsReview,
      confirm: true,
    });
  if (
    el.hasAttribute("data-stars-personal") &&
    window.confirm(
      "Закрыть личное предложение? Завершённый платёж не отменяется.",
    )
  )
    return starsAction("personal-close", {
      id: el.dataset.starsPersonal,
      confirm: true,
    });
  if (
    el.hasAttribute("data-stars-export") &&
    starsUi.status &&
    starsUi.session === authState.token &&
    starsUi.generation === sessionGeneration
  ) {
    const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify(
              {
                exportedAt: new Date().toISOString(),
                tasks: starsUi.status.tasks,
                analytics: starsUi.status.analytics,
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        ),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = "stars-relay-journal.json";
    a.click();
    URL.revokeObjectURL(url);
  }
});
