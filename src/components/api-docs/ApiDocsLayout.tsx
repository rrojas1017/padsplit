import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  children?: { id: string; label: string }[];
}

interface ApiDocsLayoutProps {
  navItems: NavItem[];
  children: React.ReactNode;
}

export function ApiDocsLayout({ navItems, children }: ApiDocsLayoutProps) {
  const [activeSection, setActiveSection] = useState(navItems[0]?.id || '');
  const mainRef = useRef<HTMLElement>(null);

  // Collect all section IDs (parents + children)
  const allIds = navItems.flatMap(item => [item.id, ...(item.children?.map(c => c.id) || [])]);

  useEffect(() => {
    const scrollRoot = mainRef.current;
    if (!scrollRoot) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the one closest to the top
          const top = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          );
          if (top.target.id) setActiveSection(top.target.id);
        }
      },
      { root: scrollRoot, rootMargin: '-56px 0px -50% 0px', threshold: 0.1 }
    );

    allIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [navItems]);

  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el && mainRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex-shrink-0 z-30 flex items-center px-6 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm tracking-tight">Appendify API</span>
        </div>
        <div className="ml-3 px-2 py-0.5 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold uppercase tracking-wider">
          v1.0
        </div>
        <div className="flex-1" />
        <a
          href="#submit-conversation-audio"
          onClick={(e) => handleNavClick(e, 'submit-conversation-audio')}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Endpoints
        </a>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar — fixed in place, scrolls independently */}
        <aside className="hidden lg:flex flex-col w-60 border-r border-border bg-card/50 flex-shrink-0 overflow-y-auto">
          <div className="p-4 pt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3 px-2">
              Documentation
            </p>
            <nav className="space-y-0.5">
              {navItems.map(item => {
                const isActive = activeSection === item.id;
                const isChildActive = item.children?.some(c => activeSection === c.id);
                return (
                  <div key={item.id}>
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => handleNavClick(e, item.id)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-all duration-150 ${
                        isActive || isChildActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {item.icon && <item.icon className="w-3.5 h-3.5 flex-shrink-0" />}
                      <span>{item.label}</span>
                      {(isActive || isChildActive) && <ChevronRight className="w-3 h-3 ml-auto" />}
                    </a>
                    {item.children?.map(child => (
                      <a
                        key={child.id}
                        href={`#${child.id}`}
                        onClick={(e) => handleNavClick(e, child.id)}
                        className={`flex items-center gap-2 pl-8 pr-2.5 py-1.5 rounded-md text-xs transition-all duration-150 ${
                          activeSection === child.id
                            ? 'text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main content — scrollable area */}
        <main ref={mainRef} className="flex-1 overflow-y-auto scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  );
}
