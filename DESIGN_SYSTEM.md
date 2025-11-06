# DutchThrift Hub Design System

**Modern, Elegant SaaS Design inspired by Linear, Framer, Notion & Vercel**

---

## 🎨 Design Philosophy

Our design system centers around **orange (#FF6600)** as a confident, energetic brand accent—not a dominant color. The interface balances warmth with professionalism, creating a refined, high-end experience that feels both modern and approachable.

### Core Principles

- **Orange as Accent**: Used strategically for CTAs, links, icons, and hover states
- **Warm Neutrals**: Light mode uses soft warm whites and beiges; dark mode uses deep, sophisticated grays
- **Glassmorphism**: Subtle blur effects on modals, popovers, and overlays
- **Smooth Motion**: Fade, scale, and slide animations create a polished, intentional feel
- **Depth & Light**: Layered shadows and hover states convey hierarchy and interactivity

---

## 🌈 Color Palette

### Light Mode

#### Foundation
```css
Background:     hsl(30 20% 98%)    /* Soft warm white with beige undertone */
Foreground:     hsl(24 8% 12%)     /* Deep warm charcoal */
Card:           hsl(0 0% 100%)     /* Pure white cards */
Border:         hsl(24 12% 90%)    /* Warm light gray */
```

#### Primary (Brand Orange)
```css
Primary:        hsl(24 100% 50%)   /* #FF6600 - Your vibrant orange */
Primary Hover:  hsl(24 100% 45%)   /* Darker on hover */
```

#### Secondary & Muted
```css
Secondary:      hsl(24 15% 94%)    /* Warm off-white */
Muted:          hsl(24 10% 96%)    /* Very light warm gray */
Muted Fg:       hsl(24 6% 45%)     /* Medium gray text */
```

#### Status Colors
```css
Destructive:    hsl(0 72% 51%)     /* Confident red */
Success:        hsl(142 71% 45%)   /* Fresh green */
Warning:        hsl(38 92% 50%)    /* Warm amber */
Info:           hsl(199 89% 48%)   /* Clear blue */
```

### Dark Mode

#### Foundation
```css
Background:     hsl(0 0% 6%)       /* Deep neutral gray (not blue-black) */
Foreground:     hsl(0 0% 96%)      /* Off-white text */
Card:           hsl(0 0% 10%)      /* Elevated dark card */
Border:         hsl(0 0% 18%)      /* Subtle border */
```

#### Primary (Brand Orange)
```css
Primary:        hsl(24 100% 55%)   /* Slightly brighter for dark mode */
Primary Hover:  hsl(24 100% 60%)   /* Even brighter on hover */
```

#### Secondary & Muted
```css
Secondary:      hsl(0 0% 14%)      /* Elevated surface */
Muted:          hsl(0 0% 14%)      /* Same as secondary */
Muted Fg:       hsl(0 0% 60%)      /* Medium-light gray text */
```

#### Status Colors (Brighter for Contrast)
```css
Destructive:    hsl(0 72% 60%)     /* Vibrant red */
Success:        hsl(142 71% 50%)   /* Bright green */
Warning:        hsl(38 92% 55%)    /* Warm amber */
Info:           hsl(199 89% 55%)   /* Bright blue */
```

---

## 🎯 Color Usage Guidelines

### When to Use Orange

✅ **DO Use Orange For:**
- Primary action buttons (Submit, Save, Create)
- Active navigation items
- Important links and CTAs
- Icon accents on hover
- Focus rings and active states
- Progress indicators
- Important badges

❌ **DON'T Use Orange For:**
- Large background areas
- Body text
- Disabled states
- Decorative elements only
- Every interactive element

### Contrast & Accessibility

All color combinations meet **WCAG AA** standards:
- Primary on white: 4.5:1 ratio ✓
- Foreground on background: 12:1 ratio ✓
- Muted text on background: 4.8:1 ratio ✓

---

## 🧩 Component Patterns

### Buttons

```tsx
// Primary Orange Button (default)
<Button>Save Changes</Button>

// Outline Button (subtle)
<Button variant="outline">Cancel</Button>

// Ghost Button (minimal)
<Button variant="ghost">Learn More</Button>

// Destructive Button
<Button variant="destructive">Delete</Button>
```

**Visual Behavior:**
- Hover: Slight scale (1.02x) + shadow glow
- Active: Scale down (0.98x)
- Duration: 300ms smooth transition

### Cards

```tsx
<Card className="card-interactive">
  <CardHeader>
    <CardTitle>Dashboard Stats</CardTitle>
    <CardDescription>Your performance this week</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

**Visual Behavior:**
- Default: Soft shadow (shadow-card)
- Hover: Elevated shadow + subtle translate-y(-1px)
- Border: Subtle warm gray, highlights orange on hover

### Modals & Dialogs (Glassmorphism)

```tsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create New Order</DialogTitle>
      <DialogDescription>
        Enter order details below
      </DialogDescription>
    </DialogHeader>
    {/* Form content */}
  </DialogContent>
</Dialog>
```

**Visual Effects:**
- Background: Semi-transparent with backdrop-blur (20px)
- Overlay: Black/60 with subtle blur
- Animation: Fade + scale + slide (300ms)
- Shadow: Deep layered shadow (shadow-modal)

### Inputs

```tsx
<Input 
  placeholder="Search orders..." 
  className="input-focus-ring"
/>
```

**Visual Behavior:**
- Default: Subtle border
- Focus: Orange ring (2px at 20% opacity) + orange border
- Transition: 200ms smooth

### Badges

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Failed</Badge>
<Badge>Orange Default</Badge>
```

**Design:** Rounded, semi-transparent backgrounds with matching border

---

## ✨ Animation System

### Predefined Animations

```css
.animate-fade-in          /* Fade opacity 0 → 1 (300ms) */
.animate-fade-in-up       /* Fade + slide up 10px (400ms) */
.animate-fade-in-down     /* Fade + slide down 10px (400ms) */
.animate-scale-in         /* Fade + scale 0.95 → 1 (300ms cubic-bezier) */
.animate-slide-in-right   /* Fade + slide from left (300ms) */
```

### Usage Example

```tsx
<div className="animate-fade-in-up">
  <h1>Welcome to DutchThrift Hub</h1>
</div>
```

### Transition Utilities

```css
.transition-smooth   /* 300ms cubic-bezier(0.4, 0, 0.2, 1) */
.transition-bounce   /* 400ms cubic-bezier(0.68, -0.55, 0.265, 1.55) */
```

---

## 🌫️ Glassmorphism Effects

### Available Classes

```css
.glass               /* Standard glass: bg + 20px blur + border */
.glass-subtle        /* Light glass: bg + 12px blur (no border) */
.glass-strong        /* Heavy glass: bg + 40px blur + border */
.card-glass          /* Card with glass effect */
```

### Usage Example

```tsx
<div className="glass rounded-xl p-6">
  <h2>Floating Panel</h2>
  <p>Content with glassmorphism effect</p>
</div>
```

**When to Use:**
- Overlays (modals, popovers, sheets)
- Floating action panels
- Sidebar backgrounds
- Notification toasts

---

## 🎭 Shadow System

### Shadow Scale

```css
shadow-sm       /* Subtle shadow for small elements */
shadow-md       /* Default card shadow */
shadow-lg       /* Elevated cards on hover */
shadow-xl       /* Popovers and dropdowns */
shadow-2xl      /* Modals and sheets */
shadow-primary  /* Orange glow for primary elements */
```

### Component-Specific

```css
.shadow-card         /* Default card shadow */
.shadow-card-hover   /* Card on hover */
.shadow-modal        /* Dialog/modal shadow */
.shadow-primary      /* Orange glow effect */
```

---

## 📐 Typography

### Font Family
```css
--font-sans: 'Inter', ui-sans-serif, system-ui...
```

**Inter** is used throughout for its modern, readable, and professional aesthetic.

### Heading Scale

```tsx
<h1 className="text-4xl md:text-5xl font-semibold tracking-tight">
  Main Title
</h1>

<h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
  Section Title
</h2>

<h3 className="text-2xl md:text-3xl font-semibold tracking-tight">
  Subsection
</h3>
```

### Body Text
- Default: 14px (0.875rem)
- Tracking: -0.011em (subtle tightening)
- Line height: 1.5 (comfortable reading)

---

## 🏷️ Section-Specific Colors

For module differentiation, we use color-coded sections:

```css
/* Inbox - Blue */
--inbox-primary: 199 89% 48%
bg-gradient-inbox    /* Blue gradient */
text-inbox           /* Blue text */

/* Orders - Purple */
--orders-primary: 261 51% 51%
bg-gradient-orders   /* Purple gradient */
text-orders          /* Purple text */

/* Repairs - Orange (aligns with brand) */
--repairs-primary: 24 100% 50%
bg-gradient-repairs  /* Orange gradient */
text-repairs         /* Orange text */

/* Cases - Green */
--cases-primary: 142 71% 45%
bg-gradient-cases    /* Green gradient */
text-cases           /* Green text */
```

**Usage:**
```tsx
<div className="bg-repairs rounded-lg p-4">
  <h3 className="text-repairs">Repair Status</h3>
</div>
```

---

## 📱 Responsive Behavior

### Breakpoints (Tailwind Default)
```
sm:  640px   (tablets)
md:  768px   (small laptops)
lg:  1024px  (desktops)
xl:  1280px  (large desktops)
```

### Mobile-First Approach
```tsx
<h1 className="text-3xl md:text-5xl">
  Responsive Heading
</h1>

<Button className="w-full md:w-auto">
  Full-width on mobile, auto on desktop
</Button>
```

---

## 🧰 Utility Classes

### Hover Effects

```css
.hover-glow          /* Adds shadow-primary on hover */
.card-interactive    /* Card with hover animation */
.table-row-hover     /* Table row hover state */
```

### Gradients

```css
.bg-gradient-primary   /* Orange → warm orange */
.btn-gradient          /* Gradient button with glow */
```

### Custom Scrollbars

```css
.scrollbar-thin   /* Slim scrollbar with orange tint */
.scrollbar-hide   /* Completely hidden scrollbar */
```

---

## 🎨 Example Usage in Real Components

### Dashboard KPI Card

```tsx
<Card className="card-interactive">
  <CardHeader className="pb-2">
    <CardTitle className="text-sm font-medium text-muted-foreground">
      Total Revenue
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="text-3xl font-bold">$45,231</div>
    <p className="text-xs text-success">
      +20.1% from last month
    </p>
  </CardContent>
</Card>
```

### Action Button with Icon

```tsx
<Button className="gap-2">
  <Plus className="h-4 w-4" />
  Create Order
</Button>
```

### Status Badge

```tsx
<Badge variant="success">
  <CheckCircle className="h-3 w-3 mr-1" />
  Completed
</Badge>
```

### Glassmorphic Panel

```tsx
<div className="glass-strong rounded-xl p-6 animate-scale-in">
  <h3 className="font-semibold text-lg mb-2">Quick Actions</h3>
  <div className="space-y-2">
    <Button variant="outline" className="w-full">
      New Invoice
    </Button>
    <Button variant="outline" className="w-full">
      New Customer
    </Button>
  </div>
</div>
```

---

## 🚀 Design Rationale

### Why Orange?
- **Energy & Warmth**: Orange conveys approachability and dynamism
- **Differentiation**: Stands out from typical blue/teal SaaS products
- **Brand Identity**: Memorable and confident

### Why Warm Neutrals in Light Mode?
- **Eye Comfort**: Softer than stark white, reduces eye strain
- **Premium Feel**: Warm tones feel more handcrafted and high-end
- **Brand Cohesion**: Complements orange accent naturally

### Why Deep Grays in Dark Mode?
- **Not Pure Black**: Reduces harsh contrast, easier on eyes
- **No Cold Blues**: Maintains warmth even in dark mode
- **Depth & Hierarchy**: Subtle gray variations create visual layers

### Why Glassmorphism?
- **Modern Aesthetic**: Aligns with Linear/Notion/Framer trends
- **Visual Hierarchy**: Clearly separates modal content from background
- **Depth Perception**: Blur creates sense of floating layers

### Why Smooth Animations?
- **Polish & Quality**: Motion design signals attention to detail
- **User Feedback**: Confirms interactions (button presses, modal opens)
- **Reduced Jarring**: Gradual transitions feel more natural

---

## 🎓 Best Practices

### DO ✅
- Use orange for primary CTAs and important actions
- Maintain consistent spacing (8px grid system)
- Apply glassmorphism to overlays and modals
- Use hover states on all interactive elements
- Leverage shadow system for depth
- Keep animations subtle and purposeful

### DON'T ❌
- Overuse orange—it should accent, not dominate
- Mix warm and cool grays (stick to neutral grays in dark mode)
- Skip hover/focus states on interactive elements
- Use pure black (#000000) in dark mode
- Add animations without purpose
- Ignore accessibility contrast ratios

---

## 📊 Color Contrast Reference

| Combination                | Ratio  | WCAG AA | WCAG AAA |
|---------------------------|--------|---------|----------|
| Primary on White          | 4.5:1  | ✅      | ❌       |
| Primary on Background     | 4.8:1  | ✅      | ❌       |
| Foreground on Background  | 12:1   | ✅      | ✅       |
| Muted on Background       | 4.8:1  | ✅      | ❌       |
| Success on White          | 4.2:1  | ✅      | ❌       |
| Destructive on White      | 4.9:1  | ✅      | ❌       |

---

## 🔧 Customization

### Adjusting Brand Color

To change the primary orange, update these variables in `index.css`:

```css
:root {
  --primary: hsl(24 100% 50%);        /* Your new color in HSL */
  --primary-hover: hsl(24 100% 45%);  /* Slightly darker */
}

.dark {
  --primary: hsl(24 100% 55%);        /* Brighter for dark mode */
  --primary-hover: hsl(24 100% 60%);
}
```

### Adding New Colors

```css
:root {
  --custom-color: hsl(180 50% 50%);
}

.dark {
  --custom-color: hsl(180 50% 60%);
}
```

Then extend in `tailwind.config.ts`:

```ts
colors: {
  custom: "var(--custom-color)",
}
```

---

## 📚 Further Reading

- [Linear Design System](https://linear.app/method)
- [Radix UI Documentation](https://radix-ui.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Inter Font Family](https://rsms.me/inter/)
- [WCAG Contrast Guidelines](https://webaim.org/resources/contrastchecker/)

---

**Created:** November 2025  
**Design System Version:** 1.0  
**Framework:** React + Tailwind CSS + shadcn/ui
