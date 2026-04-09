import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/context/StoreContext';
import { useLocation } from 'wouter';
import {
  UserPlus,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  Save,
} from 'lucide-react';

const API = '/api';

interface AdminUser {
  id: string;
  employeeId: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  product_specialist: '产品专员',
  product_manager: '产品经理',
  admin: '管理员',
};

export default function AdminUsers() {
  const { role } = useAppStore();
  const [, setLocation] = useLocation();

  // Redirect non-admins
  useEffect(() => {
    if (role !== 'admin') {
      setLocation('/workbench');
    }
  }, [role, setLocation]);

  // ── User list ────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');

  const fetchUsers = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const r = await fetch(`${API}/admin/users`, { credentials: 'include' });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setListError(body.error ?? '加载失败');
        return;
      }
      setUsers(await r.json());
    } catch {
      setListError('网络错误，请重试');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Toggle status ─────────────────────────────────────────────────────────
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  const toggleStatus = async (user: AdminUser) => {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    setStatusLoading(user.id);
    try {
      const r = await fetch(`${API}/admin/users/${user.id}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { alert(body.error ?? '操作失败'); return; }
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
    } finally {
      setStatusLoading(null);
    }
  };

  // ── Create user form ──────────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState({ employeeId: '', name: '', password: '', role: 'product_specialist' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateSuccess('');
    setCreating(true);
    try {
      const r = await fetch(`${API}/admin/users`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setCreateError(body.error ?? '创建失败'); return; }
      setCreateSuccess(`账号「${body.employeeId}」创建成功`);
      setCreateForm({ employeeId: '', name: '', password: '', role: 'product_specialist' });
      fetchUsers();
    } finally {
      setCreating(false);
    }
  };

  // ── Admin self update ─────────────────────────────────────────────────────
  const [selfForm, setSelfForm] = useState({ newEmployeeId: '', newPassword: '' });
  const [selfSaving, setSelfSaving] = useState(false);
  const [selfError, setSelfError] = useState('');
  const [selfSuccess, setSelfSuccess] = useState('');
  const { logout } = useAppStore();

  const handleSelfUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSelfError('');
    setSelfSuccess('');
    if (!selfForm.newEmployeeId.trim() && !selfForm.newPassword.trim()) {
      setSelfError('请至少填写新账号名或新密码之一');
      return;
    }
    setSelfSaving(true);
    try {
      const r = await fetch(`${API}/admin/self`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmployeeId: selfForm.newEmployeeId.trim() || undefined,
          newPassword: selfForm.newPassword.trim() || undefined,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setSelfError(body.error ?? '修改失败'); return; }
      setSelfSuccess('修改成功！即将退出，请用新账号信息重新登录…');
      setSelfForm({ newEmployeeId: '', newPassword: '' });
      setTimeout(() => logout(), 2000);
    } finally {
      setSelfSaving(false);
    }
  };

  if (role !== 'admin') return null;

  return (
    <div className="space-y-8 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">账号管理</h1>
        <p className="text-sm text-slate-500 mt-1">创建员工账号、查看账号列表、启用/禁用账号，以及修改管理员自己的登录信息。</p>
      </div>

      {/* ── 创建账号 ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-primary" />
          新建账号
        </h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">工号（登录账号）</label>
            <input
              type="text"
              value={createForm.employeeId}
              onChange={e => setCreateForm(f => ({ ...f, employeeId: e.target.value }))}
              placeholder="如 EMP001"
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">姓名</label>
            <input
              type="text"
              value={createForm.name}
              onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
              placeholder="如 张小凡"
              required
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">初始密码</label>
            <input
              type="password"
              value={createForm.password}
              onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
              placeholder="至少 6 位"
              required
              minLength={6}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">角色</label>
            <select
              value={createForm.role}
              onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="product_specialist">产品专员</option>
              <option value="product_manager">产品经理</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div className="sm:col-span-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {creating ? '创建中…' : '创建账号'}
            </button>
            {createSuccess && <span className="text-sm text-emerald-600">{createSuccess}</span>}
            {createError && <span className="text-sm text-red-500">{createError}</span>}
          </div>
        </form>
      </div>

      {/* ── 账号列表 ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">账号列表</h2>
          <button
            onClick={fetchUsers}
            disabled={listLoading}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1"
            title="刷新"
          >
            <RefreshCw size={16} className={listLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        {listError && <p className="text-sm text-red-500 mb-3">{listError}</p>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-left">
                <th className="pb-2 pr-4 font-medium">工号</th>
                <th className="pb-2 pr-4 font-medium">姓名</th>
                <th className="pb-2 pr-4 font-medium">角色</th>
                <th className="pb-2 pr-4 font-medium">状态</th>
                <th className="pb-2 pr-4 font-medium">创建时间</th>
                <th className="pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 pr-4 font-mono text-slate-700">{u.employeeId}</td>
                  <td className="py-2.5 pr-4 text-slate-800 font-medium">{u.name}</td>
                  <td className="py-2.5 pr-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : u.role === 'product_manager'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {u.status === 'active' ? '正常' : '已禁用'}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="py-2.5">
                    {u.role !== 'admin' ? (
                      <button
                        onClick={() => toggleStatus(u)}
                        disabled={statusLoading === u.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          u.status === 'active'
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        } disabled:opacity-50`}
                      >
                        {u.status === 'active'
                          ? <><ShieldOff size={13} /> 禁用</>
                          : <><ShieldCheck size={13} /> 启用</>}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && !listLoading && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400 text-sm">暂无账号数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 管理员修改自己的账号信息 ───────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-800 mb-1 flex items-center gap-2">
          <KeyRound size={18} className="text-primary" />
          修改我的账号信息
        </h2>
        <p className="text-xs text-slate-400 mb-4">修改成功后将自动退出，请用新信息重新登录。</p>
        <form onSubmit={handleSelfUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">新账号名（工号）</label>
            <input
              type="text"
              value={selfForm.newEmployeeId}
              onChange={e => setSelfForm(f => ({ ...f, newEmployeeId: e.target.value }))}
              placeholder="留空则不修改"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">新密码</label>
            <input
              type="password"
              value={selfForm.newPassword}
              onChange={e => setSelfForm(f => ({ ...f, newPassword: e.target.value }))}
              placeholder="留空则不修改，至少 6 位"
              minLength={selfForm.newPassword ? 6 : undefined}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
          <div className="sm:col-span-2 flex items-center gap-4">
            <button
              type="submit"
              disabled={selfSaving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save size={15} />
              {selfSaving ? '保存中…' : '保存修改'}
            </button>
            {selfSuccess && <span className="text-sm text-emerald-600">{selfSuccess}</span>}
            {selfError && <span className="text-sm text-red-500">{selfError}</span>}
          </div>
        </form>
      </div>
    </div>
  );
}
