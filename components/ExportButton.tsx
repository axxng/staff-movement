"use client";

import { useState } from "react";

type Props = {
  targetRef: React.RefObject<HTMLDivElement>;
  filename: string;
};

export default function ExportButton({ targetRef, filename }: Props) {
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

  return (
    <button
      className="px-3 py-1.5 text-sm rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50"
      onClick={handle}
      disabled={busy}
    >
      {busy ? "Exporting…" : "Export PNG"}
    </button>
  );
}
