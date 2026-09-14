/**
 * Public-page footer. This is the company layer — "Architectorium" signs the
 * footer while "Architektów 3d" is the product name in the header and hero.
 */
export interface FooterProps {
  company?: string;
  links?: { label: string; href?: string }[];
  locale?: string;
  onLocaleChange?: (locale: string) => void;
  /** One quiet line under the company name, e.g. the legal address. */
  /** Second line under the company, e.g. "© 2026". */
  copyright?: string;
  note?: string;
  style?: React.CSSProperties;
}
export declare function Footer(props: FooterProps): JSX.Element;
