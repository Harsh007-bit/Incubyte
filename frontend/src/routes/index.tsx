import { Route, Routes } from "react-router-dom";

import { Directory } from "../components/views/Directory/Directory";
import { EmployeePage } from "../components/views/Employee/EmployeePage";
import { Insights } from "../components/views/Insights/Insights";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Directory />} />
      <Route path="/employees/:id" element={<EmployeePage />} />
      <Route path="/insights" element={<Insights />} />
    </Routes>
  );
}
