import crypto from "node:crypto";

// Same ID scheme as the VPS scripts (make_id), so IDs always match.
export function makeId(value) {
  const raw = String(value);
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const digest = crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex")
    .slice(0, 10);
  return (slug.slice(0, 65).replace(/^-+|-+$/g, "") || "item") + "-" + digest;
}

// Parses the bot's TXT export (BATCH / SUBJECT / CLASS / LECTURE / WATCH_URL).
export function parseTxt(text) {
  const batches = new Map();
  let batch = "";
  let subject = "";
  let title = "";
  let number = "";

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    const upper = line.toUpperCase();
    const value = line.includes(":") ? line.slice(line.indexOf(":") + 1).trim() : "";

    if (upper.startsWith("BATCH:")) {
      batch = value;
      if (batch && !batches.has(batch)) batches.set(batch, new Map());
    } else if (upper.startsWith("SUBJECT:")) {
      subject = value;
      if (batch && subject && !batches.get(batch).has(subject)) {
        batches.get(batch).set(subject, new Map());
      }
    } else if (upper.startsWith("CLASS:")) {
      number = value;
    } else if (upper.startsWith("LECTURE:")) {
      title = value;
    } else if (upper.startsWith("WATCH_URL:")) {
      const url = value;
      if (batch && subject && title && url.startsWith("https://")) {
        const lectures = batches.get(batch).get(subject);
        if (!lectures.has(url)) {
          lectures.set(url, {
            id: makeId(url),
            name: title,
            class_number: /^\d+$/.test(number) ? Number(number) : lectures.size + 1,
            duration: 0,
            stream_url: "",
            notes_url: ""
          });
        }
        number = "";
      }
    }
  }

  return [...batches.entries()]
    .map(([name, subjects]) => ({
      id: makeId(name),
      name,
      description: "",
      subjects: [...subjects.entries()]
        .map(([subjectName, lectures]) => ({
          id: makeId(subjectName),
          name: subjectName,
          lectures: [...lectures.values()]
        }))
        .filter((s) => s.lectures.length > 0)
    }))
    .filter((b) => b.subjects.length > 0);
}
