window.appMarkupReady.then(() => {
  /* ── 드롭다운 토글 ── */
  function toggleDropdown(btn) {
    const group = btn.closest('.nav-group');
    const isOpen = group.classList.contains('open');
    // 모든 드롭다운 닫기
    document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));
    document.querySelectorAll('.nav-group-btn').forEach(b => { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
    if (!isOpen) {
      group.classList.add('open');
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
  }
  window.toggleDropdown = toggleDropdown;

  // 외부 클릭 시 드롭다운 닫기
  document.addEventListener('click', e => {
    if (!e.target.closest('.nav-group')) {
      document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));
      document.querySelectorAll('.nav-group-btn').forEach(b => { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
    }
  });


/* ── UI 보강 스크립트 (2026-07) ─────────────────────────────
   원본 기능 코드는 위쪽 스크립트 블록에 그대로 있고, 여기는
   모바일 메뉴·키보드 접근성만 담당합니다. 백엔드 연동과 무관. */
(function () {
  var btn = document.getElementById('nav-toggle');
  var nav = document.getElementById('main-nav');

  function closeMenu() {
    if (!nav) return;
    nav.classList.remove('open');
    if (btn) {
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-label', '메뉴 열기');
    }
  }

  if (btn && nav) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = nav.classList.toggle('open');
      btn.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    });

    // 메뉴 항목을 고르면 자동으로 닫기 (그룹 펼침 버튼은 제외)
    nav.addEventListener('click', function (e) {
      if (e.target.closest('.nav-tab, .nav-dropdown-item')) closeMenu();
    });

    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target) && !btn.contains(e.target)) closeMenu();
    });
  }

  // 홈 카드: div라서 Tab 이동이 안 되던 문제 → Enter/Space로 실행
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest && e.target.closest('.home-card');
    if (card) { e.preventDefault(); card.click(); }
  });

  // ESC — 열린 메뉴 닫기 (질문 모달은 네이티브 <dialog>가 Esc를 자동 처리함)
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    closeMenu();
  });
})();

});
