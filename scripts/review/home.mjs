/** Home cards once they have all rendered (Home fills in progressively):
 * [{ k: index among <img>, txt: card text, src: image path }]. */
export async function homeCards(c) {
  let previous = -1,
    stable = 0;
  for (let i = 0; i < 60 && stable < 4; i++) {
    const count = await c.evaluate(`document.querySelectorAll('img:not(dialog img)').length`);
    stable = count === previous && count > 0 ? stable + 1 : 0;
    previous = count;
    await c.sleep(150);
  }
  return c.evaluate(
    `[...document.querySelectorAll('img:not(dialog img)')].map((i,k)=>({k,txt:i.closest('button,a')?.textContent.trim(),src:new URL(i.src).pathname.slice(1)})).filter(x=>x.txt)`,
  );
}
