/**
 * Logins are not employees. The Super Admin and site IT admins are credentials (an e-mail and password)
 * for running the system; their profile rows carry a role of admin or manager. Employees are the staff
 * register: people who are given equipment, with role "user". Lists of employees (the Employees page,
 * Assign, Issue, headcounts) use only these.
 */
import type { User } from '@/data/models';

export const isEmployee = (user: Pick<User, 'role'>): boolean => user.role === 'user';

export const employeesOf = <T extends Pick<User, 'role'>>(users: T[]): T[] => users.filter(isEmployee);
