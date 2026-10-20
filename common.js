// common.js — CloudStock 公共模块（仓库/销售共享）
// 用法: <script src="common.js"></script> 放在各 HTML 的 supabase-js 之后
// 本文件提供: DOM 工具、格式化、Supabase 封装、Edge admin-api 封装、权限判断

// ═══ DOM 工具 ═══
function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
function av(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function oMo(id) {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}
function cMo(id) {
  document.getElementById(id).classList.remove('show');
  document.body.style.overflow = '';
}
function toast(m, tp) {
  tp = tp || 'inf';
  let el = document.getElementById('csToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'csToast';
    el.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:90vw';
    document.body.appendChild(el);
  }
  const d = document.createElement('div');
  const colors = { ok: 'var(--ac,#0a0)', er: 'var(--red,#c00)', inf: 'var(--ig,#06c)' };
  d.style.cssText = 'padding:.65rem 1.1rem;border-radius:10px;color:#fff;font-size:.82rem;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.18);background:' + (colors[tp] || colors.inf) + ';pointer-events:auto;max-width:80vw';
  d.textContent = m;
  el.appendChild(d);
  setTimeout(function() { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; setTimeout(function() { d.remove(); }, 300); }, 2600);
}

// ═══ 格式化 ═══
function fmtDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const pad = function(n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  } catch (_) { return String(iso); }
}

// ═══ Supabase 封装 ═══
var sb = null;
var SB_URL = 'https://qpynlblzpmkoovyaxygn.supabase.co';
var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFweW5sYmx6cG1rb292eWF4eWduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5NDgwMDAsImV4cCI6MjA0NzUyNDAwMH0.placeholder';
// ⚠️ SB_KEY 由各 HTML 在调用 initSb 前覆盖为真实 anon key

function initSb(token) {
  if (typeof supabase === 'undefined' || !supabase || typeof supabase.createClient !== 'function') {
    console.error('SB init failed: supabase-js CDN not loaded');
    return;
  }
  try {
    sb = supabase.createClient(SB_URL, SB_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
      global: {
        headers: token ? { 'X-Admin-Token': token } : {}
      }
    });
    window.ADMIN_TOKEN = token || '';
  } catch (e) {
    console.error('SB init failed', e);
  }
}

async function fetchPaged(build) {
  const all = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const q = build().range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || !data.length) break;
    all.push.apply(all, data);
    if (data.length < pageSize) break;
    if (from > 20000) break; // safety cap
  }
  return all;
}

function safeQ(p) {
  return Promise.resolve(p).then(function(r) {
    if (Array.isArray(r)) return { data: r, error: null };
    return { data: (r && r.data) || [], error: (r && r.error) || null };
  }).catch(function() { return { data: [], error: { message: 'denied' } }; });
}

// ═══ Edge admin-api 封装 ═══
function adminFrom(table) {
  return {
    insert: function(row) { return adminApi('insert', { table: table, row: row }); },
    upsert: function(row) { return adminApi('upsert', { table: table, row: row }); },
    select: function() {
      return {
        eq: function(col, val) { return adminApi('select', { table: table, where: (function() { var w = {}; w[col] = val; return w; })() }); },
        order: function() { return this; },
        limit: function(n) { return adminApi('select', { table: table, limit: n }); }
      };
    },
    update: function(patch) {
      return {
        eq: function(col, val) {
          var w = {}; w[col] = val;
          return adminApi('update', { table: table, patch: patch, where: w });
        }
      };
    },
    delete: function() {
      return {
        eq: function(col, val) {
          var w = {}; w[col] = val;
          return adminApi('delete', { table: table, where: w });
        }
      };
    }
  };
}
async function adminSelect(table, opts) {
  return adminApi('select', Object.assign({ table: table }, opts || {}));
}
async function adminApi(action, payload) {
  var url = 'https://qpynlblzpmkoovyaxygn.supabase.co/functions/v1/admin-api';
  var token = window.ADMIN_TOKEN || '';
  var res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': token
    },
    body: JSON.stringify(Object.assign({ action: action }, payload || {}))
  });
  var data = null;
  try { data = await res.json(); } catch (_) {}
  if (!res.ok || !data || data.ok === false) {
    var errCode = (data && data.error) || ('admin_api_' + res.status);
    if (res.status === 403 || errCode === 'forbidden') {
      toast('权限不足，操作被拒绝', 'er');
    } else if (res.status === 401) {
      toast('会话已过期，请重新登录', 'er');
    }
    throw new Error(errCode);
  }
  return data.data;
}

// ═══ 权限 ═══
function hasPerm(userObj, k) {
  if (!userObj) return false;
  if (userObj.r === 'wh_admin') return true;
  return userObj.perm && userObj.perm[k] === 1;
}

// ═══ 全局错误捕获（P3-6）═══
window._errLog = window._errLog || [];
window.addEventListener('error', function(e) {
  var msg = e.message || String(e.error || e);
  var loc = (e.filename || '') + ':' + (e.lineno || 0);
  window._errLog.push({ t: Date.now(), msg: msg, loc: loc, type: 'error' });
  if (window._errLog.length > 50) window._errLog.shift();
  console.error('[CS GlobalError]', msg, loc);
});
window.addEventListener('unhandledrejection', function(e) {
  var msg = String((e.reason && e.reason.message) || e.reason || 'unknown');
  window._errLog.push({ t: Date.now(), msg: msg, type: 'unhandled' });
  if (window._errLog.length > 50) window._errLog.shift();
  console.error('[CS Unhandled]', msg);
});
function getErrorLog() { return window._errLog.slice(); }

// ═══ 多语言（基础） ═══
var _lang = 'zh';
function setLang(l) { _lang = l; }
function getLang() { return _lang; }
