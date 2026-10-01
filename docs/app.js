/**
 * J-Global Digest - Frontend Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // アプリケーション状態
  const state = {
    currentArticles: [],
    filteredArticles: [],
    currentDate: '',
    updatedAt: '',
    selectedCategory: 'all',
    searchQuery: '',
    readArticleIds: new Set(),
    archives: []
  };

  // DOM要素
  const articlesListEl = document.getElementById('articles-list');
  const loadingStateEl = document.getElementById('loading-state');
  const errorStateEl = document.getElementById('error-state');
  const errorMessageEl = document.getElementById('error-message');
  const emptyStateEl = document.getElementById('empty-state');
  const retryBtn = document.getElementById('retry-btn');

  const currentDateBadge = document.getElementById('current-date-badge');
  const updateTimeEl = document.getElementById('update-time');
  const readCountEl = document.getElementById('read-count');

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeColorMeta = document.getElementById('theme-color-meta');

  const searchInput = document.getElementById('search-input');
  const clearSearchBtn = document.getElementById('clear-search-btn');
  const categoryTabs = document.getElementById('category-tabs');

  const archiveBtn = document.getElementById('archive-btn');
  const archiveModal = document.getElementById('archive-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const archiveListEl = document.getElementById('archive-list');

  // パスコードロック関連要素
  const lockScreenEl = document.getElementById('lock-screen');
  const lockSubtitleEl = document.getElementById('lock-subtitle');
  const pinDotsEl = document.getElementById('pin-dots');
  const lockErrorMsgEl = document.getElementById('lock-error-msg');
  const keypadEl = document.getElementById('keypad');
  const keyResetBtn = document.getElementById('key-reset');
  const keyDeleteBtn = document.getElementById('key-delete');
  const lockBtn = document.getElementById('lock-btn');

  let enteredPin = '';
  const PIN_LENGTH = 4;
  const STORAGE_KEY_PIN_HASH = 'jdigest_pin_hash';
  const STORAGE_KEY_AUTH = 'jdigest_is_authenticated';

  // ==========================================================================
  // 暗証番号（パスコード）ロック機能
  // ==========================================================================
  async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function initLockScreen() {
    const isAuth = localStorage.getItem(STORAGE_KEY_AUTH);
    const savedPinHash = localStorage.getItem(STORAGE_KEY_PIN_HASH);

    if (isAuth === 'true' && savedPinHash) {
      // 既に認証済み
      unlockApp();
    } else {
      showLockScreen();
    }
  }

  function showLockScreen() {
    enteredPin = '';
    updatePinDots();
    lockErrorMsgEl.textContent = '';
    lockScreenEl.classList.remove('unlocked');

    const savedPinHash = localStorage.getItem(STORAGE_KEY_PIN_HASH);
    if (!savedPinHash) {
      lockSubtitleEl.textContent = '【初回設定】お好きな4桁の暗証番号を入力してください';
    } else {
      lockSubtitleEl.textContent = '暗証番号（4桁）を入力してください';
    }
  }

  function unlockApp() {
    lockScreenEl.classList.add('unlocked');
    localStorage.setItem(STORAGE_KEY_AUTH, 'true');
    // ニュースデータの読み込み開始
    loadNewsData();
  }

  function updatePinDots() {
    const dots = pinDotsEl.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
      if (index < enteredPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  }

  async function handleKeyInput(digit) {
    if (enteredPin.length >= PIN_LENGTH) return;
    
    enteredPin += digit;
    updatePinDots();

    if (enteredPin.length === PIN_LENGTH) {
      // 4桁揃ったら検証
      setTimeout(async () => {
        await verifyOrRegisterPin(enteredPin);
      }, 100);
    }
  }

  async function verifyOrRegisterPin(pin) {
    const savedPinHash = localStorage.getItem(STORAGE_KEY_PIN_HASH);
    const inputHash = await sha256(pin);

    if (!savedPinHash) {
      // 初回登録
      localStorage.setItem(STORAGE_KEY_PIN_HASH, inputHash);
      alert('暗証番号を設定しました！次回からこの番号でロックを解除できます。');
      unlockApp();
    } else if (inputHash === savedPinHash) {
      // 認証成功
      unlockApp();
    } else {
      // 認証失敗
      triggerPinError('暗証番号が間違っています');
    }
  }

  function triggerPinError(msg) {
    lockErrorMsgEl.textContent = msg;
    pinDotsEl.classList.add('shake');
    setTimeout(() => {
      pinDotsEl.classList.remove('shake');
      enteredPin = '';
      updatePinDots();
    }, 450);
  }

  // テンキーイベント
  keypadEl.addEventListener('click', (e) => {
    const target = e.target;
    if (target.dataset.key) {
      handleKeyInput(target.dataset.key);
    }
  });

  keyResetBtn.addEventListener('click', () => {
    enteredPin = '';
    updatePinDots();
    lockErrorMsgEl.textContent = '';
  });

  keyDeleteBtn.addEventListener('click', () => {
    if (enteredPin.length > 0) {
      enteredPin = enteredPin.slice(0, -1);
      updatePinDots();
      lockErrorMsgEl.textContent = '';
    }
  });

  // ロック（ログアウト）ボタン
  lockBtn.addEventListener('click', () => {
    if (confirm('画面をロックしますか？（暗証番号の再入力が必要になります）')) {
      localStorage.removeItem(STORAGE_KEY_AUTH);
      showLockScreen();
    }
  });

  // ==========================================================================
  // テーマ管理 (ダーク / ライト)
  // ==========================================================================
  function initTheme() {
    const savedTheme = localStorage.getItem('jdigest_theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'light' || (!savedTheme && !prefersDark)) {
      setTheme('light');
    } else {
      setTheme('dark');
    }
  }

  function setTheme(theme) {
    if (theme === 'light') {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      themeColorMeta.setAttribute('content', '#f8fafc');
      localStorage.setItem('jdigest_theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      themeColorMeta.setAttribute('content', '#0a0f1d');
      localStorage.setItem('jdigest_theme', 'dark');
    }
  }

  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    setTheme(isDark ? 'light' : 'dark');
  });

  // ==========================================================================
  // データ取得
  // ==========================================================================
  async function loadNewsData(targetUrl = 'data/latest.json') {
    showLoading();
    try {
      // キャッシュ無効化パラメータを付与して常に最新を取得
      const cacheBuster = `?t=${new Date().getTime()}`;
      const response = await fetch(targetUrl + cacheBuster);
      if (!response.ok) {
        throw new Error(`データの取得に失敗しました (Status: ${response.status})`);
      }
      const data = await response.json();
      
      state.currentArticles = data.articles || [];
      state.currentDate = data.date || '';
      state.updatedAt = data.updated_at || '';

      // 既読状態の読み込み
      loadReadState();

      // UIメタ情報の更新
      updateMetaUI();

      // フィルタリングと描画
      applyFilters();
    } catch (err) {
      console.error(err);
      showError(err.message);
    }
  }

  function loadReadState() {
    const storageKey = `jdigest_read_${state.currentDate}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        state.readArticleIds = new Set(JSON.parse(stored));
      } else {
        state.readArticleIds = new Set();
      }
    } catch (e) {
      state.readArticleIds = new Set();
    }
  }

  function toggleRead(articleId) {
    if (state.readArticleIds.has(articleId)) {
      state.readArticleIds.delete(articleId);
    } else {
      state.readArticleIds.add(articleId);
    }
    const storageKey = `jdigest_read_${state.currentDate}`;
    localStorage.setItem(storageKey, JSON.stringify([...state.readArticleIds]));
    
    updateReadProgressUI();
    
    // 対象カードのスタイル更新
    const cardEl = document.querySelector(`[data-card-id="${articleId}"]`);
    if (cardEl) {
      const btn = cardEl.querySelector('.read-toggle-btn');
      if (state.readArticleIds.has(articleId)) {
        cardEl.classList.add('is-read');
        btn.classList.add('checked');
        btn.innerHTML = '✓ 既読';
      } else {
        cardEl.classList.remove('is-read');
        btn.classList.remove('checked');
        btn.innerHTML = '既読にする';
      }
    }
  }

  // ==========================================================================
  // レンダリング & UI更新
  // ==========================================================================
  function updateMetaUI() {
    // 日付バッジ
    if (state.currentDate) {
      const parts = state.currentDate.split('-');
      if (parts.length === 3) {
        currentDateBadge.textContent = `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日号`;
      } else {
        currentDateBadge.textContent = state.currentDate;
      }
    }
    // 更新日時
    updateTimeEl.textContent = `更新: ${state.updatedAt || '最新'}`;
    updateReadProgressUI();
  }

  function updateReadProgressUI() {
    const total = state.currentArticles.length;
    const read = state.readArticleIds.size;
    readCountEl.textContent = `${read} / ${total} 読了`;
  }

  function applyFilters() {
    let result = [...state.currentArticles];

    // カテゴリー絞り込み
    if (state.selectedCategory !== 'all') {
      result = result.filter(item => item.category === state.selectedCategory);
    }

    // キーワード検索絞り込み
    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.toLowerCase();
      result = result.filter(item => {
        const titleJa = (item.title_ja || '').toLowerCase();
        const origTitle = (item.original_title || '').toLowerCase();
        const source = (item.source || '').toLowerCase();
        const perspective = (item.global_perspective || '').toLowerCase();
        const points = (item.summary_points || []).join(' ').toLowerCase();
        const tags = (item.tags || []).join(' ').toLowerCase();

        return titleJa.includes(q) || origTitle.includes(q) || source.includes(q) || perspective.includes(q) || points.includes(q) || tags.includes(q);
      });
    }

    state.filteredArticles = result;
    renderArticles();
  }

  function renderArticles() {
    hideAllStates();

    if (state.filteredArticles.length === 0) {
      emptyStateEl.style.display = 'flex';
      return;
    }

    articlesListEl.innerHTML = '';
    articlesListEl.style.display = 'flex';

    state.filteredArticles.forEach(item => {
      const isRead = state.readArticleIds.has(item.id);
      const card = document.createElement('article');
      card.className = `article-card ${isRead ? 'is-read' : ''}`;
      card.setAttribute('data-card-id', item.id);

      // 箇条書き要約HTML
      const summaryItemsHtml = (item.summary_points || [])
        .map(point => `<li>${escapeHtml(point)}</li>`)
        .join('');

      // タグ一覧HTML
      const tagsHtml = (item.tags || [])
        .map(tag => `<span class="tag-item">#${escapeHtml(tag)}</span>`)
        .join('');

      card.innerHTML = `
        <div class="card-top">
          <div class="card-meta-left">
            <span class="source-badge">${escapeHtml(item.source || '海外メディア')}</span>
            <span class="category-tag">${escapeHtml(item.category || '総合')}</span>
          </div>
          <span class="reading-time">${escapeHtml(item.reading_time || '約1分')}</span>
        </div>

        <h2 class="article-title">${escapeHtml(item.title_ja)}</h2>

        <div class="summary-box">
          <ul class="summary-list">
            ${summaryItemsHtml}
          </ul>
        </div>

        ${item.global_perspective ? `
        <div class="perspective-box">
          <div class="perspective-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="2" y1="12" x2="22" y2="12"></line>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>
            海外メディアの着眼点
          </div>
          <p class="perspective-text">${escapeHtml(item.global_perspective)}</p>
        </div>` : ''}

        ${tagsHtml ? `<div class="tags-list">${tagsHtml}</div>` : ''}

        <div class="card-footer">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="original-link">
            <span>原文を読む (${escapeHtml(item.source)})</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>

          <div class="card-actions-right">
            <button class="action-text-btn share-btn" title="記事を共有">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
              共有
            </button>
            <button class="action-text-btn read-toggle-btn ${isRead ? 'checked' : ''}">
              ${isRead ? '✓ 既読' : '既読にする'}
            </button>
          </div>
        </div>
      `;

      // 既読トグルのイベントリスナー
      const readBtn = card.querySelector('.read-toggle-btn');
      readBtn.addEventListener('click', () => toggleRead(item.id));

      // シェアボタンのイベントリスナー
      const shareBtn = card.querySelector('.share-btn');
      shareBtn.addEventListener('click', () => handleShare(item));

      articlesListEl.appendChild(card);
    });
  }

  // ==========================================================================
  // シェア機能
  // ==========================================================================
  async function handleShare(item) {
    const shareData = {
      title: item.title_ja,
      text: `【海外が見た日本ニュース要約】\n${item.title_ja}\n（${item.source}）`,
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // キャンセル時は何もしない
      }
    } else {
      // クリップボードにコピー
      try {
        await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
        alert('記事の要約とURLをクリップボードにコピーしました！');
      } catch (e) {
        alert('お使いのブラウザではシェア機能に対応していません。');
      }
    }
  }

  // ==========================================================================
  // アーカイブ一覧モーダル
  // ==========================================================================
  async function loadArchives() {
    try {
      const res = await fetch('data/archive/index.json?t=' + Date.now());
      if (res.ok) {
        state.archives = await res.json();
      } else {
        state.archives = [];
      }
    } catch (e) {
      state.archives = [];
    }
  }

  archiveBtn.addEventListener('click', async () => {
    await loadArchives();
    archiveListEl.innerHTML = '';

    // 「最新のニュース」に戻るボタン
    const latestItem = document.createElement('button');
    latestItem.className = 'archive-item-btn';
    latestItem.innerHTML = `
      <span><strong>📰 最新号に戻る</strong></span>
      <span>最新</span>
    `;
    latestItem.addEventListener('click', () => {
      archiveModal.style.display = 'none';
      loadNewsData('data/latest.json');
    });
    archiveListEl.appendChild(latestItem);

    if (state.archives.length === 0) {
      const p = document.createElement('p');
      p.style.padding = '12px';
      p.style.color = 'var(--text-muted)';
      p.textContent = '過去のアーカイブはまだありません。毎朝の自動更新で順次追加されます。';
      archiveListEl.appendChild(p);
    } else {
      state.archives.forEach(arch => {
        const btn = document.createElement('button');
        btn.className = 'archive-item-btn';
        btn.innerHTML = `
          <span>📅 ${escapeHtml(arch.title || arch.date)}</span>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${arch.count || 0}件</span>
        `;
        btn.addEventListener('click', () => {
          archiveModal.style.display = 'none';
          loadNewsData(`data/${arch.file}`);
        });
        archiveListEl.appendChild(btn);
      });
    }

    archiveModal.style.display = 'flex';
  });

  closeModalBtn.addEventListener('click', () => {
    archiveModal.style.display = 'none';
  });

  archiveModal.addEventListener('click', (e) => {
    if (e.target === archiveModal) {
      archiveModal.style.display = 'none';
    }
  });

  // ==========================================================================
  // 状態表示ヘルパー
  // ==========================================================================
  function showLoading() {
    hideAllStates();
    loadingStateEl.style.display = 'flex';
  }

  function showError(msg) {
    hideAllStates();
    errorStateEl.style.display = 'flex';
    errorMessageEl.textContent = msg || 'データの読み込みに失敗しました。';
  }

  function hideAllStates() {
    loadingStateEl.style.display = 'none';
    errorStateEl.style.display = 'none';
    emptyStateEl.style.display = 'none';
    articlesListEl.style.display = 'none';
  }

  retryBtn.addEventListener('click', () => {
    loadNewsData();
  });

  // ==========================================================================
  // フィルター・イベントバインド
  // ==========================================================================
  categoryTabs.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-btn')) {
      categoryTabs.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      e.target.classList.add('active');
      state.selectedCategory = e.target.getAttribute('data-category');
      applyFilters();
    }
  });

  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    clearSearchBtn.style.display = state.searchQuery ? 'block' : 'none';
    applyFilters();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    clearSearchBtn.style.display = 'none';
    applyFilters();
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 初期化実行
  initTheme();
  initLockScreen();
});
