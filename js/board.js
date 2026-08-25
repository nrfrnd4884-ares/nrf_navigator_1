  /* ── 상담 게시판 ── */
  let _allItems = [];
  let _curCat   = '전체';
  let _boardCategories = ['성과등록', '시스템 오류', '개선의견', '기타'];
  let _boardCategoriesLoaded = false;

  window.appMarkupReady.then(() => {
    document.getElementById('w-question').addEventListener('input', function() {
      document.getElementById('q-count').textContent = this.value.length;
    });
  });



  async function loadBoard() {
    await loadBoardCategories();
    const el = document.getElementById('board-list');
    el.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><span>불러오는 중...</span></div>';
    if (APP_CONFIG.appsScriptUrl === 'YOUR_APPS_SCRIPT_URL_HERE') {
      el.innerHTML = '<div class="board-empty">⚙️ Apps Script URL을 설정해주세요.<br><span style="font-size:12px;color:var(--tm);">google_apps_script.js를 배포한 후 HTML의 APP_CONFIG.appsScriptUrl을 교체하세요.</span></div>';
      return;
    }
    try {
      const res  = await fetch(APP_CONFIG.appsScriptUrl + '?action=list');
      const json = await res.json();
      _allItems  = json.items || [];
      renderBoard();
    } catch(e) {
      el.innerHTML = '<div class="board-empty">불러오기 실패. 잠시 후 다시 시도해주세요.</div>';
    }
  }

  async function loadBoardCategories(force) {
    if (_boardCategoriesLoaded && !force) {
      renderBoardCategoryControls();
      return;
    }
    try {
      const res = await fetch(APP_CONFIG.appsScriptUrl + '?action=boardCategory');
      const json = await res.json();
      const items = (json.items || []).filter(c => c && c.category && !isHiddenValue(c.use));
      if (items.length) {
        _boardCategories = items.map(c => c.category);
      }
    } catch(e) {
      // 카테고리 시트를 불러오지 못하면 기본값 사용
    }
    _boardCategoriesLoaded = true;
    renderBoardCategoryControls();
  }

  function renderBoardCategoryControls() {
    const filterBar = document.getElementById('cat-filters');
    if (filterBar) {
      const cats = ['전체', ..._boardCategories];
      filterBar.innerHTML = '';
      cats.forEach((c, i) => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn' + ((_curCat === c || (!_curCat && i === 0)) ? ' active' : '');
        btn.textContent = c;
        btn.addEventListener('click', () => filterCat(c, btn));
        filterBar.appendChild(btn);
      });
      if (!cats.includes(_curCat)) _curCat = '전체';
    }

    const select = document.getElementById('w-category');
    if (select) {
      const current = select.value;
      select.innerHTML = '';
      _boardCategories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
      });
      if (_boardCategories.includes(current)) select.value = current;
    }
  }

  let _boardKeyword = '';

  function boardSearch(val) {
    resetPage('board');
    _boardKeyword = val.trim().toLowerCase();
    if (_boardKeyword) {
      _curCat = '전체';
      document.querySelectorAll('#cat-filters .cat-btn').forEach(b => b.classList.remove('active'));
      const firstBtn = document.querySelector('#cat-filters .cat-btn');
      if (firstBtn) firstBtn.classList.add('active');
    }
    renderBoard();
  }

  function filterCat(cat, btn) {
    resetPage('board');
    _curCat = cat;
    _boardKeyword = '';
    document.getElementById('board-search').value = '';
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderBoard();
  }

  function renderBoard() {
    const el = document.getElementById('board-list');
    let items = _curCat === '전체' ? _allItems : _allItems.filter(x => x.category === _curCat);
    if (_boardKeyword) {
      items = items.filter(x =>
        x.question.toLowerCase().includes(_boardKeyword) ||
        x.answer.toLowerCase().includes(_boardKeyword)
      );
    }
    if (!items.length) {
      el.innerHTML = '<div class="board-empty">등록된 질문이 없습니다.<br>첫 번째로 질문해보세요!</div>';
      return;
    }
    el.innerHTML = pageSlice('board', items).map(q => {
      const answeredCls = q.answered ? 'answered' : '';
      return '<div class="q-card" onclick="toggleCard(this)">'
        + '<div class="q-card-head">'
        + '<span class="q-cat ' + answeredCls + '">' + esc(q.category) + '</span>'
        + '<div style="flex:1;">'
        + '<div class="q-title">' + esc(q.question.length > 80 ? q.question.slice(0,80)+'…' : q.question) + '</div>'
        + '<div class="q-meta"><span>' + esc(q.nickname||'익명') + '</span><span>' + esc(q.date) + '</span></div>'
        + '</div>'
        + '<span class="q-status ' + (q.answered?'done':'wait') + '">' + (q.answered ? '✓ 답변완료' : '대기중') + '</span>'
        + '</div>'
        + (q.answered ? '<div class="q-answer"><div class="q-answer-label">담당자 답변</div>' + esc(q.answer) + '</div>' : '')
        + '</div>';
    }).join('') + pagerHtml('board', items.length);
  }

  function toggleCard(el) {
    el.classList.toggle('open');
  }

  async function openWriteModal() {
    await loadBoardCategories();
    document.getElementById('write-modal').style.display = 'flex';
    document.getElementById('w-question').focus();
  }
  function closeWriteModal() {
    document.getElementById('write-modal').style.display = 'none';
    document.getElementById('w-question').value = '';
    document.getElementById('w-nickname').value = '';
    document.getElementById('q-count').textContent = '0';
  }

  async function submitQuestion() {
    const q   = document.getElementById('w-question').value.trim();
    const cat = document.getElementById('w-category').value;
    const nick= document.getElementById('w-nickname').value.trim() || '익명';
    if (!q) { document.getElementById('w-question').focus(); return; }
    if (APP_CONFIG.appsScriptUrl === 'YOUR_APPS_SCRIPT_URL_HERE') {
      alert('Apps Script URL을 먼저 설정해주세요.');
      return;
    }
    const btn = document.getElementById('submit-btn');
    btn.disabled = true; btn.textContent = '제출 중...';
    try {
      const params = new URLSearchParams({ action:'submit', category:cat, nickname:nick, question:q });
      await fetch(APP_CONFIG.appsScriptUrl + '?' + params.toString());
      closeWriteModal();
      await loadBoard();
    } catch(e) {
      alert('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
    btn.disabled = false; btn.textContent = '제출';
  }

  /* ── FAQ — Sheets에서 불러오기 ── */
