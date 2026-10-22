// ============================================
// Копійка — особистий фінансовий трекер
// Чистий JavaScript без бібліотек і без збірки.
// ============================================

// ===== 1. Константи =====

// Ключ, під яким усі дані лежать у localStorage
const STORAGE_KEY = "kopiyka-data";

// Версія структури даних: 1 — v0.1, 2 — з валютою й курсом у кожному записі
const DATA_VERSION = 2;
const APP_VERSION = "1.0";

// Найбільша сума, яку приймаємо: 999 999 999,99 (у копійках)
const MAX_AMOUNT = 99999999999;

// Валюти, з якими працює застосунок
const CURRENCIES = {
  UAH: { symbol: "₴", name: "Гривня" },
  USD: { symbol: "$", name: "Долар" },
  EUR: { symbol: "€", name: "Євро" }
};

// Назви місяців: "Жовтень 2026" і "до жовтня 2026"
const MONTHS = ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень",
  "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"];
const MONTHS_GENITIVE = ["січня", "лютого", "березня", "квітня", "травня", "червня",
  "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

// Кольори категорій для діаграми
const CATEGORY_COLORS = {
  food: "#3DDC97",
  transport: "#5B9DFF",
  study: "#B07CFF",
  fun: "#FF8A5C",
  clothes: "#F5C451",
  health: "#FF5C8A",
  subs: "#4FD1E0",
  other: "#8A8F98"
};

// Дані за замовчуванням (коли нічого не збережено).
// Усі суми зберігаємо цілими числами в копійках/центах: 12000 = 120.00
function getDefaultData() {
  return {
    version: DATA_VERSION,
    transactions: [],
    categories: [
      { id: "food", name: "Їжа", icon: "🍔", limit: 0, limitCurrency: "UAH" },
      { id: "transport", name: "Транспорт", icon: "🚌", limit: 0, limitCurrency: "UAH" },
      { id: "study", name: "Навчання", icon: "📚", limit: 0, limitCurrency: "UAH" },
      { id: "fun", name: "Розваги", icon: "🎮", limit: 0, limitCurrency: "UAH" },
      { id: "clothes", name: "Одяг", icon: "👕", limit: 0, limitCurrency: "UAH" },
      { id: "health", name: "Здоров'я", icon: "💊", limit: 0, limitCurrency: "UAH" },
      { id: "subs", name: "Підписки", icon: "🔁", limit: 0, limitCurrency: "UAH" },
      { id: "other", name: "Інше", icon: "📦", limit: 0, limitCurrency: "UAH" }
    ],
    incomeCategories: [
      { id: "stipend", name: "Стипендія", icon: "🎓" },
      { id: "salary", name: "Зарплата", icon: "💼" },
      { id: "gift", name: "Подарунок", icon: "🎁" },
      { id: "income-other", name: "Інше", icon: "📦" }
    ],
    subscriptions: [],
    goals: [],
    settings: {
      currency: "UAH",
      monthStartDay: 1,
      rates: { USD: 41.5, EUR: 45 },
      onboarded: false,         // чи пройдено екран привітання
      startedAt: null,          // дата першого запуску
      lastBackup: null,         // дата останнього експорту
      backupRemindAfter: null   // "нагадати пізніше" — не показувати до цієї дати
    }
  };
}

// ===== 2. Дати =====
// Дати зберігаємо рядками "YYYY-MM-DD" за місцевим часом.

// Date → "2026-10-22"
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "2026-10-22" → Date
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function todayStr() {
  return toDateStr(new Date());
}

// Чи це справжня дата у форматі "YYYY-MM-DD" (31 лютого — ні)
function isValidDateStr(str) {
  if (typeof str !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  return toDateStr(parseDate(str)) === str;
}

function addDays(str, days) {
  const date = parseDate(str);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
}

// Скільки днів від дати a до дати b
function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

// Скільки днів у місяці (month від 0 до 11)
function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

// "22 жовт." (рік додаємо, тільки якщо він не поточний)
function formatDateShort(str) {
  const date = parseDate(str);
  const options = { day: "numeric", month: "short" };
  if (date.getFullYear() !== new Date().getFullYear()) options.year = "numeric";
  return date.toLocaleDateString("uk-UA", options);
}

// "22 жовтня 2026 р."
function formatDateLong(str) {
  return parseDate(str).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
}

// ===== 3. Гроші й валюта =====

// Скільки гривень коштує 1 одиниця валюти (гривня — база для перерахунку)
function uahPer(code, rates = data.settings.rates) {
  return code === "UAH" ? 1 : rates[code];
}

// Курс валюти до основної: USD→EUR = rates.USD / rates.EUR
function rateToMain(code) {
  return uahPer(code) / uahPer(data.settings.currency);
}

// Сума в будь-якій валюті → в основній за поточним курсом (для лімітів, підписок, цілей)
function convert(cents, currency) {
  if (!cents) return 0;
  if (!currency || currency === data.settings.currency) return Math.round(cents);
  return Math.round(cents * rateToMain(currency));
}

// Сума запису в основній валюті — за курсом, збереженим у записі.
// rate — курс до валюти rateBase (основної на момент створення).
// Якщо основну валюту потім змінили — докидаємо перерахунок rateBase → основна.
function toMain(t) {
  if (t.currency === data.settings.currency) return t.amount;
  return convert(t.amount * t.rate, t.rateBase);
}

// Перетворює копійки в гарний рядок: formatMoney(12000, "UAH") → "120 ₴", formatMoney(4550) → "45,50 ₴"
function formatMoney(cents, currency = data.settings.currency) {
  const digits = cents % 100 === 0 ? 0 : 2; // ",00" не показуємо
  try {
    return new Intl.NumberFormat("uk-UA", {
      style: "currency",
      currency: currency,
      currencyDisplay: "narrowSymbol", // ₴ $ € замість "грн", "USD", "EUR"
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(cents / 100);
  } catch (error) {
    // Запасний варіант для дуже старих браузерів
    return (cents / 100).toFixed(digits).replace(".", ",") + " " + CURRENCIES[currency].symbol;
  }
}

// Розбирає те, що ввела людина: "120", "45,50", "0.01", "1 000" → копійки.
// Повертає null, якщо це не сума.
function parseAmount(text, allowNegative = false) {
  const clean = String(text).replace(/[\s ]/g, "").replace(",", ".").replace("−", "-");
  const match = clean.match(/^(-)?(\d{1,9})(?:\.(\d{0,2}))?$/);
  if (!match) return null;
  const [, minus, whole, fraction = ""] = match;
  if (minus && !allowNegative) return null;
  // Рахуємо без дробових чисел, щоб не було помилок округлення
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return minus ? -cents : cents;
}

// Копійки → текст для поля вводу: 4550 → "45,5"
function centsToInput(cents) {
  return (cents / 100).toFixed(2).replace(/\.?0+$/, "").replace(".", ",");
}

// Курс з поля вводу: "41,5" → 41.5 (або null, якщо щось не те)
function parseRate(text) {
  const value = Number(String(text).trim().replace(",", "."));
  return Number.isFinite(value) && value > 0 && value < 1000000 ? value : null;
}

// ===== 4. Дрібні помічники =====

// Унікальний id запису
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Захист від "поганого" тексту: користувацький текст завжди пропускаємо через esc()
function esc(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Українські відмінки після числа: 1 день, 2 дні, 5 днів
function plural(n, one, few, many) {
  const n100 = Math.abs(n) % 100;
  const n10 = n100 % 10;
  if (n100 > 10 && n100 < 20) return many;
  if (n10 === 1) return one;
  if (n10 >= 2 && n10 <= 4) return few;
  return many;
}

function $(id) {
  return document.getElementById(id);
}

// Значення поля форми за id
function val(id) {
  const input = $(id);
  return input ? input.value : "";
}

// ===== 5. Збереження і міграція =====

// Будь-яке значення → ціла невід'ємна кількість копійок
function toCents(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_AMOUNT) : 0;
}

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

// Приводить дані будь-якої старої версії (або з файлу імпорту) до поточної структури.
// Усе зайве відкидає, усе відсутнє заповнює значеннями за замовчуванням.
function migrate(raw) {
  const defaults = getDefaultData();
  const rawSettings = isObject(raw.settings) ? raw.settings : {};

  // --- Налаштування ---
  const settings = { ...defaults.settings };
  if (CURRENCIES[rawSettings.currency]) settings.currency = rawSettings.currency;

  const startDay = Math.round(Number(rawSettings.monthStartDay));
  if (startDay >= 1 && startDay <= 28) settings.monthStartDay = startDay;

  const rawRates = isObject(rawSettings.rates) ? rawSettings.rates : {};
  settings.rates = { ...defaults.settings.rates };
  for (const code of ["USD", "EUR"]) {
    const rate = Number(rawRates[code]);
    if (Number.isFinite(rate) && rate > 0) settings.rates[code] = rate;
  }

  for (const key of ["startedAt", "lastBackup", "backupRemindAfter"]) {
    settings[key] = isValidDateStr(rawSettings[key]) ? rawSettings[key] : null;
  }

  const main = settings.currency;
  const list = (value) => (Array.isArray(value) ? value.filter(isObject) : []);
  const makeId = (value) => (value !== undefined && value !== null && value !== "" ? String(value) : uid());
  const currencyOr = (code) => (CURRENCIES[code] ? code : main);

  // --- Записи ---
  // v1 → v2: якщо в записі немає валюти — це основна валюта з курсом 1
  const transactions = list(raw.transactions)
    .map((t) => {
      const hasCurrency = Boolean(CURRENCIES[t.currency]);
      const currency = hasCurrency ? t.currency : main;
      const rateBase = currencyOr(t.rateBase);
      let rate = Number(t.rate);
      if (!hasCurrency || currency === rateBase) rate = 1;
      else if (!Number.isFinite(rate) || rate <= 0) {
        rate = uahPer(currency, settings.rates) / uahPer(rateBase, settings.rates);
      }
      return {
        id: makeId(t.id),
        type: t.type === "income" ? "income" : "expense",
        amount: toCents(t.amount),
        category: typeof t.category === "string" && t.category ? t.category : "other",
        date: isValidDateStr(t.date) ? t.date : todayStr(),
        note: cleanText(t.note, 100),
        currency,
        rate,
        rateBase
      };
    })
    .filter((t) => t.amount > 0);

  // --- Категорії: беремо стандартні, з файлу — тільки ліміти ---
  const rawCategories = list(raw.categories);
  const categories = defaults.categories.map((cat) => {
    const found = rawCategories.find((c) => c.id === cat.id);
    return {
      ...cat,
      limit: found ? toCents(found.limit) : 0,
      limitCurrency: currencyOr(found && found.limitCurrency)
    };
  });

  // --- Підписки ---
  const subscriptions = list(raw.subscriptions)
    .map((s) => {
      const nextDate = isValidDateStr(s.nextDate) ? s.nextDate : todayStr();
      const day = Math.round(Number(s.day));
      return {
        id: makeId(s.id),
        name: cleanText(s.name, 40) || "Підписка",
        amount: toCents(s.amount),
        currency: currencyOr(s.currency),
        period: s.period === "year" ? "year" : "month",
        nextDate,
        // "рідне" число списання: щоб після лютого підписка 31-го повернулась на 31-ше
        day: day >= 1 && day <= 31 ? day : parseDate(nextDate).getDate()
      };
    })
    .filter((s) => s.amount > 0);

  // --- Цілі ---
  const goals = list(raw.goals)
    .map((g) => ({
      id: makeId(g.id),
      name: cleanText(g.name, 40) || "Ціль",
      target: toCents(g.target),
      saved: toCents(g.saved),
      currency: currencyOr(g.currency),
      deadline: isValidDateStr(g.deadline) ? g.deadline : ""
    }))
    .filter((g) => g.target > 0);

  // Якщо дані вже є — привітання не показуємо
  settings.onboarded = rawSettings.onboarded === true ||
    transactions.length > 0 || subscriptions.length > 0 || goals.length > 0;
  if (settings.onboarded && !settings.startedAt) {
    const dates = transactions.map((t) => t.date).sort();
    settings.startedAt = dates[0] || todayStr();
  }

  return {
    version: DATA_VERSION,
    transactions,
    categories,
    incomeCategories: defaults.incomeCategories,
    subscriptions,
    goals,
    settings
  };
}

// Читаємо дані з localStorage. Якщо там пусто або битий JSON — беремо дані за замовчуванням.
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();
    const parsed = JSON.parse(raw);
    if (!isObject(parsed) || !Array.isArray(parsed.transactions)) return getDefaultData();
    return migrate(parsed);
  } catch (error) {
    console.warn("Не вдалося прочитати дані, беру стандартні:", error);
    return getDefaultData();
  }
}

// Записуємо поточні дані в localStorage
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Не вдалося зберегти дані:", error);
    toast("Не вдалося зберегти дані на пристрої", true);
  }
}

// Усі дані застосунку живуть у цій змінній
let data = load();

// ===== 6. Розрахунки =====

// Категорія за id (якщо такої немає — "Інше")
function findCategory(type, id) {
  const list = type === "income" ? data.incomeCategories : data.categories;
  return list.find((c) => c.id === id) || { id, name: "Інше", icon: "📦", limit: 0 };
}

// До якої категорії бюджету відноситься витрата (невідома категорія → "Інше")
function expenseCategoryId(t) {
  return data.categories.some((c) => c.id === t.category) ? t.category : "other";
}

// Записи найновіші зверху (при однаковій даті — той, що доданий пізніше)
function sortedTransactions(list) {
  return list
    .map((t, index) => ({ t, index }))
    .sort((a, b) => b.t.date.localeCompare(a.t.date) || b.index - a.index)
    .map((item) => item.t);
}

// "Місяць" з урахуванням дня початку місяця.
// offset = 0 — поточний, -1 — попередній і т.д. end — перший день наступного періоду (не входить).
function getPeriod(offset = 0) {
  const startDay = data.settings.monthStartDay;
  const now = new Date();
  let month = now.getMonth() + offset;
  if (now.getDate() < startDay) month -= 1; // ще не настав новий "місяць"
  const start = new Date(now.getFullYear(), month, startDay);
  const end = new Date(now.getFullYear(), month + 1, startDay);
  return {
    start: toDateStr(start),
    end: toDateStr(end),
    year: start.getFullYear(),
    month: start.getMonth()
  };
}

function periodTitle(period) {
  return `${MONTHS[period.month]} ${period.year}`;
}

// Якщо місяць починається не 1-го — показуємо точні дати: "25 жовт. – 24 лист."
function periodRangeHtml(period) {
  if (data.settings.monthStartDay === 1) return "";
  return `<span class="small muted">${formatDateShort(period.start)} – ${formatDateShort(addDays(period.end, -1))}</span>`;
}

// Підсумки за період: доходи, витрати, витрати по категоріях (усе в основній валюті)
function periodTotals(period) {
  const result = { income: 0, expense: 0, byCategory: {}, list: [] };
  for (const t of data.transactions) {
    if (t.date < period.start || t.date >= period.end) continue;
    const value = toMain(t);
    result.list.push(t);
    if (t.type === "income") {
      result.income += value;
    } else {
      result.expense += value;
      const catId = expenseCategoryId(t);
      result.byCategory[catId] = (result.byCategory[catId] || 0) + value;
    }
  }
  return result;
}

// Ліміт категорії в основній валюті
function limitOf(category) {
  return convert(category.limit, category.limitCurrency);
}

function totalLimit() {
  return data.categories.reduce((sum, c) => sum + limitOf(c), 0);
}

// Колір полоски: зелений до 80%, жовтий 80–100%, червоний понад 100%
function progressColor(percent) {
  if (percent > 100) return "var(--danger)";
  if (percent >= 80) return "var(--warn)";
  return "var(--accent)";
}

// Наступна дата списання: +1 місяць або +1 рік.
// Якщо в місяці немає такого числа (31 лютого) — беремо останній день місяця.
function addPeriod(dateStr, period, anchorDay) {
  const date = parseDate(dateStr);
  let year = date.getFullYear();
  let month = date.getMonth();
  if (period === "year") year += 1;
  else month += 1;
  if (month > 11) {
    month = 0;
    year += 1;
  }
  const day = Math.min(anchorDay, daysInMonth(year, month));
  return toDateStr(new Date(year, month, day));
}

// Якщо дата списання вже минула — зсуваємо її на наступний період
function rollSubscriptions() {
  const today = todayStr();
  let changed = false;
  for (const s of data.subscriptions) {
    let guard = 0;
    while (s.nextDate < today && guard < 1200) {
      s.nextDate = addPeriod(s.nextDate, s.period, s.day);
      guard += 1;
      changed = true;
    }
  }
  if (changed) save();
}

function nearestSubscription() {
  return [...data.subscriptions].sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0];
}

// "сьогодні", "завтра", "через 5 днів"
function dueText(days) {
  if (days <= 0) return "сьогодні";
  if (days === 1) return "завтра";
  return `через ${days} ${plural(days, "день", "дні", "днів")}`;
}

function subscriptionTotals() {
  let monthly = 0;
  let yearly = 0;
  for (const s of data.subscriptions) {
    const amount = convert(s.amount, s.currency);
    if (s.period === "year") {
      monthly += amount / 12;
      yearly += amount;
    } else {
      monthly += amount;
      yearly += amount * 12;
    }
  }
  return { monthly: Math.round(monthly), yearly: Math.round(yearly) };
}

// Чи показувати плашку "Давно не робив бекап"
function needsBackupReminder() {
  const s = data.settings;
  if (data.transactions.length === 0) return false;
  const today = todayStr();
  if (s.backupRemindAfter && today < s.backupRemindAfter) return false;
  const since = s.lastBackup || s.startedAt;
  return Boolean(since) && daysBetween(since, today) > 30;
}

// ===== 7. Шматочки HTML =====

function emptyState(icon, title, hint) {
  return `<div class="empty">
    <div class="empty-icon" aria-hidden="true">${icon}</div>
    <p class="empty-title">${title}</p>
    <p class="muted">${hint}</p>
  </div>`;
}

// Полоска прогресу. key потрібен, щоб при перемальовуванні ширина змінювалась плавно.
function progressBar(key, percent, color, label) {
  const width = Math.max(0, Math.min(percent, 100)).toFixed(1);
  return `<span class="progress" role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(percent, 100))}">
    <span class="progress-fill" data-key="${esc(key)}" data-w="${width}" style="background:${color}"></span>
  </span>`;
}

// Перемикач з кількох кнопок. options — масив [значення, підпис, (необов'язково) назва для скрінрідера]
function segmented(action, options, selected, label, extraClass = "") {
  const buttons = options.map(([value, text, ariaLabel]) => {
    const on = value === selected;
    const aria = ariaLabel ? ` aria-label="${ariaLabel}"` : "";
    return `<button type="button" class="seg${on ? " active" : ""}" data-action="${action}" data-value="${value}" aria-pressed="${on}"${aria}>${text}</button>`;
  }).join("");
  return `<div class="segmented ${extraClass}" role="group" aria-label="${label}">${buttons}</div>`;
}

// Маленький перемикач ₴ $ € біля поля суми (працює з form.currency)
function currencySwitch() {
  const options = Object.entries(CURRENCIES).map(([code, c]) => [code, c.symbol, c.name]);
  return segmented("form-currency", options, form.currency, "Валюта", "compact");
}

// Сума у своїй валюті + "(≈ у основній)", якщо валюта не основна
function moneyWithApprox(cents, currency, mainCents) {
  let html = `<span>${formatMoney(cents, currency)}</span>`;
  if (currency !== data.settings.currency) {
    html += `<span class="tx-approx">(≈ ${formatMoney(mainCents)})</span>`;
  }
  return html;
}

// Сума запису: "−120 ₴" або "−10 $ (≈ 415 ₴)"
function txAmountHtml(t) {
  const sign = t.type === "expense" ? "−" : "+";
  const cls = t.type === "expense" ? "neg" : "pos";
  let html = `<span class="tx-amount ${cls}"><span>${sign}${formatMoney(t.amount, t.currency)}</span>`;
  if (t.currency !== data.settings.currency) {
    html += `<span class="tx-approx">(≈ ${formatMoney(toMain(t))})</span>`;
  }
  return html + "</span>";
}

function txRowHtml(t) {
  const cat = findCategory(t.type, t.category);
  const sub = [formatDateShort(t.date), t.note].filter(Boolean).map(esc).join(" · ");
  return `<li><button class="tx" type="button" data-action="edit-tx" data-id="${esc(t.id)}">
    <span class="tx-icon" aria-hidden="true">${cat.icon}</span>
    <span class="tx-main"><span class="tx-title">${esc(cat.name)}</span><span class="tx-sub">${sub}</span></span>
    ${txAmountHtml(t)}
  </button></li>`;
}

// Вставляє HTML в екран і плавно анімує полоски від старої ширини до нової
function renderInto(element, html) {
  const oldWidths = {};
  element.querySelectorAll(".progress-fill[data-key]").forEach((bar) => {
    oldWidths[bar.dataset.key] = bar.style.width;
  });
  element.innerHTML = html;
  const bars = element.querySelectorAll(".progress-fill[data-key]");
  bars.forEach((bar) => {
    bar.style.width = oldWidths[bar.dataset.key] || "0%";
  });
  // Два кадри поспіль — щоб браузер "побачив" стару ширину перед зміною
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bars.forEach((bar) => {
      bar.style.width = bar.dataset.w + "%";
    });
  }));
}

// ===== 8. Екрани =====

function renderHome() {
  const period = getPeriod(0);
  const totals = periodTotals(period);
  const left = totals.income - totals.expense;
  const budget = totalLimit();

  let html = `<div class="card">
    <div class="hero-head"><h2 class="hero-month">${periodTitle(period)}</h2>${periodRangeHtml(period)}</div>
    <div class="muted">Лишилось</div>
    <div class="hero-amount${left < 0 ? " neg" : ""}">${formatMoney(left)}</div>
    <div class="hero-row">
      <span class="pos">+${formatMoney(totals.income)}</span>
      <span class="neg">−${formatMoney(totals.expense)}</span>
    </div>`;
  if (budget > 0) {
    const percent = (totals.expense / budget) * 100;
    html += `<div class="hero-budget">
      ${progressBar("home-budget", percent, progressColor(percent), "Витрачено з бюджету")}
      <div class="small muted">Витрачено ${Math.round(percent)}% бюджету: ${formatMoney(totals.expense)} з ${formatMoney(budget)}</div>
    </div>`;
  }
  html += "</div>";

  if (needsBackupReminder()) {
    html += `<div class="banner banner-warn">
      <span class="banner-text">💾 Давно не робив бекап</span>
      <button class="btn btn-primary" type="button" data-action="export">Експорт</button>
      <button class="icon-btn" type="button" data-action="snooze-backup" aria-label="Нагадати пізніше">✕</button>
    </div>`;
  }

  const next = nearestSubscription();
  if (next) {
    html += `<button class="banner" type="button" data-screen="subscriptions">
      <span class="banner-text">🔔 ${esc(next.name)} · ${formatDateShort(next.nextDate)} · ${formatMoney(next.amount, next.currency)}</span>
    </button>`;
  }

  html += `<div class="section-head"><h3>Останні записи</h3></div>`;
  const recent = sortedTransactions(data.transactions).slice(0, 10);
  if (recent.length) {
    html += `<ul class="card tx-list">${recent.map(txRowHtml).join("")}</ul>`;
  } else {
    html += `<div class="card">${emptyState("🧾", "Ще немає записів", "Натисни ＋ внизу, щоб додати першу витрату чи дохід")}</div>`;
  }
  html += `<button class="btn btn-secondary" type="button" data-screen="stats">Статистика →</button>`;

  renderInto($("screen-home"), html);
}

function renderBudget() {
  const period = getPeriod(0);
  const totals = periodTotals(period);
  const limit = totalLimit();

  let html = `<div class="screen-head"><h2>Бюджет</h2><p class="muted">${periodTitle(period)}</p></div>`;
  if (limit === 0) {
    html += `<p class="hint muted">🎯 Ліміти ще не встановлені — тапни на категорію, щоб задати суму на місяць</p>`;
  }

  html += `<ul class="cat-list">`;
  for (const c of data.categories) {
    const spent = totals.byCategory[c.id] || 0;
    let detail;
    let bar = "";
    const limit = limitOf(c);
    if (limit > 0) {
      const percent = (spent / limit) * 100;
      detail = `<span class="${percent > 100 ? "neg" : ""}">${formatMoney(spent)}</span> / ${formatMoney(limit)}`;
      bar = progressBar("cat-" + c.id, percent, progressColor(percent), `${c.name}: витрачено з ліміту`);
    } else {
      detail = `${formatMoney(spent)} <span class="muted">· без ліміту</span>`;
    }
    html += `<li><button class="card cat-row" type="button" data-action="open-category" data-id="${c.id}">
      <span class="cat-row-top">
        <span class="tx-icon" aria-hidden="true">${c.icon}</span>
        <span class="cat-row-name">${esc(c.name)}</span>
        <span class="cat-row-sum">${detail}</span>
      </span>
      ${bar}
    </button></li>`;
  }
  html += `</ul>`;

  html += `<div class="card total">Разом витрачено <b>${formatMoney(totals.expense)}</b>`;
  if (limit > 0) html += ` з <b>${formatMoney(limit)}</b>`;
  html += `</div>`;

  renderInto($("screen-budget"), html);
}

function renderSubscriptions() {
  rollSubscriptions();
  const subs = [...data.subscriptions].sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const today = todayStr();

  let html = `<div class="screen-head"><h2>Підписки</h2></div>`;
  if (!subs.length) {
    html += `<div class="card">${emptyState("🔁", "Підписок поки немає", "Додай Spotify, Netflix чи мобільний зв'язок — і Копійка підкаже, коли буде списання")}</div>`;
  } else {
    html += `<ul class="card tx-list">`;
    for (const s of subs) {
      const days = daysBetween(today, s.nextDate);
      html += `<li><button class="tx" type="button" data-action="edit-sub" data-id="${esc(s.id)}">
        <span class="tx-icon" aria-hidden="true">🔁</span>
        <span class="tx-main">
          <span class="tx-title">${esc(s.name)}</span>
          <span class="tx-sub">${s.period === "year" ? "щороку" : "щомісяця"} · ${formatDateShort(s.nextDate)}</span>
        </span>
        <span class="tx-amount">
          ${moneyWithApprox(s.amount, s.currency, convert(s.amount, s.currency))}
          <span class="due${days <= 3 ? " soon" : ""}">${dueText(days)}</span>
        </span>
      </button></li>`;
    }
    html += `</ul>`;
    const totals = subscriptionTotals();
    html += `<div class="card total">Разом <b>${formatMoney(totals.monthly)}</b>/міс · <b>${formatMoney(totals.yearly)}</b>/рік</div>`;
  }
  html += `<button class="btn btn-primary" type="button" data-action="new-sub">＋ Підписка</button>`;

  renderInto($("screen-subscriptions"), html);
}

// Підказка для цілі з дедлайном
function goalHint(goal) {
  if (!goal.deadline || goal.saved >= goal.target) return "";
  const today = todayStr();
  if (goal.deadline < today) {
    return `<p class="goal-hint neg">⏰ Термін минув ${formatDateShort(goal.deadline)}</p>`;
  }
  const now = parseDate(today);
  const end = parseDate(goal.deadline);
  const months = Math.max(1, (end.getFullYear() - now.getFullYear()) * 12 + end.getMonth() - now.getMonth());
  // Округлюємо вгору до цілих гривень/доларів
  const perMonth = Math.ceil((goal.target - goal.saved) / months / 100) * 100;
  return `<p class="goal-hint muted">Відкладай ${formatMoney(perMonth, goal.currency)}/міс, щоб встигнути до ${MONTHS_GENITIVE[end.getMonth()]} ${end.getFullYear()}</p>`;
}

function renderGoals() {
  let html = `<div class="screen-head"><h2>Цілі</h2></div>`;
  if (!data.goals.length) {
    html += `<div class="card">${emptyState("🎯", "Ще немає цілей", "Постав ціль — наприклад, новий телефон чи подорож — і відкладай потроху")}</div>`;
  }
  for (const g of data.goals) {
    const percent = g.target > 0 ? (g.saved / g.target) * 100 : 0;
    const done = g.saved >= g.target;
    html += `<div class="card goal">
      <div class="goal-head">
        <h3>${esc(g.name)}</h3>
        <button class="icon-btn" type="button" data-action="edit-goal" data-id="${esc(g.id)}" aria-label="Редагувати ціль ${esc(g.name)}">✏️</button>
      </div>
      ${progressBar("goal-" + g.id, percent, "var(--accent)", `Прогрес цілі ${g.name}`)}
      <div class="goal-nums"><span>${formatMoney(g.saved, g.currency)} / ${formatMoney(g.target, g.currency)}</span><b>${Math.floor(percent)}%</b></div>
      ${g.currency !== data.settings.currency
        ? `<div class="small muted">≈ ${formatMoney(convert(g.saved, g.currency))} / ${formatMoney(convert(g.target, g.currency))}</div>`
        : ""}
      ${done ? `<div class="goal-done">🎉 Ціль досягнута!</div>` : goalHint(g)}
      <button class="btn btn-secondary" type="button" data-action="topup-goal" data-id="${esc(g.id)}">Поповнити</button>
    </div>`;
  }
  html += `<button class="btn btn-primary" type="button" data-action="new-goal">＋ Ціль</button>`;

  renderInto($("screen-goals"), html);
}

// Номер місяця у статистиці: 0 — поточний, -1 — минулий...
let statsOffset = 0;

// Кругова діаграма на SVG. Кожен шматок — коло з пунктирною обводкою.
// Довжина кола = 100, тож довжина штриха = відсоток.
function donutHtml(entries, total) {
  const R = 15.91549430918954; // радіус, при якому довжина кола = 100
  let done = 0;
  const slices = entries.map(([id, value]) => {
    const percent = (value / total) * 100;
    const color = CATEGORY_COLORS[id] || "#8A8F98";
    // 25 — щоб почати з 12-ї години, а не з 3-ї
    const circle = `<circle cx="21" cy="21" r="${R}" fill="none" stroke="${color}" stroke-width="6"
      stroke-dasharray="${percent} ${100 - percent}" stroke-dashoffset="${25 - done}"></circle>`;
    done += percent;
    return circle;
  }).join("");

  return `<div class="donut">
    <svg viewBox="0 0 42 42" role="img" aria-label="Кругова діаграма витрат за категоріями">
      <circle cx="21" cy="21" r="${R}" fill="none" stroke="#23272F" stroke-width="6"></circle>
      ${slices}
    </svg>
    <div class="donut-center"><span class="small muted">Витрати</span><b>${formatMoney(total)}</b></div>
  </div>`;
}

function renderStats() {
  const period = getPeriod(statsOffset);
  const totals = periodTotals(period);
  const entries = Object.entries(totals.byCategory)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  let html = `<div class="screen-head"><h2>Статистика</h2></div>
    <div class="card month-switch">
      <button class="icon-btn" type="button" data-action="stats-prev" aria-label="Попередній місяць">◀</button>
      <div class="month-switch-title" aria-live="polite"><b>${periodTitle(period)}</b>${periodRangeHtml(period)}</div>
      <button class="icon-btn" type="button" data-action="stats-next" aria-label="Наступний місяць"${statsOffset >= 0 ? " disabled" : ""}>▶</button>
    </div>`;

  if (!entries.length) {
    html += `<div class="card">${emptyState("📊", "У цьому місяці витрат немає", statsOffset === 0 ? "Додай витрату через ＋ — і тут з'явиться діаграма" : "Спробуй інший місяць")}</div>`;
  } else {
    html += `<div class="card">${donutHtml(entries, totals.expense)}<ul class="legend">`;
    for (const [id, value] of entries) {
      const cat = findCategory("expense", id);
      const percent = (value / totals.expense) * 100;
      const percentText = percent < 1 ? "<1%" : Math.round(percent) + "%";
      html += `<li>
        <span class="dot" style="background:${CATEGORY_COLORS[id] || "#8A8F98"}" aria-hidden="true"></span>
        <span class="legend-name">${cat.icon} ${esc(cat.name)}</span>
        <span class="legend-sum">${formatMoney(value)}</span>
        <span class="legend-pct muted">${percentText}</span>
      </li>`;
    }
    html += `</ul></div>`;
  }

  html += `<div class="card total">Доходи <b class="pos">+${formatMoney(totals.income)}</b> · Витрати <b class="neg">−${formatMoney(totals.expense)}</b></div>`;

  renderInto($("screen-stats"), html);
}

function renderSettings() {
  const s = data.settings;
  const currencyOptions = Object.entries(CURRENCIES).map(([code, c]) => [code, `${c.symbol} ${c.name}`]);

  const html = `<div class="screen-head"><h2>Налаштування</h2></div>

    <div class="card settings-group">
      <h3>Основна валюта</h3>
      ${segmented("set-currency", currencyOptions, s.currency, "Основна валюта")}
      <p class="small muted">У ній рахуються баланс, бюджет і статистика.</p>
    </div>

    <div class="card settings-group">
      <h3>Курси валют</h3>
      <label class="field inline"><span>1 $ =</span>
        <input type="text" inputmode="decimal" data-setting="rate" data-code="USD" value="${String(s.rates.USD).replace(".", ",")}" aria-label="Курс долара в гривнях"><span>₴</span></label>
      <label class="field inline"><span>1 € =</span>
        <input type="text" inputmode="decimal" data-setting="rate" data-code="EUR" value="${String(s.rates.EUR).replace(".", ",")}" aria-label="Курс євро в гривнях"><span>₴</span></label>
      <p class="small muted">Курс вводиш вручну. Старі записи не змінюються, коли міняєш курс.</p>
    </div>

    <div class="card settings-group">
      <h3>Початок місяця</h3>
      <label class="field inline"><span>Місяць починається</span>
        <input type="number" inputmode="numeric" min="1" max="28" data-setting="monthStartDay" value="${s.monthStartDay}" aria-label="День початку місяця, від 1 до 28"><span>числа</span></label>
      <p class="small muted">Зручно, якщо стипендія чи зарплата приходить не першого.</p>
    </div>

    <div class="card settings-group">
      <h3>Дані</h3>
      <p class="small muted">Усе зберігається тільки на цьому пристрої. Останній бекап: ${s.lastBackup ? formatDateLong(s.lastBackup) : "ще не було"}.</p>
      <button class="btn btn-secondary" type="button" data-action="export">📤 Експорт даних</button>
      <button class="btn btn-secondary" type="button" data-action="import">📥 Імпорт даних</button>
      <button class="btn btn-danger" type="button" data-action="reset">🗑 Видалити всі дані</button>
    </div>

    <p class="app-version">Копійка v${APP_VERSION}</p>`;

  renderInto($("screen-settings"), html);
}

// ===== 9. Навігація =====

const renderers = {
  home: renderHome,
  budget: renderBudget,
  subscriptions: renderSubscriptions,
  goals: renderGoals,
  stats: renderStats,
  settings: renderSettings
};

let currentScreen = "home";

// Показує екран з назвою name і підсвічує відповідну вкладку
function showScreen(name) {
  if (!renderers[name]) return;
  currentScreen = name;
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === "screen-" + name);
  });
  // Підсвічуємо вкладку внизу (у налаштувань і статистики вкладки немає)
  document.querySelectorAll(".tab").forEach((tab) => {
    const on = tab.dataset.screen === name;
    tab.classList.toggle("active", on);
    if (on) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
  });
  renderers[name]();
  window.scrollTo(0, 0);
}

// Після кожної зміни даних: зберегти і перемалювати поточний екран
function commit() {
  save();
  renderers[currentScreen]();
}

// ===== 10. Нижня панель, вікно підтвердження, повідомлення =====

const sheet = $("sheet");
const sheetBody = $("sheet-body");
const sheetBackdrop = $("sheet-backdrop");
let sheetReturnFocus = null;

// Стан форми, відкритої в нижній панелі
let form = null;

function isSheetOpen() {
  return sheet.classList.contains("open");
}

// Відкриває панель із заголовком title і вмістом html. focusId — яке поле одразу активувати.
function openSheet(title, html, focusId) {
  if (!isSheetOpen()) sheetReturnFocus = document.activeElement;
  $("sheet-title").textContent = title;
  sheetBody.innerHTML = html;
  sheet.scrollTop = 0;
  sheet.classList.add("open");
  sheetBackdrop.classList.add("open");
  document.body.classList.add("no-scroll");
  const target = (focusId && $(focusId)) || sheet.querySelector(".sheet-close");
  target.focus({ preventScroll: true });
}

function closeSheet() {
  if (!isSheetOpen()) return;
  sheet.classList.remove("open");
  sheetBackdrop.classList.remove("open");
  document.body.classList.remove("no-scroll");
  form = null;
  if (sheetReturnFocus && document.contains(sheetReturnFocus)) {
    sheetReturnFocus.focus({ preventScroll: true });
  }
  sheetReturnFocus = null;
}

// Помилки у формі: червона рамка + текст під полем
function showError(field, message) {
  const input = $("f-" + field);
  if (input) {
    input.classList.add("invalid");
    input.setAttribute("aria-invalid", "true");
  }
  const box = $("err-" + field);
  if (box) box.textContent = message;
}

function clearErrors() {
  sheet.querySelectorAll(".invalid").forEach((el) => {
    el.classList.remove("invalid");
    el.removeAttribute("aria-invalid");
  });
  sheet.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
  });
}

// Власне вікно підтвердження. Повертає Promise: true — "так", false — "ні".
const modal = $("modal");
const modalBackdrop = $("modal-backdrop");
let modalResolve = null;

function confirmDialog({ title, text = "", okText = "Так", cancelText = "Скасувати", danger = false }) {
  if (modalResolve) modalResolve(false);
  $("modal-title").textContent = title;
  $("modal-text").textContent = text;
  $("modal-ok").textContent = okText;
  $("modal-cancel").textContent = cancelText;
  $("modal-ok").className = "btn " + (danger ? "btn-danger-solid" : "btn-primary");
  const returnFocus = document.activeElement;
  modal.classList.add("open");
  modalBackdrop.classList.add("open");
  // Для небезпечних дій фокус на "Скасувати", щоб випадково не натиснути Enter
  (danger ? $("modal-cancel") : $("modal-ok")).focus();

  return new Promise((resolve) => {
    modalResolve = (answer) => {
      modalResolve = null;
      modal.classList.remove("open");
      modalBackdrop.classList.remove("open");
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
      resolve(answer);
    };
  });
}

$("modal-ok").addEventListener("click", () => modalResolve && modalResolve(true));
$("modal-cancel").addEventListener("click", () => modalResolve && modalResolve(false));
modalBackdrop.addEventListener("click", () => modalResolve && modalResolve(false));

// Коротке повідомлення внизу екрана
let toastTimer = null;
function toast(text, isError = false) {
  const box = $("toast");
  box.textContent = text;
  box.classList.toggle("error", isError);
  box.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove("show"), isError ? 4000 : 2500);
}

// Перемикає активну кнопку в групі segmented
function setSegment(button) {
  button.parentElement.querySelectorAll(".seg").forEach((b) => {
    const on = b === button;
    b.classList.toggle("active", on);
    b.setAttribute("aria-pressed", String(on));
  });
}

// ===== 11. Форма запису (＋) =====

function openTxForm(id) {
  const t = id ? data.transactions.find((x) => x.id === id) : null;
  if (id && !t) return;
  form = {
    kind: "tx",
    id: t ? t.id : null,
    type: t ? t.type : "expense",
    category: t ? t.category : null,
    currency: t ? t.currency : data.settings.currency
  };

  openSheet(t ? "Редагувати запис" : "Новий запис", `
    <form data-form="tx" novalidate>
      ${segmented("tx-type", [["expense", "Витрата"], ["income", "Дохід"]], form.type, "Тип запису")}
      <div class="amount-row">
        <input class="amount-input" id="f-amount" type="text" inputmode="decimal" autocomplete="off"
          placeholder="0" aria-label="Сума" value="${t ? centsToInput(t.amount) : ""}">
        ${currencySwitch()}
      </div>
      <div class="field-error" id="err-amount"></div>
      <p class="field-label" id="cat-label">Категорія</p>
      <div class="cat-grid" id="f-cat" role="group" aria-labelledby="cat-label"></div>
      <div class="field-error" id="err-cat"></div>
      <label class="field"><span class="field-label">Дата</span>
        <input id="f-date" type="date" value="${t ? t.date : todayStr()}"></label>
      <div class="field-error" id="err-date"></div>
      <label class="field"><span class="field-label">Коментар</span>
        <input id="f-note" type="text" maxlength="100" autocomplete="off" placeholder="Необов'язково" value="${esc(t ? t.note : "")}"></label>
      <button class="btn btn-primary" type="submit">Зберегти</button>
      ${t ? `<button class="btn btn-danger" type="button" data-action="tx-delete">Видалити</button>` : ""}
    </form>`, t ? null : "f-amount");
  renderCategoryGrid();
}

// Сітка категорій: для витрат одні, для доходів інші
function renderCategoryGrid() {
  const list = form.type === "income" ? data.incomeCategories : data.categories;
  $("f-cat").innerHTML = list.map((c) => {
    const on = c.id === form.category;
    return `<button type="button" class="cat-btn${on ? " active" : ""}" data-action="tx-cat" data-id="${c.id}" aria-pressed="${on}">
      <span class="cat-btn-icon" aria-hidden="true">${c.icon}</span>
      <span class="cat-btn-name">${esc(c.name)}</span>
    </button>`;
  }).join("");
}

function saveTx() {
  clearErrors();
  const amount = parseAmount(val("f-amount"));
  const date = val("f-date");
  let ok = true;
  if (amount === null) {
    showError("amount", "Введи суму, наприклад 120 або 45,50");
    ok = false;
  } else if (amount <= 0) {
    showError("amount", "Сума має бути більшою за нуль");
    ok = false;
  }
  if (!form.category) {
    showError("cat", "Вибери категорію");
    ok = false;
  }
  if (!isValidDateStr(date)) {
    showError("date", "Вибери дату");
    ok = false;
  }
  if (!ok) return;

  const old = form.id ? data.transactions.find((t) => t.id === form.id) : null;
  // Курс фіксуємо в момент створення. Якщо валюту не міняли — лишаємо старий курс.
  let rate = rateToMain(form.currency);
  let rateBase = data.settings.currency;
  if (old && old.currency === form.currency) {
    rate = old.rate;
    rateBase = old.rateBase;
  }

  const record = {
    id: old ? old.id : uid(),
    type: form.type,
    amount,
    category: form.category,
    date,
    note: val("f-note").trim().slice(0, 100),
    currency: form.currency,
    rate,
    rateBase
  };
  if (old) Object.assign(old, record);
  else data.transactions.push(record);

  closeSheet();
  commit();
  toast(old ? "Запис оновлено" : "Запис додано");
}

async function deleteTx() {
  const id = form.id;
  const ok = await confirmDialog({ title: "Видалити запис?", text: "Цю дію не можна скасувати.", okText: "Видалити", danger: true });
  if (!ok) return;
  data.transactions = data.transactions.filter((t) => t.id !== id);
  closeSheet();
  commit();
  toast("Запис видалено");
}

// ===== 12. Бюджет: ліміт категорії =====

function openCategorySheet(id) {
  const cat = data.categories.find((c) => c.id === id);
  if (!cat) return;
  const period = getPeriod(0);
  const list = sortedTransactions(periodTotals(period).list.filter((t) =>
    t.type === "expense" && expenseCategoryId(t) === id));
  form = { kind: "limit", id };
  const symbol = CURRENCIES[data.settings.currency].symbol;

  openSheet(`${cat.icon} ${cat.name}`, `
    <form data-form="limit" novalidate>
      <label class="field"><span class="field-label">Ліміт на місяць, ${symbol}</span>
        <input id="f-limit" type="text" inputmode="decimal" autocomplete="off" placeholder="0 — без ліміту"
          value="${cat.limit ? centsToInput(limitOf(cat)) : ""}"></label>
      <div class="field-error" id="err-limit"></div>
      <button class="btn btn-primary" type="submit">Зберегти ліміт</button>
    </form>
    <h3 class="sheet-subtitle">Записи: ${periodTitle(period)}</h3>
    ${list.length ? `<ul class="tx-list">${list.map(txRowHtml).join("")}</ul>` : `<p class="muted">У цьому місяці записів немає</p>`}`);
}

function saveLimit() {
  clearErrors();
  const text = val("f-limit").trim();
  const limit = text === "" ? 0 : parseAmount(text);
  if (limit === null) {
    showError("limit", "Введи суму, наприклад 2000");
    return;
  }
  const cat = data.categories.find((c) => c.id === form.id);
  cat.limit = limit;
  cat.limitCurrency = data.settings.currency;
  closeSheet();
  commit();
  toast(limit ? "Ліміт збережено" : "Ліміт прибрано");
}

// ===== 13. Підписки =====

function openSubForm(id) {
  const s = id ? data.subscriptions.find((x) => x.id === id) : null;
  if (id && !s) return;
  form = {
    kind: "sub",
    id: s ? s.id : null,
    period: s ? s.period : "month",
    currency: s ? s.currency : data.settings.currency
  };

  openSheet(s ? "Підписка" : "Нова підписка", `
    <form data-form="sub" novalidate>
      <label class="field"><span class="field-label">Назва</span>
        <input id="f-name" type="text" maxlength="40" autocomplete="off" placeholder="Наприклад, Spotify" value="${esc(s ? s.name : "")}"></label>
      <div class="field-error" id="err-name"></div>
      <p class="field-label">Сума</p>
      <div class="amount-row">
        <input class="input" id="f-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="0"
          aria-label="Сума" value="${s ? centsToInput(s.amount) : ""}">
        ${currencySwitch()}
      </div>
      <div class="field-error" id="err-amount"></div>
      <p class="field-label">Період</p>
      ${segmented("sub-period", [["month", "Щомісяця"], ["year", "Щороку"]], form.period, "Період")}
      <label class="field"><span class="field-label">Наступне списання</span>
        <input id="f-date" type="date" value="${s ? s.nextDate : todayStr()}"></label>
      <div class="field-error" id="err-date"></div>
      <button class="btn btn-primary" type="submit">Зберегти</button>
      ${s ? `<button class="btn btn-danger" type="button" data-action="delete-sub">Видалити</button>` : ""}
    </form>`, s ? null : "f-name");
}

function saveSub() {
  clearErrors();
  const name = val("f-name").trim();
  const amount = parseAmount(val("f-amount"));
  const nextDate = val("f-date");
  let ok = true;
  if (!name) {
    showError("name", "Введи назву");
    ok = false;
  }
  if (amount === null || amount <= 0) {
    showError("amount", "Введи суму більшу за нуль");
    ok = false;
  }
  if (!isValidDateStr(nextDate)) {
    showError("date", "Вибери дату");
    ok = false;
  }
  if (!ok) return;

  const record = {
    id: form.id || uid(),
    name: name.slice(0, 40),
    amount,
    currency: form.currency,
    period: form.period,
    nextDate,
    day: parseDate(nextDate).getDate()
  };
  const old = data.subscriptions.find((s) => s.id === record.id);
  if (old) Object.assign(old, record);
  else data.subscriptions.push(record);
  rollSubscriptions();

  closeSheet();
  commit();
  toast(old ? "Підписку оновлено" : "Підписку додано");
}

async function deleteSub() {
  const id = form.id;
  const ok = await confirmDialog({ title: "Видалити підписку?", okText: "Видалити", danger: true });
  if (!ok) return;
  data.subscriptions = data.subscriptions.filter((s) => s.id !== id);
  closeSheet();
  commit();
  toast("Підписку видалено");
}

// ===== 14. Цілі =====

function openGoalForm(id) {
  const g = id ? data.goals.find((x) => x.id === id) : null;
  if (id && !g) return;
  form = { kind: "goal", id: g ? g.id : null, currency: g ? g.currency : data.settings.currency };

  openSheet(g ? "Ціль" : "Нова ціль", `
    <form data-form="goal" novalidate>
      <label class="field"><span class="field-label">Назва</span>
        <input id="f-name" type="text" maxlength="40" autocomplete="off" placeholder="Наприклад, новий телефон" value="${esc(g ? g.name : "")}"></label>
      <div class="field-error" id="err-name"></div>
      <p class="field-label">Скільки треба</p>
      <div class="amount-row">
        <input class="input" id="f-target" type="text" inputmode="decimal" autocomplete="off" placeholder="0"
          aria-label="Скільки треба" value="${g ? centsToInput(g.target) : ""}">
        ${currencySwitch()}
      </div>
      <div class="field-error" id="err-target"></div>
      <label class="field"><span class="field-label">Вже накопичено</span>
        <input id="f-saved" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="${g && g.saved ? centsToInput(g.saved) : ""}"></label>
      <div class="field-error" id="err-saved"></div>
      <label class="field"><span class="field-label">Дедлайн (необов'язково)</span>
        <input id="f-deadline" type="date" value="${g ? g.deadline : ""}"></label>
      <button class="btn btn-primary" type="submit">Зберегти</button>
      ${g ? `<button class="btn btn-danger" type="button" data-action="delete-goal">Видалити</button>` : ""}
    </form>`, g ? null : "f-name");
}

function saveGoal() {
  clearErrors();
  const name = val("f-name").trim();
  const target = parseAmount(val("f-target"));
  const savedText = val("f-saved").trim();
  const saved = savedText === "" ? 0 : parseAmount(savedText);
  const deadline = val("f-deadline");
  let ok = true;
  if (!name) {
    showError("name", "Введи назву");
    ok = false;
  }
  if (target === null || target <= 0) {
    showError("target", "Введи суму більшу за нуль");
    ok = false;
  }
  if (saved === null) {
    showError("saved", "Введи суму або залиш поле порожнім");
    ok = false;
  }
  if (!ok) return;

  const record = {
    id: form.id || uid(),
    name: name.slice(0, 40),
    target,
    saved,
    currency: form.currency,
    deadline: isValidDateStr(deadline) ? deadline : ""
  };
  const old = data.goals.find((g) => g.id === record.id);
  if (old) Object.assign(old, record);
  else data.goals.push(record);

  closeSheet();
  commit();
  toast(old ? "Ціль оновлено" : "Ціль додано");
}

async function deleteGoal() {
  const id = form.id;
  const ok = await confirmDialog({ title: "Видалити ціль?", text: "Накопичена сума просто зникне з застосунку.", okText: "Видалити", danger: true });
  if (!ok) return;
  data.goals = data.goals.filter((g) => g.id !== id);
  closeSheet();
  commit();
  toast("Ціль видалено");
}

function openTopUp(id) {
  const g = data.goals.find((x) => x.id === id);
  if (!g) return;
  form = { kind: "topup", id };
  const symbol = CURRENCIES[g.currency].symbol;

  openSheet(`Поповнити: ${g.name}`, `
    <form data-form="topup" novalidate>
      <p class="muted">Накопичено ${formatMoney(g.saved, g.currency)} з ${formatMoney(g.target, g.currency)}</p>
      <input class="amount-input" id="f-amount" type="text" inputmode="decimal" autocomplete="off"
        placeholder="0" aria-label="Сума, ${symbol}">
      <div class="field-error" id="err-amount"></div>
      <p class="small muted">Щоб забрати гроші з цілі, натисни «Зняти» (або введи суму з мінусом).</p>
      <div class="btn-row">
        <button class="btn btn-secondary" type="button" data-action="goal-withdraw">− Зняти</button>
        <button class="btn btn-primary" type="submit">＋ Додати</button>
      </div>
    </form>`, "f-amount");
}

// direction: 1 — додати, -1 — зняти
function applyTopUp(direction) {
  clearErrors();
  const goal = data.goals.find((g) => g.id === form.id);
  let delta = parseAmount(val("f-amount"), true);
  if (delta === null || delta === 0) {
    showError("amount", "Введи суму, наприклад 200");
    return;
  }
  if (direction < 0) delta = -Math.abs(delta);
  const wasDone = goal.saved >= goal.target;
  // saved не може бути меншим за 0
  goal.saved = Math.min(MAX_AMOUNT, Math.max(0, goal.saved + delta));

  closeSheet();
  commit();
  if (!wasDone && goal.saved >= goal.target) toast("🎉 Ціль досягнута!");
  else toast(delta > 0 ? "Додано до цілі" : "Знято з цілі");
}

// ===== 15. Налаштування =====

// Кожна сума пам'ятає свою валюту, тож тут нічого не перераховуємо —
// просто показуємо все в новій валюті. Перемикання туди-назад нічого не псує.
function changeCurrency(code) {
  if (code === data.settings.currency || !CURRENCIES[code]) return;
  data.settings.currency = code;
  commit();
  toast(`Основна валюта: ${CURRENCIES[code].symbol} ${CURRENCIES[code].name}`);
}

// Поля налаштувань зберігаються, коли людина закінчила ввід (подія change)
function onSettingChange(input) {
  if (input.dataset.setting === "rate") {
    const rate = parseRate(input.value);
    if (rate === null) {
      toast("Курс має бути числом більшим за нуль", true);
      renderSettings();
      return;
    }
    data.settings.rates[input.dataset.code] = rate;
    save();
    toast("Курс збережено");
  }
  if (input.dataset.setting === "monthStartDay") {
    const day = Math.round(Number(input.value));
    if (!(day >= 1 && day <= 28)) {
      toast("День має бути від 1 до 28", true);
      renderSettings();
      return;
    }
    data.settings.monthStartDay = day;
    statsOffset = 0;
    save();
    toast("Збережено");
  }
}

function exportData() {
  data.settings.lastBackup = todayStr();
  data.settings.backupRemindAfter = null;
  save();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kopiyka-backup-${todayStr()}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  renderers[currentScreen]();
  toast("Файл бекапу збережено");
}

const importInput = $("import-file");

importInput.addEventListener("change", async () => {
  const file = importInput.files[0];
  importInput.value = ""; // щоб той самий файл можна було вибрати ще раз
  if (!file) return;

  let imported;
  try {
    if (file.size > 10 * 1024 * 1024) throw new Error("Файл завеликий для бекапу Копійки");
    const parsed = JSON.parse(await file.text());
    if (!isObject(parsed) || !Array.isArray(parsed.transactions) || !isObject(parsed.settings)) {
      throw new Error("Це не файл бекапу Копійки");
    }
    if (Number(parsed.version) > DATA_VERSION) {
      throw new Error("Файл з новішої версії Копійки — спершу онови застосунок");
    }
    imported = migrate(parsed);
  } catch (error) {
    // Дані не чіпаємо, тільки показуємо помилку
    toast(error instanceof SyntaxError ? "Файл пошкоджений або це не JSON" : error.message, true);
    return;
  }

  const n = imported.transactions.length;
  const ok = await confirmDialog({
    title: "Замінити дані?",
    text: `У файлі ${n} ${plural(n, "запис", "записи", "записів")}. Усі поточні дані буде замінено даними з файлу.`,
    okText: "Замінити",
    danger: true
  });
  if (!ok) return;

  imported.settings.onboarded = true;
  data = imported;
  statsOffset = 0;
  commit();
  toast("Дані імпортовано");
});

async function resetAll() {
  const first = await confirmDialog({
    title: "Видалити всі дані?",
    text: "Зникнуть усі записи, підписки, цілі й налаштування.",
    okText: "Видалити",
    danger: true
  });
  if (!first) return;
  const second = await confirmDialog({
    title: "Точно видалити?",
    text: "Відновити дані можна буде тільки з файлу експорту.",
    okText: "Так, видалити все",
    danger: true
  });
  if (!second) return;

  data = getDefaultData();
  save();
  statsOffset = 0;
  showScreen("home");
  showWelcome();
  toast("Усі дані видалено");
}

function snoozeBackup() {
  data.settings.backupRemindAfter = addDays(todayStr(), 7);
  commit();
}

// ===== 16. Привітання =====

function showWelcome() {
  const options = Object.entries(CURRENCIES).map(([code, c]) => [code, `${c.symbol} ${c.name}`]);
  $("welcome-currency").innerHTML = segmented("welcome-currency", options, data.settings.currency, "Основна валюта");
  $("welcome").hidden = false;
  $("welcome").querySelector(".seg.active").focus();
}

function startApp() {
  const chosen = $("welcome").querySelector(".seg.active");
  data.settings.currency = chosen ? chosen.dataset.value : "UAH";
  data.categories.forEach((c) => {
    c.limitCurrency = data.settings.currency;
  });
  data.settings.onboarded = true;
  data.settings.startedAt = todayStr();
  $("welcome").hidden = true;
  commit();
}

// ===== 17. Обробка натискань =====

// Усі кнопки з data-action обробляються тут
const actions = {
  "add": () => openTxForm(),
  "close-sheet": () => closeSheet(),
  "edit-tx": (el) => openTxForm(el.dataset.id),
  "tx-type": (el) => {
    setSegment(el);
    form.type = el.dataset.value;
    form.category = null;
    renderCategoryGrid();
  },
  "tx-cat": (el) => {
    form.category = el.dataset.id;
    $("f-cat").querySelectorAll(".cat-btn").forEach((b) => {
      const on = b === el;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    $("f-cat").classList.remove("invalid");
    $("err-cat").textContent = "";
  },
  "form-currency": (el) => {
    setSegment(el);
    form.currency = el.dataset.value;
  },
  "tx-delete": () => deleteTx(),
  "open-category": (el) => openCategorySheet(el.dataset.id),
  "new-sub": () => openSubForm(),
  "edit-sub": (el) => openSubForm(el.dataset.id),
  "sub-period": (el) => {
    setSegment(el);
    form.period = el.dataset.value;
  },
  "delete-sub": () => deleteSub(),
  "new-goal": () => openGoalForm(),
  "edit-goal": (el) => openGoalForm(el.dataset.id),
  "delete-goal": () => deleteGoal(),
  "topup-goal": (el) => openTopUp(el.dataset.id),
  "goal-withdraw": () => applyTopUp(-1),
  "stats-prev": () => {
    statsOffset -= 1;
    renderStats();
  },
  "stats-next": () => {
    if (statsOffset < 0) statsOffset += 1;
    renderStats();
  },
  "set-currency": (el) => changeCurrency(el.dataset.value),
  "export": () => exportData(),
  "import": () => importInput.click(),
  "reset": () => resetAll(),
  "snooze-backup": () => snoozeBackup(),
  "welcome-currency": (el) => setSegment(el),
  "welcome-start": () => startApp()
};

document.addEventListener("click", (event) => {
  const el = event.target.closest("[data-action], [data-screen]");
  if (!el || el.disabled) return;
  if (el.dataset.screen) {
    closeSheet();
    showScreen(el.dataset.screen);
    return;
  }
  const handler = actions[el.dataset.action];
  if (handler) handler(el);
});

// Відправка форм (кнопка "Зберегти" або Enter)
const formHandlers = {
  tx: saveTx,
  limit: saveLimit,
  sub: saveSub,
  goal: saveGoal,
  topup: () => applyTopUp(1)
};

document.addEventListener("submit", (event) => {
  event.preventDefault();
  const handler = formHandlers[event.target.dataset.form];
  if (handler && form) handler();
});

// Як тільки людина почала виправляти поле — прибираємо червону рамку
document.addEventListener("input", (event) => {
  const input = event.target;
  if (input.classList.contains("invalid")) {
    input.classList.remove("invalid");
    input.removeAttribute("aria-invalid");
    const box = $("err-" + input.id.replace("f-", ""));
    if (box) box.textContent = "";
  }
});

document.addEventListener("change", (event) => {
  if (event.target.dataset.setting) onSettingChange(event.target);
});

// Клавіатура: Escape закриває вікно/панель, Tab не виходить за їхні межі
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (modalResolve) modalResolve(false);
    else if (isSheetOpen()) closeSheet();
    return;
  }
  if (event.key !== "Tab") return;
  let box = null;
  if (modalResolve) box = modal;
  else if (!$("welcome").hidden) box = $("welcome");
  else if (isSheetOpen()) box = sheet;
  if (!box) return;
  const items = [...box.querySelectorAll("button:not([disabled]), input, [tabindex]:not([tabindex='-1'])")]
    .filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (!box.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

// ===== 18. Офлайн-режим (service worker) =====

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Працює тільки на https або localhost
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker не зареєструвався:", error);
    });
  });
}

// ===== 19. Старт =====

rollSubscriptions();
save(); // одразу зберігаємо (і після міграції — у новому форматі)
showScreen("home");
if (!data.settings.onboarded) showWelcome();
registerServiceWorker();
