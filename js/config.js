/* Shared service configuration. */
window.APP_CONFIG = Object.freeze({
  // 게시판·FAQ용 Apps Script
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxBCsY6YcI0g1fFfsWOlOYUKdNS4V13pZ8yZBuZPudESiCCcj_0dPYCskPEx7J7ywJ0/exec',
  // 특허 API 프록시. 현재는 Apps Script의 patent action을 사용한다.
  // KIPRIS Open API를 연결하려면 이 값을 KIPRIS 연동 서버 주소로 교체해야 한다.
  patentApiUrl: 'https://script.google.com/macros/s/AKfycbxBCsY6YcI0g1fFfsWOlOYUKdNS4V13pZ8yZBuZPudESiCCcj_0dPYCskPEx7J7ywJ0/exec'
});
