import { useEffect, useState } from "react";
import API from "../lib/api";
import DocumentCard from "../components/DocumentCard";
import DocumentEditor from "../components/DocumentEditor";

export default function SharedDocumentsPage({ keycloak }) {
  const [sharedDocuments, setSharedDocuments] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [filterOrg, setFilterOrg] = useState("all");

  // Get unique organizations and roles for filtering
  const organizations = [
    ...new Set(
      sharedDocuments.map((item) => item.organization_name).filter(Boolean)
    ),
  ];

  const roles = [
    ...new Set(
      sharedDocuments.map((item) => item.permission_level).filter(Boolean)
    ),
  ];

  // Get current user ID and info on mount
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!keycloak?.authenticated) {
        setLoading(false);
        return;
      }

      try {
        const keycloakId = keycloak.tokenParsed?.sub;
        const userResponse = await API.get(`/users?keycloak_id=${keycloakId}`);

        if (userResponse.data.length === 0) {
          setLoading(false);
          return;
        }

        const userData = userResponse.data[0];
        setCurrentUserId(userData.id);
        setCurrentUser({
          id: userData.id,
          username: userData.username,
          email: userData.email,
        });
      } catch (err) {
        console.error("Error fetching current user:", err);
      }
    };

    fetchCurrentUser();
  }, [keycloak]);

  // Fetch shared documents once currentUserId is set
  useEffect(() => {
    const fetchSharedDocuments = async () => {
      if (!currentUserId) return;

      setLoading(true);
      try {
        const response = await API.get(`/document-shared/${currentUserId}`);
        setSharedDocuments(response.data);
      } catch (err) {
        console.error("Error fetching shared documents:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSharedDocuments();
  }, [currentUserId]);

  // Filter shared documents based on role and organization
  const filteredDocuments = sharedDocuments.filter((item) => {
    const matchesRole =
      filterRole === "all" || item.permission_level === filterRole;
    const matchesOrg =
      filterOrg === "all" || item.organization_name === filterOrg;
    return matchesRole && matchesOrg;
  });

  // Format time ago helper
  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Get role badge styling
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "editor":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (!keycloak?.authenticated) {
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
            pointer-events: none;
          }

          .ripple-effect:active::before {
            width: 300px;
            height: 300px;
          }
        `}</style>

        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 material-shadow">
              <span className="material-icons text-blue-600 text-2xl">
                share
              </span>
            </div>
            <h1 className="text-2xl font-medium text-gray-900 google-font mb-4">
              Shared Documents
            </h1>
            <p className="text-sm text-gray-600 google-font mb-6">
              Please log in to view documents shared with you.
            </p>
            <button
              onClick={() => keycloak.login()}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 transition-colors google-font ripple-effect material-shadow-hover"
            >
              Login
            </button>
          </div>
        </div>
      </>
    );
  }

  if (loading) {
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

          .material-shadow {
            box-shadow:
              0 2px 4px 0 rgba(60, 64, 67, 0.3),
              0 1px 6px 0 rgba(60, 64, 67, 0.15);
          }
        `}</style>

        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4 animate-spin"></div>
            <p className="text-gray-600 google-font font-medium">
              Loading shared documents...
            </p>
          </div>
        </div>
      </>
    );
  }

  // Document Editor View
  if (selected) {
    return (
      <DocumentEditor
        document={selected}
        currentUser={currentUser}
        onClose={() => setSelected(null)}
        isSharedDocument={true}
        permissionLevel={selected.permission_level}
      />
    );
  }

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
          pointer-events: none;
        }

        .ripple-effect:active::before {
          width: 300px;
          height: 300px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          line-height: 1.4;
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
          border-width: 1px;
          border-style: solid;
          max-width: 150px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .badge:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .badge-icon {
          font-size: 14px;
          margin-right: 4px;
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-medium text-gray-900 google-font">
              Shared Documents
            </h1>
            <p className="text-sm text-gray-600 google-font mt-1">
              Documents shared with you by organization members
            </p>
          </div>

          {/* Filters */}
          {(roles.length > 0 || organizations.length > 0) && (
            <div className="bg-white rounded-lg material-shadow p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-4 items-center">
                {organizations.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 google-font">
                      Organization:
                    </label>
                    <select
                      value={filterOrg}
                      onChange={(e) => setFilterOrg(e.target.value)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent google-font text-gray-900"
                    >
                      <option value="all">All Organizations</option>
                      {organizations.map((org) => (
                        <option key={org} value={org}>
                          {org}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="text-sm text-gray-600 google-font">
                {filteredDocuments.length} shared document
                {filteredDocuments.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}

          {/* Documents Grid */}
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 material-shadow">
                <span className="material-icons text-gray-400 text-2xl">
                  share
                </span>
              </div>
              <h3 className="text-xl font-medium text-gray-900 google-font mb-2">
                {sharedDocuments.length === 0
                  ? "No shared documents"
                  : "No documents match your filters"}
              </h3>
              <p className="text-sm text-gray-600 google-font">
                {sharedDocuments.length === 0
                  ? "You haven't received any shared documents yet."
                  : "Try changing your filters to see more content."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocuments.map((document) => (
                <div key={document.id} className="relative">
                  <DocumentCard
                    item={document}
                    onClick={setSelected}
                    onDelete={() => {}} // Disable delete for shared documents
                    onEdit={() => {}} // Disable edit for shared documents
                    currentUserId={currentUserId}
                    permissionLevel={document.permission_level} // Pass permission level
                  />

                  {/* Shared document overlay info */}
                  <div className="absolute top-2 left-2 z-10">
                    <div className="flex flex-col gap-1.5">
                      <span
                        className={`badge ${getRoleBadgeColor(document.permission_level)} google-font`}
                      >
                        <span className="material-icons badge-icon">
                          person
                        </span>
                        {document.permission_level.charAt(0).toUpperCase() +
                          document.permission_level.slice(1)}
                      </span>
                      <span className="badge bg-gray-100 text-gray-800 border-gray-200 google-font">
                        <span className="material-icons badge-icon">share</span>
                        {document.shared_by_username}
                      </span>
                    </div>
                  </div>

                  {/* Share message if exists */}
                  {document.message && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 material-shadow">
                        <p className="text-xs text-blue-800 italic google-font">
                          "{document.message}"
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
