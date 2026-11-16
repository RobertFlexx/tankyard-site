import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TOURS, tourFromHash } from "../js/workshop-tours.js";

for (const [id, tour] of Object.entries(TOURS)) {
  assert.equal(tourFromHash(`#${id}-video`), id);
  assert.equal(tourFromHash(`#${id}%2Dvideo`), id);
  assert.ok(tour.duration > 0 && Number.isFinite(tour.duration));
  for (const file of [tour.poster, `media/${tour.file}.mp4`, `media/${tour.file}.webm`, ...(tour.track ? [tour.track] : [])]) {
    assert.ok(statSync(fileURLToPath(new URL(`../${file}`, import.meta.url))).size > 0, file);
  }
  let last = -1;
  for (const chapter of tour.chapters) {
    assert.ok(chapter.t >= 0 && chapter.t < tour.duration && chapter.t >= last, `${id}: chapter order`);
    assert.ok(chapter.title.length > 0);
    last = chapter.t;
  }
  last = -1;
  for (const [at, text] of tour.captions) {
    assert.ok(at >= 0 && at < tour.duration && at >= last, `${id}: caption order`);
    assert.ok(text.length > 0);
    last = at;
  }
}
for (const hash of ["", "#workshop", "#missing-video", "#%", "#__proto__-video"]) assert.equal(tourFromHash(hash), null);
console.log(`${Object.keys(TOURS).length} tutorial videos have media, ordered chapters/captions and working direct links.`);
