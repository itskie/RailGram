import { useState, useRef } from 'react';
import { useS3Upload } from '../../features/reels/hooks/useS3Upload';
import { reels } from '../../lib/api';
import { UploadCloud, CheckCircle2, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ReelUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [trainNumber, setTrainNumber] = useState('');
  const [stationTag, setStationTag] = useState('');
  const isPublic = true;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const { uploadFile, progress, isUploading, error: s3Error } = useS3Upload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    
    // 1GB limit check client-side
    if (selected.size > 1024 * 1024 * 1024) {
      alert("File is too large! Maximum allowed size is 1GB.");
      return;
    }
    
    setFile(selected);
    const url = URL.createObjectURL(selected);
    setPreview(url);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    if (!title.trim()) {
      setErrorMsg("Title is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      // 1. Upload Video direct to S3 via hook (presigned PUT)
      const { s3_key } = await uploadFile(file);

      // 2. Extract dimensions/duration heuristically (we can let Lambda do it better, but sending defaults for now)
      // Usually you'd read a hidden <video> element to get true dimensions before upload.
      // S3 processing Lambda webhook handles missing dimensions anyways.

      // 3. Post reel metadata to Backend
      await reels.create({
        s3_key,
        title,
        description,
        train_number: trainNumber || undefined,
        station_tag: stationTag || undefined,
        is_public: isPublic,
        file_size_bytes: file.size,
      });

      // Navigate to feed and let user know it's processing
      alert("Successfully Uploaded! Processing will take a few minutes.");
      navigate('/reels');

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Upload failed due to network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-indigo-500 mb-6">
        New Reel
      </h1>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          {errorMsg}
        </div>
      )}
      {s3Error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          {s3Error}
        </div>
      )}

      <form onSubmit={handleFormSubmit} className="space-y-6">
        
        {/* File Uploader */}
        <div className="basis-full">
          {!preview ? (
            <label className="flex flex-col items-center justify-center w-full h-[300px] sm:h-[400px] border-2 border-dashed border-zinc-700 rounded-2xl cursor-pointer bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
              <UploadCloud className="w-10 h-10 text-zinc-400 mb-3" />
              <p className="mb-2 text-sm text-zinc-400">
                <span className="font-semibold text-teal-400">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-zinc-500 tracking-wide">MP4, WEBM or MOV (Max 1GB)</p>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="video/mp4,video/webm,video/quicktime,video/x-m4v" 
                className="hidden" 
                onChange={handleFileSelect} 
              />
            </label>
          ) : (
            <div className="relative w-full h-[300px] sm:h-[400px] rounded-2xl bg-black border border-zinc-800 overflow-hidden flex items-center justify-center group">
              <video src={preview} className="absolute inset-0 w-full h-full object-contain" muted loop autoPlay />
              <button 
                type="button" 
                onClick={() => { setFile(null); setPreview(null); }}
                className="absolute top-3 right-3 p-2 bg-black/60 rounded-full text-white backdrop-blur hover:bg-black/80"
              >
                <X className="w-5 h-5" />
              </button>
              
              {/* Progress Overlay */}
              {isUploading && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm z-10 transition-opacity">
                  <span className="text-white text-3xl font-bold mb-4">{progress}%</span>
                  <div className="w-2/3 max-w-[200px] h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-teal-500 duration-150 ease-out transition-[width]" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Title *</label>
            <input 
              maxLength={100}
              required
              placeholder="Amazing fast WAP-7 crossing..."
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">Description (Optional)</label>
            <textarea 
              rows={3}
              placeholder="More details about the route, loco type, or weather..."
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 transition-colors resize-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Train Number</label>
              <input 
                maxLength={10}
                placeholder="e.g. 12424"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
                value={trainNumber}
                onChange={(e) => setTrainNumber(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">Station Tag</label>
              <input 
                placeholder="e.g. NDLS / New Delhi"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 transition-colors"
                value={stationTag}
                onChange={(e) => setStationTag(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!file || !title || isSubmitting}
          className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl flex items-center justify-center gap-2 disabled:bg-zinc-800 disabled:text-zinc-500 transition-colors"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {progress < 100 ? `Uploading ${progress}%` : "Processing..."}
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              Post Reel
            </>
          )}
        </button>

      </form>
    </div>
  );
}
