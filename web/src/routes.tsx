/* eslint-disable quotes */
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home/Home";
import SignIn from "./pages/SignIn/SignIn";
import NotFound from "./pages/NotFound/NotFound";
import OAuth from "./pages/OAuth/OAuth";
import { AuthProvider } from "./auth/auth";
import "./main.css";
import Profile from "./pages/Profile/Profile";
import Game from "./pages/Game/Game";
import Historic from "./pages/Historic/Historic";
import { ValidateTfa } from "./components/ValidateTfa/ValidateTfa";
import axios from "axios";
import { useState } from "react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RequireAuth({ children }: any) {
  const token = window.localStorage.getItem("token");
  const [isTfaValid, setIsTfaValid] = useState(false);
  /**
   * It checks if the user has TFA enabled, if not, it sets the isTfaValid state to true. If the user has
   * TFA enabled, it checks if the user has validated TFA, if not, it sets the isTfaValid state to false.
   * If the user has TFA enabled and has validated TFA, it sets the isTfaValid state to true
   * @returns a boolean value.
   */
  async function validateTFA() {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };
    const api = axios.create({
      baseURL: `http://${import.meta.env.VITE_API_HOST}:3000`,
    });

    const user = await api.get("/user/me", config);
    if (
      user.data.isTFAEnable !== undefined &&
      user.data.isTFAEnable === false
    ) {
      setIsTfaValid(true);
      return;
    }
    if (user.data.isTFAEnable && user.data.tfaValidated !== true) {
      setIsTfaValid(false);
      return;
    }
    setIsTfaValid(true);
  }
  validateTFA();
  if (isTfaValid === false) {
    return (
      <div>
        <ValidateTfa />
      </div>
    );
  }
  return token ? children : <Navigate to="/signin" replace />;
}

export default function AppRouter() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <Home />
              </RequireAuth>
            }
          />

          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />

          <Route
            path="/game"
            element={
              <RequireAuth>
                <Game />
              </RequireAuth>
            }
          />

          <Route
            path="/historic"
            element={
              <RequireAuth>
                <Historic />
              </RequireAuth>
            }
          />
          <Route path="/oauth" element={<OAuth />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
