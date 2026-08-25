  /* ── 공지사항 (Sheets notice 시트) ── */
  let _noticeData = [];
  let _noticeCat = '전체';
  let _noticeKeyword = '';

  async function loadNotice() {
    const el = document.getElementById('notice-list');
    el.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><span>불러오는 중...</span></div>';
    try {
      const res  = await fetch(APP_CONFIG.appsScriptUrl + '?action=notice');
      const json = await res.json();
      _noticeData = (json.items || []).filter(n => !isHiddenValue(n.use));
      buildNoticeFilters();
      renderNotice();
    } catch(e) {
      el.innerHTML = '<div class="board-empty">공지사항을 불러오지 못했습니다.</div>';
    }
  }

  function buildNoticeFilters() {
    const cats = ['전체', ...new Set(_noticeData.map(n => n.cat).filter(Boolean))];
    const bar = document.getElementById('notice-filter-bar');
    if (!bar) return;
    bar.innerHTML = '';
    cats.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (_noticeCat === c ? ' active' : '');
      btn.textContent = c;
      btn.addEventListener('click', () => noticeFilter(c, btn));
      bar.appendChild(btn);
    });
    if (!cats.includes(_noticeCat)) _noticeCat = '전체';
  }

  function noticeSearch(val) {
    resetPage('notice');
    _noticeKeyword = val.trim().toLowerCase();
    if (_noticeKeyword) {
      _noticeCat = '전체';
      document.querySelectorAll('#notice-filter-bar .cat-btn').forEach(b => b.classList.remove('active'));
      const firstBtn = document.querySelector('#notice-filter-bar .cat-btn');
      if (firstBtn) firstBtn.classList.add('active');
    }
    renderNotice();
  }

  function noticeFilter(cat, btn) {
    resetPage('notice');
    _noticeCat = cat;
    _noticeKeyword = '';
    const input = document.getElementById('notice-search');
    if (input) input.value = '';
    document.querySelectorAll('#notice-filter-bar .cat-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderNotice();
  }

  function renderNotice() {
    const el = document.getElementById('notice-list');
    let items = _noticeCat === '전체' ? _noticeData : _noticeData.filter(n => n.cat === _noticeCat);
    if (_noticeKeyword) {
      items = items.filter(n =>
        String(n.title || '').toLowerCase().includes(_noticeKeyword) ||
        String(n.content || '').toLowerCase().includes(_noticeKeyword) ||
        String(n.attachTitle || '').toLowerCase().includes(_noticeKeyword)
      );
    }
    if (!items.length) {
      el.innerHTML = '<div class="board-empty">등록된 공지사항이 없습니다.</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    pageSlice('notice', items).forEach(n => {
      let attachHtml = '';
      if (n.attachLink) {
        const links  = String(n.attachLink || '').split('|').map(s => s.trim()).filter(Boolean);
        const titles = String(n.attachTitle || '').split('|').map(s => s.trim()).filter(Boolean);
        attachHtml = links.map((url, i) => {
          const t = titles[i] || ('첨부파일 ' + (i + 1));
          return '<a class="notice-attach" href="' + esc(url) + '" target="_blank" rel="noopener" style="margin-right:8px;margin-bottom:6px;">'
            + '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
            + esc(t) + '</a>';
        }).join('');
      }
      const bodyHtml = (n.content || attachHtml)
        ? '<div class="notice-body">'
          + (n.content ? '<p>' + esc(n.content).replace(/\n/g,'<br>') + '</p>' : '')
          + attachHtml
          + '</div>'
        : '';
      const div = document.createElement('div');
      div.className = 'notice-item';
      div.innerHTML = '<div class="notice-head">'
        + '<div class="notice-head-left">'
        + '<span class="notice-badge">' + esc(n.cat || '공지') + '</span>'
        + '<span class="notice-title">' + esc(n.title || '') + '</span>'
        + '</div>'
        + '<span class="notice-date">' + esc(n.date || '') + '</span>'
        + '<span class="notice-toggle">+</span>'
        + '</div>'
        + bodyHtml;
      div.querySelector('.notice-head').addEventListener('click', () => div.classList.toggle('open'));
      frag.appendChild(div);
    });
    el.innerHTML = '';
    el.appendChild(frag);
    el.insertAdjacentHTML('beforeend', pagerHtml('notice', items.length));
  }

  /* ── 최근 조회 기록 (메모리 변수 = 새로고침하면 초기화) ── */
  let doiHistory = [];          // 페이지가 열려있는 동안만 유지. F5하면 빈 배열로 리셋됨.
  const MAX_HISTORY = 10;

  function saveHistory(title, doi) {
    try {
      const filtered = doiHistory.filter(h => h.doi !== doi);
      filtered.unshift({ title, doi, date: new Date().toLocaleDateString('ko-KR') });
      doiHistory = filtered.slice(0, MAX_HISTORY);
      renderHistory();
    } catch(e) {}
  }

  function renderHistory() {
    const el = document.getElementById('history-list');
    if (!el) return;
    try {
      const hist = doiHistory;
      if (!hist.length) {
        el.innerHTML = '<p style="font-size:13px;color:var(--tm);padding:8px 0;">조회 기록이 없습니다.</p>';
        return;
      }
      el.innerHTML = hist.map(h =>
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);gap:10px;">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:13px;color:var(--tp);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(h.title) + '</div>'
        + '<div style="font-size:11px;color:var(--tm);font-family:monospace;">' + esc(h.doi) + '</div>'
        + '</div>'
        + '<div style="display:flex;gap:6px;flex-shrink:0;">'
        + '<button onclick="fillDoi(\'' + esc(h.doi) + '\')" style="font-size:11px;padding:3px 8px;border:1px solid var(--border2);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--accent);">다시 조회</button>'
        + '</div>'
        + '</div>'
      ).join('');
    } catch(e) {}
  }


