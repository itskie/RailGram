import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { users as usersApi, media as mediaApi, auth as authApi } from "../lib/api";
import { useAuthStore } from "../store/authStore";
import { ArrowLeft, Camera, Loader2, Save, User as UserIcon, Lock, Trash2 } from "lucide-react";

export default function EditProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user: me, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(me?.display_name || "");
  const [bio, setBio] = useState(me?.bio || "");
  const [favouriteTrain, setFavouriteTrain] = useState(me?.favourite_train || "");
  const [homeStation, setHomeStation] = useState(me?.home_station || "");
  const [avatarUrl, setAvatarUrl] = useState(me?.avatar_url || "");
  const [isPrivate, setIsPrivate] = useState(me?.is_private || false);
  
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Update local state if user store changes
  useEffect(() => {
    if (me) {
      setDisplayName(me.display_name || "");
      setBio(me.bio || "");
      setFavouriteTrain(me.favourite_train || "");
      setHomeStation(me.home_station || "");
      setAvatarUrl(me.avatar_url || "");
      setIsPrivate(me.is_private || false);
    }
  }, [me]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => usersApi.updateProfile(data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser as any);
      qc.invalidateQueries({ queryKey: ["profile", me?.username] });
      navigate(`/profile/${me?.username}`);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to update profile");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => authApi.deleteAccount(),
    onSuccess: () => {
      if (window.confirm('Account deleted. Click OK to logout.')) {
        logout();
        navigate('/');
      }
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to delete account");
    }
  });

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      if (window.confirm('Final warning: All your posts, reels, and data will be permanently deleted.')) {
        deleteMutation.mutate();
      }
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Avatar image must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      // 1. Get Presigned URL
      const { upload_url, cdn_url } = await mediaApi.presign({
        filename: file.name,
        content_type: file.type,
        purpose: "avatar"
      });

      // 2. Upload to S3
      await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type }
      });

      // 3. Update local preview
      setAvatarUrl(cdn_url);
    } catch (err: any) {
      alert("Failed to upload avatar");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      display_name: displayName,
      bio: bio,
      favourite_train: favouriteTrain,
      home_station: homeStation,
      avatar_url: avatarUrl,
      is_private: isPrivate,
    });
  };

  if (!me) return null;

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
      >
        <ArrowLeft size={16} /> Cancel
      </button>

      <h1 className="text-2xl font-bold text-white mb-8">Edit Profile</h1>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Avatar Section */}
        <div className="flex flex-col items-center">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-zinc-800 border-2 border-zinc-700 overflow-hidden shadow-xl ring-offset-4 ring-offset-black transition-all group-hover:ring-2 ring-teal-500">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500">
                  <UserIcon size={40} />
                </div>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-teal-600 rounded-full text-white shadow-lg border-2 border-black hover:bg-teal-500 transition-all hover:scale-110"
              disabled={isUploading}
            >
              <Camera size={16} />
            </button>
          </div>
          <p className="text-xs text-zinc-500 mt-3 font-medium">Recommended: Square image, max 5MB</p>
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handleAvatarChange} 
          />
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Display Name</label>
            <input 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-teal-500 transition-all focus:ring-1 ring-teal-500/20"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1">Bio</label>
            <textarea 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell follow railfans about yourself..."
              rows={3}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-teal-500 transition-all focus:ring-1 ring-teal-500/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 text-teal-500">Favourite Train 🚂</label>
              <input
                value={favouriteTrain}
                onChange={(e) => setFavouriteTrain(e.target.value)}
                placeholder="e.g. Rajdhani"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-teal-500 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider ml-1 text-teal-500">Home Station 🚉</label>
              <input
                value={homeStation}
                onChange={(e) => setHomeStation(e.target.value)}
                placeholder="e.g. NDLS"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-teal-500 transition-all"
              />
            </div>
          </div>

          {/* Private Account Toggle */}
          <div className="flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                <Lock size={18} className="text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-100">Private Account</p>
                <p className="text-xs text-zinc-500">Only followers can see your posts</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                isPrivate ? "bg-orange-500" : "bg-zinc-700"
              }`}
            >
              <div
                className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  isPrivate ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={updateMutation.isPending || isUploading}
          className="w-full py-4 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-lg shadow-teal-900/10 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:bg-zinc-800 disabled:text-zinc-600"
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save size={18} />
              Save Changes
            </>
          )}
        </button>

        {/* Delete Account Section */}
        <div className="pt-6 border-t border-zinc-800">
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={deleteMutation.isPending}
            className="w-full py-4 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs tracking-widest disabled:opacity-50 transition-all border border-red-500/20 flex items-center justify-center gap-2"
          >
            {deleteMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Trash2 size={18} />
                Delete Account
              </>
            )}
          </button>
          <p className="text-[10px] text-zinc-600 text-center mt-2">
            This will permanently delete all your data
          </p>
        </div>
      </form>
    </div>
  );
}
