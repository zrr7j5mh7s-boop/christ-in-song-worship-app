(function () {
  "use strict";

  const BOOK_ALIASES = {
    gen: "Genesis", genesis: "Genesis",
    exod: "Exodus", ex: "Exodus", exodus: "Exodus",
    lev: "Leviticus", leviticus: "Leviticus",
    num: "Numbers", numbers: "Numbers",
    deut: "Deuteronomy", dt: "Deuteronomy",
    josh: "Joshua", jos: "Joshua", joshua: "Joshua",
    judg: "Judges", jdg: "Judges", judges: "Judges",
    ruth: "Ruth", ru: "Ruth",
    "1sam": "1 Samuel", "1 sam": "1 Samuel", "1 samuel": "1 Samuel",
    "2sam": "2 Samuel", "2 sam": "2 Samuel", "2 samuel": "2 Samuel",
    "1kgs": "1 Kings", "1 kings": "1 Kings", "1 king": "1 Kings",
    "2kgs": "2 Kings", "2 kings": "2 Kings", "2 king": "2 Kings",
    "1chr": "1 Chronicles", "1 chronicles": "1 Chronicles", "1 chron": "1 Chronicles",
    "2chr": "2 Chronicles", "2 chronicles": "2 Chronicles", "2 chron": "2 Chronicles",
    ezra: "Ezra",
    neh: "Nehemiah", nehemiah: "Nehemiah",
    esth: "Esther", est: "Esther", esther: "Esther",
    job: "Job",
    ps: "Psalms", psa: "Psalms", psalm: "Psalms", psalms: "Psalms",
    prov: "Proverbs", pro: "Proverbs", proverbs: "Proverbs",
    eccl: "Ecclesiastes", ecc: "Ecclesiastes",
    song: "Song of Solomon", sos: "Song of Solomon",
    isa: "Isaiah", isaiah: "Isaiah",
    jer: "Jeremiah", jeremiah: "Jeremiah",
    lam: "Lamentations",
    ezek: "Ezekiel", eze: "Ezekiel", ezekiel: "Ezekiel",
    dan: "Daniel", daniel: "Daniel",
    hos: "Hosea", hosea: "Hosea",
    joel: "Joel",
    amos: "Amos",
    obad: "Obadiah",
    jonah: "Jonah", jon: "Jonah",
    mic: "Micah", micah: "Micah",
    nah: "Nahum", nahum: "Nahum",
    hab: "Habakkuk",
    zeph: "Zephaniah",
    hag: "Haggai",
    zech: "Zechariah",
    mal: "Malachi", malachi: "Malachi",
    matt: "Matthew", mat: "Matthew", mt: "Matthew", matthew: "Matthew",
    mark: "Mark", mk: "Mark", mr: "Mark",
    luke: "Luke", lk: "Luke", lu: "Luke",
    john: "John", jn: "John", jhn: "John", joh: "John",
    acts: "Acts", act: "Acts",
    rom: "Romans", romans: "Romans", ro: "Romans",
    "1cor": "1 Corinthians", "1 cor": "1 Corinthians", "1 corinthians": "1 Corinthians",
    "2cor": "2 Corinthians", "2 cor": "2 Corinthians", "2 corinthians": "2 Corinthians",
    gal: "Galatians", galatians: "Galatians",
    eph: "Ephesians", ephesians: "Ephesians",
    phil: "Philippians", php: "Philippians", philippians: "Philippians",
    col: "Colossians", colossians: "Colossians",
    "1thess": "1 Thessalonians", "1 thess": "1 Thessalonians", "1 thessalonians": "1 Thessalonians",
    "2thess": "2 Thessalonians", "2 thess": "2 Thessalonians", "2 thessalonians": "2 Thessalonians",
    "1tim": "1 Timothy", "1 tim": "1 Timothy", "1 timothy": "1 Timothy",
    "2tim": "2 Timothy", "2 tim": "2 Timothy", "2 timothy": "2 Timothy",
    titus: "Titus", tit: "Titus",
    phlm: "Philemon", phm: "Philemon", philemon: "Philemon",
    heb: "Hebrews", hebrews: "Hebrews",
    jas: "James", james: "James", jam: "James",
    "1pet": "1 Peter", "1 pet": "1 Peter", "1 peter": "1 Peter",
    "2pet": "2 Peter", "2 pet": "2 Peter", "2 peter": "2 Peter",
    "1john": "1 John", "1 jn": "1 John", "1 john": "1 John",
    "2john": "2 John", "2 jn": "2 John", "2 john": "2 John",
    "3john": "3 John", "3 jn": "3 John", "3 john": "3 John",
    jude: "Jude",
    rev: "Revelation", revelation: "Revelation", re: "Revelation", revelations: "Revelation",
  };

  function getBooks() {
    return window.CISBibleStore ? window.CISBibleStore.getBooks() : (window.CIS_BIBLE_CATALOG?.books || []);
  }

  function normalizeBookQuery(query) {
    return String(query || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function findBook(query) {
    const books = getBooks();
    const key = normalizeBookQuery(query);
    if (!key) return null;

    const aliasName = BOOK_ALIASES[key.replace(/\./g, "")];
    if (aliasName) {
      const byAlias = books.find((book) => book.name === aliasName);
      if (byAlias) return byAlias;
    }

    return books.find((book) => {
      const name = book.name.toLowerCase();
      const osis = book.osis.toLowerCase();
      return name === key
        || osis === key
        || name.startsWith(key)
        || key.startsWith(name.split(" ")[0])
        || key.replace(/\s/g, "") === osis;
    }) || null;
  }

  function parseReference(raw) {
    const text = String(raw || "").trim().replace(/\u2013|\u2014/g, "-");
    if (!text) return { ok: false, suggestions: [], error: "" };

    const rangeMatch = text.match(/^((?:\d\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(\d+)\s*:\s*(\d+)\s*-\s*(\d+)\s*$/i)
      || text.match(/^((?:\d\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(\d+)\s*:\s*(\d+)\s*$/i)
      || text.match(/^((?:\d\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(\d+)\s*$/i);

    if (!rangeMatch) {
      return {
        ok: false,
        suggestions: suggestFromPartial(text),
        error: "Could not parse reference.",
      };
    }

    const bookPart = rangeMatch[1].replace(/\s+/g, " ").trim();
    const book = findBook(bookPart);
    const chapter = Number(rangeMatch[2]);
    if (!book || !chapter) {
      return {
        ok: false,
        suggestions: suggestFromPartial(text),
        error: book ? "Invalid chapter." : "Book not found.",
      };
    }

    const verseStart = rangeMatch[3] ? Number(rangeMatch[3]) : null;
    const verseEnd = rangeMatch[4] ? Number(rangeMatch[4]) : (verseStart || null);

    return {
      ok: true,
      parsed: {
        bookOrder: book.order,
        bookName: book.name,
        chapter,
        verseStart,
        verseEnd,
        referenceInput: text,
        referenceLabel: formatReferenceLabel(book, chapter, verseStart, verseEnd),
      },
      suggestions: [],
      error: "",
    };
  }

  function formatReferenceLabel(book, chapter, verseStart, verseEnd) {
    if (!book) return "";
    if (!verseStart) return `${book.name} ${chapter}`;
    if (verseEnd && verseEnd !== verseStart) return `${book.name} ${chapter}:${verseStart}–${verseEnd}`;
    return `${book.name} ${chapter}:${verseStart}`;
  }

  function suggestFromPartial(text) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return [];

    const chapterOnly = trimmed.match(/^((?:\d\s*)?[A-Za-z]+(?:\s+[A-Za-z]+)?)\s*(\d+)\s*$/i);
    if (chapterOnly) {
      const book = findBook(chapterOnly[1]);
      const chapter = Number(chapterOnly[2]);
      if (book && chapter) {
        return [
          { label: `${book.name} ${chapter}:1`, reference: `${book.name} ${chapter}:1` },
          { label: `${book.name} ${chapter}:16`, reference: `${book.name} ${chapter}:16` },
          { label: `Open ${book.name} ${chapter}`, reference: `${book.name} ${chapter}` },
        ];
      }
    }

    const bookOnly = trimmed.match(/^((?:\d\s*)?[A-Za-z.]+(?:\s+[A-Za-z]+)?)\s*$/i);
    if (bookOnly) {
      const book = findBook(bookOnly[1]);
      if (book) {
        return [
          { label: `${book.name} 1`, reference: `${book.name} 1` },
          { label: `${book.name} 1:1`, reference: `${book.name} 1:1` },
        ];
      }
    }

    return [];
  }

  function correctReference(detected) {
    const suggestions = [];
    const match = String(detected || "").match(/(\d+):(\d+)/);
    if (!match) return suggestions;
    const chapter = match[1];
    const badVerse = Number(match[2]);
    const bookPart = String(detected).split(/\d/)[0].trim();
    if (badVerse > 60) {
      suggestions.push(`${bookPart}${chapter}:${Math.floor(badVerse / 10)}`);
      suggestions.push(`${bookPart}${chapter}:${badVerse % 10 === 0 ? 16 : badVerse % 10}`);
    }
    return suggestions.filter(Boolean);
  }

  window.CISBibleReferenceParser = {
    BOOK_ALIASES,
    parseReference,
    findBook,
    formatReferenceLabel,
    suggestFromPartial,
    correctReference,
  };
})();
