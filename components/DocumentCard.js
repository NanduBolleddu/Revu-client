import { useMemo, useState } from "react";
import API from "../lib/api";
import ShareModal from "./ShareModal";

export default function DocumentCard({ 
  item, 
  onClick, 
  onDelete, 
  onEdit, 
  currentUserId,
  permissionLevel // New prop to determine user permissions
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [shareModalOpen, setShareModalOpen] = useState(false);

  // Determine if the user can perform restricted actions (share, rename, delete)
  const canPerformRestrictedActions = permissionLevel !== "editor";

  const formatTimeAgo = (date) => {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) {
      setEditError("Title cannot be empty");
      return;
    }

    setEditLoading(true);
    setEditError("");

    try {
      await API.patch(`/documents/${item.id}`, { title: editTitle.trim() });
      setEditOpen(false);
      setEditLoading(false);
      setMenuOpen(false);
      if (onEdit) onEdit(item.id, editTitle.trim());
    } catch (err) {
      console.error("Edit error:", err);
      const errorMessage = err.response?.data?.error || err.response?.data?.detail || "Failed to update title";
      setEditError(errorMessage);
      setEditLoading(false);
    }
  };

  const getFileIcon = () => {
    switch (item.file_type?.toLowerCase()) {
      case 'doc':
      case 'docx':
        return 'description';
      case 'txt':
        return 'article';
      default:
        return 'insert_drive_file';
    }
  };

  const getFileColor = () => {
    switch (item.file_type?.toLowerCase()) {
      case 'doc':
      case 'docx':
        return 'text-blue-600';
      case 'txt':
        return 'text-gray-600';
      default:
        return 'text-gray-500';
    }
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

      <div 
        className="group relative bg-white rounded-lg material-shadow material-shadow-hover transition-all duration-300 overflow-hidden cursor-pointer"
        onClick={() => onClick?.(item)}
      >
        {/* Document Icon Area */}
        <div className="p-10 text-center">
          <div className="relative inline-block">
            <span className={`material-icons ${getFileColor()} text-6xl mb-2`} style={{ fontSize: '4rem' }}>
              {getFileIcon()}
            </span>
            
            {/* File type badge */}
            <div className="absolute -top-1 -right-2 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full font-medium google-font">
              {item.file_type?.toUpperCase()}
            </div>
          </div>

          {/* Menu button */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors duration-200"
            >
              <span className="material-icons text-lg">more_vert</span>
            </button>
          </div>

          {/* Dropdown menu */}
          {menuOpen && (
            <div className="absolute top-12 right-3 bg-white rounded-lg material-shadow py-1 min-w-[120px] z-10">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.(item);
                  setMenuOpen(false);
                }}
                className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 google-font"
              >
                <span className="material-icons text-blue-600 text-lg">edit</span>
                Open & Edit
              </button>
              {canPerformRestrictedActions && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditOpen(true);
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 google-font"
                  >
                    <span className="material-icons text-green-600 text-lg">drive_file_rename_outline</span>
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShareModalOpen(true);
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 google-font"
                  >
                    <span className="material-icons text-blue-600 text-lg">share</span>
                    Share
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmOpen(true);
                      setMenuOpen(false);
                    }}
                    className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 google-font"
                  >
                    <span className="material-icons text-red-600 text-lg">delete</span>
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Document info */}
        <div className="px-4 pb-4">
          <h3 className="font-medium text-gray-900 mb-1 truncate google-font text-base leading-tight">
            {item.title}
          </h3>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-gray-600 google-font">
              <span className="material-icons text-sm">schedule</span>
              <span>Modified {formatTimeAgo(item.updated_at || item.created_at)}</span>
            </div>
            
            {item.file_size && (
              <div className="flex items-center gap-2 text-xs text-gray-600 google-font">
                <span className="material-icons text-sm">storage</span>
                <span>{formatFileSize(item.file_size)}</span>
              </div>
            )}

            {item.last_edited_by_username && (
              <div className="flex items-center gap-2 text-xs text-gray-600 google-font">
                <span className="material-icons text-sm">person</span>
                <span>Last edited by {item.last_edited_by_username}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal - Only shown if user can perform restricted actions */}
      {editOpen && canPerformRestrictedActions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg material-shadow p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-medium text-gray-900 google-font">Rename</h3>
              <button
                onClick={() => setEditOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <span className="material-icons text-gray-500">close</span>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 google-font">
                  Document name
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-gray-900 px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:border-transparent google-font"
                  placeholder="Enter document name"
                  disabled={editLoading}
                />
              </div>
              
              {editError && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md google-font">
                  {editError}
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors google-font font-medium"
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed google-font font-medium ripple-effect"
                  disabled={editLoading}
                >
                  {editLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="material-icons animate-spin text-sm">refresh</span>
                      Saving...
                    </span>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Only shown if user can perform restricted actions */}
      {confirmOpen && canPerformRestrictedActions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg material-shadow p-6 w-full max-w-md">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-icons text-red-600 text-2xl">delete</span>
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2 google-font">Delete forever?</h3>
              <p className="text-gray-600 mb-6 google-font">
                "{item.title}" will be deleted forever. You can't undo this action.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition-colors google-font font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onDelete?.(item.id);
                    setConfirmOpen(false);
                  }}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors google-font font-medium ripple-effect"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal - Only shown if user can perform restricted actions */}
      {shareModalOpen && canPerformRestrictedActions && (
        <ShareModal
          documentId={item.id}
          currentUserId={currentUserId}
          onClose={() => setShareModalOpen(false)}
        />
      )}
    </>
  );
}