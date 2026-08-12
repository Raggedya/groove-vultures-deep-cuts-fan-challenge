export class ArchiveService {
  constructor(records) {
    this.records = records.filter(record => record.approved === true);
  }

  getCategories() {
    return ["ALL ARCHIVES", ...new Set(this.records.map(record => record.category))];
  }

  getRandom({ mediaType, category = "ALL ARCHIVES", excludeIds = [] }) {
    const matches = this.records.filter(record =>
      (!mediaType || record.mediaType === mediaType) &&
      (category === "ALL ARCHIVES" || record.category === category)
    );
    if (!matches.length) return null;
    const fresh = matches.filter(record => !excludeIds.includes(record.id));
    const pool = fresh.length ? fresh : matches;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}
