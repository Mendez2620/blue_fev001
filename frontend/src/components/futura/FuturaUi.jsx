import { Link } from "react-router-dom";

export const stateLabels = { abandoned: "Abandonada", powered: "Encendida", equipped: "Equipada", active: "Activa", transformed: "Transformada" };
export const visualState = (value) => Object.hasOwn(stateLabels, value) ? value : "abandoned";
export const safePercent = (value) => Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 0));

export function FuturaHeader() {
  return <header className="futura-header"><Link className="futura-brand" to="/futura"><span>FUTURA</span><strong>Distrito Cero</strong></Link><nav aria-label="Navegación FUTURA"><Link to="/futura">Distrito</Link><Link to="/futura/my-projects">Mis proyectos</Link><Link to="/chat">Blue FEV</Link></nav></header>;
}

export function Progress({ zone }) {
  const state = visualState(zone?.visualState); const percent = safePercent(zone?.progressPercent);
  return <div className="futura-progress"><div><span>{stateLabels[state]}</span><strong>{zone?.progressPoints ?? 0} / {zone?.targetPoints ?? "—"} pts</strong></div><div className="futura-progress-track" role="progressbar" aria-label={`Progreso de ${zone?.name || "zona"}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div><small>{percent}% de transformación</small></div>;
}

export function PageState({ title, children, onRetry }) {
  return <main className="futura-page"><FuturaHeader /><section className="futura-state" role="status"><span aria-hidden="true">◇</span><h1>{title}</h1>{children}{onRetry && <button type="button" onClick={onRetry}>Reintentar</button>}<Link to="/futura">Volver al distrito</Link></section></main>;
}
