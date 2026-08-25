  let _faqData = [];
  let _faqCat  = '전체';

  async function loadFaqData() {
    try {
      const res  = await fetch(APPS_SCRIPT_URL + '?action=faq');
      const json = await res.json();
      _faqData = (json.items || []).filter(f => !isHiddenValue(f.use));
      buildFaqFilters();
      renderFAQ();
    } catch(e) {
      document.getElementById('faq-list').innerHTML = '<div class="board-empty">FAQ를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</div>';
    }
  }

  function buildFaqFilters() {
    const cats = ['전체', ...new Set(_faqData.map(f => f.cat).filter(Boolean))];
    const bar  = document.getElementById('faq-filter-bar');
    bar.innerHTML = '';
    cats.forEach((c, i) => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (i===0?' active':'');
      btn.textContent = c;
      btn.addEventListener('click', () => faqFilter(c, btn));
      bar.appendChild(btn);
    });
  }

  let _faqKeyword = '';

  function faqSearch(val) {
    resetPage('faq');
    _faqKeyword = val.trim().toLowerCase();
    // 검색 시 필터 전체로 리셋
    if (_faqKeyword) {
      _faqCat = '전체';
      document.querySelectorAll('#faq-filter-bar .cat-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('#faq-filter-bar .cat-btn').classList.add('active');
    }
    renderFAQ();
  }

  function faqFilter(cat, btn) {
    resetPage('faq');
    _faqCat = cat;
    _faqKeyword = '';
    document.getElementById('faq-search').value = '';
    document.querySelectorAll('#faq-filter-bar .cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderFAQ();
  }

  function renderFAQ() {
    let items = _faqCat === '전체' ? _faqData : _faqData.filter(f => f.cat === _faqCat);
    if (_faqKeyword) {
      items = items.filter(f =>
        f.q.toLowerCase().includes(_faqKeyword) ||
        f.a.toLowerCase().includes(_faqKeyword)
      );
    }
    if (!items.length) {
      document.getElementById('faq-list').innerHTML = '<div class="board-empty">해당 카테고리에 FAQ가 없습니다.</div>';
      return;
    }
    document.getElementById('faq-list').innerHTML = pageSlice('faq', items).map(f =>
      '<div class="faq-item"><div class="faq-q"><span class="faq-badge">' + esc(f.cat||'기타') + '</span>'
      + '<span class="faq-question">' + esc(f.q) + '</span>'
      + '<span class="faq-toggle">+</span></div>'
      + '<div class="faq-answer">' + esc(f.a) + '</div>'
      + '</div>'
    ).join('') + pagerHtml('faq', items.length);
    document.querySelectorAll('.faq-q').forEach(q => {
      q.addEventListener('click', () => q.parentElement.classList.toggle('open'));
    });
  }



  

  /* ── AI 챗봇 ── */
  let   FAQ_CONTEXT = '학습데이터를 불러오는 중입니다...';

  // Sheets에서 학습데이터 로드
  async function loadFaqFromSheets() {
    try {
      const res  = await fetch(APPS_SCRIPT_URL + '?action=faq');
      const json = await res.json();
      if (json.items && json.items.length) {
        FAQ_CONTEXT = json.items.map(f =>
          (f.cat ? '[' + f.cat + '] ' : '') + f.q + ' → ' + f.a
        ).join('\n');
      } else {
        FAQ_CONTEXT = '(학습데이터 없음)';
      }
    } catch(e) {
      FAQ_CONTEXT = '(학습데이터 로드 실패)';
    }
  }

  function getSystemPrompt() {
    return '당신은 국가연구개발 성과입력 전문 AI 상담사입니다.\n'
      + '국가연구개발혁신법, IRIS 시스템, 연구개발 성과관리(논문·특허·보고서 등록, 기여율, 사사표기 등) 관련 질문에 친절하고 정확하게 한국어로 답변하세요.\n'
      + '\n'
      + '[중요 규칙]\n'
      + '1. 법 조항 번호(예: 제16조, 제32조)나 구체적인 수치를 언급할 때는 확실하지 않으면 절대 쓰지 마세요.\n'
      + '2. 법령이 불확실한 경우 "관련 법령을 직접 확인하시거나 콜센터로 문의하세요"라고 안내하세요.\n'
      + '3. 모르는 내용은 모른다고 솔직하게 말하세요. 추측으로 답변하지 마세요.\n'
      + '4. 모든 답변 마지막에는 "※ 정확한 내용은 성과조사콜센터(042-869-6677)로 확인하시기 바랍니다."를 추가하세요.';
  }

  let chatHistory = [];
  const MAX_HISTORY_MSGS = 10;   // AI에게 함께 보낼 '최근 대화' 개수 = 10개 (질문5 + 답변5 = 5번 주고받기). 토큰 과다 사용 방지용

  // "새 대화" — 기록을 모두 지우고 처음 인사말 상태로 되돌림
  function resetChat() {
    chatHistory = [];
    const area = document.getElementById('chat-messages');
    if (area) {
      area.innerHTML = '<div class="chat-msg bot"><div class="chat-bubble bot">안녕하세요! 국가연구개발 성과입력 AI 상담 챗봇입니다.<br>성과 등록·관리 관련 궁금한 점을 질문해 주세요 😊</div></div>';
    }
    const input = document.getElementById('chat-input');
    if (input) input.focus();
  }

  async function sendChat() {
    const input = document.getElementById('chat-input');
    const q = input.value.trim();
    if (!q) return;

    input.value = '';
    input.style.height = '44px';

    appendChatMsg('user', q);
    const typingId = appendTyping();

    const btn = document.getElementById('chat-send-btn');
    btn.disabled = true;

    // 이번 질문을 대화 기록에 추가
    chatHistory.push({ role: 'user', parts: [{ text: q }] });

    // 최근 대화만 잘라서 보냄 (비용 관리). 반드시 '사용자' 발화로 시작하도록 정리
    let toSend = chatHistory.slice(-MAX_HISTORY_MSGS);
    while (toSend.length && toSend[0].role !== 'user') toSend.shift();

    try {
      // Apps Script 프록시 → Gemini File Search(RAG). '이전 대화 포함'해서 POST로 전송
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        // text/plain 으로 보내야 Apps Script가 CORS 오류 없이 받습니다
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'chat', history: toSend })
      });
      const data = await res.json();
      const answer = data.answer || (data.error && data.error.includes('429') ? '요청이 너무 많습니다. 1분 후 다시 시도해 주세요.' : data.error) || '답변을 가져오지 못했습니다. 다시 시도해 주세요.';
      removeTyping(typingId);
      appendChatMsg('bot', answer);
      chatHistory.push({ role: 'model', parts: [{ text: answer }] });
    } catch(e) {
      removeTyping(typingId);
      appendChatMsg('bot', '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      chatHistory.pop();   // 답을 못 받은 이번 질문은 기록에서 되돌려 다음 대화가 꼬이지 않게 함
    }
    btn.disabled = false;
    input.focus();
  }

  function appendChatMsg(role, text) {
    const area = document.getElementById('chat-messages');
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg ' + role;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + role;
    bubble.innerHTML = esc(text).replace(/\n/g, '<br>');
    wrap.appendChild(bubble);
    area.appendChild(wrap);
    area.scrollTop = area.scrollHeight;
  }

  function appendTyping() {
    const area = document.getElementById('chat-messages');
    const id = 'typing-' + Date.now();
    const wrap = document.createElement('div');
    wrap.className = 'chat-msg bot';
    wrap.id = id;
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bot';
    bubble.innerHTML = '<div class="chat-typing"><span></span><span></span><span></span></div>';
    wrap.appendChild(bubble);
    area.appendChild(wrap);
    area.scrollTop = area.scrollHeight;
    return id;
  }

  function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  // 입력창 자동 높이 조절
  window.appMarkupReady.then(() => {
    const ta = document.getElementById('chat-input');
    if (ta) {
      ta.addEventListener('input', function() {
        this.style.height = '44px';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      });
    }
  });

