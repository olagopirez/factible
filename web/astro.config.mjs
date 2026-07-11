// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Sitio publicado en GitHub Pages bajo /factible/
export default defineConfig({
  site: 'https://olagopirez.github.io',
  base: '/factible',
  integrations: [
    starlight({
      title: 'factible',
      description:
        'Infraestructura open source para integrarte con el Estado uruguayo: DGI (CFE), BCU, AGESIC, Intendencia de Montevideo y más.',
      defaultLocale: 'root',
      locales: {
        root: { label: 'Español', lang: 'es' },
      },
      logo: {
        light: './src/assets/logo-lockup.svg',
        dark: './src/assets/logo-lockup.svg',
        replacesTitle: true,
      },
      favicon: '/assets/favicon-32.png',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/olagopirez/factible' },
      ],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        { label: 'Empezar', slug: 'empezar' },
        {
          label: 'Conectores',
          items: [
            { slug: 'cfe' },
            { slug: 'validar' },
            { slug: 'bcu' },
            { slug: 'montevideo' },
            { slug: 'id-uruguay' },
          ],
        },
        { label: 'Gateway hosteado', slug: 'gateway' },
      ],
      editLink: {
        baseUrl: 'https://github.com/olagopirez/factible/edit/main/web/',
      },
    }),
  ],
});
