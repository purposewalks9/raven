import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <h1 className="font-medium text-1xl flex flex-row items-center md:text-2xl lg:text-2xl tracking-tight text-[#B7D50B]">
          Raven
        </h1>
      ),
    },

    links: [
      { text: 'Docs', url: '/docs' },
      { text: 'GitHub', url: 'https://github.com/purposewalks9/raven', external: true },
    ],
  };
}