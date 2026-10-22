// ============================================
// Копійка — особистий фінансовий трекер
// ============================================

// Ключ, під яким усі дані лежать у localStorage
const STORAGE_KEY = "kopiyka-data";

// Дані за замовчуванням (коли нічого не збережено).
// Усі суми зберігаємо в копійках/центах: 12000 = 120.00
function getDefaultData() {
  return {
    version: 1,
    transactions: [],
    categories: [
      { id: "food", name: "Їжа", icon: "🍔", limit: 0 },
      { id: "transport", name: "Транспорт", icon: "🚌", limit: 0 },
      { id: "study", name: "Навчання", icon: "📚", limit: 0 },
      { id: "fun", name: "Розваги", icon: "🎮", limit: 0 },
      { id: "clothes", name: "Одяг", icon: "👕", limit: 0 },
      { id: "health", name: "Здоров'я", icon: "💊", limit: 0 },
      { id: "subs", name: "Підписки", icon: "🔁", limit: 0 },
      { id: "other", name: "Інше", icon: "📦", limit: 0 }
    ],
    subscriptions: [],
    goals: [],
    settings: { currency: "UAH", monthStartDay: 1, rates: { USD: 41.5, EUR: 45 } }
  };
}

// ===== Збереження =====

// Читаємо дані з localStorage. Якщо там пусто або битий JSON — беремо дані за замовчуванням.
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultData();

    const parsed = JSON.parse(raw);
    // Перевіряємо, що це схоже на наші дані
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.transactions)) {
      return getDefaultData();
    }
    // Доповнюємо відсутні поля значеннями за замовчуванням
    const defaults = getDefaultData();
    return {
      ...defaults,
      ...parsed,
      settings: { ...defaults.settings, ...parsed.settings }
    };
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
  }
}

// Усі дані застосунку живуть у цій змінній
let data = load();
save(); // одразу зберігаємо, щоб ключ точно з'явився в localStorage

// ===== Допоміжні функції =====

// Перетворює копійки в гарний рядок: formatMoney(12000, "UAH") → "120,00 ₴"
function formatMoney(cents, currency = data.settings.currency) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: currency,
    currencyDisplay: "narrowSymbol" // ₴ $ € замість "грн", "USD", "EUR"
  }).format(cents / 100);
}

// ===== Навігація між екранами =====

// Показує екран з назвою name і підсвічує відповідну вкладку
function showScreen(name) {
  // Ховаємо всі екрани, показуємо потрібний
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === "screen-" + name);
  });

  // Підсвічуємо вкладку внизу (у налаштувань і статистики вкладки немає)
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.screen === name);
  });

  // Прокручуємо сторінку нагору
  window.scrollTo(0, 0);
}

// Будь-яка кнопка з атрибутом data-screen відкриває свій екран
document.querySelectorAll("[data-screen]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.screen));
});

// ===== Нижня панель (bottom sheet) =====

const sheet = document.getElementById("sheet");
const sheetBackdrop = document.getElementById("sheet-backdrop");

function openSheet() {
  sheet.hidden = false;
  sheetBackdrop.hidden = false;
}

function closeSheet() {
  sheet.hidden = true;
  sheetBackdrop.hidden = true;
}

document.getElementById("add-btn").addEventListener("click", openSheet);
document.getElementById("sheet-close").addEventListener("click", closeSheet);
sheetBackdrop.addEventListener("click", closeSheet); // тап по затемненню теж закриває

// Клавіша Escape закриває панель
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !sheet.hidden) closeSheet();
});

// ===== Старт =====
showScreen("home");
