import { NavLink } from "react-router-dom";

import { SnackBarProvider } from "./components/SnackBar/SnackBarContext";
import { AppRoutes } from "./routes";

export function App() {
  return (
    <SnackBarProvider>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            ACME <span>Pay</span>
          </div>
          <nav>
            <NavLink to="/" end>
              Directory
            </NavLink>
            <NavLink to="/insights">Insights</NavLink>
          </nav>
        </header>
        <AppRoutes />
      </div>
    </SnackBarProvider>
  );
}
