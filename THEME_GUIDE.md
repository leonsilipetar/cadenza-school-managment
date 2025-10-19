# 🎨 Cadenza Theme Guide

## Color System

Cadenza uses a modern, flexible color system that separates **app-level colors** from **school-specific branding**.

### Primary App Colors

By default, Cadenza uses a **modern teal** color scheme:
- Primary: `rgb(20, 184, 166)` - Teal
- Accent: `rgb(6, 182, 212)` - Cyan

### Alternative Color Schemes

You can easily switch to different color schemes by uncommenting options in `client/src/App.css`:

#### 🔵 Modern Blue (Notion-like)
```css
--isticanje: 59, 130, 246;
--isticanje3: 37, 99, 235;
```

#### 💜 Purple (Discord-like)
```css
--isticanje: 139, 92, 246;
--isticanje3: 124, 58, 237;
```

#### 🟢 Green (Spotify-like)
```css
--isticanje: 16, 185, 129;
--isticanje3: 5, 150, 105;
```

---

## School-Specific Colors

Each school can have its own brand colors without affecting the core app theme.

### CSS Variables

- `--school-primary` - Main school brand color
- `--school-secondary` - Secondary school color

### Usage in Code

```javascript
import { applySchoolTheme } from './utils/schoolTheme';

// Apply school theme
const schoolData = {
  customColors: {
    primary: "255, 100, 50",  // RGB format
    secondary: "100, 150, 200"
  }
};

applySchoolTheme(schoolData);
```

### Using School Colors in Components

```css
/* Use school colors for school-specific elements */
.school-badge {
  background-color: rgb(var(--school-primary));
}

/* Use app colors for general UI */
.primary-button {
  background-color: rgb(var(--isticanje));
}
```

---

## Semantic Colors

Consistent across all themes:

| Color | Variable | RGB | Usage |
|-------|----------|-----|-------|
| 🟢 Success | `--zelena` | `34, 197, 94` | Success messages, confirmations |
| 🔴 Error | `--crvena` | `239, 68, 68` | Errors, deletions, warnings |
| 🟡 Warning | `--zuta` | `250, 204, 21` | Warnings, cautions |
| 🟣 Info | `--ljubicasta` | `139, 92, 246` | Information, tips |
| ⚪ Neutral | `--siva` | `107, 114, 128` | Disabled, secondary text |

---

## Dark Mode

All colors automatically adapt to dark mode using the theme system:

```javascript
// Toggle dark mode
document.body.classList.toggle('dark');
```

---

## Database Schema for Custom Colors

To store school colors in the database, add to `School` model:

```javascript
customColors: {
  type: DataTypes.JSONB,
  allowNull: true,
  defaultValue: null,
  comment: 'Custom brand colors for the school'
}
```

Example data:
```json
{
  "primary": "255, 100, 50",
  "secondary": "100, 150, 200"
}
```

---

## Best Practices

1. ✅ **Use `--isticanje` for primary app actions** (buttons, links, highlights)
2. ✅ **Use `--school-primary` for school-specific branding** (logos, badges, school names)
3. ✅ **Use semantic colors** (`--zelena`, `--crvena`) for status/feedback
4. ✅ **Test both light and dark modes** when changing colors
5. ✅ **Ensure sufficient contrast** for accessibility (WCAG AA minimum)

---

## Migration from Old System

Old color references should be updated:

| Old | New | Notes |
|-----|-----|-------|
| `--isticanje: 255, 155, 0` | `--isticanje: 20, 184, 166` | Changed to modern teal |
| School-specific orange | `--school-primary` | Now separate from app colors |
| N/A | `--school-secondary` | New variable for school accents |

---

## Testing Colors

1. Start dev server: `npm run dev`
2. Open browser DevTools → Console
3. Test color changes:

```javascript
// Test different colors
document.documentElement.style.setProperty('--isticanje', '139, 92, 246');

// Reset
document.documentElement.style.removeProperty('--isticanje');
```

---

## Contributing

When adding new features that use colors:
- Use existing CSS variables, don't hardcode colors
- Document which variable should be used
- Test in both light and dark modes

