import { Link } from "react-router-dom";
import { Progress, stateLabels, visualState } from "./FuturaUi";

const positions = {
  "centro-digital": { x: "20%", y: "24%", icon: "⌁" },
  "laboratorio-comunitario": { x: "68%", y: "20%", icon: "⚗" },
  "foro-comunitario": { x: "24%", y: "66%", icon: "◉" },
  "taller-soluciones": { x: "70%", y: "64%", icon: "◇" },
};

export default function DistrictScene({ zones, activeSlug, onActive }) {
  return <div className="district-scene-wrap">
    <svg className="district-scene" viewBox="0 0 1000 620" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><linearGradient id="futuraSky" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#101a45"/><stop offset="1" stopColor="#245a71"/></linearGradient><linearGradient id="futuraGround" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#6eb29b"/><stop offset="1" stopColor="#244c55"/></linearGradient></defs>
      <rect width="1000" height="620" rx="42" fill="url(#futuraSky)"/><path d="M60 420 500 170 940 420 500 590Z" fill="url(#futuraGround)" stroke="#8de0c1" strokeOpacity=".28" strokeWidth="4"/>
      <path d="M500 190V570M80 420H920" stroke="#d9fff1" strokeOpacity=".16" strokeWidth="30"/><path d="M500 190V570M80 420H920" stroke="#d9fff1" strokeOpacity=".24" strokeWidth="3" strokeDasharray="12 16"/>
      <g className="scene-building scene-building-digital"><path d="M140 310 280 230 390 294 248 378Z"/><path d="M248 378V476L390 390V294Z"/><path d="M140 310V407L248 476V378Z"/><rect x="214" y="300" width="80" height="44" rx="8" transform="skewY(-29)"/></g>
      <g className="scene-building scene-building-lab"><path d="M615 290 736 220 865 292 740 366Z"/><path d="M740 366V465L865 391V292Z"/><path d="M615 290V389L740 465V366Z"/><path d="M720 264v-70h38v48l35 56" fill="none" stroke="currentColor" strokeWidth="15"/></g>
      <g className="scene-building scene-building-forum"><ellipse cx="300" cy="475" rx="145" ry="70"/><path d="M215 450h170v65H215z"/><path d="m225 450 75-72 75 72"/></g>
      <g className="scene-building scene-building-workshop"><path d="M625 455 760 380 885 450 748 530Z"/><path d="M748 530v55l137-78v-57Z"/><path d="M625 455v55l123 75v-55Z"/><circle cx="754" cy="450" r="24"/></g>
      <g className="scene-vegetation" fill="#83d6a7"><circle cx="110" cy="500" r="24"/><circle cx="900" cy="520" r="30"/><circle cx="510" cy="110" r="18"/></g>
    </svg>
    {zones.map((zone) => { const position = positions[zone.slug] || { x: "50%", y: "50%", icon: "◇" }; const state = visualState(zone.visualState); return <Link key={zone.id || zone.slug} to={`/futura/zones/${encodeURIComponent(zone.slug)}`} className={`zone-hotspot zone-${state} ${activeSlug === zone.slug ? "is-active" : ""}`} style={{ left: position.x, top: position.y }} onMouseEnter={() => onActive(zone.slug)} onFocus={() => onActive(zone.slug)} onClick={() => onActive(zone.slug)} aria-label={`Explorar ${zone.name}, ${stateLabels[state]}`}><span className="zone-hotspot-icon" aria-hidden="true">{position.icon}</span><strong>{zone.name}</strong><small>{stateLabels[state]} · {zone.progressPercent ?? 0}%</small></Link>; })}
    {zones.length === 0 && <div className="district-empty">No hay zonas disponibles.</div>}
  </div>;
}

export function ZonePanel({ zone }) {
  if (!zone) return <aside className="zone-panel"><p>Selecciona una zona para conocer su estado.</p></aside>;
  return <aside className="zone-panel" aria-live="polite"><p className="eyebrow">Zona activa</p><h2>{zone.name}</h2><p>{zone.description}</p><Progress zone={zone}/><p>{zone.missions?.length ?? zone.missionCount ?? "—"} misiones disponibles</p><Link className="futura-primary" to={`/futura/zones/${encodeURIComponent(zone.slug)}`}>Explorar zona</Link></aside>;
}
