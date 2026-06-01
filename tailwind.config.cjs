/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx,js,jsx,mdx}",
    "./node_modules/flowbite-qwik/**/*.{ts,tsx,js,jsx,mjs}",
    "./node_modules/flowbite/**/*.{cjs,mjs}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-variant": "#353436",
        "outline-variant": "#464554",
        "on-primary-fixed": "#07006c",
        "tertiary-container": "#8392a6",
        "primary-fixed": "#e1e0ff",
        "on-primary-container": "#0d0096",
        "on-tertiary": "#233143",
        "primary-fixed-dim": "#9b9cff",
        "surface-container": "#201f20",
        primary: "#9b9cff",
        "on-secondary-fixed-variant": "#004e5a",
        "on-tertiary-fixed-variant": "#39485a",
        background: "#131314",
        "inverse-on-surface": "#313031",
        "primary-container": "#8083ff",
        "error-container": "#93000a",
        tertiary: "#b9c8de",
        error: "#ffb4ab",
        "on-secondary-container": "#00515d",
        "on-surface-variant": "#c7c4d7",
        "on-primary-fixed-variant": "#2f2ebe",
        "on-secondary-fixed": "#001f25",
        "surface-container-high": "#2a2a2b",
        "on-primary": "#1000a9",
        "on-error": "#690005",
        "inverse-primary": "#494bd6",
        "surface-container-highest": "#353436",
        "on-secondary": "#00363e",
        "on-error-container": "#ffdad6",
        "surface-dim": "#131314",
        "secondary-container": "#00cbe6",
        "on-tertiary-fixed": "#0d1c2d",
        "surface-bright": "#3a393a",
        secondary: "#5de6ff",
        "on-tertiary-container": "#1c2b3c",
        "tertiary-fixed": "#d4e4fa",
        surface: "#131314",
        "secondary-fixed-dim": "#2fd9f4",
        "on-background": "#e5e2e3",
        "inverse-surface": "#e5e2e3",
        "surface-container-lowest": "#0e0e0f",
        outline: "#908fa0",
        "surface-container-low": "#1c1b1c",
        "tertiary-fixed-dim": "#b9c8de",
        "surface-tint": "#9b9cff",
        "secondary-fixed": "#a2eeff",
        "on-surface": "#e5e2e3"
      },
      fontFamily: {
        headline: ["Sora", "Manrope", "system-ui", "sans-serif"],
        body: ["Manrope", "system-ui", "sans-serif"],
        label: ["Manrope", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "flow-line": "flowLine 3s linear infinite"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-20px)" }
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        flowLine: {
          "0%": { strokeDashoffset: "100" },
          "100%": { strokeDashoffset: "0" }
        }
      }
    }
  },
  plugins: [
    require("flowbite/plugin")
  ]
};
