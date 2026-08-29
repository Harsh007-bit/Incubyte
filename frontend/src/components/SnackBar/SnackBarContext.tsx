import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { SnackbarStack, type SnackBarItem, type SnackBarPayload } from "./SnackbarWrapper";

type ShowSnackBar = (payload: SnackBarPayload) => void;

const SnackBarContext = createContext<ShowSnackBar | null>(null);

let nextId = 1;

export function SnackBarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SnackBarItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const snackbar = useCallback<ShowSnackBar>(
    ({ message, variant }) => {
      const id = nextId;
      nextId += 1;
      setItems((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => snackbar, [snackbar]);

  return (
    <SnackBarContext.Provider value={value}>
      {children}
      <SnackbarStack items={items} onDismiss={dismiss} />
    </SnackBarContext.Provider>
  );
}

export function useSnackBar(): ShowSnackBar {
  const snackbar = useContext(SnackBarContext);
  if (!snackbar) {
    throw new Error("useSnackBar must be used inside SnackBarProvider");
  }
  return snackbar;
}
