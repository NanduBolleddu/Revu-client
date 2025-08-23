import { useState, useEffect } from 'react';
import Link from "next/link";
import { useRouter } from "next/router";
import API from '../lib/api';

export default function Navbar({ keycloak }) {
  const router = useRouter();
  const [pendingInvites, setPendingInvites] = useState([]);
  const [showInvites, setShowInvites] = useState(false);

  const links = [
    { href: "/media", label: "Media" },
    { href: "/organizations", label: "Organizations" },
    { href: "/shared", label: "Shared" },
    { href: "/message", label: "Chat" },
  ];

  const loadPendingInvites = async () => {
    if (!keycloak?.authenticated) return;
    try {
      const userResponse = await API.get(`/users?keycloak_id=${keycloak.tokenParsed.sub}`);
      if (userResponse.data.length > 0) {
        const userId = userResponse.data[0].id;
        const invitesResponse = await API.get(`/org-invites/pending/${userId}`);
        setPendingInvites(invitesResponse.data);
      }
    } catch (error) {
      console.error('Error loading pending invites:', error);
    }
  };

  useEffect(() => {
    
    loadPendingInvites();
    const handleRefreshInvites = () => loadPendingInvites();
    window.addEventListener('refreshInvites', handleRefreshInvites);
    return () => window.removeEventListener('refreshInvites', handleRefreshInvites);
  }, [keycloak?.authenticated]);

  const handleAcceptInvite = async (inviteId) => {
    try {
      await API.post(`/org-invites/accept/${inviteId}`);
      alert('✅ Organization invite accepted!');
      loadPendingInvites();
    } catch (error) {
      alert('❌ Failed to accept invite: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRejectInvite = async (inviteId) => {
    try {
      await API.post(`/org-invites/reject/${inviteId}`);
      alert('❌ Organization invite rejected!');
      loadPendingInvites();
    } catch (error) {
      alert('❌ Failed to reject invite: ' + (error.response?.data?.error || error.message));
    }
  };
  

  return (
    <nav className="bg-gray-950/80 backdrop-blur-2xl border-b border-white/10 shadow-[0_2px_15px_rgba(0,0,0,0.6)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <div 
            className="flex-shrink-0 cursor-pointer select-none group"
            onClick={() => router.push('/media')}
          >
            <span className="text-2xl font-extrabold text-white group-hover:text-indigo-400 transition-all duration-300">
              Revu
            </span>
          </div>

          {/* Links */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-6">
              {links.map(link => (
                <Link key={link.href} href={link.href}>
                  <div
                    className={`relative px-3 py-2 text-sm font-medium cursor-pointer transition-all duration-300 ${
                      router.pathname === link.href
                        ? "text-white"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    {link.label}
                    <span
                      className={`absolute left-0 bottom-0 h-0.5 rounded-full bg-indigo-400 transition-all duration-300 ${
                        router.pathname === link.href ? "w-full" : "w-0 group-hover:w-full"
                      }`}
                    />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-5">
            {/* Notification Bell */}
            {keycloak?.authenticated && (
              <div className="relative">
                <button
                  onClick={() => setShowInvites(!showInvites)}
                  className="relative p-2 text-white/70 hover:text-white transition-all duration-200 group"
                  aria-label="Organization Invitations"
                >
                  <i className="fas fa-bell text-lg group-hover:scale-110 transition-transform duration-200"></i>
                  {pendingInvites.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold shadow-md">
                      {pendingInvites.length}
                    </span>
                  )}
                </button>

                {/* Dropdown */}
                {showInvites && (
                  <div className="absolute right-0 top-full mt-2 w-96 bg-gray-950 backdrop-blur-2xl rounded-2xl shadow-xl border border-white/10 z-[9999] overflow-hidden transition-all duration-300 animate-in fade-in-0 zoom-in-95">
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-white tracking-wide">
                          Organization Invites
                        </h3>
                        <button
                          onClick={() => setShowInvites(false)}
                          className="text-gray-400 hover:text-white transition-all duration-200 hover:rotate-90"
                        >
                          <i className="fas fa-times text-sm"></i>
                        </button>
                      </div>
                      {pendingInvites.length === 0 ? (
                        <div className="text-center py-10">
                          <i className="fas fa-inbox text-4xl text-gray-600/70 mb-3"></i>
                          <p className="text-gray-400 text-sm">No pending invites</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-80 overflow-y-auto pr-1 custom-scroll">
                          {pendingInvites.map((invite) => (
                            <div
                              key={invite.id}
                              className="bg-gray-800/60 rounded-xl p-4 border border-white/10 hover:border-indigo-400/30 transition-all duration-300"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="text-sm text-gray-300">
                                    <span className="font-medium text-white">
                                      {invite.invited_by_username}
                                    </span>{" "}
                                    invited you to join
                                  </p>
                                  <p className="text-base font-semibold text-indigo-300 mt-1">
                                    {invite.organization_name}
                                  </p>
                                  {invite.message && (
                                    <p className="text-sm text-gray-400 italic mt-2 border-l-2 border-gray-600 pl-3">
                                      {invite.message}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-3">
                                <button
                                  onClick={() => handleAcceptInvite(invite.id)}
                                  className="px-4 py-2 rounded-md text-sm font-medium bg-green-600/80 hover:bg-green-500 text-white transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleRejectInvite(invite.id)}
                                  className="px-4 py-2 rounded-md text-sm font-medium bg-red-600/80 hover:bg-red-500 text-white transition-colors"
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
            )}

            {/* Auth */}
            {keycloak?.authenticated ? (
              <button
                onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 relative overflow-hidden group"
              >
                <span className="relative z-10">Logout</span>
                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
              </button>
            ) : (
              <button
                onClick={() => keycloak.login()}
                className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white text-sm font-semibold shadow-lg transition-all duration-200 relative overflow-hidden group"
              >
                <span className="relative z-10">Login</span>
                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
