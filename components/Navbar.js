import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import API from "../lib/api";

export default function Navbar({ keycloak }) {
  const router = useRouter();
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showInvites, setShowInvites] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const links = [
    { href: "/documents", label: "Documents", icon: "description" },
    { href: "/organizations", label: "Organizations", icon: "business" },
    { href: "/shared", label: "Shared", icon: "share" },
  ];

  const loadPendingInvites = async () => {
    if (!keycloak?.authenticated) return;
    try {
      const userResponse = await API.get(
        `/users?keycloak_id=${keycloak.tokenParsed.sub}`
      );
      if (userResponse.data.length > 0) {
        const userId = userResponse.data[0].id;
        const invitesResponse = await API.get(`/org-invites/pending/${userId}`);
        setPendingInvites(invitesResponse.data);
      }
    } catch (error) {
      console.error("Error loading pending invites:", error);
    }
  };

  useEffect(() => {
    loadPendingInvites();
    const handleRefreshInvites = () => loadPendingInvites();
    window.addEventListener("refreshInvites", handleRefreshInvites);
    return () =>
      window.removeEventListener("refreshInvites", handleRefreshInvites);
  }, [keycloak?.authenticated]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowInvites(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Handle scroll to hide/show navbar
  useEffect(() => {
    let scrollTimeout = null;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Clear any existing timeout to debounce scroll events
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Set a timeout to process scroll after a brief delay
      scrollTimeout = setTimeout(() => {
        if (currentScrollY > lastScrollY && currentScrollY > 100 && !showInvites && !showUserMenu) {
          // Scrolling down and past 100px, hide only if no dropdown is open
          setIsNavbarVisible(false);
        } else {
          // Scrolling up or near the top, or dropdown is open, show navbar
          setIsNavbarVisible(true);
        }
        setLastScrollY(currentScrollY);
      }, 100); // 100ms debounce to reduce jitter
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      window.removeEventListener("scroll", handleScroll);
    };
  }, [lastScrollY, showInvites, showUserMenu]);

  const handleAcceptInvite = async (inviteId) => {
    try {
      await API.post(`/org-invites/accept/${inviteId}`);
      alert("✅ Organization invite accepted!");
      loadPendingInvites();
    } catch (error) {
      alert(
        "❌ Failed to accept invite: " +
          (error.response?.data?.error || error.message)
      );
    }
  };

  const handleRejectInvite = async (inviteId) => {
    try {
      await API.post(`/org-invites/reject/${inviteId}`);
      alert("❌ Organization invite rejected!");
      loadPendingInvites();
    } catch (error) {
      alert(
        "❌ Failed to reject invite: " +
          (error.response?.data?.error || error.message)
      );
    }
  };

  const getUserInitials = () => {
    const name =
      keycloak?.tokenParsed?.name ||
      keycloak?.tokenParsed?.preferred_username ||
      "User";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserDisplayName = () => {
    return (
      keycloak?.tokenParsed?.name ||
      keycloak?.tokenParsed?.preferred_username ||
      "User"
    );
  };

  return (
    <>
      <style jsx>{`
        @import url("https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap");
        @import url("https://fonts.googleapis.com/icon?family=Material+Icons");

        .material-icons {
          font-family: "Material Icons";
          font-weight: normal;
          font-style: normal;
          font-size: 20px;
          line-height: 1;
          letter-spacing: normal;
          text-transform: none;
          display: inline-block;
          white-space: nowrap;
          word-wrap: normal;
          direction: ltr;
          -webkit-font-feature-settings: "liga";
          -webkit-font-smoothing: antialiased;
        }

        .google-font {
          font-family:
            "Google Sans",
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            sans-serif;
        }

        .ripple-effect {
          position: relative;
          overflow: hidden;
        }

        .ripple-effect::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(66, 133, 244, 0.3);
          transition:
            width 0.6s,
            height 0.6s,
            top 0.6s,
            left 0.6s;
          transform: translate(-50%, -50%);
        }

        .ripple-effect:active::before {
          width: 300px;
          height: 300px;
          top: 50%;
          left: 50%;
        }

        .material-shadow {
          box-shadow:
            0 2px 4px 0 rgba(60, 64, 67, 0.3),
            0 1px 6px 0 rgba(60, 64, 67, 0.15);
        }

        .material-shadow-hover:hover {
          box-shadow:
            0 4px 8px 0 rgba(60, 64, 67, 0.3),
            0 2px 12px 0 rgba(60, 64, 67, 0.15);
        }

        .google-blue {
          color: #4285f4;
        }
        .google-red {
          color: #ea4335;
        }
        .google-yellow {
          color: #fbbc04;
        }
        .google-green {
          color: #34a853;
        }

        .tab-indicator {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: #4285f4;
          border-radius: 1.5px 1.5px 0 0;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .navbar {
          position: relative;
          z-index: 1000;
          transition: transform 0.3s ease-in-out;
        }

        .navbar-hidden {
          transform: translateY(-100%);
        }
      `}</style>

      <nav
        className={`bg-white border-b border-gray-200 sticky top-0 navbar ${
          isNavbarVisible ? "" : "navbar-hidden"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo - Google Style */}
            <div
              onClick={() => router.push("/documents")}
              className="flex items-center space-x-3 cursor-pointer group"
            >
              <div className="flex items-center space-x-1">
                <span className="text-2xl font-bold google-font">
                  <span className="text-blue-500">Live</span>
                  <span className="text-red-500">D</span>
                  <span className="text-yellow-500">r</span>
                  <span className="text-blue-500">a</span>
                  <span className="text-green-500">f</span>
                  <span className="text-red-500">t</span>
                </span>
              </div>
            </div>

            {/* Navigation Links - Material Design Tabs */}
            <div className="hidden md:flex items-center relative">
              {links.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center space-x-2 px-6 py-4 text-sm font-medium google-font transition-colors duration-200 ${
                    router.pathname === link.href
                      ? "text-blue-600"
                      : "text-gray-700 hover:text-gray-900"
                  }`}
                >
                  <span className="material-icons text-lg">{link.icon}</span>
                  <span>{link.label}</span>
                  {router.pathname === link.href && (
                    <div className="tab-indicator w-full"></div>
                  )}
                </Link>
              ))}
            </div>

            {/* Right Side */}
            <div className="flex items-center space-x-2">
              {keycloak?.authenticated ? (
                <>
                  {/* Notifications - Material Design */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={() => {
                        setShowInvites(!showInvites);
                        setShowUserMenu(false);
                      }}
                      className="p-3 rounded-full hover:bg-gray-100 transition-colors duration-200 ripple-effect relative"
                      aria-label="Organization Invitations"
                    >
                      <span className="material-icons text-gray-600">
                        notifications
                      </span>
                      {pendingInvites.length > 0 && (
                        <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium google-font">
                          {pendingInvites.length > 9
                            ? "9+"
                            : pendingInvites.length}
                        </span>
                      )}
                    </button>

                    {/* Notifications Dropdown - Material Card */}
                    {showInvites && (
                      <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg material-shadow-hover z-100 overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-900 google-font">
                              Organization invites
                            </h3>
                            <button
                              onClick={() => setShowInvites(false)}
                              className="p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
                            >
                              <span className="material-icons text-gray-500 text-lg">
                                close
                              </span>
                            </button>
                          </div>
                        </div>

                        <div className="max-h-80 overflow-y-auto">
                          {pendingInvites.length === 0 ? (
                            <div className="p-8 text-center">
                              <span className="material-icons text-gray-300 text-5xl mb-4">
                                inbox
                              </span>
                              <p className="text-gray-600 font-medium google-font">
                                No pending invites
                              </p>
                              <p className="text-gray-500 text-sm google-font mt-1">
                                You're all set!
                              </p>
                            </div>
                          ) : (
                            <div className="p-2">
                              {pendingInvites.map((invite) => (
                                <div
                                  key={invite.id}
                                  className="p-4 hover:bg-gray-50 rounded-lg mx-2 my-1 transition-colors duration-200"
                                >
                                  <div className="flex items-start space-x-3 mb-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                      <span className="material-icons text-blue-600 text-lg">
                                        business
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-gray-900 google-font leading-5">
                                        <span className="font-medium text-blue-600">
                                          {invite.invited_by_username}
                                        </span>{" "}
                                        invited you to join{" "}
                                        <span className="font-medium">
                                          {invite.organization_name}
                                        </span>
                                      </p>
                                      {invite.message && (
                                        <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2 google-font">
                                          "{invite.message}"
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex gap-2 ml-13">
                                    <button
                                      onClick={() =>
                                        handleAcceptInvite(invite.id)
                                      }
                                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium google-font transition-colors duration-200 ripple-effect"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      onClick={() =>
                                        handleRejectInvite(invite.id)
                                      }
                                      className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded text-sm font-medium google-font transition-colors duration-200 ripple-effect"
                                    >
                                      Decline
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* User Menu - Google Style Avatar */}
                  <div className="relative dropdown-container">
                    <button
                      onClick={() => {
                        setShowUserMenu(!showUserMenu);
                        setShowInvites(false);
                      }}
                      className="ml-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center hover:shadow-md transition-all duration-200"
                      title={getUserDisplayName()}
                    >
                      <span className="text-white text-sm font-medium google-font">
                        {getUserInitials()}
                      </span>
                    </button>

                    {/* User Dropdown - Redesigned */}
                    {showUserMenu && (
                      <div className="absolute right-0 mt-3 w-72 bg-white rounded-lg material-shadow-hover z-100 overflow-hidden">
                        {/* User Info Header */}
                        <div className="p-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-lg font-medium google-font">
                                {getUserInitials()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-medium text-gray-900 google-font truncate">
                                {getUserDisplayName()}
                              </h3>
                              <p className="text-sm text-gray-600 google-font truncate">
                                {keycloak?.tokenParsed?.email}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-gray-200"></div>

                        {/* Menu Items */}
                        <div className="py-2">
                          <button
                            onClick={() => {
                              setShowUserMenu(false);
                              keycloak.logout({
                                redirectUri: window.location.origin,
                              });
                            }}
                            className="w-full flex items-center space-x-4 px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors duration-200 google-font"
                          >
                            <span className="material-icons text-gray-500 text-lg">
                              logout
                            </span>
                            <span className="text-sm font-medium">
                              Sign out
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => keycloak.login()}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium google-font transition-colors duration-200 ripple-effect"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}