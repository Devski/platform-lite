/**
 * Profile-photo row: the current photo (or monogram) beside the file picker
 * and its format hint. Mirrors the product's presign → PUT → confirm flow.
 */
export interface PhotoUploadProps {
  src?: string | null;
  name?: string;
  size?: number;
  emptyLabel?: string;
  chooseLabel?: string;
  hint?: string;
  busy?: boolean;
  busyLabel?: string;
  onChoose?: () => void;
  style?: React.CSSProperties;
}
export declare function PhotoUpload(props: PhotoUploadProps): JSX.Element;
