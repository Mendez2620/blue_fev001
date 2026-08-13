import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const zones = [
  { slug: "centro-digital", name: "Centro Digital", description: "Espacio para crear soluciones digitales útiles.", sortOrder: 1 },
  { slug: "laboratorio-comunitario", name: "Laboratorio Comunitario", description: "Espacio para investigar y prototipar mejoras comunitarias.", sortOrder: 2 },
  { slug: "foro-comunitario", name: "Foro Comunitario", description: "Espacio para comunicar, escuchar y construir propuestas.", sortOrder: 3 },
  { slug: "taller-soluciones", name: "Taller de Soluciones", description: "Espacio para organizar, construir y probar soluciones.", sortOrder: 4 },
];

const capabilities = [
  ["desarrollo-web", "Desarrollo web", "Tecnología"], ["diseno-interfaces", "Diseño de interfaces", "Diseño"],
  ["organizacion-informacion", "Organización de información", "Información"], ["comunicacion", "Comunicación", "Comunicación"],
  ["accesibilidad", "Accesibilidad", "Inclusión"], ["resolucion-problemas", "Resolución de problemas", "Solución"],
  ["analisis", "Análisis", "Investigación"], ["investigacion", "Investigación", "Investigación"],
  ["prototipado", "Prototipado", "Diseño"], ["planeacion", "Planeación", "Gestión"],
  ["logistica", "Logística", "Gestión"], ["trabajo-colaborativo", "Trabajo colaborativo", "Colaboración"],
].map(([slug, name, category]) => ({ slug, name, category, description: `Capacidad demostrable de ${name.toLowerCase()}.` }));

const missions = [
  { zone: "centro-digital", slug: "digitaliza-una-causa", title: "Digitaliza una causa", summary: "Crea un recurso digital claro para comunicar una causa.", problem: "Una causa necesita presentar información útil de forma comprensible.", objective: "Diseñar un recurso digital accesible y verificable.", evidence: "DIGITAL_RESOURCE", safety: "No publiques datos personales, rostros o material de terceros sin autorización.", skills: [["desarrollo-web",5],["diseno-interfaces",4],["comunicacion",4],["accesibilidad",4]] },
  { zone: "centro-digital", slug: "ordena-informacion-util", title: "Ordena información útil", summary: "Organiza información para que otras personas puedan consultarla.", problem: "La información dispersa dificulta comprender y actuar.", objective: "Construir una estructura clara, verificable y accesible.", evidence: "DOCUMENT_OR_PROTOTYPE", safety: "Usa únicamente información autorizada y evita publicar datos personales.", skills: [["organizacion-informacion",5],["analisis",4],["accesibilidad",3],["comunicacion",3]] },
  { zone: "laboratorio-comunitario", slug: "prototipa-una-mejora", title: "Prototipa una mejora", summary: "Diseña una versión inicial de una mejora concreta.", problem: "Una necesidad requiere probar una solución antes de desarrollarla por completo.", objective: "Crear y documentar un prototipo evaluable.", evidence: "PROTOTYPE", safety: "No incluyas rostros, ubicaciones exactas o información privada sin autorización.", skills: [["prototipado",5],["resolucion-problemas",5],["planeacion",3],["analisis",3]] },
  { zone: "laboratorio-comunitario", slug: "investiga-una-necesidad", title: "Investiga una necesidad", summary: "Reúne evidencia segura para comprender una necesidad.", problem: "Hace falta evidencia antes de decidir cómo intervenir.", objective: "Documentar hallazgos y fuentes sin identificar a personas.", evidence: "RESEARCH_REPORT", safety: "No registres nombres, ubicaciones exactas, datos de salud ni información sensible.", skills: [["investigacion",5],["analisis",5],["organizacion-informacion",3],["comunicacion",3]] },
  { zone: "foro-comunitario", slug: "disena-consulta-comunitaria", title: "Diseña una consulta comunitaria", summary: "Prepara una consulta breve, respetuosa y útil.", problem: "Una propuesta necesita escuchar perspectivas sin invadir la privacidad.", objective: "Diseñar una consulta que recopile solo información necesaria.", evidence: "CONSULTATION_DESIGN", safety: "No recopiles datos sensibles ni información personal innecesaria; evita identificar menores.", skills: [["comunicacion",5],["investigacion",4],["organizacion-informacion",4],["accesibilidad",3]] },
  { zone: "foro-comunitario", slug: "presenta-una-propuesta", title: "Presenta una propuesta", summary: "Comunica una propuesta con problema, evidencia y pasos claros.", problem: "Una solución útil necesita explicarse para poder revisarse.", objective: "Preparar una presentación clara, sustentada y accesible.", evidence: "PRESENTATION", safety: "No expongas identidades, imágenes o testimonios sin autorización explícita.", skills: [["comunicacion",5],["planeacion",4],["trabajo-colaborativo",3],["accesibilidad",3]] },
  { zone: "taller-soluciones", slug: "organiza-solucion-local", title: "Organiza una solución local", summary: "Elabora un plan ejecutable para una solución cercana.", problem: "Una idea necesita responsables, recursos y pasos ordenados.", objective: "Crear un plan seguro con tareas y recursos identificados.", evidence: "ACTION_PLAN", safety: "No publiques ubicaciones exactas ni datos de contacto personales.", skills: [["logistica",5],["planeacion",5],["trabajo-colaborativo",4],["resolucion-problemas",3]] },
  { zone: "taller-soluciones", slug: "construye-prueba-mejora", title: "Construye y prueba una mejora", summary: "Construye una mejora sencilla y documenta una prueba segura.", problem: "Un prototipo necesita probarse para conocer sus límites.", objective: "Registrar construcción, prueba, resultados y ajustes.", evidence: "BUILD_LOG", safety: "No realices actividades peligrosas ni uses herramientas sin supervisión adecuada.", skills: [["resolucion-problemas",5],["prototipado",5],["analisis",4],["planeacion",3],["trabajo-colaborativo",3]] },
];

async function seedFutura() {
  const zoneIds = {};
  for (const zone of zones) {
    const saved = await prisma.impactZone.upsert({ where: { slug: zone.slug }, update: { ...zone, targetPoints: 100, active: true }, create: { ...zone, targetPoints: 100, active: true } });
    zoneIds[zone.slug] = saved.id;
  }
  const capabilityIds = {};
  for (const capability of capabilities) {
    const saved = await prisma.impactCapability.upsert({ where: { slug: capability.slug }, update: { ...capability, active: true }, create: { ...capability, active: true } });
    capabilityIds[capability.slug] = saved.id;
  }
  for (const [index, mission] of missions.entries()) {
    const data = { zoneId: zoneIds[mission.zone], slug: mission.slug, title: mission.title, summary: mission.summary, problemDescription: mission.problem, objective: mission.objective, instructions: "Documenta el proceso, entrega la evidencia solicitada y revisa que sea segura antes de enviarla.", deliverables: ["Evidencia principal", "Breve explicación del proceso"], validationCriteria: ["Responde al objetivo", "La evidencia es verificable", "Respeta las notas de seguridad"], safetyNotes: mission.safety, difficulty: "INITIAL", estimatedMinutes: 120, points: 25, evidenceType: mission.evidence, participationMode: "INDIVIDUAL", publicationStatus: "PUBLISHED", active: true, startsAt: null, endsAt: null, sortOrder: index + 1 };
    const saved = await prisma.impactMission.upsert({ where: { slug: mission.slug }, update: data, create: data });
    for (const [capabilitySlug, weight] of mission.skills) {
      const key = { missionId: saved.id, capabilityId: capabilityIds[capabilitySlug] };
      await prisma.impactMissionCapability.upsert({ where: { missionId_capabilityId: key }, update: { weight }, create: { ...key, weight } });
    }
  }
}

async function main() {
  const email = process.env.SEED_USER_EMAIL || "demo@bluefev.dev";
  const password = process.env.SEED_USER_PASSWORD || "Demo12345";
  const name = process.env.SEED_USER_NAME || "Demo User";

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({ data: { name, email, passwordHash } });
  }
  await seedFutura();
  console.log("Seed completed. FUTURA catalog is ready.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
