import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Image as ImageIcon, MapPin, 
  Train as TrainIcon, Loader, Plus,
  Trash2, ChevronLeft, ChevronRight
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { posts as postsApi, media as mediaApi } from "../lib/api";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreatePostModal({ isOpen, onClose }: CreatePostModalProps) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [trainNo, setTrainNo] = useState("");
  const [stationCode, setStationCode] = useState("");
  const [locoClass, setLocoClass] = useState("");
  const [locoNumber, setLocoNumber] = useState("");
  const [locoShed, setLocoShed] = useState("");
  const [locoZone, setLocoZone] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (files.length + selected.length > 10) {
      alert("Maximum 10 photos allowed");
      return;
    }
    
    setFiles([...files, ...selected]);
    const newPreviews = selected.map(f => URL.createObjectURL(f));
    setPreviews([...previews, ...newPreviews]);
    if (previews.length === 0) setCurrentIdx(0);
  };

  const removeFile = (idx: number) => {
    URL.revokeObjectURL(previews[idx]);
    const newFiles = files.filter((_, i) => i !== idx);
    const newPreviews = previews.filter((_, i) => i !== idx);
    setFiles(newFiles);
    setPreviews(newPreviews);
    if (currentIdx >= newFiles.length) setCurrentIdx(Math.max(0, newFiles.length - 1));
  };

  const createMut = useMutation({
    mutationFn: async () => {
      setIsUploading(true);
      try {
        const mediaKeys: string[] = [];
        
        // 1. Batch upload to S3
        for (const file of files) {
          const { key, upload_url } = await mediaApi.presign({
            filename: file.name,
            content_type: file.type,
            purpose: "post"
          });
          
          await fetch(upload_url, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type }
          });
          
          mediaKeys.push(key);
        }

        // 2. Create post on backend
        return await postsApi.create({
          post_type: (locoClass || locoNumber) ? "loco_spot" : "photo",
          caption,
          media_keys: mediaKeys,
          train_no: trainNo || undefined,
          station_code: stationCode || undefined,
          loco_class: locoClass || undefined,
          loco_number: locoNumber || undefined,
          loco_shed: locoShed || undefined,
          loco_zone: locoZone || undefined,
        } as any);
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feed"] });
      onClose();
      resetForm();
    }
  });

  const resetForm = () => {
    setFiles([]);
    previews.forEach(p => URL.revokeObjectURL(p));
    setPreviews([]);
    setCaption("");
    setTrainNo("");
    setStationCode("");
    setLocoClass("");
    setLocoNumber("");
    setLocoShed("");
    setLocoZone("");
    setCurrentIdx(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <h2 className="text-lg font-black tracking-tight text-white">Create New Post</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-[500px]">
          {/* Media Preview Area */}
          <div className="flex-1 bg-black flex flex-col items-center justify-center relative group">
            {previews.length > 0 ? (
              <div className="w-full h-full relative overflow-hidden">
                 <AnimatePresence mode="wait">
                    <motion.img 
                      key={previews[currentIdx]}
                      src={previews[currentIdx]} 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="w-full h-full object-cover" 
                    />
                 </AnimatePresence>

                 {/* Remove Button */}
                 <button 
                  onClick={() => removeFile(currentIdx)}
                  className="absolute top-4 left-4 p-2.5 rounded-2xl bg-black/60 text-red-500 border border-red-500/20 shadow-xl hover:bg-red-500 hover:text-white transition-all backdrop-blur-md"
                 >
                    <Trash2 size={16} />
                 </button>

                 {/* Nav Buttons */}
                 {previews.length > 1 && (
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                      <button 
                        onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                        disabled={currentIdx === 0}
                        className="p-2 rounded-full bg-black/60 text-white border border-white/10 pointer-events-auto disabled:opacity-0 transition-opacity"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button 
                        onClick={() => setCurrentIdx(prev => Math.min(previews.length - 1, prev + 1))}
                        disabled={currentIdx === previews.length - 1}
                        className="p-2 rounded-full bg-black/60 text-white border border-white/10 pointer-events-auto disabled:opacity-0 transition-opacity"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                 )}

                 <div className="absolute bottom-4 left-4 flex items-center gap-2">
                    <p className="text-[10px] font-black uppercase text-white/90 bg-black/60 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                       {currentIdx + 1} / {files.length} Photos
                    </p>
                 </div>

                 <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-4 right-4 p-3 rounded-2xl bg-orange-500 text-white shadow-xl hover:scale-105 transition-transform"
                 >
                    <Plus size={20} />
                 </button>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-4 text-zinc-600 hover:text-orange-500 transition-colors"
              >
                <div className="w-20 h-20 rounded-3xl bg-zinc-900 flex items-center justify-center border-2 border-dashed border-zinc-800">
                  <ImageIcon size={32} />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest">Select Rail Photos</p>
                <p className="text-[10px] text-zinc-700 font-black tracking-tight uppercase">High-res JPEG/PNG up to 10 photos</p>
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              multiple 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>

          {/* Form Side */}
          <div className="w-full md:w-72 bg-zinc-900 border-l border-zinc-800 flex flex-col p-6 gap-6">
            <div className="space-y-4">
              <textarea 
                placeholder="Caption your journey..." 
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full h-32 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 resize-none outline-none"
              />
              
              <div className="space-y-3">
                 <div className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800 focus-within:border-orange-500/50 transition-colors">
                    <TrainIcon size={16} className="text-zinc-600" />
                    <input 
                      type="text" 
                      placeholder="TRAIN NO (e.g. 12102)" 
                      value={trainNo}
                      onChange={(e) => setTrainNo(e.target.value)}
                      className="bg-transparent text-[10px] font-black uppercase tracking-tight text-white outline-none w-full"
                    />
                 </div>
                 <div className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800 focus-within:border-orange-500/50 transition-colors">
                    <MapPin size={16} className="text-zinc-600" />
                    <input 
                      type="text" 
                      placeholder="STATION CODE (e.g. NDLS)" 
                      value={stationCode}
                      onChange={(e) => setStationCode(e.target.value)}
                      className="bg-transparent text-[10px] font-black uppercase tracking-tight text-white outline-none w-full"
                    />
                 </div>

                 <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-1 pt-2">Locomotive Specs (Optional)</p>
                 <div className="grid grid-cols-2 gap-2">
                    <div className="bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800 focus-within:border-orange-500/50 transition-colors">
                       <input 
                        type="text" 
                        placeholder="CLASS" 
                        value={locoClass}
                        onChange={(e) => setLocoClass(e.target.value.toUpperCase())}
                        className="bg-transparent text-[10px] font-black uppercase tracking-tight text-white outline-none w-full"
                       />
                    </div>
                    <div className="bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800 focus-within:border-orange-500/50 transition-colors">
                       <input 
                        type="text" 
                        placeholder="ROAD NO" 
                        value={locoNumber}
                        onChange={(e) => setLocoNumber(e.target.value)}
                        className="bg-transparent text-[10px] font-black uppercase tracking-tight text-white outline-none w-full"
                       />
                    </div>
                    <div className="bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800 focus-within:border-orange-500/50 transition-colors">
                       <input 
                        type="text" 
                        placeholder="SHED" 
                        value={locoShed}
                        onChange={(e) => setLocoShed(e.target.value.toUpperCase())}
                        className="bg-transparent text-[10px] font-black uppercase tracking-tight text-white outline-none w-full"
                       />
                    </div>
                    <div className="bg-zinc-950/50 p-3 rounded-2xl border border-zinc-800 focus-within:border-orange-500/50 transition-colors">
                       <input 
                        type="text" 
                        placeholder="ZONE" 
                        value={locoZone}
                        onChange={(e) => setLocoZone(e.target.value.toUpperCase())}
                        className="bg-transparent text-[10px] font-black uppercase tracking-tight text-white outline-none w-full"
                       />
                    </div>
                 </div>
              </div>
            </div>

            <div className="mt-auto">
              <button 
                onClick={() => createMut.mutate()}
                disabled={files.length === 0 || isUploading}
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-black uppercase text-xs tracking-widest disabled:opacity-50 disabled:grayscale transition-all hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] active:scale-95 flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Share with Community"
                )}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
