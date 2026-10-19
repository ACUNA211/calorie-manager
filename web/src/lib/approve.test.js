import { describe, expect, it, vi } from 'vitest';
import { approvePlan, loadCanApprove } from './plan.js';
import { loadApprovers, setMemberCanApprove } from './approvers.js';
import { approveAction } from './planLogic.js';

describe('approveAction', () => {
  const draft = { id: 1, status: 'draft', changed_since_approval: false };
  const approved = { id: 1, status: 'approved', changed_since_approval: false };
  const changed = { id: 1, status: 'approved', changed_since_approval: true };

  it('offers Approve on a draft to someone allowed', () => {
    expect(approveAction(draft, true)).toBe('approve');
  });
  it('offers Approve again on an edited approved plan', () => {
    expect(approveAction(changed, true)).toBe('approveAgain');
  });
  it('offers nothing on an untouched approved plan or a week with no plan', () => {
    expect(approveAction(approved, true)).toBeNull();
    expect(approveAction(null, true)).toBeNull();
  });
  it('offers nothing to someone who may not approve', () => {
    expect(approveAction(draft, false)).toBeNull();
    expect(approveAction(changed, false)).toBeNull();
  });
});

describe('approve calls', () => {
  it('asks the database whether the caller may approve', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    expect(await loadCanApprove({ rpc })).toBe(true);
    expect(rpc).toHaveBeenCalledWith('plan_can_approve');
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadCanApprove({ rpc })).toBe(false);
  });

  it('approves through plan_approve', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: 'approved' }, error: null });
    await approvePlan({ rpc }, 7);
    expect(rpc).toHaveBeenCalledWith('plan_approve', { p_plan_id: 7 });
  });

  it('throws what the database refuses', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error('no') });
    await expect(approvePlan({ rpc }, 7)).rejects.toThrow('no');
    await expect(loadCanApprove({ rpc })).rejects.toThrow('no');
  });
});

describe('approvers', () => {
  it('lists adult Members with whether each may approve', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: 2, display_name: 'Dana', can_approve: true },
        { id: 3, display_name: 'Eve', can_approve: false },
      ],
      error: null,
    });
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    const client = { from: vi.fn(() => ({ select })) };
    expect(await loadApprovers(client)).toEqual([
      { id: 2, name: 'Dana', allowed: true },
      { id: 3, name: 'Eve', allowed: false },
    ]);
    expect(eq).toHaveBeenCalledWith('role', 'member');
  });

  it('allows or disallows through set_member_can_approve', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await setMemberCanApprove({ rpc }, 2, true);
    expect(rpc).toHaveBeenCalledWith('set_member_can_approve', {
      p_member_id: 2,
      p_allowed: true,
    });
    rpc.mockResolvedValue({ error: new Error('no') });
    await expect(setMemberCanApprove({ rpc }, 2, false)).rejects.toThrow('no');
  });
});
