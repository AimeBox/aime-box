import { FaMoon, FaSun } from 'react-icons/fa';
import { useTheme } from './ThemeProvider';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      className="inline-flex p-2 rounded-md "
    >
      <FaSun
        size={16}
        className="transition-all translate-x-0 opacity-100 dark:translate-x-3 dark:opacity-0"
        style={{ transitionDuration: '500ms' }}
      />
      <FaMoon
        size={16}
        className="absolute transition-all -translate-x-3 opacity-0 dark:translate-x-0 dark:opacity-100"
        style={{ transitionDuration: '500ms' }}
      />
    </button>
  );
}

export default ThemeToggle;
