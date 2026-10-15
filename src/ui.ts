import type { Recipe } from "./game/types";

const paths: Record<string, string> = {
  restaurant:
    '<path d="M3 10 12 3l9 7v11H3Z"/><path d="M8 21v-8h8v8M2 10h20"/>',
  kitchen:
    '<path d="M7 8a4 4 0 0 1 1-7 4 4 0 0 1 8 0 4 4 0 0 1 1 7v11H7Z"/><path d="M7 15h10M10 9v3m4-3v3"/>',
  menu: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M9 7h6m-6 4h6m-6 4h4"/>',
  staff:
    '<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M16 4a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5v2"/>',
  stock:
    '<path d="m3 7 9-5 9 5-9 5Z"/><path d="M3 7v11l9 4 9-4V7M12 12v10M7 5l9 5"/>',
  finance: '<path d="M3 21h19M6 17v-5m5 5V8m5 9V4m5 13V1"/>',
  career: '<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>',
  trophy:
    '<path d="M7 2h10v7a5 5 0 0 1-10 0ZM7 4H3v4a4 4 0 0 0 4 4m10-8h4v4a4 4 0 0 1-4 4M12 14v6m-5 2h10"/>',
  upgrade: '<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',
  settings:
    '<path d="m9 3 1-2h4l1 2 3 2 3 1v4l-2 2v3l1 3-3 3-3-1h-3l-3 1-3-3 1-3v-3l-2-2V6l3-1Z"/><circle cx="12" cy="11" r="4"/>',
  save: '<path d="M3 3h15l3 3v15H3Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
  pause: '<path d="M8 4v16m8-16v16"/>',
  play: '<path d="m7 3 14 9-14 9Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
  coin: '<ellipse cx="12" cy="12" rx="8" ry="10"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',
  leaf: '<path d="M20 3S2 1 3 14a7 7 0 0 0 12 5c5-5 5-16 5-16ZM4 20 15 9"/>',
  check: '<path d="m4 12 5 5L21 5"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  sound:
    '<path d="M3 9h4l5-5v16l-5-5H3Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  download: '<path d="M12 2v14m-5-5 5 5 5-5M3 16v6h18v-6"/>',
  wash: '<path d="M4 12h16v4a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6ZM8 12V5a4 4 0 0 1 8 0v2M7 16h10"/>',
  heart:
    '<path d="M12 21S1 14 2 7a5 5 0 0 1 10-1 5 5 0 0 1 10 1c1 7-10 14-10 14Z"/>',
};
export function icon(name: string, cls = ""): string {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
}
export function escape(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export const money = (n: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(n);
export const pct = (n: number): string => `${Math.round(n)}%`;
export function food(recipe: Recipe | undefined, size = 100): string {
  const id = recipe?.id || "salada";
  const name = (recipe?.name || "").toLowerCase();
  const color = recipe?.color || "#dd7542";
  let dish = "";
  if (/hamb|sandu|lanche/.test(name + id))
    dish =
      '<path d="M22 49Q25 20 50 20t28 29" fill="#df9b48"/><path d="M22 49h56v9H22" fill="#68a14e"/><path d="m21 58 58 1-5 11H26" fill="#613b29"/><path d="m25 58 23 5 26-5" fill="#efc258"/><path d="M24 70h52q-2 14-26 14T24 70" fill="#d99143"/><g fill="#f8dd96"><ellipse cx="42" cy="32" rx="3" ry="1.5"/><ellipse cx="61" cy="36" rx="3" ry="1.5"/><ellipse cx="32" cy="39" rx="3" ry="1.5"/></g>';
  else if (/pizz/.test(name + id))
    dish =
      '<ellipse cx="50" cy="52" rx="33" ry="27" fill="#cb8745"/><ellipse cx="50" cy="50" rx="29" ry="24" fill="#e9be6b"/><g fill="#bd503c"><circle cx="36" cy="43" r="6"/><circle cx="61" cy="40" r="6"/><circle cx="55" cy="61" r="6"/><circle cx="31" cy="59" r="5"/></g><g fill="#43865c"><path d="m49 30 7 10-9-1ZM65 54l10 5-8 7ZM36 68l8-9 4 9Z"/></g>';
  else if (/bebida|suco|cafe|café|limon|chá/.test(name + id + recipe?.category))
    dish = `<path d="M28 25h43l-6 55H34Z" fill="#e9d9bb"/><path d="m32 36 35 1-4 39H37Z" fill="${color}"/><path d="m57 34 6-26h15" fill="none" stroke="#56674c" stroke-width="4"/><ellipse cx="50" cy="25" rx="21" ry="5" fill="#fff7d6"/><circle cx="30" cy="35" r="12" fill="#ebcc67"/><path d="m30 25 0 20m-10-10h20" stroke="#fff4a1" stroke-width="2"/>`;
  else if (/bolo|torta|sobrem|mousse|doce/.test(name + id + recipe?.category))
    dish = `<path d="m22 66 32-40 25 38-3 13H25Z" fill="${color}"/><path d="m22 57 32-40 25 38-3 9H25Z" fill="#f0cba0"/><path d="m22 54 32-37 25 38H25Z" fill="#f3e4d2"/><circle cx="52" cy="27" r="7" fill="#b9493f"/><path d="m52 20 4-7" stroke="#528457" stroke-width="3"/>`;
  else if (/sopa|risoto|massa|espagu|arroz|feij/.test(name + id))
    dish = `<ellipse cx="50" cy="52" rx="33" ry="26" fill="#7c553a"/><ellipse cx="50" cy="46" rx="32" ry="24" fill="#f1e3c7"/><ellipse cx="50" cy="46" rx="26" ry="18" fill="${color}"/><g fill="none" stroke="#f4d895" stroke-width="3"><path d="M31 42q20-12 36 2T35 54q-11-9 28-12"/><path d="M39 32q22 16-2 28"/></g><g fill="#498254"><ellipse cx="55" cy="37" rx="5" ry="3"/><ellipse cx="38" cy="49" rx="5" ry="3"/></g>`;
  else if (/salad/.test(name + id))
    dish =
      '<g fill="#5d9855"><ellipse cx="35" cy="47" rx="16" ry="12" transform="rotate(-30 35 47)"/><ellipse cx="62" cy="43" rx="16" ry="12" transform="rotate(30 62 43)"/><ellipse cx="54" cy="61" rx="22" ry="12"/><ellipse cx="36" cy="63" rx="14" ry="12"/></g><g fill="#ce5b43"><circle cx="36" cy="44" r="7"/><circle cx="62" cy="60" r="7"/></g><g fill="#f7dc9f"><rect x="46" y="42" width="8" height="9" transform="rotate(15 50 45)"/><rect x="35" y="62" width="8" height="8"/></g>';
  else
    dish = `<ellipse cx="52" cy="53" rx="26" ry="20" fill="${color}"/><path d="m34 40 32 23m-25-29 30 22m-42-8 30 23" stroke="#884c31" stroke-width="3" opacity=".65"/><g fill="#62964e"><ellipse cx="28" cy="65" rx="10" ry="7"/><ellipse cx="72" cy="38" rx="9" ry="6"/></g><path d="m64 65 13-7 3 9-13 7Z" fill="#e7b85b"/>`;
  return `<svg class="food-art" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="${escape(recipe?.name || "Prato da casa")}"><ellipse cx="50" cy="73" rx="43" ry="15" fill="#392e24" opacity=".12"/><ellipse cx="50" cy="56" rx="45" ry="34" fill="#e0d8c7"/><ellipse cx="50" cy="53" rx="44" ry="33" fill="#fff9e9"/><ellipse cx="50" cy="53" rx="35" ry="25" fill="#f4ecd9" stroke="#c5cdb7" stroke-width="1.5"/>${dish}</svg>`;
}
