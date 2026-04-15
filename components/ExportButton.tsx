"use client";

import { useState } from "react";

type Props = {
  targetRef: React.RefObject<HTMLDivElement>;
  filename: string;
  compact?: boolean;
  label?: string;
  title?: string;
};

export default function ExportButton({
  targetRef,
  filename,
  compact,
  label,
  title,
}: Props) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (!targetRef.current) return;
    setBusy(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(targetRef.current, {
        cacheBust: true,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `${filename}-${new Date().toISOString().split("T")[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      alert("PNG export failed. Try a smaller view.");
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handle();
        }}
        disabled={busy}
        title={title ?? "Export PNG"}
        className="text-xs px-1.5 py-0.5 rounded hover:bg-slate-200 disabled:opacity-50"
      >
        {busy ? "…" : (label ?? "PNG")}
      </button>
    );
  }

  return (
    <button
      className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
      onClick={handle}
      disabled={busy}
      title={title}
    >
      {busy ? "Exporting…" : (label ?? "Export PNG")}
    </button>
  );
}
