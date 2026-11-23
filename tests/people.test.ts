import { describe, expect, it } from 'vitest';
import { employeesOf, isEmployee } from '@/lib/people';

describe('employees vs logins', () => {
  it('treats only role "user" as an employee', () => {
    expect(isEmployee({ role: 'user' })).toBe(true);
    expect(isEmployee({ role: 'super_admin' })).toBe(false);
    expect(isEmployee({ role: 'admin' })).toBe(false);
    expect(isEmployee({ role: 'manager' })).toBe(false);
  });
  it('keeps the staff and drops the logins', () => {
    const people = [{ id: 'a', role: 'super_admin' as const }, { id: 'b', role: 'manager' as const }, { id: 'c', role: 'user' as const }, { id: 'd', role: 'user' as const }];
    expect(employeesOf(people).map(p => p.id)).toEqual(['c', 'd']);
  });
});
