# 🤫 Hushh WebApp

> **🤫 Your Data. Your Business.**
> Personal AI Agent Platform — consent-first, privacy-native

---

## 🎯 What is Hushh?

Hushh is a **personal AI agent platform** that puts users in control of their data. Unlike traditional AI that works for the algorithm, Hushh agents work **exclusively for the user** with full consent and transparency.

### The Five Pillars

| Pillar          | Purpose                                         |
| --------------- | ----------------------------------------------- |
| **Hushh Agent** | AI companion that acts with context and consent |
| **Hushh Vault** | Encrypted personal data storage                 |
| **Hushh Link**  | Identity and permissions layer                  |
| **Hushh Flow**  | APIs and monetization for brands                |
| **Hushh Grid**  | Compute engine for agentic AI                   |

---

## 🏗️ Project Structure

```
hushh-experimental/
├── app/                    # Next.js App Router
│   ├── page.tsx            # Landing page
│   ├── jarvis/page.tsx     # Chat interface (connected to ADK)
│   ├── consent/page.tsx    # Data consent dashboard
│   ├── personas/page.tsx   # Agent persona gallery
│   ├── docs/page.tsx       # Documentation
│   ├── api/chat/route.ts   # ADK API endpoint
│   ├── layout.tsx          # Root layout + JarvisBackground
│   └── globals.css         # Design system (Liquid Glass + Iron Man)
├── components/
│   └── ui/                 # 45 reusable UI components
├── lib/
│   └── morphy-ux/          # Ripple effects, colors, variants
├── hushhrules.md           # Design guidelines
├── iwebrules.md            # Original design system rules
└── README.md               # This file
```

---

## 🎨 Design System

### Theme: iOS Liquid Glass + Iron Man Accents

| Token                 | Value                   |
| --------------------- | ----------------------- |
| `--color-accent-red`  | `#DC143C` (Primary CTA) |
| `--color-accent-gold` | `#C7A035` (Secondary)   |
| `--color-background`  | `#FAFAFA`               |
| `--color-success`     | `#30D158`               |
| `--color-info`        | `#007AFF`               |

### CSS Classes

```css
.glass              /* Standard frosted glass */
/* Standard frosted glass */
/* Standard frosted glass */
/* Standard frosted glass */
.glass-prominent    /* Heavy glass for sidebars */
.glass-interactive  /* With hover effects */
.card-glass         /* Glass card */
.nav-glass; /* Navigation bar glass */
```

### Typography

```css
.text-headline      /* 2.5rem/700 - Page titles */
/* 2.5rem/700 - Page titles */
/* 2.5rem/700 - Page titles */
/* 2.5rem/700 - Page titles */
.text-title         /* 1.375rem/600 - Section headers */
.text-body          /* 1rem - Body text */
.text-caption       /* 0.8125rem - Secondary */
.text-small; /* 0.75rem - Tertiary */
```

---

## 🧩 Component Usage

### Button (Primary)

```tsx
import { Button } from "@/components/ui/button";

<Button
  variant="gradient" // ColorVariant
  effect="glass" // "fill" | "glass" | "fade"
  showRipple // Click ripple (NOT hover)
  size="lg" // "sm" | "default" | "lg" | "xl"
>
  Click Me
</Button>;
```

### Card

```tsx
import { Card, CardTitle, CardDescription } from "@/components/ui/card";

<Card variant="none" effect="glass" showRipple onClick={handler}>
  <CardTitle>Title</CardTitle>
  <CardDescription>Description</CardDescription>
</Card>;
```

> ⚠️ **Note:** `RippleButton` exists but is redundant. Use `Button showRipple` instead.

---

## 🤖 Agent Modes

| Mode         | Icon | Purpose                  | Endpoint  |
| ------------ | ---- | ------------------------ | --------- |
| Optimizer    | 📈   | Time/money optimization  | `/kai`    |
| Curator      | 🎯   | Data organization        | `/nav`    |
| Professional | 💼   | Career context           | `/kushal` |
| Orchestrator | 🔗   | Multi-agent coordination | `/`       |

---

## 📊 Data Categories

| Category     | Icon | Examples                       |
| ------------ | ---- | ------------------------------ |
| Financial    | 💰   | Spending, budgets, investments |
| Calendar     | 📅   | Events, meetings, reminders    |
| Professional | 💼   | Skills, projects, resume       |
| Health       | ❤️   | Fitness, wellness              |
| Preferences  | ⚙️   | Likes, style, settings         |
| Network      | 👥   | Contacts, relationships        |

---

## 🔌 API

### Chat Endpoint

```bash
POST /api/chat
Content-Type: application/json

{
  "message": "Check my spending",
  "mode": "curator",
  "sessionId": "user-123"
}
```

**Response:**

```json
{
  "response": "Based on your data...",
  "mode": "curator",
  "dataUsed": ["Financial"],
  "sessionId": "user-123"
}
```

### Backend (ADK)

- **Base URL:** `https://hushh-kai-demo-832747646411.us-central1.run.app`
- **Protocol:** A2A (Agent-to-Agent)
- **Model:** Gemini 3 Flash

---

## 🎬 Background

The app uses `JarvisBackground` - an animated SVG with:

- Arc reactor concentric circles
- Hexagon grid overlay
- Radiating lines
- Pulsing data points

```tsx
import { JarvisBackground } from "@/components/ui/jarvis-background";

<JarvisBackground intensity="subtle" />; // "subtle" | "medium" | "bold"
```

---

## 📋 Key Rules

1. **Ripple on CLICK only** — via `showRipple` prop, never on hover
2. **NO hover scale effects** — use opacity/background transitions
3. **Use existing components** — Button, Card from `components/ui`
4. **Use CSS classes** — `.glass`, `.text-headline`, etc.
5. **Phosphor Icons** — Always with `Icon` suffix

---

## 🚀 Getting Started

```bash
npm install
npm run dev
# Open http://localhost:3000
```

---

## 📁 Related Files

| File                | Purpose                          |
| ------------------- | -------------------------------- |
| `hushhrules.md`     | Hushh-specific design guidelines |
| `iwebrules.md`      | Full design system documentation |
| `lib/morphy-ux/`    | Ripple effects, color variants   |
| `.agent/workflows/` | AI agent workflows               |

---

_Built with Next.js 16, Tailwind CSS, Framer Motion, Google ADK_
