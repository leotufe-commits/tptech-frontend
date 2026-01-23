import { RouterProvider } from "react-router-dom";
import router from "./router";
import LockScreen from "./components/LockScreen";
import { useAuth } from "./context/AuthContext";

function AppInner() {
  const { locked } = useAuth();

  return (
    <>
      {/* App normal */}
      <RouterProvider router={router} />

      {/* 🔒 LockScreen global */}
      {locked && <LockScreen />}
    </>
  );
}

export default function App() {
  return <AppInner />;
}
