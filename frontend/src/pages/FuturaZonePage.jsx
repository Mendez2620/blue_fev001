import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getImpactZone } from "../api/impactApi";
import { FuturaHeader, PageState, Progress } from "../components/futura/FuturaUi";

export default function FuturaZonePage() {
  const { slug } = useParams(); const [zone, setZone] = useState(null); const [status, setStatus] = useState("loading");
  const load = useCallback(async () => { setStatus("loading"); try { setZone(await getImpactZone(slug)); setStatus("ready"); } catch (error) { setStatus(error.response?.status === 404 ? "missing" : "error"); } }, [slug]);
  useEffect(() => { load(); }, [load]);
  if (status === "loading") return <PageState title="Abriendo la zona"><p>Consultando misiones y progreso…</p></PageState>;
  if (status === "missing") return <PageState title="Zona no encontrada"><p>Esta zona no está disponible en Distrito Cero.</p></PageState>;
  if (status === "error") return <PageState title="No pudimos cargar la zona" onRetry={load}><p>Intenta nuevamente en un momento.</p></PageState>;
  const missions = Array.isArray(zone?.missions) ? zone.missions : [];
  return <main className="futura-page"><FuturaHeader/><section className="futura-detail-hero"><Link to="/futura">← Volver al distrito</Link><p className="eyebrow">Zona FUTURA</p><h1>{zone.name}</h1><p>{zone.description}</p><Progress zone={zone}/></section><section className="mission-list" aria-labelledby="missions-title"><div className="futura-section-heading"><div><p className="eyebrow">Exploración pública</p><h2 id="missions-title">Misiones de la zona</h2></div><span>{missions.length} disponibles</span></div><div className="mission-grid">{missions.map((mission) => <article key={mission.id || mission.slug} className="mission-card"><div><span>{mission.difficulty || "Inicial"}</span><span>{mission.points} pts</span></div><h3>{mission.title}</h3><p>{mission.summary}</p><dl><div><dt>Tiempo estimado</dt><dd>{mission.estimatedMinutes} min</dd></div><div><dt>Disponibilidad</dt><dd>{mission.availability?.joinable ? "Disponible" : "No disponible actualmente"}</dd></div></dl><Link to={`/futura/missions/${encodeURIComponent(mission.slug)}`}>Ver misión <span aria-hidden="true">→</span></Link></article>)}</div>{missions.length === 0 && <p className="futura-empty">Esta zona todavía no tiene misiones disponibles.</p>}</section></main>;
}
