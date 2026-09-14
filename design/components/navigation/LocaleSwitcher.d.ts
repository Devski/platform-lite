/**
 * Polish / English switch. Each language names itself in its own language and
 * carries its own lang attribute, as the product's markup does.
 */
export interface LocaleSwitcherProps {
  locales?: string[];
  names?: Record<string, string>;
  current?: string;
  onChange?: (locale: string) => void;
  tone?: "default" | "onPhoto";
  style?: React.CSSProperties;
}
export declare function LocaleSwitcher(props: LocaleSwitcherProps): JSX.Element;
