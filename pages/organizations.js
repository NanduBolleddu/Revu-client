import { useEffect, useState } from "react";
import API from "../lib/api";

export default function OrganizationsPage({ keycloak }) {
  const [organizations, setOrganizations] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [orgMembers, setOrgMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Get current user ID
  useEffect(() => {
    const fetchCurrentUserId = async () => {
      if (!keycloak?.authenticated) {
        setLoading(false);
        return;
      }

      try {
        const keycloakId = keycloak.tokenParsed?.sub;
        const userResponse = await API.get(`/users?keycloak_id=${keycloakId}`);

        if (userResponse.data.length === 0) {
          setError("User not found");
          setLoading(false);
          return;
        }

        setCurrentUserId(userResponse.data[0].id);
      } catch (err) {
        console.error("Error fetching current user ID:", err);
        setError("Failed to fetch user information");
        setLoading(false);
      }
    };

    fetchCurrentUserId();
  }, [keycloak]);

  // Fetch organizations once we have user ID
  useEffect(() => {
    const fetchOrganizations = async () => {
      if (!currentUserId) return;

      try {
        const response = await API.get(`/organizations/user/${currentUserId}`);
        setOrganizations(response.data);
      } catch (err) {
        console.error("Error fetching organizations:", err);
        setError("Failed to fetch organizations");
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizations();
  }, [currentUserId]);

  // Fetch organization members for modal
  const fetchOrgMembers = async (orgId) => {
    setLoadingMembers(true);
    try {
      const response = await API.get(`/organizations/${orgId}/members`);
      setOrgMembers(response.data);
    } catch (err) {
      console.error("Error fetching organization members:", err);
      setOrgMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  // Handle view details click
  const handleViewDetails = async (org) => {
    setSelectedOrg(org);
    setShowModal(true);
    await fetchOrgMembers(org.id);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedOrg(null);
    setOrgMembers([]);
  };

  // Format date helper
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case "owner":
        return "bg-purple-600";
      case "reviewer":
        return "bg-blue-600";
      case "viewer":
        return "bg-green-600";
      default:
        return "bg-gray-600";
    }
  };

  if (!keycloak?.authenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-gray-400">
            Please log in to view your organizations.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your organizations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-white mb-2">Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950/80 backdrop-blur-xl text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-wide text-white mb-2">
            My Organizations
          </h1>
          <p className="text-white/60 text-sm font-semibold">
            Organizations you own or are a member of
          </p>
        </div>

        {/* Organizations List */}
        {organizations.length === 0 ? (
          <div className="text-center py-16">
            <h3 className="text-xl font-semibold mb-2 text-white">
              No Organizations Found
            </h3>
            <p className="text-white/60 text-sm">
              You're not part of any organizations yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="bg-white/[0.02] backdrop-blur-3xl rounded-2xl p-6 border border-white/10 hover:border-white/30 transition-all shadow-2xl hover:shadow-xl group"
              >
                {/* Organization Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white truncate">
                      {org.name}
                    </h3>
                    <p className="text-sm text-white/60">
                      Created {formatDate(org.created_at)}
                    </p>
                  </div>
                  <span
                    className={`
                      relative inline-block px-4 py-2 text-xs font-bold tracking-wide text-white
                      bg-gradient-to-r shadow-md
                      before:content-[''] before:absolute before:left-0 before:top-full before:border-t-8 before:border-l-8 before:border-l-transparent
                      ${getRoleBadgeColor(org.role)}`}>
                    {org.role.toUpperCase()}
                  </span>
                </div>

                {/* Organization Stats */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center text-sm text-white/80">
                    <span className="w-20 text-white/60 font-medium">
                      Owner:
                    </span>
                    <span className="font-medium truncate">
                      {org.owner_username}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-white/80">
                    <span className="w-20 text-white/60 font-medium">
                      Members:
                    </span>
                    <span className="font-medium">{org.member_count}</span>
                  </div>
                  {org.joined_at && (
                    <div className="flex items-center text-sm text-white/80">
                      <span className="w-20 text-white/60 font-medium">
                        Joined:
                      </span>
                      <span className="font-medium">
                        {formatDate(org.joined_at)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={() => handleViewDetails(org)}
                  className="relative w-full px-5 py-2 rounded-xl text-sm font-semibold text-white 
            bg-gray-900 to-purple-500/80 
             hover:bg-white/10
             focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 
             transition-all duration-300 ease-out shadow-md hover:shadow-lg active:scale-95"
                >
                  <span className="relative inline-block">
                    View Details
                    <span className="bg-white transition-all duration-300 ease-out transform -translate-x-1/2 group-hover:w-full"></span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Organization Details Modal */}
      {showModal && selectedOrg && (
        <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-xl flex items-center justify-center p-4 z-50">
          <div className="bg-white/[0.02] backdrop-blur-3xl rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  {selectedOrg.name}
                </h2>
                <p className="text-white/60 text-sm mt-1">
                  Organization Details
                </p>
              </div>
              <button
                onClick={closeModal}
                className="w-10 h-10 bg-white/5 hover:bg-white/10 backdrop-blur-3xl rounded-xl flex items-center justify-center text-white transition-all border border-white/10 hover:border-white/20 shadow-2xl"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {/* Organization Info */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
                    Organization Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-white/60 text-sm">Name:</span>
                      <p className="font-medium text-white">
                        {selectedOrg.name}
                      </p>
                    </div>
                    <div>
                      <span className="text-white/60 text-sm">Owner:</span>
                      <p className="font-medium text-white">
                        {selectedOrg.owner_username}
                      </p>
                    </div>
                    <div>
                      <span className="text-white/60 text-sm">Created:</span>
                      <p className="font-medium text-white">
                        {formatDate(selectedOrg.created_at)}
                      </p>
                    </div>
                    <div>
                      <span className="text-white/60 text-sm">
                        Total Members:
                      </span>
                      <p className="font-medium text-white">
                        {selectedOrg.member_count}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
                    Your Access
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-white/60 text-sm">Your Role:</span>
                      <div className="mt-1">
                        
                        <span
                    className={`
                      relative inline-block px-4 py-2 text-xs font-bold tracking-wide text-white
                      bg-gradient-to-r shadow-md
                      before:content-[''] before:absolute before:left-0 before:top-full before:border-t-8 before:border-l-8 before:border-l-transparent
                      ${getRoleBadgeColor(selectedOrg.role)}`}>
                    {selectedOrg.role.toUpperCase()}
                  </span>
                      </div>
                    </div>
                    {selectedOrg.joined_at && (
                      <div>
                        <span className="text-white/60 text-sm">Joined:</span>
                        <p className="font-medium text-white">
                          {formatDate(selectedOrg.joined_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Members List */}
              <div>
                <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2 mb-4">
                  Members
                </h3>
                {loadingMembers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-white/60 text-sm">Loading members...</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {orgMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-white/[0.03] backdrop-blur-3xl rounded-xl border border-white/10 hover:bg-white/[0.05] transition-all"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-white text-sm font-semibold">
                              {member.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-white">
                              {member.username}
                            </p>
                            <p className="text-sm text-white/60">
                              {member.email}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${getRoleBadgeColor(member.role)}`}
                          >
                            {member.role.toUpperCase()}
                          </span>
                          <p className="text-xs text-white/60 mt-1">
                            Joined {formatDate(member.joined_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end space-x-3 p-6 border-t border-white/10">
              <button
                onClick={closeModal}
                className="relative px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-bold transition-all group hover:bg-white/[0.05]"
              >
                <span className="relative inline-block">
                  Close
                  <span className=" bg-white/[0.02] transition-all duration-300 ease-out transform -translate-x-1/2 group-hover:w-full"></span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
