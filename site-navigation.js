/* Shared navigation and image inspection. Existing business actions stay in their original handlers. */
(() => {
  if (window.__timelineNavigation || !window.HTMLDialogElement) return;
  window.__timelineNavigation = true;
  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };
  const button = (text, action) => {
    const element = make('button', '', text);
    element.type = 'button';
    element.addEventListener('click', action);
    return element;
  };
  const index = make('dialog', 'site-index');
  index.setAttribute('aria-labelledby', 'site-index-title');
  const heading = make('div', 'reference-dialog-heading');
  const title = make('h2', '', '功能索引');
  title.id = 'site-index-title';
  heading.append(title, button('关闭', () => index.close()));
  const search = make('input', 'site-index-search');
  search.type = 'search';
  search.placeholder = '搜索功能名称…';
  search.setAttribute('aria-label', '搜索本站功能');
  const results = make('nav', 'site-index-results');
  results.setAttribute('aria-label', '搜索结果');
  const resultStatus = make('p', 'site-index-status');
  resultStatus.setAttribute('role', 'status');
  const hint = make('p', 'site-index-hint', 'Ctrl / ⌘ + K 打开 · ↑ ↓ 选择 · Enter 进入 · Esc 关闭');
  index.append(heading, search, resultStatus, results, hint);
  document.body.append(index);
  let entries = [];
  function collectEntries() {
    const selector = document.body.classList.contains('public-ui')
      ? '.top-actions button, .top-actions a, .dashboard-shortcuts a'
      : '.admin-nav a, .admin-nav button, .workspace-directory a, main > header a, main > header button';
    const unique = new Set();
    const controls = [...document.querySelectorAll(selector)].filter(element => {
      const label = element.textContent.trim();
      if (!label || element === launcher || element.disabled || element.closest('[hidden]') || !element.getClientRects().length || unique.has(label)) return false;
      unique.add(label);
      return true;
    }).map(element => ({ label: element.textContent.trim(), activate: () => { element.focus(); element.click(); } }));
    if (document.body.classList.contains('ops-ui')) {
      for (const heading of document.querySelectorAll('main > section:not([hidden]) > h2')) {
        const label = heading.textContent.trim();
        if (!label || unique.has(label)) continue;
        unique.add(label);
        controls.push({ label, activate: () => {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
          heading.scrollIntoView({ block: 'center', behavior: 'instant' });
        } });
      }
    }
    return controls;
  }
  function renderResults() {
    results.replaceChildren();
    const query = search.value.trim().toLocaleLowerCase();
    const matches = entries.filter(entry => entry.label.toLocaleLowerCase().includes(query));
    resultStatus.textContent = matches.length ? `${matches.length} 个可用入口` : '没有找到功能，请换一个关键词。';
    for (const { label, activate } of matches) {
      const action = button(label, () => {
        index.close();
        // Use the actual control: login, confirmation, drafts and permissions keep their existing flow.
        requestAnimationFrame(activate);
      });
      action.className = 'site-index-result';
      results.append(action);
    }
  }
  function openIndex() {
    if (index.open || document.querySelector('dialog[open], .modal:not([hidden])')) return;
    entries = collectEntries();
    search.value = '';
    renderResults();
    index.showModal();
    search.focus();
  }
  const launcher = button('功能索引', openIndex);
  launcher.className = 'site-index-launcher';
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-keyshortcuts', 'Control+k Meta+k');
  launcher.title = '功能索引（Ctrl / ⌘ + K）';
  const placement = document.querySelector('.top-actions, .admin-nav, main > header');
  if (placement) placement.append(launcher);
  search.addEventListener('input', renderResults);
  index.addEventListener('keydown', event => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const actions = [...results.querySelectorAll('button')];
    if (!actions.length) return;
    event.preventDefault();
    const current = actions.indexOf(document.activeElement);
    const next = current < 0 ? (event.key === 'ArrowDown' ? 0 : actions.length - 1)
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + actions.length) % actions.length;
    actions[next].focus();
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      if (index.open) { event.preventDefault(); index.close(); }
      else if (!document.querySelector('dialog[open], .modal:not([hidden])')) { event.preventDefault(); openIndex(); }
    }
  });

  const viewer = make('dialog', 'site-image-viewer');
  viewer.setAttribute('aria-labelledby', 'site-image-title');
  const imageHeading = make('div', 'reference-dialog-heading');
  const imageTitle = make('h2', '', '活动图片');
  imageTitle.id = 'site-image-title';
  imageHeading.append(imageTitle, button('关闭', () => viewer.close()));
  const viewport = make('div', 'site-image-viewport');
  viewport.tabIndex = 0;
  viewport.setAttribute('aria-label', '图片区域，放大后可滚动查看');
  const fullImage = make('img');
  fullImage.draggable = false;
  viewport.append(fullImage);
  const controls = make('div', 'site-image-controls');
  const zoomStatus = make('output', 'site-image-zoom');
  zoomStatus.setAttribute('aria-live', 'polite');
  let zoom = 1;
  const minus = button('缩小', () => setZoom(zoom - .25));
  const plus = button('放大', () => setZoom(zoom + .25));
  function setZoom(value) {
    zoom = Math.max(1, Math.min(3, value));
    fullImage.style.width = `${zoom * 100}%`;
    zoomStatus.textContent = `${Math.round(zoom * 100)}%`;
    minus.disabled = zoom === 1;
    plus.disabled = zoom === 3;
  }
  controls.append(minus, zoomStatus, plus, button('还原', () => setZoom(1)));
  const imageMessage = make('p', 'site-index-status');
  imageMessage.setAttribute('role', 'status');
  fullImage.addEventListener('load', () => { imageMessage.textContent = '保持原图比例；放大后可上下、左右滚动查看。'; });
  fullImage.addEventListener('error', () => { imageMessage.textContent = '图片加载失败，请关闭后重试，或查看活动公告。'; });
  viewer.append(imageHeading, viewport, controls, imageMessage);
  document.body.append(viewer);
  viewer.addEventListener('close', () => fullImage.removeAttribute('src'));
  const decorated = new WeakSet();
  function decorateImages() {
    for (const image of document.querySelectorAll('.milestone-card img, .activity-dialog img')) {
      if (decorated.has(image) || image.closest('a')) continue;
      decorated.add(image);
      const inspect = button('查看大图', () => {
        if (viewer.open) return;
        imageTitle.textContent = image.alt || '活动图片';
        fullImage.alt = image.alt || '活动图片';
        imageMessage.textContent = '正在加载图片…';
        setZoom(1);
        fullImage.src = image.currentSrc || image.src;
        viewer.showModal();
        viewport.scrollTo(0, 0);
      });
      inspect.className = 'image-inspect';
      inspect.setAttribute('aria-label', `查看大图：${image.alt || '活动图片'}`);
      image.after(inspect);
    }
  }
  let scheduled = false;
  const observer = new MutationObserver(records => {
    if (scheduled || !records.some(record => [...record.addedNodes].some(node => node.nodeType === 1))) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; decorateImages(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  decorateImages();
})();
