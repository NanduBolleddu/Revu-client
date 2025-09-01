import { useState, useEffect, useRef, useCallback } from "react";
import { socket } from "../lib/socket";
import API from "../lib/api";

export default function DocumentEditor({
  document,
  currentUser,
  onClose,
  isSharedDocument = false,
  permissionLevel = null,
}) {
  // Editor state
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Collaboration state
  const [activeUsers, setActiveUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [cursors, setCursors] = useState({});
  const [selections, setSelections] = useState({});

  // Editor refs
  const textareaRef = useRef(null);
  const saveTimeoutRef = useRef(null);

  // Permission checks
  const canEdit =
    !isSharedDocument ||
    (permissionLevel && ["editor", "owner"].includes(permissionLevel));
  const canSave = canEdit;

  // Document stats
  const wordCount = content
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const charCount = content.length;
  const lineCount = content.split("\n").length;

  // Load document content
  useEffect(() => {
    const loadContent = async () => {
      try {
        setIsLoading(true);
        const response = await API.get(`/documents/${document.id}/content`);
        setContent(response.data.content || "");
        setLastSaved(new Date());
      } catch (error) {
        console.error("Error loading document content:", error);
        setContent("");
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [document.id]);

  // Socket connection and collaboration setup
  useEffect(() => {
    if (!currentUser) return;

    const connectToDocument = () => {
      if (!socket.connected) {
        socket.connect();
      }

      socket.emit("join-document", {
        documentId: document.id,
        userId: currentUser.id,
        username: currentUser.username,
      });
    };

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const handleDocumentJoined = ({ activeSessions }) => {
      setActiveUsers(activeSessions || []);
      console.log(
        `📝 Joined document ${document.id} with ${activeSessions?.length || 0} active users`
      );
    };

    const handleUserJoined = ({
      userId,
      username,
      userColor,
      activeSessions,
    }) => {
      setActiveUsers(activeSessions || []);
      console.log(`👤 ${username} joined document`);
    };

    const handleUserLeft = ({ userId }) => {
      setActiveUsers((prev) => prev.filter((user) => user.userId !== userId));
      setCursors((prev) => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
      setSelections((prev) => {
        const newSelections = { ...prev };
        delete newSelections[userId];
        return newSelections;
      });
    };

    const handleDocumentOperation = ({ operation, userId, version }) => {
      if (userId === currentUser.id) return;

      const { type, position, content: opContent, length } = operation;

      setContent((prevContent) => {
        let newContent = prevContent;

        switch (type) {
          case "insert":
            newContent =
              prevContent.slice(0, position) +
              opContent +
              prevContent.slice(position);
            break;
          case "delete":
            newContent =
              prevContent.slice(0, position) +
              prevContent.slice(position + length);
            break;
          default:
            return prevContent;
        }

        return newContent;
      });

      setLastSaved(new Date());
    };

    const handleCursorUpdate = ({ userId, cursorPosition }) => {
      setCursors((prev) => ({
        ...prev,
        [userId]: cursorPosition,
      }));
    };

    const handleSelectionUpdate = ({ userId, selection }) => {
      setSelections((prev) => ({
        ...prev,
        [userId]: selection,
      }));
    };

    const handleDocumentError = ({ message }) => {
      console.error("Document collaboration error:", message);
      alert("Collaboration error: " + message);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("document-joined", handleDocumentJoined);
    socket.on("user-joined-document", handleUserJoined);
    socket.on("user-left-document", handleUserLeft);
    socket.on("document-operation-applied", handleDocumentOperation);
    socket.on("cursor-updated", handleCursorUpdate);
    socket.on("selection-updated", handleSelectionUpdate);
    socket.on("document-error", handleDocumentError);

    connectToDocument();

    return () => {
      socket.emit("leave-document", {
        documentId: document.id,
        userId: currentUser.id,
      });

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("document-joined", handleDocumentJoined);
      socket.off("user-joined-document", handleUserJoined);
      socket.off("user-left-document", handleUserLeft);
      socket.off("document-operation-applied", handleDocumentOperation);
      socket.off("cursor-updated", handleCursorUpdate);
      socket.off("selection-updated", handleSelectionUpdate);
      socket.off("document-error", handleDocumentError);
    };
  }, [document.id, currentUser]);

  // Handle content changes
  const handleContentChange = useCallback(
    (e) => {
      if (!canEdit) return;

      const newContent = e.target.value;
      const oldContent = content;

      setContent(newContent);
      setHasUnsavedChanges(true);

      const textarea = textareaRef.current;
      const cursorPos = textarea.selectionStart;

      if (newContent.length > oldContent.length) {
        const insertedText = newContent.slice(
          cursorPos - (newContent.length - oldContent.length),
          cursorPos
        );
        const operation = {
          type: "insert",
          position: cursorPos - insertedText.length,
          content: insertedText,
        };

        socket.emit("document-operation", {
          documentId: document.id,
          userId: currentUser.id,
          operation,
        });
      } else if (newContent.length < oldContent.length) {
        const deletedLength = oldContent.length - newContent.length;
        const operation = {
          type: "delete",
          position: cursorPos,
          length: deletedLength,
        };

        socket.emit("document-operation", {
          documentId: document.id,
          userId: currentUser.id,
          operation,
        });
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        handleSave(newContent);
      }, 2000);
    },
    [content, canEdit, currentUser, document.id]
  );

  // Handle cursor position changes
  const handleSelectionChange = useCallback(() => {
    if (!canEdit || !textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const textBeforeStart = content.substring(0, start);
    const startLine = textBeforeStart.split("\n").length - 1;
    const startColumn = textBeforeStart.split("\n").pop().length;

    const cursorPosition = { line: startLine, column: startColumn };

    socket.emit("cursor-update", {
      documentId: document.id,
      userId: currentUser.id,
      cursorPosition,
    });

    if (start !== end) {
      const textBeforeEnd = content.substring(0, end);
      const endLine = textBeforeEnd.split("\n").length - 1;
      const endColumn = textBeforeEnd.split("\n").pop().length;

      const selection = {
        start: cursorPosition,
        end: { line: endLine, column: endColumn },
      };

      socket.emit("selection-update", {
        documentId: document.id,
        userId: currentUser.id,
        selection,
      });
    }
  }, [content, canEdit, currentUser, document.id]);

  // Manual save function
  const handleSave = async (contentToSave = content) => {
    if (!canSave || isSaving) return;

    try {
      setIsSaving(true);
      await API.patch(`/documents/${document.id}/content`, {
        content: contentToSave,
        userId: currentUser.id,
      });
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      console.log("✅ Document saved successfully");
    } catch (error) {
      console.error("Error saving document:", error);
      alert(
        "Failed to save document: " +
          (error.response?.data?.error || error.message)
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
  };

  // Format last saved time
  const formatLastSaved = (date) => {
    if (!date) return "Not saved yet";
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return "Saved just now";
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `Saved ${Math.floor(diff / 3600)} hours ago`;
    return `Saved on ${date.toLocaleDateString()}`;
  };

  // Get user initials
  const getUserInitials = (username) => {
    return (
      username
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "U"
    );
  };

  if (isLoading) {
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
          }

          .ripple-effect:active::before {
            width: 300px;
            height: 300px;
          }
        `}</style>

        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg material-shadow p-6 w-full max-w-md">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4 animate-spin"></div>
              <p className="text-gray-600 google-font font-medium">
                Loading document...
              </p>
            </div>
          </div>
        </div>
      </>
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

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 material-shadow sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              {/* Left side - Document info */}
              <div className="flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors ripple-effect"
                  aria-label="Close editor"
                >
                  <span className="material-icons text-gray-500">
                    arrow_back
                  </span>
                </button>

                <div>
                  <h1 className="text-xl font-medium text-gray-900 google-font">
                    {document.title}
                  </h1>
                  <div className="flex items-center gap-4 text-sm text-gray-600 google-font mt-1">
                    <span>{formatLastSaved(lastSaved)}</span>
                    {hasUnsavedChanges && (
                      <span className="text-amber-600 flex items-center gap-1">
                        <span className="material-icons text-sm">warning</span>
                        Unsaved changes
                      </span>
                    )}
                    {isSharedDocument && (
                      <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium google-font">
                        <span className="material-icons text-sm align-middle mr-1">
                          share
                        </span>
                        Shared • {permissionLevel}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Center - Active users */}
              <div className="hidden md:flex items-center gap-2">
                {activeUsers.slice(0, 5).map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-full text-sm material-shadow"
                    title={user.username}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: user.userColor }}
                    >
                      <span className="text-white text-sm font-medium google-font">
                        {getUserInitials(user.username)}
                      </span>
                    </div>
                    <span className="text-gray-700 font-medium google-font truncate max-w-[120px]">
                      {user.userId === currentUser.id ? "You" : user.username}
                    </span>
                  </div>
                ))}
                {activeUsers.length > 5 && (
                  <span className="text-xs text-gray-600 google-font">
                    +{activeUsers.length - 5} more
                  </span>
                )}
              </div>

              {/* Right side - Actions */}
              <div className="flex items-center gap-3">

                {/* Connection status */}
                <div
                  className={`flex items-center gap-2 text-xs px-3 py-1 rounded-full google-font ${
                    isConnected
                      ? "bg-green-50 text-green-700"
                      : "bg-red-50 text-red-700"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                  />
                  {isConnected ? "Connected" : "Disconnected"}
                </div>

                {/* Save button */}
                {canSave && (
                  <button
                    onClick={() => handleSave()}
                    disabled={isSaving || !hasUnsavedChanges}
                    className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium google-font transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 ripple-effect"
                  >
                    {isSaving ? (
                      <span className="flex items-center gap-2">
                        <span className="material-icons animate-spin text-sm">
                          refresh
                        </span>
                        Saving...
                      </span>
                    ) : (
                      "Save"
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 max-w-4xl mx-auto w-full p-6 sm:p-8">
          <div className="bg-white rounded-lg material-shadow border border-gray-200 min-h-[600px] relative">
            {!canEdit && (
              <div className="absolute top-4 left-4 right-4 bg-amber-50 border border-amber-200 rounded-lg p-3 z-10">
                <div className="flex items-center gap-2 text-amber-800 google-font">
                  <span className="material-icons text-sm">visibility</span>
                  <span className="text-sm font-medium">
                    You have view-only access to this document
                  </span>
                </div>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onSelect={handleSelectionChange}
              onKeyDown={handleKeyDown}
              disabled={!canEdit}
              className={`w-full h-full min-h-[700px] text-gray-900 p-6 border-none resize-none focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg text-sm leading-relaxed google-font ${
                !canEdit ? "bg-gray-50 cursor-default" : "bg-white"
              } ${canEdit ? "pt-8" : "pt-16"}`}
              placeholder={canEdit ? "Start writing your document..." : ""}
              style={{
                fontSize: "14px",
                lineHeight: "1.6",
                fontFamily:
                  '"Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            />

            {/* Collaborative cursors */}
            {Object.entries(cursors).map(([userId, cursor]) => (
              <div
                key={`cursor-${userId}`}
                className="absolute pointer-events-none"
                style={{
                  top: `${cursor.line * 24 + 32}px`,
                  left: `${cursor.column * 8 + 10}px`,
                  height: "24px",
                  width: "2px",
                  backgroundColor:
                    activeUsers.find((u) => u.userId === userId)?.userColor ||
                    "#4285f4",
                }}
              >
                <div
                  className="absolute top-0 left-4 bg-gray-800 text-white text-xs px-2 py-1 rounded google-font whitespace-nowrap"
                  style={{ transform: "translateY(-50%)" }}
                >
                  {activeUsers.find((u) => u.userId === userId)?.username ||
                    "Unknown"}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 py-3 px-4 material-shadow">
          <div className="max-w-7xl mx-auto flex justify-between items-center text-xs text-gray-600 google-font">
            <div className="flex items-center gap-2">
              <span className="material-icons text-sm">edit_document</span>
              <span>LiveDraft - Real-time collaborative document editing</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="material-icons text-sm">keyboard</span>
                Ctrl+S to save
              </span>
              <span>|</span>
              <span className="flex items-center gap-1">
                <span className="material-icons text-sm">group</span>
                {activeUsers.length} active user
                {activeUsers.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
