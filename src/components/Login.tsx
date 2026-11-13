import { useState } from 'react';
import { Package, Eye, EyeOff, ShieldCheck, BarChart3, Wrench, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { User } from '@/data/sampleData';

interface LoginProps {
  users: User[];
  onLogin: (user: User) => void;
}

const highlights = [
  { icon: Package, title: 'Every asset, one place', text: 'Track hardware, licenses and invoices across locations.' },
  { icon: Wrench, title: 'Operations that flow', text: 'Assignments, maintenance and IT calls without the chaos.' },
  { icon: BarChart3, title: 'Reports that matter', text: 'Executive-ready insight in a couple of clicks.' },
];

export function Login({ users, onLogin }: LoginProps) {
  const [email, setEmail] = useState('sarah.johnson@company.com');
  const [password, setPassword] = useState('password');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setTimeout(() => {
      const user = users.find(item => item.email.toLowerCase() === email.toLowerCase());
      setIsLoading(false);
      if (!user || password !== 'password') {
        setError('Use an existing user email and the demo password.');
        return;
      }
      onLogin(user);
    }, 800);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden p-12 text-white bg-gradient-to-br from-[oklch(0.35_0.17_272)] via-[oklch(0.42_0.2_285)] to-[oklch(0.5_0.22_320)]">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/15 blur-3xl" style={{ animation: 'af-float 14s ease-in-out infinite' }} />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.7_0.2_330)]/30 blur-3xl" style={{ animation: 'af-float 18s ease-in-out infinite reverse' }} />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)', backgroundSize: '44px 44px' }}
        />

        <div className="relative flex items-center gap-3 af-fade-in">
          <div className="h-11 w-11 rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/25 flex items-center justify-center">
            <Package className="h-6 w-6" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">AssetFlow</span>
        </div>

        <div className="relative max-w-lg">
          <h2 className="af-page text-4xl xl:text-5xl font-bold leading-tight tracking-tight">
            Know what you own.<br />Run IT with confidence.
          </h2>
          <ul className="af-stagger mt-10 space-y-5">
            {highlights.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-md transition-all duration-300 hover:bg-white/15 hover:translate-x-1">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-white/15 flex items-center justify-center">
                  <Icon className="h-5 w-5" />
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
          <ShieldCheck className="h-4 w-4" /> Demo environment · no real data is stored
        </p>
      </aside>

      {/* Form panel */}
      <main className="af-ambient flex items-center justify-center p-6 sm:p-10">
        <div className="af-page w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-chart-4 flex items-center justify-center shadow-lg shadow-primary/30">
              <Package className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">AssetFlow</span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">Sign in to your IT asset management account</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="rounded border-input accent-[var(--primary)]" defaultChecked />
                <span className="text-muted-foreground">Remember me</span>
              </label>
              <button type="button" className="text-sm font-medium text-primary hover:underline underline-offset-4">
                Forgot password?
              </button>
            </div>
            <Button type="submit" size="lg" className="w-full h-11" disabled={isLoading}>
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : 'Sign in'}
            </Button>
            {error && (
              <p role="alert" className="af-scale-in rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive text-center">{error}</p>
            )}
          </form>

          <p className="mt-8 rounded-xl border border-dashed bg-card/60 px-4 py-3 text-center text-sm text-muted-foreground">
            Demo: sign in with any listed user email and password <span className="font-mono font-medium text-foreground">password</span>
          </p>
        </div>
      </main>
    </div>
  );
}
