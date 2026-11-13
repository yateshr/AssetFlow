import { supabase } from './supabase';

function client() {
  if (!supabase) throw new Error('Supabase is not configured. See README.md.');
  return supabase;
}

/** True on a fresh install, before the first administrator exists. */
export async function needsSetup(): Promise<boolean> {
  const { data, error } = await client().rpc('app_needs_setup');
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function signupAllowed(email: string): Promise<boolean> {
  const { data, error } = await client().rpc('app_signup_allowed', { p_email: email });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function signIn(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(error.message);
}

/**
 * Creates the Supabase account. Returns `confirmationRequired: true` when the
 * project has "Confirm email" enabled and no session was issued yet.
 */
export async function signUp(
  email: string,
  password: string,
  meta: { name: string; companyName?: string }
): Promise<{ confirmationRequired: boolean }> {
  const { data, error } = await client().auth.signUp({
    email: email.trim(),
    password,
    options: { data: { full_name: meta.name, company_name: meta.companyName ?? '' } },
  });
  if (error) throw new Error(error.message);
  return { confirmationRequired: !data.session };
}

export async function signOut() {
  await client().auth.signOut();
}

export async function resetPassword(email: string) {
  const { error } = await client().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  if (error) throw new Error(error.message);
}
