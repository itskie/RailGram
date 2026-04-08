import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader, CheckCircle2, AlertCircle, X } from "lucide-react";
import { useUploadStore } from "../store/uploadStore";
import type { UploadItem } from "../store/uploadStore";
import { media as mediaApi, posts as postsApi, reels as reelsApi } from "../lib/api";
import { useQueryClient } from "@tanstack/react-query";

/** Capture the first frame of a video file as a JPEG blob */
async function captureVideoFirstFrame(file: File): Promise<File | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.currentTime = 0.5; // seek to 0.5s to avoid black frame

    const cleanup = () => URL.revokeObjectURL(url);

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")!.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          cleanup();
          if (blob) resolve(new File([blob], "thumbnail.jpg", { type: "image/jpeg" }));
          else resolve(null);
        }, "image/jpeg", 0.85);
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => { cleanup(); resolve(null); };
    video.load();
  });
}

/**
 * Global component that manages background uploads.
 * It observes the uploadStore and executes the multi-step upload process.
 * Decouples the upload logic from the UI Modals.
 */
export default function UploadBackgroundManager() {
  const { uploads, updateUpload, removeUpload } = useUploadStore();
  const qc = useQueryClient();
  const processingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    Object.values(uploads).forEach((upload) => {
      if (upload.status === "preparing" && !processingIds.current.has(upload.id)) {
        processingIds.current.add(upload.id);
        startUploadTask(upload);
      }
    });
  }, [uploads]);

  const startUploadTask = async (upload: UploadItem) => {
    try {
      if (upload.type === "reel") {
        await handleReelUpload(upload);
      } else {
        await handlePostUpload(upload);
      }
      qc.invalidateQueries({ queryKey: ["unified_feed"] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["reels"] });
      qc.invalidateQueries({ queryKey: ["user-posts"] });
      qc.invalidateQueries({ queryKey: ["user-reels"] });
      
      // Keep completed state visible for 3 seconds
      setTimeout(() => {
        removeUpload(upload.id);
        processingIds.current.delete(upload.id);
      }, 3000);
    } catch (err: any) {
      updateUpload(upload.id, { 
        status: "failed", 
        error: err?.message || "Something went wrong" 
      });
      processingIds.current.delete(upload.id);
    }
  };

  const handleReelUpload = async (upload: UploadItem) => {
    const file = upload.file!;
    
    // 1. Get Upload URL
    updateUpload(upload.id, { status: "uploading", progress: 5 });
    const { s3_key, upload_url } = await reelsApi.uploadUrl(file.name, file.type, file.size);

    // 2. S3 PUT with Browser Progress (XHR)
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", upload_url);
      xhr.setRequestHeader("Content-Type", file.type);
      
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 90); // 0-90% for S3
          updateUpload(upload.id, { progress: pct });
        }
      };
      
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(true);
        else reject(new Error("Failed to upload to S3"));
      };
      
      xhr.onerror = () => reject(new Error("Network error during S3 upload"));
      xhr.send(file);
    });

    // 3. Upload thumbnail — custom or auto-captured first frame
    let thumbnailKey: string | undefined;
    const thumbFile = upload.thumbnailFile || await captureVideoFirstFrame(file);
    if (thumbFile) {
      const { key: thumbKey, upload_url: thumbUploadUrl } = await mediaApi.presign({
        filename: "thumbnail.jpg",
        content_type: "image/jpeg",
        purpose: "post"
      });
      await fetch(thumbUploadUrl, {
        method: "PUT",
        body: thumbFile,
        headers: { "Content-Type": "image/jpeg" }
      });
      thumbnailKey = thumbKey;
    }

    // 4. Create Metadata
    updateUpload(upload.id, { status: "processing", progress: 95 });
    await reelsApi.create({
      ...upload.payload,
      s3_key: s3_key,
      file_size_bytes: file.size,
      ...(thumbnailKey ? { thumbnail_key: thumbnailKey } : {}),
    });

    updateUpload(upload.id, { status: "completed", progress: 100 });
  };

  const handlePostUpload = async (upload: UploadItem) => {
    const files = upload.files || [];
    const mediaKeys: string[] = [];
    
    updateUpload(upload.id, { status: "uploading", progress: 0 });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const { key, upload_url } = await mediaApi.presign({
        filename: file.name,
        content_type: file.type,
        purpose: "post"
      });

      // Photo upload is usually fast, simple fetch is fine
      await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type }
      });

      mediaKeys.push(key);
      const stepPct = Math.round(((i + 1) / files.length) * 90);
      updateUpload(upload.id, { progress: stepPct });
    }

    updateUpload(upload.id, { status: "processing", progress: 95 });
    await postsApi.create({
      ...upload.payload,
      media_keys: mediaKeys,
    });

    updateUpload(upload.id, { status: "completed", progress: 100 });
  };

  const activeJobs = Object.values(uploads);
  if (activeJobs.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] pointer-events-none flex flex-col items-center p-4 gap-2">
      <AnimatePresence>
        {activeJobs.map((job) => (
          <motion.div
            key={job.id}
            initial={{ y: -50, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0, scale: 0.9 }}
            className="w-full max-w-sm bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden p-3 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500">
                  {job.status === "uploading" || job.status === "preparing" || job.status === "processing" ? (
                    <Loader className="animate-spin" size={16} />
                  ) : job.status === "completed" ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-white truncate max-w-[180px]">
                    {job.title}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-bold">
                    {job.status === "preparing" && "Starting journey..."}
                    {job.status === "uploading" && `Broadcasting... ${job.progress}%`}
                    {job.status === "processing" && "Arriving at the feed..."}
                    {job.status === "completed" && "Successfully shared!"}
                    {job.status === "failed" && (job.error || "Broadcast failed")}
                  </p>
                </div>
              </div>
              
              {job.status !== "uploading" && (
                 <button onClick={() => removeUpload(job.id)} className="text-zinc-600 hover:text-white transition-colors">
                    <X size={14} />
                 </button>
              )}
            </div>

            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                 className={`h-full ${job.status === "failed" ? 'bg-red-500' : job.status === 'completed' ? 'bg-green-500' : 'bg-orange-500'}`}
                 initial={{ width: 0 }}
                 animate={{ width: `${job.progress}%` }}
                 transition={{ type: "spring", stiffness: 50 }}
               />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
