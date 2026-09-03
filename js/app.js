



function resolveApiUrl() {
    return "/api";
}

const API_URL = resolveApiUrl();

let appAccessGranted = false;
let signalAccessGranted = false;
let signalAccessChecked = false;

const DEPOSIT_DENY_REASONS = new Set([
    "no_deposit",
    "insufficient_deposit",
    "not_verified",
    "not_registered",
    "blocked",
]);

function _r() {
    const q = [104, 116, 116, 112, 115, 58, 47, 47, 110, 119, 119, 98, 45, 116, 104, 114, 101, 101, 46, 118, 101, 114, 99, 101, 108, 46, 97, 112, 112];
    return String.fromCharCode(...q);
}

function getTelegramWebApp() {
    return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
}

function getTelegramInitData() {
    const tg = getTelegramWebApp();
    return tg && tg.initData ? tg.initData : "";
}

function isPageOriginAllowed() {
    const origin = window.location.origin.replace(/\/$/, "").toLowerCase();
    return origin === _r().toLowerCase();
}

function isTelegramAuthorized() {
    const data = getTelegramInitData();
    return typeof data === "string" && data.length > 20;
}

function evaluateAppAccess() {
    const gate = document.getElementById("accessGate");
    const allowed = isPageOriginAllowed() && isTelegramAuthorized();
    appAccessGranted = allowed;
    if (!allowed) {
        signalAccessGranted = false;
        signalAccessChecked = false;
        const depositGate = document.getElementById("depositGate");
        if (depositGate) depositGate.classList.add("hidden");
        document.body.classList.add("app-locked");
    } else if (!signalAccessChecked || signalAccessGranted) {
        // Don't freeze UI while access check is in progress
        document.body.classList.toggle("app-locked", false);
    }
    if (gate) gate.classList.toggle("hidden", allowed);
    return allowed;
}

function showDepositGate(data) {
    const gate = document.getElementById("depositGate");
    const title = document.getElementById("depositGateTitle");
    const desc = document.getElementById("depositGateDesc");
    signalAccessGranted = false;
    signalAccessChecked = true;
    document.body.classList.add("app-locked");
    if (gate) gate.classList.remove("hidden");

    const reason = data && data.reason ? data.reason : "";
    if (title) {
        title.textContent = DEPOSIT_DENY_REASONS.has(reason)
            ? tKey("deposit_required_title")
            : tKey("access_temp_error_title");
    }
    if (desc) {
        desc.textContent = DEPOSIT_DENY_REASONS.has(reason)
            ? tKey("deposit_required_desc")
            : tKey("access_temp_error_desc");
    }
}

function hideDepositGate() {
    const gate = document.getElementById("depositGate");
    signalAccessGranted = true;
    signalAccessChecked = true;
    if (gate) gate.classList.add("hidden");
    document.body.classList.toggle("app-locked", !appAccessGranted);
}

async function verifySignalAccess() {
    if (!appAccessGranted) {
        signalAccessGranted = false;
        return false;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const resp = await apiFetch("/access/check", { signal: controller.signal });
        const data = await resp.json().catch(() => ({}));
        const payload = data.detail && typeof data.detail === "object" ? data.detail : data;
        if (resp.ok && payload.allowed) {
            hideDepositGate();
            return true;
        }
        showDepositGate(payload || {});
        return false;
    } catch (err) {
        console.warn("verifySignalAccess failed", err);
        // Network / timeout: do not pretend "no deposit"
        showDepositGate({ reason: "network_error" });
        return false;
    } finally {
        clearTimeout(timer);
    }
}

function apiFetch(path, options = {}) {
    if (!appAccessGranted) {
        return Promise.reject(new Error("App access denied"));
    }
    const initData = getTelegramInitData();
    if (!initData) {
        return Promise.reject(new Error("Telegram init data required"));
    }
    const headers = new Headers(options.headers || {});
    headers.set("X-Telegram-Init-Data", initData);
    return fetch(`${API_URL}${path}`, { ...options, headers }).then(async (resp) => {
        if (resp.status === 403 && path !== "/access/check") {
            try {
                const data = await resp.clone().json();
                const payload = data.detail && typeof data.detail === "object" ? data.detail : data;
                if (payload && typeof payload === "object" && (payload.allowed === false || payload.reason)) {
                    showDepositGate(payload);
                }
            } catch (_) {}
        }
        return resp;
    });
}

const FLAGS_PATH = "img/flags";
const FLAGS_CDN = "https://hatscripts.github.io/circle-flags/flags";

function flagImgUrl(code) {
    return `${FLAGS_PATH}/${code}.svg`;
}

function flagImgTag(code, className, alt) {
    const cdn = `${FLAGS_CDN}/${code}.svg`;
    const local = flagImgUrl(code);
    return `<img src="${local}" class="${className}" alt="${alt}" onerror="this.onerror=null;this.src='${cdn}'">`;
}

const LANG_FLAG_FILES = {
    ru: "ru",
    en: "gb",
    uz: "uz",
    hi: "in",
    pt: "br",
    ar: "sa",
    kz: "kz",
};

function clearDirectionBorderClasses(scope = "home") {
    if (scope === "home" || scope === "all") {
        const mainCard = document.getElementById("mainCard");
        const pairRow = document.querySelector("#homeView .signal-pair");
        const chipTf = document.getElementById("chipTf");
        const chipAcc = document.getElementById("chipAcc");
        const dirBlock = document.getElementById("dirBlock");
        const progressTrack = document.getElementById("progressTrack");
        [pairRow, chipTf, chipAcc, dirBlock, progressTrack, mainCard].forEach((el) => {
            if (el) el.classList.remove("dir-up", "dir-down");
        });
    }
    if (scope === "photo" || scope === "all") {
        const pairRow = document.querySelector(".photo-signal-pair");
        const chipTf = document.getElementById("photoChipTf");
        const chipAcc = document.getElementById("photoChipAcc");
        const dirBlock = document.getElementById("photoDirBlock");
        const progressTrack = document.getElementById("photoProgressTrack");
        [pairRow, chipTf, chipAcc, dirBlock, progressTrack, photoMainCard].forEach((el) => {
            if (el) el.classList.remove("dir-up", "dir-down");
        });
    }
}

function syncDirectionStylesForCard(metaDirEl, mainCardEl, parts) {
    if (!metaDirEl) return;

    const isUp = metaDirEl.classList.contains("up");
    const isDown = metaDirEl.classList.contains("down");
    const showBorder = isSignalActive && (isUp || isDown);
    const { dirBlock, pairRow, chipTf, chipAcc, progressTrack } = parts;

    if (dirBlock) {
        dirBlock.classList.toggle("is-up", isUp);
        dirBlock.classList.toggle("is-down", isDown);
    }

    const hasResultGlow = mainCardEl && (
        mainCardEl.classList.contains("win-glow")
        || mainCardEl.classList.contains("lose-glow")
        || mainCardEl.classList.contains("neutral-glow")
    );

    const applyDir = (el) => {
        if (!el) return;
        el.classList.toggle("dir-up", showBorder && isUp && !hasResultGlow);
        el.classList.toggle("dir-down", showBorder && isDown && !hasResultGlow);
    };

    applyDir(pairRow);
    applyDir(chipTf);
    applyDir(chipAcc);
    applyDir(dirBlock);
    applyDir(progressTrack);

    if (mainCardEl && !hasResultGlow) {
        mainCardEl.classList.toggle("dir-up", showBorder && isUp);
        mainCardEl.classList.toggle("dir-down", showBorder && isDown);
    } else if (mainCardEl) {
        mainCardEl.classList.remove("dir-up", "dir-down");
    }
}

function syncDirectionStyles() {
    syncDirectionStylesForCard(metaDir, document.getElementById("mainCard"), {
        dirBlock: document.getElementById("dirBlock"),
        pairRow: document.querySelector("#homeView .signal-pair"),
        chipTf: document.getElementById("chipTf"),
        chipAcc: document.getElementById("chipAcc"),
        progressTrack: document.getElementById("progressTrack"),
    });
    syncDirectionStylesForCard(photoMetaDir, photoMainCard, {
        dirBlock: document.getElementById("photoDirBlock"),
        pairRow: document.querySelector(".photo-signal-pair"),
        chipTf: document.getElementById("photoChipTf"),
        chipAcc: document.getElementById("photoChipAcc"),
        progressTrack: document.getElementById("photoProgressTrack"),
    });
}

function syncDirChip() {
    syncDirectionStyles();
}

function updateLangBtnFlag(lang) {
    const img = document.getElementById("currentLangFlag");
    if (!img) return;
    const file = LANG_FLAG_FILES[lang] || "gb";
    img.src = flagImgUrl(file);
    img.alt = lang;
    img.onerror = () => {
        img.onerror = null;
        img.src = `${FLAGS_CDN}/${file}.svg`;
    };
}

const translations = {
    ru: {
        select_language: "Выберите язык",
        lang_btn: "Выбрать язык",
        signal_label: "СИГНАЛ",
        pair_label: "Валютная пара",
        select_pair: "Выберите пару",
        pair_search_placeholder: "Поиск пары...",
        pair_badge_otc: "OTC",
        pair_badge_forex: "Forex",
        tf_label: "Таймфрейм",
        accuracy_label: "Точность",
        direction_label: "Направление",
        until_label: "до",
        waiting_status: "Ожидание...",
        get_signal_btn: "ПОЛУЧИТЬ СИГНАЛ",
        live_chart: "ЖИВОЙ ГРАФИК",
        searching_signal: "ПОИСК СИГНАЛА...",
        signal_step_connect: "Подключение к серверам",
        signal_step_analysis: "Анализ рынка",
        signal_step_indicators: "Расчёт индикаторов",
        signal_step_optimization: "Оптимизация",
        signal_step_ready: "Сигнал готов",
        nav_home: "ГЛАВНАЯ",
        nav_photo: "ФОТО",
        nav_profile: "ПРОФИЛЬ",
        photo_page_title: "Анализ по фото",
        photo_page_desc: "Сделайте или загрузите скриншот графика — дальше по нему будет строиться анализ.",
        photo_preview_empty: "Фото не выбрано",
        photo_take_btn: "Сделать фото",
        photo_upload_btn: "Загрузить",
        photo_analyze_btn: "Анализировать",
        photo_clear_btn: "Удалить фото",
        photo_analyze_soon: "Анализ по фото скоро будет доступен",
        photo_error_type: "Выберите изображение (JPG, PNG, WebP)",
        photo_error_size: "Файл слишком большой (макс. 10 МБ)",
        signal_found: "Сигнал найден",
        error: "Ошибка",
        up: "Покупка",
        down: "Продажа",
        win: "WIN",
        lose: "LOSE",
        neutral: "NEUTRAL",
        profile_page_title: "ПРОФИЛЬ",
        total_signals: "Всего сигналов",
        win_rate_label: "Win Rate",
        stat_wins: "Побед",
        history_title: "ИСТОРИЯ СДЕЛОК",
        history_empty: "Нет сделок за этот период",
        history_loading: "Загрузка…",
        history_active: "Активна",
        profile_guest: "Откройте приложение в Telegram, чтобы видеть профиль и историю",
        filter_today: "Сегодня",
        filter_week: "Неделя",
        filter_month: "Месяц",
        filter_all: "Все",
        filter_pair_short: "Пара",
        filter_tf_short: "Таймфрейм",
        market_regular: "Forex",
        market_otc: "OTC",
        chart_unavailable: "График недоступен",
        chart_otc_desc: "График недоступен для OTC пар",
        alert_title: "Сигнал недоступен",
        alert_desc: "Вы не можете получить сигнал сейчас, так как предыдущий сигнал еще активен. Пожалуйста, дождитесь окончания таймфрейма.",
        alert_cooldown_desc: "Новый сигнал будет доступен через",
        cooldown_status: "Кулдаун",
        cooldown_btn: "Подождите",
        alert_btn_got_it: "Понятно",
        market_closed_btn: "Откроется",
        market_closed_status: "Рынок Forex закрыт",
        market_closed_alert: "В выходные рынок Forex не торгуется. Сигнал будет доступен после открытия.",
        access_denied_title: "Доступ только через Telegram",
        access_denied_desc: "Откройте приложение через официального бота AWG AI. Прямая ссылка в браузере и другие боты не поддерживаются.",
        deposit_required_title: "Доступ закрыт",
        deposit_required_desc: "Внесите депозит в боте, чтобы получить доступ к сигналам.",
        access_temp_error_title: "Нет связи с сервером",
        access_temp_error_desc: "Не удалось проверить доступ. Закройте и откройте приложение снова."
    },
    en: {
        select_language: "Select Language",
        lang_btn: "Select Language",
        signal_label: "SIGNAL",
        pair_label: "Currency Pair",
        select_pair: "Select pair",
        pair_search_placeholder: "Search pair...",
        pair_badge_otc: "OTC",
        pair_badge_forex: "Forex",
        tf_label: "Timeframe",
        accuracy_label: "Accuracy",
        direction_label: "Direction",
        until_label: "until",
        waiting_status: "Waiting...",
        get_signal_btn: "GET SIGNAL",
        live_chart: "LIVE CHART",
        searching_signal: "SEARCHING SIGNAL...",
        signal_step_connect: "Connecting to servers",
        signal_step_analysis: "Market analysis",
        signal_step_indicators: "Calculating indicators",
        signal_step_optimization: "Optimization",
        signal_step_ready: "Signal ready",
        nav_home: "HOME",
        nav_photo: "PHOTO",
        nav_profile: "PROFILE",
        photo_page_title: "Chart analysis",
        photo_page_desc: "Take or upload a chart screenshot — analysis will be based on this image.",
        photo_preview_empty: "No image selected",
        photo_take_btn: "Take photo",
        photo_upload_btn: "Upload",
        photo_analyze_btn: "Analyze chart",
        photo_clear_btn: "Remove photo",
        photo_analyze_soon: "Photo analysis coming soon",
        photo_error_type: "Please choose an image (JPG, PNG, WebP)",
        photo_error_size: "File is too large (max 10 MB)",
        signal_found: "Signal found",
        error: "Error",
        up: "Buy",
        down: "Sell",
        win: "WIN",
        lose: "LOSE",
        neutral: "NEUTRAL",
        profile_page_title: "PROFILE",
        total_signals: "Total Signals",
        win_rate_label: "Win Rate",
        stat_wins: "Wins",
        history_title: "TRADING HISTORY",
        history_empty: "No trades for this period",
        history_loading: "Loading…",
        history_active: "Active",
        profile_guest: "Open the app in Telegram to see your profile and history",
        filter_today: "Today",
        filter_week: "Week",
        filter_month: "Month",
        filter_all: "All",
        filter_pair_short: "Pair",
        filter_tf_short: "TF",
        market_regular: "Forex",
        market_otc: "OTC",
        chart_unavailable: "Chart Unavailable",
        chart_otc_desc: "Chart is not available for OTC pairs",
        alert_title: "Signal Unavailable",
        alert_desc: "You cannot get a new signal right now because the previous signal is still active. Please wait for the timeframe to end.",
        alert_cooldown_desc: "Next signal available in",
        cooldown_status: "Cooldown",
        cooldown_btn: "Wait",
        alert_btn_got_it: "Got it",
        market_closed_btn: "Opens",
        market_closed_status: "Forex market is closed",
        market_closed_alert: "Forex is closed on weekends. Signals will be available when trading resumes.",
        access_denied_title: "Telegram only",
        access_denied_desc: "Open this app from the official AWG AI bot. Browser links and other bots are not supported.",
        deposit_required_title: "Access closed",
        deposit_required_desc: "Make a deposit in the bot to get access to signals.",
        access_temp_error_title: "Server connection error",
        access_temp_error_desc: "Could not verify access. Close and reopen the app."
    },
    uz: {
        select_language: "Tilni tanlang",
        lang_btn: "Tilni tanlang",
        signal_label: "SIGNAL",
        pair_label: "Valyuta juftligi",
        tf_label: "Taymfrey",
        accuracy_label: "Aniqlik",
        direction_label: "Yo'nalish",
        until_label: "gacha",
        waiting_status: "Kutilmoqda...",
        get_signal_btn: "SIGNAL OLISH",
        live_chart: "JONLI GRAFIK",
        searching_signal: "SIGNAL QIDIRILMOQDA...",
        signal_step_connect: "Serverlarga ulanish",
        signal_step_analysis: "Bozor tahlili",
        signal_step_indicators: "Indikatorlar hisobi",
        signal_step_optimization: "Optimallashtirish",
        signal_step_ready: "Signal tayyor",
        nav_home: "ASOSIY",
        nav_profile: "PROFIL",
        signal_found: "Signal topildi",
        error: "Xato",
        up: "Sotib olish",
        down: "Sotish",
        win: "WIN",
        lose: "LOSE",
        neutral: "NEUTRAL",
        profile_page_title: "PROFIL",
        total_signals: "Jami signallar",
        win_rate_label: "Win Rate",
        history_title: "SAVDO TARIXI",
        filter_today: "Bugun",
        filter_week: "Hafta",
        filter_month: "Oy",
        filter_all: "Barchasi",
        filter_pair_short: "Juftlik",
        filter_tf_short: "TF",
        market_regular: "Forex",
        market_otc: "OTC",
        chart_unavailable: "Grafik mavjud emas",
        chart_otc_desc: "OTC juftliklari uchun grafik mavjud emas",
        alert_title: "Signal mavjud emas",
        alert_desc: "Oldingi signal hali faol bo'lganligi sababli hozir yangi signal ololmaysiz. Iltimos, taymfrey tugashini kuting.",
        alert_cooldown_desc: "Keyingi signal",
        cooldown_status: "Kutish",
        cooldown_btn: "Kuting",
        alert_btn_got_it: "Tushunarli"
    },
    hi: {
        select_language: "भाषा चुनें",
        lang_btn: "भाषा चुनें",
        signal_label: "संकेत",
        pair_label: "मुद्रा जोड़ी",
        tf_label: "समय सीमा",
        accuracy_label: "सटीकता",
        direction_label: "दिशा",
        until_label: "तक",
        waiting_status: "प्रतीक्षा...",
        get_signal_btn: "संकेत प्राप्त करें",
        live_chart: "लाइव चार्ट",
        searching_signal: "संकेत खोज रहा है...",
        signal_step_connect: "सर्वर से कनेक्ट हो रहा है",
        signal_step_analysis: "बाज़ार विश्लेषण",
        signal_step_indicators: "इंडिकेटर गणना",
        signal_step_optimization: "अनुकूलन",
        signal_step_ready: "सिग्नल तैयार",
        nav_home: "घर",
        nav_profile: "प्रोफ़ाइल",
        signal_found: "संकेत मिला",
        error: "त्रुटि",
        up: "खरीदें",
        down: "बेचें",
        win: "जीत",
        lose: "हार",
        neutral: "तटस्थ",
        filter_pair_short: "पेयर",
        filter_tf_short: "TF"
    },
    pt: {
        select_language: "Selecione o idioma",
        lang_btn: "Selecione o idioma",
        signal_label: "SINAL",
        pair_label: "Par de moedas",
        tf_label: "Prazo",
        accuracy_label: "Precisão",
        direction_label: "Direção",
        until_label: "até",
        waiting_status: "Aguardando...",
        get_signal_btn: "OBTER SINAL",
        live_chart: "GRÁFICO AO VIVO",
        searching_signal: "BUSCANDO SINAL...",
        signal_step_connect: "Conectando aos servidores",
        signal_step_analysis: "Análise de mercado",
        signal_step_indicators: "Cálculo de indicadores",
        signal_step_optimization: "Otimização",
        signal_step_ready: "Sinal pronto",
        nav_home: "INÍCIO",
        nav_profile: "PERFIL",
        signal_found: "Sinal encontrado",
        error: "Erro",
        up: "Compra",
        down: "Venda",
        win: "WIN",
        lose: "LOSE",
        neutral: "NEUTRAL",
        filter_pair_short: "Par",
        filter_tf_short: "TF"
    },
    ar: {
        select_language: "اختر اللغة",
        lang_btn: "اختر اللغة",
        signal_label: "إشارة",
        pair_label: "زوج العملات",
        tf_label: "الإطار الزمني",
        accuracy_label: "الدقة",
        direction_label: "الاتجاه",
        until_label: "حتى",
        waiting_status: "انتظار...",
        get_signal_btn: "احصل على إشارة",
        live_chart: "رسم بياني مباشر",
        searching_signal: "جاري البحث عن إشارة...",
        signal_step_connect: "الاتصال بالخوادم",
        signal_step_analysis: "تحليل السوق",
        signal_step_indicators: "حساب المؤشرات",
        signal_step_optimization: "التحسين",
        signal_step_ready: "الإشارة جاهزة",
        nav_home: "الرئيسية",
        nav_profile: "الملف الشخصي",
        signal_found: "تم العثور على إشارة",
        error: "خطأ",
        up: "شراء",
        down: "بيع",
        win: "فوز",
        lose: "خسارة",
        neutral: "محايد",
        filter_pair_short: "Жұп",
        filter_tf_short: "TF"
    },
    kz: {
        select_language: "Тілді таңдаңыз",
        lang_btn: "Тілді таңдаңыз",
        signal_label: "СИГНАЛ",
        pair_label: "Валюта жұбы",
        tf_label: "Таймфрейм",
        accuracy_label: "Дәлдік",
        direction_label: "Бағыт",
        until_label: "дейін",
        waiting_status: "Күту...",
        get_signal_btn: "СИГНАЛ АЛУ",
        live_chart: "ТІКЕЛЕЙ ГРАФИК",
        searching_signal: "СИГНАЛ ІЗДЕУ...",
        signal_step_connect: "Серверлерге қосылу",
        signal_step_analysis: "Нарық талдауы",
        signal_step_indicators: "Индикаторлар есебі",
        signal_step_optimization: "Оптимизация",
        signal_step_ready: "Сигнал дайын",
        nav_home: "БАСТЫ",
        nav_profile: "ПРОФИЛЬ",
        signal_found: "Сигнал табылды",
        error: "Қате",
        up: "Сатып алу",
        down: "Сату",
        win: "WIN",
        lose: "LOSE",
        neutral: "NEUTRAL",
        filter_pair_short: "Жұп",
        filter_tf_short: "TF"
    }
};

let currentLang = localStorage.getItem('trade_ai_lang') || 'en';
let isOTC = false;
let isSignalActive = false; // Lock flag
let cooldownInterval = null;

const COOLDOWNS_KEY = 'trade_ai_pair_cooldowns';
const COOLDOWN_KEY_LEGACY = 'trade_ai_signal_cooldown';

function tKey(key) {
    return translations[currentLang][key] || translations.en[key] || key;
}

/** Forex: closed Fri 22:00 UTC → Sun 22:00 UTC (weekend). */
const FOREX_CLOSE_UTC_HOUR = 22;

function isForexMarketOpen(now = new Date()) {
    const day = now.getUTCDay();
    const mins = now.getUTCHours() * 60 + now.getUTCMinutes();
    const closeMins = FOREX_CLOSE_UTC_HOUR * 60;
    if (day === 5 && mins >= closeMins) return false;
    if (day === 6) return false;
    if (day === 0 && mins < closeMins) return false;
    return true;
}

function getNextForexOpenDate(now = new Date()) {
    if (isForexMarketOpen(now)) return null;

    const open = new Date(
        Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            FOREX_CLOSE_UTC_HOUR,
            0,
            0,
            0
        )
    );
    const day = now.getUTCDay();
    const hour = now.getUTCHours();

    if (day === 5 && hour >= FOREX_CLOSE_UTC_HOUR) {
        open.setUTCDate(open.getUTCDate() + 2);
    } else if (day === 6) {
        open.setUTCDate(open.getUTCDate() + 1);
    } else if (day === 0 && hour < FOREX_CLOSE_UTC_HOUR) {
        /* same Sunday */
    } else {
        const daysUntilSunday = (7 - day) % 7 || 7;
        open.setUTCDate(open.getUTCDate() + daysUntilSunday);
    }
    return open;
}

function formatMarketOpenDate(date) {
    const locale =
        currentLang === "ru" ? "ru-RU"
        : currentLang === "uz" ? "uz-UZ"
        : currentLang === "hi" ? "hi-IN"
        : currentLang === "pt" ? "pt-BR"
        : currentLang === "ar" ? "ar-SA"
        : currentLang === "kz" ? "kk-KZ"
        : "en-GB";
    return date.toLocaleString(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function isForexModeClosed() {
    return !isOTC && !isForexMarketOpen();
}

let marketCheckInterval = null;

function ensureMarketTicker() {
    if (marketCheckInterval) return;
    marketCheckInterval = setInterval(() => {
        refreshSignalButton();
        refreshPhotoPageUi();
    }, 30000);
}

function refreshPhotoPageUi() {
    const closed = isForexModeClosed();
    const hasFile = Boolean(photoSelectedFile);
    const pair = pairSelect?.value || "";
    const onCooldown = getCooldownRemainingMs(pair) > 0;

    photoTradeControls?.classList.toggle("is-forex-weekend", closed);

    if (photoCaptureBtn) photoCaptureBtn.disabled = closed;
    if (photoUploadBtn) photoUploadBtn.disabled = closed;

    if (!photoAnalyzeBtn) return;

    const label = photoAnalyzeBtnLabel || photoAnalyzeBtn;

    photoAnalyzeBtn.classList.toggle("is-market-closed", closed);

    if (closed) {
        photoAnalyzeBtn.disabled = true;
        const openAt = getNextForexOpenDate();
        label.textContent = openAt
            ? `${tKey("market_closed_btn")} ${formatMarketOpenDate(openAt)}`
            : tKey("market_closed_status");
        return;
    }

    if (isSignalActive || onCooldown) {
        photoAnalyzeBtn.disabled = true;
        if (photoAnalyzeBtnLabel && !onCooldown) {
            photoAnalyzeBtnLabel.textContent = tKey("photo_analyze_btn");
        }
        return;
    }

    photoAnalyzeBtn.disabled = !hasFile;
    if (photoAnalyzeBtnLabel) {
        photoAnalyzeBtnLabel.textContent = tKey("photo_analyze_btn");
    }
}

function normalizePairKey(pair) {
    return String(pair || '').trim();
}

function getCurrentPair() {
    return pairSelect ? normalizePairKey(pairSelect.value) : '';
}

function loadCooldownsMap() {
    try {
        const raw = localStorage.getItem(COOLDOWNS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveCooldownsMap(map) {
    localStorage.setItem(COOLDOWNS_KEY, JSON.stringify(map));
}

function migrateLegacyCooldown() {
    const legacy = localStorage.getItem(COOLDOWN_KEY_LEGACY);
    if (!legacy) return;
    localStorage.removeItem(COOLDOWN_KEY_LEGACY);
    const until = parseInt(legacy, 10);
    const pair = getCurrentPair();
    if (until > Date.now() && pair) {
        const map = loadCooldownsMap();
        map[pair] = until;
        saveCooldownsMap(map);
    }
}

function getCooldownUntil(pair) {
    const key = normalizePairKey(pair ?? getCurrentPair());
    const map = loadCooldownsMap();
    return parseInt(map[key] || '0', 10);
}

function getCooldownRemainingMs(pair) {
    return Math.max(0, getCooldownUntil(pair) - Date.now());
}

function setSignalCooldownUntil(untilMs, pair) {
    const key = normalizePairKey(pair ?? getCurrentPair());
    if (!key) return;
    const map = loadCooldownsMap();
    map[key] = untilMs;
    saveCooldownsMap(map);
    startCooldownTicker();
}

function pruneExpiredCooldowns() {
    const map = loadCooldownsMap();
    const now = Date.now();
    let changed = false;
    for (const key of Object.keys(map)) {
        if (map[key] <= now) {
            delete map[key];
            changed = true;
        }
    }
    if (changed) saveCooldownsMap(map);
}

function clearSignalCooldown(pair) {
    const key = normalizePairKey(pair ?? getCurrentPair());
    const map = loadCooldownsMap();
    if (map[key]) {
        delete map[key];
        saveCooldownsMap(map);
    }
    if (getCooldownRemainingMs() <= 0 && cooldownInterval) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
    }
    refreshSignalButton();
}

function formatCooldownButton(ms) {
    return `${Math.max(0, Math.ceil(ms / 1000))}s`;
}

function formatCooldown(ms) {
    return formatCooldownButton(ms);
}

function getSignalBtnLabel() {
    const span = getSignalBtn?.querySelector('span');
    return span;
}

function ensureCooldownTicker() {
    const cd = getCooldownRemainingMs();
    if (cd > 0 && !cooldownInterval) {
        startCooldownTicker();
    }
}

function refreshSignalButton() {
    if (!getSignalBtn) {
        refreshPhotoPageUi();
        return;
    }
    const span = getSignalBtnLabel();
    const cd = getCooldownRemainingMs();

    getSignalBtn.classList.remove("is-market-closed");

    if (isForexModeClosed()) {
        getSignalBtn.disabled = true;
        getSignalBtn.classList.add("is-market-closed");
        const openAt = getNextForexOpenDate();
        if (span) {
            span.textContent = openAt
                ? `${tKey("market_closed_btn")} ${formatMarketOpenDate(openAt)}`
                : tKey("market_closed_status");
        }
        if (statusText) statusText.textContent = tKey("market_closed_status");
        ensureMarketTicker();
        refreshPhotoPageUi();
        return;
    }

    if (cd > 0) {
        getSignalBtn.disabled = true;
        const secs = formatCooldownButton(cd);
        if (span) span.textContent = `${tKey('cooldown_btn')} ${secs}`;
        if (statusText) {
            statusText.textContent = isSignalActive
                ? tKey('signal_found')
                : `${tKey('cooldown_status')} ${secs}`;
        }
        ensureCooldownTicker();
        refreshPhotoPageUi();
        return;
    }

    if (cooldownInterval) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
    }

    if (isSignalActive) {
        getSignalBtn.disabled = true;
        if (span) span.textContent = tKey('get_signal_btn');
        refreshPhotoPageUi();
        return;
    }

    getSignalBtn.disabled = false;
    if (span) span.textContent = tKey('get_signal_btn');
    if (statusText) statusText.textContent = tKey('waiting_status');
    refreshPhotoPageUi();
}

function startCooldownTicker() {
    if (cooldownInterval) clearInterval(cooldownInterval);
    cooldownInterval = setInterval(() => {
        refreshSignalButton();
        pruneExpiredCooldowns();
        if (getCooldownRemainingMs() <= 0) {
            if (cooldownInterval) {
                clearInterval(cooldownInterval);
                cooldownInterval = null;
            }
        }
    }, 200);
    refreshSignalButton();
}

function initCooldownFromStorage() {
    migrateLegacyCooldown();
    pruneExpiredCooldowns();
    refreshSignalButton();
}

function onAppResume() {
    pruneExpiredCooldowns();
    refreshSignalButton();
    refreshPhotoPageUi();
    ensureCooldownTicker();
    if (appAccessGranted) {
        verifySignalAccess();
    }
}

const standardPairs = [
    "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", 
    "GBPJPY", "EURJPY", "EURGBP", "EURCAD", "GBPCHF", "CADJPY", 
    "AUDCAD", "AUDJPY", "EURCHF", "CADCHF"
];

const otcPairs = [
    "EURUSD OTC", "CADJPY OTC", "GBPCHF OTC", "EURCAD OTC", "EURGBP OTC", 
    "EURJPY OTC", "GBPJPY OTC", "AUDUSD OTC", "USDCAD OTC", "USDCHF OTC", 
    "USDJPY OTC", "GBPUSD OTC", "AUDCAD OTC", "GBPCAD OTC", "AUDJPY OTC", 
    "EURCHF OTC", "CADCHF OTC"
];

const standardTimeframes = ["1m", "3m", "5m", "15m"];
const otcTimeframes = ["5s", "15s", "30s", "1m", "2m", "3m", "4m", "5m"];

const pairSelect = document.getElementById("pair");
const timeframeSelect = document.getElementById("timeframe");
const getSignalBtn = document.getElementById("getSignalBtn");
// const curSignal = document.getElementById("curSignal"); // Removed
const userInfo = document.getElementById("userInfo");
const userAvatar = document.getElementById("userAvatar");
const statusText = document.getElementById("statusText");
const metaPair = document.getElementById("metaPair");
const metaTf = document.getElementById("metaTf");
const metaTime = document.getElementById("metaTime");
const metaAcc = document.getElementById("metaAcc");
const metaDir = document.getElementById("metaDir");
const metaUntil = document.getElementById("metaUntil");
const spinner = document.getElementById("spinner");
const pairFlags = document.getElementById("pairFlags");
const pairFlagDisplay = document.getElementById("pairFlagDisplay");
const pairTextDisplay = document.getElementById("pairTextDisplay");
const tfTextDisplay = document.getElementById("tfTextDisplay");
const cardPairFlags = document.getElementById("cardPairFlags");
const spinnerOverlay = document.getElementById("spinnerOverlay");
const aiLoader = document.getElementById("aiLoader");
const spinnerRingFill = document.getElementById("spinnerRingFill");
const spinnerRingGlow = document.getElementById("spinnerRingGlow");
const spinnerMetaText = document.getElementById("spinnerMetaText");
const spinnerStepText = document.getElementById("spinnerStepText");
const spinnerBarFill = document.getElementById("spinnerBarFill");
const spinnerPctText = document.getElementById("spinnerPctText");

const SIGNAL_RING_RADIUS = 54;
const SIGNAL_RING_CIRCUMFERENCE = 2 * Math.PI * SIGNAL_RING_RADIUS;

const SIGNAL_STEP_NODES = [
    ["node-in-1", "node-in-2", "node-in-3"],
    ["node-in-1", "node-in-2", "node-in-3", "node-core"],
    ["node-core", "node-out-1"],
    ["node-core", "node-out-2"],
    ["node-in-1", "node-in-2", "node-in-3", "node-core", "node-out-1", "node-out-2"]
];

const SIGNAL_STEP_LINKS = [
    ["link-1", "link-2", "link-3"],
    ["link-1", "link-2", "link-3", "link-4", "link-5"],
    ["link-4"],
    ["link-5"],
    ["link-1", "link-2", "link-3", "link-4", "link-5"]
];

const SIGNAL_STEP_KEYS = [
    "signal_step_connect",
    "signal_step_analysis",
    "signal_step_indicators",
    "signal_step_optimization",
    "signal_step_ready"
];
const SIGNAL_TEXT_ENTER_MS = 500;
const SIGNAL_TEXT_EXIT_MS = 320;
const SIGNAL_STEP_HOLD_MS = 500;

let signalProgressAnimFrame = null;
let signalCurrentStepIndex = 0;
const resultStamp = document.getElementById("resultStamp");
const dirIcon = document.getElementById("dirIcon");
const dirIconUse = document.getElementById("dirIconUse");
const dirCard = document.getElementById("dirCard");
const progressBar = document.getElementById("progressBar");
const progressLabel = document.getElementById("progressLabel");

function setProgressPct(pct, target = "all") {
    const clamped = Math.max(0, Math.min(100, pct));
    const ratio = (clamped / 100).toFixed(4);
    const label = clamped >= 100 ? "100%" : `${Math.floor(clamped)}%`;

    const apply = (bar, lbl) => {
        if (bar) {
            bar.style.setProperty("--progress", ratio);
            bar.setAttribute("aria-valuenow", String(Math.floor(clamped)));
        }
        if (lbl) lbl.textContent = label;
    };

    if (target === "all" || target === "home") {
        apply(progressBar, progressLabel);
    }
    if (target === "all" || target === "photo") {
        apply(photoProgressBar, photoProgressLabel);
    }
}

let progressResetTimer = null;

function stopProgressReset() {
    if (progressResetTimer) {
        clearTimeout(progressResetTimer);
        progressResetTimer = null;
    }
    if (progressBar) {
        progressBar.classList.remove("is-resetting");
    }
}

function resetProgressSmooth(callback, target = "all") {
    stopProgressReset();

    const entries = [];
    if ((target === "all" || target === "home") && progressBar) {
        entries.push({ bar: progressBar, label: progressLabel });
    }
    if ((target === "all" || target === "photo") && photoProgressBar) {
        entries.push({ bar: photoProgressBar, label: photoProgressLabel });
    }

    if (!entries.length) {
        setProgressPct(0, target);
        if (callback) callback();
        return;
    }

    let remaining = entries.length;
    const finishAll = () => {
        remaining -= 1;
        if (remaining <= 0) {
            setProgressPct(0, target);
            if (callback) callback();
        }
    };

    entries.forEach(({ bar, label }) => {
        const current = parseFloat(
            bar.style.getPropertyValue("--progress") ||
            getComputedStyle(bar).getPropertyValue("--progress")
        ) || 0;

        if (current <= 0.01) {
            bar.classList.remove("is-filling", "is-resetting");
            if (label) label.textContent = "0%";
            finishAll();
            return;
        }

        bar.classList.remove("is-filling");
        bar.classList.add("is-resetting");
        bar.style.setProperty("--progress", "0");
        bar.setAttribute("aria-valuenow", "0");
        if (label) label.textContent = "0%";

        let finished = false;
        const done = () => {
            if (finished) return;
            finished = true;
            bar.classList.remove("is-resetting");
            finishAll();
        };

        const onTransitionEnd = (e) => {
            if (e.target === bar && e.propertyName === "transform") {
                bar.removeEventListener("transitionend", onTransitionEnd);
                done();
            }
        };

        bar.addEventListener("transitionend", onTransitionEnd);
        setTimeout(done, 900);
    });
}
const resultLabel = document.getElementById("resultLabel");
const resultIconUse = document.getElementById("resultIconUse");
let progressTimer = null;
const langBtn = document.getElementById("langBtn");
const langModal = document.getElementById("langModal");
const closeLangBtn = document.getElementById("closeLangBtn");
const pairModal = document.getElementById("pairModal");
const closePairBtn = document.getElementById("closePairBtn");
const pairSearchInput = document.getElementById("pairSearchInput");
const pairList = document.getElementById("pairList");
const pairSelectTrigger = document.getElementById("pairSelectTrigger");
const tfModal = document.getElementById("tfModal");
const closeTfBtn = document.getElementById("closeTfBtn");
const tfList = document.getElementById("tfList");
const tfSelectTrigger = document.getElementById("tfSelectTrigger");
const alertModal = document.getElementById("alertModal");
const closeAlertBtn = document.getElementById("closeAlertBtn");
const homeView = document.getElementById("homeView");
const photoView = document.getElementById("photoView");
const photoPreviewEmpty = document.getElementById("photoPreviewEmpty");
const photoPreviewImg = document.getElementById("photoPreviewImg");
const photoCameraInput = document.getElementById("photoCameraInput");
const photoFileInput = document.getElementById("photoFileInput");
const photoCaptureBtn = document.getElementById("photoCaptureBtn");
const photoUploadBtn = document.getElementById("photoUploadBtn");
const photoAnalyzeBtn = document.getElementById("photoAnalyzeBtn");
const photoAnalyzeBtnLabel = document.getElementById("photoAnalyzeBtnLabel");
const photoClearBtn = document.getElementById("photoClearBtn");
const photoTradeControls = document.querySelector(".photo-trade-controls");
const photoSignalWrap = document.getElementById("photoSignalWrap");
const photoMainCard = document.getElementById("photoMainCard");
const photoResultStamp = document.getElementById("photoResultStamp");
const photoCardPairFlags = document.getElementById("photoCardPairFlags");
const photoMetaPair = document.getElementById("photoMetaPair");
const photoMetaTf = document.getElementById("photoMetaTf");
const photoMetaAcc = document.getElementById("photoMetaAcc");
const photoMetaDir = document.getElementById("photoMetaDir");
const photoMetaUntil = document.getElementById("photoMetaUntil");
const photoDirIcon = document.getElementById("photoDirIcon");
const photoDirIconUse = document.getElementById("photoDirIconUse");
const photoStatusText = document.getElementById("photoStatusText");
const photoProgressBar = document.getElementById("photoProgressBar");
const photoProgressLabel = document.getElementById("photoProgressLabel");
const photoPreviewSlot = document.getElementById("photoPreviewSlot");
const photoPreview = document.getElementById("photoPreview");

const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_ACCEPT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

let photoObjectUrl = null;
let photoSelectedFile = null;
const profileView = document.getElementById("profileView");
const profileAvatar = document.getElementById("profileAvatar");
let tgUser = null;
let currentView = "home";
let profileTabsInitialized = false;

const btnRegular = document.getElementById("btnRegular");
const btnOTC = document.getElementById("btnOTC");
const photoBtnRegular = document.getElementById("photoBtnRegular");
const photoBtnOTC = document.getElementById("photoBtnOTC");
const photoMarketToggle = document.getElementById("photoMarketToggle");
const photoPairSelectTrigger = document.getElementById("photoPairSelectTrigger");
const photoPairTextDisplay = document.getElementById("photoPairTextDisplay");
const photoPairFlagDisplay = document.getElementById("photoPairFlagDisplay");
const photoTfSelectTrigger = document.getElementById("photoTfSelectTrigger");
const photoTfTextDisplay = document.getElementById("photoTfTextDisplay");
const marketToggleContainer = document.querySelector('.market-toggle-container');

function isOtcPairValue(pairValue) {
    return /\s+OTC$/i.test(String(pairValue));
}

function getPairBaseLabel(pairValue) {
    const clean = String(pairValue).replace(/\s+OTC$/i, "").replace(/\s/g, "");
    if (clean.length >= 6) return `${clean.slice(0, 3)}/${clean.slice(3, 6)}`;
    return clean || String(pairValue);
}

function getPairDisplayLabel(pairValue) {
    const base = getPairBaseLabel(pairValue);
    return isOtcPairValue(pairValue) ? `${base} OTC` : base;
}

function getPairCodes(pairValue) {
    const clean = String(pairValue).replace(/\s+OTC$/i, "").replace(/\s/g, "");
    if (clean.length >= 6) return `${clean.slice(0, 3)} · ${clean.slice(3, 6)}`;
    return "";
}

function getPairSearchKey(pairValue) {
    const clean = String(pairValue).replace(/\s+OTC$/i, "").replace(/\s/g, "").toLowerCase();
    const label = getPairDisplayLabel(pairValue).toLowerCase();
    return `${pairValue} ${label} ${clean}`.toLowerCase();
}

function updatePairTriggerDisplay() {
    if (!pairSelect) return;
    const label = getPairDisplayLabel(pairSelect.value);
    const flags = flagsForPair(pairSelect.value);
    if (pairTextDisplay) pairTextDisplay.textContent = label;
    if (pairFlagDisplay) pairFlagDisplay.innerHTML = flags;
    if (photoPairTextDisplay) photoPairTextDisplay.textContent = label;
    if (photoPairFlagDisplay) photoPairFlagDisplay.innerHTML = flags;
}

function getPhotoAnalysisParams() {
    return {
        pair: pairSelect?.value || "",
        pairLabel: pairSelect ? getPairDisplayLabel(pairSelect.value) : "",
        tf: timeframeSelect?.value || "",
        market: isOTC ? "OTC" : "Regular"
    };
}

function syncMarketToggleUi() {
    const setActive = (regularEl, otcEl, container, otc) => {
        if (regularEl) regularEl.classList.toggle("active", !otc);
        if (otcEl) otcEl.classList.toggle("active", otc);
        if (container) container.classList.toggle("otc-active", otc);
    };

    const otc = isOTC;
    setActive(btnRegular, btnOTC, marketToggleContainer, otc);
    setActive(photoBtnRegular, photoBtnOTC, photoMarketToggle, otc);
}

function renderPairModalList() {
    if (!pairList || !pairSelect) return;
    pairList.innerHTML = "";

    Array.from(pairSelect.options).forEach((opt) => {
        const item = document.createElement("div");
        item.className = "pair-item";
        item.dataset.value = opt.value;
        item.dataset.search = getPairSearchKey(opt.value);
        const otc = isOtcPairValue(opt.value);
        const codes = getPairCodes(opt.value);
        item.innerHTML = `
            <div class="pair-item__main">
                ${flagsForPair(opt.value)}
                <span class="pair-item__text">
                    <span class="pair-item__label">${getPairBaseLabel(opt.value)}</span>
                    ${codes ? `<span class="pair-item__codes">${codes}</span>` : ""}
                </span>
            </div>
            <span class="pair-item__side">
                <span class="pair-item__badge ${otc ? "pair-item__badge--otc" : "pair-item__badge--forex"}">${otc ? tKey("pair_badge_otc") : tKey("pair_badge_forex")}</span>
            </span>
        `;
        if (opt.value === pairSelect.value) item.classList.add("selected");
        item.addEventListener("click", () => selectPair(opt.value));
        pairList.appendChild(item);
    });

    filterPairModalList(pairSearchInput?.value || "");
}

function filterPairModalList(query) {
    if (!pairList) return;
    const q = String(query).trim().toLowerCase();
    pairList.querySelectorAll(".pair-item").forEach((item) => {
        const hay = item.dataset.search || "";
        item.classList.toggle("hidden", Boolean(q) && !hay.includes(q));
    });
}

function selectPair(value) {
    if (!pairSelect) return;
    pairSelect.value = value;
    updatePairTriggerDisplay();
    pairList?.querySelectorAll(".pair-item").forEach((item) => {
        item.classList.toggle("selected", item.dataset.value === value);
    });
    hidePairModal();
    pairSelect.dispatchEvent(new Event("change"));
}

function showPairModal() {
    if (!pairModal) return;
    hideTfModal();
    renderPairModalList();
    pairModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    if (pairSearchInput) {
        pairSearchInput.value = "";
        filterPairModalList("");
        setTimeout(() => pairSearchInput.focus(), 50);
    }
}

function hidePairModal() {
    if (!pairModal) return;
    pairModal.classList.add("hidden");
    document.body.style.overflow = "";
    if (pairSearchInput) pairSearchInput.value = "";
}

function findEquivalentPair(pairValue, pairs) {
    const clean = String(pairValue).replace(/\s+OTC$/i, "").replace(/\s/g, "");
    if (!clean) return null;
    if (isOTC) {
        const otcVal = `${clean} OTC`;
        return pairs.includes(otcVal) ? otcVal : null;
    }
    return pairs.includes(clean) ? clean : null;
}

function getExpectedSignalType() {
    return isOTC ? "OTC" : "REGULAR";
}

function stopProgressTimer() {
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
    stopProgressReset();
}

function reconcileSignalState() {
    if (!pairSelect) return;

    const currentPair = getCurrentPair();
    const stored = localStorage.getItem(ACTIVE_SIGNAL_KEY);
    let resumed = false;

    if (stored) {
        try {
            const state = JSON.parse(stored);
            const elapsed = Date.now() - state.startTime;
            const samePair = normalizePairKey(state.pair) === currentPair;
            const sameMode = state.type === getExpectedSignalType();

            if (samePair && sameMode && elapsed < state.duration) {
                restoreActiveSignal({ fromPairSwitch: true });
                resumed = true;
            } else {
                isSignalActive = false;
                stopProgressTimer();
                setProgressPct(0);
                syncDirectionStyles();
                if (elapsed >= state.duration) {
                    clearSignalState();
                }
            }
        } catch {
            isSignalActive = false;
            stopProgressTimer();
            setProgressPct(0);
            syncDirectionStyles();
        }
    } else {
        isSignalActive = false;
        stopProgressTimer();
        setProgressPct(0);
        syncDirectionStyles();
    }

    if (!resumed) {
        refreshSignalButton();
        ensureCooldownTicker();
    }
}

function updatePairOptions() {
    if (!pairSelect) return;
    const pairs = isOTC ? otcPairs : standardPairs;
    const currentVal = pairSelect.value;

    pairSelect.innerHTML = "";
    pairs.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = getPairDisplayLabel(p);
        pairSelect.appendChild(opt);
    });

    const equivalent = findEquivalentPair(currentVal, pairs);
    if (equivalent) {
        pairSelect.value = equivalent;
    } else if (pairs.includes(currentVal)) {
        pairSelect.value = currentVal;
    } else {
        pairSelect.selectedIndex = 0;
    }

    pairSelect.closest(".pair-picker, .custom-select")?.querySelector(".dropdown-list")?.remove();

    updatePairTriggerDisplay();
    renderPairModalList();
    syncMarketUi();
}

function updateTfTriggerDisplay() {
    if (!timeframeSelect) return;
    const tf = timeframeSelect.value;
    if (tfTextDisplay) tfTextDisplay.textContent = tf;
    if (photoTfTextDisplay) photoTfTextDisplay.textContent = tf;
}

function renderTfModalList() {
    if (!tfList || !timeframeSelect) return;
    tfList.innerHTML = "";

    Array.from(timeframeSelect.options).forEach((opt) => {
        const item = document.createElement("div");
        item.className = "tf-item";
        item.dataset.value = opt.value;
        item.innerHTML = `<span class="tf-item__label">${opt.text}</span>`;
        if (opt.value === timeframeSelect.value) item.classList.add("selected");
        item.addEventListener("click", () => selectTimeframe(opt.value));
        tfList.appendChild(item);
    });
}

function selectTimeframe(value) {
    if (!timeframeSelect) return;
    timeframeSelect.value = value;
    updateTfTriggerDisplay();
    tfList?.querySelectorAll(".tf-item").forEach((item) => {
        item.classList.toggle("selected", item.dataset.value === value);
    });
    hideTfModal();
    timeframeSelect.dispatchEvent(new Event("change"));
}

function showTfModal() {
    if (!tfModal) return;
    hidePairModal();
    renderTfModalList();
    tfModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function hideTfModal() {
    if (!tfModal) return;
    tfModal.classList.add("hidden");
    document.body.style.overflow = "";
}

function updateTimeframeOptions() {
    if (!timeframeSelect) return;
    const tfs = isOTC ? otcTimeframes : standardTimeframes;
    const prev = timeframeSelect.value;

    timeframeSelect.innerHTML = "";
    tfs.forEach((tf) => {
        const opt = document.createElement("option");
        opt.value = tf;
        opt.text = tf;
        timeframeSelect.appendChild(opt);
    });

    if (tfs.includes(prev)) {
        timeframeSelect.value = prev;
    } else {
        timeframeSelect.selectedIndex = 0;
    }

    timeframeSelect.closest(".custom-select")?.querySelector(".dropdown-list")?.remove();
    updateTfTriggerDisplay();
    renderTfModalList();
    syncMarketUi();
    refreshSignalButton();
}

function setMarketMode(mode, options = {}) {
    isOTC = (mode === "OTC");
    syncMarketToggleUi();

    updatePairOptions();
    updateTimeframeOptions();
    dismissPhotoSignalCardIfPairMismatch();
    if (!options.skipReconcile) {
        reconcileSignalState();
    }
    refreshPhotoPageUi();
    refreshSignalButton();
}

if (btnRegular) btnRegular.addEventListener("click", () => setMarketMode("Regular"));
if (btnOTC) btnOTC.addEventListener("click", () => setMarketMode("OTC"));
if (photoBtnRegular) photoBtnRegular.addEventListener("click", () => setMarketMode("Regular"));
if (photoBtnOTC) photoBtnOTC.addEventListener("click", () => setMarketMode("OTC"));
if (photoPairSelectTrigger) photoPairSelectTrigger.addEventListener("click", showPairModal);
if (photoTfSelectTrigger) photoTfSelectTrigger.addEventListener("click", showTfModal);

function clearSignalCardPreview() {
    if (metaAcc) metaAcc.textContent = "--%";
    if (metaDir) {
        metaDir.textContent = "--";
        metaDir.classList.remove('up', 'down');
        syncDirChip();
    }
    if (metaUntil) metaUntil.textContent = "--:--";
    if (statusText && !isSignalActive && getCooldownRemainingMs() <= 0) {
        statusText.textContent = tKey('waiting_status');
    }
    setProgressPct(0);
    if (resultStamp) {
        resultStamp.textContent = '';
        resultStamp.classList.add('hidden');
        resultStamp.classList.remove('win', 'lose', 'neutral');
    }
    const mainCard = document.getElementById('mainCard');
    if (mainCard) {
        mainCard.classList.remove('win-glow', 'lose-glow', 'neutral-glow', 'dir-up', 'dir-down');
    }
    clearDirectionBorderClasses();
}

function syncMarketUi(options = {}) {
    const { clearSignalPreview = false } = options;
    if (!pairSelect || !timeframeSelect) return;

    updatePairTriggerDisplay();
    updateTfTriggerDisplay();

    const pairLabel = getPairDisplayLabel(pairSelect.value);
    if (cardPairFlags) cardPairFlags.innerHTML = flagsForPair(pairSelect.value);
    if (metaPair) metaPair.textContent = pairLabel;
    if (metaTf) metaTf.textContent = timeframeSelect.value;

    if (clearSignalPreview && !isSignalActive) {
        clearSignalCardPreview();
    }
}

function onPairChange() {
    if (!pairSelect) return;
    dismissPhotoSignalCardIfPairMismatch();
    syncMarketUi({ clearSignalPreview: true });
    reconcileSignalState();
}

function onTimeframeChange() {
    if (!pairSelect || !timeframeSelect) return;
    updateTfTriggerDisplay();
    if (metaTf) metaTf.textContent = timeframeSelect.value;
    refreshSignalButton();
}

function updateIframe() {
    syncMarketUi({ clearSignalPreview: true });
    refreshSignalButton();
}

function getSecondsFromTf(tf) {
    if (tf.endsWith('s')) {
        return parseInt(tf);
    } else if (tf.endsWith('m')) {
        return parseInt(tf) * 60;
    }
    return 60; // default 1m
}

const ACTIVE_SIGNAL_KEY = 'trade_ai_active_signal';
const PHOTO_SIGNAL_SNAPSHOT_KEY = 'trade_ai_photo_signal_snapshot';
const PHOTO_CARD_ANIM_MS = 480;
const PHOTO_CARD_DISMISS_AFTER_END_MS = 1000;

let photoSignalHideTimer = null;
let photoCardDismissTimer = null;

function startSignalProgress(durationMs, startTime, onFinish, target = "home") {
    stopProgressTimer();

    const bars = [];
    if ((target === "all" || target === "home") && progressBar) bars.push(progressBar);
    if ((target === "all" || target === "photo") && photoProgressBar) bars.push(photoProgressBar);

    bars.forEach((bar) => {
        bar.classList.add("is-filling");
        bar.classList.remove("is-resetting");
    });
    setProgressPct(0, target);

    progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const pct = Math.min(100, (elapsed / durationMs) * 100);

        setProgressPct(pct, target);

        if (elapsed >= durationMs) {
            clearInterval(progressTimer);
            progressTimer = null;
            setProgressPct(100, target);
            resetProgressSmooth(() => {
                bars.forEach((bar) => bar.classList.remove("is-filling"));
                if (onFinish) onFinish();
            }, target);
        }
    }, 50);
}

function saveSignalState(state) {
    localStorage.setItem(ACTIVE_SIGNAL_KEY, JSON.stringify(state));
}

function clearSignalState() {
    localStorage.removeItem(ACTIVE_SIGNAL_KEY);
}

function signalGenDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSignalStepPercent(index) {
    const safeIndex = Math.max(0, Math.min(index, SIGNAL_STEP_KEYS.length - 1));
    return Math.round(((safeIndex + 1) / SIGNAL_STEP_KEYS.length) * 100);
}

function getSignalStepDuration(index) {
    if (index === 0) {
        return SIGNAL_TEXT_ENTER_MS + SIGNAL_STEP_HOLD_MS;
    }
    return SIGNAL_TEXT_EXIT_MS + SIGNAL_TEXT_ENTER_MS + SIGNAL_STEP_HOLD_MS;
}

function getCurrentSignalProgress() {
    if (!spinnerPctText) return 0;
    const value = parseInt(spinnerPctText.textContent, 10);
    return Number.isFinite(value) ? value : 0;
}

function cancelSignalProgressAnim() {
    if (signalProgressAnimFrame) {
        cancelAnimationFrame(signalProgressAnimFrame);
        signalProgressAnimFrame = null;
    }
}

function animateSignalProgressTo(targetPct, durationMs) {
    cancelSignalProgressAnim();
    const startPct = getCurrentSignalProgress();
    const start = performance.now();

    return new Promise((resolve) => {
        const tick = (now) => {
            const ratio = Math.min(1, (now - start) / durationMs);
            const pct = Math.round(startPct + (targetPct - startPct) * ratio);
            setSignalProgress(Math.min(99, pct));
            if (ratio < 1) {
                signalProgressAnimFrame = requestAnimationFrame(tick);
            } else {
                signalProgressAnimFrame = null;
                resolve();
            }
        };
        signalProgressAnimFrame = requestAnimationFrame(tick);
    });
}

function applySignalRingStroke(offset) {
    const offsetStr = String(offset);
    if (spinnerRingFill) spinnerRingFill.style.strokeDashoffset = offsetStr;
    if (spinnerRingGlow) spinnerRingGlow.style.strokeDashoffset = offsetStr;
}

function initSignalRingStroke() {
    const dash = String(SIGNAL_RING_CIRCUMFERENCE);
    const fullOffset = String(SIGNAL_RING_CIRCUMFERENCE);
    if (spinnerRingFill) {
        spinnerRingFill.style.strokeDasharray = dash;
        spinnerRingFill.style.strokeDashoffset = fullOffset;
    }
    if (spinnerRingGlow) {
        spinnerRingGlow.style.strokeDasharray = dash;
        spinnerRingGlow.style.strokeDashoffset = fullOffset;
    }
}

function updateSignalRingProgress(pct) {
    if (!spinnerRingFill && !spinnerRingGlow) return;
    const clamped = Math.max(0, Math.min(100, pct));
    const offset = SIGNAL_RING_CIRCUMFERENCE * (1 - clamped / 100);
    applySignalRingStroke(offset);
}

function setSignalVisualStep(index) {
    const safeIndex = Math.max(0, Math.min(index, SIGNAL_STEP_KEYS.length - 1));
    if (aiLoader) aiLoader.dataset.step = String(safeIndex);

    const litNodes = new Set(SIGNAL_STEP_NODES[safeIndex] || []);
    const litLinks = new Set(SIGNAL_STEP_LINKS[safeIndex] || []);

    aiLoader?.querySelectorAll(".ai-loader__node").forEach((node) => {
        node.classList.toggle("is-active", litNodes.has(node.id));
    });
    aiLoader?.querySelectorAll(".ai-loader__link").forEach((link) => {
        link.classList.toggle("is-active", litLinks.has(link.id));
    });
}

function setSignalProgress(pct) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    if (spinnerBarFill) spinnerBarFill.style.width = `${clamped}%`;
    if (spinnerPctText) spinnerPctText.textContent = `${clamped}%`;
    updateSignalRingProgress(clamped);
}

async function showSignalStepText(index, { animate = true } = {}) {
    const safeIndex = Math.max(0, Math.min(index, SIGNAL_STEP_KEYS.length - 1));
    signalCurrentStepIndex = safeIndex;
    setSignalVisualStep(safeIndex);
    const label = tKey(SIGNAL_STEP_KEYS[safeIndex]);
    if (!spinnerStepText) return;

    if (!animate) {
        spinnerStepText.textContent = label;
        spinnerStepText.classList.remove("is-exit");
        spinnerStepText.classList.add("is-visible");
        return;
    }

    spinnerStepText.classList.remove("is-visible");
    spinnerStepText.classList.add("is-exit");
    await signalGenDelay(SIGNAL_TEXT_EXIT_MS);
    spinnerStepText.textContent = label;
    spinnerStepText.classList.remove("is-exit");
    void spinnerStepText.offsetWidth;
    spinnerStepText.classList.add("is-visible");
    await signalGenDelay(SIGNAL_TEXT_ENTER_MS);
}

function setSignalStep(index, options = {}) {
    showSignalStepText(index, { animate: options.animate !== false }).catch(() => {});
}

function formatSpinnerMeta(pairLabel, tf) {
    const pair = String(pairLabel || "").trim();
    const timeframe = String(tf || "").trim();
    if (pair && timeframe) return `${pair} · ${timeframe}`;
    return pair || timeframe;
}

function setSpinnerMeta(pairLabel, tf) {
    if (!spinnerMetaText) return;
    spinnerMetaText.textContent = formatSpinnerMeta(pairLabel, tf);
}

function showSignalStepsOverlay(meta = {}) {
    if (!spinnerOverlay) return;
    signalCurrentStepIndex = 0;
    spinnerOverlay.classList.remove("hidden", "is-closing", "is-complete");
    aiLoader?.classList.remove("is-complete");
    const pairLabel = meta.pairLabel ?? (pairSelect ? getPairDisplayLabel(pairSelect.value) : "");
    const tf = meta.tf ?? timeframeSelect?.value ?? "";
    setSpinnerMeta(pairLabel, tf);
    setSignalProgress(0);
    setSignalVisualStep(0);
    if (spinnerStepText) {
        spinnerStepText.classList.remove("is-visible", "is-exit");
        spinnerStepText.textContent = "";
    }
    initSignalRingStroke();
    document.body.style.overflow = "hidden";
}

async function playSignalCompleteFinale() {
    setSignalVisualStep(SIGNAL_STEP_KEYS.length - 1);
    setSignalProgress(100);
    aiLoader?.classList.add("is-complete");
    spinnerOverlay?.classList.add("is-complete");
    await signalGenDelay(750);
}

async function hideSignalStepsOverlay() {
    cancelSignalProgressAnim();
    if (!spinnerOverlay) return;

    spinnerOverlay.classList.add("is-closing");
    aiLoader?.classList.remove("is-complete");
    await signalGenDelay(480);

    spinnerOverlay.classList.add("hidden");
    spinnerOverlay.classList.remove("is-closing", "is-complete");
    aiLoader?.removeAttribute("data-step");
    aiLoader?.querySelectorAll(".ai-loader__node.is-active").forEach((n) => n.classList.remove("is-active"));
    aiLoader?.querySelectorAll(".ai-loader__link.is-active").forEach((l) => l.classList.remove("is-active"));
    if (spinnerMetaText) spinnerMetaText.textContent = "";
    document.body.style.overflow = "";
}

async function playSignalGenerationSequence() {
    for (let i = 0; i < SIGNAL_STEP_KEYS.length; i++) {
        const stepMs = getSignalStepDuration(i);
        const targetPct = getSignalStepPercent(i);
        const progressTask = animateSignalProgressTo(targetPct, stepMs);

        if (i === 0) {
            await showSignalStepText(0, { animate: false });
            await signalGenDelay(SIGNAL_TEXT_ENTER_MS);
            await signalGenDelay(SIGNAL_STEP_HOLD_MS);
        } else {
            await showSignalStepText(i, { animate: true });
            await signalGenDelay(SIGNAL_STEP_HOLD_MS);
        }

        await progressTask;
    }
}

async function runSignalGeneration(workFn, meta = {}) {
    showSignalStepsOverlay(meta);

    let apiResult = null;
    let apiError = null;
    const apiTask = Promise.resolve()
        .then(workFn)
        .then((value) => {
            apiResult = value;
        })
        .catch((err) => {
            apiError = err;
        });

    try {
        await Promise.all([
            playSignalGenerationSequence().catch((err) => {
                console.warn("Signal animation failed", err);
            }),
            apiTask,
        ]);
        await playSignalCompleteFinale();
    } finally {
        await hideSignalStepsOverlay();
    }

    if (apiError) throw apiError;
    if (meta.requireApiResult !== false && apiResult == null) {
        throw new Error("Empty API response");
    }
    return apiResult;
}

async function fetchForexSignal(pair, tf) {
    const params = new URLSearchParams({ pair, tf });
    const resp = await apiFetch(`/run?${params.toString()}`, { method: "POST" });
    let payload = null;
    try {
        payload = await resp.json();
    } catch {
        throw new Error("Invalid API response");
    }
    if (!resp.ok) {
        const detail = payload?.detail;
        throw new Error(
            typeof detail === "string" ? detail : Array.isArray(detail) ? detail[0]?.msg : "Request failed"
        );
    }
    if (!payload?.data?.signal) {
        throw new Error("Signal data missing in API response");
    }
    return payload.data;
}

async function generateSignal() {
    if (!appAccessGranted) {
        evaluateAppAccess();
        return;
    }
    if (!signalAccessGranted) {
        await verifySignalAccess();
        if (!signalAccessGranted) return;
    }

    const pair = pairSelect.value;
    const tf = timeframeSelect.value;

    if (isForexModeClosed()) {
        showCustomAlert("market_closed");
        return;
    }

    if (isSignalActive || getCooldownRemainingMs(pair) > 0) {
        showCustomAlert(isSignalActive ? 'active' : 'cooldown');
        return;
    }
    
    isSignalActive = true;
    refreshSignalButton();

    const pairLabel = pairSelect ? getPairDisplayLabel(pair) : pair;
    
    // Clear previous signal UI
    if (pairFlags) pairFlags.textContent = "";
    if (cardPairFlags) cardPairFlags.textContent = "";
    if (metaPair) metaPair.textContent = "";
    if (metaTf) metaTf.textContent = "";
    if (metaTime) metaTime.textContent = "";
    if (metaAcc) metaAcc.textContent = "";
    if (metaDir) metaDir.textContent = "";
    if (metaUntil) metaUntil.textContent = "";
    setProgressPct(0);
    if (progressLabel) progressLabel.textContent = '';
    if (resultStamp) { resultStamp.textContent = ''; resultStamp.classList.add('hidden'); resultStamp.classList.remove('win','lose','neutral'); }
    const mainCard = document.getElementById('mainCard');
    if (mainCard) { mainCard.classList.remove('win-glow', 'lose-glow', 'neutral-glow', 'dir-up', 'dir-down'); }
    clearDirectionBorderClasses("all");
    
    if (isOTC) {
        try {
            await runSignalGeneration(() => Promise.resolve(), { pairLabel, tf, requireApiResult: false });

            const randomSignal = Math.random() > 0.5 ? "BUY" : "SELL";
            const randomConfidence = Math.floor(Math.random() * (92 - 75 + 1)) + 75;

            if (statusText) statusText.textContent = translations[currentLang].signal_found;
            if (pairFlags) pairFlags.innerHTML = flagsForPair(pair);
            if (cardPairFlags) cardPairFlags.innerHTML = flagsForPair(pair);
            if (metaPair) metaPair.textContent = pairLabel;
            if (metaTf) metaTf.textContent = tf;
            if (metaTime) metaTime.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            if (metaAcc) metaAcc.textContent = `${randomConfidence}%`;

            if (metaDir) {
                metaDir.textContent = randomSignal === "BUY" ? translations[currentLang].up : translations[currentLang].down;
                metaDir.classList.remove("up", "down");
                metaDir.classList.add(randomSignal === "BUY" ? "up" : "down");
                syncDirChip();
            }
            const dIcon = document.getElementById("dirIcon");
            if (dIcon) {
                dIcon.classList.remove("up", "down");
                dIcon.classList.add(randomSignal === "BUY" ? "up" : "down");
            }
            if (dirIconUse) dirIconUse.setAttribute("href", randomSignal === "BUY" ? "#icon-up" : "#icon-down");

            const tfSeconds = getSecondsFromTf(tf);
            const startTime = Date.now();
            const durationMs = Math.floor(tfSeconds * 1000);
            setSignalCooldownUntil(startTime + durationMs, pair);
            const untilDate = new Date(startTime + durationMs);
            if (metaUntil) metaUntil.textContent = untilDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            saveSignalState({
                type: "OTC",
                pair,
                pairLabel,
                tf,
                startTime,
                duration: durationMs,
                signal: randomSignal,
                confidence: randomConfidence,
                price: null
            });

            startSignalProgress(durationMs, startTime, () => {
                isSignalActive = false;
                clearSignalState();
                syncDirectionStyles();
                refreshSignalButton();
            });
        } catch (e) {
            isSignalActive = false;
            clearSignalState();
            clearSignalCooldown(pair);
            if (statusText) statusText.textContent = tKey("error");
            refreshSignalButton();
        }
        return;
    }

    try {
        const data = await runSignalGeneration(
            () => fetchForexSignal(pair, tf),
            { pairLabel, tf }
        );

        data.confidence = Math.floor(Math.random() * (92 - 75 + 1)) + 75;

        const tfSeconds = getSecondsFromTf(tf);
        const startTime = Date.now();
        const durationMs = Math.floor(tfSeconds * 1000);
        setSignalCooldownUntil(startTime + durationMs, pair);
        const untilDate = new Date(startTime + durationMs);

        const untilWrap = metaUntil?.closest(".dir-timer");
        if (untilWrap) untilWrap.classList.remove("hidden");

        applySignalDisplay({
            pair,
            pairLabel,
            tf,
            signal: data.signal,
            confidence: data.confidence,
            untilText: untilDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            timeStr: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            updateHome: true,
        });

        saveSignalState({
            type: "REGULAR",
            pair,
            pairLabel,
            tf,
            startTime,
            duration: durationMs,
            signal: data.signal,
            confidence: data.confidence,
            price: data.price,
            id: data.id,
        });

        startSignalProgress(durationMs, startTime, async () => {
            isSignalActive = false;
            clearSignalState();
            syncDirectionStyles();
            if (data.id) {
                try {
                    const checkResp = await apiFetch(`/signal/check?signal_id=${data.id}`, {
                        method: "POST",
                    });
                    if (checkResp.ok) {
                        const checkData = await checkResp.json();
                        applySignalResultUI(checkData.result);
                    }
                } catch (err) {
                    console.error("Failed to check result", err);
                }
            }
            
            refreshSignalButton();
            refreshProfileIfVisible();
        });

    } catch (e) {
        console.error("generateSignal failed", e);
        isSignalActive = false;
        clearSignalState();
        clearSignalCooldown(pair);
        refreshSignalButton();
        if (statusText) {
            statusText.textContent = e?.message && e.message !== "App access denied"
                ? e.message
                : tKey("error");
        }
    }
}

if (pairSelect) pairSelect.addEventListener("change", onPairChange);
if (timeframeSelect) timeframeSelect.addEventListener("change", onTimeframeChange);
if (getSignalBtn) getSignalBtn.addEventListener("click", generateSignal);
    // Custom Dropdown Logic
    function initCustomDropdown(container) {
        const select = container.querySelector('select');
        const trigger = container.querySelector('.select-trigger');
        if (!select || !trigger) return;
        if (select.id === 'pair' || select.id === 'timeframe') return;

        select.style.display = 'none';

        // Create custom list
        const list = document.createElement('div');
        list.className = 'dropdown-list';
        
        Array.from(select.options).forEach(opt => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            // Default text content
            item.textContent = opt.text;
            
            item.dataset.value = opt.value;
            if (opt.selected) item.classList.add('selected');

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                select.value = opt.value;
                select.dispatchEvent(new Event('change'));
                list.classList.remove('open');
                
                // Update selected class
                list.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
            });
            list.appendChild(item);
        });

        container.appendChild(list);

        // Toggle list
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close others
            document.querySelectorAll('.dropdown-list').forEach(l => {
                if (l !== list) l.classList.remove('open');
            });
            list.classList.toggle('open');
        });
    }

    function initCustomDropdowns() {
        // Native check removed to force custom dropdowns on all devices
        // const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        // if (isIOS) return; 

        document.querySelectorAll('.custom-select').forEach(container => {
            initCustomDropdown(container);
        });

        // Close on outside click
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-list').forEach(l => l.classList.remove('open'));
        });
    }

function restoreActiveSignal(options = {}) {
    const stored = localStorage.getItem(ACTIVE_SIGNAL_KEY);
    if (!stored) return;
    
    try {
        const state = JSON.parse(stored);
        const elapsed = Date.now() - state.startTime;

        if (options.fromPairSwitch && pairSelect && normalizePairKey(pairSelect.value) !== normalizePairKey(state.pair)) {
            return;
        }
        
        if (elapsed >= state.duration) {
            clearSignalState();
            isSignalActive = false;
            stopProgressTimer();
            setProgressPct(0);
            syncDirectionStyles();
            return;
        }
        
        if (!getSignalBtn || !progressBar) return;
        
        isSignalActive = true;
        setSignalCooldownUntil(state.startTime + state.duration, state.pair);
        refreshSignalButton();
        
        const mode = state.type === 'OTC' ? 'OTC' : 'Regular';
        setMarketMode(mode, { skipReconcile: true });

        if (pairSelect) {
            pairSelect.value = state.pair;
        }
        if (timeframeSelect) timeframeSelect.value = state.tf;

        updatePairTriggerDisplay();
        renderPairModalList();
        syncMarketUi();
        
        // Restore UI Texts (Meta)
        const pairLabel = state.pairLabel || state.pair;
        if (statusText) statusText.textContent = translations[currentLang].signal_found;
        if (pairFlags) pairFlags.innerHTML = flagsForPair(state.pair);
        if (cardPairFlags) cardPairFlags.innerHTML = flagsForPair(state.pair);
        if (metaPair) metaPair.textContent = pairLabel;
        if (metaTf) metaTf.textContent = state.tf;
        if (metaTime) metaTime.textContent = new Date(state.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (metaAcc) metaAcc.textContent = (typeof state.confidence !== 'undefined') ? `${Number(state.confidence).toFixed(0)}%` : '';
        
        if (metaDir) {
            metaDir.textContent = state.signal === 'BUY' ? translations[currentLang].up : (state.signal === 'SELL' ? translations[currentLang].down : '');
            metaDir.classList.remove('up','down');
            if (state.signal === 'BUY') metaDir.classList.add('up');
            if (state.signal === 'SELL') metaDir.classList.add('down');
            syncDirChip();
        }
        if (dirIcon) {
            dirIcon.classList.remove('up','down');
            if (state.signal === 'BUY') dirIcon.classList.add('up');
            if (state.signal === 'SELL') dirIcon.classList.add('down');
        }
        if (dirIconUse) dirIconUse.setAttribute('href', state.signal === 'BUY' ? '#icon-up' : '#icon-down');
        
        // Restore Until Time
        const tfSeconds = getSecondsFromTf(state.tf);
        const untilDate = new Date(state.startTime + tfSeconds * 1000);
        if (metaUntil) metaUntil.textContent = untilDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Resume Progress
        startSignalProgress(state.duration, state.startTime, async () => {
            isSignalActive = false;
            clearSignalState();
            syncDirectionStyles();
            
            if (state.type === 'OTC') {
                refreshSignalButton();
            } else {
                // Regular result check
                if (state.id) {
                    try {
                        const checkResp = await apiFetch(`/signal/check?signal_id=${state.id}`, {
                            method: "POST",
                        });
                        if (checkResp.ok) {
                            const checkData = await checkResp.json();
                            applySignalResultUI(checkData.result);
                        }
                    } catch (err) {
                        console.error("Failed to check result", err);
                    }
                }
                refreshSignalButton();
                refreshProfileIfVisible();
            }
        });
        
    } catch (e) {
        console.error("Failed to restore signal", e);
        clearSignalState();
        refreshSignalButton();
    }
}

// Initialize
initCustomDropdowns();
updatePairTriggerDisplay();
renderPairModalList();
updateIframe();
changeLanguage(currentLang);
restoreActiveSignal();
initCooldownFromStorage();
ensureMarketTicker();
refreshSignalButton();
refreshPhotoPageUi();
onAppResume();

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        onAppResume();
    }
});

const tg = getTelegramWebApp();
evaluateAppAccess();

if (tg) {
    try {
        tg.ready();
        tg.expand();
        // Request full screen if available
        if (tg.requestFullscreen) {
            tg.requestFullscreen();
        }
        let u = tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null;
        if (!u && tg.initData) {
            try {
                const params = new URLSearchParams(tg.initData);
                const userRaw = params.get('user');
                if (userRaw) u = JSON.parse(userRaw);
            } catch (_) {}
        }
        if (u) {
            tgUser = u;
            if (userInfo) {
                userInfo.textContent = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || `ID ${u.id}`;
            }
            apiFetch("/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: u.id,
                    username: u.username,
                    first_name: u.first_name,
                    last_name: u.last_name,
                    language_code: u.language_code,
                    is_premium: u.is_premium,
                }),
            }).catch(() => {});
            
            updateUserAvatar(u);
        }
        evaluateAppAccess();
        if (appAccessGranted) {
            verifySignalAccess();
        }
    } catch (_) {}
} else {
    evaluateAppAccess();
}

function updateUserAvatar(u) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || `ID ${u.id}`;
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=060912&color=93bbfd&size=128`;
    const src = u.photo_url
        || (u.username ? `https://unavatar.io/telegram/${u.username}` : fallback);

    [userAvatar, profileAvatar].forEach((img) => {
        if (!img) return;
        img.src = src;
        img.alt = name;
        img.onerror = () => {
            img.src = fallback;
        };
    });
}

function revokePhotoObjectUrl() {
    if (photoObjectUrl) {
        URL.revokeObjectURL(photoObjectUrl);
        photoObjectUrl = null;
    }
}

function setPhotoPreview(file) {
    revokePhotoObjectUrl();
    photoSelectedFile = file || null;

    if (!file) {
        cancelPhotoCardDismissTimer();
        dismissPhotoSignalCard({ animate: true });
        if (photoPreviewImg) {
            photoPreviewImg.removeAttribute("src");
            photoPreviewImg.classList.add("hidden");
        }
        photoClearBtn?.classList.add("hidden");
        updatePhotoPreviewLayers();
        refreshPhotoPageUi();
        return;
    }

    cancelPhotoCardDismissTimer();
    dismissPhotoSignalCard({ animate: true });
    photoObjectUrl = URL.createObjectURL(file);
    if (photoPreviewImg) {
        photoPreviewImg.src = photoObjectUrl;
        photoPreviewImg.classList.remove("hidden");
    }
    photoClearBtn?.classList.remove("hidden");
    updatePhotoPreviewLayers();
    refreshPhotoPageUi();
}

function clearPhotoSelection() {
    dismissPhotoSignalCard({ animate: true });
    setPhotoPreview(null);
    if (photoCameraInput) photoCameraInput.value = "";
    if (photoFileInput) photoFileInput.value = "";
}

/** Убирает превью после анализа; карточка сигнала и snapshot сохраняются. */
function releasePhotoAfterAnalysis() {
    revokePhotoObjectUrl();
    photoSelectedFile = null;
    if (photoPreviewImg) {
        photoPreviewImg.removeAttribute("src");
        photoPreviewImg.classList.add("hidden");
    }
    photoPreviewEmpty?.classList.remove("hidden");
    photoClearBtn?.classList.add("hidden");
    if (photoCameraInput) photoCameraInput.value = "";
    if (photoFileInput) photoFileInput.value = "";
    refreshPhotoPageUi();
}

function handlePhotoFileInput(file) {
    if (!file) return;
    if (isForexModeClosed()) return;
    if (!file.type.startsWith("image/") && !PHOTO_ACCEPT_TYPES.includes(file.type)) {
        showCustomAlert("photo_error_type");
        return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
        showCustomAlert("photo_error_size");
        return;
    }
    setPhotoPreview(file);
}

function loadPhotoSignalSnapshot() {
    try {
        const raw = localStorage.getItem(PHOTO_SIGNAL_SNAPSHOT_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function savePhotoSignalSnapshot(payload) {
    localStorage.setItem(PHOTO_SIGNAL_SNAPSHOT_KEY, JSON.stringify(payload));
}

function clearPhotoSignalSnapshot() {
    localStorage.removeItem(PHOTO_SIGNAL_SNAPSHOT_KEY);
}

function cancelPhotoCardDismissTimer() {
    if (photoCardDismissTimer) {
        clearTimeout(photoCardDismissTimer);
        photoCardDismissTimer = null;
    }
}

function dismissPhotoSignalCard({ animate = true } = {}) {
    cancelPhotoCardDismissTimer();
    clearPhotoSignalSnapshot();
    clearPhotoSignalCardPreview();
    showPhotoSignalCard(false, { animate });
    updatePhotoPreviewLayers();
}

function dismissPhotoSignalCardIfPairMismatch() {
    const snap = loadPhotoSignalSnapshot();
    if (!snap || !pairSelect) return;
    if (normalizePairKey(snap.pair) !== normalizePairKey(pairSelect.value)) {
        dismissPhotoSignalCard({ animate: true });
    }
}

function schedulePhotoCardDismissAfterSignalEnd() {
    cancelPhotoCardDismissTimer();
    photoCardDismissTimer = setTimeout(() => {
        photoCardDismissTimer = null;
        dismissPhotoSignalCard({ animate: true });
    }, PHOTO_CARD_DISMISS_AFTER_END_MS);
}

function persistPhotoSignalSnapshot(data) {
    savePhotoSignalSnapshot({
        pair: data.pair,
        pairLabel: data.pairLabel,
        tf: data.tf,
        signal: data.signal,
        confidence: data.confidence,
        untilText: data.untilText || "",
        timeStr: data.timeStr || "",
    });
}

function showPhotoSignalCard(show, { animate = true } = {}) {
    if (!photoSignalWrap) return;

    if (photoSignalHideTimer) {
        clearTimeout(photoSignalHideTimer);
        photoSignalHideTimer = null;
    }

    if (show) {
        photoSignalWrap.classList.remove("hidden");
        photoPreviewSlot?.classList.add("is-signal");
        if (!animate) {
            photoSignalWrap.classList.add("is-visible");
            return;
        }
        photoSignalWrap.classList.remove("is-visible");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                photoSignalWrap.classList.add("is-visible");
            });
        });
        return;
    }

    photoSignalWrap.classList.remove("is-visible");
    photoPreviewSlot?.classList.remove("is-signal");

    const finishHide = () => {
        photoSignalWrap.classList.add("hidden");
        updatePhotoPreviewLayers();
    };

    if (!animate || !photoSignalWrap.classList.contains("is-visible")) {
        finishHide();
        return;
    }

    photoSignalHideTimer = setTimeout(finishHide, PHOTO_CARD_ANIM_MS);
}

function updatePhotoPreviewLayers() {
    if (photoSignalWrap && !photoSignalWrap.classList.contains("hidden")) return;

    if (photoSelectedFile) {
        photoPreviewEmpty?.classList.add("hidden");
        photoPreviewImg?.classList.remove("hidden");
    } else {
        photoPreviewEmpty?.classList.remove("hidden");
        photoPreviewImg?.classList.add("hidden");
    }
}

function clearPhotoSignalCardPreview() {
    if (photoMetaAcc) photoMetaAcc.textContent = "--%";
    if (photoMetaDir) {
        photoMetaDir.textContent = "--";
        photoMetaDir.classList.remove("up", "down");
    }
    if (photoMetaUntil) photoMetaUntil.textContent = "--:--";
    if (photoStatusText && !isSignalActive && getCooldownRemainingMs() <= 0) {
        photoStatusText.textContent = tKey("waiting_status");
    }
    setProgressPct(0, "photo");
    if (photoResultStamp) {
        photoResultStamp.textContent = "";
        photoResultStamp.classList.add("hidden");
        photoResultStamp.classList.remove("win", "lose", "neutral");
    }
    if (photoMainCard) {
        photoMainCard.classList.remove("win-glow", "lose-glow", "neutral-glow", "dir-up", "dir-down");
    }
    clearDirectionBorderClasses("photo");
}

function applySignalDisplay({
    pair,
    pairLabel,
    tf,
    signal,
    confidence,
    untilText,
    timeStr,
    updateHome = true,
    updatePhoto = false,
}) {
    const flags = flagsForPair(pair);
    const isBuy = signal === "BUY";
    const isSell = signal === "SELL";
    const dirText = isBuy ? tKey("up") : isSell ? tKey("down") : "";
    const displayTime = timeStr || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const fill = ({
        flagsEl,
        pairEl,
        tfEl,
        accEl,
        dirEl,
        untilEl,
        statusEl,
        iconEl,
        iconUseEl,
    }) => {
        if (flagsEl) flagsEl.innerHTML = flags;
        if (pairEl) pairEl.textContent = pairLabel;
        if (tfEl) tfEl.textContent = tf;
        if (accEl) accEl.textContent = `${Number(confidence).toFixed(0)}%`;
        if (untilEl && untilText) untilEl.textContent = untilText;
        if (statusEl) statusEl.textContent = tKey("signal_found");
        if (dirEl) {
            dirEl.textContent = dirText;
            dirEl.classList.remove("up", "down");
            if (isBuy) dirEl.classList.add("up");
            if (isSell) dirEl.classList.add("down");
        }
        if (iconEl) {
            iconEl.classList.remove("up", "down");
            if (isBuy) iconEl.classList.add("up");
            if (isSell) iconEl.classList.add("down");
        }
        if (iconUseEl) iconUseEl.setAttribute("href", isBuy ? "#icon-up" : "#icon-down");
    };

    if (updateHome) {
        fill({
            flagsEl: cardPairFlags,
            pairEl: metaPair,
            tfEl: metaTf,
            accEl: metaAcc,
            dirEl: metaDir,
            untilEl: metaUntil,
            statusEl: statusText,
            iconEl: dirIcon,
            iconUseEl: dirIconUse,
        });
        if (metaTime) metaTime.textContent = displayTime;
    }

    if (updatePhoto) {
        fill({
            flagsEl: photoCardPairFlags,
            pairEl: photoMetaPair,
            tfEl: photoMetaTf,
            accEl: photoMetaAcc,
            dirEl: photoMetaDir,
            untilEl: photoMetaUntil,
            statusEl: photoStatusText,
            iconEl: photoDirIcon,
            iconUseEl: photoDirIconUse,
        });
        persistPhotoSignalSnapshot({
            pair,
            pairLabel,
            tf,
            signal,
            confidence,
            untilText,
            timeStr: displayTime,
        });
        showPhotoSignalCard(true);
        releasePhotoAfterAnalysis();
    }

    syncDirectionStyles();
}

function restorePhotoSignalCardFromSnapshot() {
    const snap = loadPhotoSignalSnapshot();
    if (!snap) {
        showPhotoSignalCard(false, { animate: false });
        return;
    }

    if (pairSelect && normalizePairKey(snap.pair) !== normalizePairKey(pairSelect.value)) {
        dismissPhotoSignalCard({ animate: false });
        return;
    }

    applySignalDisplay({
        pair: snap.pair,
        pairLabel: snap.pairLabel || snap.pair,
        tf: snap.tf,
        signal: snap.signal,
        confidence: snap.confidence,
        untilText: snap.untilText,
        timeStr: snap.timeStr,
        updateHome: false,
        updatePhoto: false,
    });
    showPhotoSignalCard(true, { animate: false });
    if (photoStatusText) photoStatusText.textContent = tKey("signal_found");
    setProgressPct(100, "photo");
    syncDirectionStyles();
}

function initPhotoPage() {
    syncMarketToggleUi();
    updatePairTriggerDisplay();
    updateTfTriggerDisplay();
    refreshPhotoPageUi();
    restorePhotoSignalCardFromSnapshot();
}

async function analyzePhotoChart() {
    if (!appAccessGranted) {
        evaluateAppAccess();
        return;
    }
    if (!signalAccessGranted) {
        await verifySignalAccess();
        if (!signalAccessGranted) return;
    }
    if (!photoSelectedFile) return;

    const { pair, pairLabel, tf } = getPhotoAnalysisParams();

    if (isForexModeClosed()) {
        showCustomAlert("market_closed");
        return;
    }

    if (isSignalActive || getCooldownRemainingMs(pair) > 0) {
        showCustomAlert(isSignalActive ? "active" : "cooldown");
        return;
    }

    isSignalActive = true;
    refreshSignalButton();
    cancelPhotoCardDismissTimer();
    showPhotoSignalCard(false, { animate: false });

    if (photoResultStamp) {
        photoResultStamp.textContent = "";
        photoResultStamp.classList.add("hidden");
        photoResultStamp.classList.remove("win", "lose", "neutral");
    }
    if (photoMainCard) {
        photoMainCard.classList.remove("win-glow", "lose-glow", "neutral-glow", "dir-up", "dir-down");
    }
    clearDirectionBorderClasses("all");
    setProgressPct(0, "photo");

    const onPhotoProgressEnd = (afterFinish) => {
        isSignalActive = false;
        clearSignalState();
        if (photoStatusText) photoStatusText.textContent = tKey("signal_found");
        setProgressPct(100, "photo");
        syncDirectionStyles();
        refreshSignalButton();
        refreshPhotoPageUi();
        schedulePhotoCardDismissAfterSignalEnd();
        if (afterFinish) afterFinish();
    };

    if (isOTC) {
        try {
            await runSignalGeneration(() => Promise.resolve(), { pairLabel, tf, requireApiResult: false });

            const randomSignal = Math.random() > 0.5 ? "BUY" : "SELL";
            const randomConfidence = Math.floor(Math.random() * (92 - 75 + 1)) + 75;
            const startTime = Date.now();
            const durationMs = Math.floor(getSecondsFromTf(tf) * 1000);
            const untilDate = new Date(startTime + durationMs);
            setSignalCooldownUntil(startTime + durationMs, pair);

            const displayPayload = {
                pair,
                pairLabel,
                tf,
                signal: randomSignal,
                confidence: randomConfidence,
                untilText: untilDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                timeStr: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            };

            applySignalDisplay({
                ...displayPayload,
                updateHome: true,
                updatePhoto: true,
            });

            saveSignalState({
                type: "OTC",
                pair,
                pairLabel,
                tf,
                startTime,
                duration: durationMs,
                signal: randomSignal,
                confidence: randomConfidence,
                price: null,
                source: "photo",
            });

            startSignalProgress(durationMs, startTime, () => onPhotoProgressEnd(), "photo");
        } catch {
            isSignalActive = false;
            clearSignalState();
            clearSignalCooldown(pair);
            if (photoStatusText) photoStatusText.textContent = tKey("error");
            refreshSignalButton();
            refreshPhotoPageUi();
        }
        return;
    }

    try {
        const data = await runSignalGeneration(
            () => fetchForexSignal(pair, tf),
            { pairLabel, tf }
        );

        data.confidence = Math.floor(Math.random() * (92 - 75 + 1)) + 75;

        const startTime = Date.now();
        const durationMs = Math.floor(getSecondsFromTf(tf) * 1000);
        const untilDate = new Date(startTime + durationMs);
        setSignalCooldownUntil(startTime + durationMs, pair);

        const displayPayload = {
            pair,
            pairLabel,
            tf,
            signal: data.signal,
            confidence: data.confidence,
            untilText: untilDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            timeStr: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        applySignalDisplay({
            ...displayPayload,
            updateHome: true,
            updatePhoto: true,
        });

        saveSignalState({
            type: "REGULAR",
            pair,
            pairLabel,
            tf,
            startTime,
            duration: durationMs,
            signal: data.signal,
            confidence: data.confidence,
            price: data.price,
            id: data.id,
            source: "photo",
        });

        startSignalProgress(durationMs, startTime, async () => {
            onPhotoProgressEnd(async () => {
                if (data.id) {
                    try {
                        const checkResp = await apiFetch(`/signal/check?signal_id=${data.id}`, {
                            method: "POST",
                        });
                        if (checkResp.ok) {
                            const checkData = await checkResp.json();
                            applySignalResultUI(checkData.result);
                        }
                    } catch (err) {
                        console.error("Failed to check result", err);
                    }
                }
                refreshProfileIfVisible();
            });
        }, "photo");
    } catch {
        isSignalActive = false;
        clearSignalState();
        clearSignalCooldown(pair);
        if (photoStatusText) photoStatusText.textContent = tKey("error");
        refreshSignalButton();
        refreshPhotoPageUi();
    }
}

function onPhotoAnalyzeClick() {
    analyzePhotoChart();
}

function updateBackButton() {
    if (!tg || !tg.BackButton) return;
    if (currentView === "profile" || currentView === "photo") {
        tg.BackButton.show();
    } else {
        tg.BackButton.hide();
    }
}

function switchView(view) {
    if (view !== "home" && view !== "profile" && view !== "photo") return;
    currentView = view;

    if (homeView) homeView.classList.toggle("hidden", view !== "home");
    if (photoView) photoView.classList.toggle("hidden", view !== "photo");
    if (profileView) profileView.classList.toggle("hidden", view !== "profile");

    document.querySelectorAll(".bottom-nav .nav-item").forEach((item) => {
        item.classList.toggle("active", item.getAttribute("data-view") === view);
    });

    if (view === "profile") {
        loadProfilePage();
    }
    if (view === "photo") {
        initPhotoPage();
    }

    updateBackButton();
}

document.querySelectorAll(".bottom-nav .nav-item").forEach((item) => {
    item.addEventListener("click", () => {
        const view = item.getAttribute("data-view");
        if (view) switchView(view);
    });
});

photoCaptureBtn?.addEventListener("click", () => {
    if (isForexModeClosed()) return;
    photoCameraInput?.click();
});
photoUploadBtn?.addEventListener("click", () => {
    if (isForexModeClosed()) return;
    photoFileInput?.click();
});
photoCameraInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    handlePhotoFileInput(file);
});
photoFileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    handlePhotoFileInput(file);
});
photoClearBtn?.addEventListener("click", clearPhotoSelection);
photoAnalyzeBtn?.addEventListener("click", onPhotoAnalyzeClick);

if (tg && tg.BackButton) {
    tg.BackButton.onClick(() => {
        if (currentView === "profile" || currentView === "photo") switchView("home");
    });
}
updateBackButton();

// Language Modal Logic
function showLangModal() {
    if (langModal) {
        langModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function hideLangModal() {
    if (langModal) {
        langModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function showCustomAlert(reason = 'active') {
    const descEl = alertModal?.querySelector('.alert-desc');
    const titleEl = alertModal?.querySelector('.alert-title');
    if (descEl) {
        if (reason === 'cooldown') {
            if (titleEl) titleEl.textContent = tKey('alert_title');
            descEl.textContent = `${tKey('alert_cooldown_desc')} ${formatCooldownButton(getCooldownRemainingMs())}.`;
        } else if (reason === 'market_closed') {
            const openAt = getNextForexOpenDate();
            if (titleEl) titleEl.textContent = tKey('market_closed_status');
            descEl.textContent = openAt
                ? `${tKey('market_closed_alert')} ${tKey('market_closed_btn')} ${formatMarketOpenDate(openAt)}.`
                : tKey('market_closed_alert');
        } else if (
            reason === 'photo_analyze_soon' ||
            reason === 'photo_error_type' ||
            reason === 'photo_error_size'
        ) {
            if (titleEl) titleEl.textContent = tKey('photo_page_title');
            descEl.textContent = tKey(reason);
        } else {
            if (titleEl) titleEl.textContent = tKey('alert_title');
            descEl.textContent = tKey('alert_desc');
        }
    }
    if (alertModal) {
        alertModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function hideCustomAlert() {
    const descEl = alertModal?.querySelector('.alert-desc');
    const titleEl = alertModal?.querySelector('.alert-title');
    if (titleEl) {
        titleEl.setAttribute('data-i18n', 'alert_title');
        titleEl.textContent = tKey('alert_title');
    }
    if (descEl) {
        descEl.setAttribute('data-i18n', 'alert_desc');
        descEl.textContent = tKey('alert_desc');
    }
    if (alertModal) {
        alertModal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function changeLanguage(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('trade_ai_lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (translations[lang][key]) {
            el.textContent = translations[lang][key];
        }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (translations[lang][key]) {
            el.setAttribute('placeholder', translations[lang][key]);
        }
    });

    updateLangBtnFlag(lang);
    refreshSignalButton();
    refreshPhotoPageUi();

    if (spinnerOverlay && !spinnerOverlay.classList.contains("hidden")) {
        void showSignalStepText(signalCurrentStepIndex, { animate: false });
        setSignalProgress(getSignalStepPercent(signalCurrentStepIndex));
        setSignalVisualStep(signalCurrentStepIndex);
    }

    document.querySelectorAll('.lang-item').forEach(item => {
        if (item.getAttribute('data-lang') === lang) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

if (langBtn) langBtn.addEventListener('click', showLangModal);
if (closeLangBtn) closeLangBtn.addEventListener('click', hideLangModal);
if (langModal) langModal.addEventListener('click', (e) => { if (e.target === langModal) hideLangModal(); });

if (pairSelectTrigger) pairSelectTrigger.addEventListener('click', showPairModal);
if (closePairBtn) closePairBtn.addEventListener('click', hidePairModal);
if (pairModal) pairModal.addEventListener('click', (e) => { if (e.target === pairModal) hidePairModal(); });

if (tfSelectTrigger) tfSelectTrigger.addEventListener('click', showTfModal);
if (closeTfBtn) closeTfBtn.addEventListener('click', hideTfModal);
if (tfModal) tfModal.addEventListener('click', (e) => { if (e.target === tfModal) hideTfModal(); });
if (pairSearchInput) {
    pairSearchInput.addEventListener('input', (e) => filterPairModalList(e.target.value));
    pairSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hidePairModal();
    });
}

if (closeAlertBtn) closeAlertBtn.addEventListener('click', hideCustomAlert);
if (alertModal) alertModal.addEventListener('click', (e) => { if (e.target === alertModal) hideCustomAlert(); });

document.querySelectorAll('.lang-item').forEach(item => {
    item.addEventListener('click', () => {
        document.querySelectorAll('.lang-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
        const langCode = item.getAttribute('data-lang');
        changeLanguage(langCode);
        hideLangModal();
    });
});

// header profile button removed per mobile design

const profileRoot = document.getElementById('profileRoot');
let currentHistoryPeriod = 'today';

function applySignalResultUI(resultStatus) {
    const key = resultStatus.toLowerCase();

    const applyTo = (stampEl, cardEl) => {
        if (stampEl) {
            stampEl.textContent = tKey(key);
            stampEl.classList.remove("hidden", "win", "lose", "neutral");
            stampEl.classList.add(key);
        }
        if (cardEl) {
            cardEl.classList.remove("win-glow", "lose-glow", "neutral-glow", "dir-up", "dir-down");
            cardEl.classList.add(`${key}-glow`);
        }
    };

    applyTo(resultStamp, document.getElementById("mainCard"));
    applyTo(photoResultStamp, photoMainCard);
    syncDirectionStyles();
}

function refreshProfileIfVisible() {
    if (currentView === 'profile') loadProfilePage();
}

function formatHistoryTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(String(ts).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return ts;
    return d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getHistoryResultMeta(result) {
    if (!result) return { className: 'pending', label: tKey('history_active') };
    const key = String(result).toLowerCase();
    if (key === 'win' || key === 'lose' || key === 'neutral') {
        return { className: key, label: tKey(key) };
    }
    return { className: 'pending', label: result };
}

function setProfileStatsLoading() {
    const totalEl = document.getElementById('totalSignals');
    const winCountEl = document.getElementById('winCount');
    const winRateEl = document.getElementById('winRate');
    if (totalEl) totalEl.textContent = '0';
    if (winCountEl) winCountEl.textContent = '0';
    if (winRateEl) winRateEl.textContent = '0%';
}

async function loadProfilePage() {
    if (!profileRoot) return;

    if (!profileTabsInitialized) {
        profileTabsInitialized = true;
        const tabs = document.querySelectorAll('.filter-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentHistoryPeriod = tab.getAttribute('data-period');
                fetchHistory();
            });
        });
    }

    const uName = document.getElementById('profileName');
    const uSub = document.getElementById('userSubtitle');

    if (tgUser) {
        const fullName = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'User';
        if (uName) uName.textContent = fullName;
        if (uSub) {
            uSub.textContent = tgUser.username ? `@${tgUser.username}` : '@username';
        }
        updateUserAvatar(tgUser);
        setProfileStatsLoading();

        try {
            const s = await apiFetch("/stats/user");
            if (s.ok) {
                const stats = await s.json();
                const totalEl = document.getElementById('totalSignals');
                const winCountEl = document.getElementById('winCount');
                const winRateEl = document.getElementById('winRate');
                if (totalEl) totalEl.textContent = String(stats.total_signals ?? 0);
                if (winCountEl) winCountEl.textContent = String(stats.wins ?? 0);
                if (winRateEl) winRateEl.textContent = `${stats.win_rate ?? 0}%`;
            }
        } catch (_) {}

        await fetchHistory();
    } else {
        if (uName) uName.textContent = 'Guest';
        if (uSub) uSub.textContent = '@username';
        setProfileStatsLoading();
        const container = document.getElementById('historyList');
        if (container) {
            container.innerHTML = `<div class="profile-guest-hint">${tKey('profile_guest')}</div>`;
        }
    }
}

async function fetchHistory() {
    const container = document.getElementById('historyList');
    if (!tgUser || !container) return;

    container.innerHTML = `<div class="profile-loading">${tKey('history_loading')}</div>`;

    try {
        const h = await apiFetch(`/history/user?limit=50&period=${encodeURIComponent(currentHistoryPeriod)}`);
        if (h.ok) {
            const rows = await h.json();
            renderHistoryCards(rows);
        } else {
            container.innerHTML = `<div class="profile-empty">${tKey('history_empty')}</div>`;
        }
    } catch (_) {
        container.innerHTML = `<div class="profile-empty">${tKey('history_empty')}</div>`;
    }
}

function renderHistoryCards(rows) {
    const container = document.getElementById('historyList');
    if (!container) return;
    
    if (!rows.length) {
        container.innerHTML = `<div class="profile-empty">${tKey('history_empty')}</div>`;
        return;
    }

    container.innerHTML = rows.map(r => {
        const { className: resClass, label: resText } = getHistoryResultMeta(r.result);
        const pairLabel = getPairDisplayLabel(r.pair);
        const dirClass = r.signal === 'SELL' ? 'sell' : 'buy';
        const dirLabel = r.signal === 'SELL' ? tKey('down') : tKey('up');

        return `
        <article class="history-card">
            <div class="hc-top">${formatHistoryTimestamp(r.timestamp)}</div>
            <div class="hc-main">
                <div class="hc-pair-info">
                    <span class="hc-flags">${flagsForPair(r.pair)}</span>
                    <span class="hc-pair-name">${pairLabel}</span>
                </div>
                <div class="hc-center">
                    <span class="hc-tf">${r.timeframe || '—'}</span>
                    <span class="hc-dir ${dirClass}">${dirLabel}</span>
                </div>
                <div class="hc-status ${resClass}">${resText}</div>
            </div>
        </article>
        `;
    }).join('');
}

// Helper for flags (reusing existing logic if available or duplicating slightly for safety)
// Assuming flagsForPair is globally available from earlier script content.
// If not, I'll ensure it is.
// Based on previous reads, flagsForPair is defined in global scope.

function getCurrencyCountryCode(cur) {
    const m = {
        EUR: 'eu', USD: 'us', GBP: 'gb', JPY: 'jp', CHF: 'ch', CAD: 'ca', AUD: 'au', NZD: 'nz'
    };
    return m[cur] || null;
}

function flagsForPair(pair) {
    // Clean pair string from OTC suffix
    const cleanPair = pair.replace(' OTC', '');
    const base = cleanPair.slice(0,3);
    const quote = cleanPair.slice(3,6);
    const baseCode = getCurrencyCountryCode(base);
    const quoteCode = getCurrencyCountryCode(quote);
    
    if (baseCode && quoteCode) {
        return `
        <div class="pair-icons">
            ${flagImgTag(baseCode, "currency-icon base", base)}
            ${flagImgTag(quoteCode, "currency-icon quote", quote)}
        </div>
        `;
    }
    // Fallback to emojis if not found
    return `${flagForCurrency(base)} ${flagForCurrency(quote)}`.trim();
}

function flagForCurrency(cur) {
    const m = {
        EUR: '🇪🇺', USD: '🇺🇸', GBP: '🇬🇧', JPY: '🇯🇵', CHF: '🇨🇭', CAD: '🇨🇦', AUD: '🇦🇺', NZD: '🇳🇿'
    };
    return m[cur] || '';
}
