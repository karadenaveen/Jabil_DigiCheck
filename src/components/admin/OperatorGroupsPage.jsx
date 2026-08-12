import { useState, useEffect, useCallback } from 'react';
import { Users, UserCog, ChevronDown, ChevronRight, CircleAlert as AlertCircle, RefreshCw, Plus, X, Check, Crown, Layers } from 'lucide-react';
import { storageService } from '../../services/storageService.js';

const ROLE_LABEL = {
  ADMIN: 'Main Admin',
  SUBADMIN: 'Sub Admin',
  SHIFT_LEADER: 'Shift Leader',
  OPERATOR: 'Operator'
};

const ROLE_BADGE = {
  ADMIN: 'bg-amber-100 text-amber-700',
  SUBADMIN: 'bg-teal-100 text-teal-700',
  SHIFT_LEADER: 'bg-sky-100 text-sky-700',
  OPERATOR: 'bg-slate-100 text-slate-600'
};

export default function OperatorGroupsPage() {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSAs, setExpandedSAs] = useState(new Set());
  const [expandedSLs, setExpandedSLs] = useState(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignType, setAssignType] = useState('operator');
  const [operators, setOperators] = useState([]);
  const [shiftLeaders, setShiftLeaders] = useState([]);
  const [subAdmins, setSubAdmins] = useState([]);
  const [assignForm, setAssignForm] = useState({ operatorId: '', shiftLeaderId: '', subAdminId: '', shiftLeaderIdSL: '' });
  const [capacity, setCapacity] = useState(30);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [capacityInput, setCapacityInput] = useState(30);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    const data = await storageService.getGroupingTree();
    setTree(data);
    if (data?.maxOperatorsPerShiftLeader) {
      setCapacity(data.maxOperatorsPerShiftLeader);
      setCapacityInput(data.maxOperatorsPerShiftLeader);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const toggleSA = (id) => {
    const next = new Set(expandedSAs);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedSAs(next);
  };

  const toggleSL = (id) => {
    const next = new Set(expandedSLs);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedSLs(next);
  };

  const openAssignModal = async (type) => {
    setAssignType(type);
    setAssignForm({ operatorId: '', shiftLeaderId: '', subAdminId: '', shiftLeaderIdSL: '' });
    const [ops, sls, sas] = await Promise.all([
      storageService.getOperators(),
      storageService.getShiftLeaders(),
      storageService.getSubAdmins()
    ]);
    setOperators(ops);
    setShiftLeaders(sls);
    setSubAdmins(sas);
    setShowAssignModal(true);
  };

  const handleAssign = async () => {
    try {
      if (assignType === 'operator') {
        await storageService.assignOperator(assignForm.operatorId, assignForm.shiftLeaderId, assignForm.subAdminId);
      } else {
        await storageService.assignShiftLeader(assignForm.shiftLeaderIdSL, assignForm.subAdminId);
      }
      setShowAssignModal(false);
      fetchTree();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign. Please try again.');
    }
  };

  const handleSaveCapacity = async () => {
    try {
      await storageService.updateCapacity(capacityInput);
      setCapacity(capacityInput);
      setShowCapacityModal(false);
      fetchTree();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update capacity.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 text-sky-500 animate-spin" />
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>Failed to load grouping data.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-6 h-6 text-sky-500" />
            Operator Groups
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage the operator → shift leader → sub admin hierarchy and assignment capacity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCapacityModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
          >
            <UserCog className="w-4 h-4" />
            Capacity: {capacity}
          </button>
          <button
            onClick={() => openAssignModal('operator')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Assign Operator
          </button>
          <button
            onClick={() => openAssignModal('shiftLeader')}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Assign Shift Leader
          </button>
          <button
            onClick={fetchTree}
            className="p-2 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: 'Sub Admins', value: tree.totalSubAdmins, icon: Crown, color: 'text-teal-600 bg-teal-50' },
          { label: 'Shift Leaders', value: tree.totalShiftLeaders, icon: UserCog, color: 'text-sky-600 bg-sky-50' },
          { label: 'Operators', value: tree.totalOperators, icon: Users, color: 'text-slate-600 bg-slate-50' },
          { label: 'Unassigned Operators', value: tree.unassignedOperators.length, icon: AlertCircle, color: 'text-amber-600 bg-amber-50' }
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{card.value}</div>
              <div className="text-xs text-slate-500">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sub Admin → Shift Leader → Operator Tree */}
      <div className="space-y-3">
        {tree.subAdmins.length === 0 && tree.unassignedShiftLeaders.length === 0 && tree.unassignedOperators.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
            No users found. Create Shift Leaders and Operators in Settings first.
          </div>
        ) : (
          <>
            {tree.subAdmins.map(sa => (
              <div key={sa.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => toggleSA(sa.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition text-left"
                >
                  {expandedSAs.has(sa.id) ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                  <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold">
                    {sa.avatar || sa.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-slate-800 text-sm">{sa.name}</div>
                    <div className="text-xs text-slate-400">{sa.ntid} · {sa.assignedShiftLeaderCount || 0} Shift Leaders</div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${ROLE_BADGE.SUBADMIN}`}>{ROLE_LABEL.SUBADMIN}</span>
                </button>

                {expandedSAs.has(sa.id) && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {sa.shiftLeaders.length === 0 ? (
                      <div className="p-4 pl-14 text-xs text-slate-400">No Shift Leaders assigned to this Sub Admin.</div>
                    ) : (
                      sa.shiftLeaders.map(sl => (
                        <div key={sl.id} className="border-b border-slate-100 last:border-0">
                          <button
                            onClick={() => toggleSL(sl.id)}
                            className="w-full flex items-center gap-3 p-3 pl-8 hover:bg-sky-50/50 transition text-left"
                          >
                            {expandedSLs.has(sl.id) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-bold">
                              {sl.avatar || sl.name?.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-slate-700 text-xs">{sl.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {sl.ntid} · {sl.assignedOperatorCount}/{sl.maxOperators} Operators
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${ROLE_BADGE.SHIFT_LEADER}`}>{ROLE_LABEL.SHIFT_LEADER}</span>
                          </button>
                          {expandedSLs.has(sl.id) && (
                            <div className="pl-16 pb-3 space-y-1.5">
                              {sl.operators.length === 0 ? (
                                <div className="text-[11px] text-slate-400 py-1">No operators assigned.</div>
                              ) : (
                                sl.operators.map(op => (
                                  <div key={op.id} className="flex items-center gap-2 text-xs text-slate-600 py-1">
                                    <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-bold">
                                      {op.avatar || op.name?.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span>{op.name}</span>
                                    <span className="text-slate-400">({op.ntid})</span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Unassigned Shift Leaders */}
            {tree.unassignedShiftLeaders.length > 0 && (
              <div className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
                <div className="flex items-center gap-2 p-4 bg-amber-50/50 border-b border-amber-100">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-amber-700">Unassigned Shift Leaders ({tree.unassignedShiftLeaders.length})</span>
                </div>
                {tree.unassignedShiftLeaders.map(sl => (
                  <div key={sl.id} className="border-b border-slate-100 last:border-0">
                    <button
                      onClick={() => toggleSL(`unassigned-${sl.id}`)}
                      className="w-full flex items-center gap-3 p-3 pl-8 hover:bg-sky-50/50 transition text-left"
                    >
                      {expandedSLs.has(`unassigned-${sl.id}`) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                      <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-bold">
                        {sl.avatar || sl.name?.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-700 text-xs">{sl.name}</div>
                        <div className="text-[10px] text-slate-400">{sl.ntid} · {sl.assignedOperatorCount}/{sl.maxOperators} Operators</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${ROLE_BADGE.SHIFT_LEADER}`}>{ROLE_LABEL.SHIFT_LEADER}</span>
                    </button>
                    {expandedSLs.has(`unassigned-${sl.id}`) && (
                      <div className="pl-16 pb-3 space-y-1.5">
                        {sl.operators.length === 0 ? (
                          <div className="text-[11px] text-slate-400 py-1">No operators assigned.</div>
                        ) : (
                          sl.operators.map(op => (
                            <div key={op.id} className="flex items-center gap-2 text-xs text-slate-600 py-1">
                              <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-bold">
                                {op.avatar || op.name?.substring(0, 2).toUpperCase()}
                              </div>
                              <span>{op.name}</span>
                              <span className="text-slate-400">({op.ntid})</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Unassigned Operators */}
            {tree.unassignedOperators.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 p-4 bg-slate-50 border-b border-slate-100">
                  <AlertCircle className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-500">Unassigned Operators ({tree.unassignedOperators.length})</span>
                </div>
                <div className="p-3 flex flex-wrap gap-2">
                  {tree.unassignedOperators.map(op => (
                    <div key={op.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
                      <div className="w-6 h-6 rounded-md bg-slate-200 text-slate-500 flex items-center justify-center text-[9px] font-bold">
                        {op.avatar || op.name?.substring(0, 2).toUpperCase()}
                      </div>
                      <span>{op.name}</span>
                      <span className="text-slate-400">({op.ntid})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Capacity Modal */}
      {showCapacityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCapacityModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <UserCog className="w-5 h-5 text-sky-500" />
              Max Operators per Shift Leader
            </h3>
            <p className="text-xs text-slate-500">
              Set the maximum number of operators that can be assigned to a single Shift Leader.
            </p>
            <input
              type="number"
              min="1"
              value={capacityInput}
              onChange={e => setCapacityInput(parseInt(e.target.value, 10) || 1)}
              className="w-full p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-sky-400 outline-none"
            />
            <div className="flex gap-3">
              <button onClick={() => setShowCapacityModal(false)} className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition">Cancel</button>
              <button onClick={handleSaveCapacity} className="flex-1 py-2.5 text-xs font-bold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-500" />
                {assignType === 'operator' ? 'Assign Operator to Shift Leader' : 'Assign Shift Leader to Sub Admin'}
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            {assignType === 'operator' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Operator</label>
                  <select value={assignForm.operatorId} onChange={e => setAssignForm({ ...assignForm, operatorId: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm">
                    <option value="">— Select Operator —</option>
                    {operators.filter(op => !op.shiftLeaderId).map(op => (
                      <option key={op.id} value={op.id}>{op.name} ({op.ntid})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Shift Leader</label>
                  <select value={assignForm.shiftLeaderId} onChange={e => setAssignForm({ ...assignForm, shiftLeaderId: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm">
                    <option value="">— Select Shift Leader —</option>
                    {shiftLeaders.map(sl => (
                      <option key={sl.id} value={sl.id}>{sl.name} ({sl.ntid}) — {sl.assignedOperatorCount}/{sl.maxOperators}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Shift Leader</label>
                  <select value={assignForm.shiftLeaderIdSL} onChange={e => setAssignForm({ ...assignForm, shiftLeaderIdSL: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm">
                    <option value="">— Select Shift Leader —</option>
                    {shiftLeaders.filter(sl => !sl.subAdminId).map(sl => (
                      <option key={sl.id} value={sl.id}>{sl.name} ({sl.ntid})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">Sub Admin</label>
                  <select value={assignForm.subAdminId} onChange={e => setAssignForm({ ...assignForm, subAdminId: e.target.value })} className="w-full p-2.5 border border-slate-300 rounded-xl text-sm">
                    <option value="">— Select Sub Admin —</option>
                    {subAdmins.map(sa => (
                      <option key={sa.id} value={sa.id}>{sa.name} ({sa.ntid})</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowAssignModal(false)} className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition">Cancel</button>
              <button
                onClick={handleAssign}
                disabled={assignType === 'operator' ? (!assignForm.operatorId || !assignForm.shiftLeaderId) : (!assignForm.shiftLeaderIdSL || !assignForm.subAdminId)}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-sky-600 rounded-xl hover:bg-sky-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
