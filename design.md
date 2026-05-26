---
version: alpha
name: Fairytales with Spice
description: A sophisticated, romantic design system for AI-generated adult fairy tales
colors:
  primary: "#8B0000"
  secondary: "#D4AF37"
  tertiary: "#2C1810"
  accent-deep-rose: "#C41E3A"
  accent-gold: "#F4D03F"
  neutral-dark: "#0F0F0F"
  neutral-light: "#E8E8E8"
  background-dark: "#1A1A1A"
typography:
  h1:
    fontFamily: Georgia, serif
    fontSize: 52px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: 0
  h2:
    fontFamily: Georgia, serif
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.2
  h3:
    fontFamily: Georgia, serif
    fontSize: 28px
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: Lora, serif
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.7
  body-md:
    fontFamily: Lora, serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: system-ui, sans-serif
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
rounded:
  none: 0px
  sm: 2px
  md: 4px
  lg: 6px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 32px
  xl: 64px
  gutter: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-light}"
    rounded: "{rounded.sm}"
    padding: "14px 32px"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.tertiary}"
    rounded: "{rounded.sm}"
    padding: "14px 32px"
  card:
    backgroundColor: "#2A2A2A"
    borderColor: "{colors.secondary}"
    rounded: "{rounded.md}"
    padding: "28px"
  input:
    backgroundColor: "#1F1F1F"
    borderColor: "{colors.secondary}"
    textColor: "{colors.neutral-light}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
---

## Overview

Fairytales with Spice is a sophisticated platform for mature audiences exploring sensuality through AI-generated storytelling. The design is elegant, luxurious, and darkly romantic—evoking candlelit chambers, aged wine, and forbidden knowledge. Every visual element whispers rather than shouts. The aesthetic is refined, mysterious, and unapologetically adult.

Target audience: Adults exploring romantic and sensual fiction. The emotional response should be intrigue, sophistication, and a sense of exclusivity.

## Colors

The palette combines deep, rich tones with gold accents for a jeweled, romantic aesthetic.

- **Primary (#8B0000):** Deep burgundy red—rich, passionate, unmistakably sensual. Used for primary actions and major UI elements.
- **Secondary (#D4AF37):** Warm gold that adds elegance and draws the eye. Accents secondary actions and decorative elements.
- **Tertiary (#2C1810):** Deep chocolate brown for supportive text and backgrounds that feel intimate without being harsh.
- **Accent Deep Rose (#C41E3A):** Bright crimson for moments of intensity and critical actions; creates drama and tension.
- **Accent Gold (#F4D03F):** Bright gold for highlights, micro-interactions, and elements that should pop against dark backgrounds.
- **Neutral Dark (#0F0F0F):** Near-black for primary text on light backgrounds.
- **Neutral Light (#E8E8E8):** Off-white/cream for readable text on dark backgrounds.
- **Background Dark (#1A1A1A):** Very dark charcoal for the main canvas, creating a sense of intimacy and depth.

## Typography

Typography is serif-forward and sophisticated. Georgia headlines provide classical elegance; Lora body text offers warmth and readability. All text is high-contrast for accessibility while maintaining sophistication.

- **Headlines:** Georgia serif at bold weights for authoritative, literary presence.
- **Body:** Lora serif for long-form story content—relaxed line height and generous sizing enhance reading flow.
- **UI Labels:** System sans-serif for clarity and modernity in functional spaces. Keep letter spacing at 0 for consistent rendering.

## Layout

Single-column layout on mobile; two-column card layouts on desktop with a max-width of 1200px. Generous gutters (24px) and padding (28px in cards) reinforce the luxurious, unhurried feel. Whitespace is intentional; content breathes.

## Elevation & Depth

Depth achieved through layered transparencies and subtle borders rather than heavy shadows. Cards sit on dark backgrounds with thin gold borders (#D4AF37) that create visual separation without feeling harsh. Soft shadows (if used) are heavily blurred and darkened.

## Shapes

Minimal rounding (2px on buttons, 4px on cards) reflects a more structured, classical aesthetic. Sharp edges convey control and precision; slight softening prevents coldness.

## Components

### Buttons
- **Primary Button**: Deep burgundy background, cream text, minimal 2px rounding, 14px 32px padding. Used for critical actions ("Generate Story," "Continue").
- **Secondary Button**: Gold background with brown text, same dimensions.
- **Tertiary Button**: Outline only—thin gold border, no fill.

### Cards
- Dark charcoal background (#2A2A2A), 28px padding, thin gold border (1px), 4px rounded corners.
- Used for story cards, chapter containers, and export options.

### Inputs
- Very dark background (#1F1F1F), thin gold border (1px), 4px rounding, 12px 16px padding.
- Placeholder text in muted taupe; focus state brightens the border to bright gold.

### Story Content Blocks
- Nested within cards with slightly lighter background (#3A3A3A) and thin internal borders.
- Creates reading sanctuary feel.

## Do's and Don'ts

- **Do** use gold accents to create moments of visual poetry and guide the eye to interactive elements.
- **Don't** use bright colors outside of burgundy, rose, and gold—the palette is intentionally limited.
- **Do** maintain high contrast between text and background for accessibility (4.5:1 minimum).
- **Don't** use heavy shadows or glowing effects; elegance lies in restraint.
- **Do** embrace whitespace and breathing room—sophistication includes silence.
- **Don't** add playful or childish elements; the brand is mature and intentional.
- **Do** use serif fonts for all long-form content; sans-serif reserved for labels and UI only.
