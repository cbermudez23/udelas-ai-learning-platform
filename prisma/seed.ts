import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Sembrando datos de demostración de UDELAS AI Learning Platform...");

  const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || "Demo1234*", 10);

  const student = await prisma.user.upsert({
    where: { email: "carlos@udelas.ac.pa" },
    update: { passwordHash },
    create: {
      name: "Carlos Alvarado",
      email: "carlos@udelas.ac.pa",
      passwordHash,
      role: "STUDENT",
      avatarInitials: "CA"
    }
  });

  await prisma.user.upsert({
    where: { email: "profesora@udelas.ac.pa" },
    update: { passwordHash },
    create: {
      name: "Dra. María Torres",
      email: "profesora@udelas.ac.pa",
      passwordHash,
      role: "PROFESSOR",
      avatarInitials: "MT"
    }
  });

  const coursesData = [
    {
      name: "Fundamentos de Inteligencia Artificial",
      category: "Tecnología",
      professorName: "Dr. María Torres",
      colorTheme: "blue",
      progress: 78,
      grades: [
        { label: "Parcial 1", score: 88 }
      ]
    },
    {
      name: "Psicología Educativa y del Aprendizaje",
      category: "Psicología",
      professorName: "Dra. Ana López",
      colorTheme: "amber",
      progress: 55,
      grades: [
        { label: "Parcial 1", score: 79 },
        { label: "Parcial 2", score: 82 }
      ]
    },
    {
      name: "Rehabilitación Cognitiva y Neurociencia",
      category: "Rehabilitación",
      professorName: "Dr. Pedro Sánchez",
      colorTheme: "green",
      progress: 91,
      grades: [
        { label: "Parcial 1", score: 94 },
        { label: "Parcial 2", score: 96 }
      ]
    },
    {
      name: "Negocios Electrónicos y Comercio Digital",
      category: "Negocios",
      professorName: "Lic. Juan García",
      colorTheme: "red",
      progress: 34,
      grades: [{ label: "Parcial 1", score: 71 }]
    }
  ];

  const courseRecords = [];
  for (const c of coursesData) {
    const course = await prisma.course.create({
      data: {
        name: c.name,
        category: c.category,
        professorName: c.professorName,
        colorTheme: c.colorTheme
      }
    });
    courseRecords.push(course);

    const enrollment = await prisma.enrollment.create({
      data: {
        userId: student.id,
        courseId: course.id,
        progressPercent: c.progress
      }
    });

    for (const g of c.grades) {
      await prisma.grade.create({
        data: { enrollmentId: enrollment.id, label: g.label, score: g.score }
      });
    }
  }

  const now = new Date();
  const inDays = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

  await prisma.calendarEvent.createMany({
    data: [
      {
        userId: student.id,
        title: "Examen parcial IA",
        detail: "9:00 AM · Aula Virtual 3",
        date: inDays(5),
        colorTag: "blue"
      },
      {
        userId: student.id,
        title: "Entrega portafolio",
        detail: "11:59 PM · Psicología educativa",
        date: inDays(9),
        colorTag: "amber"
      },
      {
        userId: student.id,
        title: "Webinar: Neurociencia",
        detail: "2:00 PM · BigBlueButton",
        date: inDays(16),
        colorTag: "green"
      }
    ]
  });

  await prisma.libraryDocument.createMany({
    data: [
      {
        title: "Reglamento de Evaluación de los Aprendizajes UDELAS",
        type: "reglamento",
        tags: ["reglamento", "evaluación", "notas"],
        content:
          "El presente reglamento establece que la evaluación de los aprendizajes en UDELAS se realiza de forma continua e integral, considerando evaluaciones parciales, trabajos prácticos y examen final. La calificación mínima de aprobación es 71 puntos sobre 100. Los estudiantes tienen derecho a solicitar revisión de calificaciones dentro de los cinco días hábiles posteriores a la publicación de notas."
      },
      {
        title: "Introducción a las Redes Neuronales Artificiales",
        type: "libro",
        tags: ["inteligencia artificial", "redes neuronales", "deep learning"],
        content:
          "Las redes neuronales artificiales están formadas por capas de neuronas: entrada, ocultas y salida. Aprenden ajustando los pesos de sus conexiones mediante el algoritmo de retropropagación del error. Las redes profundas, con múltiples capas ocultas, permiten aprender representaciones complejas de los datos y son la base del aprendizaje profundo (Deep Learning) usado en visión por computadora y procesamiento de lenguaje natural."
      },
      {
        title: "Rehabilitación Cognitiva: Fundamentos y Técnicas",
        type: "articulo",
        tags: ["rehabilitación", "neurociencia", "cognición"],
        content:
          "La rehabilitación cognitiva es un proceso terapéutico dirigido a mejorar el funcionamiento cognitivo de personas con daño cerebral o deterioro cognitivo. Incluye técnicas de estimulación de la memoria, atención, funciones ejecutivas y lenguaje, apoyadas cada vez más por herramientas digitales y de inteligencia artificial para personalizar los planes de intervención."
      },
      {
        title: "Psicología Educativa Aplicada al Aula Virtual",
        type: "guia",
        tags: ["psicología educativa", "aprendizaje", "virtualidad"],
        content:
          "La psicología educativa aporta principios fundamentales para el diseño de experiencias de aprendizaje virtual: motivación, autorregulación, retroalimentación oportuna y carga cognitiva. Un entorno virtual bien diseñado reduce la carga cognitiva extraña y facilita la construcción activa del conocimiento por parte del estudiante."
      },
      {
        title: "Inteligencia Artificial Aplicada a la Educación Superior",
        type: "articulo",
        tags: ["inteligencia artificial", "educación superior", "tutor ia"],
        content:
          "La incorporación de inteligencia artificial en la educación superior permite personalizar el aprendizaje mediante tutores virtuales, generación automática de materiales y analítica predictiva del rendimiento académico. Su implementación exitosa requiere gobernanza ética, supervisión humana y protección de datos institucionales."
      }
    ]
  });

  const microcred = await prisma.microcredential.create({
    data: {
      name: "Microcredencial en Ciencia de Datos aplicada a la Educación",
      description: "Ruta de aprendizaje progresiva en analítica y datos educativos.",
      steps: [
        { label: "Fundamentos de datos" },
        { label: "Estadística aplicada" },
        { label: "Visualización" },
        { label: "IA en educación" },
        { label: "Proyecto final" }
      ]
    }
  });

  await prisma.userMicrocredentialProgress.create({
    data: { userId: student.id, microcredentialId: microcred.id, currentStep: 3 }
  });

  const badgesData = [
    { name: "Explorador IA", description: "Primer uso del Tutor IA", icon: "🤖" },
    { name: "Constancia", description: "7 días consecutivos de estudio", icon: "🔥" },
    { name: "Alto rendimiento", description: "Promedio superior a 90", icon: "🏆" },
    { name: "Colaborador", description: "Participación en foros", icon: "🤝" }
  ];
  const badgeRecords = [];
  for (const b of badgesData) {
    badgeRecords.push(await prisma.badge.create({ data: b }));
  }
  await prisma.userBadge.create({
    data: { userId: student.id, badgeId: badgeRecords[0].id }
  });
  await prisma.userBadge.create({
    data: { userId: student.id, badgeId: badgeRecords[2].id }
  });

  await prisma.portfolioItem.create({
    data: {
      userId: student.id,
      title: "Proyecto final: Clasificador de riesgo académico",
      type: "proyecto",
      description:
        "Modelo de machine learning para predecir estudiantes en riesgo de deserción, desarrollado en el curso de Fundamentos de IA."
    }
  });

  console.log("Datos de demostración creados correctamente.");
  console.log("Cuenta estudiante: carlos@udelas.ac.pa / demo1234");
  console.log("Cuenta docente:    profesora@udelas.ac.pa / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
