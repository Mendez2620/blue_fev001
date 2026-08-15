import ProjectStatus from "./ProjectStatus";

const formatDate = (value) => value ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Fecha no disponible";

export default function AdminAuditTimeline({ events = [] }) {
  return <section className="admin-audit" aria-labelledby="audit-title"><h2 id="audit-title">Historial de revisión</h2>{events.length === 0 ? <p>Aún no hay eventos de revisión.</p> : <ol>{events.map((event) => <li key={event.id}><div><ProjectStatus value={event.toStatus}/><time dateTime={event.createdAt}>{formatDate(event.createdAt)}</time></div><p>{event.fromStatus ? <><ProjectStatus value={event.fromStatus}/> <span aria-hidden="true">→</span> </> : null}<ProjectStatus value={event.toStatus}/></p>{event.reason && <blockquote>{event.reason}</blockquote>}<small>{event.actorEmailSnapshot || "Sistema"}</small></li>)}</ol>}</section>;
}
