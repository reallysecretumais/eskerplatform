"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check } from "lucide-react";
import { Avatar } from "@/components/account/Avatar";
import { AvatarCropper } from "@/components/account/AvatarCropper";
import { updateAvatar, removeAvatar, type ActionResult } from "@/app/account/actions";

// Profile-picture control: pick a photo → circular crop/zoom → upload. Falls back
// to uploading the original if the browser can't decode the image (e.g. HEIC).
export function AvatarUpload({ name, src }: { name: string | null; src: string | null }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const pendingFile = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  function pick(file: File | null) {
    if (!file) return;
    pendingFile.current = file;
    setCropSrc(URL.createObjectURL(file));
  }

  function closeCropper() {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    pendingFile.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }

  function upload(file: File) {
    const fd = new FormData();
    fd.append("avatar", file);
    start(async () => {
      const res = await updateAvatar(null, fd);
      setMsg(res);
      if (res.ok) router.refresh();
    });
  }

  function onCropSave(blob: Blob) {
    upload(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
    closeCropper();
  }
  function onUnsupported() {
    // Couldn't decode for cropping (e.g. HEIC) — upload the original as-is.
    if (pendingFile.current) upload(pendingFile.current);
    closeCropper();
  }

  function remove() {
    start(async () => {
      const res = await removeAvatar();
      setMsg(res);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-5 rounded-2xl border border-line bg-surface p-6">
      <button type="button" onClick={() => inputRef.current?.click()} className="group relative shrink-0" title="Change photo" disabled={pending}>
        <Avatar name={name} src={src} size={72} className={pending ? "opacity-60" : ""} />
        <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-ink text-bg transition group-hover:scale-105">
          <Camera size={14} />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        onChange={(e) => pick(e.currentTarget.files?.[0] ?? null)}
      />

      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">Profile picture</div>
        <div className="mt-0.5 text-xs text-dim">JPG, PNG or WebP · up to 5 MB.</div>
        <div className="mt-2 flex items-center gap-3 text-xs">
          {pending && <span className="text-dim">Saving…</span>}
          {!pending && msg?.ok && (
            <span className="inline-flex items-center gap-1 text-green">
              <Check size={13} /> {msg.message}
            </span>
          )}
          {!pending && msg && !msg.ok && <span className="text-red">{msg.message}</span>}
          {src && !pending && (
            <button type="button" onClick={remove} className="text-muted transition hover:text-ink">
              Remove
            </button>
          )}
        </div>
      </div>

      {cropSrc && <AvatarCropper src={cropSrc} onSave={onCropSave} onCancel={closeCropper} onUnsupported={onUnsupported} />}
    </div>
  );
}
