import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { 
  X, Film as FilmIcon, MapPin, 
  Train as TrainIcon, Trash2, CheckCircle2
} from "lucide-react";
import { useUploadStore } from "../../../store/uploadStore";

interface CreateReelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateReelModal({ isOpen, onClose }: CreateReelModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [trainNo, setTrainNo] = useState("");
  const [stationCode, setStationCode] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    
    // Size limit bumped for HD Rail videos!
    if (selected.size > 500 * 1024 * 1024) {
      setFileError("File is too large! Maximum allowed size is 500MB.");
      return;
    }
    setFileError("");
    
    setFile(selected);
    const newPreview = URL.createObjectURL(selected);
    setPreview(newPreview);
  };

  const removeFile = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  };

  const { addUpload } = useUploadStore();

  const handlePublish = () => {
    if (!file) return;

    addUpload({
       id: crypto.randomUUID(),
       type: "reel",
       status: "preparing",
       progress: 0,
       title: title || "New Reel",
       file: file,
       payload: {
          title: title || "Untitled Reel",
          description: description,
          train_number: trainNo || undefined,
          station_tag: stationCode || undefined,
          is_public: true
       }
    });

    onClose();
    resetForm();
  };

  const resetForm = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setTitle("");
    setDescription("");
    setTrainNo("");
    setStationCode("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/95 backdrop-blur-md"
      />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800/80 rounded-t-[32px] sm:rounded-[32px] shadow-2xl shadow-orange-500/10 flex flex-col max-h-[92vh] sm:max-h-[90vh]"
      >
        <div className="flex flex-col md:flex-row overflow-y-auto md:overflow-hidden md:h-[600px] flex-1">
          {/* Media Preview Player */}
          <div className="md:flex-1 bg-black flex flex-col items-center justify-center relative border-r border-zinc-800/80">
            {preview ? (
              <div className="w-full h-full relative overflow-hidden bg-zinc-950 flex items-center justify-center group">
                 <video 
                   src={preview} 
                   autoPlay 
                   loop 
                   muted 
                   className="h-full w-full object-contain"
                 />
                 
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />

                 <button 
                  onClick={removeFile}
                  className="absolute top-6 left-6 p-3 rounded-full bg-black/50 text-red-500 border border-red-500/30 shadow-2xl hover:bg-red-500 hover:text-white transition-all backdrop-blur-xl opacity-0 group-hover:opacity-100"
                 >
                    <Trash2 size={20} />
                 </button>
                 
                 <div className="absolute bottom-6 left-6">
                    <div className="flex items-center gap-2 px-4 py-2 bg-black/60 rounded-full border border-white/10 backdrop-blur-xl">
                       <FilmIcon size={14} className="text-orange-400" />
                       <span className="text-xs font-bold text-white uppercase tracking-widest">{file?.name}</span>
                    </div>
                 </div>
              </div>
            ) : (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-full flex flex-col items-center justify-center gap-6 hover:bg-zinc-900/40 transition-colors group"
              >
                <div className="w-24 h-24 rounded-[2rem] bg-zinc-900 flex items-center justify-center border-2 border-dashed border-zinc-800 group-hover:border-orange-500/50 group-hover:scale-105 transition-all duration-300">
                  <FilmIcon size={40} className="text-zinc-600 group-hover:text-orange-500 transition-colors" />
                </div>
                <div className="text-center space-y-2">
                   <p className="text-lg font-black uppercase tracking-widest text-zinc-300 group-hover:text-white transition-colors">Select Video Reel</p>
                   <p className="text-xs text-zinc-500 font-bold tracking-widest uppercase">MP4 or MOV • Up to 500MB HD</p>
                </div>
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="video/mp4,video/quicktime,video/webm" 
              onChange={handleFileChange} 
            />
          </div>

          {/* Form Parameters */}
          <div className="w-full md:w-[400px] bg-zinc-900 flex flex-col pt-8 pb-6 px-8 gap-8 border-t md:border-t-0 md:border-l border-zinc-800/80 md:overflow-y-auto">
            {fileError && (
              <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2 -mb-4">{fileError}</p>
            )}
            <div className="flex items-center justify-between">
               <h2 className="text-2xl font-black tracking-tight text-white">New Reel</h2>
               <button onClick={onClose} className="p-2 -mr-3 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all">
                 <X size={24} />
               </button>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">Reel Title</label>
                 <input 
                   type="text" 
                   placeholder="E.g. WAP-7 High Speed Action" 
                   value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   className="w-full bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800 focus:border-orange-500/50 text-sm focus:bg-zinc-900 transition-all outline-none text-white placeholder:text-zinc-600 font-medium"
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">Description</label>
                 <textarea 
                   placeholder="Share details about this run..." 
                   value={description}
                   onChange={(e) => setDescription(e.target.value)}
                   className="w-full h-32 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800 focus:border-orange-500/50 text-sm focus:bg-zinc-900 transition-all outline-none text-white placeholder:text-zinc-600 resize-none"
                 />
              </div>
              
              <div className="space-y-3">
                 <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-1">Metadata (Optional)</p>
                 <div className="flex items-center gap-3 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800 focus-within:border-orange-500/50 transition-colors">
                    <TrainIcon size={18} className="text-zinc-600" />
                    <input 
                      type="text" 
                      placeholder="TRAIN NO (e.g. 12951)" 
                      value={trainNo}
                      onChange={(e) => setTrainNo(e.target.value)}
                      className="bg-transparent text-xs font-black uppercase tracking-widest text-white outline-none w-full placeholder:text-zinc-700"
                    />
                 </div>
                 <div className="flex items-center gap-3 bg-zinc-950/50 p-4 rounded-2xl border border-zinc-800 focus-within:border-orange-500/50 transition-colors">
                    <MapPin size={18} className="text-zinc-600" />
                    <input 
                      type="text" 
                      placeholder="STATION CODE (e.g. NDLS)" 
                      value={stationCode}
                      onChange={(e) => setStationCode(e.target.value)}
                      className="bg-transparent text-xs font-black uppercase tracking-widest text-white outline-none w-full placeholder:text-zinc-700"
                    />
                 </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800/80">
              <button 
                onClick={handlePublish}
                disabled={!file}
                className="w-full py-4 rounded-2xl bg-orange-500 text-white font-black uppercase text-xs tracking-widest disabled:opacity-50 disabled:grayscale transition-all hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] active:scale-95 flex items-center justify-center gap-3"
              >
                 <CheckCircle2 size={18} />
                 Publish Reel
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
