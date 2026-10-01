import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-destructive-soft text-destructive-soft-foreground">
          <AlertTriangle className="size-5" />
        </div>
        <h2 className="text-lg font-semibold">This page ran into a problem</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Reload the page. If it keeps happening, tell your administrator.
        </p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    );
  }
}
