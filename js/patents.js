  /* ── 특허 조회 ── */
  let _patentSearchType = 'word';

  function switchPatentSearch(type) {
    _patentSearchType = type;
    ['application','registration','word'].forEach(t => {
      document.getElementById('patent-' + t + '-panel').style.display = t === type ? '' : 'none';
      document.getElementById('ptab-' + t).classList.toggle('active', t === type);
      document.getElementById('ptab-' + t).setAttribute('aria-selected', t === type);
    });
    document.getElementById('patent-result-area').innerHTML = '';
    const pcb = document.getElementById('patent-clear-bar'); if (pcb) pcb.style.display = 'none';
    updateFloatingClearBtn();
  }

  // 특허 조회 화면은 발명 명칭 탭을 기본 탭으로 초기화한다.
  // 패널 HTML에는 숨김 클래스를 두지 않고, 활성 탭 상태만 여기서 제어한다.
  window.appMarkupReady.then(() => switchPatentSearch('word'));

  async function searchPatent() {
    const inputMap = {
      application: 'patent-app-input',
      registration: 'patent-reg-input',
      word: 'patent-word-input'
    };
    const query = document.getElementById(inputMap[_patentSearchType]).value.trim();
    if (!query) return;
    document.getElementById('patent-clear-bar').style.display = 'flex';
    updateFloatingClearBtn();

    const area = document.getElementById('patent-result-area');
    area.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><span>KIPRIS에서 조회 중...</span></div>';

    // 국가코드 가져오기
    let country = 'KR';
    if (_patentSearchType === 'application') {
      const sel = document.getElementById('patent-app-country');
      if (sel) country = sel.value;
    } else if (_patentSearchType === 'registration') {
      const sel = document.getElementById('patent-reg-country');
      if (sel) country = sel.value;
    }

    try {
      const apiBase = window.APP_CONFIG && window.APP_CONFIG.patentApiUrl;
      if (!apiBase || apiBase === 'YOUR_PATENT_API_URL_HERE') {
        throw new Error('특허 API 주소가 설정되지 않았습니다.');
      }
      const params = new URLSearchParams({
        action: 'patent',
        type: _patentSearchType,
        query,
        country
      });
      const res = await fetch(apiBase + '?' + params.toString());
      const body = await res.text();
      let json;
      try {
        json = JSON.parse(body);
      } catch (_) {
        throw new Error('특허 API가 JSON이 아닌 응답을 반환했습니다. (HTTP ' + res.status + ')');
      }
      if (!res.ok) {
        throw new Error(json.error || json.message || '특허 API 요청 실패 (HTTP ' + res.status + ')');
      }

      if (json.error) {
        area.innerHTML = '<div class="board-empty">⚠️ ' + esc(json.error) + '</div>';
        return;
      }
      if (!json.items || !json.items.length) {
        const detail = json.message || json.reason || '';
        area.innerHTML = '<div class="board-empty">검색 결과가 없습니다. 번호 형식을 확인해 주세요.'
          + (detail ? '<br><span class="api-error-detail">' + esc(detail) + '</span>' : '')
          + '</div>';
        return;
      }

      // 검색할 때 고른 국가를 각 결과에 붙여 둔다 (IRIS '출원/등록 국가' 칸에 필요)
      json.items.forEach(function (it) { it.country = country; });
      _patentItems = json.items;      // 페이지 나누기용으로 결과 보관
      resetPage('patent');
      renderPatentList();
      if (json.items.length) {
        const first = json.items[0];
        const saveQuery = first.applicationNumber || query;
        const saveType  = first.applicationNumber ? 'application' : _patentSearchType;
        savePatentHistory(first.title || query, saveQuery, saveType);
      }
    } catch(e) {
      console.error('Patent search failed:', e);
      area.innerHTML = '<div class="board-empty">조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.</div>';
    }
  }

  let _patentItems = [];   // 특허 검색 결과 전체 (페이지 나누기용)

  // 보관된 결과 중 현재 페이지 분량만 그린다
  function renderPatentList() {
    const area = document.getElementById('patent-result-area');
    if (!area) return;
    area.innerHTML = pageSlice('patent', _patentItems).map(p => renderPatentCard(p)).join('')
                   + pagerHtml('patent', _patentItems.length);
  }

  // 국가코드를 IRIS 입력용 이름으로 바꿔준다 (모르는 코드는 코드 그대로)
  function countryName(code) {
    if (!code) return '';
    const map = { KR: '한국', US: '미국', EP: '유럽', JP: '일본', CN: '중국', WO: 'PCT' };
    return map[code] ? code + ' ' + map[code] : code;
  }

  /* 특허 표 만들기 — 특허 전용 정보 구조를 유지한다. */
  function patentGrid(p) {
    const items = [
      ['출원번호',            p.applicationNumber],
      ['출원일',              p.applicationDate],
      ['등록번호',            p.registrationNumber],
      ['등록일',              p.registrationDate],
      ['출원인',              p.applicant],
      ['발명자',              p.inventors || '-'],
      ['출원/등록 국가',       countryName(p.country)],
      ['지식재산권 공개번호',   p.openNumber],
      ['지식재산권 공개일자',   p.openDate]
    ].filter(function (it) { return !!it[1]; });

    let out = '';
    items.forEach(function (it) {
      const safeVal = String(it[1]).replace(/"/g, '&quot;');
      out += '<div class="patent-cell">'
           + '<div class="patent-cell-l">' + it[0] + '</div>'
           + '<div class="patent-cell-v">' + esc(String(it[1]))
           + '<button class="cell-copy-btn" onclick="copySingleCell(this, this.dataset.v)" data-v="' + safeVal + '">복사</button>'
           + '</div></div>';
    });
    const rem = items.length % 3;
    if (rem !== 0) out += '<div class="patent-cell"></div>'.repeat(3 - rem);
    return '<div class="patent-grid">' + out + '</div>';
  }

  function renderPatentCard(p) {
    const title = p.title || '제목 없음';
    const titleSafe = title.replace(/"/g, '&quot;');
    const patentCopyText = [
      '발명의 명칭: ' + (p.title || ''),
      p.applicationNumber ? '출원번호: ' + p.applicationNumber : '',
      p.applicationDate ? '출원일: ' + p.applicationDate : '',
      p.registrationNumber ? '등록번호: ' + p.registrationNumber : '',
      p.registrationDate ? '등록일: ' + p.registrationDate : '',
      p.applicant ? '출원인: ' + p.applicant : '',
      p.inventors ? '발명자: ' + p.inventors : '',
      p.country ? '출원/등록 국가: ' + countryName(p.country) : '',
      p.openNumber ? '지식재산권 공개번호: ' + p.openNumber : '',
      p.openDate ? '지식재산권 공개일자: ' + p.openDate : '',
      p.status ? '상태: ' + p.status : ''
    ].filter(Boolean).join('\n');
    const patentCopySafe = esc(patentCopyText);
    return '<div class="patent-card">'
      + '<div class="patent-header">'
      + '<svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'
      + '<span>KIPRIS 데이터베이스</span>'
      + '<span class="patent-header-spacer"></span>'
      + (p.status ? '<span class="patent-status">' + esc(p.status) + '</span>' : '')
      + '<button class="copy-btn patent-copy-btn" onclick="copySingleCell(this, this.dataset.v)" data-v="' + patentCopySafe + '"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>특허정보 복사</button>'
      + '</div>'
      + '<div class="patent-title-row">'
      + '<div class="patent-title">' + esc(title) + '</div>'
      + '<button class="cell-copy-btn patent-title-copy" onclick="copySingleCell(this, this.dataset.v)" data-v="' + titleSafe + '">복사</button>'
      + '</div>'
      + patentGrid(p)
      + '</div>';
  }


  /* ── 특허 최근 조회 기록 (메모리 변수 = 새로고침하면 초기화) ── */
  let patentHistory = [];       // 페이지가 열려있는 동안만 유지. F5하면 빈 배열로 리셋됨.

  function savePatentHistory(title, query, type) {
    try {
      const filtered = patentHistory.filter(h => !(h.query === query && h.type === type));
      filtered.unshift({ title, query, type, date: new Date().toLocaleDateString('ko-KR') });
      patentHistory = filtered.slice(0, 10);
      renderPatentHistory();
    } catch(e) {}
  }

  function renderPatentHistory() {
    const el = document.getElementById('patent-history-list');
    if (!el) return;
    try {
      const hist = patentHistory;
      if (!hist.length) {
        el.innerHTML = '<p style="font-size:var(--fs-16);color:var(--tm);padding:8px 0;">조회 기록이 없습니다.</p>';
        return;
      }
      const typeLabel = { application: '출원번호', registration: '등록번호', word: '발명명칭' };
      el.innerHTML = hist.map(h =>
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);gap:10px;">'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:var(--fs-16);color:var(--tp);font-weight:var(--fw-medium);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(h.title) + '</div>'
        + '<div style="font-size:var(--fs-14);color:var(--tm);">' + (typeLabel[h.type] || '') + ' · ' + esc(h.query) + '</div>'
        + '</div>'
        + '<button onclick="reSearchPatent(this.dataset.q, this.dataset.t)" data-q="' + esc(h.query) + '" data-t="' + h.type + '" style="font-size:var(--fs-14);padding:3px 8px;border:1px solid var(--border2);border-radius:4px;background:var(--surface);cursor:pointer;color:var(--accent);flex-shrink:0;">다시 조회</button>'
        + '</div>'
      ).join('');
    } catch(e) {}
  }

  function reSearchPatent(query, type) {
    switchPatentSearch(type);
    const inputMap = { application: 'patent-app-input', registration: 'patent-reg-input', word: 'patent-word-input' };
    const el = document.getElementById(inputMap[type]);
    if (el) { el.value = query; searchPatent(); }
  }

  /* ── 특허 결과 초기화 ── */
  function clearPatentSearch() {
    ['patent-app-input','patent-reg-input','patent-word-input'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const area = document.getElementById('patent-result-area'); if (area) area.innerHTML = '';
    _patentItems = []; resetPage('patent');
    const bar = document.getElementById('patent-clear-bar'); if (bar) bar.style.display = 'none';
    updateFloatingClearBtn();
    window.scrollTo({ top: 0, behavior: 'smooth' });   // 검색창 위치로 부드럽게 올라감
  }

  /* ── 스크롤 따라다니는 고정 초기화 버튼 제어 ── */
  //  검색 결과가 있고(=해당 clear-bar가 보이고) 그 패널을 보고 있을 때만 표시.
  function updateFloatingClearBtn() {
    const fb = document.getElementById('floating-clear-btn');
    if (!fb) return;
    const doiPanelOn = document.getElementById('panel-doi')    && document.getElementById('panel-doi').classList.contains('active');
    const patPanelOn = document.getElementById('panel-patent') && document.getElementById('panel-patent').classList.contains('active');
    const doiBar = document.getElementById('doi-clear-bar');
    const patBar = document.getElementById('patent-clear-bar');
    const showForDoi = doiPanelOn && doiBar && doiBar.style.display === 'flex';
    const showForPat = patPanelOn && patBar && patBar.style.display === 'flex';
    fb.style.display = (showForDoi || showForPat) ? 'inline-flex' : 'none';
    adjustFloatingClearBtn();
  }

  /* 고정 버튼과 하단 버튼들(다시 조회 · 상담 게시판에 남기기)의 겹침 방지.
     화면 오른쪽 아래는 버튼이 몰려 있어 위로 밀어 올리면 또 다른 버튼과 겹친다.
     그래서 '최근 조회 기록' 영역이 화면에 들어오면(=결과 목록이 끝난 지점)
     고정 버튼을 부드럽게 감춘다. 위로 조금만 올리면 곧바로 다시 나타난다. */
  function adjustFloatingClearBtn() {
    const fb = document.getElementById('floating-clear-btn');
    if (!fb || fb.style.display === 'none') return;
    const patOn = document.getElementById('panel-patent')
               && document.getElementById('panel-patent').classList.contains('active');
    // 현재 보고 있는 패널의 '최근 조회 기록' 영역을 기준으로 삼는다
    const ref = document.getElementById(patOn ? 'patent-history-section' : 'history-section')
             || document.querySelector('.feedback-footer');
    if (!ref) return;
    const reached = ref.getBoundingClientRect().top < window.innerHeight - 8;
    fb.style.opacity       = reached ? '0' : '1';
    fb.style.pointerEvents = reached ? 'none' : 'auto';
  }

  // 스크롤·창 크기 변화에 맞춰 위치 갱신 (버벅임 방지를 위해 프레임 단위로 처리)
  let _fbTick = false;
  function _onScrollAdjust() {
    if (_fbTick) return;
    _fbTick = true;
    requestAnimationFrame(function () { adjustFloatingClearBtn(); _fbTick = false; });
  }
  window.addEventListener('scroll', _onScrollAdjust, { passive: true });
  window.addEventListener('resize', _onScrollAdjust);

  //  현재 보고 있는 패널(논문/특허)의 검색 결과를 초기화
  function clearActiveSearch() {
    const doiPanelOn = document.getElementById('panel-doi')    && document.getElementById('panel-doi').classList.contains('active');
    const patPanelOn = document.getElementById('panel-patent') && document.getElementById('panel-patent').classList.contains('active');
    if (doiPanelOn) clearDoiSearch();
    else if (patPanelOn) clearPatentSearch();
    updateFloatingClearBtn();
  }

  /* ── 패널 재진입 시 초기화 (다른 메뉴 갔다 오면 새로고침한 것처럼 깨끗하게) ── */
  //  검색 결과·입력창·최근 조회 기록까지 처음 상태로 되돌린다. (스크롤 이동은 하지 않음)
  function resetDoiPanel() {
    const di = document.getElementById('doi-input');   if (di) di.value = '';
    const ti = document.getElementById('title-input'); if (ti) ti.value = '';
    const sr = document.getElementById('sr-area');     if (sr) sr.innerHTML = '';
    window._srItems = []; resetPage('paper');   // 보관된 검색 결과·페이지도 초기화
    const ra = document.getElementById('result-area'); if (ra) ra.innerHTML = '';
    const bar = document.getElementById('doi-clear-bar'); if (bar) bar.style.display = 'none';
    doiHistory = [];
    renderHistory();
    updateFloatingClearBtn();
  }

  function resetPatentPanel() {
    ['patent-app-input','patent-reg-input','patent-word-input'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const area = document.getElementById('patent-result-area'); if (area) area.innerHTML = '';
    _patentItems = []; resetPage('patent');
    const bar = document.getElementById('patent-clear-bar'); if (bar) bar.style.display = 'none';
    patentHistory = [];
    renderPatentHistory();
    updateFloatingClearBtn();
  }


