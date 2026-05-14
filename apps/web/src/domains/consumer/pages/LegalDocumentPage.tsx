import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { ConsumerResponsiveFrame } from '../components/ConsumerResponsiveFrame';
import { getLegalDocument, type LegalDocumentKind } from '../model/legal-documents';

function getLegalKindFromPath(pathname: string): LegalDocumentKind {
  return pathname === '/terms' ? 'terms' : 'privacy';
}

function LegalDocumentNav({ activeKind }: { activeKind: LegalDocumentKind }) {
  const links: Array<{ kind: LegalDocumentKind; label: string; to: string }> = [
    { kind: 'terms', label: '서비스 이용약관', to: '/terms' },
    { kind: 'privacy', label: '개인정보 처리방침', to: '/privacy' }
  ];

  return (
    <nav aria-label="법적 문서" className="scrollbar-hidden flex gap-2 overflow-x-auto px-5 pb-4">
      {links.map((link) => {
        const isActive = link.kind === activeKind;

        return (
          <Link
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'shrink-0 rounded-md bg-white px-3 py-2 text-sm font-bold text-zinc-950'
                : 'shrink-0 rounded-md bg-white/10 px-3 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/16 hover:text-white'
            }
            key={link.kind}
            to={link.to}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function LegalDocumentPage() {
  const location = useLocation();
  const kind = getLegalKindFromPath(location.pathname);
  const document = getLegalDocument(kind);

  useEffect(() => {
    window.document.title = `Promptoon ${document.title}`;
  }, [document.title]);

  return (
    <ConsumerResponsiveFrame>
      <article className="min-h-dvh px-5 pb-14 pt-[max(env(safe-area-inset-top),1.5rem)]">
        <header className="-mx-5 border-b border-white/10 px-5 pb-5">
          <Link className="inline-flex items-center gap-2" to="/">
            <img alt="" className="h-8 w-8 rounded-md bg-white object-cover" src="/promptoon-icon.webp" />
            <span className="font-display text-lg font-semibold tracking-normal text-white">Promptoon</span>
          </Link>
          <p className="mt-7 text-xs font-semibold uppercase tracking-normal text-white/42">Legal</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-normal text-white">{document.title}</h1>
          <p className="mt-3 text-sm leading-6 text-white/58">시행일: {document.effectiveDate}</p>
        </header>

        <div className="-mx-5 border-b border-white/10 bg-[#09090b]/95 pt-4">
          <LegalDocumentNav activeKind={kind} />
        </div>

        <div className="space-y-9 py-8">
          {document.sections.map((section) => (
            <section className="min-w-0" key={section.title}>
              <h2 className="text-lg font-bold leading-7 text-white">{section.title}</h2>

              {section.paragraphs?.map((paragraph) => (
                <p className="mt-3 text-sm leading-7 text-white/70" key={paragraph}>
                  {paragraph}
                </p>
              ))}

              {section.items ? (
                <ul className="mt-4 space-y-2 text-sm leading-7 text-white/66">
                  {section.items.map((item) => (
                    <li className="flex gap-2" key={item}>
                      <span aria-hidden className="mt-3 h-1 w-1 shrink-0 rounded-full bg-white/42" />
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </article>
    </ConsumerResponsiveFrame>
  );
}
