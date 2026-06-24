import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';
import { changeLanguage } from '@/i18n';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Globe, Moon, Sun, Save, Palette,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Language, ThemeMode } from '@/types';

export const SettingsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const currentLang = i18n.language as Language;

  const [bizName, setBizName] = useState(localStorage.getItem('rp-business-name') || '');
  const [bizAddress, setBizAddress] = useState(localStorage.getItem('rp-business-address') || '');
  const [bizPhone, setBizPhone] = useState(localStorage.getItem('rp-business-phone') || '');
  const [bizEmail, setBizEmail] = useState(localStorage.getItem('rp-business-email') || '');
  const [bizTax, setBizTax] = useState(localStorage.getItem('rp-business-tax') || '');

  const handleSave = () => {
    localStorage.setItem('rp-business-name', bizName);
    localStorage.setItem('rp-business-address', bizAddress);
    localStorage.setItem('rp-business-phone', bizPhone);
    localStorage.setItem('rp-business-email', bizEmail);
    localStorage.setItem('rp-business-tax', bizTax);
    toast.success(t('settings.settingsSaved'));
  };

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: 'en', label: 'English', flag: 'EN' },
    { code: 'fr', label: 'Français', flag: 'FR' },
  ];

  const themes: { mode: ThemeMode; label: string; icon: React.ElementType }[] = [
    { mode: 'light', label: t('common.light'), icon: Sun },
    { mode: 'dark', label: t('common.dark'), icon: Moon },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" />{t('settings.language')}</CardTitle>
          <CardDescription>{t('settings.selectLanguage')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => { changeLanguage(lang.code); toast.success(`Language changed to ${lang.label}`); }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
                  currentLang === lang.code
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:bg-accent'
                )}
              >
                <span className="text-xs font-bold">{lang.flag}</span>
                {lang.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" />{t('settings.theme')}</CardTitle>
          <CardDescription>{t('settings.selectTheme')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {themes.map(th => {
              const Icon = th.icon;
              return (
                <button
                  key={th.mode}
                  onClick={() => setTheme(th.mode)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all',
                    theme === th.mode
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:bg-accent'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {th.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Currency Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.currency')}</CardTitle>
          <CardDescription>{t('settings.selectCurrency')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300">DZ</div>
            <div>
              <p className="text-sm font-medium">Algerian Dinar (DZD)</p>
              <p className="text-xs text-muted-foreground">1 USD = ~135 DZD</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.businessInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>{t('settings.businessName')}</Label><input className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={bizName} onChange={e => setBizName(e.target.value)} /></div>
            <div className="space-y-2"><Label>{t('settings.businessPhone')}</Label><input className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={bizPhone} onChange={e => setBizPhone(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>{t('settings.businessEmail')}</Label><input type="email" className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={bizEmail} onChange={e => setBizEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label>{t('settings.businessAddress')}</Label><input className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={bizAddress} onChange={e => setBizAddress(e.target.value)} /></div>
          <div className="space-y-2"><Label>{t('settings.taxNumber')}</Label><input className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={bizTax} onChange={e => setBizTax(e.target.value)} /></div>
          <Separator />
          <Button onClick={handleSave} className="gap-2"><Save className="h-4 w-4" />{t('settings.saveSettings')}</Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};
