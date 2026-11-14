'use strict';

(function () {
  const STORAGE_KEY = 'worry_diary_items_v1';

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
  let currentFilter = 'active';
  let filterYear = 'all';
  let filterMonth = 'all';
  let calendarYear = new Date().getFullYear();
  let calendarMonth = new Date().getMonth(); // 0-indexed
  let selectedDateStr = getTodayDateStr();
  let pendingDeleteId = null;

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
    deleteBtn.addEventListener('click', () => openDeleteModal(item.id));
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
    if (countActiveEl) countActiveEl.textContent = String(activeCount);
    if (countResolvedEl) countResolvedEl.textContent = String(resolvedCount);
    if (countAllEl) countAllEl.textContent = String(totalCount);

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
      resetBtn.hidden = filterYear === 'all' && filterMonth === 'all';
    }
  }

  function renderListView() {
    updateYearFilterOptions();

    const container = document.getElementById('worry-list-container');
    if (!container) return;
    container.replaceChildren();

    const filtered = worries
      .filter((item) => {
        if (currentFilter === 'active' && item.status !== 'active') return false;
        if (currentFilter === 'resolved' && item.status !== 'resolved') return false;

        if (isValidDateStr(item.registeredDate)) {
          const [itemYear, itemMonth] = item.registeredDate.split('-');
          if (filterYear !== 'all' && itemYear !== filterYear) return false;
          if (filterMonth !== 'all' && itemMonth !== filterMonth) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.registeredDate !== b.registeredDate) {
          return b.registeredDate.localeCompare(a.registeredDate);
        }
        return b.createdAt - a.createdAt;
      });

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const isPeriodFiltered = filterYear !== 'all' || filterMonth !== 'all';
      if (isPeriodFiltered) {
        empty.textContent = '指定した年・月に該当する記録はありません。';
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

    filtered.forEach((item) => {
      container.appendChild(createWorryCardElement(item));
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

    // Group worries by registeredDate
    const byDate = new Map();
    worries.forEach((w) => {
      const list = byDate.get(w.registeredDate) || [];
      list.push(w);
      byDate.set(w.registeredDate, list);
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

      const dayItems = byDate.get(dateStr) || [];
      if (dayItems.length > 0) {
        const dotsWrap = document.createElement('div');
        dotsWrap.className = 'cal-dots';

        const maxDots = Math.min(dayItems.length, 4);
        for (let idx = 0; idx < maxDots; idx++) {
          const dot = document.createElement('span');
          dot.className =
            'dot ' + (dayItems[idx].status === 'resolved' ? 'dot-resolved' : 'dot-active');
          dotsWrap.appendChild(dot);
        }
        cell.appendChild(dotsWrap);

        const pill = document.createElement('span');
        const hasActive = dayItems.some((item) => item.status === 'active');
        pill.className = 'cal-count-pill ' + (hasActive ? 'has-active' : 'all-resolved');
        pill.textContent = `${dayItems.length}件`;
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
      selectedTitle.textContent = `📅 ${formatDisplayDate(selectedDateStr)} に登録した心配事`;
    }

    const dayListContainer = document.getElementById('calendar-day-list');
    if (dayListContainer) {
      dayListContainer.replaceChildren();
      const itemsOnDay = (byDate.get(selectedDateStr) || []).sort(
        (a, b) => b.createdAt - a.createdAt
      );

      if (itemsOnDay.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'この日に登録された心配事はありません。';
        dayListContainer.appendChild(empty);
      } else {
        itemsOnDay.forEach((item) => {
          dayListContainer.appendChild(createWorryCardElement(item));
        });
      }
    }
  }

  function renderAll() {
    renderBannerAndStats();
    renderListView();
    renderCalendarView();
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

  function openDeleteModal(id) {
    const item = worries.find((w) => w.id === id);
    if (!item) return;
    pendingDeleteId = id;
    const preview = document.getElementById('delete-target-preview');
    if (preview) {
      preview.textContent = `「${item.title}」の記録を削除してもよろしいですか？`;
    }
    const modal = document.getElementById('modal-delete');
    if (modal) modal.hidden = false;
  }

  function closeDeleteModal() {
    pendingDeleteId = null;
    const modal = document.getElementById('modal-delete');
    if (modal) modal.hidden = true;
  }

  function confirmDeleteWorry() {
    if (!pendingDeleteId) return;
    worries = worries.filter((w) => w.id !== pendingDeleteId);
    saveWorries();
    closeDeleteModal();
    renderAll();
    showToast('記録を削除しました');
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
    const dataStr = JSON.stringify(worries, null, 2);
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
        if (!Array.isArray(parsed)) {
          showToast('無効なバックアップファイル形式です');
          return;
        }
        const validItems = parsed.map(sanitizeItem).filter(Boolean);
        worries = validItems;
        saveWorries();
        renderAll();
        const modal = document.getElementById('modal-backup');
        if (modal) modal.hidden = true;
        showToast(`${validItems.length}件の記録を復元しました`);
      } catch (_e) {
        showToast('JSONファイルの読み込みに失敗しました');
      }
    };
    reader.readAsText(file);
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    loadWorries();

    // Default date input to today
    const dateInput = document.getElementById('input-worry-date');
    if (dateInput) {
      dateInput.value = getTodayDateStr();
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

    // Year / Month Period Filter Selects
    const yearSelect = document.getElementById('filter-year');
    const monthSelect = document.getElementById('filter-month');
    const resetPeriodBtn = document.getElementById('btn-reset-period');

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
        filterYear = 'all';
        filterMonth = 'all';
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
        switchTab('view-list');
        const titleInput = document.getElementById('input-worry-title');
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
    if (btnConfirmDelete) btnConfirmDelete.addEventListener('click', confirmDeleteWorry);

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
    } catch (_e) {
      // ignore sessionStorage errors
    }
  });
})();
