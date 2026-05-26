import Link from 'next/link';
import type { ReactNode } from 'react';

function classNames(
  ...values: readonly (false | null | string | undefined)[]
): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
}

export function PageShell({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={classNames('page-shell', className)}>
      {children}
    </section>
  );
}

export function PageHeading({
  children,
  eyebrow,
  title,
}: {
  readonly children?: ReactNode;
  readonly eyebrow: string;
  readonly title: ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children ? <div className="page-heading-copy">{children}</div> : null}
    </div>
  );
}

export function StoreSection({
  children,
  muted = false,
  variant,
}: {
  readonly children: ReactNode;
  readonly muted?: boolean;
  readonly variant?: 'featured';
}) {
  return (
    <section
      className={classNames(
        'section',
        muted && 'muted-section',
        variant === 'featured' && 'featured-section',
      )}
    >
      {children}
    </section>
  );
}

export function SectionHeading({
  actionHref,
  actionLabel,
  eyebrow,
  title,
}: {
  readonly actionHref?: string;
  readonly actionLabel?: string;
  readonly eyebrow: string;
  readonly title: ReactNode;
}) {
  return (
    <div className="section-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {actionHref && actionLabel ? (
        <Link href={actionHref}>{actionLabel}</Link>
      ) : null}
    </div>
  );
}
