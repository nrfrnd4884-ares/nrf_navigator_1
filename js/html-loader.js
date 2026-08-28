/* Assemble the SPA from reusable HTML fragments. */
(function loadMarkup() {
  const targets = {
    '#app-header': ['header.html'],
    '#app-panels': ['home.html', 'doi.html', 'chat.html', 'patent.html', 'notice.html', 'iris.html', 'faq.html', 'board.html'],
    '#app-feedback': ['feedback.html'],
    '#app-floating': ['floating-clear.html']
  };

  async function loadGroup(selector, files) {
    const target = document.querySelector(selector);
    const fragments = await Promise.all(files.map(file => fetch('pages/' + file).then(response => {
      if (!response.ok) throw new Error('HTML fragment load failed: ' + file);
      return response.text();
    })));
    target.innerHTML = fragments.join('\n');
  }

  window.appMarkupReady = Promise.all(
    Object.entries(targets).map(([selector, files]) => loadGroup(selector, files))
  ).catch(error => {
    console.error(error);
    document.body.insertAdjacentHTML('beforeend', '<p class="board-empty">화면 구성 파일을 불러오지 못했습니다.</p>');
  });
})();
