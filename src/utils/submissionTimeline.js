/**
 * Shared helpers so every page (Operator's own status, Shift Leader queue,
 * Admin queue, Records, Header notifications) agrees on:
 *   1. What "last activity" means for a submission — whichever stage most
 *      recently touched it: Operator submit, Shift Leader forward/reject,
 *      or Admin's final decision.
 *   2. LIFO ordering — the submission that was most recently submitted OR
 *      forwarded OR decided on shows first, everywhere.
 */

// Backend timestamps are stored as `new Date().toLocaleString()` strings
// (e.g. "8/11/2026, 3:45:00 PM"), which `new Date(...)` parses fine in the
// same locale/environment that produced them.
const toTime = (val) => {
  if (!val) return 0;
  const t = new Date(val).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export const getLastActivityAt = (sub) => {
  return Math.max(
    toTime(sub?.submittedAt),
    toTime(sub?.shiftLeaderReviewedAt),
    toTime(sub?.reviewedAt)
  );
};

// Returns a NEW array — never mutates the input — sorted most-recent-first.
export const sortByLastActivityDesc = (list) => {
  return [...(list || [])].sort((a, b) => getLastActivityAt(b) - getLastActivityAt(a));
};

// A compact, human list of "what happened when" for a single submission —
// used to render a small timeline strip in detail panes.
export const buildActivityTimeline = (sub) => {
  if (!sub) return [];
  const steps = [];

  if (sub.submittedAt) {
    steps.push({
      key: 'submitted',
      label: 'Submitted by Operator',
      who: sub.operatorName ? `${sub.operatorName} (NTID: ${sub.operatorNTID})` : null,
      at: sub.submittedAt,
    });
  }

  if (sub.shiftLeaderReviewedAt) {
    steps.push({
      key: 'shiftLeader',
      label: sub.status === 'RejectedByShiftLeader' ? 'Rejected by Shift Leader' : 'Forwarded by Shift Leader',
      who: sub.shiftLeaderName || null,
      at: sub.shiftLeaderReviewedAt,
    });
  }

  // reviewedAt/reviewedBy is reused for whichever stage most recently acted.
  // Only show it as the Admin step once Admin has actually made their own
  // decision (Approved or RejectedByAdmin) — for 'PendingAdmin', reviewedAt
  // still just reflects the Shift Leader's forward action.
  if (sub.reviewedAt && ['Approved', 'RejectedByAdmin'].includes(sub.status)) {
    steps.push({
      key: 'admin',
      label: sub.status === 'Approved' ? 'Final Approval by Admin' : 'Rejected by Admin',
      who: sub.reviewedBy || null,
      at: sub.reviewedAt,
    });
  }

  return steps.sort((a, b) => toTime(a.at) - toTime(b.at));
};
