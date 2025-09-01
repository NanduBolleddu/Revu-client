import { useEffect, useState } from "react";
import API from "../lib/api";
import DocumentCard from "../components/DocumentCard";
import DocumentEditor from "../components/DocumentEditor";

export default function DocumentsPage({ keycloak }) {
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  // Get or create user in database
  const getCurrentUser = async () => {
    if (!keycloak?.authenticated) return null;

    try {
      const keycloakId = keycloak.tokenParsed?.sub;
      const userResponse = await API.get(`/users?keycloak_id=${keycloakId}`);

      if (userResponse.data.length === 0) {
        const newUser = await API.post('/users', {
          keycloak_id: keycloakId,
          username: keycloak.tokenParsed?.preferred_username || 'Unknown',
          email: keycloak.tokenParsed?.email || '',
          role: 'user'
        });
        return {
          id: newUser.data.userId,
          username: newUser.data.username || keycloak.tokenParsed?.preferred_username,
          email: newUser.data.email || keycloak.tokenParsed?.email
        };
      }

      const user = userResponse.data[0];
      return {
        id: user.id,
        username: user.username,
        email: user.email
      };
    } catch (err) {
      console.error("Error getting current user:", err);
      return null;
    }
  };

  useEffect(() => {
    const fetchUserAndDocuments = async () => {
      if (!keycloak?.authenticated) {
        setLoading(false);
        return;
      }

      try {
        const userData = await getCurrentUser();
        setCurrentUserId(userData?.id);
        setCurrentUser(userData);

        if (!userData?.id) {
          console.error("Could not get user ID");
          setLoading(false);
          return;
        }

        const documentsResponse = await API.get(`/documents?userId=${userData.id}`);
        setDocuments(documentsResponse.data);
      } catch (err) {
        console.error("Error fetching documents", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndDocuments();
  }, [keycloak?.authenticated]);

  const refreshDocuments = async () => {
    if (!currentUserId) return;
    try {
      const documentsResponse = await API.get(`/documents?userId=${currentUserId}`);
      setDocuments(documentsResponse.data);
    } catch (err) {
      console.error("Error refreshing documents", err);
    }
  };

  const handleEdit = async (id, newTitle) => {
    setDocuments(documents => 
      documents.map(item => 
        item.id === id ? { ...item, title: newTitle } : item
      )
    );
    if (selected && selected.id === id) {
      setSelected({ ...selected, title: newTitle });
    }
  };

  const handleDelete = async (id) => {
    try {
      await API.delete(`/documents/${id}`);
      setDocuments(documents => documents.filter(item => item.id !== id));
      if (selected && selected.id === id) {
        setSelected(null);
      }
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Failed to delete the document: " + (err.response?.data?.error || err.message));
    }
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const isValidType = allowedTypes.includes(file.type) || 
                         file.name.toLowerCase().endsWith('.txt') ||
                         file.name.toLowerCase().endsWith('.docx');
      
      if (!isValidType) {
        setUploadMessage("❌ Please select a .txt or .docx file only");
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setUploadMessage("❌ File size must be less than 50MB");
        return;
      }

      setUploadFile(file);
      setUploadMessage("");
      
      const nameWithoutExt = file.name.split('.').slice(0, -1).join('.');
      setUploadTitle(nameWithoutExt || file.name);
    }
  };

  // Handle upload
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) {
      setUploadMessage("❌ Please select a file and enter a title");
      return;
    }

    if (!currentUserId) {
      setUploadMessage("❌ User not authenticated properly");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle.trim());
      formData.append("created_by", currentUserId);

      const response = await API.post("/documents/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      setUploadMessage("✅ " + response.data.message);
      
      setUploadFile(null);
      setUploadTitle("");
      
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';

      await refreshDocuments();

      setTimeout(() => {
        setShowUploadModal(false);
        setUploadMessage("");
      }, 2000);

    } catch (err) {
      console.error("Upload error:", err.response?.data);
      setUploadMessage("❌ Upload failed: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  // Close upload modal
  const closeUploadModal = () => {
    setShowUploadModal(false);
    setUploadFile(null);
    setUploadTitle('');
    setUploadMessage('');
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

  // Filter and sort documents
  const filteredDocuments = documents
    .filter(item => {
      const matchesType = filterType === "all" || item.file_type === filterType;
      return matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
        case "oldest":
          return new Date(a.created_at) - new Date(b.created_at);
        case "alphabetical":
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

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
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 material-shadow">
              <span className="material-icons text-blue-600 text-4xl">edit_document</span>
            </div>
            <h1 className="text-3xl font-medium text-gray-900 google-font mb-4">Welcome to LiveDraft</h1>
            <p className="text-lg text-gray-600 google-font mb-8 max-w-md mx-auto">
              Your collaborative document editing workspace for real-time writing and teamwork
            </p>
            <button
              onClick={() => keycloak.login()}
              className="px-8 py-3 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 transition-colors google-font ripple-effect material-shadow-hover"
            >
              Get Started
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
          
          .material-shadow-hover:hover {
            box-shadow: 0 4px 8px 0 rgba(60, 64, 67, 0.3), 0 2px 12px 0 rgba(60, 64, 67, 0.15);
          }
        `}</style>

        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4 animate-spin"></div>
            <p className="text-gray-600 google-font font-medium">Loading your documents...</p>
          </div>
        </div>
      </>
    );
  }

  if (selected) {
    return (
      <DocumentEditor
        document={selected}
        currentUser={currentUser}
        onClose={() => setSelected(null)}
      />
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-medium text-gray-900 google-font">My Documents</h1>
                <p className="text-sm text-gray-600 google-font mt-1">Create, edit, and collaborate on documents in real-time</p>
              </div>
              
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 transition-colors google-font ripple-effect material-shadow-hover"
              >
                <span className="material-icons text-sm mr-2">add</span>
                Upload Document
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg material-shadow p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 google-font">Filter:</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent google-font"
                >
                  <option value="all">All Files</option>
                  <option value="txt">Text Files (.txt)</option>
                  <option value="docx">Word Documents (.docx)</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 google-font">Sort:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-blue-600 focus:border-transparent google-font"
                >
                  <option value="newest">Latest Modified</option>
                  <option value="oldest">Oldest First</option>
                  <option value="alphabetical">Alphabetical</option>
                </select>
              </div>
            </div>
            
            <div className="text-sm text-gray-600 google-font">
              {filteredDocuments.length} document{filteredDocuments.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Documents Grid */}
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 material-shadow">
                <span className="material-icons text-gray-400 text-2xl">description</span>
              </div>
              <h3 className="text-xl font-medium text-gray-900 google-font mb-2">No documents found</h3>
              <p className="text-sm text-gray-600 google-font mb-6">
                {filterType !== "all" 
                  ? `You haven't uploaded any ${filterType} files yet. Try changing the filter or upload new content.`
                  : "You haven't uploaded any documents yet. Create your first document to get started."
                }
              </p>
              {filterType === "all" && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center px-6 py-2 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 transition-colors google-font ripple-effect material-shadow-hover"
                >
                  <span className="material-icons text-sm mr-2">upload_file</span>
                  Upload Document
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredDocuments.map((document) => (
                <DocumentCard
                  key={document.id}
                  item={document}
                  onClick={setSelected}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg material-shadow w-full max-w-md">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-medium text-gray-900 google-font">Upload Document</h3>
                  <button
                    onClick={closeUploadModal}
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors ripple-effect"
                  >
                    <span className="material-icons text-gray-500">close</span>
                  </button>
                </div>

                <form onSubmit={handleUpload} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 google-font">
                      Select Document
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        onChange={handleFileSelect}
                        accept=".txt,.docx"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent google-font text-gray-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        disabled={uploading}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 google-font">
                      Supported formats: .txt, .docx (max 50MB)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 google-font">
                      Document Title
                    </label>
                    <input
                      type="text"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent google-font text-gray-900"
                      placeholder="Enter document title"
                      disabled={uploading}
                    />
                  </div>

                  {uploadMessage && (
                    <div className={`p-3 rounded-lg text-sm google-font ${
                      uploadMessage.startsWith('✅')
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      {uploadMessage}
                    </div>
                  )}

                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={closeUploadModal}
                      className="flex-1 px-4 py-2 text-blue-600 border border-blue-600 rounded-full hover:bg-blue-50 transition-colors google-font font-medium ripple-effect"
                      disabled={uploading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed google-font font-medium ripple-effect"
                      disabled={uploading || !uploadFile}
                    >
                      {uploading ? (
                        <span className="flex items-center justify-center">
                          <span className="material-icons animate-spin text-sm mr-2">refresh</span>
                          Uploading...
                        </span>
                      ) : (
                        'Upload Document'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}