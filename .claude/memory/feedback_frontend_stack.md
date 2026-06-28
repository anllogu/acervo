---
name: feedback-frontend-stack
description: User rejected Streamlit for the frontend; wants Next.js matching the AI Manager design system
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dbca48fa-a3c5-4be6-a625-de96cec5c83a
---

Use Next.js + Tailwind CSS for the Acervo frontend, NOT Streamlit.

**Why:** The user explicitly said "mejor ya back y front completo" and showed the AI Manager (SEIDOR internal app) screenshot as the design reference. The design is a production-quality React app, not a Streamlit dashboard.

**How to apply:** For all future frontend work on Acervo, use Next.js 14 (App Router) + Tailwind CSS. Replicate the AI Manager design system: dark gray-900 sidebar, white content area, indigo-600 primary accent, Inter font, card-based layout with rounded-xl / shadow-sm / border-gray-100.

Design tokens:
- Sidebar bg: `bg-gray-900`
- Active nav: `bg-indigo-950 border-l-2 border-indigo-500`
- Content bg: `bg-gray-50`
- Cards: `bg-white rounded-xl shadow-sm border border-gray-100`
- Primary: `indigo-600` / `indigo-500`
- Font: Inter
