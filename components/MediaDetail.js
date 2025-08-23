import { useState, useEffect, useRef } from "react";
import { socket } from "../lib/socket";
import API from "../lib/api";

export default function MediaDetail({
  item,
  onClose,
  currentUser,
  permissionLevel = null,
  isSharedMedia = false,
}) {
  const src = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}${item.file_path}`;
  const videoRef = useRef(null);
  const commentsContainerRef = useRef(null);

  // --- State Management ---
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(item.likes || 0);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [activeTab, setActiveTab] = useState("comments");
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [annotationText, setAnnotationText] = useState("");
  const [pendingAnnotation, setPendingAnnotation] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Check if user can write (comment/annotate)
  const canWrite =
    !isSharedMedia ||
    (permissionLevel && ["reviewer", "owner"].includes(permissionLevel));
  const canEdit = !isSharedMedia; // Only own media can be edited

  // --- Utility Functions ---
  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

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

  // --- Effects for Data and Sockets ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [commentsRes, annotationsRes] = await Promise.all([
          API.get(`/comments?media_id=${item.id}`),
          API.get(`/annotations?media_id=${item.id}`),
        ]);
        setComments(commentsRes.data);
        setAnnotations(annotationsRes.data);
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };

    fetchData();

    if (!socket.connected) socket.connect();
    socket.emit("join-media", item.id);

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const onNewComment = (newComment) => {
      setComments((prev) => {
        if (!prev.some((c) => c._id === newComment._id)) {
          return [...prev, newComment];
        }
        return prev;
      });
    };

    const onNewAnnotation = (newAnnotation) => {
      setAnnotations((prev) => {
        if (!prev.some((a) => a._id === newAnnotation._id)) {
          return [...prev, newAnnotation];
        }
        return prev;
      });
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("new-comment", onNewComment);
    socket.on("new-annotation", onNewAnnotation);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("new-comment", onNewComment);
      socket.off("new-annotation", onNewAnnotation);
      socket.emit("leave-media", item.id);
      if (socket.connected) socket.disconnect();
    };
  }, [item.id]);

  // --- Video Player Effects ---
  useEffect(() => {
    const video = videoRef.current;
    if (!video || item.type !== "video") return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      if (video) {
        video.removeEventListener("timeupdate", handleTimeUpdate);
      }
    };
  }, [item.type]);

  // --- Event Handlers ---
  const handleAddComment = async () => {
    if (!comment.trim() || !canWrite) return;

    const tempId = `temp-${Date.now()}`;
    const newCommentPayload = {
      media_id: item.id,
      user_id: currentUser?.id || "anonymous",
      username: currentUser?.username || "Anonymous",
      text: comment.trim(),
    };

    setComments((prev) => [
      ...prev,
      {
        ...newCommentPayload,
        _id: tempId,
        createdAt: new Date().toISOString(),
      },
    ]);
    setComment("");

    setTimeout(() => {
      if (commentsContainerRef.current) {
        commentsContainerRef.current.scrollTop =
          commentsContainerRef.current.scrollHeight;
      }
    }, 100);

    try {
      const response = await API.post("/comments", newCommentPayload);
      const savedComment = response.data;
      setComments((prev) =>
        prev.map((c) => (c._id === tempId ? savedComment : c))
      );
      socket.emit("new-comment", { mediaId: item.id, comment: savedComment });
    } catch (err) {
      console.error("Error posting comment:", err);
      setComments((prev) => prev.filter((c) => c._id !== tempId));
    }
  };

  const handleMediaClick = (e) => {
    if (!isAnnotating || !canWrite) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = parseFloat(
      (((e.clientX - rect.left) / rect.width) * 100).toFixed(2)
    );
    const y = parseFloat(
      (((e.clientY - rect.top) / rect.height) * 100).toFixed(2)
    );

    setPendingAnnotation({
      coordinates: { x, y },
      timestamp: item.type === "video" ? currentTime : undefined,
    });
  };

  const handleAddAnnotation = async () => {
    if (!annotationText.trim() || !pendingAnnotation || !canWrite) return;

    const tempId = `temp-${Date.now()}`;
    const newAnnotationPayload = {
      media_id: item.id,
      user_id: currentUser?.id || "anonymous",
      username: currentUser?.username || "Anonymous",
      text: annotationText.trim(),
      ...pendingAnnotation,
    };

    setAnnotations((prev) => [
      ...prev,
      {
        ...newAnnotationPayload,
        _id: tempId,
        createdAt: new Date().toISOString(),
      },
    ]);
    setAnnotationText("");
    setPendingAnnotation(null);
    setIsAnnotating(false);

    try {
      const response = await API.post("/annotations", newAnnotationPayload);
      const savedAnnotation = response.data;
      setAnnotations((prev) =>
        prev.map((a) => (a._id === tempId ? savedAnnotation : a))
      );
      socket.emit("new-annotation", {
        mediaId: item.id,
        annotation: savedAnnotation,
      });
    } catch (err) {
      console.error("Error creating annotation:", err);
      setAnnotations((prev) => prev.filter((a) => a._id !== tempId));
    }
  };

  const seekToTimestamp = (timestamp) => {
    if (videoRef.current && timestamp !== undefined) {
      videoRef.current.currentTime = timestamp;
      videoRef.current.play();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-xl flex z-50">
  {/* Main Content */}
  <div className="flex-1 flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between p-4 bg-white/[0.02] backdrop-blur-3xl border-b border-white/10 shadow-2xl">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gradient-to-br from-white/20 to-white/5 rounded-xl flex items-center justify-center text-white font-bold border border-white/10 shadow-2xl">
          {(currentUser?.username || item.shared_by_username || 'A')[0].toUpperCase()}
        </div>
        <div>
          <h2 className="text-white font-bold text-lg tracking-wide">{item.title}</h2>
          {isSharedMedia ? (
            <p className="text-white/60 text-sm">
              Shared by {item.shared_by_username} • {item.organization_name}
            </p>
          ) : (
            <p className="text-white/60 text-sm">
              by {currentUser?.username || item.shared_by_username || 'Anonymous'} • {formatTimeAgo(item.createdAt || new Date())}
            </p>
          )}
        </div>
        {isSharedMedia && permissionLevel && (
          <div className="flex items-center space-x-2 bg-black/50 px-3 py-1 rounded-full">
            <div className={`w-2 h-2 rounded-full ${permissionLevel === 'reviewer' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
            <span className="text-white text-sm font-medium">
              {permissionLevel === 'reviewer' ? 'Review mode' : 'View mode'}
            </span>
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="w-10 h-10 bg-white/5 hover:bg-white/10 backdrop-blur-3xl rounded-xl flex items-center justify-center text-white transition-all border border-white/10 hover:border-white/20 shadow-2xl"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    {/* Media Display */}
    <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-black via-gray-900 to-black">
      <div className="relative max-w-full max-h-[70vh]">
        {item.type === 'image' ? (
          <img
            src={src}
            alt={item.title}
            className={`max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl border border-white/10 ${isAnnotating ? 'cursor-crosshair' : 'cursor-default'}`}
            onClick={handleMediaClick}
          />
        ) : (
          <video
            ref={videoRef}
            src={src}
            controls
            className={`max-w-full max-h-[70vh] object-contain rounded-2xl shadow-2xl border border-white/10 ${isAnnotating ? 'cursor-crosshair' : ''}`}
            onClick={handleMediaClick}
          />
        )}
        {/* Annotations Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          {annotations.map((ann) => (
            <div
              key={ann._id}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
              style={{
                left: `${ann.coordinates.x}%`,
                top: `${ann.coordinates.y}%`,
              }}
              onClick={() => item.type === 'video' && ann.timestamp !== undefined && seekToTimestamp(ann.timestamp)}
            >
              <div className="w-4 h-4 bg-white border-2 border-black rounded-full shadow-2xl group-hover:scale-150 transition-transform"></div>
              <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-black/90 backdrop-blur-xl text-white px-4 py-2 rounded-xl text-xs max-w-[200px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity border border-white/20 shadow-2xl">
                <div className="font-semibold">{ann.username}</div>
                <div>{ann.text}</div>
                {ann.timestamp !== undefined && (
                  <div className="text-gray-300 text-xs mt-1">{formatTime(ann.timestamp)}</div>
                )}
              </div>
            </div>
          ))}
          {pendingAnnotation && (
            <div
              className="absolute transform -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${pendingAnnotation.coordinates.x}%`,
                top: `${pendingAnnotation.coordinates.y}%`,
              }}
            >
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white animate-pulse"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>

  {/* Sidebar */}
  <div className="w-full sm:w-96 bg-white/[0.02] backdrop-blur-3xl border-l border-white/10 flex flex-col shadow-2xl">
    {/* Tab Navigation */}
    <div className="flex border-b border-white/10">
      <button
        onClick={() => setActiveTab('comments')}
        className={`relative flex-1 py-4 px-4 font-bold text-sm transition-all tracking-wider group ${
          activeTab === 'comments' ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
        }`}
      >
        <span className="relative inline-block">
          COMMENTS
          <span
            className={` bg-white transition-all duration-300 ease-out transform -translate-x-1/2 ${
              activeTab === 'comments' ? 'w-full' : 'group-hover:w-full'
            }`}
          ></span>
        </span>
      </button>
      <button
        onClick={() => setActiveTab('annotations')}
        className={`relative flex-1 py-4 px-4 font-bold text-sm transition-all tracking-wider group ${
          activeTab === 'annotations' ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
        }`}
      >
        <span className="relative inline-block">
          ANNOTATIONS
          <span
            className={`bg-white transition-all duration-300 ease-out transform -translate-x-1/2 ${
              activeTab === 'annotations' ? 'w-full' : 'group-hover:w-full'
            }`}
          ></span>
        </span>
      </button>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-hidden flex flex-col">
      {activeTab === 'comments' ? (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {comments.length === 0 ? (
              <div className="text-center py-12 text-white/60">
                <p className="text-sm font-semibold tracking-wider">NO COMMENTS YET</p>
                {canWrite && <p className="text-xs mt-2">Add your thoughts below</p>}
              </div>
            ) : (
              comments.map((commentItem) => (
                <div
                  key={commentItem._id}
                  className="bg-white/[0.02] backdrop-blur-3xl rounded-2xl p-4 border border-white/10 shadow-xl"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-white text-sm font-bold border border-white/10 shadow-lg">
                      {(commentItem.username || 'A')[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-white text-sm tracking-wide">{commentItem.username}</span>
                        <span className="text-xs text-white/50 font-semibold">{formatTimeAgo(commentItem.createdAt)}</span>
                      </div>
                      <p className="text-white/90 text-sm leading-relaxed">{commentItem.text}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {canWrite ? (
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add your comment..."
                  className="flex-1 px-4 py-2 bg-white/[0.03] backdrop-blur-3xl border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all shadow-xl text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                />
                <button
                  onClick={handleAddComment}
                  disabled={!comment.trim()}
                  className="relative px-4 py-2 bg-transparent text-white rounded-xl text-sm font-bold transition-all group disabled:text-white/50"
                >
                  <span className="relative inline-block">
                    SEND
                    <span
                      className={`bg-white transition-all duration-300 ease-out transform -translate-x-1/2 ${
                        !comment.trim() ? '' : 'group-hover:w-full'
                      }`}
                    ></span>
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 border-t border-white/10 text-center">
              <p className="text-white/60 text-xs font-semibold">You don't have permission to comment</p>
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {canWrite && (
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => {
                  setIsAnnotating(!isAnnotating);
                  setPendingAnnotation(null);
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-base font-bold transition-all ${
                  isAnnotating ? 'bg-blue-600' : 'bg-white/10 hover:bg-white/20 border border-white/10'
                }`}
              >
                {isAnnotating ? '×' : '+'}
              </button>
              <span className="text-white/60 text-sm font-semibold">Add new annotation</span>
            </div>
          )}
          {pendingAnnotation && (
            <div className="bg-white/[0.02] backdrop-blur-3xl rounded-2xl p-4 border border-white/10 shadow-xl">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={annotationText}
                  onChange={(e) => setAnnotationText(e.target.value)}
                  placeholder="Add annotation text..."
                  className="flex-1 px-4 py-2 bg-white/[0.03] backdrop-blur-3xl border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all shadow-xl text-sm"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddAnnotation()}
                  autoFocus
                />
                <button
                  onClick={handleAddAnnotation}
                  disabled={!annotationText.trim()}
                  className="relative px-4 py-2 bg-transparent text-white rounded-xl text-sm font-bold transition-all group disabled:text-white/50"
                >
                  <span className="relative inline-block">
                    ADD
                    <span
                      className={`absolute bottom-[-2px] left-1/2 w-0 h-[1px] bg-white transition-all duration-300 ease-out transform -translate-x-1/2 ${
                        !annotationText.trim() ? '' : 'group-hover:w-full'
                      }`}
                    ></span>
                  </span>
                </button>
              </div>
            </div>
          )}
          {annotations.length === 0 ? (
            <div className="text-center py-12 text-white/60">
              <p className="text-sm font-semibold tracking-wider">NO ANNOTATIONS YET</p>
              {canWrite && <p className="text-xs mt-2">Click "+" to add annotations</p>}
            </div>
          ) : (
            annotations.map((ann) => (
              <div
                key={ann._id}
                className="bg-white/[0.02] backdrop-blur-3xl rounded-2xl p-4 border border-white/10 shadow-xl hover:bg-white/[0.05] cursor-pointer"
                onClick={() => item.type === 'video' && ann.timestamp !== undefined && seekToTimestamp(ann.timestamp)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-white text-sm font-bold border border-white/10 shadow-lg">
                    {(ann.username || 'A')[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-bold text-white text-sm tracking-wide">{ann.username}</span>
                      <span className="text-xs text-white/50 font-semibold">{formatTimeAgo(ann.createdAt)}</span>
                    </div>
                    <p className="text-white/90 text-sm leading-relaxed">{ann.text}</p>
                    {ann.timestamp !== undefined && (
                      <p className="text-xs text-white/70 mt-2 font-semibold">⏱ Time Stamp : {formatTime(ann.timestamp)}</p>
                    )}
                    
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  </div>
</div>
  );
}
