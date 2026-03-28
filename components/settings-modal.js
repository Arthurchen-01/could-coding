/* Settings Modal - Core Logic */

// ============================================================
// 快捷预设
// ============================================================

const PRESETS = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    modelId: 'gemini-pro',
    label: 'Google Gemini'
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    modelId: 'gpt-4o',
    label: 'OpenAI GPT-4o'
  },
  claude: {
    baseUrl: 'https://api.anthropic.com/v1',
    modelId: 'claude-3-5-sonnet-20240620',
    label: 'Anthropic Claude'
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    modelId: 'deepseek-chat',
    label: 'DeepSeek'
  }
};

// ============================================================
// 初始化
// ============================================================

function initSettings() {
  // 加载配置到 UI
  loadConfigToUI();
  
  // 绑定事件
  document.getElementById('settings-close').addEventListener('click', closeSettings);
  document.getElementById('settings-save').addEventListener('click', saveConfigFromUI);
  document.getElementById('settings-reset').addEventListener('click', resetConfig);
  document.getElementById('key-toggle').addEventListener('click', toggleKeyVisibility);
  
  // 快捷预设
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = PRESETS[btn.dataset.preset];
      if (preset) {
        document.getElementById('config-base-url').value = preset.baseUrl;
        document.getElementById('config-model-id').value = preset.modelId;
        showStatus(`已切换到 ${preset.label}`);
      }
    });
  });
  
  // 点击遮罩关闭
  document.getElementById('settings-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'settings-overlay') {
      closeSettings();
    }
  });
}

// ============================================================
// UI 操作
// ============================================================

function loadConfigToUI() {
  const config = loadConfig();
  
  document.getElementById('config-base-url').value = config.baseUrl || '';
  document.getElementById('config-api-key').value = config.apiKey || '';
  document.getElementById('config-model-id').value = config.modelId || '';
  document.getElementById('config-system-prompt').value = config.systemPrompt || '';
}

function saveConfigFromUI() {
  const config = {
    baseUrl: document.getElementById('config-base-url').value.trim(),
    apiKey: document.getElementById('config-api-key').value.trim(),
    modelId: document.getElementById('config-model-id').value.trim(),
    systemPrompt: document.getElementById('config-system-prompt').value.trim()
  };
  
  saveConfig(config);
  showStatus('✅ 配置已保存到 localStorage');
  
  // 触发自定义事件，通知其他模块配置已更新
  window.dispatchEvent(new CustomEvent('api-config-updated', { detail: config }));
}

function resetConfig() {
  saveConfig(DEFAULT_CONFIG);
  loadConfigToUI();
  showStatus('🔄 已恢复默认配置');
}

function toggleKeyVisibility() {
  const input = document.getElementById('config-api-key');
  const btn = document.getElementById('key-toggle');
  
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

function showStatus(message) {
  const status = document.getElementById('settings-status');
  status.textContent = message;
  status.classList.add('show');
  
  setTimeout(() => {
    status.classList.remove('show');
  }, 2000);
}

function openSettings() {
  loadConfigToUI();
  document.getElementById('settings-overlay').style.display = 'flex';
}

function closeSettings() {
  document.getElementById('settings-overlay').style.display = 'none';
}

// ============================================================
// 自动初始化（当 DOM 加载完成后）
// ============================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSettings);
} else {
  initSettings();
}
