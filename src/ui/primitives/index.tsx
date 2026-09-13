"use client";
import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { brand } from "../../config/brand.ts";
export function Brand({ compact = false }: { compact?: boolean }) { return <span className="brand"><span className="brand-mark"><Image src={brand.logo} width={92} height={92} alt="" priority /></span>{!compact && <span>{brand.productName}<span className="brand-dot">.</span></span>}</span>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "accent" | "warning" | "danger" }) { return <span className={`badge ${tone}`}>{children}</span>; }
export function Avatar({ name, small = false }: { name: string; small?: boolean }) { return <span className={`avatar ${small ? "small" : ""} avatar-${name.charCodeAt(0)%5}`}>{name.split(" ").map(n => n[0]).join("").slice(0,2)}</span>; }
export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) { return <div className="empty"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{children}</p></div>; }
export function Modal({ title, children, onClose, className = "" }: { title: string; children: ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-inner"><header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></header>{children}</div></dialog>;
}
