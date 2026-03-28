/* Global Navigation Component - 动态路径版本 */

(function() {
  // 检测基础路径（适配 GitHub Pages）
  function getBasePath() {
    const path = window.location.pathname;
    // 如果路径包含 /could-coding/ 则使用它
    const match = path.match(/^(\/could-coding)/);
    if (match) return match[1];
    // 否则使用相对路径
    return '';
  }

  const base = getBasePath();
  
  const NAV_ITEMS = [
    { icon: '🏠', label: '首页', href: base + '/index.html', match: /\/index\.html$/ },
    { icon: '📊', label: 'Dashboard', href: base + '/dashboard/v2/index.html', match: /dashboard/ },
    { icon: '📝', label: '模考', href: base + '/exam/index.html', match: /\/exam\// },
    { icon: '🔥', label: '训练', href: base + '/training/index.html', match: /training/ },
    { icon: '🧠', label: '伴读', href: base + '/study-hub/index.html', match: /study-hub/ },
    { icon: '🤖', label: 'AI导师', href: base + '/ai-tutor/index.html', match: /ai-tutor/ }
  ];

  function getCurrentPage() {
    const path = window.location.pathname;
    for (const item of NAV_ITEMS) {
      if (item.match.test(path)) return item.href;
    }
    return base + '/index.html';
  }

  function renderNav() {
    const container = document.getElementById('global-nav-container');
    if (!container) return;
    
    const current = getCurrentPage();
    
    container.innerHTML = `
      <header class="global-nav">
        <div class="global-nav-inner">
          <a class="gn-brand" href="${base}/index.html">
            <span class="gn-brand-mark">AP</span>
            <div>
              <span class="gn-brand-title">Practice Website</span>
              <span class="gn-brand-sub">自用 AP 练习站</span>
            </div>
          </a>
          <nav class="gn-links" id="gn-links">
            ${NAV_ITEMS.map(item => `
              <a class="gn-link ${current === item.href ? 'active' : ''}" href="${item.href}">
                <span class="gn-link-icon">${item.icon}</span>
                ${item.label}
              </a>
            `).join('')}
          </nav>
          <div class="gn-right">
            <button class="gn-settings-btn" onclick="openSettings()" title="模型配置">⚙️</button>
            <button class="gn-hamburger" id="gn-hamburger">☰</button>
            <div class="gn-avatar">OC</div>
          </div>
        </div>
      </header>
    `;
    
    const hamburger = document.getElementById('gn-hamburger');
    const links = document.getElementById('gn-links');
    if (hamburger && links) {
      hamburger.addEventListener('click', () => links.classList.toggle('open'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNav);
  } else {
    renderNav();
  }
})();
