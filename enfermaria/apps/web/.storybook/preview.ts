import type { Preview } from '@storybook/react';
import { withThemeByClassName } from '@storybook/addon-themes';
// Reutiliza exatamente os mesmos tokens/estilos da app (global.css) — as stories
// mostram os componentes tal como aparecem em produção, em claro e escuro.
import '../src/app/global.css';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    backgrounds: { disable: true }, // o fundo vem dos tokens (--bg-page), não do addon
  },
  decorators: [
    // Alterna a classe `dark` no <html> — o mesmo mecanismo que o dark-mode-toggle da app.
    withThemeByClassName({
      themes: { Claro: '', Escuro: 'dark', 'Alto contraste': 'contrast' },
      defaultTheme: 'Claro',
    }),
  ],
};

export default preview;
