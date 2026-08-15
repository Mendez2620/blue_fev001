const labels = { DRAFT: "Borrador", IN_PROGRESS: "En progreso", SUBMITTED: "Enviada", IN_REVIEW: "En revisión", CHANGES_REQUESTED: "Cambios solicitados", APPROVED: "Aprobada", REJECTED: "Rechazada", ACTIVE: "Activa", ABANDONED: "Abandonada", COMPLETED: "Completada" };

export default function ProjectStatus({ value }) {
  if (!value) return null;
  return <span className={`project-status status-${value.toLowerCase()}`}>{labels[value] || value}</span>;
}
