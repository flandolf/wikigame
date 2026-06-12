import type { ReactNode } from 'react';
import ThemeToggle, { type ThemeMode } from './ThemeToggle';

interface ScreenFrameProps {
  className: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
  children: ReactNode;
}

export default function ScreenFrame({ className, theme, onToggleTheme, children }: ScreenFrameProps) {
  return (
    <div className={className}>
      <div className="screen-toolbar">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      {children}
    </div>
  );
}
