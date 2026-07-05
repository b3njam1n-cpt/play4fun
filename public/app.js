// ============================================================
// play4fun 前端逻辑
// ============================================================

const API_BASE = '/auth';

// ── 页面元素 ──────────────────────────────────────
const authView = document.getElementById('auth-view');
const homeView = document.getElementById('home-view');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');
const tabLoginBtn = document.getElementById('tab-login-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const userEmail = document.getElementById('user-email');

// ── Tab 切换 ──────────────────────────────────────
function switchTab(tab) {
  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    tabLoginBtn.classList.add('border-blue-500', 'text-blue-400');
    tabLoginBtn.classList.remove('border-transparent', 'text-gray-500');
    tabRegisterBtn.classList.add('border-transparent', 'text-gray-500');
    tabRegisterBtn.classList.remove('border-blue-500', 'text-blue-400');
  } else {
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    tabRegisterBtn.classList.add('border-blue-500', 'text-blue-400');
    tabRegisterBtn.classList.remove('border-transparent', 'text-gray-500');
    tabLoginBtn.classList.add('border-transparent', 'text-gray-500');
    tabLoginBtn.classList.remove('border-blue-500', 'text-blue-400');
  }
  loginError.classList.add('hidden');
  registerError.classList.add('hidden');
}

// ── 登录 ──────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  loginError.classList.add('hidden');

  const form = e.target;
  const email = form.email.value;
  const password = form.password.value;

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!data.success) {
      const messages = {
        invalid_credentials: '邮箱或密码错误',
        invalid_json: '请求格式错误',
      };
      showError(loginError, messages[data.error?.code] || data.message);
      return;
    }

    // 登录成功
    showHome(data.data.user);
  } catch (err) {
    showError(loginError, '网络错误，请检查连接');
  }
}

// ── 注册 ──────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  registerError.classList.add('hidden');

  const form = e.target;
  const email = form.email.value;
  const password = form.password.value;

  if (password.length < 8) {
    showError(registerError, '密码至少需要 8 位');
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
        email_exists: '该邮箱已被注册',
        password_too_short: '密码至少需要 8 位',
        email_invalid: '请输入有效的邮箱地址',
      };
      showError(registerError, messages[data.error?.code] || data.message);
      return;
    }

    // 注册成功，直接进入主页
    showHome(data.data);
  } catch (err) {
    showError(registerError, '网络错误，请检查连接');
  }
}

// ── 登出 ──────────────────────────────────────────
async function handleLogout() {
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
  });
  showAuth();
}

// ── 检查登录状态 ──────────────────────────────────
async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/me`, {
      credentials: 'include',
    });

    if (!res.ok) {
      showAuth();
      return;
    }

    const data = await res.json();
    if (data.success) {
      showHome(data.data);
    } else {
      showAuth();
    }
  } catch {
    showAuth();
  }
}

// ── 视图切换 ──────────────────────────────────────
function showAuth() {
  authView.classList.remove('hidden');
  homeView.classList.add('hidden');
}

function showHome(user) {
  authView.classList.add('hidden');
  homeView.classList.remove('hidden');
  if (user?.email) {
    userEmail.textContent = user.email;
  }
}

// ── 错误显示 ──────────────────────────────────────
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ── 初始化 ────────────────────────────────────────
checkAuth();
