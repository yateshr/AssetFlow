import { useEffect, useState } from 'react';
import { Package, Eye, EyeOff, ShieldCheck, BarChart3, Wrench, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActivityIndicator } from '@/components/ui/loading';
import { Input } from '@/components/ui/input';
import { needsSetup, resetPassword, signIn, signUp, signupAllowed } from '@/lib/auth';

type Mode = 'checking' | 'signin' | 'setup' | 'invited';

const highlights = [
  { icon: Package, title: 'Every asset, one place', text: 'Track hardware, licenses and invoices across all your locations.' },
  { icon: Wrench, title: 'Operations that flow', text: 'Assignments, maintenance and IT calls without the chaos.' },
  { icon: BarChart3, title: 'Reports that matter', text: 'Executive-ready insight in a couple of clicks.' },
];

export function Login() {
  const [mode, setMode] = useState<Mode>('checking');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    needsSetup()
      .then(first => setMode(first ? 'setup' : 'signin'))
      .catch(e => {
        setError(`Cannot reach the database: ${e.message}. Have you run the migration in supabase/migrations?`);
        setMode('signin');
      });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
        return; // App reacts to the new session
      }
      if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
      if (mode === 'invited' && !(await signupAllowed(email))) {
        throw new Error('That e-mail has not been added yet. Ask an administrator to add you on the Users page first.');
      }
      const { confirmationRequired } = await signUp(email, password, { name: name.trim(), companyName: companyName.trim() });
      if (confirmationRequired) {
        setNotice('Account created. Check your inbox to confirm your e-mail, then sign in.');
        setMode('signin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError('');
    setNotice('');
    if (!email) return setError('Enter your e-mail first, then choose "Forgot password".');
    try {
      await resetPassword(email);
      setNotice('Password reset link sent. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset e-mail.');
    }
  };

  const heading =
    mode === 'setup' ? 'Set up your workspace' : mode === 'invited' ? 'Create your account' : 'Welcome back';
  const subheading =
    mode === 'setup'
      ? 'You are the first user, so you will become the administrator.'
      : mode === 'invited'
        ? 'Use the e-mail address your administrator added for you.'
        : 'Sign in to your IT asset management account';
  const needsName = mode === 'setup' || mode === 'invited';

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-white/10 bg-[oklch(0.19_0.03_255)] p-12 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '44px 44px' }}
        />

        <div className="relative flex items-center gap-3 af-fade-in">
          <div className="h-10 w-10 rounded-md bg-white/10 ring-1 ring-white/15 flex items-center justify-center">
            <Package className="h-5 w-5 text-[oklch(0.75_0.14_248)]" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">AssetFlow</span>
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-[-0.035em] xl:text-[44px]">
            One reliable system<br />for your IT operations.
          </h2>
          <ul className="af-stagger mt-10 space-y-5">
            {highlights.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 border-t border-white/10 py-4 first:border-t-0">
                <div className="h-9 w-9 shrink-0 rounded-md bg-white/[0.07] flex items-center justify-center">
                  <Icon className="h-[18px] w-[18px] text-[oklch(0.75_0.14_248)]" />
                </div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-white/75">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-sm text-white/70">
          <ShieldCheck className="h-4 w-4" /> Your data lives in your own database
        </p>
      </aside>

      {/* Form panel */}
      <main className="af-ambient flex items-center justify-center p-6 sm:p-10">
        <div className="af-page w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">AssetFlow</span>
          </div>

          {mode === 'checking' ? (
            <div className="flex items-center gap-3 text-muted-foreground"><ActivityIndicator className="text-primary" label="Connecting" /> Connecting…</div>
          ) : (
            <>
              <h1 className="text-3xl font-bold tracking-tight">{heading}</h1>
              <p className="mt-2 text-muted-foreground">{subheading}</p>

              <form onSubmit={submit} className="mt-8 space-y-5">
                {needsName && (
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Your name</label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required />
                  </div>
                )}
                {mode === 'setup' && (
                  <div className="space-y-2">
                    <label htmlFor="company" className="text-sm font-medium">Company name</label>
                    <Input id="company" value={companyName} onChange={e => setCompanyName(e.target.value)} autoComplete="organization" required />
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">Email</label>
                  <Input id="email" type="email" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">Password</label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={mode === 'signin' ? 'Enter your password' : 'At least 8 characters'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {mode === 'signin' && (
                  <div className="flex justify-end">
                    <button type="button" onClick={forgot} className="text-sm font-medium text-primary hover:underline underline-offset-4">
                      Forgot password?
                    </button>
                  </div>
                )}
                <Button type="submit" size="lg" className="w-full h-11" disabled={busy}>
                  {busy
                    ? <><ActivityIndicator label="Signing in" /> Please wait…</>
                    : mode === 'signin' ? 'Sign in' : mode === 'setup' ? 'Create workspace' : 'Create account'}
                </Button>
                {error && (
                  <p role="alert" className="af-scale-in rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive text-center">{error}</p>
                )}
                {notice && (
                  <p role="status" className="af-scale-in flex items-center justify-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary text-center">
                    <MailCheck className="h-4 w-4 shrink-0" /> {notice}
                  </p>
                )}
              </form>

              {mode !== 'setup' && (
                <p className="mt-8 text-center text-sm text-muted-foreground">
                  {mode === 'signin' ? (
                    <>Invited by your administrator?{' '}
                      <button type="button" className="font-medium text-primary hover:underline underline-offset-4" onClick={() => { setError(''); setMode('invited'); }}>
                        Create your account
                      </button></>
                  ) : (
                    <>Already have an account?{' '}
                      <button type="button" className="font-medium text-primary hover:underline underline-offset-4" onClick={() => { setError(''); setMode('signin'); }}>
                        Sign in
                      </button></>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** Shown when the .env keys are missing. */
export function ConfigMissing() {
  return (
    <div className="min-h-screen af-ambient flex items-center justify-center p-6">
      <div className="af-page max-w-xl w-full rounded-2xl border bg-card p-8 shadow-[var(--shadow-soft)]">
        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-chart-4 flex items-center justify-center mb-5">
          <Package className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Connect your database</h1>
        <p className="mt-2 text-muted-foreground">AssetFlow stores everything in your own Supabase project. Finish these steps once:</p>
        <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm">
          <li>Create a free project at <span className="font-medium">supabase.com</span>.</li>
          <li>Run <code className="rounded bg-muted px-1.5 py-0.5">supabase/migrations/20260101000000_assetflow_schema.sql</code> in the SQL editor.</li>
          <li>Copy <code className="rounded bg-muted px-1.5 py-0.5">.env.example</code> to <code className="rounded bg-muted px-1.5 py-0.5">.env</code> and fill in your project URL and publishable key.</li>
          <li>Restart <code className="rounded bg-muted px-1.5 py-0.5">pnpm dev</code>.</li>
        </ol>
        <p className="mt-5 text-sm text-muted-foreground">The README has the full walkthrough.</p>
      </div>
    </div>
  );
}
