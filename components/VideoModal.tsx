import { X } from "lucide-react";
import { useEffect } from "react";

// Universal YouTube ID extractor
function getYouTubeId(url: string): string | null {
  try {
    const regex =
      /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Vimeo extractor
function getVimeoId(url: string): string | null {
  try {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export const VideoModal: React.FC<{
  onClose: () => void;
  videoUrl: string;
}> = ({ onClose, videoUrl }) => {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const ytId = getYouTubeId(videoUrl);
  const vimeoId = getVimeoId(videoUrl);

  let embedUrl: string | null = null;
  let embedType: "youtube" | "vimeo" | "mp4" | "other" = "other";

  if (ytId) {
    embedUrl = `https://www.youtube.com/embed/${ytId}?autoplay=1`;
    embedType = "youtube";
  } else if (vimeoId) {
    embedUrl = `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
    embedType = "vimeo";
  } else if (videoUrl.endsWith(".mp4")) {
    embedType = "mp4";
    embedUrl = videoUrl;
  } else {
    embedType = "other";
    embedUrl = videoUrl;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      {/* Video Container */}
      <div className="relative z-10">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close video"
          className="absolute top-2 right-2 text-white p-2"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Responsive 16:9 container */}
        <div
          style={{
            width: "90vw",
            maxWidth: "800px",
            aspectRatio: "16/9",
            background: "#222",
            borderRadius: "12px",
          }}
        >
          {embedType === "youtube" || embedType === "vimeo" || embedType === "other" ? (
            <iframe
              src={embedUrl!}
              title="Product Video"
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="w-full h-full rounded-lg"
              style={{ minHeight: 300 }}
            />
          ) : embedType === "mp4" ? (
            <video
              src={embedUrl!}
              controls
              autoPlay
              className="w-full h-full rounded-lg bg-black"
              style={{ objectFit: "cover", minHeight: 300 }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              Video could not be loaded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
