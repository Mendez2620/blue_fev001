import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getAdminContributions } from "../api/impactAdminApi";
import { FuturaHeader, PageState } from "../components/futura/FuturaUi";
import ProjectStatus from "../components/futura/ProjectStatus";

const filters = ["ALL", "SUBMITTED", "IN_REVIEW", "CHANGES_REQUESTED", "APPROVED", "REJECTED"];
const labels = { ALL: "Todas", SUBMITTED: "Enviadas", IN_REVIEW: "En revisión", CHANGES_REQUESTED: "Cambios solicitados", APPROVED: "Aprobadas", REJECTED: "Rechazadas" };

export default function FuturaAdminQueuePage() {
  const [items, setItems] = useState([]); const [status, setStatus] = useState("loading"); const [filter, setFilter] = useState("ALL"); const navigate = useNavigate(); const location = useLocation();
  const load = useCallback(async () => { setStatus("loading"); try { setItems(await getAdminContributions()); setStatus("ready"); } catch (error) { if (error.response?.status === 401) { navigate(`/login?from=${encodeURIComponent(location.pathname)}`, { replace: true }); return; } setStatus(error.response?.status === 403 ? "forbidden" : "error"); } }, [location.pathname, navigate]);
  useEffect(() => { load(); }, [load]);
  const visible = useMemo(() => filter === "ALL" ? items : items.filter((item) => item.status === filter), [filter, items]);
  if (status === "loading") return <PageState title="Cargando entregas"><p>Consultando la bandeja de revisión.</p></PageState>;
  if (status === "forbidden") return <PageState title="Acceso restringido"><p>Tu cuenta no tiene permisos para revisar contribuciones FUTURA.</p></PageState>;
  if (status === "error") return <PageState title="No pudimos cargar la bandeja" onRetry={load}><p>Intenta nuevamente en un momento.</p></PageState>;
  return <main className="futura-page"><FuturaHeader/><section className="admin-queue"><header><p className="eyebrow">Revisión humana FUTURA</p><h1>Bandeja de entregas</h1><p>Abre una contribución para revisar su evidencia y tomar una decisión.</p></header><div className="admin-filters" aria-label="Filtrar entregas">{filters.map((value) => <button type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} key={value}>{labels[value]}</button>)}</div>{visible.length === 0 ? <div className="futura-empty"><h2>No hay entregas para revisar.</h2><p>{items.length ? "No hay resultados con este filtro." : "Las contribuciones enviadas aparecerán aquí."}</p></div> : <div className="admin-queue-list">{visible.map((item) => <article key={item.id}><div className="project-statuses"><ProjectStatus value={item.status}/><ProjectStatus value={item.participation?.status}/></div><p className="eyebrow">{item.participation?.mission?.zone?.name || "Distrito Cero"}</p><h2>{item.title || "Contribución sin título"}</h2><p><strong>{item.participation?.mission?.title || "Misión FUTURA"}</strong></p><dl><div><dt>Autor</dt><dd>{item.participation?.user?.name || item.participation?.user?.email || "Sin nombre"}</dd></div><div><dt>Actualizada</dt><dd>{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(item.updatedAt))}</dd></div></dl><Link to={`/admin/futura/contributions/${item.id}`}>Abrir entrega →</Link></article>)}</div>}</section></main>;
}
