import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyParticipations } from "../api/impactApi";
import { FuturaHeader, PageState } from "../components/futura/FuturaUi";
import ProjectStatus from "../components/futura/ProjectStatus";

export default function FuturaMyProjectsPage() {
  const [items, setItems] = useState([]); const [status, setStatus] = useState("loading");
  const load = useCallback(async () => { setStatus("loading"); try { setItems(await getMyParticipations()); setStatus("ready"); } catch { setStatus("error"); } }, []);
  useEffect(() => { load(); }, [load]);
  if (status === "loading") return <PageState title="Cargando tus proyectos"><p>Estamos reuniendo tus participaciones.</p></PageState>;
  if (status === "error") return <PageState title="No pudimos cargar tus proyectos" onRetry={load}><p>Intenta nuevamente en un momento.</p></PageState>;
  return <main className="futura-page"><FuturaHeader/><section className="projects-page"><header><p className="eyebrow">Tu trabajo en FUTURA</p><h1>Mis proyectos</h1><p>Continúa tus contribuciones y consulta el estado de cada revisión.</p></header>{items.length === 0 ? <div className="futura-empty"><h2>Aún no tienes proyectos</h2><p>Explora el distrito y elige una misión disponible.</p><Link className="futura-primary" to="/futura">Explorar misiones</Link></div> : <div className="project-grid">{items.map((item) => <article className="project-card" key={item.id}><div className="project-statuses"><ProjectStatus value={item.status}/><ProjectStatus value={item.contribution?.status}/></div><p className="eyebrow">{item.mission?.zone?.name || "Distrito Cero"}</p><h2>{item.mission?.title || "Proyecto FUTURA"}</h2><p>{item.contribution?.title || "Tu contribución está lista para comenzar."}</p><small>Actualizado {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(item.contribution?.updatedAt || item.updatedAt))}</small><Link to={`/futura/my-projects/${item.id}`}>Abrir proyecto →</Link></article>)}</div>}</section></main>;
}
