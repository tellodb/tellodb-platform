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
        "surface-variant": "#e2e7f0",
        "outline-variant": "#8994a8",
        "on-primary-fixed": "#211a63",
        "tertiary-container": "#dce3ee",
        "primary-fixed": "#e7e4ff",
        "on-primary-container": "#2d266f",
        "on-tertiary": "#ffffff",
        "primary-fixed-dim": "#c8c2ff",
        "surface-container": "#e2e7f0",
        primary: "#463aa8",
        "on-secondary-fixed-variant": "#0b4f70",
        "on-tertiary-fixed-variant": "#48546b",
        background: "#f4f6fb",
        "inverse-on-surface": "#f4f6fb",
        "primary-container": "#dfdcff",
        "error-container": "#fde3e5",
        tertiary: "#4a5770",
        error: "#bd3748",
        "on-secondary-container": "#0b4f70",
        "on-surface-variant": "#354158",
        "on-primary-fixed-variant": "#443a9e",
        "on-secondary-fixed": "#092d3f",
        "surface-container-high": "#d5dce8",
        "on-primary": "#ffffff",
        "on-error": "#ffffff",
        "inverse-primary": "#c8c2ff",
        "surface-container-highest": "#d4dce8",
        "on-secondary": "#ffffff",
        "on-error-container": "#7a1725",
        "surface-dim": "#e9edf5",
        "secondary-container": "#d9f1ff",
        "on-tertiary-fixed": "#243047",
        "surface-bright": "#ffffff",
        secondary: "#076b9e",
        "on-tertiary-container": "#344157",
        "tertiary-fixed": "#e7ebf3",
        surface: "#f6f8fc",
        "secondary-fixed-dim": "#9bd7f6",
        "on-background": "#0b1020",
        "inverse-surface": "#222b3d",
        "surface-container-lowest": "#ffffff",
        outline: "#78849a",
        "surface-container-low": "#edf0f6",
        "tertiary-fixed-dim": "#c9d1df",
        "surface-tint": "#463aa8",
        "secondary-fixed": "#d9f1ff",
        "on-surface": "#0b1020"
      },
      fontFamily: {
        headline: ["Onest", "Avenir Next", "Segoe UI", "sans-serif"],
        body: ["Onest", "Avenir Next", "Segoe UI", "sans-serif"],
        label: ["Onest", "Avenir Next", "Segoe UI", "sans-serif"],
        mono: ["SFMono-Regular", "Cascadia Code", "Source Code Pro", "monospace"]
      },
      borderRadius: {
        DEFAULT: "0.25rem",
        lg: "0.5rem",
        xl: "0.75rem",
        full: "9999px"
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
