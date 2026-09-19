// Разбор docs/store-listing.md — общий для контракта storeListing.test.ts и заливки scripts/asc_sync.js.
// Заголовки полей — часть контракта: `### <язык> · <поле> (<лимит>)`.

/** Заголовок поля: `### ru · короткое описание Google (80)`. */
const HEAD = /^###\s+(\S+)\s+·\s+(.+?)\s+\((\d+)\)\s*$/;

/** Разбор документа в список {lang, field, limit, text}. Тело поля кончается на любом заголовке `#`
 *  или горизонтальной линии `---`: так текст соседнего языка и служебные разделы файла не
 *  приклеиваются к последнему полю. */
function parseListing(md) {
  const out = [];
  let head = null;
  let body = [];

  const flush = () => {
    if (head) out.push({ ...head, text: body.join('\n').trim() });
    head = null;
    body = [];
  };

  for (const line of md.split(/\r?\n/)) {
    const m = HEAD.exec(line);
    if (m) {
      flush();
      head = { lang: m[1], field: m[2], limit: Number(m[3]) };
      continue;
    }
    if (head && (line.startsWith('#') || line.trim() === '---')) {
      flush();
      continue;
    }
    if (head) body.push(line);
  }
  flush();
  return out;
}

/** Текст поля App Review Notes — первый блок кода в разделе «Заметки для ревьюера». */
function reviewNotes(md) {
  const m = /## Заметки для ревьюера[\s\S]*?```\r?\n([\s\S]*?)\r?\n```/.exec(md);
  if (!m) throw new Error('store-listing.md: не найден блок Review Notes');
  return m[1].replace(/\r\n/g, '\n');
}

module.exports = { parseListing, reviewNotes };
