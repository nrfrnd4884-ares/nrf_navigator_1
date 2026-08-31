/* JavaScript entry point: load feature modules in dependency order. */
(function loadFeatureScripts() {
  const scripts = [
    'navigation.js',
    'papers.js',
    'board.js',
    'faq-chat.js',
    'notices.js',
    'patents.js',
    'ui.js'
  ];
  // 기능 스크립트가 모두 실행을 마칠 때까지 appMarkupReady 완료를 늦춘다.
  //  (HTML 조각 fetch와 스크립트 로드는 서로 독립적인 비동기 작업이라,
  //   조각이 먼저 준비되면 아직 로드되지 않은 스크립트의 전역 함수를 호출해 에러가 날 수 있음)
  const scriptsLoaded = Promise.all(scripts.map(name => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'js/' + name + '?v=20260831-3';
    script.async = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error('스크립트 로드 실패: ' + name));
    document.head.appendChild(script);
  })));
  window.appMarkupReady = Promise.all([window.appMarkupReady, scriptsLoaded]).then(() => {});
})();
