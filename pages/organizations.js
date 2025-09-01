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

  // Invite modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviteMessage, setInviteMessage] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);

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

  // Fetch organizations
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

  // Fetch organization members
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

  // Fetch available users for invitation
  const fetchAvailableUsers = async (orgId) => {
    try {
      const usersResponse = await API.get("/users");
      const allUsers = usersResponse.data;

      const membersResponse = await API.get(`/organizations/${orgId}/members`);
      const memberIds = membersResponse.data.map((member) => member.id);

      const availableUsers = allUsers.filter(
        (user) => !memberIds.includes(user.id)
      );
      setAvailableUsers(availableUsers);
    } catch (err) {
      console.error("Error fetching available users:", err);
      setAvailableUsers([]);
    }
  };

  // Handle invite user
  const handleInviteUser = async (userId) => {
    setSendingInvite(true);
    try {
      const inviterKeycloakId = keycloak.tokenParsed?.sub;

      if (!inviterKeycloakId) {
        alert("Authentication error. Please refresh and try again.");
        return;
      }

      const inviteeUser = availableUsers.find((user) => user.id === userId);
      if (!inviteeUser || !inviteeUser.keycloak_id) {
        alert(
          "Could not find invited user details. Please refresh and try again."
        );
        return;
      }

      await API.post("/org-invites/send", {
        invited_user_keycloak_id: inviteeUser.keycloak_id,
        invited_by_keycloak_id: inviterKeycloakId,
        message:
          inviteMessage.trim() ||
          `You've been invited to join ${selectedOrg.name}!`,
        role: inviteRole,
      });

      alert("Invitation sent successfully!");
      setShowInviteModal(false);
      setInviteMessage("");

      await fetchAvailableUsers(selectedOrg.id);
    } catch (err) {
      console.error("Invite error:", err);
      alert(
        "Failed to send invitation: " +
          (err.response?.data?.error || err.message)
      );
    } finally {
      setSendingInvite(false);
    }
  };

  // Handle view details
  const handleViewDetails = async (org) => {
    setSelectedOrg(org);
    setShowModal(true);
    await fetchOrgMembers(org.id);
  };

  // Handle invite members
  const handleInviteMembers = async (org) => {
    setSelectedOrg(org);
    setShowInviteModal(true);
    await fetchAvailableUsers(org.id);
  };

  // Close modals
  const closeModal = () => {
    setShowModal(false);
    setSelectedOrg(null);
    setOrgMembers([]);
  };

  const closeInviteModal = () => {
    setShowInviteModal(false);
    setSelectedOrg(null);
    setAvailableUsers([]);
    setInviteMessage("");
    setInviteRole("editor");
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
        return "bg-purple-600 text-white";
      case "editor":
        return "bg-blue-600 text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  if (!keycloak?.authenticated) {
    return (
      <>
        <style jsx>{`
          @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap');
          @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
          
          .material-icons {
            font-family: 'Material Icons';
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
            -webkit-font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
          }
          
          .google-font {
            font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          .material-shadow {
            box-shadow: 0 2px 4px 0 rgba(60, 64, 67, 0.3), 0 1px 6px 0 rgba(60, 64, 67, 0.15);
          }
          
          .material-shadow-hover:hover {
            box-shadow: 0 4px 8px 0 rgba(60, 64, 67, 0.3), 0 2px 12px 0 rgba(60, 64, 67, 0.15);
          }
          
          .ripple-effect {
            position: relative;
            overflow: hidden;
          }
          
          .ripple-effect::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(66, 133, 244, 0.3);
            transition: width 0.6s, height 0.6s, top 0.6s, left 0.6s;
            transform: translate(-50%, -50%);
          }
          
          .ripple-effect:active::before {
            width: 300px;
            height: 300px;
          }
        `}</style>

        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 material-shadow">
              <span className="material-icons text-blue-600 text-2xl">business</span>
            </div>
            <h1 className="text-2xl font-medium text-gray-900 google-font mb-4">Organizations</h1>
            <p className="text-sm text-gray-600 google-font mb-6">Please log in to view your organizations.</p>
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
          @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap');
          @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
          
          .material-icons {
            font-family: 'Material Icons';
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
            -webkit-font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
          }
          
          .google-font {
            font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          .material-shadow {
            box-shadow: 0 2px 4px 0 rgba(60, 64, 67, 0.3), 0 1px 6px 0 rgba(60, 64, 67, 0.15);
          }
        `}</style>

        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4 animate-spin"></div>
            <p className="text-gray-600 google-font font-medium">Loading your organizations...</p>
          </div>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <style jsx>{`
          @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap');
          @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
          
          .material-icons {
            font-family: 'Material Icons';
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
            -webkit-font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
          }
          
          .google-font {
            font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          }
          
          .material-shadow {
            box-shadow: 0 2px 4px 0 rgba(60, 64, 67, 0.3), 0 1px 6px 0 rgba(60, 64, 67, 0.15);
          }
          
          .material-shadow-hover:hover {
            box-shadow: 0 4px 8px 0 rgba(60, 64, 67, 0.3), 0 2px 12px 0 rgba(60, 64, 67, 0.15);
          }
          
          .ripple-effect {
            position: relative;
            overflow: hidden;
          }
          
          .ripple-effect::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            border-radius: 50%;
            background: rgba(66, 133, 244, 0.3);
            transition: width 0.6s, height 0.6s, top 0.6s, left 0.6s;
            transform: translate(-50%, -50%);
          }
          
          .ripple-effect:active::before {
            width: 300px;
            height: 300px;
          }
        `}</style>

        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 material-shadow">
              <span className="material-icons text-red-500 text-2xl">error</span>
            </div>
            <p className="text-red-600 google-font mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors google-font ripple-effect material-shadow-hover"
            >
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&display=swap');
        @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
        
        .material-icons {
          font-family: 'Material Icons';
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
          -webkit-font-feature-settings: 'liga';
          -webkit-font-smoothing: antialiased;
        }
        
        .google-font {
          font-family: 'Google Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .material-shadow {
          box-shadow: 0 2px 4px 0 rgba(60, 64, 67, 0.3), 0 1px 6px 0 rgba(60, 64, 67, 0.15);
        }
        
        .material-shadow-hover:hover {
          box-shadow: 0 4px 8px 0 rgba(60, 64, 67, 0.3), 0 2px 12px 0 rgba(60, 64, 67, 0.15);
        }
        
        .ripple-effect {
          position: relative;
          overflow: hidden;
        }
        
        .ripple-effect::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-radius: 50%;
          background: rgba(66, 133, 244, 0.3);
          transition: width 0.6s, height 0.6s, top 0.6s, left 0.6s;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        
        .ripple-effect:active::before {
          width: 300px;
          height: 300px;
        }

        .google-blue {
          color: #4285f4;
        }
        .google-green {
          color: #34a853;
        }
        .google-red {
          color: #ea4335;
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-medium text-gray-900 google-font">My Organizations</h1>
            <p className="text-sm text-gray-600 google-font mt-1">Organizations you own or are a member of</p>
          </div>

          {/* Organizations Grid */}
          {organizations.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 material-shadow">
                <span className="material-icons text-gray-400 text-2xl">business</span>
              </div>
              <h3 className="text-xl font-medium text-gray-900 google-font mb-2">No organizations found</h3>
              <p className="text-sm text-gray-600 google-font">You're not part of any organizations yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {organizations.map((org) => (
                <div
                  key={org.id}
                  className="bg-white rounded-lg material-shadow border border-gray-200 hover:border-blue-600 transition-colors"
                >
                  <div className="p-6">
                    {/* Organization Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center material-shadow">
                          <span className="material-icons text-blue-600 text-xl">business</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 text-lg google-font">{org.name}</h3>
                          <span
                            className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(org.role)} google-font`}
                          >
                            {org.role}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Organization Info */}
                    <div className="space-y-2 text-sm text-gray-600 google-font mb-4">
                      <div className="flex items-center gap-2">
                        <span className="material-icons text-xs">person</span>
                        <span>Owner: {org.owner_username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-icons text-xs">group</span>
                        <span>{org.member_count} members</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-icons text-xs">calendar_today</span>
                        <span>Created {formatDate(org.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="material-icons text-xs">access_time</span>
                        <span>Joined {formatDate(org.joined_at)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleViewDetails(org)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors google-font ripple-effect"
                      >
                        View Details
                      </button>
                      {org.role === "owner" && (
                        <button
                          onClick={() => handleInviteMembers(org)}
                          className="flex-1 px-3 py-1 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700 transition-colors google-font ripple-effect"
                        >
                          <span className="material-icons text-sm mr-1 align-middle">person_add</span>
                          Invite
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Organization Details Modal */}
        {showModal && selectedOrg && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg material-shadow w-full max-w-2xl max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-medium text-gray-900 google-font">Organization Details</h3>
                  <button
                    onClick={closeModal}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors ripple-effect"
                  >
                    <span className="material-icons text-gray-500">close</span>
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto">
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 google-font">Name</label>
                      <p className="text-gray-900 google-font">{selectedOrg.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 google-font">Owner</label>
                      <p className="text-gray-900 google-font">{selectedOrg.owner_username}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 google-font">Created</label>
                      <p className="text-gray-900 google-font">{formatDate(selectedOrg.created_at)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 google-font">Members</label>
                      <p className="text-gray-900 google-font">{selectedOrg.member_count}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 google-font">Your Role</label>
                      <span
                        className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(selectedOrg.role)} google-font`}
                      >
                        {selectedOrg.role}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 google-font">Joined</label>
                      <p className="text-gray-900 google-font">{formatDate(selectedOrg.joined_at)}</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-medium text-gray-900 google-font">Members</h4>
                      {selectedOrg.role === "owner" && (
                        <button
                          onClick={() => {
                            closeModal();
                            handleInviteMembers(selectedOrg);
                          }}
                          className="px-5 py-2 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700 transition-colors google-font ripple-effect"
                        >
                          <span className="material-icons text-sm mr-2 align-middle">person_add</span>
                          Invite
                        </button>
                      )}
                    </div>

                    {loadingMembers ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4 animate-spin"></div>
                        <p className="text-gray-600 google-font">Loading members...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {orgMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg material-shadow"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center material-shadow">
                                <span className="text-blue-600 font-medium text-sm google-font">
                                  {member.username?.charAt(0)?.toUpperCase() || "U"}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 google-font">{member.username}</p>
                                <p className="text-sm text-gray-600 google-font">{member.email}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span
                                className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(member.role)} google-font`}
                              >
                                {member.role}
                              </span>
                              <p className="text-xs text-gray-600 google-font mt-1">
                                Joined {formatDate(member.joined_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invite Members Modal */}
        {showInviteModal && selectedOrg && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg material-shadow w-full max-w-md max-h-[80vh] overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-medium text-gray-900 google-font">Invite Members</h3>
                  <button
                    onClick={closeInviteModal}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors ripple-effect"
                  >
                    <span className="material-icons text-gray-500">close</span>
                  </button>
                </div>
                <p className="text-sm text-gray-600 google-font mt-2">
                  Invite users to join <strong>{selectedOrg.name}</strong>
                </p>
              </div>

              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2 google-font">
                    Role for invited members
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent google-font text-gray-900"
                  >
                    <option value="editor">Editor - Can view and edit documents</option>
                  </select>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2 google-font">
                    Invitation Message (Optional)
                  </label>
                  <textarea
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Add a personal message to your invitation..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent google-font text-gray-900 resize-none"
                    rows="3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3 google-font">
                    Available Users
                  </label>

                  {availableUsers.length === 0 ? (
                    <div className="text-center py-8 text-gray-600 google-font">
                      <span className="material-icons text-2xl mb-2 block">group</span>
                      No users available to invite.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {availableUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg material-shadow hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center material-shadow">
                              <span className="text-blue-600 font-medium text-sm google-font">
                                {user.username?.charAt(0)?.toUpperCase() || "U"}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 google-font">{user.username}</p>
                              <p className="text-sm text-gray-600 google-font">{user.email}</p>
                            </div>
                          </div>

                          <button
                            onClick={() => handleInviteUser(user.id)}
                            disabled={sendingInvite}
                            className="px-4 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors google-font ripple-effect disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {sendingInvite ? (
                              <span className="flex items-center">
                                <span className="material-icons animate-spin text-sm mr-2">refresh</span>
                                Sending...
                              </span>
                            ) : (
                              "Invite"
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}