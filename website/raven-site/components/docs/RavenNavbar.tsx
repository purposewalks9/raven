// components/docs/RavenNavbar.tsx

import { RavenLogo } from './RavenLogo';

export function RavenNavbar() {
  return (
    <header className="h-16 border-b px-6 flex items-center justify-between">
      <RavenLogo />

      <nav className="flex gap-6 text-sm">
        <a href="/docs">Docs</a>
        <a href="/playground">Playground</a>
        <a href="/blog">Blog</a>
        <a href="https://github.com/...">GitHub</a>
      </nav>
    </header>
  );
}