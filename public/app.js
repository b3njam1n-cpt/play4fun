// ============================================================
// Play4Fun — Frontend Logic (Figma Design)
// ============================================================

const API_BASE = '/auth';

// ── 多语言 ──────────────────────────────────────
const t = {
  zh: {
    searchPlaceholder: '搜索任何内容…',
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
  },
  en: {
    searchPlaceholder: 'Search anything...',
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
  },
};

let lang = 'zh';
function tl(key) { return t[lang][key]; }

// ── DOM 元素 ────────────────────────────────────
const searchWrapper = document.getElementById('search-wrapper');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');

const btnZh = document.getElementById('btn-zh');
const btnEn = document.getElementById('btn-en');

const panelLoginForm = document.getElementById('panel-login-form');
const panelRegisterForm = document.getElementById('panel-register-form');
const panelLoggedIn = document.getElementById('panel-logged-in');
const panelLabel = document.getElementById('panel-label');

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

// ── 搜索栏 ──────────────────────────────────────
searchInput.addEventListener('focus', () => searchBar.classList.add('focused'));
searchInput.addEventListener('blur', () => searchBar.classList.remove('focused'));
searchInput.addEventListener('input', () => {
  searchClear.classList.toggle('hidden', !searchInput.value);
});
searchClear.addEventListener('mousedown', (e) => {
  e.preventDefault();
  searchInput.value = '';
  searchClear.classList.add('hidden');
  searchInput.focus();
});

// ── 语言切换 ────────────────────────────────────
window.switchLang = function(l) {
  setLang(l);
};

function setLang(l) {
  if (lang === l) return;
  lang = l;

  // 用 classList 切换，不覆盖 Tailwind 类
  if (l === 'zh') {
    btnZh.classList.add('active');
    btnEn.classList.remove('active');
  } else {
    btnEn.classList.add('active');
    btnZh.classList.remove('active');
  }

  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';
  document.body.style.fontFamily = l === 'zh'
    ? "'Noto Sans SC', sans-serif"
    : "'DM Sans', sans-serif";
  updateTexts();
}

function updateTexts() {
  searchInput.placeholder = tl('searchPlaceholder');
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
  if (panelRegisterForm.classList.contains('hidden')) {
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

// ── 登录 ─────────────────────────────────────────
btnLogin.addEventListener('click', handleLogin);
loginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin();
});

async function handleLogin() {
  loginError.classList.add('hidden');
  const email = loginUsername.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    showError(loginError, lang === 'zh' ? '请填写邮箱和密码' : 'Please fill in email and password');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) {
      const msg = lang === 'zh' ? '邮箱或密码错误' : 'Invalid email or password';
      showError(loginError, msg);
      return;
    }
    showLoggedIn(data.data.user);
  } catch {
    showError(loginError, lang === 'zh' ? '网络错误' : 'Network error');
  }
}

// ── 注册 ─────────────────────────────────────────
btnRegisterSubmit.addEventListener('click', handleRegister);
registerPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleRegister();
});

async function handleRegister() {
  registerError.classList.add('hidden');
  const email = registerEmail.value.trim();
  const password = registerPassword.value;

  if (!email || !password) {
    showError(registerError, lang === 'zh' ? '请填写邮箱和密码' : 'Please fill in email and password');
    return;
  }
  if (password.length < 8) {
    showError(registerError, lang === 'zh' ? '密码至少需要 8 位' : 'Password must be at least 8 characters');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) {
      const messages = {
        email_exists: lang === 'zh' ? '该邮箱已被注册' : 'Email already registered',
        email_invalid: lang === 'zh' ? '邮箱格式无效' : 'Invalid email format',
      };
      showError(registerError, messages[data.error?.code] || data.message);
      return;
    }
    showLoggedIn(data.data);
  } catch {
    showError(registerError, lang === 'zh' ? '网络错误' : 'Network error');
  }
}

// ── 已登录状态 ──────────────────────────────────
function showLoggedIn(user) {
  panelLoginForm.classList.add('hidden');
  panelRegisterForm.classList.add('hidden');
  panelLoggedIn.classList.remove('hidden');
  displayUsername.textContent = user.email?.split('@')[0] || user.email;
  displayEmail.textContent = user.email;
  loginUsername.value = '';
  loginPassword.value = '';
  registerEmail.value = '';
  registerPassword.value = '';
}

// ── 登出 ─────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', async () => {
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  panelLoggedIn.classList.add('hidden');
  panelLoginForm.classList.remove('hidden');
  panelLabel.textContent = tl('loginLabel');
});

// ── 忘记密码 ────────────────────────────────────
document.getElementById('btn-forgot').addEventListener('click', () => {
  alert(lang === 'zh' ? '请联系管理员重置密码' : 'Please contact admin for password reset');
});

// ── 页面初始化：检查登录状态 ────────────────────
async function init() {
  try {
    const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        showLoggedIn(data.data);
        return;
      }
    }
  } catch {}
  // 未登录，显示登录面板
  panelLoggedIn.classList.add('hidden');
  panelLoginForm.classList.remove('hidden');
  panelRegisterForm.classList.add('hidden');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

setLang('zh');
init();
