import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function ArrowUpRight({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="M7 17 17 7M7 7h10v10" /></svg>;
}

export function ChevronRight({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="m9 18 6-6-6-6" /></svg>;
}

export function ChevronDown({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="m6 9 6 6 6-6" /></svg>;
}

export function Check({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="m5 12 4 4L19 6" /></svg>;
}

export function X({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

export function AlertTriangle({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="M10.3 3.7 2.4 17.5A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.5L13.7 3.7a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>;
}

export function Activity({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="M3 12h4l2.5-7 5 14 2.5-7h4" /></svg>;
}

export function Database({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></svg>;
}

export function Layers({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></svg>;
}

export function Search({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}

export function Shield({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

export function Sparkles({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="m12 3-1.2 3.8L7 8l3.8 1.2L12 13l1.2-3.8L17 8l-3.8-1.2L12 3ZM5 14l-.8 2.2L2 17l2.2.8L5 20l.8-2.2L8 17l-2.2-.8L5 14ZM19 13l-.6 1.4L17 15l1.4.6L19 17l.6-1.4L21 15l-1.4-.6L19 13Z" /></svg>;
}

export function Target({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v3M21 12h-3M12 21v-3M3 12h3" /></svg>;
}

export function Clock({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

export function Refresh({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="M20 6v5h-5M4 18v-5h5" /><path d="M18.5 9A7 7 0 0 0 6 6.5L4 11M5.5 15A7 7 0 0 0 18 17.5l2-4.5" /></svg>;
}

export function Compass({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><circle cx="12" cy="12" r="9" /><path d="m15 9-2 4-4 2 2-4 4-2Z" /></svg>;
}

export function ExternalLink({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>;
}

export function Close({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="M18 6 6 18M6 6l12 12" /></svg>;
}

export function Info({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>;
}

export function ArrowRight({ size = 16, ...props }: IconProps) {
  return <svg {...base(size)} {...props}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
