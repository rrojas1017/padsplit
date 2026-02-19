import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find(e => e.isIntersecting);
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    );
    navItems.forEach(item => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
      item.children?.forEach(child => {
        const childEl = document.getElementById(child.id);
        if (childEl) observer.observe(childEl);
      });
    });
    return () => observer.disconnect();
  }, [navItems]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 flex items-center px-6 gap-3">
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
        <a href="#submit-conversation-audio" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Endpoints
        </a>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col w-60 border-r border-border bg-card/50 flex-shrink-0 overflow-y-auto">
          <div className="p-4 pt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3 px-2">
              Documentation
            </p>
            <nav className="space-y-0.5">
              {navItems.map(item => {
                const isActive = activeSection === item.id;
                return (
                  <div key={item.id}>
                    <a
                      href={`#${item.id}`}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-md text-sm transition-all duration-150 ${
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {item.icon && <item.icon className="w-3.5 h-3.5 flex-shrink-0" />}
                      <span>{item.label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                    </a>
                    {item.children?.map(child => (
                      <a
                        key={child.id}
                        href={`#${child.id}`}
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

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
