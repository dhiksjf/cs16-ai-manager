import { useTranslation } from 'react-i18next';
import { useTheme } from '@/context/ThemeContext';
import { changeLanguage } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Sun,
  Moon,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Language } from '@/types';
import { useData } from '@/context/DataContext';

interface HeaderProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({ collapsed, onToggleSidebar }) => {
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { syncToServer, lastSync } = useData();
  const currentLang = i18n.language as Language;

  const formatLastSync = () => {
    if (!lastSync) return t('common.never');
    const diff = Date.now() - lastSync;
    if (diff < 60000) return t('common.justNow') || 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 backdrop-blur-lg px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-9 w-9"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {/* Last sync indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={syncToServer}
                className="text-xs text-muted-foreground gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{formatLastSync()}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Last synced: {formatLastSync()}</p>
              <p className="text-xs text-muted-foreground">Click to sync now</p>
            </TooltipContent>
          </Tooltip>

          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="h-9 w-9"
              >
                {theme === 'light' ? (
                  <Moon className="h-4.5 w-4.5" />
                ) : (
                  <Sun className="h-4.5 w-4.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{theme === 'light' ? t('common.dark') : t('common.light')} {t('common.theme')}</p>
            </TooltipContent>
          </Tooltip>

          {/* Language Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Globe className="h-4.5 w-4.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => changeLanguage('en')}
                className={cn('gap-2', currentLang === 'en' && 'bg-accent')}
              >
                {currentLang === 'en' && <Check className="h-4 w-4" />}
                <span>English</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => changeLanguage('fr')}
                className={cn('gap-2', currentLang === 'fr' && 'bg-accent')}
              >
                {currentLang === 'fr' && <Check className="h-4 w-4" />}
                <span>Français</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
    </TooltipProvider>
  );
};
