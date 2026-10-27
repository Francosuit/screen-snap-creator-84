import logo from "@/assets/suite-solutions-logo.png.asset.json";

/** Looping "entering Suite" animation: the logo approaches, gold rings sweep past like a doorway, and it starts again */
export function LogoLoop({ className = "" }: { className?: string }) {
  return (
    <div className={`suite-loop grid aspect-square place-items-center ${className || "relative"}`} aria-label="Entrando en Suite Solutions" role="img">
      {[0, 1, 2].map((i) => <span key={i} className="suite-loop-ring" style={{ animationDelay: `${i * 2}s` }} />)}
      <span className="suite-loop-glow" />
      <img src={logo.url} alt="" className="suite-loop-logo relative w-3/5 rounded-full" />
    </div>
  );
}
