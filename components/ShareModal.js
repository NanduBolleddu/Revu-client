import React, { useEffect, useState } from "react";
import API from "../lib/api";

export default function ShareModal({ mediaId, currentUserId, onClose }) {
  console.log("currentUserId in ShareModal:", currentUserId);
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingId, setLoadingId] = useState(null);
  const [sentUsers, setSentUsers] = useState([]); // track which users got it

  useEffect(() => {
    API.get("/users")
      .then((res) => {
        const filteredUsers = res.data.filter((u) => u.id !== currentUserId);
        setUsers(filteredUsers);
      })
      .catch((err) => {
        console.error("Failed to fetch users:", err);
      });
  }, [currentUserId]);

  const handleShare = async (shared_with) => {
    if (!shared_with) {
      alert("User ID is missing!");
      return;
    }
    console.log({
      media_id: mediaId,
      shared_by: currentUserId,
      shared_with,
      message,
    });
    setLoadingId(shared_with);
    try {
      await API.post("/media-shared/share", {
        media_id: mediaId,
        shared_by: currentUserId,
        shared_with,
        message,
      });
      setSentUsers((prev) => [...prev, shared_with]);
    } catch (err) {
      alert("Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-md px-4"
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full bg-gray-950/40 border border-white/20 rounded-3xl shadow-2xl p-8 mx-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 6l-4-4-4 4m4-4v12"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-wide mb-1 text-white">
              Share Media
            </h2>
            <p className="text-white/70 text-sm">
              Send media directly to users with an optional message
            </p>
          </div>
        </div>

        {/* User List */}
        <div className="max-h-64 overflow-y-auto border border-white/10 rounded-xl p-4 mb-6 bg-white/5 backdrop-blur-sm scrollbar-hide">
          {users.length === 0 && (
            <p className="text-white/60 text-center">
              No users available to share with.
            </p>
          )}
          <ul className="space-y-3">
            {users.map((user) => {
              const isSent = sentUsers.includes(user.id);
              const isLoading = loadingId === user.id;

              return (
                <li
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-white/10 transition"
                >
                  <div className="flex flex-col">
                    <p className="font-semibold text-white flex items-center gap-2">
                      {user.username}
                    </p>
                    <p className="text-sm text-white/60">{user.email}</p>
                  </div>

                  <button
                    onClick={() => handleShare(user.id)}
                    disabled={isLoading || isSent}
                    className={`px-5 py-2 rounded-xl font-bold shadow-lg transition flex items-center justify-center ${
                      isSent
                        ? "bg-green-600 text-white shadow-green-600/30 cursor-default"
                        : isLoading
                          ? "bg-blue-500/40 cursor-not-allowed text-white"
                          : "bg-blue-700 text-white hover:bg-gradient-to-r hover:from-blue-600 hover:to-blue-800"
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Sending...
                      </span>
                    ) : isSent ? (
                      "Sent ✓"
                    ) : (
                      "Send"
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Message Input */}
        <div className="mb-6">
          <label
            htmlFor="shareMessage"
            className="block text-white/80 font-medium mb-2"
          >
            Message (optional)
          </label>
          <input
            type="text"
            id="shareMessage"
            placeholder="Add a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-bold border border-white/20 hover:border-white/30 transition tracking-wider"
          >
            Close
          </button>
        </div>
      </div>

      {/* Scoped CSS to hide scrollbars */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
