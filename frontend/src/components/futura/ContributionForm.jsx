const fields = [
  ["title", "Título", "text", 160],
  ["description", "Descripción", "textarea", 4000],
  ["processNotes", "Notas del proceso", "textarea", 4000],
  ["resultUrl", "Enlace al resultado", "url", 1000],
  ["repositoryUrl", "Enlace al repositorio", "url", 1000],
  ["reflection", "Reflexión", "textarea", 4000],
];

export default function ContributionForm({ value, onChange, disabled }) {
  return <div className="contribution-form">{fields.map(([name, label, type, maxLength]) => <label key={name}><span>{label}{name === "title" ? " *" : ""}</span>{type === "textarea" ? <textarea name={name} value={value[name]} onChange={onChange} disabled={disabled} maxLength={maxLength} rows={name === "description" ? 5 : 3} /> : <input name={name} type={type} value={value[name]} onChange={onChange} disabled={disabled} maxLength={maxLength} />}</label>)}</div>;
}
