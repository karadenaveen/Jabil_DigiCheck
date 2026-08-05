import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { Settings as IconSettings, UserPlus, ShieldAlert, CheckCircle, Ban, Key, UserCheck, Search } from 'lucide-react';

export function SettingsPage() {
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const data = await storageService.getUsers();
    setUsers(data);
  };

  const [newUser, setNewUser] = useState({
    name: '',
    ntid: '',
    username: '',
    password: 'password123',
    role: 'OPERATOR'
  });

  const handleToggleAccess = async (ntid) => {
    try {
      const updated = await storageService.toggleUserAccess(ntid);
      setUsers(updated);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle access.');
    }
  };

  const handleAddOperator = async (e) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.ntid.trim()) {
      alert('Please fill out Name and numeric NTID.');
      return;
    }

    try {
      const updated = await storageService.addUser({
        name: newUser.name,
        ntid: newUser.ntid,
        username: newUser.username || newUser.name.toLowerCase().replace(/\s+/g, '.'),
        password: newUser.password || 'operator123',
        role: newUser.role
      });

      setUsers(updated);
      setShowAddModal(false);
      setNewUser({ name: '', ntid: '', username: '', password: 'password123', role: 'OPERATOR' });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create operator account.');
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.ntid.includes(searchQuery) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <IconSettings className="w-6 h-6 text-[#00529B]" />
            <span>System Settings & NTID Access Control</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage system operators, set login passwords, and grant or deny NTID access permissions.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Operator / NTID</span>
        </button>
      </div>

      {/* Main Settings Container */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name, NTID (e.g. 1234567)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="text-xs text-slate-500 font-semibold">
            Total Accounts: <span className="text-[#00529B] font-bold">{users.length}</span> (Active Access: {users.filter(u => u.status === 'ALLOWED').length})
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Avatar & Name</th>
                <th className="px-4 py-3">Numeric NTID</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Password</th>
                <th className="px-4 py-3">System Role</th>
                <th className="px-4 py-3">Access Permission</th>
                <th className="px-4 py-3 text-right">Access Control Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredUsers.map((u) => {
                const isDenied = u.status === 'DENIED';
                return (
                  <tr key={u.id} className="hover:bg-slate-50 transition">
                    
                    <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs shadow-sm shrink-0">
                        {u.avatar || 'OP'}
                      </div>
                      <div>
                        <div>{u.name}</div>
                        <div className="text-[10px] font-normal text-slate-400">Created: {u.createdDate}</div>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{u.ntid}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{u.username}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">••••••••</td>
                    
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'ADMIN' ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        isDenied
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        {isDenied ? 'ACCESS DENIED' : 'ALLOWED'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      {u.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleToggleAccess(u.ntid)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ml-auto ${
                            isDenied
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow'
                              : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300'
                          }`}
                        >
                          {isDenied ? (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Grant Access</span>
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              <span>Deny Access</span>
                            </>
                          )}
                        </button>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      </div>

      {/* Add New Operator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <UserPlus className="w-5 h-5 text-[#00529B]" />
              <span>Create New Operator / NTID</span>
            </div>

            <form onSubmit={handleAddOperator} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Operator Full Name</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Numeric NTID (e.g. 7654321)</label>
                <input
                  type="text"
                  value={newUser.ntid}
                  onChange={(e) => setNewUser({ ...newUser, ntid: e.target.value })}
                  placeholder="7654321"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Username (Optional)</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="ramesh.p"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase mb-1">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#00529B] hover:bg-blue-800 text-white font-bold rounded-xl shadow"
                >
                  Create Account
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}
