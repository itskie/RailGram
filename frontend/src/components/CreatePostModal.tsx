import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Image as ImageIcon, MapPin, 
  Train as TrainIcon, Plus,
  Trash2, ChevronLeft, ChevronRight
} from "lucide-react";
import { useUploadStore } from "../store/uploadStore";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreatePostModal({ isOpen, onClose }: CreatePostModalProps) {
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
  const [currentIdx, setCurrentIdx] = useState(0);

  const [uploadError, setUploadError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setUploadError("");

    if (files.length + selected.length > 10) {
      setUploadError("Maximum 10 photos allowed.");
      return;
    }

    const oversized = selected.filter(f => f.size > 250 * 1024 * 1024);
    if (oversized.length > 0) {
      setUploadError("Each photo must be less than 250MB.");
      return;
    }

    const invalid = selected.filter(f => !f.type.startsWith("image/"));
    if (invalid.length > 0) {
      setUploadError("Only image files are allowed.");
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

  const { addUpload } = useUploadStore();

  const handleShare = () => {
    if (files.length === 0) return;
    
    addUpload({
       id: crypto.randomUUID(),
       type: "post",
       status: "preparing",
       progress: 0,
       title: caption || "New Post",
       files: files,
       payload: {
          caption,
          train_no: trainNo || undefined,
          station_code: stationCode || undefined,
          loco_class: locoClass || undefined,
          loco_number: locoNumber || undefined,
          loco_shed: locoShed || undefined,
          loco_zone: locoZone || undefined,
       }
    });

    onClose();
    resetForm();
  };

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
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
        className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <h2 className="text-lg font-black tracking-tight text-white">Create New Post</h2>
          <button onClick={onClose} className="p-2 -mr-2 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row overflow-y-auto md:overflow-hidden md:h-[500px] flex-1">
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
          <div className="w-full md:w-72 bg-zinc-900 border-t md:border-t-0 md:border-l border-zinc-800 flex flex-col p-6 gap-6 md:overflow-y-auto">
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
              {uploadError && (
                <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 mb-3">{uploadError}</p>
              )}
              <button
                onClick={handleShare}
                disabled={files.length === 0}
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-black uppercase text-xs tracking-widest disabled:opacity-50 disabled:grayscale transition-all hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] active:scale-95 flex items-center justify-center gap-2"
              >
                Share with Community
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
