  /* ── DOI 검색 ── */
  function fillDoi(doi) { document.getElementById('doi-input').value = doi; doSearchDoi(); }
  async function doSearchDoi() {
    const raw = document.getElementById('doi-input').value.trim();
    if (!raw) { document.getElementById('doi-input').focus(); return; }
    document.getElementById('doi-clear-bar').style.display = 'flex';
    updateFloatingClearBtn();
    const doi = raw.replace(/^https?:\/\/doi\.org\//i,'').replace(/^doi:\s*/i,'').trim();
    const btn = document.getElementById('doi-btn');
    document.getElementById('sr-area').innerHTML = '';
    setLoading('result-area', 'CrossRef에서 조회 중...'); btn.disabled = true;
    try {
      const res = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi));
      if (res.status === 404) throw {type:'notfound'};
      if (!res.ok) throw {type:'network'};
      const json = await res.json();
      renderResult(json.message, doi);
    } catch(e) { showError('result-area', e); }
    btn.disabled = false;
  }

  /* ── 논문 결과 초기화 ── */
  function clearDoiSearch() {
    const di = document.getElementById('doi-input');   if (di) di.value = '';
    const ti = document.getElementById('title-input'); if (ti) ti.value = '';
    const sr = document.getElementById('sr-area');     if (sr) sr.innerHTML = '';
    window._srItems = []; resetPage('paper');   // 보관된 검색 결과·페이지도 초기화
    const ra = document.getElementById('result-area'); if (ra) ra.innerHTML = '';
    const bar = document.getElementById('doi-clear-bar'); if (bar) bar.style.display = 'none';
    updateFloatingClearBtn();
    window.scrollTo({ top: 0, behavior: 'smooth' });   // 검색창 위치로 부드럽게 올라감
  }

  /* ── 제목 검색 ── */
  async function doSearchTitle() {
    const q = document.getElementById('title-input').value.trim();
    if (!q) { document.getElementById('title-input').focus(); return; }
    document.getElementById('doi-clear-bar').style.display = 'flex';
    updateFloatingClearBtn();
    const btn = document.getElementById('title-btn');
    resetPage('paper');
    document.getElementById('result-area').innerHTML = '';
    setLoading('sr-area', '논문 검색 중...'); btn.disabled = true;
    try {
      const url = 'https://api.crossref.org/works?query.title=' + encodeURIComponent(q) + '&rows=30&select=DOI,title,container-title,published,author,type,volume,issue';
      const res = await fetch(url);
      if (!res.ok) throw {type:'network'};
      const json = await res.json();
      const items = json.message.items || [];
      if (!items.length) { document.getElementById('sr-area').innerHTML = '<div class="error-card"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>검색 결과가 없습니다. 다른 키워드로 시도해보세요.</p></div>'; btn.disabled = false; return; }
      renderSearchList(items);
    } catch(e) { showError('sr-area', e); }
    btn.disabled = false;
  }

  function renderSearchList(items) {
    window._srItems = items;      // 전체 결과 보관 (선택 시 번호로 참조)
    renderSearchListPage();
  }

  // 보관된 결과 중 현재 페이지 분량만 그린다
  function renderSearchListPage() {
    const items = window._srItems || [];
    if (!items.length) return;
    const pageItems = pageSlice('paper', items);
    const offset = (_pageNo.paper - 1) * perPage('paper');   // ※ pageSlice 뒤에 계산해야 정확
    let html = '<div class="search-results"><div class="sr-header"><span class="sr-title">검색 결과 ' + items.length + '건 — 해당 논문을 선택하세요</span></div><div class="sr-list">';
    pageItems.forEach((w, idx) => {
      const i = offset + idx;     // 전체 목록 기준 번호 → selectItem 이 올바른 논문을 집도록
      const title   = esc(stripTags((w.title && w.title[0]) || '제목 없음'));
      const journal = esc((w['container-title'] && w['container-title'][0]) || '');
      const doi     = esc(w.DOI || '');
      const parts   = w.published?.['date-parts'] || w['published-print']?.['date-parts'] || w['published-online']?.['date-parts'];
      const year    = (parts && parts[0] && parts[0][0]) ? parts[0][0] : '';
      const vol     = w.volume ? w.volume + '권' : '';
      const iss     = w.issue  ? w.issue + '호'  : '';
      const type    = w.type === 'journal-article' ? '학술지 논문' : (w.type || '');
      html += '<div class="sr-item" onclick="selectItem(' + i + ')">'
        + '<div class="sr-item-title">' + title + '</div>'
        + '<div class="sr-item-meta">'
        + (journal ? '<span>' + journal + '</span>' : '')
        + (year ? '<span>' + year + '</span>' : '')
        + (vol || iss ? '<span>' + [vol, iss].filter(Boolean).join(' ') + '</span>' : '')
        + (doi ? '<span style="font-family:monospace;font-size:var(--fs-14);">' + doi + '</span>' : '')
        + '</div></div>';
    });
    html += '</div></div>';
    html += pagerHtml('paper', items.length);
    document.getElementById('sr-area').innerHTML = html;
  }

  async function selectItem(idx) {
    const w = window._srItems[idx];
    const doi = w.DOI;
    if (!doi) return;
    setLoading('result-area', '상세 정보 조회 중...');
    document.getElementById('sr-area').innerHTML = '';
    try {
      const res = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi));
      if (!res.ok) throw {type:'network'};
      const json = await res.json();
      renderResult(json.message, doi);
    } catch(e) { showError('result-area', e); }
  }

  /* ── 결과 렌더 ── */
  function renderResult(w, doi) {
    const title       = stripTags((w.title && w.title[0]) || '제목 정보 없음');
    const journal     = (w['container-title'] && w['container-title'][0]) || null;
    const publisher   = w.publisher || null;
    const volume      = w.volume || null;
    const issue       = w.issue  || null;
    const pageRaw     = w.page   || null;
    const pageStart   = pageRaw ? pageRaw.split('-')[0].trim() : null;
    const pageEnd     = pageRaw ? (pageRaw.split('-')[1] || '').trim() || null : null;
    const type        = w.type || null;
    const typeLabels  = {'journal-article':'학술지 논문','proceedings-article':'학술대회 논문','book-chapter':'도서 챕터','book':'단행본','report':'보고서','dataset':'데이터셋'};
    const issnRaw     = w.ISSN || [];
    const issnType    = w['issn-type'] || [];
    const pubDate     = formatDate(w['published-print']?.['date-parts']) || formatDate(w.published?.['date-parts']) || null;
    const onlineDate  = formatDate(w['published-online']?.['date-parts']) || null;
    const acceptDate  = formatDate(w.accepted?.['date-parts']) || null;
    const cited       = w['is-referenced-by-count'] ?? null;
    const refs        = w['references-count'] ?? null;
    const authors     = w.author || [];
    const isIntl      = detectIntl(authors);
    const abstractRaw = w.abstract ? stripTags(w.abstract) : null;
    const subjects    = w.subject || [];

    /* ISSN html */
    function issnHtml() {
      if (!issnRaw.length) return '<span class="cell-v muted">정보 없음</span>';
      return '<span class="cell-v">' + issnRaw.join(';') + '</span>';
    }

    /* 저자 html — 논문에 실린 순서대로 한 명씩 나열한다.
       ※ IRIS 는 저자를 순번대로 한 명씩 등록하므로, 여러 명을 쉼표로 묶어 두면
         복사한 뒤 손으로 잘라내야 한다. 그래서 1명 = 1칸 = 복사버튼 1개 구조로 둔다. */
    function authorsHtml() {
      if (!authors.length) {
        return '<div class="rc-grid">'
          + cell('저자', '<span class="cell-v muted">저자 정보 없음</span>')
          + cell('교신저자', '<span class="cell-v muted">원문 확인 필요</span>')
          + fillCells(2)
          + '</div>';
      }
      const getName = a => [(a.given||''),(a.family||'')].filter(Boolean).join(' ') || a.name || '';
      const isCorr  = a => !!(a.role && String(a.role).toLowerCase().includes('corresponding')) || !!(a.suffix && String(a.suffix).includes('†'));
      const corrA   = authors.find(a => isCorr(a));

      let out = '<div class="rc-grid">';
      let n = 0;                       // 실제로 그린 칸 수 (빈 칸 계산용)
      authors.forEach(function (a, i) {
        const nm = getName(a);
        if (!nm) return;
        // 역할 표시: 제1저자(첫 번째) / 교신저자(제공되는 드문 경우)
        const roles = [];
        if (a.sequence === 'first' || i === 0) roles.push('제1저자');
        if (isCorr(a)) roles.push('교신저자');
        const label = (i + 1) + (roles.length ? ' · ' + roles.join(' · ') : '');
        out += cell(label, esc(nm), false, nm);
        n++;
      });
      // CrossRef는 교신저자 정보를 거의 제공하지 않는다(스키마 5.5부터 지원 시작, 보급 전).
      //  못 찾았을 때는 '-' 대신 어디서 확인할지 알려준다.
      if (!corrA) {
        out += cell('교신저자', '<span class="cell-v muted">원문 확인 필요</span>');
        n++;
      }
      return out + fillCells(n) + '</div>';
    }

    /* 복사 데이터 */
    _copyData = { title, journal, publisher, volume, issue, pageStart, pageEnd, pubDate, onlineDate, acceptDate, doi,
      issn: issnRaw.join(', '), cited, abstract: abstractRaw || '',
      authors: authors.map(a => [(a.given||''),(a.family||'')].filter(Boolean).join(' ') || a.name||'').filter(Boolean) };

    /* 렌더 */
    let h = '<div class="result-card">';

    /* 헤더 */
    h += '<div class="rc-header"><div class="rc-header-left"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg><span>조회 완료 — CrossRef 데이터베이스</span></div>';
    h += '<button class="copy-btn" id="copy-btn" onclick="copyInfo()"><svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>서지정보 복사</button></div>';

    /* 권/호 확정 여부 판단 */
    const hasVolume  = !!volume;
    const hasIssue   = !!issue;
    const hasPage    = !!pageStart;
    const hasPrint   = !!(w['published-print']?.['date-parts']);
    const isOnlineOnly = !hasPrint && !!onlineDate;

    // 성과 인정 가능 여부: 권 또는 호 중 하나라도 있으면 확정 (페이지 무관)
    const canRegister = hasVolume || hasIssue;

    /* 제목 */
    h += '<div class="rc-title-area">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">'
      + '<div class="rc-title">' + esc(title) + '</div>'
      + '<button class="cell-copy-btn" style="font-size:var(--fs-14);padding:3px 10px;flex-shrink:0;margin-top:4px;" onclick="copySingleCell(this, this.dataset.v)" data-v="' + title.replace(/"/g,'&quot;') + '">복사</button>'
      + '</div>'
      + '</div>';

    /* 성과 인정 가능 여부 배너 */
    if (!canRegister) {
      const warnMsg = '<strong>성과 등록 전 확인 필요</strong><br>권(호) 정보가 확정되지 않았습니다. Accepted, Early Access, Preprint 등 출판 전 단계의 논문은 성과로 인정되지 않습니다. <strong>권 또는 호가 확정된 최종 출판 이후</strong> 등록하시기 바랍니다.';
      h += '<div class="warn-banner"><svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg><p>' + warnMsg + '</p></div>';
    } else {
      h += '<div class="ok-banner"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg><p>권/호 및 출판 정보가 확정된 논문입니다. 성과 등록이 가능합니다.</p></div>';
    }

    h += '<div class="rc-body">';

    /* 성과 정보 섹션 */
    h += '<div class="rc-section"><div class="rc-section-head">성과 정보</div><div class="rc-grid">';

    /* ※ IRIS 는 시작/종료 페이지, 권/호를 각각 다른 칸에 입력하므로 나누어 보여준다.
         (합쳐서 보여주면 복사 후 손으로 잘라내야 함) */

    /* 행1: 게재 시작 페이지 / 게재 종료 페이지 / SCIE 구분 */
    h += cell('게재 시작 페이지', pageStart ? esc(pageStart) : '-');
    h += cell('게재 종료 페이지', pageEnd   ? esc(pageEnd)   : '-');
    h += cell('SCIE 구분', '<span class="cell-v muted">직접 입력 필요</span>');

    /* ※ 전체폭 칸을 쓰지 않는다. 전체폭 칸이 있으면 그 줄에 세로선이 생기지 않고
         복사 버튼도 멀리 떨어져 다른 칸과 어긋나 보이기 때문. */

    /* 행2: 학술지명 / 권 / 호 */
    h += cell('학술지명', journal ? esc(journal) : '-');
    h += cell('권', volume ? esc(volume) : '-');
    h += cell('호', issue  ? esc(issue)  : '-');

    /* 행3: ISSN / 학술지 구분 / 학술지 게재일자 */
    const gaejae = acceptDate || onlineDate;
    h += cell('ISSN', issnHtml(), false, issnRaw.join(';'));
    h += cell('학술지 구분', '<span class="cell-v muted">직접 입력 필요</span>');
    h += cell('학술지 게재일자', gaejae ? esc(gaejae) + (onlineDate && !acceptDate ? ' <span style="font-size:var(--fs-14);color:var(--tm);">(온라인)</span>' : '') : '-');

    /* 행4: 학술지 출판일자 / 발행국가 / 국제공동연구 */
    h += cell('학술지 출판일자', pubDate ? esc(pubDate) : '-');
    h += cell('발행국가', '<span class="cell-v muted">직접 입력 필요</span>');
    if (isIntl !== null) {
      h += cell('국제공동연구', isIntl ? '<span class="badge b-intl">예</span>' : '<span class="badge b-dom">아니오</span>');
    } else {
      h += cell('국제공동연구', '<span class="cell-v muted">소속 데이터 없음</span>');
    }

    /* 행5: DOI + 빈 칸 (총 13칸이라 마지막 줄을 빈 칸으로 채움) */
    h += cell('DOI 번호', '<span class="cell-v mono">' + esc(doi) + '</span>', false, doi);
    h += fillCells(13);

    h += '</div></div>'; /* rc-grid, rc-section */

    /* 초록 */
    if (abstractRaw) {
      h += '<div class="rc-section"><div class="rc-section-head">초록</div>'
        + '<div class="abstract-area"><div class="abstract-text clamped" id="abs-text">' + esc(abstractRaw) + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:6px;">'
        + '<button class="abstract-toggle" onclick="toggleAbstract(this)">전체 보기 ▾</button>'
        + '<button class="cell-copy-btn" style="font-size:var(--fs-15);padding:3px 10px;" onclick="copySingleCell(this, this.dataset.v)" data-v="' + abstractRaw.replace(/"/g,'&quot;') + '">복사</button>'
        + '</div></div></div>';
    }

    /* 저자 섹션 — 주저자/공동저자/교신저자 3줄 */
    h += '<div class="rc-section"><div class="rc-section-head">저자</div>' + authorsHtml() + '</div>';

    /* 주제 키워드 */
    if (subjects.length) {
      h += '<div class="rc-section"><div class="rc-section-head">주제 분야</div>'
        + '<div class="kw-wrap">' + subjects.map(s => '<span class="kw">' + esc(s) + '</span>').join('') + '</div></div>';
    }

    h += '</div></div>'; /* rc-body, result-card */
    document.getElementById('result-area').innerHTML = h;
    saveHistory(title, doi);
    renderHistory();
  }

  /* 3열 기준으로 모자란 칸을 빈 칸으로 채운다.
     칸이 없는 자리는 선도 그려지지 않아 표가 끊겨 보이므로, 빈 칸을 넣어 격자를 완성한다. */
  function fillCells(count) {
    const rem = count % 3;
    return rem === 0 ? '' : '<div class="rc-cell"></div>'.repeat(3 - rem);
  }

  function cell(label, val, full, copyVal) {
    const rawCopy = copyVal !== undefined ? copyVal : val.replace(/<[^>]*>/g,'').trim();
    const skip = !rawCopy || rawCopy.includes('직접 입력') || rawCopy.includes('원문 확인') || rawCopy.includes('데이터 없음') || rawCopy === '-';
    const valHtml = skip
      ? '<div class="cell-v">' + val + '</div>'
      : '<div class="cell-copy"><div class="cell-v">' + val + '</div><button class="cell-copy-btn" onclick="copySingleCell(this, this.dataset.v)" data-v="' + rawCopy.replace(/"/g, '&quot;') + '">복사</button></div>';
    return '<div class="rc-cell' + (full ? ' full' : '') + '"><div class="cell-l">' + label + '</div>' + valHtml + '</div>';
  }

  function copySingleCell(btn, text) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '완료!';
      btn.style.color = 'var(--success)';
      setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
    });
  }

  function toggleAbstract(btn) {
    const el = document.getElementById('abs-text');
    el.classList.toggle('clamped');
    btn.textContent = el.classList.contains('clamped') ? '전체 보기 ▾' : '접기 ▴';
  }

  function setLoading(id, msg) {
    document.getElementById(id).innerHTML = '<div class="loading-wrap"><div class="spinner"></div><span>' + msg + '</span></div>';
  }

  function showError(id, e) {
    const msg = (e && e.type === 'notfound')
      ? '<strong>DOI를 찾을 수 없습니다.</strong><br>CrossRef에 등록되지 않았거나 오타가 있을 수 있습니다.'
      : '<strong>조회 중 오류가 발생했습니다.</strong><br>네트워크 연결을 확인하거나 잠시 후 다시 시도해 주세요.';
    document.getElementById(id).innerHTML = '<div class="error-card"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>' + msg + '</p></div>';
  }

  function copyInfo() {
    const d = _copyData;
    if (!d.title) return;
    const lines = [
      '논문명: '         + d.title,
      d.journal    ? '학술지명: '       + d.journal   : '',
      d.publisher  ? '발행기관: '       + d.publisher : '',
      d.volume     ? '볼륨(권): '       + d.volume    : '',
      d.issue      ? '호: '             + d.issue     : '',
      d.pageStart  ? '게재 시작 페이지: ' + d.pageStart : '',
      d.pageEnd    ? '게재 종료 페이지: ' + d.pageEnd   : '',
      d.issn       ? 'ISSN: '           + d.issn      : '',
      d.acceptDate ? '학술지 게재일자: '  + d.acceptDate : (d.onlineDate ? '학술지 게재일자: ' + d.onlineDate + ' (온라인)' : ''),
      d.pubDate    ? '학술지 출판일자: '  + d.pubDate   : '',
      d.authors && d.authors.length ? '저자: ' + d.authors.join(', ') : '',
      'DOI: https://doi.org/' + d.doi,
      d.abstract   ? '\n초록:\n' + d.abstract : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(lines).then(() => {
      const btn = document.getElementById('copy-btn');
      if (!btn) return;
      const orig = btn.innerHTML;
      btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg> 복사됨';
      btn.style.color = 'var(--success)';
      setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
    });
  }

