import { useEffect, useState } from "react";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "../styles/globals.css";
import Navbar from "../components/Navbar";
import keycloak from "../lib/keycloak";

export default function MyApp({ Component, pageProps }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    keycloak
      .init({
        onLoad: "login-required",
        checkLoginIframe: false,
      })
      .then((authenticated) => {
        setIsAuthenticated(authenticated);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Keycloak init failed:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading....</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar keycloak={keycloak} />
      <Component {...pageProps} keycloak={keycloak} />
    </div>
  );
}
