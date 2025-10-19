/**
 * School Theme Utilities
 * Allows individual schools to customize their brand colors
 */

/**
 * Apply school-specific theme colors
 * @param {Object} schoolData - School data with optional customColors
 * @example
 * schoolData.customColors = {
 *   primary: "255, 100, 50",  // RGB format
 *   secondary: "100, 150, 200"
 * }
 */
export const applySchoolTheme = (schoolData) => {
  if (!schoolData?.customColors) return;

  const root = document.documentElement;
  
  // Apply custom school colors if provided
  if (schoolData.customColors.primary) {
    root.style.setProperty('--school-primary', schoolData.customColors.primary);
  }
  
  if (schoolData.customColors.secondary) {
    root.style.setProperty('--school-secondary', schoolData.customColors.secondary);
  }
};

/**
 * Reset to default app theme
 */
export const resetToDefaultTheme = () => {
  const root = document.documentElement;
  root.style.removeProperty('--school-primary');
  root.style.removeProperty('--school-secondary');
};

/**
 * Get RGB values from hex color
 * @param {string} hex - Hex color (e.g., "#ff6600")
 * @returns {string} RGB format (e.g., "255, 102, 0")
 */
export const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : null;
};

/**
 * Predefined school color presets
 */
export const SCHOOL_PRESETS = {
  orange: {
    name: 'Narančasta',
    primary: '249, 115, 22',
    secondary: '255, 155, 0'
  },
  blue: {
    name: 'Plava',
    primary: '59, 130, 246',
    secondary: '37, 99, 235'
  },
  purple: {
    name: 'Ljubičasta',
    primary: '139, 92, 246',
    secondary: '124, 58, 237'
  },
  green: {
    name: 'Zelena',
    primary: '16, 185, 129',
    secondary: '5, 150, 105'
  },
  red: {
    name: 'Crvena',
    primary: '239, 68, 68',
    secondary: '220, 38, 38'
  },
  teal: {
    name: 'Teal',
    primary: '20, 184, 166',
    secondary: '6, 182, 212'
  }
};

