import { NavLink, Route, Routes } from "react-router-dom";

import { Directory } from "./pages/Directory";
import { EmployeePage } from "./pages/EmployeePage";
import { Insights } from "./pages/Insights";

export function App() {
  return (
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
      <Routes>
        <Route path="/" element={<Directory />} />
        <Route path="/employees/:id" element={<EmployeePage />} />
        <Route path="/insights" element={<Insights />} />
      </Routes>
    </div>
  );
}
