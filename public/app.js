// ============================================================
// Play4Fun — Frontend Logic v5
// ============================================================
console.log('🚀 app.js v5 已加载');

const API_BASE = '/auth';
const CHAT_API = '/api/chat';

// ── 多语言 ──────────────────────────────────────
const t = {
  zh: {
    searchPlaceholder: '随便问点什么…',
    searchPlaceholderNoAI: '搜索任何内容…',
    loginLabel: '登录',
    registerLabel: '注册',
    userPlaceholder: '邮箱',
    passPlaceholder: '密码',
    forgotPw: '忘记密码？',
    signOut: '退出登录',
    notif: '3 条新通知',
    namePlaceholder: '用户名',
    emailPlaceholder: '邮箱',
    passPlaceholderReg: '密码（至少 8 位）',
    backToLogin: '← 返回登录',
    createAccount: '创建账户',
    loggingIn: '登录中...',
    registering: '注册中...',
    welcomePrefix: '欢迎',
    welcomeSuffix: '来我们的 playground',
    homepageSubtitle: '这里什么都有，也什么都没有——剩下的等待你来定义。',
    aiPlaceholder: '继续对话… (Enter 发送, Esc 关闭)',
    aiThinking: '思考中...',
    aiError: '出错了，请重试。',
  },
  en: {
    searchPlaceholder: 'Ask anything...',
    searchPlaceholderNoAI: 'Search anything...',
    loginLabel: 'Sign In',
    registerLabel: 'Register',
    userPlaceholder: 'Email',
    passPlaceholder: 'Password',
    forgotPw: 'Forgot password?',
    signOut: 'Sign out',
    notif: '3 new notifications',
    namePlaceholder: 'Username',
    emailPlaceholder: 'Email',
    passPlaceholderReg: 'Password (min 8 chars)',
    backToLogin: '← Back to login',
    createAccount: 'Create Account',
    loggingIn: 'Signing in...',
    registering: 'Registering...',
    welcomePrefix: 'Welcome',
    welcomeSuffix: 'to our playground',
    homepageSubtitle: 'Everything here, and nothing here — the rest is up to you.',
    aiPlaceholder: 'Continue... (Enter to send, Esc to close)',
    aiThinking: 'Thinking...',
    aiError: 'Something went wrong. Try again.',
  },
};

let lang = 'zh';
function tl(key) { return t[lang][key]; }

// ── DOM 元素 ────────────────────────────────────
const heroSection = document.getElementById('hero-section');
const homepage = document.getElementById('homepage');
const welcomeName = document.getElementById('welcome-name');
const welcomePrefix = document.getElementById('welcome-prefix');
const welcomeSuffix = document.getElementById('welcome-suffix');
const homepageSubtitle = document.getElementById('homepage-subtitle');

const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const searchBar = document.getElementById('search-bar');

const searchInputMobile = document.getElementById('search-input-mobile');
const searchClearMobile = document.getElementById('search-clear-mobile');

const btnZh = document.getElementById('btn-zh');
const btnEn = document.getElementById('btn-en');

const panelLoginForm = document.getElementById('panel-login-form');
const panelRegisterForm = document.getElementById('panel-register-form');
const panelLoggedIn = document.getElementById('panel-logged-in');
const panelLabel = document.getElementById('panel-label');
const loginPanel = document.getElementById('login-panel');

const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const loginError = document.getElementById('login-error');

const registerUsername = document.getElementById('register-username');
const registerEmail = document.getElementById('register-email');
const registerPassword = document.getElementById('register-password');
const btnRegisterSubmit = document.getElementById('btn-register-submit');
const registerError = document.getElementById('register-error');

const displayUsername = document.getElementById('display-username');
const displayEmail = document.getElementById('display-email');
const notifText = document.getElementById('notif-text');

// AI 终端
const aiTerminal = document.getElementById('ai-terminal');
const aiTerminalContent = document.getElementById('ai-terminal-content');
const aiTerminalInput = document.getElementById('ai-terminal-input');
const aiTerminalTitle = document.getElementById('ai-terminal-title');
const aiTerminalModelBadge = document.getElementById('ai-terminal-model-badge');
const modelSelector = document.getElementById('model-selector');
const modelName = document.getElementById('model-name');
const modelIcon = document.getElementById('model-icon');

// ── AI 模型状态 ─────────────────────────────────
const models = {
  gemini: { name: 'Gemini', icon: '🧠' },
  llama: { name: 'Llama', icon: '🦙' },
};
let currentModel = 'gemini';

function switchModel() {
  const keys = Object.keys(models);
  const idx = keys.indexOf(currentModel);
  currentModel = keys[(idx + 1) % keys.length];
  const m = models[currentModel];
  if (modelName) modelName.textContent = m.name;
  if (modelIcon) modelIcon.textContent = m.icon;
  if (aiTerminalModelBadge) aiTerminalModelBadge.textContent = m.name;
}

// 模型选择器点击
if (modelSelector) {
  modelSelector.addEventListener('click', switchModel);
}

// ── 按钮防抖 ────────────────────────────────────
function lockButton(btn, text) {
  btn.disabled = true;
  btn.dataset.originalText = btn.textContent;
  btn.textContent = text;
  btn.style.opacity = '0.6';
  btn.style.cursor = 'not-allowed';
}
function unlockButton(btn) {
  btn.disabled = false;
  btn.textContent = btn.dataset.originalText || btn.textContent;
  btn.style.opacity = '';
  btn.style.cursor = '';
}

// ── 搜索栏 ──────────────────────────────────────
searchInput?.addEventListener('focus', () => searchBar?.classList.add('focused'));
searchInput?.addEventListener('blur', () => searchBar?.classList.remove('focused'));
searchInput?.addEventListener('input', () => {
  searchClear?.classList.toggle('hidden', !searchInput.value);
});
searchClear?.addEventListener('mousedown', (e) => {
  e.preventDefault();
  searchInput.value = '';
  searchClear.classList.add('hidden');
  searchInput.focus();
});
// Enter → AI Chat
searchInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && searchInput.value.trim()) {
    openAiTerminal(searchInput.value.trim());
    searchInput.value = '';
    searchClear?.classList.add('hidden');
  }
});

searchInputMobile?.addEventListener('input', () => {
  searchClearMobile?.classList.toggle('hidden', !searchInputMobile.value);
});
searchClearMobile?.addEventListener('mousedown', (e) => {
  e.preventDefault();
  searchInputMobile.value = '';
  searchClearMobile.classList.add('hidden');
  searchInputMobile.focus();
});

// ── 语言切换 ────────────────────────────────────
btnZh.addEventListener('click', () => setLang('zh'));
btnEn.addEventListener('click', () => setLang('en'));

function setLang(l) {
  if (lang === l) return;
  lang = l;
  if (l === 'zh') { btnZh.classList.add('active'); btnEn.classList.remove('active'); }
  else { btnEn.classList.add('active'); btnZh.classList.remove('active'); }
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  document.body.style.fontFamily = l === 'zh' ? "'Noto Sans SC', sans-serif" : "'DM Sans', sans-serif";
  updateTexts();
}

function updateTexts() {
  searchInput.placeholder = tl('searchPlaceholder');
  if (searchInputMobile) searchInputMobile.placeholder = tl('searchPlaceholderNoAI');
  panelLabel.textContent = tl('loginLabel');
  loginUsername.placeholder = tl('userPlaceholder');
  loginPassword.placeholder = tl('passPlaceholder');
  btnLogin.textContent = tl('loginLabel');
  document.getElementById('btn-forgot').textContent = tl('forgotPw');
  document.getElementById('btn-register-toggle').textContent = tl('registerLabel');
  registerUsername.placeholder = tl('namePlaceholder');
  registerEmail.placeholder = tl('emailPlaceholder');
  registerPassword.placeholder = tl('passPlaceholderReg');
  btnRegisterSubmit.textContent = tl('createAccount');
  document.getElementById('btn-login-toggle').textContent = tl('backToLogin');
  document.getElementById('btn-logout').textContent = tl('signOut');
  notifText.textContent = tl('notif');
  if (welcomePrefix) welcomePrefix.textContent = tl('welcomePrefix');
  if (welcomeSuffix) welcomeSuffix.textContent = tl('welcomeSuffix');
  if (homepageSubtitle) homepageSubtitle.textContent = tl('homepageSubtitle');
  if (aiTerminalInput) aiTerminalInput.placeholder = tl('aiPlaceholder');
  if (panelRegisterForm.classList.contains('hidden') && panelLoginForm.classList.contains('hidden') === false) {
    panelLabel.textContent = tl('loginLabel');
  }
}

// ── 表单切换 ────────────────────────────────────
document.getElementById('btn-register-toggle').addEventListener('click', () => {
  panelLoginForm.classList.add('hidden');
  panelRegisterForm.classList.remove('hidden');
  panelLabel.textContent = tl('registerLabel');
  loginError.classList.add('hidden');
});
document.getElementById('btn-login-toggle').addEventListener('click', () => {
  panelRegisterForm.classList.add('hidden');
  panelLoginForm.classList.remove('hidden');
  panelLabel.textContent = tl('loginLabel');
  registerError.classList.add('hidden');
});

// ── 登录 / 注册 / 登出 ─────────────────────────
btnLogin.addEventListener('click', handleLogin);
loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });

async function handleLogin() {
  loginError.classList.add('hidden');
  const email = loginUsername.value.trim();
  const password = loginPassword.value;
  if (!email || !password) { showError(loginError, lang === 'zh' ? '请填写邮箱和密码' : 'Please fill in email and password'); return; }
  lockButton(btnLogin, tl('loggingIn'));
  try {
    const res = await fetch(`${API_BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!data.success) { showError(loginError, lang === 'zh' ? '邮箱或密码错误' : 'Invalid email or password'); unlockButton(btnLogin); return; }
    showLoggedIn(data.data.user);
  } catch { showError(loginError, lang === 'zh' ? '网络错误' : 'Network error'); }
  unlockButton(btnLogin);
}

btnRegisterSubmit.addEventListener('click', handleRegister);
registerPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRegister(); });

async function handleRegister() {
  registerError.classList.add('hidden');
  const displayName = registerUsername.value.trim();
  const email = registerEmail.value.trim();
  const password = registerPassword.value;
  if (!email || !password) { showError(registerError, lang === 'zh' ? '请填写邮箱和密码' : 'Please fill in email and password'); return; }
  if (password.length < 8) { showError(registerError, lang === 'zh' ? '密码至少需要 8 位' : 'Password must be at least 8 characters'); return; }
  lockButton(btnRegisterSubmit, tl('registering'));
  try {
    const body = { email, password }; if (displayName) body.display_name = displayName;
    const res = await fetch(`${API_BASE}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
    const data = await res.json();
    if (!data.success) {
      const messages = { email_exists: lang === 'zh' ? '该邮箱已被注册' : 'Email already registered', email_invalid: lang === 'zh' ? '邮箱格式无效' : 'Invalid email format' };
      showError(registerError, messages[data.error?.code] || data.message); unlockButton(btnRegisterSubmit); return;
    }
    showLoggedIn(data.data.user);
  } catch { showError(registerError, lang === 'zh' ? '网络错误' : 'Network error'); }
  unlockButton(btnRegisterSubmit);
}

function showLoggedIn(user) {
  heroSection?.classList.add('hidden');
  panelLoginForm.classList.add('hidden');
  panelRegisterForm.classList.add('hidden');
  panelLoggedIn.classList.add('hidden');
  if (loginPanel) loginPanel.classList.add('hidden');
  homepage?.classList.remove('hidden');
  const name = user.display_name || user.email?.split('@')[0] || user.email;
  if (welcomeName) welcomeName.textContent = name;
  displayUsername.textContent = name;
  displayEmail.textContent = user.email;
  loginUsername.value = ''; loginPassword.value = '';
  registerUsername.value = ''; registerEmail.value = ''; registerPassword.value = '';
}

document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
  homepage?.classList.add('hidden');
  heroSection?.classList.remove('hidden');
  panelLoggedIn.classList.add('hidden');
  panelLoginForm.classList.remove('hidden');
  panelRegisterForm.classList.add('hidden');
  if (loginPanel) loginPanel.classList.remove('hidden');
  panelLabel.textContent = tl('loginLabel');
});

document.getElementById('btn-forgot').addEventListener('click', () => {
  alert(lang === 'zh' ? '请联系管理员重置密码' : 'Please contact admin for password reset');
});

// ══════════════════════════════════════════════════
// AI 终端
// ══════════════════════════════════════════════════

let isAiStreaming = false;

function openAiTerminal(query) {
  if (!aiTerminal || !aiTerminalContent) return;
  aiTerminal.classList.remove('hidden');
  // 清空之前的对话
  aiTerminalContent.innerHTML = '';
  // 添加用户消息
  appendAiMessage('user', query);
  // 添加 AI 占位
  const aiMsgEl = appendAiMessage('ai', '', true);
  // 发送请求
  sendAiChat(query, aiMsgEl);
  // 聚焦输入
  setTimeout(() => aiTerminalInput?.focus(), 100);
}

function closeAiTerminal() {
  aiTerminal?.classList.add('hidden');
  aiTerminalContent.innerHTML = '';
  if (aiTerminalInput) aiTerminalInput.value = '';
  isAiStreaming = false;
}

// 关闭按钮
document.getElementById('ai-terminal-close')?.addEventListener('click', closeAiTerminal);

// 点击遮罩关闭
aiTerminal?.addEventListener('click', (e) => {
  if (e.target === aiTerminal) closeAiTerminal();
});

// Esc 关闭
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && aiTerminal && !aiTerminal.classList.contains('hidden')) {
    closeAiTerminal();
  }
});

// 终端内继续对话
aiTerminalInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && aiTerminalInput.value.trim() && !isAiStreaming) {
    const query = aiTerminalInput.value.trim();
    aiTerminalInput.value = '';
    appendAiMessage('user', query);
    const aiMsgEl = appendAiMessage('ai', '', true);
    sendAiChat(query, aiMsgEl);
  }
});

function appendAiMessage(role, text, isStreaming) {
  const el = document.createElement('div');
  el.className = 'ai-message flex gap-2';
  if (role === 'user') {
    el.innerHTML = `<span class="text-violet-400 flex-shrink-0">❯</span><span class="text-white/80">${escapeHtml(text)}</span>`;
  } else {
    const model = models[currentModel];
    el.innerHTML = `<span class="text-emerald-400 flex-shrink-0">⚡</span><span class="text-white/70 ai-response-text${isStreaming ? ' ai-terminal-cursor' : ''}">${isStreaming ? '' : escapeHtml(text)}</span>`;
  }
  aiTerminalContent.appendChild(el);
  // 滚动到底部
  const body = document.getElementById('ai-terminal-body');
  if (body) body.scrollTop = body.scrollHeight;
  return el.querySelector('.ai-response-text') || el;
}

async function sendAiChat(message, targetEl) {
  isAiStreaming = true;
  let fullText = '';

  try {
    const res = await fetch(CHAT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, model: currentModel }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (currentEvent === 'text') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullText += parsed.text;
                if (targetEl) {
                  targetEl.textContent = fullText;
                  targetEl.classList.add('ai-terminal-cursor');
                }
                // 滚动
                const body = document.getElementById('ai-terminal-body');
                if (body) body.scrollTop = body.scrollHeight;
              }
            } catch {}
          } else if (currentEvent === 'error') {
            try {
              const parsed = JSON.parse(data);
              if (targetEl) {
                targetEl.textContent = parsed.message || tl('aiError');
                targetEl.classList.remove('ai-terminal-cursor');
                targetEl.classList.add('text-red-400');
              }
            } catch {}
          } else if (currentEvent === 'done') {
            if (targetEl) targetEl.classList.remove('ai-terminal-cursor');
          }
          currentEvent = '';
        }
      }
    }
  } catch (e) {
    console.error('AI chat error:', e);
    if (targetEl) {
      targetEl.textContent = tl('aiError');
      targetEl.classList.remove('ai-terminal-cursor');
      targetEl.classList.add('text-red-400');
    }
  }

  if (targetEl) targetEl.classList.remove('ai-terminal-cursor');
  isAiStreaming = false;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── 页面初始化 ──────────────────────────────────
async function init() {
  try {
    const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.success) { showLoggedIn(data.data); return; }
    }
  } catch {}
  homepage?.classList.add('hidden');
  heroSection?.classList.remove('hidden');
  panelLoggedIn.classList.add('hidden');
  panelLoginForm.classList.remove('hidden');
  panelRegisterForm.classList.add('hidden');
  if (loginPanel) loginPanel.classList.remove('hidden');
}

function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }

setLang('zh');
init();
