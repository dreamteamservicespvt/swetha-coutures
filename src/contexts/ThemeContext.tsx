
import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';

interface ThemeContextType {
  theme: 'light' | 'dark';
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  animationsEnabled: boolean;
  language: string;
  setTheme: (theme: 'light' | 'dark') => void;
  setAccentColor: (color: string) => void;
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  setCompactMode: (enabled: boolean) => void;
  setAnimationsEnabled: (enabled: boolean) => void;
  setLanguage: (language: string) => void;
  applyTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData } = useAuth();
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  const [accentColor, setAccentColorState] = useState('#7c3aed');
  const [fontSize, setFontSizeState] = useState<'small' | 'medium' | 'large'>('medium');
  const [compactMode, setCompactModeState] = useState(false);
  const [animationsEnabled, setAnimationsEnabledState] = useState(true);
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    if (userData) {
      loadUserPreferences();
    }
  }, [userData]);

  const loadUserPreferences = async () => {
    try {
      const preferencesDoc = await getDoc(doc(db, 'userPreferences', userData!.uid));
      if (preferencesDoc.exists()) {
        const prefs = preferencesDoc.data();
        setThemeState(prefs.theme || 'light');
        setAccentColorState(prefs.accentColor || '#7c3aed');
        setFontSizeState(prefs.fontSize || 'medium');
        setCompactModeState(prefs.compactMode || false);
        setAnimationsEnabledState(prefs.animationsEnabled !== false);
        setLanguageState(prefs.language || 'en');
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const savePreferences = async (newPrefs: any) => {
    if (!userData) return;
    
    try {
      await setDoc(doc(db, 'userPreferences', userData.uid), newPrefs, { merge: true });
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const setTheme = (newTheme: 'light' | 'dark') => {
    setThemeState(newTheme);
    savePreferences({ theme: newTheme });
    applyTheme();
  };

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    savePreferences({ accentColor: color });
    applyTheme();
  };

  const setFontSize = (size: 'small' | 'medium' | 'large') => {
    setFontSizeState(size);
    savePreferences({ fontSize: size });
    applyTheme();
  };

  const setCompactMode = (enabled: boolean) => {
    setCompactModeState(enabled);
    savePreferences({ compactMode: enabled });
    applyTheme();
  };

  const setAnimationsEnabled = (enabled: boolean) => {
    setAnimationsEnabledState(enabled);
    savePreferences({ animationsEnabled: enabled });
    applyTheme();
  };

  const setLanguage = (newLanguage: string) => {
    setLanguageState(newLanguage);
    savePreferences({ language: newLanguage });
  };

  const applyTheme = () => {
    const root = document.documentElement;
    
    // Apply theme
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Apply accent color
    root.style.setProperty('--accent-color', accentColor);

    // Apply font size
    const fontSizes = {
      small: '14px',
      medium: '16px',
      large: '18px'
    };
    root.style.setProperty('--base-font-size', fontSizes[fontSize]);

    // Apply compact mode
    if (compactMode) {
      root.classList.add('compact-mode');
    } else {
      root.classList.remove('compact-mode');
    }

    // Apply animations
    if (!animationsEnabled) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }
  };

  useEffect(() => {
    applyTheme();
  }, [theme, accentColor, fontSize, compactMode, animationsEnabled]);

  const value = {
    theme,
    accentColor,
    fontSize,
    compactMode,
    animationsEnabled,
    language,
    setTheme,
    setAccentColor,
    setFontSize,
    setCompactMode,
    setAnimationsEnabled,
    setLanguage,
    applyTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
