import { ArrowLeft, Compass, Hammer } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/shared/empty-state';
import { ForbiddenState } from '@/components/shared/error-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import type { MenuItem } from '@/lib/permissions/menu';

function BackHome() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to="/">
        <ArrowLeft />
        Back to dashboard
      </Link>
    </Button>
  );
}

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      className="min-h-[60vh]"
      title="Page not found"
      description="The page you opened does not exist or was moved."
      action={<BackHome />}
    />
  );
}

export function ForbiddenPage() {
  return <ForbiddenState className="min-h-[60vh]" />;
}

export function ComingSoonPage({ item }: { item: MenuItem }) {
  return (
    <>
      <PageHeader title={item.label} />
      <div className="rounded-xl border bg-card shadow-xs">
        <EmptyState
          icon={Hammer}
          title={`${item.label} is on its way`}
          description={`This screen is built in dashboard phase ${item.phase}. The API is ready; the screen comes next.`}
          action={<BackHome />}
        />
      </div>
    </>
  );
}
