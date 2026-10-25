export function cleanId(value) {
  const id = String(value ?? "");
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) {
    throw new Error(`Invalid ID: ${id.slice(0, 50)}`);
  }
  return id;
}

export function cleanText(value, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

export function cleanUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (url.length > 2048) throw new Error("Media URL too long");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid media URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Media URL must use HTTPS");
  }
  return url;
}

export function parseBatch(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    !Array.isArray(input.subjects) ||
    input.subjects.length > 100
  ) {
    throw new Error("Invalid batch structure");
  }

  const batchName = cleanText(input.name);
  if (!batchName) throw new Error("Batch name missing");

  const subjects = input.subjects.map((subject) => {
    if (
      !subject ||
      typeof subject !== "object" ||
      !Array.isArray(subject.lectures) ||
      subject.lectures.length > 1000
    ) {
      throw new Error("Invalid subject structure");
    }

    const subjectName = cleanText(subject.name);
    if (!subjectName) throw new Error("Subject name missing");

    const lectures = subject.lectures.map((lecture) => {
      if (!lecture || typeof lecture !== "object") {
        throw new Error("Invalid lecture");
      }
      const lectureName = cleanText(lecture.name);
      if (!lectureName) throw new Error("Lecture name missing");

      const classNumber = Number(lecture.class_number || 0);
      const duration = Number(lecture.duration || 0);
      if (
        !Number.isFinite(classNumber) ||
        !Number.isFinite(duration) ||
        classNumber < 0 ||
        duration < 0
      ) {
        throw new Error("Invalid class number or duration");
      }

      return {
        id: cleanId(lecture.id),
        name: lectureName,
        class_number: classNumber,
        duration,
        stream_url: cleanUrl(lecture.stream_url),
        notes_url: cleanUrl(lecture.notes_url)
      };
    });

    return { id: cleanId(subject.id), name: subjectName, lectures };
  });

  return {
    id: cleanId(input.id),
    name: batchName,
    description: cleanText(input.description, 500),
    published: input.published === true,
    subjects,
    updatedAt: new Date().toISOString()
  };
}
