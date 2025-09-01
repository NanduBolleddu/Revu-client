import React, { useEffect, useState } from "react";
import API from "../lib/api";

export default function ShareModal({ documentId, currentUserId, onClose }) {
  const [orgMembers, setOrgMembers] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [sentUsers, setSentUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrganizationMembers = async () => {
      try {
        setLoading(true);
        
        // Get user's organizations
        const userOrgsResponse = await API.get(`/organizations/user/${currentUserId}`);
        
        if (userOrgsResponse.data.length === 0) {
          setOrgMembers([]);
          setLoading(false);
          return;
        }

        // Get members from all organizations the user belongs to
        const allMembers = [];
        const seenUserIds = new Set();

        for (const org of userOrgsResponse.data) {
          const membersResponse = await API.get(`/organizations/${org.id}/members`);
          
          membersResponse.data.forEach(member => {
            if (member.id !== currentUserId && !seenUserIds.has(member.id)) {
              seenUserIds.add(member.id);
              allMembers.push({
                ...member,
                organizationName: org.name,
                organizationId: org.id
              });
            }
          });
        }

        setOrgMembers(allMembers);
      } catch (err) {
        console.error("Failed to fetch organization members:", err);
        setOrgMembers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationMembers();
  }, [currentUserId]);

  const handleShare = async (userId) => {
    if (!userId) {
      alert("User ID is missing!");
      return;
    }

    setLoadingId(userId);
    try {
      await API.post("/document-shared/share", {
        document_id: documentId,
        shared_by: currentUserId,
        shared_with: userId,
        message,
      });
      setSentUsers((prev) => [...prev, userId]);
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoadingId(null);
    }
  };

  const getUserInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

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

      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg material-shadow w-full max-w-md max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="material-icons text-blue-600">share</span>
                </div>
                <div>
                  <h3 className="text-xl font-medium text-gray-900 google-font">Share document</h3>
                  <p className="text-sm text-gray-600 google-font">Choose who can access</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <span className="material-icons text-gray-500">close</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Message Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2 google-font">
                Add a message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Say something about this document..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none google-font text-gray-900"
                rows="3"
              />
            </div>

            {/* Organization Members List */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4 animate-spin"></div>
                  <p className="text-gray-600 google-font">Loading people...</p>
                </div>
              ) : orgMembers.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-icons text-gray-400 text-2xl">group</span>
                  </div>
                  <p className="text-gray-600 google-font font-medium">No one to share with</p>
                  <p className="text-sm text-gray-500 google-font mt-1">
                    Invite members to your organization to start sharing.
                  </p>
                </div>
              ) : (
                orgMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm google-font">
                          {getUserInitials(member.username)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 google-font truncate">{member.username}</p>
                        <p className="text-sm text-gray-600 google-font truncate">{member.email}</p>
                        <p className="text-xs text-blue-600 google-font">{member.organizationName}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleShare(member.id)}
                      disabled={loadingId === member.id || sentUsers.includes(member.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium google-font transition-colors ripple-effect ${
                        sentUsers.includes(member.id)
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : loadingId === member.id
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {loadingId === member.id ? (
                        <span className="flex items-center space-x-2">
                          <span className="material-icons animate-spin text-sm">refresh</span>
                          <span>Sharing</span>
                        </span>
                      ) : sentUsers.includes(member.id) ? (
                        <span className="flex items-center space-x-2">
                          <span className="material-icons text-sm">check</span>
                          <span>Shared</span>
                        </span>
                      ) : (
                        'Share'
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-blue-600 border border-blue-600 rounded-full hover:bg-blue-50 transition-colors google-font font-medium ripple-effect"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}