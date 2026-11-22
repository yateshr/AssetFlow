import { forwardRef } from 'react';
import { DollarSign, Euro, IndianRupee, JapaneseYen, PoundSterling, RussianRuble, SwissFranc, TurkishLira, type LucideIcon } from 'lucide-react';
import { useCollection } from '@/lib/db';
import { DEFAULT_SYSTEM_POLICY, type SystemPolicy } from '@/data/masterData';

const ICONS: Record<string, LucideIcon> = {
  INR: IndianRupee, EUR: Euro, GBP: PoundSterling, JPY: JapaneseYen, CNY: JapaneseYen, RUB: RussianRuble, CHF: SwissFranc, TRY: TurkishLira,
};

/** Money icon that matches the company's default currency (₹ for INR, € for EUR, and so on; $ otherwise). */
export const CurrencyIcon = forwardRef<SVGSVGElement, React.ComponentProps<LucideIcon>>(function CurrencyIcon(props, ref) {
  const [policies] = useCollection<SystemPolicy>('system-policies');
  const code = (policies[0] || DEFAULT_SYSTEM_POLICY).defaultCurrency.toUpperCase();
  const Icon = ICONS[code] || DollarSign;
  return <Icon ref={ref} {...props} />;
}) as unknown as LucideIcon;
