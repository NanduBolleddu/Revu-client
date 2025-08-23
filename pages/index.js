import { useEffect, useState } from "react";
import API from "../lib/api";
import MediaCard from "../components/MediaCard";
import MediaDetail from "../components/MediaDetail";

export default function MediaPage({ keycloak }) {
  const [media, setMedia] = useState([]);
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
        return { id: newUser.data.id, username: newUser.data.username, email: newUser.data.email };
      }
      const user = userResponse.data[0];
      return { id: user.id, username: user.username, email: user.email };
    } catch (err) {
      console.error("Error getting current user:", err);
      return null;
    }
  };
  

  useEffect(() => {
    const fetchUserAndMedia = async () => {
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
        const mediaResponse = await API.get(`/media?userId=${userData.id}`);
        setMedia(mediaResponse.data);
      } catch (err) {
        console.error("Error fetching media", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndMedia();
  }, [keycloak?.authenticated]);
  

  const refreshMedia = async () => {
    if (!currentUserId) return;
    try {
      const mediaResponse = await API.get(`/media?userId=${currentUserId}`);
      setMedia(mediaResponse.data);
    } catch (err) {
      console.error("Error refreshing media", err);
    }
  };

  const handleEdit = async(id, newTitle) => {
    setMedia(media => media.map(item => item.id === id ? { ...item, title: newTitle } : item));
    if (selected && selected.id === id) {
      setSelected({ ...selected, title: newTitle });
    }
  };
  

  // Delete handler
  const handleDelete = async (id) => {
    try {
      await API.delete(`/media/${id}`);
      setMedia(media => media.filter(item => item.id !== id));
      if (selected && selected.id === id) {
        setSelected(null);
      }
    } catch (err) {
      console.error("Error deleting media:", err);
      alert("Failed to delete the file. Please try again.");
    }
  };

  // Auto-detect file type based on MIME type
  const getFileType = (file) => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'image'; // Default fallback
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const isValidType = file.type.startsWith('image/') || file.type.startsWith('video/');
      if (!isValidType) {
        setUploadMessage("❌ Please select an image or video file");
        return;
      }
      
      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        setUploadMessage("❌ File size must be less than 50MB");
        return;
      }
      
      setUploadFile(file);
      setUploadMessage("");
      
      // Auto-generate title from filename (without extension)
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
      formData.append("type", getFileType(uploadFile));
      formData.append("uploaded_by", currentUserId);

      const response = await API.post("/media/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadMessage("✅ " + response.data.message);
      
      // Reset form
      setUploadFile(null);
      setUploadTitle("");
      
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
      
      // Refresh media list
      await refreshMedia();
      
      // Auto-close modal after success
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

  // Filter and sort media
  const filteredMedia = media
    .filter(item => {
      const matchesType = filterType === "all" || item.type === filterType;
      return matchesType;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at) - new Date(a.created_at);
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
      <div className="min-h-screen bg-gray-950/80 text-white p-6">
        <div className="text-center p-12 bg-white/[0.03] backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl max-w-md">
          <h2 className="text-3xl font-bold text-white mb-4 tracking-wide">REVU</h2>
          <p className="text-white/70 mb-8 leading-relaxed">Your creative workspace for sophisticated media collaboration</p>
          <button 
            onClick={() => keycloak.login()}
            className="px-8 py-3 bg-gradient-to-r from-white/20 to-white/10 text-white rounded-2xl hover:from-white/30 hover:to-white/15 transition-all font-bold shadow-2xl hover:shadow-3xl hover:scale-105 transform duration-300 border border-white/20 tracking-wider"
          >
            ENTER
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950/80 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mb-6 shadow-2xl"></div>
          <p className="text-white text-xl font-semibold tracking-wide">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950/80 text-white">
      
      {/* Header Section */}
      <div className="px-8 py-12">
        <div className="max-w-7xl mx-auto">
          
          {/* Royal Welcome Area */}
          <div className="mb-12">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-white/[0.02] rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-2xl border border-white/10">
                  {(keycloak.tokenParsed?.preferred_username)[0].toUpperCase()}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1 tracking-wide">
                    Welcome {keycloak.tokenParsed?.preferred_username}
                  </h1>
                </div>
              </div>

              {/* Premium Upload Button */}
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 bg-white/[0.02] backdrop-blur-md text-white rounded-2xl hover:from-white/30 hover:to-white/15 transition-all font-bold shadow-2xl hover:shadow-3xl flex items-center gap-3 group border border-white/20 tracking-wide"
              >
                <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                UPLOAD
              </button>
            </div>

            {/* Stats Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 bg-white/[0.02] backdrop-blur-3xl rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-500 shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shadow-xl">
                    <span className="text-2xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff" className="size-6">
  <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
</svg>
</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white tracking-wider">{media.length}</div>
                    <div className="text-sm text-white/60 font-semibold tracking-wider">TOTAL FILES</div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-white/[0.02] backdrop-blur-3xl rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-500 shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shadow-xl">
                    <span className="text-2xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff" className="size-6">
  <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
</svg>
</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white tracking-wider">{media.filter(m => m.type === 'image').length}</div>
                    <div className="text-sm text-white/60 font-semibold tracking-wider">IMAGES</div>
                  </div>
                  
                </div>
              </div>
              
              <div className="p-6 bg-white/[0.02] backdrop-blur-3xl rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-500 shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 shadow-xl">
                    <span className="text-2xl"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ffffff" className="size-6">
  <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
</svg>
</span>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white tracking-wider">{media.filter(m => m.type === 'video').length}</div>
                    <div className="text-sm text-white/60 font-semibold tracking-wider">VIDEOS</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10">
  <div className="flex items-center gap-1 p-1 bg-white/[0.03] backdrop-blur-3xl rounded-2xl border border-white/10">
    {['all', 'image', 'video'].map((type) => (
      <button
        key={type}
        onClick={() => setFilterType(type)}
        className={`relative px-6 py-3 rounded-xl font-bold transition-all duration-300 tracking-wide group ${
          filterType === type
            ? 'text-white'
            : 'text-white/60 hover:text-white/80 hover:bg-white/[0.05]'
        }`}
      > <span className="relative inline-block">
        {type === 'all' ? 'ALL' : type === 'image' ? 'IMAGES' : 'VIDEOS'}
        <span
          className={`absolute bottom-[-5px] left-1/2 w-0 h-[2px] bg-white transition-all duration-300 ease-out transform -translate-x-1/2 ${
            filterType === type
              ? 'w-full'
              : 'group-hover:w-full'
          }`}
        ></span>
        </span>
      </button>
    ))}
  </div>
</div>
        </div>
      </div>

      {/* Media Grid */}
      <div className="px-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {filteredMedia.length === 0 ? (
            <div className="text-center py-20 bg-white/[0.01] backdrop-blur-3xl rounded-3xl border border-white/10 shadow-2xl">
              <div className="text-6xl mb-6"><i className="fa-solid fa-folder-open" style={{ color: "#ffffff", fontSize: "45px" }}></i></div>
              <h3 className="text-xl font-bold text-white mb-4 tracking-wide">
                {filterType !== "all" ? `NO ${filterType.toUpperCase()}S FOUND` : "YOUR GALLERY AWAITS"}
              </h3>
              <p className="text-white/60 mb-8 max-w-md mx-auto leading-relaxed">
                {filterType !== "all" 
                  ? `You haven't uploaded any ${filterType}s yet. Try changing the filter or upload new content.` 
                  : "You haven't uploaded any files yet. Upload new content."
                }
              </p>
              {filterType === "all" && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-3 px-6 py-3 bg-white/[0.02] backdrop-blur-md text-white rounded-2xl hover:from-white/30 hover:to-white/15 transition-all font-bold shadow-2xl hover:shadow-3xl flex items-center gap-3 group border border-white/20 tracking-wide"
                >
                  <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                    START UPLOADING
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-bold text-white tracking-wide">YOUR MEDIA</h2>
                  <span className="px-4 py-2 bg-white/[0.03] backdrop-blur-3xl rounded-xl text-white/60 text-sm border border-white/10 font-semibold tracking-wider shadow-xl">
                    {filteredMedia.length} FILE{filteredMedia.length !== 1 ? 'S' : ''}
                  </span>
                </div>
                <div className="text-white/40 text-sm font-semibold tracking-wider">
                  UPDATED: {new Date().toLocaleDateString()}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {filteredMedia.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    onClick={() => setSelected(item)}
                    currentUserId={currentUserId}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={closeUploadModal}
        >
          <div 
            className="bg-gray-950/20 rounded-3xl border border-white/20 shadow-2xl backdrop-blur-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-8 border-b border-white/10">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-950 rounded-xl flex items-center justify-center border border-white/20">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white tracking-wide">UPLOAD MEDIA</h3>
                  <p className="text-white/60">Add images or videos to your collection</p>
                </div>
              </div>
              
              <button
                onClick={closeUploadModal}
                className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-white transition-all border border-white/20 hover:border-white/30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8">
              <form onSubmit={handleUpload} className="space-y-6">
                {/* File Input */}
                <div>
                  <label className="block text-white/80 text-sm font-bold mb-4 tracking-wider">
                    SELECT FILE
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileSelect}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center hover:border-white/30 transition-all bg-white/[0.02]">
                      {uploadFile ? (
                        <div className="text-white">
                          <div className="text-5xl mb-4">
                            {uploadFile.type.startsWith('image/') ? <i className="fa-solid fa-image" style={{ color: "#ffffff", fontSize: "38px" }}></i> : <i className="fa-solid fa-video" style={{ color: "#ffffff", fontSize: "38px" }}></i>}
                          </div>
                          <p className="font-bold text-lg mb-2">{uploadFile.name}</p>
                          <p className="text-white/60 text-sm">
                            {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB • {getFileType(uploadFile).toUpperCase()}
                          </p>
                        </div>
                      ) : (
                        <div className="text-white/60">
                          <div className="text-5xl mb-4"><i className="fa-solid fa-folder-open" style={{ color: "#ffffff", fontSize: "50px" }}></i></div>
                          <p className="text-lg mb-2">Click or drag files here</p>
                          <p className="text-sm">Images and videos supported (Max 50MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Title Input */}
                <div>
                  <label className="block text-white/80 text-sm font-bold mb-4 tracking-wider">
                    TITLE
                  </label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="Enter a descriptive title..."
                    className="w-full px-4 py-4 bg-white/[0.05] backdrop-blur-3xl border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all text-lg"
                  />
                </div>

                {/* Message */}
                {uploadMessage && (
                  <div className={`p-4 rounded-xl font-semibold text-center ${uploadMessage.includes('✅' ) ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                    {uploadMessage}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex items-center gap-4 pt-4">
                  <button
                    type="button"
                    onClick={closeUploadModal}
                    className="flex-1 px-6 py-4 bg-white/[0.05] hover:bg-white/[0.1] text-white rounded-xl transition-all font-bold border border-white/20 hover:border-white/30 tracking-wider"
                  >
                    CANCEL
                  </button>
                  
                  <button
                    type="submit"
                    disabled={uploading || !uploadFile || !uploadTitle.trim()}
                    className="flex-1 px-6 py-4 bg-gradient-to-r from-white/20 to-white/10 text-white rounded-xl hover:from-white/30 hover:to-white/15 transition-all font-bold shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed border border-white/20 tracking-wider flex items-center justify-center gap-3"
                  >
                    {uploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        UPLOADING...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        UPLOAD
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Media Detail Modal */}
      {selected && (
        <MediaDetail
          item={selected}
          onClose={() => setSelected(null)}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
