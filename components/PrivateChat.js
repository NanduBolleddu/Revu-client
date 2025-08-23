import { useState, useEffect, useRef } from "react";
import { socket } from "../lib/socket";
import API from "../lib/api";

export default function PrivateChat({ keycloak }) {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [showUserList, setShowUserList] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const currentUser = keycloak?.tokenParsed;

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket connection and event handlers
  useEffect(() => {
    if (!keycloak?.authenticated || !currentUser) return;

    const handleOrgInvite = (inviteData) => {
      console.log("🏢 New organization invite received:", inviteData);
      loadChats();
      window.dispatchEvent(new CustomEvent("refreshInvites"));
    };

    socket.on("org-invite", handleOrgInvite);

    const connectToPrivateChat = () => {
      socket.connect();
      setIsConnected(true);

      socket.emit("join_private_chat", {
        userId: currentUser.sub,
        username: currentUser.preferred_username || "Unknown",
        avatar: currentUser.picture || null,
      });
    };

    const handleJoinSuccess = () => {
      loadChats();
      loadUsers();
      setLoading(false);
    };

    const handleNewPrivateMessage = (message) => {
      setMessages((prev) => [...prev, message]);
      loadChats();
    };

    const handleChatListUpdate = (updatedChats) => {
      setChats(updatedChats);
    };

    const handleUserStatusUpdate = (statusData) => {
      setChats((prev) =>
        prev.map((chat) => ({
          ...chat,
          otherParticipant:
            chat.otherParticipant.userId === statusData.userId
              ? {
                  ...chat.otherParticipant,
                  isOnline: statusData.isOnline,
                  lastSeen: statusData.lastSeen,
                }
              : chat.otherParticipant,
        }))
      );

      setUsers((prev) =>
        prev.map((user) =>
          user.userId === statusData.userId
            ? {
                ...user,
                isOnline: statusData.isOnline,
                lastSeen: statusData.lastSeen,
              }
            : user
        )
      );
    };

    const handleUserTyping = ({ senderId, senderUsername, isTyping }) => {
      setTypingUsers((prev) => {
        const newSet = new Set(prev);
        if (isTyping) {
          newSet.add(senderUsername);
        } else {
          newSet.delete(senderUsername);
        }
        return newSet;
      });
    };

    socket.on("join_success", handleJoinSuccess);
    socket.on("new_private_message", handleNewPrivateMessage);
    socket.on("chat_list_update", handleChatListUpdate);
    socket.on("user_status_update", handleUserStatusUpdate);
    socket.on("user_typing", handleUserTyping);

    connectToPrivateChat();

    return () => {
      socket.off("join_success", handleJoinSuccess);
      socket.off("new_private_message", handleNewPrivateMessage);
      socket.off("chat_list_update", handleChatListUpdate);
      socket.off("user_status_update", handleUserStatusUpdate);
      socket.off("user_typing", handleUserTyping);
      socket.off("org-invite", handleOrgInvite);
      socket.disconnect();
      setIsConnected(false);
    };
  }, [keycloak?.authenticated, currentUser]);

  // Load chats
  const loadChats = async () => {
    try {
      const response = await API.get(`/private-chat/chats/${currentUser.sub}`);
      setChats(response.data);
    } catch (error) {
      console.error("Error loading chats:", error);
    }
  };

  // Load users for new chat
  const loadUsers = async () => {
    try {
      const response = await API.get(`/private-chat/users/${currentUser.sub}`);
      setUsers(response.data);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  // Load messages for selected chat
  const loadMessages = async (chatId) => {
    try {
      const response = await API.get(`/private-chat/messages/${chatId}`);
      setMessages(response.data.messages);
      socket.emit("mark_messages_read", {
        chatId,
        userId: currentUser.sub,
      });
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  // Handle chat selection
  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
    loadMessages(chat._id);
    setShowUserList(false);
    setShowRoleSelector(false);
  };

  // Handle sending messages
  const handleSendMessage = (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedChat || !isConnected) return;

    const receiverId = selectedChat.otherParticipant.userId;

    socket.emit("send_private_message", {
      senderId: currentUser.sub,
      senderUsername: currentUser.preferred_username || "Unknown",
      receiverId,
      message: newMessage,
      avatar: currentUser.picture || null,
    });

    setNewMessage("");
    handleTypingStop();
  };

  // Start new chat
  const startNewChat = (user) => {
    const newChat = {
      _id: `temp_${Date.now()}`,
      participants: [
        {
          userId: currentUser.sub,
          username: currentUser.preferred_username || "Unknown",
          avatar: currentUser.picture || null,
        },
        {
          userId: user.userId,
          username: user.username,
          avatar: user.avatar,
        },
      ],
      otherParticipant: {
        userId: user.userId,
        username: user.username,
        avatar: user.avatar,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
      },
      lastMessage: null,
    };

    setSelectedChat(newChat);
    setMessages([]);
    setShowUserList(false);
    setShowRoleSelector(false);
  };

  // Send organization invite via chat
  const sendOrgInvite = async (receiverUserId, receiverUsername, role) => {
    try {
      const response = await API.post("/org-invites/send", {
        invited_user_id: receiverUserId,
        invited_by: currentUser.sub,
        message: `${currentUser.preferred_username || "Someone"} invited you to join their organization as ${role}!`,
        role,
      });

      socket.emit("send_private_message", {
        senderId: currentUser.sub,
        senderUsername: currentUser.preferred_username || "Unknown",
        receiverId: receiverUserId,
        message: `You have been invited to join an organization as ${role}! Check your notifications.`,
        avatar: currentUser.picture || null,
      });

      setShowRoleSelector(false);
    } catch (error) {
      console.error("Error sending organization invite:", error);
      alert("❌ Failed to send organization invite. Please try again.");
    }
  };

  // Typing handlers
  const handleTypingStart = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (selectedChat && selectedChat.otherParticipant.userId) {
      socket.emit("user_typing", {
        senderId: currentUser.sub,
        senderUsername: currentUser.preferred_username || "Unknown",
        receiverId: selectedChat.otherParticipant.userId,
        isTyping: true,
      });
    }
    typingTimeoutRef.current = setTimeout(handleTypingStop, 3000);
  };

  // Handle typing stop
  const handleTypingStop = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (selectedChat && selectedChat.otherParticipant.userId) {
      socket.emit("user_typing", {
        senderId: currentUser.sub,
        senderUsername: currentUser.preferred_username || "Unknown",
        receiverId: selectedChat.otherParticipant.userId,
        isTyping: false,
      });
    }
  };

  // Format time
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return "Never";

    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return lastSeenDate.toLocaleDateString();
  };

  if (!keycloak?.authenticated) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-950/80 backdrop-blur-2xl">
        <div className="text-center animate-in fade-in-0 zoom-in-95">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Private Messages
          </h2>
          <p className="text-gray-300 text-sm sm:text-base">
            Please log in to access your messages
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row bg-gray-950/80 backdrop-blur-2xl overflow-x-hidden">
      {/* Chat List Sidebar */}
      <div className="w-full lg:w-1/3 bg-gray-950/80 backdrop-blur-2xl border-r border-white/10 flex flex-col transition-all duration-300">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Messages
            </h2>
            <button
              onClick={() => setShowUserList(!showUserList)}
              className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-lg"
            >
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <div
              className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${isConnected ? "bg-green-600 animate-pulse" : "bg-red-600"}`}
            ></div>
            <span className="text-gray-300">
              {isConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* User List or Chat List */}
        <div className="flex-1 overflow-y-auto">
          {showUserList ? (
            <div className="p-3 sm:p-4">
              <h3 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">
                Start New Chat
              </h3>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full px-3 py-1.5 sm:px-4 sm:py-2 mb-3 sm:mb-4 bg-gray-800/60 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-300 text-sm sm:text-base"
              />
              <div className="space-y-2">
                {users
                  .filter((user) =>
                    user.username
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                  )
                  .map((user) => (
                    <div
                      key={user.userId}
                      onClick={() => startNewChat(user)}
                      className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg bg-gray-800/60 hover:bg-gray-800/80 cursor-pointer transition-all duration-300 border border-white/10 hover:border-indigo-400/30 shadow-sm"
                    >
                      <div className="relative">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base">
                          {user.avatar ? (
                            <img
                              src={user.avatar}
                              alt={user.username}
                              className="w-full h-full rounded-full object-cover"
                            />
                          ) : (
                            user.username[0].toUpperCase()
                          )}
                        </div>
                        {user.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-green-600 border-2 border-gray-900 rounded-full animate-pulse"></div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium truncate text-sm sm:text-base">
                          {user.username}
                        </div>
                        <div className="text-gray-400 text-xs sm:text-sm">
                          {user.isOnline
                            ? "Online"
                            : `Last seen ${formatLastSeen(user.lastSeen)}`}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {chats.map((chat) => (
                <div
                  key={chat._id}
                  onClick={() => handleChatSelect(chat)}
                  className={`p-2 sm:p-4 hover:bg-gray-800/80 cursor-pointer transition-all duration-300 ${
                    selectedChat?._id === chat._id ? "bg-indigo-400/20" : ""
                  } border-l-4 ${selectedChat?._id === chat._id ? "border-indigo-400" : "border-transparent"}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-full flex items-center justify-center text-white font-bold text-base sm:text-lg">
                        {chat.otherParticipant.avatar ? (
                          <img
                            src={chat.otherParticipant.avatar}
                            alt={chat.otherParticipant.username}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          chat.otherParticipant.username[0].toUpperCase()
                        )}
                      </div>
                      {chat.otherParticipant.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-green-600 border-2 border-gray-900 rounded-full animate-pulse"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="text-white font-medium truncate text-sm sm:text-base">
                          {chat.otherParticipant.username}
                        </div>
                        {chat.lastMessage && (
                          <div className="text-gray-400 text-xs">
                            {formatTime(chat.lastMessage.timestamp)}
                          </div>
                        )}
                      </div>
                      <div className="text-gray-300 text-xs sm:text-sm truncate">
                        {chat.lastMessage
                          ? chat.lastMessage.text
                          : "No messages yet"}
                      </div>
                      <div className="text-gray-400 text-xs">
                        {chat.otherParticipant.isOnline
                          ? "Online"
                          : `Last seen ${formatLastSeen(chat.otherParticipant.lastSeen)}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="bg-gray-950/80 backdrop-blur-2xl border-b border-white/10 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="relative">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-base sm:text-lg">
                        {selectedChat.otherParticipant.username
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    </div>
                    {selectedChat.otherParticipant.isOnline && (
                      <div className="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 bg-green-600 rounded-full border-2 border-gray-900 animate-pulse"></div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-white font-semibold text-base sm:text-lg">
                      {selectedChat.otherParticipant.username}
                    </h3>
                    <p className="text-gray-400 text-xs sm:text-sm">
                      {selectedChat.otherParticipant.isOnline
                        ? "Online"
                        : `Last seen ${formatLastSeen(selectedChat.otherParticipant.lastSeen)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <button
                      onClick={() => setShowRoleSelector(!showRoleSelector)}
                      className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 text-white text-xs sm:text-sm font-semibold transition-all duration-300 shadow-lg"
                      title="Invite to Organization"
                    >
                      <span className="flex items-center">
                        <i className="fas fa-users mr-1 sm:mr-2"></i>
                        Invite to Org
                      </span>
                    </button>

                    {/* Role Selector Dropdown */}
                    {showRoleSelector && (
                      <div className="absolute right-0 top-full mt-2 w-40 sm:w-48 bg-gray-900/80 backdrop-blur-2xl rounded-2xl shadow-xl border border-white/10 z-[9999] overflow-hidden animate-in fade-in-0 zoom-in-95">
                        <div className="p-2">
                          <button
                            onClick={() =>
                              sendOrgInvite(
                                selectedChat.otherParticipant.userId,
                                selectedChat.otherParticipant.username,
                                "viewer"
                              )
                            }
                            className="w-full text-left px-3 py-1.5 sm:px-4 sm:py-2 text-white hover:bg-indigo-400/20 rounded-lg transition-all duration-300 border-l-2 border-transparent hover:border-indigo-400 text-xs sm:text-sm"
                          >
                            Invite as Viewer
                          </button>
                          <button
                            onClick={() =>
                              sendOrgInvite(
                                selectedChat.otherParticipant.userId,
                                selectedChat.otherParticipant.username,
                                "reviewer"
                              )
                            }
                            className="w-full text-left px-3 py-1.5 sm:px-4 sm:py-2 text-white hover:bg-indigo-400/20 rounded-lg transition-all duration-300 border-l-2 border-transparent hover:border-indigo-400 text-xs sm:text-sm"
                          >
                            Invite as Reviewer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedChat(null)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-800/80 rounded-lg transition-all duration-300"
                  >
                    <i className="fas fa-times text-base sm:text-xl"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-gray-300 animate-pulse text-sm sm:text-base">
                    No messages yet. Start the conversation!
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message._id}
                    className={`flex ${message.senderId === currentUser.sub ? "justify-end" : "justify-start"} animate-in fade-in-0 zoom-in-95`}
                  >
                    <div
                      className={`max-w-xs sm:max-w-md px-3 py-2 sm:px-4 sm:py-2 rounded-2xl transition-all duration-300 border border-white/10 ${
                        message.senderId === currentUser.sub
                          ? "bg-while/[0.02] text-white"
                          : "bg-gray-800/60 text-white"
                      }`}
                    >
                      <div className="break-words text-sm sm:text-base">
                        {message.message}
                      </div>
                      <div
                        className={`text-xs mt-1 ${
                          message.senderId === currentUser.sub
                            ? "text-indigo-200"
                            : "text-gray-400"
                        }`}
                      >
                        {formatTime(message.createdAt)}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="flex justify-start">
                  <div className="bg-gray-800/60 text-gray-300 px-3 py-2 sm:px-4 sm:py-2 rounded-2xl text-xs sm:text-sm italic border border-white/10 animate-pulse">
                    {Array.from(typingUsers).join(", ")}{" "}
                    {typingUsers.size === 1 ? "is" : "are"} typing...
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 sm:p-4 bg-gray-900/80 backdrop-blur-2xl border-t border-white/10">
              <form
                onSubmit={handleSendMessage}
                className="flex gap-2 sm:gap-3"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTypingStart();
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 sm:px-4 sm:py-3 bg-gray-800/60 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all duration-300 hover:bg-gray-800/80 text-sm sm:text-base"
                  maxLength={1000}
                  disabled={!isConnected}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || !isConnected}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-500 hover:to-purple-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all duration-300 shadow-lg text-xs sm:text-sm"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center animate-in fade-in-0 zoom-in-95">
              <div className="text-4xl sm:text-6xl mb-4">
                <i
                  className="fa-solid fa-comments"
                  style={{ color: "#a5b4fc" }}
                ></i>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
                Select a chat to start messaging
              </h3>
              <p className="text-gray-300 text-sm sm:text-base">
                Choose from your existing conversations or start a new one
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
