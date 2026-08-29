export enum SnackBarVariant {
  SUCCESS = "success",
  ERROR = "error",
}

export type SnackBarPayload = {
  message: string;
  variant: SnackBarVariant;
};

export type SnackBarItem = SnackBarPayload & { id: number };

export function SnackbarStack({
  items,
  onDismiss,
}: {
  items: SnackBarItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="snackbar-stack" aria-live="polite" aria-relevant="additions">
      {items.map((item) => (
        <div
          key={item.id}
          className={`snackbar snackbar-${item.variant}`}
          role={item.variant === SnackBarVariant.ERROR ? "alert" : "status"}
        >
          <span>{item.message}</span>
          <button type="button" className="snackbar-dismiss" onClick={() => onDismiss(item.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
