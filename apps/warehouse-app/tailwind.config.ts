import type { Config } from 'tailwindcss';

export default {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
        '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                warehouse: {
                    300: '#C4A8FF',
                    400: '#A67CFF',
                    500: '#6C3AE0',
                    600: '#5A2DC0',
                    700: '#4A22A5',
                },
                surface: {
                    DEFAULT: '#0F0F14',
                    card: '#1A1A22',
                    hover: '#22222C',
                    border: '#2A2A35',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
            },
        },
    },
    plugins: [],
} satisfies Config;
