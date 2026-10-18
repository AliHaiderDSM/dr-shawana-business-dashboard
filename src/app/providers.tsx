import { type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { store } from '@redux/store';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/lib/auth/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="top-right" richColors={false} closeButton />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );
}
