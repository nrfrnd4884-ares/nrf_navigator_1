  /* ── 패널/탭 전환 ── */
  function resetHome(e) {
    e.preventDefault();
    const homeBtn = document.querySelector('.nav-tab');
    switchPanel('home', homeBtn);
  }


  function goPanel(id) {
    switchPanel(id, null);
  }
  /* ══ 목록 페이지 나누기 (공통) ══
     한 페이지 개수를 넘으면 목록 아래에 1,2,3… 숫자 페이지를 붙인다.
     FAQ·공지사항·상담게시판·특허 검색결과에서 함께 쓴다. */
  // 목록별 한 페이지 개수 (특허는 논문 조회와 맞춰 10개)
  const PAGE_SIZE = { faq: 15, notice: 15, board: 15, patent: 10, paper: 10 };
  const perPage = key => PAGE_SIZE[key] || 15;
  const _pageNo = { faq: 1, notice: 1, board: 1, patent: 1, paper: 1 };

  // 현재 페이지에 해당하는 항목만 잘라낸다
  function pageSlice(key, items) {
    const n = perPage(key);
    const totalPages = Math.max(1, Math.ceil(items.length / n));
    if (_pageNo[key] > totalPages) _pageNo[key] = totalPages;
    const start = (_pageNo[key] - 1) * n;
    return items.slice(start, start + n);
  }

  // 하단 숫자 페이지 HTML (한 페이지뿐이면 아무것도 안 그림)
  function pagerHtml(key, total) {
    const totalPages = Math.ceil(total / perPage(key));
    if (totalPages <= 1) return '';
    const cur = _pageNo[key];
    // 번호가 너무 많아지지 않도록 최대 7개만 보여주고 나머지는 … 처리
    let to   = Math.min(totalPages, Math.max(1, cur - 3) + 6);
    let from = Math.max(1, to - 6);
    const btn = (n, label, cls) =>
      '<button class="pager-btn' + (cls || '') + '" onclick="goPage(\'' + key + '\',' + n + ')">' + label + '</button>';
    let h = '<div class="pager">';
    h += cur === 1 ? '<span class="pager-btn disabled">‹</span>' : btn(cur - 1, '‹', ' nav');
    if (from > 1) {
      h += btn(1, '1');
      if (from > 2) h += '<span class="pager-dots">…</span>';
    }
    for (let i = from; i <= to; i++) h += btn(i, i, i === cur ? ' active' : '');
    if (to < totalPages) {
      if (to < totalPages - 1) h += '<span class="pager-dots">…</span>';
      h += btn(totalPages, totalPages);
    }
    h += cur === totalPages ? '<span class="pager-btn disabled">›</span>' : btn(cur + 1, '›', ' nav');
    h += '<span class="pager-info">' + total + '건</span>';
    return h + '</div>';
  }

  // 페이지 이동 → 해당 목록만 다시 그리고 화면 맨 위로 올린다
  function goPage(key, n) {
    _pageNo[key] = n;
    if      (key === 'faq')    renderFAQ();
    else if (key === 'notice') renderNotice();
    else if (key === 'board')  renderBoard();
    else if (key === 'patent') renderPatentList();
    else if (key === 'paper')  renderSearchListPage();
    window.scrollTo({ top: 0, behavior: 'smooth' });   // 항상 최상단에서 새 페이지를 보게 함
  }

  // 검색어·카테고리가 바뀌면 1페이지부터
  function resetPage(key) { _pageNo[key] = 1; }

  /* 성과 조회 그룹 — 이 안에서만 오갈 때는 검색 기록·결과를 유지한다.
     (그룹 밖으로 나갔다가 돌아오면 초기화) */
  const SEARCH_GROUP = ['doi', 'patent'];
  let _prevPanel = 'home';   // 직전에 보고 있던 패널

  function switchPanel(id, btn, fromPopstate) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('panel-' + id);
    if (!panel) return;
    panel.classList.add('active');
    document.querySelectorAll('.nav-tab, .nav-group-btn, .nav-dropdown-item, .sidebar-item').forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); });
    document.querySelectorAll('[data-panel="' + id + '"]').forEach(b => {
      b.classList.add('active');
      b.setAttribute('aria-current', 'page');
      const group = b.closest('.nav-group');
      if (group) group.querySelector('.nav-group-btn').classList.add('active');
    });
    document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));
    document.querySelectorAll('.nav-group-btn').forEach(b => b.classList.remove('open'));
    if (id === 'board') loadBoard();
    if (id === 'faq') loadFaqData();
    if (id === 'notice') loadNotice();
    // 하단 IRIS·콜센터 카드는 홈 화면에서만 노출
    document.body.classList.toggle('is-home', id === 'home');

    // 논문↔특허끼리의 이동이면 기록 유지, 그룹 밖으로 나가면 두 패널 모두 정리한다.
    //  (예: 논문 → 홈 → 특허 → 논문 처럼 우회해도 홈을 거친 순간 비워지도록)
    const wasInGroup = SEARCH_GROUP.includes(_prevPanel);
    const nowInGroup = SEARCH_GROUP.includes(id);
    const stayInGroup = wasInGroup && nowInGroup;
    if (wasInGroup && !nowInGroup) { resetDoiPanel(); resetPatentPanel(); }

    if (id === 'doi') {
      if (stayInGroup) renderHistory();        // 유지: 화면만 다시 그림
      else             resetDoiPanel();        // 초기화
    }
    if (id === 'patent') {
      if (stayInGroup) renderPatentHistory();  // 유지
      else             resetPatentPanel();     // 초기화
    }
    if (id === 'chat') resetChat();            // AI 상담: 재진입 시 대화 초기화

    _prevPanel = id;
    updateFloatingClearBtn();
    // 브라우저 방문기록에 패널 이동을 남겨서 '뒤로가기'가 이전 패널로 돌아가게 함.
    //  - 사용자가 직접 이동할 때만 기록(push). 뒤로가기로 인한 전환(fromPopstate)은 기록하지 않음(무한루프 방지).
    //  - 맨 처음 진입 화면은 기록을 남기지 않으므로, 거기서 뒤로가기하면 사이트 밖(구글)으로 자연스럽게 나감.
    //  - file:// 로 직접 열었을 때는 브라우저가 로컬 파일을 독립 출처로 취급해 보안 경고를 남기므로 건너뜀
    //    (웹에 올린 https:// 환경에서는 정상 동작)
    if (!fromPopstate && location.protocol !== 'file:') {
      try { history.pushState({ panel: id }, ''); } catch(e) {}
    }
  }

  // '뒤로가기/앞으로가기' 버튼을 누르면 방문기록에 저장된 패널로 전환한다.
  //  state가 없으면(맨 처음 진입 기록) 홈으로 돌려보내고, 그 상태에서 한 번 더 뒤로가면 사이트 밖으로 나감.
  window.addEventListener('popstate', function(e) {
    const id = (e.state && e.state.panel) ? e.state.panel : 'home';
    switchPanel(id, null, true);   // true = 뒤로가기로 인한 전환(기록 재생성 안 함)
  });
  function switchSearch(type) {
    document.getElementById('search-doi-panel').style.display   = type === 'doi'   ? '' : 'none';
    document.getElementById('search-title-panel').style.display = type === 'title' ? '' : 'none';
    document.getElementById('stab-doi').classList.toggle('active',   type === 'doi');
    document.getElementById('stab-title').classList.toggle('active', type === 'title');
    document.getElementById('stab-doi').setAttribute('aria-selected',   type === 'doi');
    document.getElementById('stab-title').setAttribute('aria-selected', type === 'title');
    document.getElementById('sr-area').innerHTML = '';
    document.getElementById('result-area').innerHTML = '';
    const dcb = document.getElementById('doi-clear-bar'); if (dcb) dcb.style.display = 'none';
    updateFloatingClearBtn();
  }

  // 논문 조회 화면은 제목 탭을 기본 탭으로 초기화한다.
  // 패널 HTML에는 숨김 클래스를 두지 않고, 활성 탭 상태만 여기서 제어한다.
  window.appMarkupReady.then(() => switchSearch('title'));

  /* ── 유틸 ── */
  function stripTags(s) { return String(s).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function isHiddenValue(v) {
    const s = String(v || '').trim().toUpperCase();
    return ['N','NO','FALSE','0','숨김','비공개','비노출'].includes(s);
  }
  function formatDate(parts) {
    if (!parts || !parts.length) return null;
    const p = parts[0]; if (!p || !p[0]) return null;
    const y = p[0];
    const m = p[1] ? String(p[1]).padStart(2,'0') : '00';
    const d = p[2] ? String(p[2]).padStart(2,'0') : '00';
    return y + '-' + m + (p[2] ? '-' + d : '');
  }
  function detectIntl(authors) {
    if (!authors || !authors.length) return null;
    const KR = [/korea/i, /한국/i, /대한민국/i, /republic of korea/i, /south korea/i];
    let hasAffil = false;
    for (const a of authors) {
      const aff = (a.affiliation || []).map(x => x.name || '').join(' ').trim();
      if (!aff) continue;
      hasAffil = true;
      if (!KR.some(p => p.test(aff))) return true;
    }
    return hasAffil ? false : null;
  }

  let _copyData = {};

