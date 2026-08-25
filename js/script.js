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
  scripts.forEach(name => {
    const script = document.createElement('script');
    script.src = 'js/' + name;
    script.async = false;
    document.head.appendChild(script);
  });
})();
