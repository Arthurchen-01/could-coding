/* Global Navigation Component
   在每个页面的 <body> 开头插入 <div id="global-nav-container"></div>
   然后引入此脚本即可自动渲染全局导航
*/

(function() {
  // 导航配置
  const NAV_ITEMS = [
    { icon: '🏠', label: '首页', href: '/index.html', match: /\/index\.html$/ },
    { icon: '📊', label: 'Dashboard', href: '/dashboard/v2/index.html', match: /dashboard/ },
    { icon: '📝', label: '模考', href: '/exam/index.html', match: /\/exam\// },
    { icon: '🔥', label: '训练', href: '/training/index.html', match: /training/ },
    { icon: '🧠', label: '伴读', href: '/study-hub/index.html', match: /study-hub/ },
    { icon: '🤖', label: 'AI导师', href: '/ai-tutor/index.html', match: /ai-tutor/ }
  ];

  // 检测当前页面，高亮对应导航
  function getCurrentPage() {
    const path = window.location.pathname;
    for (const item of NAV_ITEMS) {
      if (item.match.test(path)) return item.href;
    }
    return '/index.html';
  }

  // 渲染导航
  function renderNav() {
    const container = document.getElementById('global-nav-container');
    if (!container) return;
    
    const current = getCurrentPage();
    
    container.innerHTML = `
      <header class="global-nav">
        <div class="global-nav-inner">
          <a class="gn-brand" href="/index.html">
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
    
    // 移动端汉堡菜单
    const hamburger = document.getElementById('gn-hamburger');
    const links = document.getElementById('gn-links');
    if (hamburger && links) {
      hamburger.addEventListener('click', () => {
        links.classList.toggle('open');
      });
    }
  }

  // 自动渲染
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNav);
  } else {
    renderNav();
  }
})();
