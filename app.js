'use strict';

(function () {
  const APP_VERSION = 'v1.2.1';
  const STORAGE_KEY = 'worry_diary_items_v1';
  const GRATITUDE_STORAGE_KEY = 'worry_diary_gratitudes_v1';
  const PRIMING_STORAGE_KEY = 'worry_diary_priming_v1';
  const PRIMING_LIKES_STORAGE_KEY = 'worry_diary_priming_likes_v1';

  const DEFAULT_PRIMING_WORDS = [
    '心配事のほとんどは実際には起こらないから大丈夫だよ。',
    'コントロールできることだけに力を注ごう。',
    '小さな一歩で十分。完璧じゃなくていい。',
    '今ここにある小さな感謝に目を向けてみよう。',
    '今日もここまでよくやっている。自分をねぎらおう。',
    '起きてもいない未来より、今の自分の心地よさを大切に。',
    '深呼吸をひとつ。肩の力を抜いて始めよう。',
    '過去の自分も、きっと今のあなたを応援している。',
    '「なんとかなる」と思えた瞬間から、心は軽くなる。',
    '今日は誰のどんな優しさに気づけるだろう。',
    '不安は頭の中から紙に預けて、心を手ぶらにしよう。',
    '今日という日は、新しい小さな発見に満ちている。',
    'うまくいかない日があっても、あなたの価値は変わらない。',
    '「今、この瞬間」だけに集中すれば、大抵のことは乗り越えられる。',
    '比べなくていい。昨日の自分より少しだけ前へ。',
    '迷ったら、心が少しでもほっとする方を選ぼう。',
    'ありがたいことに気づくたび、心は少しずつ豊かになる。',
    '起きたことは事実、それをどう受け止めるかは自分で選べる。',
    '焦らなくて大丈夫。今のペースがあなたにとってちょうどいい。',
    '苦手なことより、今日できた小さなことを数えてみよう。',
    '誰かの笑顔や親切に、今日は心の中で「ありがとう」と言ってみよう。',
    '休むことも、前に進むための大切な行動のひとつ。',
    '心配は「備え」ができたら、もう手放していい。',
    '自分の機嫌を少しだけ良くすることを、今日はひとつやってみよう。',
    '言葉に出したり書き出したりするだけで、不安は半分くらい小さくなる。',
    '今日出会う人にも、自分にも、少しだけ優しく接してみよう。',
    '未来の自分なら、今の悩みも笑って振り返っているかもしれない。',
    '当たり前のようにある日常の中にも、感謝できることはたくさんある。',
    'できることからひとつずつ。全部いっぺんにやらなくていい。',
    '今日もあなたのペースで、穏やかな一日を過ごせますように。'
  ];

  const OUTCOMES = {
    did_not_happen: {
      label: '🌿 実際に起こらなかった（取り越し苦労だった）',
      shortLabel: '🌿 起こらなかった',
      isPeaceful: true
    },
    not_bad: {
      label: '🌤️ 起こったが、大したことはなかった',
      shortLabel: '🌤️ 大したことなかった',
      isPeaceful: true
    },
    handled_well: {
      label: '✨ 起こったが、うまく対応できた',
      shortLabel: '✨ うまく対応できた',
      isPeaceful: true
    },
    actually_hard: {
      label: '🌧️ 予想通り大変だった（対応に苦労した）',
      shortLabel: '🌧️ 予想通り大変だった',
      isPeaceful: false
    }
  };

  const ALLOWED_OUTCOME_KEYS = Object.keys(OUTCOMES);

  // State
  let worries = [];
  let gratitudes = [];
  let customPrimingWords = [];
  let primingLikes = {}; // { [word]: { count: number, lastLikedDate: string | null } }
  let currentMode = 'worry'; // 'worry' | 'gratitude'
  let currentFilter = 'active';
  let filterKind = 'all'; // 'all' | 'worry' | 'gratitude'
  let filterYear = 'all';
  let filterMonth = 'all';
  let calendarYear = new Date().getFullYear();
  let calendarMonth = new Date().getMonth(); // 0-indexed
  let selectedDateStr = getTodayDateStr();
  let pendingDeleteTarget = null; // { type: 'worry' | 'gratitude', id: string }
  let currentPrimingIndex = 0;

  // Helpers
  function getTodayDateStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function isValidDateStr(str) {
    return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
  }

  function formatDisplayDate(dateStr) {
    if (!isValidDateStr(dateStr)) return '';
    const parts = dateStr.split('-');
    return `${Number(parts[0])}年${Number(parts[1])}月${Number(parts[2])}日`;
  }

  function generateId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'w_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function sanitizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' && raw.id.length <= 100 ? raw.id : generateId();
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 300) : '';
    if (!title) return null;

    const registeredDate = isValidDateStr(raw.registeredDate)
      ? raw.registeredDate
      : getTodayDateStr();

    const status = raw.status === 'resolved' ? 'resolved' : 'active';
    const outcome =
      status === 'resolved' && ALLOWED_OUTCOME_KEYS.includes(raw.outcome)
        ? raw.outcome
        : status === 'resolved'
        ? 'did_not_happen'
        : null;

    const note =
      typeof raw.note === 'string' ? raw.note.trim().slice(0, 500) : '';

    const resolvedDate =
      status === 'resolved' && isValidDateStr(raw.resolvedDate)
        ? raw.resolvedDate
        : status === 'resolved'
        ? registeredDate
        : null;

    const createdAt =
      typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : Date.now();

    return {
      id,
      title,
      registeredDate,
      status,
      outcome,
      note,
      resolvedDate,
      createdAt
    };
  }

  function loadWorries() {
    try {
      const rawJson = localStorage.getItem(STORAGE_KEY);
      if (!rawJson) {
        worries = [];
        return;
      }
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        worries = [];
        return;
      }
      worries = parsed.map(sanitizeItem).filter(Boolean);
    } catch (_err) {
      worries = [];
    }
  }

  function saveWorries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(worries));
    } catch (_err) {
      showToast('保存容量の上限に達している可能性があります');
    }
  }

  function sanitizeGratitude(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = typeof raw.id === 'string' && raw.id.length <= 100 ? raw.id : generateId();
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 300) : '';
    if (!title) return null;
    const registeredDate = isValidDateStr(raw.registeredDate)
      ? raw.registeredDate
      : getTodayDateStr();
    const createdAt =
      typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : Date.now();
    return { id, title, registeredDate, createdAt };
  }

  function loadGratitudes() {
    try {
      const rawJson = localStorage.getItem(GRATITUDE_STORAGE_KEY);
      if (!rawJson) {
        gratitudes = [];
        return;
      }
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        gratitudes = [];
        return;
      }
      gratitudes = parsed.map(sanitizeGratitude).filter(Boolean);
    } catch (_err) {
      gratitudes = [];
    }
  }

  function saveGratitudes() {
    try {
      localStorage.setItem(GRATITUDE_STORAGE_KEY, JSON.stringify(gratitudes));
    } catch (_err) {
      showToast('保存容量の上限に達している可能性があります');
    }
  }

  function loadCustomPrimingWords() {
    try {
      const rawJson = localStorage.getItem(PRIMING_STORAGE_KEY);
      if (!rawJson) {
        customPrimingWords = [];
        return;
      }
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        customPrimingWords = [];
        return;
      }
      customPrimingWords = parsed
        .filter((s) => typeof s === 'string')
        .map((s) => s.trim().slice(0, 120))
        .filter(Boolean);
    } catch (_err) {
      customPrimingWords = [];
    }
  }

  function saveCustomPrimingWords() {
    try {
      localStorage.setItem(PRIMING_STORAGE_KEY, JSON.stringify(customPrimingWords));
    } catch (_err) {
      showToast('保存容量の上限に達している可能性があります');
    }
  }

  function getAllPrimingWords() {
    return DEFAULT_PRIMING_WORDS.concat(customPrimingWords);
  }

  function loadPrimingLikes() {
    try {
      const rawJson = localStorage.getItem(PRIMING_LIKES_STORAGE_KEY);
      if (!rawJson) {
        primingLikes = {};
        return;
      }
      const parsed = JSON.parse(rawJson);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        primingLikes = {};
        return;
      }
      const clean = {};
      Object.keys(parsed).forEach((key) => {
        const entry = parsed[key];
        if (entry && typeof entry === 'object') {
          const count =
            typeof entry.count === 'number' && Number.isFinite(entry.count) && entry.count >= 0
              ? Math.floor(entry.count)
              : 0;
          const lastLikedDate = isValidDateStr(entry.lastLikedDate)
            ? entry.lastLikedDate
            : null;
          clean[key] = { count, lastLikedDate };
        }
      });
      primingLikes = clean;
    } catch (_err) {
      primingLikes = {};
    }
  }

  function savePrimingLikes() {
    try {
      localStorage.setItem(PRIMING_LIKES_STORAGE_KEY, JSON.stringify(primingLikes));
    } catch (_err) {
      // ignore storage errors
    }
  }

  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = String(message);
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 2600);
  }

  // DOM Builders (Strictly using createElement & textContent, never innerHTML)
  function createWorryCardElement(item) {
    const card = document.createElement('article');
    card.className = 'worry-card' + (item.status === 'resolved' ? ' resolved' : '');

    // Top row: registered date & status chip
    const topRow = document.createElement('div');
    topRow.className = 'worry-card-top';

    const dateBadge = document.createElement('span');
    dateBadge.className = 'worry-date-badge';
    dateBadge.textContent = `📅 登録日: ${formatDisplayDate(item.registeredDate)}`;

    const statusChip = document.createElement('span');
    statusChip.className = 'status-chip ' + item.status;
    statusChip.textContent = item.status === 'resolved' ? '終了済み' : '心配中';

    topRow.appendChild(dateBadge);
    topRow.appendChild(statusChip);
    card.appendChild(topRow);

    // Title
    const titleEl = document.createElement('p');
    titleEl.className = 'worry-title-text';
    titleEl.textContent = item.title;
    card.appendChild(titleEl);

    // Outcome details if resolved
    if (item.status === 'resolved' && item.outcome && OUTCOMES[item.outcome]) {
      const outcomeInfo = OUTCOMES[item.outcome];
      const outcomeBox = document.createElement('div');
      outcomeBox.className = 'outcome-box ' + item.outcome;

      const outcomeLabel = document.createElement('span');
      outcomeLabel.className = 'outcome-label-text';
      outcomeLabel.textContent = `結末: ${outcomeInfo.label}`;
      outcomeBox.appendChild(outcomeLabel);

      if (item.note) {
        const noteEl = document.createElement('p');
        noteEl.className = 'outcome-note-text';
        noteEl.textContent = `📝 ${item.note}`;
        outcomeBox.appendChild(noteEl);
      }
      card.appendChild(outcomeBox);
    }

    // Action buttons
    const actionsRow = document.createElement('div');
    actionsRow.className = 'worry-card-actions';

    if (item.status === 'active') {
      const resolveBtn = document.createElement('button');
      resolveBtn.type = 'button';
      resolveBtn.className = 'btn-resolve';
      resolveBtn.textContent = '✓ 結末を選んで終了';
      resolveBtn.addEventListener('click', () => openResolveModal(item.id));
      actionsRow.appendChild(resolveBtn);
    } else {
      const editOutcomeBtn = document.createElement('button');
      editOutcomeBtn.type = 'button';
      editOutcomeBtn.className = 'btn-reopen';
      editOutcomeBtn.textContent = '結末を編集';
      editOutcomeBtn.addEventListener('click', () => openResolveModal(item.id));
      actionsRow.appendChild(editOutcomeBtn);

      const reopenBtn = document.createElement('button');
      reopenBtn.type = 'button';
      reopenBtn.className = 'btn-reopen';
      reopenBtn.textContent = '心配中に戻す';
      reopenBtn.addEventListener('click', () => reopenWorry(item.id));
      actionsRow.appendChild(reopenBtn);
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-icon-delete';
    deleteBtn.setAttribute('aria-label', '削除');
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => openDeleteModal(item.id, 'worry'));
    actionsRow.appendChild(deleteBtn);

    card.appendChild(actionsRow);
    return card;
  }

  function createGratitudeCardElement(item) {
    const card = document.createElement('article');
    card.className = 'worry-card gratitude';

    const topRow = document.createElement('div');
    topRow.className = 'worry-card-top';

    const dateBadge = document.createElement('span');
    dateBadge.className = 'worry-date-badge';
    dateBadge.textContent = `🌸 登録日: ${formatDisplayDate(item.registeredDate)}`;

    const statusChip = document.createElement('span');
    statusChip.className = 'status-chip gratitude';
    statusChip.textContent = '感謝の言葉';

    topRow.appendChild(dateBadge);
    topRow.appendChild(statusChip);
    card.appendChild(topRow);

    const titleEl = document.createElement('p');
    titleEl.className = 'worry-title-text';
    titleEl.textContent = item.title;
    card.appendChild(titleEl);

    const actionsRow = document.createElement('div');
    actionsRow.className = 'worry-card-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-icon-delete';
    deleteBtn.setAttribute('aria-label', '削除');
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', () => openDeleteModal(item.id, 'gratitude'));
    actionsRow.appendChild(deleteBtn);

    card.appendChild(actionsRow);
    return card;
  }

  function renderBannerAndStats() {
    const totalCount = worries.length;
    const activeCount = worries.filter((w) => w.status === 'active').length;
    const resolvedItems = worries.filter((w) => w.status === 'resolved');
    const resolvedCount = resolvedItems.length;

    const notHappenedCount = resolvedItems.filter(
      (w) => w.outcome === 'did_not_happen'
    ).length;

    const copedCount = resolvedItems.filter(
      (w) => w.outcome === 'not_bad' || w.outcome === 'handled_well'
    ).length;

    const peacefulCount = notHappenedCount + copedCount;

    const notHappenedRateText =
      resolvedCount > 0
        ? `${Math.round((notHappenedCount / resolvedCount) * 100)}%`
        : '--%';

    const copedRateText =
      resolvedCount > 0
        ? `${Math.round((copedCount / resolvedCount) * 100)}%`
        : '--%';

    const peaceRateText =
      resolvedCount > 0
        ? `${Math.round((peacefulCount / resolvedCount) * 100)}%`
        : '--%';

    // Top Banner
    const bannerNotHappened = document.getElementById('banner-not-happened-rate');
    const bannerCoped = document.getElementById('banner-coped-rate');
    const bannerCaption = document.getElementById('banner-peace-caption');

    if (bannerNotHappened) bannerNotHappened.textContent = notHappenedRateText;
    if (bannerCoped) bannerCoped.textContent = copedRateText;
    if (bannerCaption) {
      if (resolvedCount === 0) {
        bannerCaption.textContent =
          '心配事をリストに預けて、結果がわかったらプルダウンで記録しましょう';
      } else {
        bannerCaption.textContent = `終了 ${resolvedCount}件中：起こらなかった ${notHappenedCount}件 ／ 起こったけど大丈夫 ${copedCount}件（計 ${peaceRateText}）`;
      }
    }

    // Filter Badges
    const countActiveEl = document.getElementById('count-active');
    const countResolvedEl = document.getElementById('count-resolved');
    const countAllEl = document.getElementById('count-all');
    const countGratitudeEl = document.getElementById('count-gratitude');
    if (countActiveEl) countActiveEl.textContent = String(activeCount);
    if (countResolvedEl) countResolvedEl.textContent = String(resolvedCount);
    if (countAllEl) countAllEl.textContent = String(totalCount);
    if (countGratitudeEl) countGratitudeEl.textContent = String(gratitudes.length);

    // Stats View - Two Pillars
    const statsNotHappenedRate = document.getElementById('stats-not-happened-rate');
    const statsNotHappenedCount = document.getElementById('stats-not-happened-count');
    const statsCopedRate = document.getElementById('stats-coped-rate');
    const statsCopedCount = document.getElementById('stats-coped-count');
    const statsTotalPeaceDesc = document.getElementById('stats-total-peace-desc');

    if (statsNotHappenedRate) statsNotHappenedRate.textContent = notHappenedRateText;
    if (statsNotHappenedCount) statsNotHappenedCount.textContent = `${notHappenedCount}件`;
    if (statsCopedRate) statsCopedRate.textContent = copedRateText;
    if (statsCopedCount) statsCopedCount.textContent = `${copedCount}件`;
    if (statsTotalPeaceDesc) {
      statsTotalPeaceDesc.textContent =
        resolvedCount > 0
          ? `終了した心配事の合計 ${peaceRateText}（${resolvedCount}件中 ${peacefulCount}件）は「起こらなかった」か「起こっても大丈夫だった」ことでした。`
          : '終了した心配事が増えると、それぞれの割合がここに集計されます。';
    }

    const statsTotalCount = document.getElementById('stats-total-count');
    const statsActiveCount = document.getElementById('stats-active-count');
    const statsResolvedCount = document.getElementById('stats-resolved-count');

    if (statsTotalCount) statsTotalCount.textContent = String(totalCount);
    if (statsActiveCount) statsActiveCount.textContent = String(activeCount);
    if (statsResolvedCount) statsResolvedCount.textContent = String(resolvedCount);

    // Breakdown Bars
    const barsContainer = document.getElementById('stats-bars-container');
    if (barsContainer) {
      barsContainer.replaceChildren();
      ALLOWED_OUTCOME_KEYS.forEach((key) => {
        const info = OUTCOMES[key];
        const count = resolvedItems.filter((w) => w.outcome === key).length;
        const pct = resolvedCount > 0 ? Math.round((count / resolvedCount) * 100) : 0;

        const row = document.createElement('div');
        row.className = 'stat-bar-row';

        const header = document.createElement('div');
        header.className = 'stat-bar-header';

        const labelSpan = document.createElement('span');
        labelSpan.textContent = info.label;

        const valSpan = document.createElement('span');
        valSpan.textContent = `${count}件 (${pct}%)`;

        header.appendChild(labelSpan);
        header.appendChild(valSpan);

        const track = document.createElement('div');
        track.className = 'stat-bar-track';

        const fill = document.createElement('div');
        fill.className = 'stat-bar-fill ' + key;
        fill.style.width = `${pct}%`;

        track.appendChild(fill);
        row.appendChild(header);
        row.appendChild(track);
        barsContainer.appendChild(row);
      });
    }
  }

  function updateYearFilterOptions() {
    const yearSelect = document.getElementById('filter-year');
    if (!yearSelect) return;

    const currentYear = String(new Date().getFullYear());
    const yearsSet = new Set([currentYear]);
    worries.forEach((w) => {
      if (isValidDateStr(w.registeredDate)) {
        yearsSet.add(w.registeredDate.slice(0, 4));
      }
    });
    gratitudes.forEach((g) => {
      if (isValidDateStr(g.registeredDate)) {
        yearsSet.add(g.registeredDate.slice(0, 4));
      }
    });

    const sortedYears = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

    yearSelect.replaceChildren();
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'すべての年';
    yearSelect.appendChild(allOpt);

    sortedYears.forEach((yr) => {
      const opt = document.createElement('option');
      opt.value = yr;
      opt.textContent = `${yr}年`;
      yearSelect.appendChild(opt);
    });

    if (filterYear !== 'all' && !yearsSet.has(filterYear)) {
      filterYear = 'all';
    }
    yearSelect.value = filterYear;

    const resetBtn = document.getElementById('btn-reset-period');
    if (resetBtn) {
      resetBtn.hidden =
        filterKind === 'all' && filterYear === 'all' && filterMonth === 'all';
    }
  }

  function renderListView() {
    updateYearFilterOptions();

    const container = document.getElementById('worry-list-container');
    if (!container) return;
    container.replaceChildren();

    const kindSelect = document.getElementById('filter-kind');
    if (kindSelect && kindSelect.value !== filterKind) {
      kindSelect.value = filterKind;
    }

    const combined = [];

    if (filterKind === 'all' || filterKind === 'worry') {
      worries.forEach((item) => {
        if (currentFilter === 'active' && item.status !== 'active') return;
        if (currentFilter === 'resolved' && item.status !== 'resolved') return;

        if (isValidDateStr(item.registeredDate)) {
          const [itemYear, itemMonth] = item.registeredDate.split('-');
          if (filterYear !== 'all' && itemYear !== filterYear) return;
          if (filterMonth !== 'all' && itemMonth !== filterMonth) return;
        }
        combined.push({ type: 'worry', item });
      });
    }

    if (filterKind === 'all' || filterKind === 'gratitude') {
      gratitudes.forEach((item) => {
        if (isValidDateStr(item.registeredDate)) {
          const [itemYear, itemMonth] = item.registeredDate.split('-');
          if (filterYear !== 'all' && itemYear !== filterYear) return;
          if (filterMonth !== 'all' && itemMonth !== filterMonth) return;
        }
        combined.push({ type: 'gratitude', item });
      });
    }

    combined.sort((a, b) => {
      if (a.item.registeredDate !== b.item.registeredDate) {
        return b.item.registeredDate.localeCompare(a.item.registeredDate);
      }
      return b.item.createdAt - a.item.createdAt;
    });

    if (combined.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const isPeriodFiltered = filterYear !== 'all' || filterMonth !== 'all';
      if (isPeriodFiltered) {
        empty.textContent = '指定した年・月に該当する記録はありません。';
      } else if (filterKind === 'gratitude') {
        empty.textContent = 'まだ感謝の言葉がありません。小さな「ありがとう」を書き出してみましょう🌸';
      } else if (filterKind === 'all') {
        empty.textContent = '該当する記録はまだありません。';
      } else if (currentFilter === 'active') {
        empty.textContent = '現在抱えている心配事はありません。気になったらいつでも書き出して頭を休めましょう🌿';
      } else if (currentFilter === 'resolved') {
        empty.textContent = '終了済みの心配事はまだありません。';
      } else {
        empty.textContent = 'まだ記録がありません。上のフォームから心配事を追加してみましょう。';
      }
      container.appendChild(empty);
      return;
    }

    combined.forEach((entry) => {
      if (entry.type === 'gratitude') {
        container.appendChild(createGratitudeCardElement(entry.item));
      } else {
        container.appendChild(createWorryCardElement(entry.item));
      }
    });
  }

  function renderCalendarView() {
    const monthTitle = document.getElementById('cal-month-title');
    if (monthTitle) {
      monthTitle.textContent = `${calendarYear}年 ${calendarMonth + 1}月`;
    }

    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.replaceChildren();

    const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const todayStr = getTodayDateStr();

    // Group worries and gratitudes by registeredDate
    const byDate = new Map();
    worries.forEach((w) => {
      const entry = byDate.get(w.registeredDate) || { worries: [], gratitudes: [] };
      entry.worries.push(w);
      byDate.set(w.registeredDate, entry);
    });
    gratitudes.forEach((g) => {
      const entry = byDate.get(g.registeredDate) || { worries: [], gratitudes: [] };
      entry.gratitudes.push(g);
      byDate.set(g.registeredDate, entry);
    });

    // Leading empty cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.className = 'cal-cell empty';
      grid.appendChild(emptyCell);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const mStr = String(calendarMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateStr = `${calendarYear}-${mStr}-${dStr}`;

      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cal-cell';
      if (dateStr === todayStr) cell.classList.add('today');
      if (dateStr === selectedDateStr) cell.classList.add('selected');

      const numSpan = document.createElement('span');
      numSpan.className = 'cal-day-num';
      numSpan.textContent = String(day);
      cell.appendChild(numSpan);

      const dayEntry = byDate.get(dateStr) || { worries: [], gratitudes: [] };
      const totalDayCount = dayEntry.worries.length + dayEntry.gratitudes.length;
      if (totalDayCount > 0) {
        const dotsWrap = document.createElement('div');
        dotsWrap.className = 'cal-dots';

        const dotClasses = [];
        dayEntry.worries.forEach((w) => {
          dotClasses.push(w.status === 'resolved' ? 'dot-resolved' : 'dot-active');
        });
        dayEntry.gratitudes.forEach(() => {
          dotClasses.push('dot-gratitude');
        });

        const maxDots = Math.min(dotClasses.length, 4);
        for (let idx = 0; idx < maxDots; idx++) {
          const dot = document.createElement('span');
          dot.className = 'dot ' + dotClasses[idx];
          dotsWrap.appendChild(dot);
        }
        cell.appendChild(dotsWrap);

        const pill = document.createElement('span');
        const hasActive = dayEntry.worries.some((item) => item.status === 'active');
        const hasOnlyGratitude = dayEntry.worries.length === 0 && dayEntry.gratitudes.length > 0;
        pill.className =
          'cal-count-pill ' +
          (hasActive ? 'has-active' : hasOnlyGratitude ? 'has-gratitude' : 'all-resolved');
        pill.textContent = `${totalDayCount}件`;
        cell.appendChild(pill);
      }

      cell.addEventListener('click', () => {
        selectedDateStr = dateStr;
        renderCalendarView();
      });

      grid.appendChild(cell);
    }

    // Render list for selectedDateStr
    const selectedTitle = document.getElementById('selected-date-title');
    if (selectedTitle) {
      selectedTitle.textContent = `📅 ${formatDisplayDate(selectedDateStr)} の記録`;
    }

    const dayListContainer = document.getElementById('calendar-day-list');
    if (dayListContainer) {
      dayListContainer.replaceChildren();
      const dayEntry = byDate.get(selectedDateStr) || { worries: [], gratitudes: [] };
      const combined = [
        ...dayEntry.worries.map((w) => ({ type: 'worry', item: w })),
        ...dayEntry.gratitudes.map((g) => ({ type: 'gratitude', item: g }))
      ].sort((a, b) => b.item.createdAt - a.item.createdAt);

      if (combined.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'この日に登録された記録はありません。';
        dayListContainer.appendChild(empty);
      } else {
        combined.forEach((entry) => {
          if (entry.type === 'gratitude') {
            dayListContainer.appendChild(createGratitudeCardElement(entry.item));
          } else {
            dayListContainer.appendChild(createWorryCardElement(entry.item));
          }
        });
      }
    }
  }

  function renderHeaderPrimingBar() {
    const words = getAllPrimingWords();
    if (words.length === 0) return;
    const todayStr = getTodayDateStr();
    const idx = getDailyPrimingIndex(todayStr, words.length);
    const currentWord = words[idx];

    const textEl = document.getElementById('header-priming-text');
    if (textEl) {
      textEl.textContent = currentWord;
    }

    const likeBtn = document.getElementById('btn-like-priming');
    const likeIcon = document.getElementById('priming-like-icon');
    const entry = primingLikes[currentWord] || { count: 0, lastLikedDate: null };
    const isLikedToday = entry.lastLikedDate === todayStr;

    if (likeBtn) {
      likeBtn.classList.toggle('liked', isLikedToday);
      likeBtn.setAttribute('aria-pressed', String(isLikedToday));
    }
    if (likeIcon) {
      likeIcon.textContent = isLikedToday ? '❤️' : '🤍';
    }
  }

  function toggleTodayPrimingLike() {
    const words = getAllPrimingWords();
    if (words.length === 0) return;
    const todayStr = getTodayDateStr();
    const idx = getDailyPrimingIndex(todayStr, words.length);
    const currentWord = words[idx];

    const entry = primingLikes[currentWord] || { count: 0, lastLikedDate: null };
    if (entry.lastLikedDate === todayStr) {
      entry.count = Math.max(0, entry.count - 1);
      entry.lastLikedDate = null;
    } else {
      entry.count += 1;
      entry.lastLikedDate = todayStr;
      showToast('今日のプライミングワードにいいねしました❤️');
    }
    primingLikes[currentWord] = entry;
    savePrimingLikes();
    renderHeaderPrimingBar();
  }

  function renderAll() {
    renderHeaderPrimingBar();
    renderBannerAndStats();
    renderListView();
    renderCalendarView();
  }

  function switchMode(mode) {
    currentMode = mode === 'gratitude' ? 'gratitude' : 'worry';
    const worryBtn = document.getElementById('mode-btn-worry');
    const gratitudeBtn = document.getElementById('mode-btn-gratitude');
    const worryPanel = document.getElementById('panel-mode-worry');
    const gratitudePanel = document.getElementById('panel-mode-gratitude');

    if (worryBtn) {
      const isWorry = currentMode === 'worry';
      worryBtn.classList.toggle('active', isWorry);
      worryBtn.setAttribute('aria-selected', String(isWorry));
    }
    if (gratitudeBtn) {
      const isGrat = currentMode === 'gratitude';
      gratitudeBtn.classList.toggle('active', isGrat);
      gratitudeBtn.setAttribute('aria-selected', String(isGrat));
    }
    if (worryPanel) worryPanel.hidden = currentMode !== 'worry';
    if (gratitudePanel) gratitudePanel.hidden = currentMode !== 'gratitude';
    renderListView();
  }

  // Actions
  function addWorry(title, registeredDate) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const validDate = isValidDateStr(registeredDate) ? registeredDate : getTodayDateStr();

    const newItem = {
      id: generateId(),
      title: trimmed.slice(0, 300),
      registeredDate: validDate,
      status: 'active',
      outcome: null,
      note: '',
      resolvedDate: null,
      createdAt: Date.now()
    };

    worries.unshift(newItem);
    saveWorries();
    selectedDateStr = validDate;

    // Switch filter back to 'active' and reset period filters so the new item is always visible
    currentFilter = 'active';
    filterYear = 'all';
    filterMonth = 'all';
    const filterBtns = document.querySelectorAll('.filter-pill');
    filterBtns.forEach((b) => {
      if (b.getAttribute('data-filter') === 'active') {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    renderAll();
    try {
      sessionStorage.setItem('worry_diary_flash', '心配事をリストに預けました🌿');
    } catch (_e) {
      // ignore sessionStorage errors
    }
    window.location.reload();
  }

  function addGratitude(title, registeredDate) {
    const trimmed = title.trim();
    if (!trimmed) return;
    const validDate = isValidDateStr(registeredDate) ? registeredDate : getTodayDateStr();

    const newItem = {
      id: generateId(),
      title: trimmed.slice(0, 300),
      registeredDate: validDate,
      createdAt: Date.now()
    };

    gratitudes.unshift(newItem);
    saveGratitudes();
    selectedDateStr = validDate;
    filterYear = 'all';
    filterMonth = 'all';
    const monthSelect = document.getElementById('filter-month');
    if (monthSelect) monthSelect.value = 'all';

    renderAll();
    showToast('感謝の言葉を記録しました🌸');
  }

  function openResolveModal(id) {
    const item = worries.find((w) => w.id === id);
    if (!item) return;

    const modal = document.getElementById('modal-resolve');
    const idInput = document.getElementById('resolve-worry-id');
    const preview = document.getElementById('resolve-worry-preview');
    const outcomeSelect = document.getElementById('select-outcome');
    const noteInput = document.getElementById('input-reflection-note');

    if (!modal || !idInput || !preview || !outcomeSelect || !noteInput) return;

    idInput.value = item.id;
    preview.textContent = item.title;
    outcomeSelect.value =
      item.outcome && ALLOWED_OUTCOME_KEYS.includes(item.outcome)
        ? item.outcome
        : 'did_not_happen';
    noteInput.value = item.note || '';

    modal.hidden = false;
  }

  function closeResolveModal() {
    const modal = document.getElementById('modal-resolve');
    if (modal) modal.hidden = true;
  }

  function reopenWorry(id) {
    const item = worries.find((w) => w.id === id);
    if (!item) return;
    item.status = 'active';
    item.outcome = null;
    item.resolvedDate = null;
    saveWorries();
    renderAll();
    showToast('「心配中」に戻しました');
  }

  function openDeleteModal(id, type = 'worry') {
    const targetList = type === 'gratitude' ? gratitudes : worries;
    const item = targetList.find((w) => w.id === id);
    if (!item) return;
    pendingDeleteTarget = { type, id };
    const preview = document.getElementById('delete-target-preview');
    if (preview) {
      preview.textContent = `「${item.title}」の記録を削除してもよろしいですか？`;
    }
    const modal = document.getElementById('modal-delete');
    if (modal) modal.hidden = false;
  }

  function closeDeleteModal() {
    pendingDeleteTarget = null;
    const modal = document.getElementById('modal-delete');
    if (modal) modal.hidden = true;
  }

  function confirmDeleteTarget() {
    if (!pendingDeleteTarget) return;
    if (pendingDeleteTarget.type === 'gratitude') {
      gratitudes = gratitudes.filter((g) => g.id !== pendingDeleteTarget.id);
      saveGratitudes();
    } else {
      worries = worries.filter((w) => w.id !== pendingDeleteTarget.id);
      saveWorries();
    }
    closeDeleteModal();
    renderAll();
    showToast('記録を削除しました');
  }

  // Priming Word Functions
  function getDailyPrimingIndex(dateStr, totalCount) {
    if (totalCount <= 0) return 0;
    const parsedMs = Date.parse(dateStr + 'T00:00:00Z');
    const dayNumber = Number.isFinite(parsedMs) ? Math.floor(parsedMs / 86400000) : 0;
    return Math.abs(dayNumber) % totalCount;
  }

  function renderPrimingModalContent(index) {
    const words = getAllPrimingWords();
    if (words.length === 0) return;
    const safeIndex = ((index % words.length) + words.length) % words.length;
    currentPrimingIndex = safeIndex;

    const dateLabel = document.getElementById('modal-priming-title');
    const wordBox = document.getElementById('priming-word-display');
    if (dateLabel) dateLabel.textContent = formatDisplayDate(getTodayDateStr());
    if (wordBox) wordBox.textContent = words[safeIndex];
  }

  function openPrimingModal(useDaily = true) {
    const words = getAllPrimingWords();
    if (useDaily) {
      currentPrimingIndex = getDailyPrimingIndex(getTodayDateStr(), words.length);
    }
    renderPrimingModalContent(currentPrimingIndex);
    const modal = document.getElementById('modal-priming');
    if (modal) modal.hidden = false;
  }

  function closePrimingModal() {
    const modal = document.getElementById('modal-priming');
    if (modal) modal.hidden = true;
  }

  function shufflePrimingWord() {
    const words = getAllPrimingWords();
    if (words.length <= 1) return;
    let nextIdx = (currentPrimingIndex + 1) % words.length;
    renderPrimingModalContent(nextIdx);
  }

  function renderPrimingWordsList() {
    const listEl = document.getElementById('priming-words-list');
    if (!listEl) return;
    listEl.replaceChildren();

    // Show custom words first so user sees what they added
    customPrimingWords.forEach((word, idx) => {
      const li = document.createElement('li');
      li.className = 'priming-word-item';

      const textSpan = document.createElement('span');
      textSpan.className = 'priming-word-text';
      textSpan.textContent = word;

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-icon-delete';
      delBtn.setAttribute('aria-label', '削除');
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', () => {
        customPrimingWords.splice(idx, 1);
        saveCustomPrimingWords();
        renderPrimingWordsList();
        showToast('プライミングワードを削除しました');
      });

      li.appendChild(textSpan);
      li.appendChild(delBtn);
      listEl.appendChild(li);
    });

    DEFAULT_PRIMING_WORDS.forEach((word) => {
      const li = document.createElement('li');
      li.className = 'priming-word-item';

      const textSpan = document.createElement('span');
      textSpan.className = 'priming-word-text';
      textSpan.textContent = word;

      const tagSpan = document.createElement('span');
      tagSpan.className = 'priming-word-tag';
      tagSpan.textContent = '標準';

      li.appendChild(textSpan);
      li.appendChild(tagSpan);
      listEl.appendChild(li);
    });
  }

  function openPrimingManageModal() {
    renderPrimingWordsList();
    const modal = document.getElementById('modal-priming-manage');
    if (modal) modal.hidden = false;
  }

  function closePrimingManageModal() {
    const modal = document.getElementById('modal-priming-manage');
    if (modal) modal.hidden = true;
  }

  function switchTab(targetViewId) {
    const views = document.querySelectorAll('.tab-view');
    views.forEach((v) => {
      if (v.id === targetViewId) {
        v.hidden = false;
        v.classList.add('active');
      } else {
        v.hidden = true;
        v.classList.remove('active');
      }
    });

    const navBtns = document.querySelectorAll('.nav-item');
    navBtns.forEach((btn) => {
      if (btn.getAttribute('data-target') === targetViewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Backup Export / Import
  function exportBackupJson() {
    const payload = {
      version: 2,
      worries,
      gratitudes,
      customPrimingWords
    };
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `worry-diary-backup-${getTodayDateStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('バックアップファイルを保存しました');
  }

  function importBackupJson(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showToast('ファイルサイズが大きすぎます（上限2MB）');
      return;
    }
    const reader = new FileReader();
    reader.onload = function (evt) {
      try {
        const text = String(evt.target.result || '');
        const parsed = JSON.parse(text);

        if (Array.isArray(parsed)) {
          // Legacy v1 format (worries array only)
          const validItems = parsed.map(sanitizeItem).filter(Boolean);
          worries = validItems;
          saveWorries();
          renderAll();
          const modal = document.getElementById('modal-backup');
          if (modal) modal.hidden = true;
          showToast(`${validItems.length}件の記録を復元しました`);
          return;
        }

        if (parsed && typeof parsed === 'object') {
          const validWorries = Array.isArray(parsed.worries)
            ? parsed.worries.map(sanitizeItem).filter(Boolean)
            : [];
          const validGratitudes = Array.isArray(parsed.gratitudes)
            ? parsed.gratitudes.map(sanitizeGratitude).filter(Boolean)
            : [];
          const validCustomPriming = Array.isArray(parsed.customPrimingWords)
            ? parsed.customPrimingWords
                .filter((s) => typeof s === 'string')
                .map((s) => s.trim().slice(0, 120))
                .filter(Boolean)
            : [];

          worries = validWorries;
          gratitudes = validGratitudes;
          customPrimingWords = validCustomPriming;
          saveWorries();
          saveGratitudes();
          saveCustomPrimingWords();
          renderAll();
          const modal = document.getElementById('modal-backup');
          if (modal) modal.hidden = true;
          showToast(
            `心配事 ${validWorries.length}件・感謝 ${validGratitudes.length}件を復元しました`
          );
          return;
        }

        showToast('無効なバックアップファイル形式です');
      } catch (_e) {
        showToast('JSONファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    loadWorries();
    loadGratitudes();
    loadCustomPrimingWords();
    loadPrimingLikes();

    const versionEl = document.getElementById('app-version');
    if (versionEl) {
      versionEl.textContent = APP_VERSION;
    }

    // Default date inputs to today
    const dateInput = document.getElementById('input-worry-date');
    if (dateInput) {
      dateInput.value = getTodayDateStr();
    }
    const gratitudeDateInput = document.getElementById('input-gratitude-date');
    if (gratitudeDateInput) {
      gratitudeDateInput.value = getTodayDateStr();
    }

    // Mode Selector Menu (Worry vs Gratitude)
    const modeBtnWorry = document.getElementById('mode-btn-worry');
    const modeBtnGratitude = document.getElementById('mode-btn-gratitude');
    if (modeBtnWorry) {
      modeBtnWorry.addEventListener('click', () => switchMode('worry'));
    }
    if (modeBtnGratitude) {
      modeBtnGratitude.addEventListener('click', () => switchMode('gratitude'));
    }

    // Add Worry Form Submit
    const addForm = document.getElementById('form-add-worry');
    if (addForm) {
      addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('input-worry-title');
        const dateEl = document.getElementById('input-worry-date');
        if (!titleInput || !dateEl) return;
        addWorry(titleInput.value, dateEl.value);
        titleInput.value = '';
      });
    }

    // Add Gratitude Form Submit
    const addGratitudeForm = document.getElementById('form-add-gratitude');
    if (addGratitudeForm) {
      addGratitudeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('input-gratitude-title');
        const dateEl = document.getElementById('input-gratitude-date');
        if (!titleInput || !dateEl) return;
        addGratitude(titleInput.value, dateEl.value);
        titleInput.value = '';
      });
    }

    // Filter Buttons
    const filterBtns = document.querySelectorAll('.filter-pill');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter') || 'active';
        renderListView();
      });
    });

    // Kind / Year / Month Period Filter Selects
    const kindSelect = document.getElementById('filter-kind');
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const resetPeriodBtn = document.getElementById('btn-reset-period');

    if (kindSelect) {
      kindSelect.value = filterKind;
      kindSelect.addEventListener('change', () => {
        filterKind = kindSelect.value || 'all';
        renderListView();
      });
    }
    if (yearSelect) {
      yearSelect.addEventListener('change', () => {
        filterYear = yearSelect.value || 'all';
        renderListView();
      });
    }
    if (monthSelect) {
      monthSelect.addEventListener('change', () => {
        filterMonth = monthSelect.value || 'all';
        renderListView();
      });
    }
    if (resetPeriodBtn) {
      resetPeriodBtn.addEventListener('click', () => {
        filterKind = 'all';
        filterYear = 'all';
        filterMonth = 'all';
        if (kindSelect) kindSelect.value = 'all';
        if (yearSelect) yearSelect.value = 'all';
        if (monthSelect) monthSelect.value = 'all';
        renderListView();
      });
    }

    // Bottom Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-target');
        if (target) switchTab(target);
      });
    });

    // Calendar Month Navigation
    const prevBtn = document.getElementById('cal-prev-month');
    const nextBtn = document.getElementById('cal-next-month');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        calendarMonth--;
        if (calendarMonth < 0) {
          calendarMonth = 11;
          calendarYear--;
        }
        renderCalendarView();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        calendarMonth++;
        if (calendarMonth > 11) {
          calendarMonth = 0;
          calendarYear++;
        }
        renderCalendarView();
      });
    }

    // Add worry on selected calendar date
    const btnAddOnSelected = document.getElementById('btn-add-on-selected-date');
    if (btnAddOnSelected) {
      btnAddOnSelected.addEventListener('click', () => {
        const dateEl = document.getElementById('input-worry-date');
        if (dateEl && isValidDateStr(selectedDateStr)) {
          dateEl.value = selectedDateStr;
        }
        switchMode('worry');
        switchTab('view-list');
        const titleInput = document.getElementById('input-worry-title');
        if (titleInput) titleInput.focus();
      });
    }

    // Add gratitude on selected calendar date
    const btnAddGratitudeOnSelected = document.getElementById('btn-add-gratitude-on-selected-date');
    if (btnAddGratitudeOnSelected) {
      btnAddGratitudeOnSelected.addEventListener('click', () => {
        const dateEl = document.getElementById('input-gratitude-date');
        if (dateEl && isValidDateStr(selectedDateStr)) {
          dateEl.value = selectedDateStr;
        }
        switchMode('gratitude');
        switchTab('view-list');
        const titleInput = document.getElementById('input-gratitude-title');
        if (titleInput) titleInput.focus();
      });
    }

    // Resolve Modal Form
    const resolveForm = document.getElementById('form-resolve-worry');
    if (resolveForm) {
      resolveForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('resolve-worry-id').value;
        const outcome = document.getElementById('select-outcome').value;
        const note = document.getElementById('input-reflection-note').value;

        const item = worries.find((w) => w.id === id);
        if (item && ALLOWED_OUTCOME_KEYS.includes(outcome)) {
          item.status = 'resolved';
          item.outcome = outcome;
          item.note = note.trim().slice(0, 500);
          item.resolvedDate = getTodayDateStr();
          saveWorries();
          closeResolveModal();
          renderAll();
          showToast('結末を記録して終了しました✨');
        }
      });
    }

    const btnCloseResolve = document.getElementById('btn-close-resolve');
    const btnCancelResolve = document.getElementById('btn-cancel-resolve');
    if (btnCloseResolve) btnCloseResolve.addEventListener('click', closeResolveModal);
    if (btnCancelResolve) btnCancelResolve.addEventListener('click', closeResolveModal);

    // Delete Modal Buttons
    const btnCancelDelete = document.getElementById('btn-cancel-delete');
    const btnConfirmDelete = document.getElementById('btn-confirm-delete');
    if (btnCancelDelete) btnCancelDelete.addEventListener('click', closeDeleteModal);
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', confirmDeleteTarget);

    // Priming Word Modals
    const btnOpenPriming = document.getElementById('btn-open-priming');
    const btnClosePriming = document.getElementById('btn-close-priming');
    const btnShufflePriming = document.getElementById('btn-shuffle-priming');
    const btnManagePriming = document.getElementById('btn-manage-priming');
    const btnClosePrimingManage = document.getElementById('btn-close-priming-manage');
    const formAddPriming = document.getElementById('form-add-priming');

    if (btnOpenPriming) {
      btnOpenPriming.addEventListener('click', () => openPrimingModal(true));
    }
    const headerPrimingOpen = document.getElementById('header-priming-open');
    if (headerPrimingOpen) {
      headerPrimingOpen.addEventListener('click', () => openPrimingModal(true));
    }
    const btnLikePriming = document.getElementById('btn-like-priming');
    if (btnLikePriming) {
      btnLikePriming.addEventListener('click', toggleTodayPrimingLike);
    }
    if (btnClosePriming) {
      btnClosePriming.addEventListener('click', closePrimingModal);
    }
    if (btnShufflePriming) {
      btnShufflePriming.addEventListener('click', shufflePrimingWord);
    }
    if (btnManagePriming) {
      btnManagePriming.addEventListener('click', () => {
        closePrimingModal();
        openPrimingManageModal();
      });
    }
    if (btnClosePrimingManage) {
      btnClosePrimingManage.addEventListener('click', closePrimingManageModal);
    }
    if (formAddPriming) {
      formAddPriming.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('input-priming-word');
        if (!input) return;
        const word = input.value.trim().slice(0, 120);
        if (!word) return;
        customPrimingWords.unshift(word);
        saveCustomPrimingWords();
        input.value = '';
        renderPrimingWordsList();
        showToast('プライミングワードを追加しました✨');
      });
    }

    // Backup Modal
    const modalBackup = document.getElementById('modal-backup');
    const btnOpenBackup = document.getElementById('btn-open-backup');
    const btnCloseBackup = document.getElementById('btn-close-backup');
    const btnExportJson = document.getElementById('btn-export-json');
    const inputImportJson = document.getElementById('input-import-json');

    if (btnOpenBackup && modalBackup) {
      btnOpenBackup.addEventListener('click', () => {
        modalBackup.hidden = false;
      });
    }
    if (btnCloseBackup && modalBackup) {
      btnCloseBackup.addEventListener('click', () => {
        modalBackup.hidden = true;
      });
    }
    if (btnExportJson) {
      btnExportJson.addEventListener('click', exportBackupJson);
    }
    if (inputImportJson) {
      inputImportJson.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          importBackupJson(file);
          inputImportJson.value = '';
        }
      });
    }

    // Register Service Worker for offline PWA support
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
          reg.update();
        })
        .catch(() => {
          // Ignore service worker registration errors on file:// protocol
        });
    }

    renderAll();

    try {
      const flashMsg = sessionStorage.getItem('worry_diary_flash');
      if (flashMsg) {
        sessionStorage.removeItem('worry_diary_flash');
        showToast(flashMsg);
      }

      const primingShown = sessionStorage.getItem('worry_diary_priming_shown');
      if (!primingShown) {
        sessionStorage.setItem('worry_diary_priming_shown', '1');
        openPrimingModal(true);
      }
    } catch (_e) {
      openPrimingModal(true);
    }
  });
})();
